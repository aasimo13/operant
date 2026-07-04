import { useRef } from 'react';
import { Vector3 } from 'three';
import type { SimClientState } from '../net/simClientState';
import { GoalMarker, Substrate } from './Substrate';
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
}: {
  state: SimClientState;
  tickMs: number;
  cameraMode: CameraMode;
  fov: number;
  onIntervene: (cell: Cell) => void;
}): React.JSX.Element {
  const { construct, sim, lastRecord } = state;
  // The Sim's live world position, written by SimAvatar and read by CameraRig.
  const simWorld = useRef(new Vector3());

  return (
    <>
      <color attach="background" args={['#05060a']} />
      <fog attach="fog" args={['#05060a', 12, 46]} />
      <ambientLight intensity={0.28} />
      <directionalLight position={[6, 12, 4]} intensity={0.9} castShadow />

      <Cosmos />
      {construct && <Substrate construct={construct} />}
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
    </>
  );
}
