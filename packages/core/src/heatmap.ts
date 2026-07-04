import { positionKey } from './grid';
import type { Construct } from './construct';
import type { QLearningAgent } from './qLearningAgent';

/**
 * The Sim's learned "value landscape": for each open cell, the value of its best
 * action (max over actions of Q); `null` for wall cells. This is what the
 * god-view heatmap colours — a glimpse of how the Sim has come to feel about
 * each part of the Substrate. Read-only: it never mutates the agent.
 *
 * Returned as `grid[y][x]` to match the Construct's row-major layout.
 */
export function bestActionValues(
  construct: Construct,
  agent: QLearningAgent,
): Array<Array<number | null>> {
  const grid: Array<Array<number | null>> = [];
  for (let y = 0; y < construct.height; y++) {
    const row: Array<number | null> = [];
    for (let x = 0; x < construct.width; x++) {
      if (construct.isWall({ x, y })) {
        row.push(null);
      } else {
        row.push(Math.max(...agent.getQValues(positionKey({ x, y }))));
      }
    }
    grid.push(row);
  }
  return grid;
}
