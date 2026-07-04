import type { CameraMode } from '../scene/cameraPlacement';

export interface ViewControlsProps {
  readonly mode: CameraMode;
  readonly fov: number;
  readonly onModeChange: (mode: CameraMode) => void;
  readonly onFovChange: (fov: number) => void;
}

const MODES: ReadonlyArray<{ mode: CameraMode; label: string }> = [
  { mode: 'first', label: 'First person' },
  { mode: 'third', label: 'Third person' },
  { mode: 'god', label: 'God view' },
];

/** Field-of-view bounds for first/third person (god view fixes its own). */
const FOV_MIN = 40;
const FOV_MAX = 100;

/**
 * The Observer's instrument controls: switch viewpoint and, in first/third
 * person, adjust field of view. Styled as observatory instruments rather than
 * app buttons. Keyboard-navigable with ARIA state.
 */
export function ViewControls({
  mode,
  fov,
  onModeChange,
  onFovChange,
}: ViewControlsProps): React.JSX.Element {
  return (
    <div className="controls" aria-label="Viewpoint controls">
      <div className="controls__modes" role="group" aria-label="Camera viewpoint">
        {MODES.map(({ mode: m, label }) => (
          <button
            key={m}
            type="button"
            className="controls__btn"
            aria-pressed={mode === m}
            onClick={() => onModeChange(m)}
          >
            {label}
          </button>
        ))}
      </div>

      {mode !== 'god' && (
        <label className="controls__fov">
          <span>Field of view</span>
          <input
            type="range"
            min={FOV_MIN}
            max={FOV_MAX}
            value={fov}
            aria-label="Field of view"
            onChange={(e) => onFovChange(Number(e.target.value))}
          />
        </label>
      )}
    </div>
  );
}
