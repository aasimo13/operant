/** RGB triple in 0..1, as Three.js color inputs. */
export type Rgb = [number, number, number];

/** Cold (low value) and warm (high value) ends of the heatmap ramp. */
export const HEAT_LOW: Rgb = [0.16, 0.42, 0.85];
export const HEAT_HIGH: Rgb = [0.99, 0.86, 0.32];

/**
 * Colour for a cell's value on the god-view heatmap: cold blue where the Sim
 * sees little worth, warm gold where it values a cell highly. Normalizes the
 * value against the grid's own min/max and clamps, so the ramp always spans the
 * full landscape. A flat grid (min == max) reads as uniformly cold.
 */
export function heatColor(value: number, min: number, max: number): Rgb {
  const t = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0;
  if (t <= 0) return [...HEAT_LOW];
  if (t >= 1) return [...HEAT_HIGH];
  return [
    HEAT_LOW[0] + (HEAT_HIGH[0] - HEAT_LOW[0]) * t,
    HEAT_LOW[1] + (HEAT_HIGH[1] - HEAT_LOW[1]) * t,
    HEAT_LOW[2] + (HEAT_HIGH[2] - HEAT_LOW[2]) * t,
  ];
}
