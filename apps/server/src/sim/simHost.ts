import {
  QLearningAgent,
  SimEngine,
  FIRST_CONSTRUCT,
  type NarrationLine,
  type Rng,
  type TickRecord,
} from '@operant/core';
import {
  buildHeatmap,
  buildTickMessage,
  buildWelcome,
  type ClientMessage,
  type HeatmapMessage,
  type ServerMessage,
  type WelcomeMessage,
} from '../net/protocol';
import { initialSimState, loadOrInitializeSim, type SimStore } from '../persistence/simStore';
import type { PersistedSimState } from '../persistence/types';
import { Narrator } from '../narrator/narrator';
import type { NarrationSource } from '../narrator/source';
import { CannedNarrationSource } from '../narrator/cannedSource';
import { createNarrationSource } from '../narrator/narrationFactory';
import { lookupConstruct } from './constructs';

/** Magnitude of a single Providence nudge folded into the Q-update. Tunable. */
const PROVIDENCE_REWARD = 10;
const PROVIDENCE_PUNISH = -10;

/** How many recent tick records to keep for reconnect backfill (constraint 16). */
const DEFAULT_RECENT_LIMIT = 50;
/** How many recent narrator lines to keep for reconnect backfill (constraint 16). */
const DEFAULT_TRANSCRIPT_LIMIT = 40;

type Listener = (message: ServerMessage) => void;

/** What was drained from the input queue on one tick. */
interface DrainedInputs {
  readonly bonus: number;
  readonly intervened: boolean;
  readonly providence: 'reward' | 'punish' | null;
}

export interface SimHostOptions {
  readonly engine: SimEngine;
  readonly store: SimStore;
  readonly recentLimit?: number;
  readonly providenceReward?: number;
  readonly providencePunish?: number;
  /** Narration source (defaults to canned scripted lines). */
  readonly narrationSource?: NarrationSource;
  readonly transcriptLimit?: number;
  /** Recent transcript lines rehydrated from storage on boot. */
  readonly transcriptSeed?: NarrationLine[];
}

/**
 * The always-on simulation host: it owns the one Sim, steps it forward, applies
 * queued Observer inputs, persists after every step, broadcasts live state, and
 * lets the narrator voice what happens.
 *
 * It ticks on the server's own clock (see {@link start}) so the Sim runs whether
 * or not anyone is watching (CLAUDE.md constraints 7 & 8). Clients are pure
 * observers. The narrator is a side-channel: it observes and comments, never
 * influences behavior, and never blocks the tick (constraint 3).
 */
export class SimHost {
  private readonly engine: SimEngine;
  private readonly store: SimStore;
  private readonly recentLimit: number;
  private readonly transcriptLimit: number;
  private readonly providenceReward: number;
  private readonly providencePunish: number;
  private readonly narrator: Narrator;

  private readonly listeners = new Set<Listener>();
  private readonly inputQueue: ClientMessage[] = [];
  private readonly recentRecords: TickRecord[] = [];
  private readonly recentTranscript: NarrationLine[] = [];

  private running = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(options: SimHostOptions) {
    this.engine = options.engine;
    this.store = options.store;
    this.recentLimit = options.recentLimit ?? DEFAULT_RECENT_LIMIT;
    this.transcriptLimit = options.transcriptLimit ?? DEFAULT_TRANSCRIPT_LIMIT;
    this.providenceReward = options.providenceReward ?? PROVIDENCE_REWARD;
    this.providencePunish = options.providencePunish ?? PROVIDENCE_PUNISH;
    if (options.transcriptSeed) this.recentTranscript.push(...options.transcriptSeed);
    this.narrator = new Narrator({
      source: options.narrationSource ?? new CannedNarrationSource(),
      onLine: (line) => this.emitNarration(line),
    });
  }

  /** Queue an Observer input to be applied on the next tick. */
  enqueueInput(input: ClientMessage): void {
    this.inputQueue.push(input);
  }

  /** Subscribe to broadcasts (ticks and narration). Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** The bounded window of recent tick records (oldest first). */
  recent(): TickRecord[] {
    return [...this.recentRecords];
  }

  /** The bounded window of recent narrator lines (oldest first). */
  transcript(): NarrationLine[] {
    return [...this.recentTranscript];
  }

  /** The snapshot a newly-connected Observer receives. */
  welcomeFor(): WelcomeMessage {
    return buildWelcome(this.engine, this.recent(), this.transcript());
  }

