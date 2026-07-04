import { useMemo } from 'react';
import { Color } from 'three';
import type { ConstructView } from '@operant/core';
import { cellToWorldXZ } from './layout';
import { heatColor } from './heatColor';

export interface HeatmapOverlayProps {
  readonly construct: ConstructView;
  /** Best-action value per cell (null for walls), as values[y][x]. */
  readonly values: Array<Array<number | null>>;
}

interface HeatCell {
  readonly key: string;
  readonly position: [number, number, number];
  readonly color: Color;
}

/**
 * The god-view Q-value heatmap: one translucent tile per open cell, coloured by
 * how much the Sim values that cell (max Q), normalized across the whole board.
 * Presentation only — it reads the broadcast values, never the Q-table directly.
 */
export function HeatmapOverlay({ construct, values }: HeatmapOverlayProps): React.JSX.Element {
  const cells = useMemo<HeatCell[]>(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const row of values) {
      for (const v of row) {
        if (v !== null) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }

    const out: HeatCell[] = [];
    for (let y = 0; y < construct.height; y++) {
      for (let x = 0; x < construct.width; x++) {
        const v = values[y]?.[x];
        if (v === null || v === undefined) continue;
        const [wx, wz] = cellToWorldXZ(x, y, construct.width, construct.height);
        const [r, g, b] = heatColor(v, min, max);
        out.push({ key: `${x},${y}`, position: [wx, 0.02, wz], color: new Color(r, g, b) });
      }
    }
    return out;
  }, [construct, values]);

  return (
    <group>
      {cells.map((cell) => (
        <mesh key={cell.key} rotation={[-Math.PI / 2, 0, 0]} position={cell.position}>
          <planeGeometry args={[0.92, 0.92]} />
          <meshBasicMaterial color={cell.color} transparent opacity={0.82} />
        </mesh>
      ))}
    </group>
  );
}
