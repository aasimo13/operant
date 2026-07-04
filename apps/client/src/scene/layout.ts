/**
 * Map a grid cell (or fractional tweened point) to world X/Z, centering the
 * board on the origin so the camera has a natural pivot. Grid x → world X,
 * grid y (row) → world Z. Cells are 1 unit; the returned coordinates are cell
 * centers.
 */
export function cellToWorldXZ(
  x: number,
  y: number,
  width: number,
  height: number,
): [number, number] {
  return [x - width / 2 + 0.5, y - height / 2 + 0.5];
}

/** A grid cell the Observer clicked. */
export interface Cell {
  readonly x: number;
  readonly y: number;
}

/**
 * Inverse of {@link cellToWorldXZ}: which grid cell a world X/Z point falls in.
 * Used to turn a click on the Substrate into an Intervene target. Clamped to the
 * board so a click just past the edge still resolves to a real cell.
 */
export function worldToCell(wx: number, wz: number, width: number, height: number): Cell {
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
  return {
    x: clamp(Math.round(wx + width / 2 - 0.5), width - 1),
    y: clamp(Math.round(wz + height / 2 - 0.5), height - 1),
  };
}
