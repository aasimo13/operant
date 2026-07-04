import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useSimSocket } from './net/useSimSocket';
import { Scene } from './scene/Scene';
import type { CameraMode } from './scene/cameraPlacement';
import { Hud } from './ui/Hud';
import { ViewControls } from './ui/ViewControls';
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
  const { state, connected } = useSimSocket(WS_URL);
  const [cameraMode, setCameraMode] = useState<CameraMode>('third');
  const [fov, setFov] = useState(60);

  return (
    <div className="app">
      <Canvas shadows camera={{ position: [0, 7, 9], fov }}>
        <Scene state={state} tickMs={TICK_MS} cameraMode={cameraMode} fov={fov} />
      </Canvas>
      <Hud connected={connected} tickCount={state.sim?.tickCount ?? null} />
      <ViewControls mode={cameraMode} fov={fov} onModeChange={setCameraMode} onFovChange={setFov} />
    </div>
  );
}
