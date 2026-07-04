/**
 * All RL tuning constants in one place (see CLAUDE.md — "Keep all constants in
 * one config module, not scattered magic numbers"). These are informed starting
 * values, not tuned ones; expect to adjust them after watching real convergence.
 */

/** Reward shaping. Each action yields exactly one of these outcomes. */
export const REWARDS = {
  /** Cost of any ordinary move — encourages efficiency. */
  step: -1,
  /** Penalty for bumping a wall or the grid edge. */
  wallBump: -5,
  /** Reward for reaching the goal. */
  goal: 50,
} as const;

/**
 * Visible-wear constants (presentation only — see CLAUDE.md "Visible wear
 * formula"). Informed starting values, not validated ones; a dev-only debug
 * readout exists to retune them. Wear is stored structurally separate from the
 * Q-values and never feeds back into learning.
 */
export const WEAR = {
  /** Diminishing-returns constant for baseline wear (weighted punishment-units). */
  K: 50,
  /** Per-event negative weights. */
  weights: {
    /** Deliberate punishment — "someone meant to do this". */
    punishment: 1.0,
    /** Ordinary exploration bumps — kept tiny so the Sim isn't ragged in an hour. */
    wallBump: 0.05,
    /** Forced relocation (Intervene) — disorienting, not painful. */
    relocation: 0.15,
  },
  /** Weight of permanent baseline wear in the combined scalar (w1). */
  baselineWeight: 0.6,
  /** Weight of reactive recent strain in the combined scalar (w2). */
  strainWeight: 0.4,
  /** One-time multiplier applied to recent strain on positive Providence (relief). */
  reliefFactor: 0.5,
  /** Half-life of recent strain, in real milliseconds (~3 minutes). */
  strainHalfLifeMs: 180_000,
} as const;

/**
 * Q-learning hyperparameters. Note `gamma` is a continuing-task discount
 * (close to 1), NOT an episodic default: Operant has no terminal states, so the
 * update loop runs forever without ever resetting (see CLAUDE.md constraint 11).
 */
export const RL_DEFAULTS = {
  /** Learning rate. */
  alpha: 0.1,
  /** Discount factor — continuing task, no episodes. */
  gamma: 0.95,
  /** Starting exploration rate. */
  epsilonStart: 0.3,
  /** Exploration never drops below this — the Sim keeps some "free will". */
  epsilonFloor: 0.05,
  /**
   * Per-tick multiplicative decay applied to epsilon down toward the floor.
   * Slow: it takes thousands of ticks to approach the floor.
   */
  epsilonDecay: 0.9995,
} as const;
