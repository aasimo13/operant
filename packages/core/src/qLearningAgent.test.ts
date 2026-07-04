import { describe, expect, it } from 'vitest';
import { QLearningAgent } from './qLearningAgent';
import { ACTIONS } from './grid';
import { createRng } from './rng';

const RIGHT = ACTIONS.indexOf('right');

describe('QLearningAgent', () => {
  describe('Q-value updates (continuing task — always bootstraps)', () => {
    it('starts every unseen state at all-zero Q-values', () => {
      const agent = new QLearningAgent();
      expect([...agent.getQValues('0,0')]).toEqual([0, 0, 0, 0]);
    });

    it('applies the temporal-difference update with a zero next state', () => {
      const agent = new QLearningAgent({ alpha: 0.1, gamma: 0.95 });
      // Q(s,a) += a*(r + g*max Q(s') - Q(s,a)) = 0 + 0.1*(-1 + 0.95*0 - 0) = -0.1
      agent.update('0,0', 'right', -1, '1,0');
      expect(agent.getQValues('0,0')[RIGHT]).toBeCloseTo(-0.1, 10);
    });

    it('bootstraps off the best action value of the next state', () => {
      const agent = new QLearningAgent({ alpha: 0.1, gamma: 0.95 });
      // Make Q('1,0','right') = 0.1*50 = 5.0
      agent.update('1,0', 'right', 50, '2,0');
      // Now Q('0,0','right') = 0 + 0.1*(-1 + 0.95*5.0 - 0) = 0.375
      agent.update('0,0', 'right', -1, '1,0');
      expect(agent.getQValues('0,0')[RIGHT]).toBeCloseTo(0.375, 10);
    });
  });

  describe('epsilon-greedy action selection', () => {
    it('with epsilon 0, always exploits the highest-value action', () => {
      const agent = new QLearningAgent({ epsilon: 0 });
      agent.update('s', 'right', 10, 's2'); // makes 'right' the best action
      const rng = createRng(1);
      for (let i = 0; i < 20; i++) {
        expect(agent.chooseAction('s', rng)).toBe('right');
      }
    });

    it('with epsilon 1, is deterministic under a seeded rng', () => {
      const a = new QLearningAgent({ epsilon: 1 });
      const b = new QLearningAgent({ epsilon: 1 });
      const rngA = createRng(7);
      const rngB = createRng(7);
      const sa = Array.from({ length: 10 }, () => a.chooseAction('s', rngA));
      const sb = Array.from({ length: 10 }, () => b.chooseAction('s', rngB));
      expect(sa).toEqual(sb);
    });

    it('greedyAction ignores exploration entirely', () => {
      const agent = new QLearningAgent({ epsilon: 1 });
      agent.update('s', 'left', 99, 's2');
      expect(agent.greedyAction('s')).toBe('left');
    });
  });

  describe('epsilon decay', () => {
    it('decays multiplicatively toward — but never below — the floor', () => {
      const agent = new QLearningAgent({ epsilon: 0.3, epsilonFloor: 0.05, epsilonDecay: 0.9995 });
      agent.decayEpsilon();
      expect(agent.epsilon).toBeCloseTo(0.3 * 0.9995, 10);
      for (let i = 0; i < 100_000; i++) agent.decayEpsilon();
      expect(agent.epsilon).toBe(0.05);
    });
  });

  describe('serialization (for persistence / crash-restart rehydration)', () => {
    it('round-trips Q-values and epsilon without loss', () => {
      const agent = new QLearningAgent({ epsilon: 0.2 });
      agent.update('0,0', 'right', -1, '1,0');
      agent.update('1,0', 'up', 5, '1,-1');

      const restored = QLearningAgent.deserialize(agent.serialize());

      expect([...restored.getQValues('0,0')]).toEqual([...agent.getQValues('0,0')]);
      expect([...restored.getQValues('1,0')]).toEqual([...agent.getQValues('1,0')]);
      expect(restored.epsilon).toBe(agent.epsilon);
      expect(restored.greedyAction('1,0')).toBe(agent.greedyAction('1,0'));
    });
  });
});
