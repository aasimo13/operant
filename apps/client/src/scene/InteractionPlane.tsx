import type { ThreeEvent } from '@react-three/fiber';
import type { ConstructView } from '@operant/core';
import { worldToCell, type Cell } from './layout';

export interface InteractionPlaneProps {
  readonly construct: ConstructView;
  readonly onIntervene: (cell: Cell) => void;
}

/**
 * An invisible plane over the Substrate that turns a click anywhere on the floor
 * into an Intervene (drop-anywhere): the clicked cell is resolved and, if it's
 * open, sent to the host to relocate the Sim there. Clicks on wall cells are
 * ignored. Most natural in god view but works in any viewpoint.
 */
export function InteractionPlane({
  construct,
  onIntervene,
}: InteractionPlaneProps): React.JSX.Element {
  const handlePointerDown = (event: ThreeEvent<PointerEvent>): void => {
    event.stopPropagation();
    const cell = worldToCell(event.point.x, event.point.z, construct.width, construct.height);
    if (!construct.walls[cell.y]?.[cell.x]) {
      onIntervene(cell);
    }
  };

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} onPointerDown={handlePointerDown}>
      <planeGeometry args={[construct.width, construct.height]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
