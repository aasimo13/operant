import { describe, expect, it } from 'vitest';
import { WEAR } from './config';
import {
  advanceWear,
  initialWearState,
  strainDecayPerTick,
  wearBreakdown,
  type WearState,
} from './wear';

const quiet = { hitWall: false, intervened: false, providence: null } as const;

describe('advanceWear', () => {
  it('starts at zero', () => {
    expect(initialWearState()).toEqual({ totalNegativeWeight: 0, recentStrain: 0 });
  });

  it('accumulates event weights into the permanent total and recent strain', () => {
    const s0 = initialWearState();
    const s1 = advanceWear(s0, { ...quiet, hitWall: true }, 1); // decay 1 = no decay
    expect(s1.totalNegativeWeight).toBeCloseTo(WEAR.weights.wallBump);
    expect(s1.recentStrain).toBeCloseTo(WEAR.weights.wallBump);

    const s2 = advanceWear(s1, { ...quiet, providence: 'punish' }, 1);
    expect(s2.totalNegativeWeight).toBeCloseTo(WEAR.weights.wallBump + WEAR.weights.punishment);
  });

  it('weights a forced relocation between a wall bump and a punishment', () => {
    const s = advanceWear(initialWearState(), { ...quiet, intervened: true }, 1);
    expect(s.totalNegativeWeight).toBeCloseTo(WEAR.weights.relocation);
  });

  it('decays recent strain over quiet ticks without touching the permanent total', () => {
    const seeded: WearState = { totalNegativeWeight: 5, recentStrain: 1 };
    const s = advanceWear(seeded, quiet, 0.5); // half it
    expect(s.recentStrain).toBeCloseTo(0.5);
    expect(s.totalNegativeWeight).toBe(5); // permanent scar unchanged
  });

  it('gives a one-time relief multiplier to recent strain on positive Providence', () => {
    const seeded: WearState = { totalNegativeWeight: 5, recentStrain: 1 };
    // decay 1, no new negative, reward → strain *= relief factor
    const s = advanceWear(seeded, { ...quiet, providence: 'reward' }, 1);
    expect(s.recentStrain).toBeCloseTo(WEAR.reliefFactor);
    expect(s.totalNegativeWeight).toBe(5); // relief never touches the permanent record
  });
});

describe('wearBreakdown', () => {
  it('combines baseline and strain, clamped to [0,1]', () => {
    const b = wearBreakdown({ totalNegativeWeight: WEAR.K, recentStrain: 0 });
    // baseline = 1 - e^-1 ≈ 0.632; wear = 0.6 * 0.632 = 0.379
    expect(b.baselineWear).toBeCloseTo(1 - Math.exp(-1), 6);
    expect(b.wear).toBeCloseTo(WEAR.baselineWeight * (1 - Math.exp(-1)), 6);
  });

  it('never exceeds 1 even with huge strain', () => {
    expect(wearBreakdown({ totalNegativeWeight: 1e6, recentStrain: 1e6 }).wear).toBe(1);
  });
});

describe('strainDecayPerTick', () => {
  it('halves strain over one half-life worth of ticks', () => {
    const decay = strainDecayPerTick(WEAR.strainHalfLifeMs); // one tick == one half-life
    expect(decay).toBeCloseTo(0.5, 6);
  });
});
