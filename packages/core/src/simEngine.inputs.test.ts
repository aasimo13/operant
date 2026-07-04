import { describe, expect, it } from 'vitest';
import { SimEngine } from './simEngine';
import { QLearningAgent } from './qLearningAgent';
import { parseConstruct } from './construct';
import { createRng } from './rng';
import { ACTIONS, positionKey } from './grid';

const construct = parseConstruct('inp', ['S..', '.#.', '..G']);

function engine(seed: number, position = construct.start): SimEngine {
  return new SimEngine({
    construct,
    agent: new QLearningAgent({ epsilon: 0 }),
    rng: createRng(seed),
    position,
  });
}

describe('SimEngine.construct / constructId', () => {
  it('exposes the Construct it is running (for building client views)', () => {
    expect(engine(1).construct).toBe(construct);
    expect(engine(1).constructId).toBe('inp');
  });
});

describe('SimEngine tickCount restoration (for rehydration on boot)', () => {
  it('resumes from a restored tick count instead of zero', () => {
    const e = new SimEngine({
      construct,
      agent: new QLearningAgent({ epsilon: 0 }),
      rng: createRng(1),
      tickCount: 8410,
    });
    expect(e.tickCount).toBe(8410);
    e.tick();
    expect(e.tickCount).toBe(8411);
  });
});

describe('SimEngine.intervene (Observer relocates the Sim)', () => {
  it('snaps the Sim to an open cell without touching its knowledge or tick count', () => {
    const e = engine(1);
    e.tick(); // learn something first
    const qBefore = [...e.agent.getQValues(positionKey(construct.start))];
    const ticksBefore = e.tickCount;

    const moved = e.intervene({ x: 2, y: 2 });

    expect(moved).toBe(true);
    expect(e.position).toEqual({ x: 2, y: 2 });
    expect(e.tickCount).toBe(ticksBefore); // an Intervene is not a decision tick
    // Knowledge is untouched — Intervene changes position, never Q-values.
    expect([...e.agent.getQValues(positionKey(construct.start))]).toEqual(qBefore);
  });

  it('refuses to place the Sim into a wall or off the grid', () => {
    const e = engine(1);
    expect(e.intervene({ x: 1, y: 1 })).toBe(false); // wall
    expect(e.intervene({ x: -1, y: 0 })).toBe(false); // off-grid
    expect(e.position).toEqual(construct.start); // unchanged
  });
});

describe('SimEngine.tick with Providence bonus reward', () => {
  it('folds a manual reward into that tick’s Q-update', () => {
    const plain = engine(5);
    const rewarded = engine(5); // identical setup + seed → identical action

    const recPlain = plain.tick();
    const recRewarded = rewarded.tick({ bonusReward: 100 });

    // Same seed and starting Q ⇒ same action, same environment outcome.
    expect(recRewarded.action).toBe(recPlain.action);

    const idx = ACTIONS.indexOf(recPlain.action);
    const startKey = positionKey(construct.start);
    const delta =
      rewarded.agent.getQValues(startKey)[idx]! - plain.agent.getQValues(startKey)[idx]!;

    // TD update difference is exactly alpha * bonus = 0.1 * 100.
    expect(delta).toBeCloseTo(10, 6);
  });
});
