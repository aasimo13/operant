import { describe, expect, it } from 'vitest';
import { wearToTimbre } from './soundscape';

describe('wearToTimbre', () => {
  it('a fresh Sim: quiet, stable, open', () => {
    const t = wearToTimbre(0);
    expect(t.detune).toBe(0);
    expect(t.gain).toBeCloseTo(0.035, 5);
    expect(t.cutoff).toBeCloseTo(340, 5);
  });

  it('grows louder, more detuned, and darker as wear climbs', () => {
    const low = wearToTimbre(0.2);
    const high = wearToTimbre(0.9);
    expect(high.gain).toBeGreaterThan(low.gain);
    expect(high.detune).toBeGreaterThan(low.detune);
    expect(high.cutoff).toBeLessThan(low.cutoff); // darker
  });

  it('clamps out-of-range wear', () => {
    expect(wearToTimbre(2)).toEqual(wearToTimbre(1));
    expect(wearToTimbre(-1)).toEqual(wearToTimbre(0));
  });
});
