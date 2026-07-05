import type {
  ConstructDesign,
  GridPosition,
  QLearningAgentSnapshot,
  WearState,
} from '@operant/core';

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
  /** Which built-in Construct the Sim is in (e.g. 'first'); ignored if currentDesign is set. */
  readonly constructId: string;
  /**
   * The current world's design when it is Observer-authored (rebuilt on boot,
   * decoupled from the code registry); null/absent for a built-in Construct.
   */
  readonly currentDesign?: ConstructDesign | null;
  /** Observer-authored worlds queued to become the Sim's next chapters, in order. */
  readonly queue?: ConstructDesign[];
  /** The Sim's current cell. */
  readonly position: GridPosition;
  /** The live goal cell (relocates on arrival — no completion state). */
  readonly goal: GridPosition;
  /** How many decision ticks have ever elapsed. Monotonic; never resets. */
  readonly tickCount: number;
  /** Which checkpoint the Sim is currently seeking on a circuit (0 for a maze). */
  readonly checkpointIndex: number;
  /** The learned Q-table + hyperparameters. The irreplaceable part. */
  readonly agent: QLearningAgentSnapshot;
  /** Accumulated visible wear — structurally separate from the Q-values. */
  readonly wear: WearState;
}
