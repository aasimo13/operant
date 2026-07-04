import { QLearningAgent, type Construct } from '@operant/core';
import type { PersistedSimState } from './types';

/**
 * Storage for the one canonical Sim. A thin data-access boundary so the
 * simulation host never couples to a specific database (see CLAUDE.md
 * engineering standards). The Postgres implementation lives alongside; tests
 * can swap in an in-memory fake.
 */
export interface SimStore {
  /** Idempotently prepare storage (create tables/schema if missing). */
  init(): Promise<void>;
  /** The persisted Sim state, or null if none has ever been written. */
  loadSim(): Promise<PersistedSimState | null>;
  /** Persist the single canonical Sim state (upsert — one row, ever). */
  saveSim(state: PersistedSimState): Promise<void>;
  /** Release resources (connection pool). */
  close(): Promise<void>;
}

/** The state of a Sim that has just been born into a Construct — nothing learned yet. */
export function initialSimState(construct: Construct): PersistedSimState {
  return {
    constructId: construct.id,
    position: construct.start,
    goal: construct.goal,
    tickCount: 0,
    agent: new QLearningAgent().serialize(),
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
