import {
  QLearningAgent,
  SimEngine,
  FIRST_CONSTRUCT,
  advanceWear,
  initialWearState,
  strainDecayPerTick,
  wearBreakdown,
  validateConstructDesign,
  emptyChronicle,
  advanceChronicle,
  enterWorld,
  type Chronicle,
  type Construct,
  type ConstructDesign,
  type NarrationLine,
  type Rng,
  type TickRecord,
  type WearState,
} from '@operant/core';
import {
  buildChronicle,
  buildHeatmap,
  buildPresence,
  buildQueue,
  buildTickMessage,
  buildTransition,
  buildWelcome,
  type ClientMessage,
  type HeatmapMessage,
  type ServerMessage,
  type WelcomeMessage,
} from '../net/protocol';
import { initialSimState, loadOrInitializeSim, type SimStore } from '../persistence/simStore';
import type { PersistedSimState } from '../persistence/types';
import { Narrator } from '../narrator/narrator';
import { chronicleToMemory } from '../narrator/chronicleMemory';
import type { NarrationSource } from '../narrator/source';
import { CannedNarrationSource } from '../narrator/cannedSource';
import { createNarrationSource } from '../narrator/narrationFactory';
import { lookupConstruct, constructName } from './constructs';

/** Cap on how many Observer-authored worlds can wait in the queue at once. */
const MAX_QUEUE = 24;

/** Broadcast the (slowly-changing) Chronicle every N ticks, not every tick. */
const CHRONICLE_BROADCAST_TICKS = 5;

/** Magnitude of a single Providence nudge folded into the Q-update. Tunable. */
const PROVIDENCE_REWARD = 10;
const PROVIDENCE_PUNISH = -10;

