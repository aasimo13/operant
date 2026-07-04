import { describe, expect, it } from 'vitest';
import { SimEngine } from './simEngine';
import { QLearningAgent } from './qLearningAgent';
import { parseConstruct } from './construct';
import { createRng } from './rng';

// A linear "track" so the Sim can walk right through checkpoints 0,1,2 in order.
const circuit = parseConstruct('c', ['S012']);

function rightSeekingAgent(): QLearningAgent {
  // epsilonFloor 0 so it stays fully greedy (no exploration) across ticks.
  const agent = new QLearningAgent({ epsilon: 0, epsilonFloor: 0 });
  for (let x = 0; x < 3; x++) agent.update(`${x},0`, 'right', 100, `${x + 1},0`);
  return agent;
}

describe('SimEngine — circuit checkpoint progression', () => {
  it('starts targeting the first checkpoint', () => {
    const e = new SimEngine({ construct: circuit, agent: rightSeekingAgent(), rng: createRng(1) });
    expect(e.goal).toEqual({ x: 1, y: 0 }); // checkpoint 0
    expect(e.checkpointIndex).toBe(0);
  });

  it('advances to the next checkpoint on arrival, and wraps into a new lap', () => {
    const e = new SimEngine({ construct: circuit, agent: rightSeekingAgent(), rng: createRng(1) });

    const r1 = e.tick(); // (0,0) → checkpoint 0
    expect(r1.reachedGoal).toBe(true);
    expect(e.checkpointIndex).toBe(1);
    expect(e.goal).toEqual({ x: 2, y: 0 }); // checkpoint 1

    e.tick(); // → checkpoint 1
    expect(e.checkpointIndex).toBe(2);
    expect(e.goal).toEqual({ x: 3, y: 0 }); // checkpoint 2

    e.tick(); // → checkpoint 2 (last) → wraps to a new lap
    expect(e.checkpointIndex).toBe(0);
    expect(e.goal).toEqual({ x: 1, y: 0 }); // back to checkpoint 0
  });

  it('restores a checkpoint index for rehydration', () => {
    const e = new SimEngine({
      construct: circuit,
      agent: rightSeekingAgent(),
      rng: createRng(1),
      checkpointIndex: 2,
    });
    expect(e.checkpointIndex).toBe(2);
    expect(e.goal).toEqual({ x: 3, y: 0 }); // checkpoint 2
  });
});
