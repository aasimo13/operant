/**
 * @operant/core — the framework-agnostic heart of the project.
 *
 * The Q-learning RL engine and shared domain types. NO dependency on React,
 * Three.js, the DOM, or any server framework: the RL core reasons purely in 2D
 * grid coordinates, and the 3D scene is a rendering layer built on top of it
 * (see CLAUDE.md — "Never let the RL core take a dependency on the 3D/rendering
 * code"). ESLint enforces this boundary mechanically.
 */

/** Marker used to confirm wiring across packages. */
export const CORE_VERSION = '0.0.0' as const;

// Grid primitives.
export { ACTIONS, applyAction, positionKey } from './grid';
export type { Action, GridPosition } from './grid';

// Construct (one maze instance) + geometry/solvability helpers.
export { parseConstruct, shortestPathLength } from './construct';
export type { Construct } from './construct';
export { FIRST_CONSTRUCT } from './firstConstruct';

// Environment dynamics.
export { step } from './environment';
export type { StepOutcome } from './environment';

// Tuning constants (single source of truth).
export { REWARDS, RL_DEFAULTS } from './config';

// The learning agent.
export { QLearningAgent } from './qLearningAgent';
export type { QLearningAgentOptions, QLearningAgentSnapshot } from './qLearningAgent';

// The continuing-task driver the simulation host ticks.
export { SimEngine } from './simEngine';
export type { SimEngineOptions, TickRecord, RelocateGoal } from './simEngine';

// Deterministic randomness.
export { createRng } from './rng';
export type { Rng } from './rng';
