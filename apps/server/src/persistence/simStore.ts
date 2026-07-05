import {
  QLearningAgent,
  initialWearState,
  type Construct,
  type NarrationLine,
} from '@operant/core';
import type { PersistedSimState } from './types';

/**
 * Storage for the one canonical Sim. A thin data-access boundary so the
 * simulation host never couples to a specific database (see CLAUDE.md
 * engineering standards). The Postgres implementation lives alongside; tests
 * can swap in an in-memory fake.
 */
/** A compacted era of old transcript lines — the deep past, summarized. */
export interface TranscriptEpoch {
  readonly fromTick: number;
  readonly toTick: number;
  readonly lineCount: number;
  /** A few representative lines kept for flavor (e.g. the era's first and last). */
  readonly sample: string[];
}

/** How many raw lines were folded away, and into how many epochs. */
export interface CompactionResult {
  readonly epochsCreated: number;
  readonly linesCompacted: number;
}

export interface SimStore {
  /** Idempotently prepare storage (create tables/schema if missing). */
  init(): Promise<void>;
  /** The persisted Sim state, or null if none has ever been written. */
  loadSim(): Promise<PersistedSimState | null>;
  /** Persist the single canonical Sim state (upsert — one row, ever). */
  saveSim(state: PersistedSimState): Promise<void>;
  /** Append one narrator line to the permanent transcript (never erased). */
  appendTranscript(line: NarrationLine): Promise<void>;
  /** The most recent `limit` transcript lines, oldest first (for backfill). */
  recentTranscript(limit: number): Promise<NarrationLine[]>;
  /**
   * Keep the newest `retainRaw` transcript lines raw and fold everything older
   * into `epochSize`-line aggregate epochs, bounding the raw table without ever
   * erasing the past (constraint 15). Idempotent and safe to run repeatedly.
   */
  compactTranscript(opts: { retainRaw: number; epochSize: number }): Promise<CompactionResult>;
  /** The most recent compacted epochs, oldest first (the deep past). */
  recentEpochs(limit: number): Promise<TranscriptEpoch[]>;
  /** Release resources (connection pool). */
  close(): Promise<void>;
}

/** The state of a Sim that has just been born into a Construct — nothing learned yet. */
export function initialSimState(construct: Construct): PersistedSimState {
  return {
    constructId: construct.id,
    currentDesign: null,
    queue: [],
    position: construct.start,
    goal: construct.goal,
    tickCount: 0,
    checkpointIndex: 0,
    agent: new QLearningAgent().serialize(),
    wear: initialWearState(),
  };
}

/**
 * Load the Sim, or initialize it once if storage is completely empty.
 *
 * This is the ONLY code path that may create a Sim from scratch, and it runs
 * only when `loadSim()` returns null (a truly empty store). On every boot where
 * state already exists, the Sim is rehydrated exactly — never reinitialized,
 * never overwritten (CLAUDE.md constraints 1 & 2). The `initial` factory is not
 * even invoked when state exists.
 */
export async function loadOrInitializeSim(
  store: SimStore,
  initial: () => PersistedSimState,
): Promise<PersistedSimState> {
  const existing = await store.loadSim();
  if (existing) return existing;

  const fresh = initial();
  await store.saveSim(fresh);
  return fresh;
}
