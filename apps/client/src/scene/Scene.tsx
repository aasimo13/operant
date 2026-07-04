import type { SimClientState } from '../net/simClientState';
import { GoalMarker, Substrate } from './Substrate';
import { SimAvatar } from './SimAvatar';

/**
 * The 3D scene: the Substrate, the goal, and the Sim, lit against the void. A
 * rendering layer only — everything it draws comes from the live server state
 * (`state`); it never simulates anything itself.
 */
export function Scene({
  state,
  tickMs,
}: {
  state: SimClientState;
  tickMs: number;
}): React.JSX.Element {
  const { construct, sim, lastRecord } = state;
  return (
    <>
      <color attach="background" args={['#05060a']} />
      <fog attach="fog" args={['#05060a', 10, 34]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 12, 4]} intensity={1.1} castShadow />

      {construct && <Substrate construct={construct} />}
      {construct && sim && (
        <GoalMarker goal={sim.goal} width={construct.width} height={construct.height} />
      )}
      {construct && sim && (
        <SimAvatar
          record={lastRecord}
          fallback={sim.position}
          width={construct.width}
          height={construct.height}
          tickMs={tickMs}
        />
      )}
    </>
  );
}
