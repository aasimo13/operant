import { describe, expect, it } from 'vitest';
import { lerpPosition } from './tween';

describe('lerpPosition', () => {
  const from = { x: 2, y: 5 };
  const to = { x: 6, y: 5 };

  it('is at the start when t=0 and the end when t=1', () => {
    expect(lerpPosition(from, to, 0)).toEqual({ x: 2, y: 5 });
    expect(lerpPosition(from, to, 1)).toEqual({ x: 6, y: 5 });
  });

  it('interpolates linearly at the midpoint', () => {
    expect(lerpPosition(from, to, 0.5)).toEqual({ x: 4, y: 5 });
  });

  it('clamps t outside [0,1] so a late frame never overshoots', () => {
    expect(lerpPosition(from, to, -0.5)).toEqual({ x: 2, y: 5 });
    expect(lerpPosition(from, to, 1.7)).toEqual({ x: 6, y: 5 });
  });

  it('a wall bump (from == to) holds position for any t', () => {
    expect(lerpPosition({ x: 3, y: 3 }, { x: 3, y: 3 }, 0.4)).toEqual({ x: 3, y: 3 });
  });
});
