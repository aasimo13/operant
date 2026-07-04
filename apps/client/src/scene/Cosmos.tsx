import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, type Points } from 'three';

/**
 * The restrained cosmic backdrop: a faint starfield and a few slow-drifting
 * motes suspending the Substrate in a dark void. Deliberately sparse — the lone
 * Sim carries the emotion (see the "restrained & haunting" direction). One
 * points cloud each, so it's cheap.
 */
export function Cosmos(): React.JSX.Element {
  return (
    <group>
      <Starfield />
      <Motes />
      {/* A soft overhead glow — a single god-ray gesture, not a spectacle. */}
      <pointLight position={[0, 14, 2]} intensity={18} distance={40} decay={2} color="#9db4ff" />
    </group>
  );
}

/** A shell of faint stars, far out in the dark. */
function Starfield(): React.JSX.Element {
  const positions = useMemo(() => sphereShell(700, 60, 120), []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.35} sizeAttenuation color="#c9d4ff" transparent opacity={0.7} />
    </points>
  );
}

/** Sparse motes drifting slowly near the Substrate. */
function Motes(): React.JSX.Element {
  const ref = useRef<Points>(null);
  const positions = useMemo(() => box(90, 26, 14, 26), []);
  useFrame((_state, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.02;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.12}
        sizeAttenuation
        color="#6f86c8"
        transparent
        opacity={0.5}
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

/** Random points on a spherical shell between `inner` and `outer` radius. */
function sphereShell(count: number, inner: number, outer: number): Float32Array {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = inner + Math.random() * (outer - inner);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    out[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    out[i * 3 + 1] = r * Math.cos(phi);
    out[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  return out;
}

/** Random points inside a box centered on the origin. */
function box(count: number, w: number, h: number, d: number): Float32Array {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    out[i * 3] = (Math.random() - 0.5) * w;
    out[i * 3 + 1] = (Math.random() - 0.5) * h;
    out[i * 3 + 2] = (Math.random() - 0.5) * d;
  }
  return out;
}
