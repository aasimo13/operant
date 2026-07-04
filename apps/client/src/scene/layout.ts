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
