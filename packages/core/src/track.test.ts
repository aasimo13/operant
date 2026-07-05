import { describe, expect, it } from 'vitest';
import { shortestPathLength } from './construct';
import { THE_TRACK } from './track';

describe('THE_TRACK', () => {
  it('is a 14x14 circuit with six ordered checkpoints', () => {
    expect(THE_TRACK.width).toBe(14);
    expect(THE_TRACK.height).toBe(14);
    expect(THE_TRACK.checkpoints).toHaveLength(6);
  });

  it('is a single-lane loop around a solid centre', () => {
    // 14x14 perimeter ring = 52 open cells; everything else is wall.
    expect(THE_TRACK.openCells()).toHaveLength(52);
  });

  it('every checkpoint is reachable from the start (the loop is navigable)', () => {
    for (const cp of THE_TRACK.checkpoints) {
      const d = shortestPathLength(THE_TRACK, THE_TRACK.start, cp);
      expect(d).not.toBeNull();
    }
  });

  it('its first checkpoint is the initial goal', () => {
    expect(THE_TRACK.goal).toEqual(THE_TRACK.checkpoints[0]);
  });
});
