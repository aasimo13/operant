import { describe, expect, it } from 'vitest';
import { SimEngine } from './simEngine';
import { QLearningAgent } from './qLearningAgent';
import { parseConstruct } from './construct';
import { createRng } from './rng';
import { positionKey, stateKey } from './grid';

const construct = parseConstruct('sim', ['S..', '...', '..G']);

function makeAgent(): QLearningAgent {
  return new QLearningAgent({ epsilon: 0 });
}

describe('SimEngine', () => {
  it('starts at the Construct’s start and goal by default', () => {
    const engine = new SimEngine({ construct, agent: makeAgent(), rng: createRng(1) });
    expect(engine.position).toEqual(construct.start);
    expect(engine.goal).toEqual(construct.goal);
    expect(engine.tickCount).toBe(0);
  });

  it('advances one decision step per tick', () => {
    const engine = new SimEngine({ construct, agent: makeAgent(), rng: createRng(1) });
    const record = engine.tick();
    expect(engine.tickCount).toBe(1);
    expect(record.tick).toBe(1);
    expect(record.from).toEqual(construct.start);
  });

  it('drops the Sim to a fresh start on arrival, keeping the maze goal fixed', () => {
    const agent = makeAgent();
    // Make "down" greedy at (2,1) when targeting the goal (2,2), so the Sim
    // steps onto the goal. (State is goal-conditioned.)
    agent.update(
      stateKey({ x: 2, y: 1 }, { x: 2, y: 2 }),
      'down',
      100,
      stateKey({ x: 2, y: 2 }, { x: 2, y: 2 }),
    );

    const engine = new SimEngine({
      construct,
      agent,
      rng: createRng(3),
      position: { x: 2, y: 1 },
    });

    const record = engine.tick();

    expect(record.reachedGoal).toBe(true);
    expect(record.goalRelocated).toBe(true);
    // No completion: the maze goal stays put so the Sim can learn to reach it,
    // and the Sim is relocated to a fresh open cell to navigate to it again.
    expect(engine.goal).toEqual({ x: 2, y: 2 }); // goal fixed
    expect(engine.position).not.toEqual({ x: 2, y: 2 }); // Sim dropped elsewhere
    expect(construct.isOpen(engine.position)).toBe(true);
    // Nothing reset: the tick counter keeps climbing.
    expect(engine.tickCount).toBe(1);
  });

  it('reaching a goal never wipes learned Q-values (no reset, ever)', () => {
    const agent = makeAgent();
    // Learned knowledge about an unrelated state, plus the step onto the goal.
    agent.update('unrelated', 'right', 42, 'elsewhere');
    agent.update(positionKey({ x: 2, y: 1 }), 'down', 100, positionKey({ x: 2, y: 2 }));
    const before = [...agent.getQValues('unrelated')];

    const engine = new SimEngine({
      construct,
      agent,
      rng: createRng(3),
      position: { x: 2, y: 1 },
    });
    engine.tick(); // reaches goal, relocates

    expect([...agent.getQValues('unrelated')]).toEqual(before);
  });

  it('is deterministic: same seed and setup yields the same tick record', () => {
    const a = new SimEngine({ construct, agent: makeAgent(), rng: createRng(9) });
    const b = new SimEngine({ construct, agent: makeAgent(), rng: createRng(9) });
    const seqA = Array.from({ length: 20 }, () => a.tick());
    const seqB = Array.from({ length: 20 }, () => b.tick());
    expect(seqA).toEqual(seqB);
  });
});
