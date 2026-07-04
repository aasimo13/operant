import { describe, expect, it } from 'vitest';
import { cellToWorldXZ } from './layout';

describe('cellToWorldXZ', () => {
  it('centers the board on the origin (cell centers, not corners)', () => {
    // 10x10 board: cell (0,0) sits at the far corner, the middle straddles 0.
    expect(cellToWorldXZ(0, 0, 10, 10)).toEqual([-4.5, -4.5]);
    expect(cellToWorldXZ(9, 9, 10, 10)).toEqual([4.5, 4.5]);
  });

  it('maps grid x→world X and grid y→world Z', () => {
    expect(cellToWorldXZ(3, 0, 10, 10)).toEqual([-1.5, -4.5]);
  });

  it('accepts fractional (tweened) coordinates', () => {
    // width 2 → x=0.5 maps to 0.5 - 1 + 0.5 = 0; height 1 → y=0 maps to 0 - 0.5 + 0.5 = 0.
    expect(cellToWorldXZ(0.5, 0, 2, 1)).toEqual([0, 0]);
  });
});
