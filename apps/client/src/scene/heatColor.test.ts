import { describe, expect, it } from 'vitest';
import { HEAT_HIGH, HEAT_LOW, heatColor } from './heatColor';

describe('heatColor', () => {
  it('maps the minimum value to the cold colour and the max to the warm colour', () => {
    expect(heatColor(0, 0, 10)).toEqual(HEAT_LOW);
    expect(heatColor(10, 0, 10)).toEqual(HEAT_HIGH);
  });

  it('interpolates at the midpoint', () => {
    const mid = heatColor(5, 0, 10);
    expect(mid[0]).toBeCloseTo((HEAT_LOW[0] + HEAT_HIGH[0]) / 2, 6);
  });

  it('clamps values outside the range', () => {
    expect(heatColor(-5, 0, 10)).toEqual(HEAT_LOW);
    expect(heatColor(50, 0, 10)).toEqual(HEAT_HIGH);
  });

  it('is stable when the whole grid is flat (min == max)', () => {
    expect(heatColor(3, 3, 3)).toEqual(HEAT_LOW);
  });
});
