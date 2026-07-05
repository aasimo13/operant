/**
 * Toggle the decorative motion (tremble, drifting motes, pulses, flashes) on or
 * off. Defaults to the system's reduced-motion preference; here so anyone can
 * override it either way.
 */
export function MotionToggle({
  reduced,
  onToggle,
}: {
  reduced: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="sound-toggle motion-toggle"
      aria-pressed={reduced}
      aria-label={
        reduced ? 'Reduced motion on — click for full motion' : 'Full motion — click to reduce'
      }
      onClick={onToggle}
    >
      {reduced ? '⧖ Still' : '⧗ Motion'}
    </button>
  );
}
