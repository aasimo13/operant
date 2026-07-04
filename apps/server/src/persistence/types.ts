import type { GridPosition, QLearningAgentSnapshot, WearState } from '@operant/core';

/**
 * The full canonical state of the one persistent Sim, as written to storage.
 *
 * This is everything needed to rehydrate the Sim exactly on boot (deploy,
 * crash, restart) so its learned knowledge is never lost or reinitialized (see
 * CLAUDE.md constraints 1 and 2). The Construct itself is code, referenced by
 * id; only the live, mutable state lives here.
 *
 * Presentation-only "visible wear" fields are deliberately not here yet — they
 * arrive with the wear layer (build-order step 11) and are stored structurally
 * separate from the Q-values regardless.
 */
export interface PersistedSimState {
  /** Which Construct the Sim is currently in (e.g. 'first'). */
  readonly constructId: string;
  /** The Sim's current cell. */
  readonly position: GridPosition;
  /** The live goal cell (relocates on arrival — no completion state). */
  readonly goal: GridPosition;
  /** How many decision ticks have ever elapsed. Monotonic; never resets. */
  readonly tickCount: number;
  /** The learned Q-table + hyperparameters. The irreplaceable part. */
  readonly agent: QLearningAgentSnapshot;
  /** Accumulated visible wear — structurally separate from the Q-values. */
  readonly wear: WearState;
}
