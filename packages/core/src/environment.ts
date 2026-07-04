import { REWARDS } from './config';
import { applyAction, positionKey, type Action, type GridPosition } from './grid';
import type { Construct } from './construct';

/** The result of the Sim taking one action in a Construct. */
export interface StepOutcome {
  /** Where the Sim ends up (unchanged from a wall bump). */
  readonly nextPosition: GridPosition;
  /** The single reward for this transition. */
  readonly reward: number;
  /** True if the intended move was blocked by a wall or the grid edge. */
  readonly hitWall: boolean;
  /** True if this transition landed the Sim on the (live) goal. */
  readonly reachedGoal: boolean;
}

/**
 * Pure environment transition: given the Sim's position and chosen action in a
 * Construct, compute where it ends up and the reward. The `goal` is passed in
 * explicitly (rather than read from the Construct) because there is no
 * completion state — reaching the goal relocates it, so the live goal is part
 * of the running simulation, not the static Construct.
 *
 * Each action yields exactly one reward: a wall bump (blocked), the goal reward
 * (landed on goal), or the ordinary step cost.
 */
export function step(
  construct: Construct,
  position: GridPosition,
  action: Action,
  goal: GridPosition,
): StepOutcome {
  const intended = applyAction(position, action);

  if (!construct.isOpen(intended)) {
    return { nextPosition: position, reward: REWARDS.wallBump, hitWall: true, reachedGoal: false };
  }

  const reachedGoal = positionKey(intended) === positionKey(goal);
  return {
    nextPosition: intended,
    reward: reachedGoal ? REWARDS.goal : REWARDS.step,
    hitWall: false,
    reachedGoal,
  };
}
