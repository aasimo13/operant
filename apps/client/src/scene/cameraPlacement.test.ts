import { describe, expect, it } from 'vitest';
import type { TickRecord } from '@operant/core';
import { cameraPlacement, movementHeading } from './cameraPlacement';

function record(from: { x: number; y: number }, to: { x: number; y: number }): TickRecord {
  return {
    tick: 1,
    action: 'right',
    from,
    to,
    reward: -1,
    hitWall: false,
    reachedGoal: false,
    goalRelocated: false,
  };
}

describe('movementHeading', () => {
  const fallback = { x: 0, z: -1 };

  it('points along the grid move (grid y → world z)', () => {
    expect(movementHeading(record({ x: 2, y: 2 }, { x: 3, y: 2 }), fallback)).toEqual({
      x: 1,
      z: 0,
    });
    expect(movementHeading(record({ x: 2, y: 2 }, { x: 2, y: 3 }), fallback)).toEqual({
      x: 0,
      z: 1,
    });
  });

  it('keeps the previous heading on a wall bump (from == to)', () => {
    expect(movementHeading(record({ x: 2, y: 2 }, { x: 2, y: 2 }), fallback)).toEqual(fallback);
  });

  it('keeps the previous heading when there is no record', () => {
    expect(movementHeading(null, fallback)).toEqual(fallback);
  });
});

const sim = { x: 0, y: 0.5, z: 0 };
const heading = { x: 0, z: -1 }; // facing "north" (−Z)

describe('cameraPlacement', () => {
  it('third-person sits behind and above the Sim, looking at it', () => {
    const p = cameraPlacement('third', sim, heading, 10, 55);
    expect(p.fov).toBe(55);
    expect(p.position[1]).toBeGreaterThan(sim.y); // above
    expect(p.lookAt).toEqual([0, 0.5, 0]); // at the Sim
    // Behind = opposite the heading (heading is −Z, so behind is +Z).
    expect(p.position[2]).toBeGreaterThan(sim.z);
  });

  it('first-person sits at the Sim and looks along its heading', () => {
    const p = cameraPlacement('first', sim, heading, 10, 70);
    expect(p.fov).toBe(70);
    expect(p.position[0]).toBeCloseTo(0);
    expect(p.position[2]).toBeCloseTo(0);
    // Looks ahead along the heading (−Z), so lookAt Z is less than the eye Z.
    expect(p.lookAt[2]).toBeLessThan(p.position[2]);
  });

  it('god view pulls high above the whole board and ignores the fov arg', () => {
    const p = cameraPlacement('god', sim, heading, 10, 55);
    expect(p.position[1]).toBeGreaterThan(10); // above the board extent
    expect(p.lookAt).toEqual([0, 0, 0]); // centered on the board origin
    expect(p.fov).toBeLessThan(55); // a fixed, wide-but-not-fisheye god fov
  });
});
