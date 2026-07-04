import { describe, expect, it } from 'vitest';
import { parseConstruct } from './construct';
import { REWARDS } from './config';
import { step } from './environment';
import type { GridPosition } from './grid';

// A 3x3 room with one interior wall. Goal at bottom-right.
//   S . .
//   . # .
//   . . G
const construct = parseConstruct('env', ['S..', '.#.', '..G']);
const goal: GridPosition = { x: 2, y: 2 };

describe('step', () => {
  it('moves into an open cell for the step cost', () => {
    const outcome = step(construct, { x: 0, y: 0 }, 'right', goal);
    expect(outcome.nextPosition).toEqual({ x: 1, y: 0 });
    expect(outcome.reward).toBe(REWARDS.step);
    expect(outcome.hitWall).toBe(false);
    expect(outcome.reachedGoal).toBe(false);
  });

  it('bumping an interior wall keeps the Sim in place for the wall penalty', () => {
    const outcome = step(construct, { x: 1, y: 0 }, 'down', goal); // (1,1) is a wall
    expect(outcome.nextPosition).toEqual({ x: 1, y: 0 });
    expect(outcome.reward).toBe(REWARDS.wallBump);
    expect(outcome.hitWall).toBe(true);
    expect(outcome.reachedGoal).toBe(false);
  });

  it('walking off the grid is also a wall bump', () => {
    const outcome = step(construct, { x: 0, y: 0 }, 'up', goal); // off the top edge
    expect(outcome.nextPosition).toEqual({ x: 0, y: 0 });
    expect(outcome.reward).toBe(REWARDS.wallBump);
    expect(outcome.hitWall).toBe(true);
  });

  it('reaching the goal yields the goal reward and flags reachedGoal', () => {
    const outcome = step(construct, { x: 2, y: 1 }, 'down', goal); // into (2,2) = goal
    expect(outcome.nextPosition).toEqual(goal);
    expect(outcome.reward).toBe(REWARDS.goal);
    expect(outcome.reachedGoal).toBe(true);
    expect(outcome.hitWall).toBe(false);
  });

  it('uses the live goal argument, not the Construct’s initial goal', () => {
    const relocated: GridPosition = { x: 0, y: 2 };
    const outcome = step(construct, { x: 0, y: 1 }, 'down', relocated);
    expect(outcome.reachedGoal).toBe(true);
    expect(outcome.reward).toBe(REWARDS.goal);
  });
});
