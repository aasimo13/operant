import { describe, expect, it } from 'vitest';
import { selectTrigger, type TickSituation } from './triggers';

const quiet: TickSituation = {
  hitWall: false,
  reachedGoal: false,
  intervened: false,
  providence: null,
};

const FALLBACK = 12;

describe('selectTrigger', () => {
  it('narrates a wall bump', () => {
    expect(selectTrigger({ ...quiet, hitWall: true }, 0, FALLBACK)).toBe('wallBump');
  });

  it('narrates reaching the goal', () => {
    expect(selectTrigger({ ...quiet, reachedGoal: true }, 0, FALLBACK)).toBe('goal');
  });

  it('narrates Providence (reward/punish)', () => {
    expect(selectTrigger({ ...quiet, providence: 'reward' }, 0, FALLBACK)).toBe('reward');
    expect(selectTrigger({ ...quiet, providence: 'punish' }, 0, FALLBACK)).toBe('punish');
  });

  it('narrates an Intervene', () => {
    expect(selectTrigger({ ...quiet, intervened: true }, 0, FALLBACK)).toBe('intervene');
  });

  it('falls back to an idle musing after enough quiet ticks', () => {
    expect(selectTrigger(quiet, FALLBACK, FALLBACK)).toBe('idle');
    expect(selectTrigger(quiet, FALLBACK - 1, FALLBACK)).toBeNull();
  });

  it('prioritizes the most significant event when several coincide', () => {
    const everything: TickSituation = {
      hitWall: true,
      reachedGoal: true,
      intervened: true,
      providence: 'punish',
    };
    expect(selectTrigger(everything, 99, FALLBACK)).toBe('intervene');
    expect(selectTrigger({ ...everything, intervened: false }, 99, FALLBACK)).toBe('goal');
    expect(
      selectTrigger({ ...everything, intervened: false, reachedGoal: false }, 99, FALLBACK),
    ).toBe('punish');
  });
});
