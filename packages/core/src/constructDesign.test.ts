import { describe, expect, it } from 'vitest';
import { validateConstructDesign, DESIGN_LIMITS } from './constructDesign';

const solvable = ['S...', '.##.', '.#..', '..#G'];

describe('validateConstructDesign', () => {
  it('accepts a well-formed, solvable maze design', () => {
    const result = validateConstructDesign({ id: 'c1', name: 'A Kind Corner', rows: solvable });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.construct.width).toBe(4);
      expect(result.construct.height).toBe(4);
      expect(result.construct.goal).toEqual({ x: 3, y: 3 });
    }
  });

  it('rejects an unsolvable design (goal walled off)', () => {
    const walled = ['S..#', '...#', '...#', '###G'];
    const result = validateConstructDesign({ id: 'c2', name: 'Sealed', rows: walled });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/reach|solv|path/i);
  });

  it('rejects malformed geometry (no goal, no start, ragged rows)', () => {
    expect(validateConstructDesign({ id: 'x', name: 'n', rows: ['S...', '....'] }).ok).toBe(false); // no goal
    expect(validateConstructDesign({ id: 'x', name: 'n', rows: ['....', '...G'] }).ok).toBe(false); // no start
    expect(validateConstructDesign({ id: 'x', name: 'n', rows: ['S..', '...G'] }).ok).toBe(false); // ragged
  });

  it('enforces size bounds', () => {
    const tiny = ['SG', '..'];
    expect(validateConstructDesign({ id: 'x', name: 'n', rows: tiny }).ok).toBe(false); // too small
    const hugeRow = '.'.repeat(DESIGN_LIMITS.maxSize + 1);
    const huge = [
      `S${hugeRow.slice(1)}`,
      ...Array(3).fill(hugeRow),
      `${'.'.repeat(DESIGN_LIMITS.maxSize)}G`,
    ];
    expect(validateConstructDesign({ id: 'x', name: 'n', rows: huge }).ok).toBe(false); // too wide
  });

  it('requires a non-empty, bounded name', () => {
    expect(validateConstructDesign({ id: 'x', name: '   ', rows: solvable }).ok).toBe(false);
    const longName = 'z'.repeat(DESIGN_LIMITS.maxNameLength + 1);
    expect(validateConstructDesign({ id: 'x', name: longName, rows: solvable }).ok).toBe(false);
  });
});
