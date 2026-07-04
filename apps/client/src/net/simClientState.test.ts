import { describe, expect, it } from 'vitest';
import type { TickMessage, TickRecord, WelcomeMessage } from '@operant/core';
import { applyServerMessage, initialClientState } from './simClientState';

function record(tick: number): TickRecord {
  return {
    tick,
    action: 'right',
    from: { x: tick, y: 0 },
    to: { x: tick + 1, y: 0 },
    reward: -1,
    hitWall: false,
    reachedGoal: false,
    goalRelocated: false,
  };
}

const welcome: WelcomeMessage = {
  type: 'welcome',
  construct: { id: 'first', width: 2, height: 1, walls: [[false, false]] },
  state: { position: { x: 0, y: 0 }, goal: { x: 1, y: 0 }, tickCount: 3, epsilon: 0.3 },
  recent: [record(1), record(2), record(3)],
};

describe('applyServerMessage', () => {
  it('starts empty and disconnected', () => {
    expect(initialClientState).toMatchObject({ construct: null, sim: null, lastRecord: null });
  });

  it('a welcome installs the construct, current state, and backfill', () => {
    const s = applyServerMessage(initialClientState, welcome);
    expect(s.construct?.id).toBe('first');
    expect(s.sim?.tickCount).toBe(3);
    expect(s.recent).toHaveLength(3);
    expect(s.lastRecord).toEqual(record(3)); // newest backfilled record
  });

  it('a tick advances the state and appends to recent', () => {
    const base = applyServerMessage(initialClientState, welcome);
    const tick: TickMessage = {
      type: 'tick',
      state: { position: { x: 4, y: 0 }, goal: { x: 1, y: 0 }, tickCount: 4, epsilon: 0.29 },
      record: record(4),
    };
    const s = applyServerMessage(base, tick);
    expect(s.sim?.tickCount).toBe(4);
    expect(s.lastRecord).toEqual(record(4));
    expect(s.recent.at(-1)).toEqual(record(4));
    expect(s.construct?.id).toBe('first'); // construct is retained across ticks
  });

  it('bounds the recent buffer so it cannot grow without limit', () => {
    let s = applyServerMessage(initialClientState, welcome);
    for (let t = 4; t < 400; t++) {
      s = applyServerMessage(s, {
        type: 'tick',
        state: { position: { x: t, y: 0 }, goal: { x: 1, y: 0 }, tickCount: t, epsilon: 0.05 },
        record: record(t),
      });
    }
    expect(s.recent.length).toBeLessThanOrEqual(200);
    expect(s.lastRecord?.tick).toBe(399);
  });
});
