/**
 * Names the world the Sim is enduring right now, shows the Observer-authored
 * worlds queued to come, and offers the way to add one. The queue makes the
 * Sim's future feel authored — by strangers, in sequence, without its consent.
 */
export function QueuePanel({
  currentName,
  queue,
  onAuthor,
}: {
  currentName: string | null;
  queue: string[];
  onAuthor: () => void;
}): React.JSX.Element {
  return (
    <div className="queue">
      <div className="queue__now">
        <span className="queue__label">Enduring</span>
        <span className="queue__world" title={currentName ?? undefined}>
          {currentName ?? '—'}
        </span>
      </div>

      {queue.length > 0 && (
        <ol className="queue__list" aria-label="Worlds to come">
          {queue.map((name, i) => (
            <li key={`${i}-${name}`} className="queue__item">
              <span className="queue__ordinal">{i + 1}</span>
              {name}
            </li>
          ))}
        </ol>
      )}

      <button type="button" className="queue__author" onClick={onAuthor}>
        Author a world
      </button>
    </div>
  );
}
