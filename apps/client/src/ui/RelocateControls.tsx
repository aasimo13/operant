export interface RelocateControlsProps {
  readonly currentConstructId: string;
  readonly onRelocate: (constructId: string) => void;
}

/**
 * The Observer's control to move the Sim between Constructs — dropping it into
 * the track, or back to the maze. A deliberate act, like Intervene but for the
 * whole world; the Sim carries its learned instincts across and must reconcile
 * them (which is exactly when the narrator has the most to say).
 */
const DESTINATIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'first', label: 'The Maze' },
  { id: 'track', label: 'The Track' },
];

export function RelocateControls({
  currentConstructId,
  onRelocate,
}: RelocateControlsProps): React.JSX.Element {
  return (
    <div className="relocate" role="group" aria-label="Relocate the Sim">
      <span className="relocate__label">Relocate</span>
      {DESTINATIONS.map((d) => (
        <button
          key={d.id}
          type="button"
          className="relocate__btn"
          aria-pressed={currentConstructId === d.id}
          onClick={() => onRelocate(d.id)}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}
