import { describe, expect, it } from 'vitest';
import { emptyGrid, paint, gridToRows, editorStatus } from './editorGrid';

describe('maze editor model', () => {
  it('starts open with a start top-left and goal bottom-right', () => {
    const g = emptyGrid(4, 3);
    expect(gridToRows(g)).toEqual(['S...', '....', '...G']);
    expect(editorStatus(g).ok).toBe(true);
  });

  it('paints walls without touching start/goal uniqueness', () => {
    let g = emptyGrid(3, 3);
    g = paint(g, 1, 1, 'wall');
    expect(gridToRows(g)).toEqual(['S..', '.#.', '..G']);
  });

  it('keeps start and goal unique — placing a new one clears the old', () => {
    let g = emptyGrid(3, 3);
    g = paint(g, 2, 0, 'start'); // move start to top-right
    const status = editorStatus(g);
    expect(status.starts).toBe(1);
    expect(gridToRows(g)[0]).toBe('..S');
  });

  it('reports not-ok when the goal is painted over', () => {
    let g = emptyGrid(3, 3);
    g = paint(g, 2, 2, 'wall'); // wall over the goal
    expect(editorStatus(g)).toMatchObject({ goals: 0, ok: false });
  });
});
