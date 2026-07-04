import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Hud } from './ui/Hud';
import { SubstrateScaffold } from './scene/SubstrateScaffold';
import './App.css';

/**
 * Root of the Observer's view.
 *
 * The 3D scene (a react-three-fiber <Canvas>) is a rendering layer only; it
 * never owns simulation state. Once the simulation host exists (build-order
 * step 4), this connects to the live WebSocket stream and renders what the
 * server broadcasts. For now it shows a placeholder scene under the instrument
 * overlay to prove the pipeline is green.
 */
export function App(): React.JSX.Element {
  return (
    <div className="app">
      <Canvas camera={{ position: [3, 2, 4], fov: 60 }}>
        <color attach="background" args={['#05060a']} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />
        <SubstrateScaffold />
        <OrbitControls enablePan={false} />
      </Canvas>
      <Hud />
    </div>
  );
}
