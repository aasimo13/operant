import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
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
  /** Written each frame with the Sim's current world position, for the camera. */
  readonly worldOut: RefObject<Vector3>;
  /** Hidden in first person (you look out through the Sim, not at its body). */
  readonly visible?: boolean;
  /** Accumulated wear 0–1 — drives a subtle tremble, growing with history. */
  readonly wear?: number;
}

/**
 * The Sim itself: a glowing mote that tweens smoothly across each decision tick
 * (render is 60fps, decoupled from the ~1.5s decision tick — see CLAUDE.md
 * timing model). It also publishes its live world position so the camera rig
 * can follow it in any viewpoint.
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
  worldOut,
  visible = true,
  wear = 0,
}: SimAvatarProps): React.JSX.Element {
  const meshRef = useRef<Mesh>(null);
  const tickStartedAt = useRef(0);
  const lastTick = useRef(-1);

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

    // The camera follows the smooth position; only the body trembles, so the
    // whole view doesn't shake with wear.
    worldOut.current.set(wx, 0.5, wz);

    // Subtle, dignified wear: a faint high-frequency tremble that grows with
    // accumulated history (see CLAUDE.md visible-wear formula).
    const amp = wear * 0.07;
    const clock = state.clock.elapsedTime;
    mesh.position.set(
      wx + Math.sin(clock * 27.3) * amp,
      0.5 + Math.abs(Math.sin(clock * 41.1)) * amp * 0.5,
      wz + Math.cos(clock * 31.7) * amp,
    );
  });

  return (
    <mesh ref={meshRef} visible={visible} castShadow>
      <sphereGeometry args={[0.34, 24, 24]} />
      <meshStandardMaterial color="#9fd4ff" emissive="#2a6cff" emissiveIntensity={0.7} />
    </mesh>
  );
}
