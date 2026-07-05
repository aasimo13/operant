/**
 * Opt into (or out of) the Sim's soundscape. Off by default — silence is the
 * respectful default, and the click is the gesture browsers require to start
 * audio.
 */
export function SoundToggle({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="sound-toggle"
      aria-pressed={on}
      aria-label={on ? 'Sound on — click to silence' : 'Sound off — click to listen'}
      onClick={onToggle}
    >
      {on ? '♪ Sound' : '♪ Silent'}
    </button>
  );
}
