import { useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useSimSocket } from './net/useSimSocket';
import { Scene } from './scene/Scene';
import type { CameraMode } from './scene/cameraPlacement';
import type { Cell } from './scene/layout';
import { Hud } from './ui/Hud';
import { ViewControls } from './ui/ViewControls';
import { ProvidenceControls } from './ui/ProvidenceControls';
import { TranscriptPanel } from './ui/TranscriptPanel';
import { WearDebug } from './ui/WearDebug';
import './App.css';

/** The Observer's live WebSocket endpoint (overridable per environment). */
const WS_URL = import.meta.env.VITE_SIM_WS_URL ?? 'ws://localhost:8787';

/** Decision-tick length in ms — matches the host's SIM_TICK_MS so tweens align. */
const TICK_MS = 1500;

/**
 * Root of the Observer's view. Connects to the always-on simulation host and
 * renders whatever it broadcasts. The 3D scene is a rendering layer only; it
 * never owns simulation state.
 */
export function App(): React.JSX.Element {
  const { state, connected, send } = useSimSocket(WS_URL);
  const [cameraMode, setCameraMode] = useState<CameraMode>('third');
  const [fov, setFov] = useState(60);

  const reward = useCallback(() => send({ type: 'providence', kind: 'reward' }), [send]);
  const punish = useCallback(() => send({ type: 'providence', kind: 'punish' }), [send]);
  const intervene = useCallback(
    (cell: Cell) => send({ type: 'intervene', position: cell }),
    [send],
  );

  // While in god view, poll the host for the value-landscape heatmap. It only
  // costs bandwidth when someone is actually looking at it.
  useEffect(() => {
    if (cameraMode !== 'god') return;
    send({ type: 'requestHeatmap' });
    const id = setInterval(() => send({ type: 'requestHeatmap' }), 1000);
    return () => clearInterval(id);
  }, [cameraMode, send]);

  return (
    <div className="app">
      <Canvas shadows camera={{ position: [0, 7, 9], fov }}>
        <Scene
          state={state}
          tickMs={TICK_MS}
          cameraMode={cameraMode}
          fov={fov}
          onIntervene={intervene}
        />
      </Canvas>
      <Hud connected={connected} tickCount={state.sim?.tickCount ?? null} />
      <TranscriptPanel lines={state.transcript} />
      <ProvidenceControls onReward={reward} onPunish={punish} />
      <ViewControls mode={cameraMode} fov={fov} onModeChange={setCameraMode} onFovChange={setFov} />
      {import.meta.env.DEV && state.sim && <WearDebug wear={state.sim.wear} />}
    </div>
  );
}
