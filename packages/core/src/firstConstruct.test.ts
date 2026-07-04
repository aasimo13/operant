import { describe, expect, it } from 'vitest';
import { shortestPathLength } from './construct';
import { FIRST_CONSTRUCT } from './firstConstruct';

describe('FIRST_CONSTRUCT', () => {
  it('is the specified 10x10 grid', () => {
    expect(FIRST_CONSTRUCT.width).toBe(10);
    expect(FIRST_CONSTRUCT.height).toBe(10);
  });

  it('is solvable: a path exists from start to goal', () => {
    const distance = shortestPathLength(
      FIRST_CONSTRUCT,
      FIRST_CONSTRUCT.start,
      FIRST_CONSTRUCT.goal,
    );
    expect(distance).not.toBeNull();
    expect(distance!).toBeGreaterThan(0);
  });

  it('has dead ends and walls, so it reads as a real maze (not an open room)', () => {
    const open = FIRST_CONSTRUCT.openCells().length;
    // Some walls, but still mostly navigable.
    expect(open).toBeLessThan(100);
    expect(open).toBeGreaterThan(50);
  });
});