  /** The current value-landscape heatmap (for god-view Observers, on request). */
  heatmap(): HeatmapMessage {
    return buildHeatmap(this.engine);
  }

  /**
   * Advance the Sim one decision step: drain queued inputs, step + learn,
   * persist, broadcast, and let the narrator react. Persistence happens every
   * tick — trivial load at this tick rate, and a crash loses at most one step.
   */
  async tick(): Promise<TickRecord> {
    const inputs = this.drainInputs();
    const record = this.engine.tick({ bonusReward: inputs.bonus });

    await this.store.saveSim(this.snapshot());

    this.remember(record);
    this.broadcast(buildTickMessage(this.engine, record));

    // Fire-and-forget: the narrator may compose a line, but the tick never waits.
    this.narrator.observe({
      tick: record.tick,
      position: record.to,
      hitWall: record.hitWall,
      reachedGoal: record.reachedGoal,
      intervened: inputs.intervened,
      providence: inputs.providence,
    });

    return record;
  }

  /** Begin ticking on the server's own clock. */
  start(intervalMs: number): void {
    if (this.running) return;
    this.running = true;
    const loop = async (): Promise<void> => {
      if (!this.running) return;
      try {
        await this.tick();
      } catch (error) {
        console.error('[operant] tick failed:', error);
      }
      if (this.running) this.timer = setTimeout(() => void loop(), intervalMs);
    };
    this.timer = setTimeout(() => void loop(), intervalMs);
  }

  /** Stop ticking (the persisted state is already up to date). */
  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  /** Apply queued inputs; report the Providence bonus and what notable inputs occurred. */
  private drainInputs(): DrainedInputs {
    let bonus = 0;
    let intervened = false;
    let providence: 'reward' | 'punish' | null = null;
    for (const input of this.inputQueue) {
      if (input.type === 'intervene') {
        this.engine.intervene(input.position);
        intervened = true;
      } else if (input.type === 'providence') {
        bonus += input.kind === 'reward' ? this.providenceReward : this.providencePunish;
        providence = input.kind;
      }
      // requestHeatmap is handled at the WebSocket layer and never enqueued.
    }
    this.inputQueue.length = 0;
    return { bonus, intervened, providence };
  }

  /** Record, persist, and broadcast one narrator line. Never blocks the tick. */
  private emitNarration(line: NarrationLine): void {
    this.recentTranscript.push(line);
    if (this.recentTranscript.length > this.transcriptLimit) {
      this.recentTranscript.splice(0, this.recentTranscript.length - this.transcriptLimit);
    }
    void this.store.appendTranscript(line).catch((error: unknown) => {
      console.error('[operant] transcript persist failed:', error);
    });
    this.broadcast({ type: 'narration', line });
  }

  private snapshot(): PersistedSimState {
    return {
      constructId: this.engine.constructId,
      position: this.engine.position,
      goal: this.engine.goal,
      tickCount: this.engine.tickCount,
      agent: this.engine.agent.serialize(),
    };
  }

  private remember(record: TickRecord): void {
    this.recentRecords.push(record);
    if (this.recentRecords.length > this.recentLimit) {
      this.recentRecords.splice(0, this.recentRecords.length - this.recentLimit);
    }
  }

  private broadcast(message: ServerMessage): void {
    for (const listener of this.listeners) listener(message);
  }
}

export interface CreateSimHostOptions {
  readonly store: SimStore;
  readonly rng: Rng;
  readonly recentLimit?: number;
  readonly narrationSource?: NarrationSource;
}

/**
 * Build the host, rehydrating the Sim (and recent transcript) from storage. On
 * an empty store it initializes one fresh Sim (the only from-scratch path);
 * otherwise it restores the exact learned state — never reinitializing
 * (constraints 1 & 2).
 */
export async function createSimHost(options: CreateSimHostOptions): Promise<SimHost> {
  const state = await loadOrInitializeSim(options.store, () => initialSimState(FIRST_CONSTRUCT));
  const transcriptSeed = await options.store.recentTranscript(DEFAULT_TRANSCRIPT_LIMIT);
  const engine = new SimEngine({
    construct: lookupConstruct(state.constructId),
    agent: QLearningAgent.deserialize(state.agent),
    rng: options.rng,
    position: state.position,
    goal: state.goal,
    tickCount: state.tickCount,
  });
  return new SimHost({
    engine,
    store: options.store,
    transcriptSeed,
    narrationSource: options.narrationSource ?? createNarrationSource(),
    ...(options.recentLimit !== undefined ? { recentLimit: options.recentLimit } : {}),
  });
}
