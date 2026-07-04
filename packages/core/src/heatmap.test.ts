import { describe, expect, it } from 'vitest';
import { parseConstruct } from './construct';
import { QLearningAgent } from './qLearningAgent';
import { bestActionValues } from './heatmap';

// 2x2 with one wall at (1,0):
//   S #
//   . G
const construct = parseConstruct('hm', ['S#', '.G']);

describe('bestActionValues', () => {
  it('returns the max Q per open cell and null for walls', () => {
    const agent = new QLearningAgent({ alpha: 0.1, gamma: 0.95 });
    agent.update('0,0', 'right', 10, '0,1'); // Q(0,0) best = 0.1*10 = 1.0

    const grid = bestActionValues(construct, agent);

    expect(grid[0]![1]).toBeNull(); // wall cell
    expect(grid[0]![0]).toBeCloseTo(1.0, 6); // best action at (0,0)
    expect(grid[1]![0]).toBe(0); // unvisited open cell
    expect(grid[1]![1]).toBe(0); // unvisited open cell (goal)
  });

  it('does not mutate the agent (reading the heatmap adds no Q-table rows)', () => {
    const agent = new QLearningAgent();
    agent.update('0,0', 'right', 1, '0,1');

    bestActionValues(construct, agent);

    // Only the one visited state should exist — not one row per cell.
    expect(Object.keys(agent.serialize().qTable)).toEqual(['0,0']);
  });
});
