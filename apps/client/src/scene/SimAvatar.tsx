import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, type Mesh } from 'three';
import type { GridPosition, TickRecord } from '@operant/core';
import { lerpPosition } from './tween';
import { cellToWorldXZ } from './layout';

export interface SimAvatarProps {
  /** The latest tick record — the Sim tweens from its `from` to its `to`. */
  readonly record: TickRecord | null;
  /** Where the Sim is when there is no record yet (freshly born). */
  readonly fallback: GridPosition;
  readonly width: number;
  readonly height: number;
  /** Decision-tick length, so the tween finishes exactly as the next tick lands. */
  readonly tickMs: number;
  /** Whether the third-person camera trails the Sim (the step-5 default view). */
  readonly follow?: boolean;
}

/**
 * The Sim itself: a glowing mote that tweens smoothly across each decision tick
 * (render is 60fps, decoupled from the ~1.5s decision tick — see CLAUDE.md
 * timing model). A trailing third-person camera follows it by default.
 *
 * Intervene needs no special handling: it changes the next record's `from`, so
 * the Sim simply appears at the drop cell rather than sliding there.
 */
export function SimAvatar({
  record,
  fallback,
  width,
  height,
  tickMs,
  follow = true,
}: SimAvatarProps): React.JSX.Element {
  const meshRef = useRef<Mesh>(null);
  const tickStartedAt = useRef(0);
  const lastTick = useRef(-1);
  const cameraTarget = useRef(new Vector3());
  const { camera } = useThree();

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    let gx: number;
    let gy: number;
    if (record) {
      if (record.tick !== lastTick.current) {
        lastTick.current = record.tick;
        tickStartedAt.current = state.clock.elapsedTime;
      }
      const t = (state.clock.elapsedTime - tickStartedAt.current) / (tickMs / 1000);
      const p = lerpPosition(record.from, record.to, t);
      gx = p.x;
      gy = p.y;
    } else {
      gx = fallback.x;
      gy = fallback.y;
    }

    const [wx, wz] = cellToWorldXZ(gx, gy, width, height);
    mesh.position.set(wx, 0.5, wz);

    if (follow) {
      cameraTarget.current.set(wx, 6, wz + 7);
      camera.position.lerp(cameraTarget.current, 0.04);
      camera.lookAt(wx, 0.5, wz);
    }
  });

  return (
    <mesh ref={meshRef} castShadow>
      <sphereGeometry args={[0.34, 24, 24]} />
      <meshStandardMaterial color="#9fd4ff" emissive="#2a6cff" emissiveIntensity={0.7} />
    </mesh>
  );
}
