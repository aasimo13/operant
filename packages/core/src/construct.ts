import { positionKey, type GridPosition } from './grid';

/**
 * A Construct is one specific maze instance — one chapter in the Sim's single
 * life (see CLAUDE.md: "Substrate" is the general space; "a Construct" is one
 * concrete maze). The Sim moves through a *sequence* of Constructs; this type
 * models exactly one.
 *
 * The geometry is immutable. The goal here is the Construct's *initial* goal;
 * because there is no completion state, reaching it relocates the goal (that
 * live position lives in the running simulation, not in this static shape).
 */
export interface Construct {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  /** Where the Sim first enters this Construct. */
  readonly start: GridPosition;
  /** The Construct's initial goal cell. */
  readonly goal: GridPosition;
  inBounds(pos: GridPosition): boolean;
  isWall(pos: GridPosition): boolean;
  /** True only for in-bounds, non-wall cells. */
  isOpen(pos: GridPosition): boolean;
  /** Every open (traversable) cell, in row-major order. */
  openCells(): GridPosition[];
}

const OPEN = '.';
const WALL = '#';
const START = 'S';
const GOAL = 'G';

/**
 * Build a Construct from an ASCII layout. Each string is a row; `#` is a wall,
 * `S` the start, `G` the goal, and `.` an open cell. Both `S` and `G` cells are
 * traversable (open) — the letters only mark special positions.
 */
export function parseConstruct(id: string, rows: readonly string[]): Construct {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  if (width === 0) {
    throw new Error(`Construct "${id}" is empty.`);
  }
  if (rows.some((row) => row.length !== width)) {
    throw new Error(`Construct "${id}" is not rectangular: every row must have width ${width}.`);
  }

  const wall: boolean[][] = [];
  const starts: GridPosition[] = [];
  const goals: GridPosition[] = [];

  for (let y = 0; y < height; y++) {
    const row = rows[y]!;
    const wallRow: boolean[] = [];
    for (let x = 0; x < width; x++) {
      const ch = row[x]!;
      switch (ch) {
        case WALL:
          wallRow.push(true);
          break;
        case OPEN:
          wallRow.push(false);
          break;
        case START:
          wallRow.push(false);
          starts.push({ x, y });
          break;
        case GOAL:
          wallRow.push(false);
          goals.push({ x, y });
          break;
        default:
          throw new Error(
            `Construct "${id}" has an unknown character "${ch}" at (${x},${y}); expected one of ${OPEN}${WALL}${START}${GOAL}.`,
          );
      }
    }
    wall.push(wallRow);
  }

  if (starts.length !== 1) {
    throw new Error(`Construct "${id}" must have exactly one start (S); found ${starts.length}.`);
  }
  if (goals.length !== 1) {
    throw new Error(`Construct "${id}" must have exactly one goal (G); found ${goals.length}.`);
  }

  const inBounds = (pos: GridPosition): boolean =>
    pos.x >= 0 && pos.x < width && pos.y >= 0 && pos.y < height;

  const isWall = (pos: GridPosition): boolean => inBounds(pos) && wall[pos.y]![pos.x]!;

  const isOpen = (pos: GridPosition): boolean => inBounds(pos) && !wall[pos.y]![pos.x]!;

  const openCells = (): GridPosition[] => {
    const cells: GridPosition[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!wall[y]![x]!) cells.push({ x, y });
      }
    }
    return cells;
  };

  return {
    id,
    width,
    height,
    start: starts[0]!,
    goal: goals[0]!,
    inBounds,
    isWall,
    isOpen,
    openCells,
  };
}

/**
 * Length (in steps) of the shortest 4-connected path between two open cells,
 * or `null` if none exists. Used to validate that a Construct is solvable and
 * to measure how close the Sim's learned policy is to optimal.
 */
export function shortestPathLength(
  construct: Construct,
  from: GridPosition,
  to: GridPosition,
): number | null {
  if (!construct.isOpen(from) || !construct.isOpen(to)) return null;

  const goalKey = positionKey(to);
  const visited = new Set<string>([positionKey(from)]);
  let frontier: GridPosition[] = [from];
  let distance = 0;

  while (frontier.length > 0) {
    const next: GridPosition[] = [];
    for (const cell of frontier) {
      if (positionKey(cell) === goalKey) return distance;
      for (const neighbor of neighbors(cell)) {
        const key = positionKey(neighbor);
        if (!visited.has(key) && construct.isOpen(neighbor)) {
          visited.add(key);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
    distance += 1;
  }

  return null;
}

function neighbors(pos: GridPosition): GridPosition[] {
  return [
    { x: pos.x, y: pos.y - 1 },
    { x: pos.x, y: pos.y + 1 },
    { x: pos.x - 1, y: pos.y },
    { x: pos.x + 1, y: pos.y },
  ];
}
