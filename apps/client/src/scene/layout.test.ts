import { describe, expect, it } from 'vitest';
import { cellToWorldXZ, worldToCell } from './layout';

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

describe('worldToCell (inverse of cellToWorldXZ, for drop-anywhere clicks)', () => {
  it('round-trips a cell center back to its grid coordinates', () => {
    const [wx, wz] = cellToWorldXZ(3, 7, 10, 10);
    expect(worldToCell(wx, wz, 10, 10)).toEqual({ x: 3, y: 7 });
  });

  it('snaps a point anywhere inside a cell to that cell', () => {
    expect(worldToCell(-1.4, 2.6, 10, 10)).toEqual({ x: 3, y: 7 });
  });

  it('clamps clicks outside the board to the nearest edge cell', () => {
    expect(worldToCell(100, 100, 10, 10)).toEqual({ x: 9, y: 9 });
    expect(worldToCell(-100, -100, 10, 10)).toEqual({ x: 0, y: 0 });
  });
});
