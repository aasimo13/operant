/**
 * Plain 2D grid primitives. The RL core reasons entirely in these terms; the
 * 3D scene is a rendering layer built on top (see CLAUDE.md). Nothing here
 * knows about walls, goals, or rewards — that is the Construct/environment's
 * job. These functions describe only geometry.
 */

/** The Sim's four discrete actions. */
export type Action = 'up' | 'down' | 'left' | 'right';

/** All four actions, in a stable order, so action indices are deterministic. */
export const ACTIONS: readonly Action[] = ['up', 'down', 'left', 'right'] as const;

/** A position on the Construct's grid. Origin (0,0) is the top-left cell. */
export interface GridPosition {
  readonly x: number;
  readonly y: number;
}

/** Stable string key for a position, used to index the Q-table. */
export function positionKey(pos: GridPosition): string {
  return `${pos.x},${pos.y}`;
}

/**
 * The position an action *intends* to move to. Rows increase downward, so `up`
 * decrements y. Whether the move is actually legal (wall / out of bounds) is
 * decided by the environment, not here.
 */
export function applyAction(pos: GridPosition, action: Action): GridPosition {
  switch (action) {
    case 'up':
      return { x: pos.x, y: pos.y - 1 };
    case 'down':
      return { x: pos.x, y: pos.y + 1 };
    case 'left':
      return { x: pos.x - 1, y: pos.y };
    case 'right':
      return { x: pos.x + 1, y: pos.y };
  }
}
