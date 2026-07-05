import { describe, expect, it } from 'vitest';
import { emptyChronicle } from '@operant/core';
import type { TickMessage, TickRecord, WelcomeMessage } from '@operant/core';
import { applyServerMessage, initialClientState } from './simClientState';

const WEAR0 = { baselineWear: 0, recentStrain: 0, wear: 0 };

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
  construct: {
    id: 'first',
    name: 'The First Construct',
    width: 2,
    height: 1,
    walls: [[false, false]],
    checkpoints: [],
  },
  state: {
    position: { x: 0, y: 0 },
    goal: { x: 1, y: 0 },
    tickCount: 3,
    epsilon: 0.3,
    wear: WEAR0,
  },
  recent: [record(1), record(2), record(3)],
  transcript: [{ tick: 2, text: 'a first thought' }],
  queue: [],
  chronicle: emptyChronicle('The First Construct'),
  watching: 2,
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
      state: {
        position: { x: 4, y: 0 },
        goal: { x: 1, y: 0 },
        tickCount: 4,
        epsilon: 0.29,
        wear: WEAR0,
      },
      record: record(4),
    };
    const s = applyServerMessage(base, tick);
    expect(s.sim?.tickCount).toBe(4);
    expect(s.lastRecord).toEqual(record(4));
    expect(s.recent.at(-1)).toEqual(record(4));
    expect(s.construct?.id).toBe('first'); // construct is retained across ticks
  });

  it('installs the transcript backfill from the welcome', () => {
    const s = applyServerMessage(initialClientState, welcome);
    expect(s.transcript).toEqual([{ tick: 2, text: 'a first thought' }]);
  });

  it('appends a narration line and keeps it across ticks', () => {
    let s = applyServerMessage(initialClientState, welcome);
    s = applyServerMessage(s, { type: 'narration', line: { tick: 4, text: 'that wall again' } });
    expect(s.transcript.at(-1)).toEqual({ tick: 4, text: 'that wall again' });

    s = applyServerMessage(s, {
      type: 'tick',
      state: {
        position: { x: 4, y: 0 },
        goal: { x: 1, y: 0 },
        tickCount: 4,
        epsilon: 0.29,
        wear: WEAR0,
      },
      record: record(4),
    });
    expect(s.transcript.at(-1)).toEqual({ tick: 4, text: 'that wall again' }); // retained
  });

  it('stores a heatmap message and keeps it across ticks', () => {
    let s = applyServerMessage(initialClientState, welcome);
    s = applyServerMessage(s, { type: 'heatmap', values: [[1, null, 3]] });
    expect(s.heatmap).toEqual([[1, null, 3]]);

    s = applyServerMessage(s, {
      type: 'tick',
      state: {
        position: { x: 4, y: 0 },
        goal: { x: 1, y: 0 },
        tickCount: 4,
        epsilon: 0.29,
        wear: WEAR0,
      },
      record: record(4),
    });
    expect(s.heatmap).toEqual([[1, null, 3]]); // retained across the tick
  });

  it('a transition swaps the construct and state, and clears the heatmap', () => {
    let s = applyServerMessage(initialClientState, welcome);
    s = applyServerMessage(s, { type: 'heatmap', values: [[1]] });
    s = applyServerMessage(s, {
      type: 'transition',
      construct: {
        id: 'track',
        name: 'The Circuit',
        width: 3,
        height: 1,
        walls: [[false, false, false]],
        checkpoints: [{ x: 2, y: 0 }],
      },
      state: {
        position: { x: 0, y: 0 },
        goal: { x: 2, y: 0 },
        tickCount: 3,
        epsilon: 0.3,
        wear: WEAR0,
      },
    });
    expect(s.construct?.id).toBe('track');
    expect(s.construct?.checkpoints).toHaveLength(1);
    expect(s.sim?.goal).toEqual({ x: 2, y: 0 });
    expect(s.heatmap).toBeNull(); // stale heatmap invalidated by the new world
  });

  it('tracks the world queue from the welcome and queue updates', () => {
    let s = applyServerMessage(initialClientState, { ...welcome, queue: ['A', 'B'] });
    expect(s.queue).toEqual(['A', 'B']);
    s = applyServerMessage(s, { type: 'queue', names: ['B'] });
    expect(s.queue).toEqual(['B']);
    // a tick doesn't disturb the queue
    s = applyServerMessage(s, {
      type: 'tick',
      state: {
        position: { x: 1, y: 0 },
        goal: { x: 1, y: 0 },
        tickCount: 5,
        epsilon: 0.1,
        wear: WEAR0,
      },
      record: record(5),
    });
    expect(s.queue).toEqual(['B']);
  });

  it('installs the chronicle from the welcome and updates it on chronicle messages', () => {
    let s = applyServerMessage(initialClientState, welcome);
    expect(s.chronicle?.worldsEndured).toBe(1);
    const grown = { ...emptyChronicle('W'), goalsReached: 42, worldsEndured: 3 };
    s = applyServerMessage(s, { type: 'chronicle', chronicle: grown });
    expect(s.chronicle?.goalsReached).toBe(42);
    expect(s.chronicle?.worldsEndured).toBe(3);
  });

  it('tracks the watcher count and pulses on felt Providence', () => {
    let s = applyServerMessage(initialClientState, welcome);
    expect(s.watching).toBe(2);
    s = applyServerMessage(s, { type: 'presence', watching: 7 });
    expect(s.watching).toBe(7);

    // A tick carrying Providence bumps the pulse seq; a plain tick doesn't.
    const tickWith = (providence: 'reward' | 'punish' | null): TickMessage => ({
      type: 'tick',
      state: {
        position: { x: 1, y: 0 },
        goal: { x: 1, y: 0 },
        tickCount: 9,
        epsilon: 0.1,
        wear: WEAR0,
      },
      record: record(9),
      providence,
    });
    s = applyServerMessage(s, tickWith('punish'));
    expect(s.providencePulse).toEqual({ kind: 'punish', seq: 1 });
    s = applyServerMessage(s, tickWith(null));
    expect(s.providencePulse).toEqual({ kind: 'punish', seq: 1 }); // unchanged
    s = applyServerMessage(s, tickWith('reward'));
    expect(s.providencePulse).toEqual({ kind: 'reward', seq: 2 });
  });

  it('clears any stale heatmap on a fresh welcome (reconnect)', () => {
    let s = applyServerMessage(initialClientState, { type: 'heatmap', values: [[1]] });
    s = applyServerMessage(s, welcome);
    expect(s.heatmap).toBeNull();
  });

  it('bounds the recent buffer so it cannot grow without limit', () => {
    let s = applyServerMessage(initialClientState, welcome);
    for (let t = 4; t < 400; t++) {
      s = applyServerMessage(s, {
        type: 'tick',
        state: {
          position: { x: t, y: 0 },
          goal: { x: 1, y: 0 },
          tickCount: t,
          epsilon: 0.05,
          wear: WEAR0,
        },
        record: record(t),
      });
    }
    expect(s.recent.length).toBeLessThanOrEqual(200);
    expect(s.lastRecord?.tick).toBe(399);
  });
});
