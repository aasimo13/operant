import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping } from 'three';
import { useSimSocket } from './net/useSimSocket';
import { Scene } from './scene/Scene';
import type { CameraMode } from './scene/cameraPlacement';
import type { Cell } from './scene/layout';
import { Hud } from './ui/Hud';
import { ViewControls } from './ui/ViewControls';
import { ProvidenceControls } from './ui/ProvidenceControls';
import { TranscriptPanel } from './ui/TranscriptPanel';
import { WearDebug } from './ui/WearDebug';
import { Landing } from './ui/Landing';
import { RelocateControls } from './ui/RelocateControls';
import { QueuePanel } from './ui/QueuePanel';
import { MazeEditor } from './ui/MazeEditor';
import { ChroniclePanel } from './ui/ChroniclePanel';
import { SoundToggle } from './ui/SoundToggle';
import { useSoundscape } from './audio/useSoundscape';
import type { ConstructDesign } from '@operant/core';
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
  const [entered, setEntered] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('third');
  const [fov, setFov] = useState(60);

  const reward = useCallback(() => send({ type: 'providence', kind: 'reward' }), [send]);
  const punish = useCallback(() => send({ type: 'providence', kind: 'punish' }), [send]);
  const intervene = useCallback(
    (cell: Cell) => send({ type: 'intervene', position: cell }),
    [send],
  );
  const relocate = useCallback(
    (constructId: string) => send({ type: 'transitionTo', constructId }),
    [send],
  );
  const submitConstruct = useCallback(
    (design: ConstructDesign) => send({ type: 'submitConstruct', design }),
    [send],
  );
  const [editing, setEditing] = useState(false);
  const [showChronicle, setShowChronicle] = useState(false);

  // A brief "the world reconfigures" flash whenever the Construct changes.
  const prevConstructId = useRef<string | undefined>(undefined);
  const [flashKey, setFlashKey] = useState(0);
  useEffect(() => {
    const id = state.construct?.id;
    if (id && prevConstructId.current && prevConstructId.current !== id) {
      setFlashKey((k) => k + 1);
    }
    prevConstructId.current = id;
  }, [state.construct?.id]);

  // A warm/cold pulse at the edges whenever ANY Observer reaches in with
  // Providence — so you feel the others, not just your own hand.
  const pulse = state.providencePulse;

  // The synthesized soundscape (opt-in): a drone that strains with wear, plus
  // cues on Providence and wall-bumps.
  const sound = useSoundscape({
    wear: state.sim?.wear.wear ?? 0,
    providencePulse: state.providencePulse,
    lastRecord: state.lastRecord,
  });

  // While in god view, poll the host for the value-landscape heatmap. It only
  // costs bandwidth when someone is actually looking at it.
  useEffect(() => {
    if (cameraMode !== 'god') return;
    send({ type: 'requestHeatmap' });
    const id = setInterval(() => send({ type: 'requestHeatmap' }), 1000);
    return () => clearInterval(id);
  }, [cameraMode, send]);

  if (!entered) {
    return <Landing onEnter={() => setEntered(true)} />;
  }

  return (
    <div className="app">
      <Canvas
        shadows
        camera={{ position: [0, 7, 9], fov }}
        gl={{ toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      >
        <Scene
          state={state}
          tickMs={TICK_MS}
          cameraMode={cameraMode}
          fov={fov}
          onIntervene={intervene}
        />
      </Canvas>
      <Hud
        connected={connected}
        tickCount={state.sim?.tickCount ?? null}
        watching={state.watching}
      />
      <TranscriptPanel lines={state.transcript} />
      <ProvidenceControls onReward={reward} onPunish={punish} />
      <RelocateControls currentConstructId={state.construct?.id ?? 'first'} onRelocate={relocate} />
      <ViewControls mode={cameraMode} fov={fov} onModeChange={setCameraMode} onFovChange={setFov} />
      <SoundToggle on={sound.on} onToggle={sound.toggle} />
      <QueuePanel
        currentName={state.construct?.name ?? null}
        queue={state.queue}
        onAuthor={() => setEditing(true)}
        onChronicle={() => setShowChronicle(true)}
      />
      {editing && <MazeEditor onSubmit={submitConstruct} onClose={() => setEditing(false)} />}
      {showChronicle && state.chronicle && (
        <ChroniclePanel chronicle={state.chronicle} onClose={() => setShowChronicle(false)} />
      )}
      {import.meta.env.DEV && state.sim && <WearDebug wear={state.sim.wear} />}
      {flashKey > 0 && <div key={flashKey} className="transition-flash" aria-hidden="true" />}
      {pulse && (
        <div
          key={pulse.seq}
          className={`providence-pulse providence-pulse--${pulse.kind}`}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
