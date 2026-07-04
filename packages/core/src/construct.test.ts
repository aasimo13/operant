import { describe, expect, it } from 'vitest';
import { parseConstruct, shortestPathLength } from './construct';

// A tiny 3x3 Construct with one wall in the middle-top, used for exact assertions.
//   S . .
//   . # .
//   . . G
const TINY = ['S..', '.#.', '..G'];

describe('parseConstruct', () => {
  it('reads dimensions from the row layout', () => {
    const c = parseConstruct('tiny', TINY);
    expect(c.width).toBe(3);
    expect(c.height).toBe(3);
  });

  it('locates the start and goal cells', () => {
    const c = parseConstruct('tiny', TINY);
    expect(c.start).toEqual({ x: 0, y: 0 });
    expect(c.goal).toEqual({ x: 2, y: 2 });
  });

  it('marks # as a wall and everything else as open', () => {
    const c = parseConstruct('tiny', TINY);
    expect(c.isWall({ x: 1, y: 1 })).toBe(true);
    expect(c.isWall({ x: 0, y: 0 })).toBe(false);
    expect(c.isOpen({ x: 2, y: 2 })).toBe(true);
  });

  it('treats out-of-bounds as not-in-bounds and as wall-like (not open)', () => {
    const c = parseConstruct('tiny', TINY);
    expect(c.inBounds({ x: -1, y: 0 })).toBe(false);
    expect(c.inBounds({ x: 3, y: 0 })).toBe(false);
    expect(c.isOpen({ x: -1, y: 0 })).toBe(false);
  });

  it('lists every open cell', () => {
    const c = parseConstruct('tiny', TINY);
    // 9 cells minus the single wall = 8 open cells.
    expect(c.openCells()).toHaveLength(8);
    expect(c.openCells()).not.toContainEqual({ x: 1, y: 1 });
  });

  it('rejects a ragged (non-rectangular) layout', () => {
    expect(() => parseConstruct('bad', ['S..', '..'])).toThrow(/rectangular/i);
  });

  it('requires exactly one start and one goal', () => {
    expect(() => parseConstruct('bad', ['S.G', '..G'])).toThrow(/goal/i);
    expect(() => parseConstruct('bad', ['...', '...'])).toThrow(/start/i);
  });

  it('rejects unknown characters', () => {
    expect(() => parseConstruct('bad', ['S?G'])).toThrow(/character/i);
  });
});

describe('shortestPathLength (BFS over open cells)', () => {
  it('measures the shortest 4-connected path around walls', () => {
    const c = parseConstruct('tiny', TINY);
    // (0,0) -> (2,2) around the center wall is 4 steps.
    expect(shortestPathLength(c, c.start, c.goal)).toBe(4);
  });

  it('returns null when no path exists', () => {
    //   S #   (goal boxed off by walls)
    //   # G
    const boxed = parseConstruct('boxed', ['S#', '#G']);
    expect(shortestPathLength(boxed, boxed.start, boxed.goal)).toBeNull();
  });
});
