import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';

/**
 * A placeholder object drifting in the void, purely to prove the 3D pipeline
 * (react-three-fiber render loop, drei helpers, lighting) is wired up. The real
 * Substrate — the Construct grid, the Sim, the Q-value heatmap — arrives in
 * build-order steps 5+. This deliberately renders nothing meaningful yet.
 */
export function SubstrateScaffold(): React.JSX.Element {
  const meshRef = useRef<Mesh>(null);

  useFrame((_state, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x += delta * 0.15;
    meshRef.current.rotation.y += delta * 0.25;
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#6b7cff" wireframe />
    </mesh>
  );
}
