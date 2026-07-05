import { describe, expect, it } from 'vitest';
import {
  emptyChronicle,
  advanceChronicle,
  enterWorld,
  RECENT_WORLDS_LIMIT,
  type Chronicle,
} from './chronicle';
import type { TickRecord } from './simEngine';

function tick(partial: Partial<TickRecord>): TickRecord {
  return {
    tick: 1,
    action: 'right',
    from: { x: 0, y: 0 },
    to: { x: 1, y: 0 },
    reward: -1,
    hitWall: false,
    reachedGoal: false,
    goalRelocated: false,
    ...partial,
  };
}

describe('chronicle', () => {
  it('is born having endured exactly its first world', () => {
    const c = emptyChronicle('The First Construct');
    expect(c.worldsEndured).toBe(1);
    expect(c.recentWorlds).toEqual([{ name: 'The First Construct', enteredAtTick: 0 }]);
    expect(c.age).toBe(0);
  });

  it('accumulates a tick: age, distance, and the right counters', () => {
    let c = emptyChronicle('W');
    c = advanceChronicle(c, {
      record: tick({ hitWall: true, to: { x: 0, y: 0 } }),
      intervened: false,
      providence: null,
    });
    // A wall bump: didn't move, so no distance, but a bump and a tick of age.
    expect(c).toMatchObject({ age: 1, wallBumps: 1, distance: 0 });

    c = advanceChronicle(c, {
      record: tick({ reachedGoal: true }),
      intervened: false,
      providence: 'reward',
    });
    expect(c).toMatchObject({ age: 2, goalsReached: 1, rewards: 1, distance: 1 });

    c = advanceChronicle(c, { record: tick({}), intervened: true, providence: 'punish' });
    expect(c).toMatchObject({ age: 3, interventions: 1, punishments: 1, distance: 2 });
  });

  it('only ever grows — nothing is reset (constraint 1)', () => {
    let c: Chronicle = emptyChronicle('W');
    for (let i = 0; i < 5; i++) {
      c = advanceChronicle(c, {
        record: tick({ reachedGoal: true }),
        intervened: false,
        providence: null,
      });
    }
    expect(c.goalsReached).toBe(5);
    expect(c.age).toBe(5);
  });

  it('records worlds endured, bounding the recent list but never the count', () => {
    let c = emptyChronicle('W0');
    for (let i = 1; i <= RECENT_WORLDS_LIMIT + 5; i++) {
      c = enterWorld(c, `W${i}`, i * 10);
    }
    expect(c.worldsEndured).toBe(RECENT_WORLDS_LIMIT + 6); // 1 born + all entered
    expect(c.recentWorlds).toHaveLength(RECENT_WORLDS_LIMIT); // bounded window
    expect(c.recentWorlds.at(-1)?.name).toBe(`W${RECENT_WORLDS_LIMIT + 5}`); // newest kept
  });
});