/** How many recent tick records to keep for reconnect backfill (constraint 16). */
const DEFAULT_RECENT_LIMIT = 50;
/** How many recent narrator lines to keep for reconnect backfill (constraint 16). */
const DEFAULT_TRANSCRIPT_LIMIT = 40;
/** Assumed decision-tick length for wear decay when not otherwise configured. */
const DEFAULT_TICK_MS = 1500;

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
  /** Random source for building engines on a Construct transition. */
  readonly rng: Rng;
  /** Human name of the current world. */
  readonly constructName: string;
  /** The current world's design, if it is Observer-authored (else null/built-in). */
  readonly currentDesign?: ConstructDesign | null;
  /** Queued Observer-authored worlds rehydrated on boot. */
  readonly queueSeed?: ConstructDesign[];
  /** The Sim's life history rehydrated on boot (else a fresh one is started). */
  readonly chronicleSeed?: Chronicle;
  readonly recentLimit?: number;
  readonly providenceReward?: number;
  readonly providencePunish?: number;
  /** Narration source (defaults to canned scripted lines). */
  readonly narrationSource?: NarrationSource;
  readonly transcriptLimit?: number;
  /** Recent transcript lines rehydrated from storage on boot. */
  readonly transcriptSeed?: NarrationLine[];
  /** Accumulated wear rehydrated from storage on boot. */
  readonly wearSeed?: WearState;
  /** Decision-tick length, so recent-strain decays at the right real-time rate. */
  readonly tickMs?: number;
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
  private engine: SimEngine;
  private readonly store: SimStore;
  private readonly rng: Rng;
  private readonly recentLimit: number;
  private readonly transcriptLimit: number;
  private readonly providenceReward: number;
  private readonly providencePunish: number;
  private readonly narrator: Narrator;
  private readonly strainDecay: number;

  private readonly listeners = new Set<Listener>();
  private readonly inputQueue: ClientMessage[] = [];
  private readonly recentRecords: TickRecord[] = [];
  private readonly recentTranscript: NarrationLine[] = [];
  private wearState: WearState;

  /** Name of the current world, and its design if Observer-authored (else null). */
  private currentName: string;
  private currentDesign: ConstructDesign | null;
  /** Observer-authored worlds waiting to become the Sim's next chapters, in order. */
  private readonly constructQueue: ConstructDesign[];
  /** The Sim's accumulated life history (only ever grows). */
  private chronicle: Chronicle;

  private running = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(options: SimHostOptions) {
    this.engine = options.engine;
    this.store = options.store;
    this.rng = options.rng;
    this.recentLimit = options.recentLimit ?? DEFAULT_RECENT_LIMIT;
    this.transcriptLimit = options.transcriptLimit ?? DEFAULT_TRANSCRIPT_LIMIT;
    this.providenceReward = options.providenceReward ?? PROVIDENCE_REWARD;
    this.providencePunish = options.providencePunish ?? PROVIDENCE_PUNISH;
    this.strainDecay = strainDecayPerTick(options.tickMs ?? DEFAULT_TICK_MS);
    this.wearState = options.wearSeed ?? initialWearState();
    this.currentName = options.constructName;
    this.currentDesign = options.currentDesign ?? null;
    this.constructQueue = options.queueSeed ? [...options.queueSeed] : [];
    this.chronicle = options.chronicleSeed ?? emptyChronicle(options.constructName);
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
    this.broadcast(buildPresence(this.listeners.size)); // one more is watching
    return () => {
      this.listeners.delete(listener);
      this.broadcast(buildPresence(this.listeners.size)); // one fewer
    };
  }

  /** How many Observers are currently watching. */
  watching(): number {
    return this.listeners.size;
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
    return buildWelcome(
      this.engine,
      wearBreakdown(this.wearState),
      this.recent(),
      this.transcript(),
      this.currentName,
      this.queueNames(),
      this.chronicle,
      this.listeners.size,
    );
  }

  /** The Sim's accumulated life history. */
  lifeChronicle(): Chronicle {
    return this.chronicle;
  }

  /** Names of the worlds queued to become the Sim's next chapters, in order. */
  queueNames(): string[] {
    return this.constructQueue.map((d) => d.name);
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

    // Advance visible wear (presentation only; never feeds back into learning).
    this.wearState = advanceWear(
      this.wearState,
      { hitWall: record.hitWall, intervened: inputs.intervened, providence: inputs.providence },
      this.strainDecay,
    );

    // Fold this tick into the Sim's life history (only ever grows).
    this.chronicle = advanceChronicle(this.chronicle, {
      record,
      intervened: inputs.intervened,
      providence: inputs.providence,
    });

    // A reached goal is a natural chapter boundary: if an Observer has authored
    // the Sim's next world, it enters that world now (carrying its mind in),
    // instead of simply carrying on in this one.
    const transitioned = record.reachedGoal && this.constructQueue.length > 0 && this.drainQueue();

    await this.store.saveSim(this.snapshot());

    this.remember(record);
    // On a transition the client already got the new world + state; the normal
    // tick frame would describe the now-replaced engine, so skip it.
    if (!transitioned) {
      this.broadcast(
        buildTickMessage(this.engine, wearBreakdown(this.wearState), record, inputs.providence),
      );
    }
    // The Chronicle changes slowly; broadcast it on a cadence, not every tick.
    // (A world entry broadcasts it immediately via enterConstruct.)
    if (!transitioned && this.chronicle.age % CHRONICLE_BROADCAST_TICKS === 0) {
      this.broadcast(buildChronicle(this.chronicle));
    }

    // Fire-and-forget: the narrator may compose a line, but the tick never waits.
    this.narrator.observe({
      tick: record.tick,
      position: record.to,
      hitWall: record.hitWall,
      reachedGoal: record.reachedGoal,
      intervened: inputs.intervened,
      providence: inputs.providence,
      memory: chronicleToMemory(this.chronicle),
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
      } else if (input.type === 'transitionTo') {
        this.applyTransition(input.constructId);
      } else if (input.type === 'submitConstruct') {
        this.enqueueConstruct(input.design);
      }
      // requestHeatmap is handled at the WebSocket layer and never enqueued.
    }
    this.inputQueue.length = 0;
    return { bonus, intervened, providence };
  }

  /**
   * Validate and queue an Observer-authored world. Invalid designs (unsolvable,
   * mis-sized, unnamed) are silently dropped — untrusted input never throws — and
   * the queue is capped so no one can flood the Sim's future. On success, every
   * Observer sees the queue grow.
   */
  private enqueueConstruct(design: ConstructDesign): void {
    if (this.constructQueue.length >= MAX_QUEUE) return;
    const result = validateConstructDesign(design);
    if (!result.ok) return;
    // Store the trimmed name; keep the raw rows for faithful rebuilding.
    this.constructQueue.push({ id: design.id, name: design.name.trim(), rows: [...design.rows] });
    this.broadcast(buildQueue(this.queueNames()));
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

  /**
   * Move the Sim into a built-in Construct by id (an Observer dropping it into
   * the track/maze). See {@link enterConstruct} for the shared mechanics.
   */
  private applyTransition(constructId: string): void {
    if (constructId === this.engine.constructId && this.currentDesign === null) return; // already there
    const construct = lookupConstruct(constructId);
    this.enterConstruct(construct, constructName(constructId), null);
  }

  /**
   * Pull the next Observer-authored world off the queue and enter it. Returns
   * false if the (already valid) design somehow fails to rebuild, so the caller
   * can fall back to normal behavior. Broadcasts the shrunken queue.
   */
  private drainQueue(): boolean {
    const design = this.constructQueue.shift();
    if (!design) return false;
    const result = validateConstructDesign(design);
    if (!result.ok) {
      this.broadcast(buildQueue(this.queueNames()));
      return false;
    }
    this.enterConstruct(result.construct, design.name, design);
    this.broadcast(buildQueue(this.queueNames()));
    return true;
  }

  /**
   * Move the Sim into a Construct — built-in or Observer-authored. It carries its
   * learned Q-values across (nothing is erased) and restarts at the new world's
   * entrance. The world visibly changed, so the narrator gets a dedicated moment
   * and clients are told to reconfigure.
   */
  private enterConstruct(construct: Construct, name: string, design: ConstructDesign | null): void {
    this.engine = new SimEngine({
      construct,
      agent: this.engine.agent, // same brain — instincts carry over and misfire
      rng: this.rng,
      position: construct.start,
      tickCount: this.engine.tickCount,
    });
    this.currentName = name;
    this.currentDesign = design;
    // The Sim has been made to live another world — record it, and tell everyone.
    this.chronicle = enterWorld(this.chronicle, name, this.engine.tickCount);
    this.narrator.announce(
      'constructChanged',
      this.engine.tickCount,
      this.engine.position,
      chronicleToMemory(this.chronicle),
    );
    this.broadcast(buildTransition(this.engine, wearBreakdown(this.wearState), name));
    this.broadcast(buildChronicle(this.chronicle));
  }

  private snapshot(): PersistedSimState {
    return {
      constructId: this.engine.constructId,
      currentDesign: this.currentDesign,
      queue: [...this.constructQueue],
      chronicle: this.chronicle,
      position: this.engine.position,
      goal: this.engine.goal,
      tickCount: this.engine.tickCount,
      checkpointIndex: this.engine.checkpointIndex,
      agent: this.engine.agent.serialize(),
      wear: this.wearState,
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
  /** Decision-tick length, so wear decays at the right real-time rate. */
  readonly tickMs?: number;
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

  // The current world may be a built-in (looked up by id) or an Observer-authored
  // one (rebuilt from its persisted design — decoupled from the registry).
  const currentDesign = state.currentDesign ?? null;
  let construct: Construct;
  let name: string;
  if (currentDesign) {
    const result = validateConstructDesign(currentDesign);
    // A persisted design should always be valid; fall back to the first world if not.
    if (result.ok) {
      construct = result.construct;
      name = currentDesign.name;
    } else {
      construct = FIRST_CONSTRUCT;
      name = constructName(FIRST_CONSTRUCT.id);
    }
  } else {
    construct = lookupConstruct(state.constructId);
    name = constructName(state.constructId);
  }

  const engine = new SimEngine({
    construct,
    agent: QLearningAgent.deserialize(state.agent),
    rng: options.rng,
    position: state.position,
    goal: state.goal,
    tickCount: state.tickCount,
    checkpointIndex: state.checkpointIndex ?? 0,
  });
  // Rehydrate the Chronicle, or start one for a Sim that predates it — seeding
  // its age from the real tick count so its lifespan is honest even though the
  // finer counters can only accumulate from here on.
  const chronicleSeed = state.chronicle ?? { ...emptyChronicle(name), age: state.tickCount };

  return new SimHost({
    engine,
    store: options.store,
    rng: options.rng,
    constructName: name,
    currentDesign: currentDesign && construct !== FIRST_CONSTRUCT ? currentDesign : null,
    queueSeed: state.queue ?? [],
    chronicleSeed,
    transcriptSeed,
    wearSeed: state.wear ?? initialWearState(),
    narrationSource: options.narrationSource ?? createNarrationSource(),
    ...(options.tickMs !== undefined ? { tickMs: options.tickMs } : {}),
    ...(options.recentLimit !== undefined ? { recentLimit: options.recentLimit } : {}),
  });
}
