/**
 * @operant/core — the framework-agnostic heart of the project.
 *
 * This package will hold the Q-learning RL engine and the shared domain types.
 * It has NO dependency on React, Three.js, the DOM, or any server framework:
 * the RL core reasons purely in 2D grid coordinates, and the 3D scene is a
 * rendering layer built on top of it (see CLAUDE.md — "Never let the RL core
 * take a dependency on the 3D/rendering code"). ESLint enforces this boundary
 * mechanically.
 *
 * Right now this is a scaffold placeholder. The actual Q-learning core is
 * build-order step 2 and is intentionally NOT implemented here yet.
 */

/** Marker used by the smoke test and by downstream packages to confirm wiring. */
export const CORE_VERSION = '0.0.0' as const;

/**
 * The Sim's four discrete actions. The RL core operates on a plain 2D grid;
 * these are the only moves it can choose between.
 */
export type Action = 'up' | 'down' | 'left' | 'right';

/** All four actions, in a stable order, for iteration in the (future) engine. */
export const ACTIONS: readonly Action[] = ['up', 'down', 'left', 'right'] as const;

/** A position on the Construct's grid. Origin (0,0) is the top-left cell. */
export interface GridPosition {
  readonly x: number;
  readonly y: number;
}
