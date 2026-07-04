import { describe, expect, it } from 'vitest';
import { parseConstruct } from './construct';

describe('parseConstruct — circuits with ordered checkpoints', () => {
  // A tiny loop: S start, digits are checkpoints in order 0,1,2,3.
  //   S 0 1
  //   3 . .    (wait — needs to be a loop; layout is just for parsing here)
  //   . 2 .
  const rows = ['S01', '3..', '.2.'];

  it('collects checkpoints ordered by their digit (not scan order)', () => {
    const c = parseConstruct('circuit', rows);
    expect(c.checkpoints).toEqual([
      { x: 1, y: 0 }, // '0'
      { x: 2, y: 0 }, // '1'
      { x: 1, y: 2 }, // '2'
      { x: 0, y: 1 }, // '3'
    ]);
  });

  it('orders strictly by digit value, not scan order', () => {
    const c = parseConstruct('circuit', rows);
    // checkpoints[0] is digit '0', [1] is '1', etc.
    expect(c.checkpoints[0]).toEqual({ x: 1, y: 0 }); // '0'
    expect(c.checkpoints[1]).toEqual({ x: 2, y: 0 }); // '1'
    expect(c.checkpoints[2]).toEqual({ x: 1, y: 2 }); // '2'
    expect(c.checkpoints[3]).toEqual({ x: 0, y: 1 }); // '3'
  });

  it('uses the first checkpoint as the initial goal, and checkpoint cells are open', () => {
    const c = parseConstruct('circuit', rows);
    expect(c.goal).toEqual(c.checkpoints[0]);
    expect(c.isOpen({ x: 1, y: 0 })).toBe(true);
  });

  it('a plain maze (single goal, no digits) has no checkpoints', () => {
    const maze = parseConstruct('maze', ['S.', '.G']);
    expect(maze.checkpoints).toEqual([]);
    expect(maze.goal).toEqual({ x: 1, y: 1 });
  });

  it('rejects mixing a goal and checkpoints', () => {
    expect(() => parseConstruct('bad', ['S0', 'G1'])).toThrow(/goal.*checkpoint|checkpoint.*goal/i);
  });

  it('rejects non-contiguous checkpoint numbering', () => {
    // 0 and 2 but no 1
    expect(() => parseConstruct('bad', ['S0', '.2'])).toThrow(/contiguous|sequence|0/i);
  });

  it('still requires a start', () => {
    expect(() => parseConstruct('bad', ['01', '..'])).toThrow(/start/i);
  });
});
