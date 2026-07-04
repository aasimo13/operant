import {
  QLearningAgent,
  SimEngine,
  FIRST_CONSTRUCT,
  type Rng,
  type TickRecord,
} from '@operant/core';
import {
  buildTickMessage,
  buildWelcome,
  type ClientMessage,
  type TickMessage,
  type WelcomeMessage,
} from '../net/protocol';
import { initialSimState, loadOrInitializeSim, type SimStore } from '../persistence/simStore';
import type { PersistedSimState } from '../persistence/types';
import { lookupConstruct } from './constructs';

/** Magnitude of a single Providence nudge folded into the Q-update. Tunable. */
const PROVIDENCE_REWARD = 10;
const PROVIDENCE_PUNISH = -10;

/** How many recent tick records to keep for reconnect backfill (constraint 16). */
const DEFAULT_RECENT_LIMIT = 50;

type TickListener = (message: TickMessage) => void;

export interface SimHostOptions {
  readonly engine: SimEngine;
  readonly store: SimStore;
  readonly recentLimit?: number;
  readonly providenceReward?: number;
  readonly providencePunish?: number;
}

/**
 * The always-on simulation host: it owns the one Sim, steps it forward, applies
 * queued Observer inputs, persists after every step, and broadcasts live state.
 *
 * It ticks on the server's own clock (see {@link start}) so the Sim runs whether
 * or not anyone is watching (CLAUDE.md constraints 7 & 8). Clients are pure
 * observers — they receive state and send inputs; they never own the loop.
 */
export class SimHost {
  private readonly engine: SimEngine;
  private readonly store: SimStore;
  private readonly recentLimit: number;
  private readonly providenceReward: number;
  private readonly providencePunish: number;

  private readonly listeners = new Set<TickListener>();
  private readonly inputQueue: ClientMessage[] = [];
  private readonly recentRecords: TickRecord[] = [];

  private running = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(options: SimHostOptions) {
    this.engine = options.engine;
    this.store = options.store;
    this.recentLimit = options.recentLimit ?? DEFAULT_RECENT_LIMIT;
    this.providenceReward = options.providenceReward ?? PROVIDENCE_REWARD;
    this.providencePunish = options.providencePunish ?? PROVIDENCE_PUNISH;
  }

  /** Queue an Observer input to be applied on the next tick. */
  enqueueInput(input: ClientMessage): void {
    this.inputQueue.push(input);
  }

  /** Subscribe to per-tick broadcasts. Returns an unsubscribe function. */
  subscribe(listener: TickListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** The bounded window of recent tick records (oldest first). */
  recent(): TickRecord[] {
    return [...this.recentRecords];
  }

  /** The snapshot a newly-connected Observer receives. */
  welcomeFor(): WelcomeMessage {
    return buildWelcome(this.engine, this.recent());
  }

  /**
   * Advance the Sim one decision step: drain queued inputs, step + learn,
   * persist, and broadcast. Persistence happens every tick — trivial load at
   * this tick rate, and it means a crash loses at most one step.
   */
  async tick(): Promise<TickRecord> {
    const bonusReward = this.drainInputs();
    const record = this.engine.tick({ bonusReward });

    await this.store.saveSim(this.snapshot());

    this.remember(record);
    this.broadcast(buildTickMessage(this.engine, record));
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

  /** Apply queued inputs; return the summed Providence bonus for this tick. */
  private drainInputs(): number {
    let bonus = 0;
    for (const input of this.inputQueue) {
      if (input.type === 'intervene') {
        this.engine.intervene(input.position);
      } else {
        bonus += input.kind === 'reward' ? this.providenceReward : this.providencePunish;
      }
    }
    this.inputQueue.length = 0;
    return bonus;
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

  private broadcast(message: TickMessage): void {
    for (const listener of this.listeners) listener(message);
  }
}

export interface CreateSimHostOptions {
  readonly store: SimStore;
  readonly rng: Rng;
  readonly recentLimit?: number;
}

/**
 * Build the host, rehydrating the Sim from storage. On an empty store it
 * initializes one fresh Sim (the only from-scratch path); otherwise it restores
 * the exact learned state — never reinitializing (constraints 1 & 2).
 */
export async function createSimHost(options: CreateSimHostOptions): Promise<SimHost> {
  const state = await loadOrInitializeSim(options.store, () => initialSimState(FIRST_CONSTRUCT));
  const engine = new SimEngine({
    construct: lookupConstruct(state.constructId),
    agent: QLearningAgent.deserialize(state.agent),
    rng: options.rng,
    position: state.position,
    goal: state.goal,
    tickCount: state.tickCount,
  });
  const hostOptions: SimHostOptions = {
    engine,
    store: options.store,
    ...(options.recentLimit !== undefined ? { recentLimit: options.recentLimit } : {}),
  };
  return new SimHost(hostOptions);
}
