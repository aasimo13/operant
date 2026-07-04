import { describe, expect, it } from 'vitest';
import { shortestPathLength } from './construct';
import { THE_TRACK } from './track';

describe('THE_TRACK', () => {
  it('is a 10x10 circuit with four ordered checkpoints', () => {
    expect(THE_TRACK.width).toBe(10);
    expect(THE_TRACK.height).toBe(10);
    expect(THE_TRACK.checkpoints).toHaveLength(4);
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
