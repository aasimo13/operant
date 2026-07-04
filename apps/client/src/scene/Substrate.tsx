import { useMemo } from 'react';
import type { ConstructView, GridPosition } from '@operant/core';
import { cellToWorldXZ } from './layout';

/**
 * The Construct rendered in 3D: a dark floor plane with raised wall blocks. This
 * is the basic pass (build-order step 5); the mystical/cosmic theming and
 * instancing come later (step 10). Geometry only — no simulation state.
 */
export function Substrate({ construct }: { construct: ConstructView }): React.JSX.Element {
  const wallPositions = useMemo(() => {
    const out: Array<[number, number]> = [];
    for (let y = 0; y < construct.height; y++) {
      for (let x = 0; x < construct.width; x++) {
        if (construct.walls[y]![x]) {
          out.push(cellToWorldXZ(x, y, construct.width, construct.height));
        }
      }
    }
    return out;
  }, [construct]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[construct.width, construct.height]} />
        <meshStandardMaterial color="#0a0f1f" />
      </mesh>

      {wallPositions.map(([wx, wz], i) => (
        <mesh key={i} position={[wx, 0.5, wz]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#1a2340" />
        </mesh>
      ))}
    </group>
  );
}

/** The goal cell — a soft glowing marker the Sim is currently seeking. */
export function GoalMarker({
  goal,
  width,
  height,
}: {
  goal: GridPosition;
  width: number;
  height: number;
}): React.JSX.Element {
  const [wx, wz] = cellToWorldXZ(goal.x, goal.y, width, height);
  return (
    <mesh position={[wx, 0.15, wz]}>
      <cylinderGeometry args={[0.32, 0.32, 0.08, 24]} />
      <meshStandardMaterial color="#ffd479" emissive="#c8901e" emissiveIntensity={0.9} />
    </mesh>
  );
}
