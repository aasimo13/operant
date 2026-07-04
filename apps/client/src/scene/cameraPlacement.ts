import type { TickRecord } from '@operant/core';

/** The three viewpoints the Observer can switch between. */
export type CameraMode = 'first' | 'third' | 'god';

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** A horizontal facing direction (unit-ish) in world X/Z. */
export interface Heading {
  readonly x: number;
  readonly z: number;
}

export interface CameraPlacement {
  readonly position: [number, number, number];
  readonly lookAt: [number, number, number];
  readonly fov: number;
}

/**
 * The Sim's current facing (world X/Z), derived from its latest move. A wall
 * bump or missing record leaves the heading unchanged, so first-person doesn't
 * spin when the Sim stalls against a wall. Grid y maps to world z.
 */
export function movementHeading(record: TickRecord | null, previous: Heading): Heading {
  if (!record) return previous;
  const dx = record.to.x - record.from.x;
  const dz = record.to.y - record.from.y;
  if (dx === 0 && dz === 0) return previous;
  return { x: dx, z: dz };
}

/** God view uses its own fixed field of view, wide enough to take in the board. */
const GOD_FOV = 40;
/** Height of the Sim's "eyes" for first person. */
const EYE_HEIGHT = 0.5;

/**
 * Where the camera should sit and look for a given viewpoint. Pure so the
 * framing math is testable; the CameraRig applies (and smooths toward) this
 * each frame. `boardExtent` is the larger board dimension, used to frame god
 * view; `fov` applies to first/third person (god view fixes its own).
 */
export function cameraPlacement(
  mode: CameraMode,
  sim: Vec3,
  heading: Heading,
  boardExtent: number,
  fov: number,
): CameraPlacement {
  switch (mode) {
    case 'first': {
      const eye: [number, number, number] = [sim.x, EYE_HEIGHT, sim.z];
      return {
        position: eye,
        lookAt: [sim.x + heading.x, EYE_HEIGHT, sim.z + heading.z],
        fov,
      };
    }
    case 'third': {
      // Behind (opposite heading) and above, looking at the Sim.
      return {
        position: [sim.x - heading.x * 6, sim.y + 6, sim.z - heading.z * 6],
        lookAt: [sim.x, sim.y, sim.z],
        fov,
      };
    }
    case 'god':
      return {
        position: [0, boardExtent * 1.5, boardExtent * 0.55],
        lookAt: [0, 0, 0],
        fov: GOD_FOV,
      };
  }
}
