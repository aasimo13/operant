import { describe, expect, it } from 'vitest';
import { parseConstruct } from './construct';
import { QLearningAgent } from './qLearningAgent';
import { bestActionValues } from './heatmap';
import { stateKey } from './grid';

// 2x2 with one wall at (1,0):
//   S #
//   . G
const construct = parseConstruct('hm', ['S#', '.G']);
const goal = { x: 1, y: 1 };

describe('bestActionValues', () => {
  it('returns the max Q per open cell (for the current target) and null for walls', () => {
    const agent = new QLearningAgent({ alpha: 0.1, gamma: 0.95 });
    // Goal-conditioned: at (0,0) seeking (1,1), 'right' → Q best = 0.1*10 = 1.0.
    agent.update(stateKey({ x: 0, y: 0 }, goal), 'right', 10, stateKey({ x: 0, y: 1 }, goal));

    const grid = bestActionValues(construct, agent, goal);

    expect(grid[0]![1]).toBeNull(); // wall cell
    expect(grid[0]![0]).toBeCloseTo(1.0, 6); // best action at (0,0)
    expect(grid[1]![0]).toBe(0); // unvisited open cell
    expect(grid[1]![1]).toBe(0); // unvisited open cell (goal)
  });

  it('does not mutate the agent (reading the heatmap adds no Q-table rows)', () => {
    const agent = new QLearningAgent();
    agent.update(stateKey({ x: 0, y: 0 }, goal), 'right', 1, stateKey({ x: 0, y: 1 }, goal));
    const before = Object.keys(agent.serialize().qTable);

    bestActionValues(construct, agent, goal);

    expect(Object.keys(agent.serialize().qTable)).toEqual(before);
  });
});
