import { useState } from 'react';
import type { ConstructDesign } from '@operant/core';
import {
  emptyGrid,
  paint,
  gridToRows,
  editorStatus,
  type EditorCell,
  type EditorTool,
} from './editorGrid';

const SIZE = 10;

const TOOLS: ReadonlyArray<{ tool: EditorTool; label: string }> = [
  { tool: 'wall', label: 'Wall' },
  { tool: 'open', label: 'Erase' },
  { tool: 'start', label: 'Start' },
  { tool: 'goal', label: 'Goal' },
];

const CELL_CLASS: Record<EditorCell, string> = {
  open: 'ed-cell',
  wall: 'ed-cell ed-cell--wall',
  start: 'ed-cell ed-cell--start',
  goal: 'ed-cell ed-cell--goal',
};

/**
 * The Observer authors a world the Sim will be made to endure next. Draw walls,
 * set where it enters and what it must reach, name the place, and submit — it
 * joins the queue and becomes the Sim's next chapter when it next reaches a goal.
 * The Sim carries its whole mind in; nothing it has learned is undone.
 */
export function MazeEditor({
  onSubmit,
  onClose,
}: {
  onSubmit: (design: ConstructDesign) => void;
  onClose: () => void;
}): React.JSX.Element {
  const [grid, setGrid] = useState<EditorCell[][]>(() => emptyGrid(SIZE, SIZE));
  const [tool, setTool] = useState<EditorTool>('wall');
  const [name, setName] = useState('');
  const [painting, setPainting] = useState(false);

  const status = editorStatus(grid);
  const canSubmit = status.ok && name.trim().length > 0;

  const apply = (x: number, y: number): void => setGrid((g) => paint(g, x, y, tool));

  const submit = (): void => {
    if (!canSubmit) return;
    onSubmit({ id: crypto.randomUUID(), name: name.trim(), rows: gridToRows(grid) });
    onClose();
  };

  return (
    <div className="ed-backdrop" role="dialog" aria-modal="true" aria-label="Author a world">
      <div className="ed-panel">
        <header className="ed-head">
          <h2 className="ed-title">Author a world</h2>
          <p className="ed-sub">
            Draw a place. The Sim will be made to endure it next — and to learn it.
          </p>
        </header>

        <div
          className="ed-grid"
          style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}
          onPointerUp={() => setPainting(false)}
          onPointerLeave={() => setPainting(false)}
        >
          {grid.map((row, y) =>
            row.map((cell, x) => (
              <button
                key={`${x},${y}`}
                type="button"
                className={CELL_CLASS[cell]}
                aria-label={`cell ${x},${y}: ${cell}`}
                onPointerDown={() => {
                  setPainting(true);
                  apply(x, y);
                }}
                onPointerEnter={() => {
                  if (painting) apply(x, y);
                }}
              />
            )),
          )}
        </div>

        <div className="ed-tools" role="group" aria-label="Drawing tool">
          {TOOLS.map((t) => (
            <button
              key={t.tool}
              type="button"
              className="ed-tool"
              aria-pressed={tool === t.tool}
              onClick={() => setTool(t.tool)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <input
          className="ed-name"
          type="text"
          maxLength={40}
          placeholder="Name this world…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="World name"
        />

        <p className="ed-status">
          {status.ok
            ? 'Ready — it must have a way through, or it will be refused.'
            : 'Place exactly one start and one goal.'}
        </p>

        <div className="ed-actions">
          <button type="button" className="ed-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="ed-btn ed-btn--primary"
            disabled={!canSubmit}
            onClick={submit}
          >
            Condemn the Sim to it
          </button>
        </div>
      </div>
    </div>
  );
}
