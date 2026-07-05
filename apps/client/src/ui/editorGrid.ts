/**
 * Pure model for the maze editor: an Observer paints a world the Sim will be
 * made to endure. Kept free of React so the grid logic is unit-testable and the
 * component stays a thin rendering shell. Produces the same ASCII rows the core
 * parser consumes (`S`/`G`/`#`/`.`).
 */
export type EditorCell = 'open' | 'wall' | 'start' | 'goal';
export type EditorTool = EditorCell;

const CHAR: Record<EditorCell, string> = { open: '.', wall: '#', start: 'S', goal: 'G' };

/** A fresh grid: all open, with the start top-left and the goal bottom-right. */
export function emptyGrid(width: number, height: number): EditorCell[][] {
  const grid: EditorCell[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, (): EditorCell => 'open'),
  );
  grid[0]![0] = 'start';
  grid[height - 1]![width - 1] = 'goal';
  return grid;
}

/**
 * Paint one cell, returning a new grid. Start and goal are unique — placing
 * either clears any previous one — so the result is always submit-shaped once
 * both exist.
 */
export function paint(
  grid: EditorCell[][],
  x: number,
  y: number,
  tool: EditorTool,
): EditorCell[][] {
  const next = grid.map((row) => [...row]);
  if (tool === 'start' || tool === 'goal') {
    for (let j = 0; j < next.length; j++) {
      for (let i = 0; i < next[j]!.length; i++) {
        if (next[j]![i] === tool) next[j]![i] = 'open';
      }
    }
  }
  next[y]![x] = tool;
  return next;
}

export function gridToRows(grid: EditorCell[][]): string[] {
  return grid.map((row) => row.map((cell) => CHAR[cell]).join(''));
}

/** Whether the grid has exactly one start and one goal (structurally submittable). */
export function editorStatus(grid: EditorCell[][]): {
  starts: number;
  goals: number;
  ok: boolean;
} {
  let starts = 0;
  let goals = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell === 'start') starts++;
      else if (cell === 'goal') goals++;
    }
  }
  return { starts, goals, ok: starts === 1 && goals === 1 };
}
