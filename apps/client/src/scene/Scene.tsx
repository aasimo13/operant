import { useRef } from 'react';
import { Vector3 } from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import type { SimClientState } from '../net/simClientState';
import { CheckpointMarkers, GoalMarker, Substrate } from './Substrate';
import { SimAvatar } from './SimAvatar';
import { CameraRig } from './CameraRig';
import { InteractionPlane } from './InteractionPlane';
import { HeatmapOverlay } from './HeatmapOverlay';
import { Cosmos } from './Cosmos';
import type { CameraMode } from './cameraPlacement';
import type { Cell } from './layout';

/**
 * The 3D scene: the Substrate, the goal, the Sim, and the camera rig, lit
 * against the void. A rendering layer only — everything it draws comes from the
 * live server state; it never simulates anything itself.
 */
export function Scene({
  state,
  tickMs,
  cameraMode,
  fov,
  onIntervene,
  reducedMotion = false,
}: {
  state: SimClientState;
  tickMs: number;
  cameraMode: CameraMode;
  fov: number;
  onIntervene: (cell: Cell) => void;
  reducedMotion?: boolean;
}): React.JSX.Element {
  const { construct, sim, lastRecord } = state;
  // The Sim's live world position, written by SimAvatar and read by CameraRig.
  const simWorld = useRef(new Vector3());

  return (
    <>
      <color attach="background" args={['#0a0e18']} />
      <fog attach="fog" args={['#0a0e18', 18, 52]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[6, 12, 4]} intensity={1.25} castShadow />
      {/* A soft fill from below-front so walls and floor don't read as flat black. */}
      <hemisphereLight args={['#8ea6e8', '#0a0e18', 0.35]} />

      <Cosmos reducedMotion={reducedMotion} />
      {construct && <Substrate construct={construct} />}
      {construct && construct.checkpoints.length > 0 && (
        <CheckpointMarkers
          checkpoints={construct.checkpoints}
          width={construct.width}
          height={construct.height}
        />
      )}
      {construct && cameraMode === 'god' && state.heatmap && (
        <HeatmapOverlay construct={construct} values={state.heatmap} />
      )}
      {construct && <InteractionPlane construct={construct} onIntervene={onIntervene} />}
      {construct && sim && (
        <GoalMarker goal={sim.goal} width={construct.width} height={construct.height} />
      )}
      {construct && sim && (
        <>
          <SimAvatar
            record={lastRecord}
            fallback={sim.position}
            width={construct.width}
            height={construct.height}
            tickMs={tickMs}
            worldOut={simWorld}
            visible={cameraMode !== 'first'}
            wear={sim.wear.wear}
            reducedMotion={reducedMotion}
          />
          <CameraRig
            mode={cameraMode}
            fov={fov}
            boardExtent={Math.max(construct.width, construct.height)}
            record={lastRecord}
            simWorld={simWorld}
          />
        </>
      )}

      {/* Soft cosmic glow — only the bright, emissive things (goal, Sim,
          checkpoints, god-ray) bloom; the dark Substrate stays grounded. */}
      <EffectComposer>
        <Bloom intensity={0.7} luminanceThreshold={0.55} luminanceSmoothing={0.25} mipmapBlur />
      </EffectComposer>
    </>
  );
}
