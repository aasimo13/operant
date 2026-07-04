import { useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, type PerspectiveCamera } from 'three';
import type { TickRecord } from '@operant/core';
import { cameraPlacement, movementHeading, type CameraMode, type Heading } from './cameraPlacement';

export interface CameraRigProps {
  readonly mode: CameraMode;
  readonly fov: number;
  /** Larger board dimension, used to frame god view. */
  readonly boardExtent: number;
  /** Latest tick record, for deriving the Sim's facing in first person. */
  readonly record: TickRecord | null;
  /** The Sim's live world position, published by SimAvatar. */
  readonly simWorld: RefObject<Vector3>;
}

/** How quickly the camera eases toward its target per viewpoint. */
const SMOOTHING: Record<CameraMode, number> = { first: 0.35, third: 0.12, god: 0.08 };

/**
 * Drives the camera for whichever viewpoint the Observer has chosen (first
 * person, third person, god view) plus field of view. Follows the Sim's live
 * world position, easing toward the target so switches and movement read
 * smoothly rather than snapping.
 */
export function CameraRig({ mode, fov, boardExtent, record, simWorld }: CameraRigProps): null {
  const { camera } = useThree();
  const heading = useRef<Heading>({ x: 0, z: -1 });
  const targetPos = useRef(new Vector3());
  const lookAt = useRef(new Vector3());

  useFrame(() => {
    const cam = camera as PerspectiveCamera;
    heading.current = movementHeading(record, heading.current);

    const sim = simWorld.current;
    const placement = cameraPlacement(
      mode,
      { x: sim.x, y: sim.y, z: sim.z },
      heading.current,
      boardExtent,
      fov,
    );

    targetPos.current.set(...placement.position);
    cam.position.lerp(targetPos.current, SMOOTHING[mode]);

    lookAt.current.set(...placement.lookAt);
    cam.lookAt(lookAt.current);

    if (cam.fov !== placement.fov) {
      cam.fov = placement.fov;
      cam.updateProjectionMatrix();
    }
  });

  return null;
}
