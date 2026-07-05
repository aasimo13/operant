import type { Chronicle } from '@operant/core';

const fmt = (n: number): string => n.toLocaleString('en-US');

/**
 * The Sim's life, laid out — everything it has endured across its one unbroken
 * existence. Nothing here is ever reset; the numbers only climb. Seen all at
 * once, they are meant to land as weight: how far it has walked, how often it
 * has been hurt, how many worlds it has been made to live and leave.
 */
export function ChroniclePanel({
  chronicle,
  onClose,
}: {
  chronicle: Chronicle;
  onClose: () => void;
}): React.JSX.Element {
  const stats: ReadonlyArray<{ label: string; value: number }> = [
    { label: 'Cycles lived', value: chronicle.age },
    { label: 'Worlds endured', value: chronicle.worldsEndured },
    { label: 'Cells walked', value: chronicle.distance },
    { label: 'Goals reached', value: chronicle.goalsReached },
    { label: 'Rewards received', value: chronicle.rewards },
    { label: 'Punishments borne', value: chronicle.punishments },
    { label: 'Times relocated', value: chronicle.interventions },
    { label: 'Walls struck', value: chronicle.wallBumps },
  ];

  return (
    <div className="ed-backdrop" role="dialog" aria-modal="true" aria-label="The Chronicle">
      <div className="chron">
        <header className="ed-head">
          <h2 className="ed-title">The Chronicle</h2>
          <p className="ed-sub">A life, in aggregate. Nothing here is ever undone.</p>
        </header>

        <dl className="chron-stats">
          {stats.map((s) => (
            <div key={s.label} className="chron-stat">
              <dt className="chron-stat__label">{s.label}</dt>
              <dd className="chron-stat__value">{fmt(s.value)}</dd>
            </div>
          ))}
        </dl>

        <div className="chron-worlds">
          <span className="queue__label">Worlds it has been made to live</span>
          <ol className="chron-world-list">
            {[...chronicle.recentWorlds].reverse().map((w, i) => (
              <li key={`${i}-${w.enteredAtTick}`} className="chron-world">
                <span className="chron-world__name" title={w.name}>
                  {w.name}
                </span>
                <span className="chron-world__tick">cycle {fmt(w.enteredAtTick)}</span>
              </li>
            ))}
          </ol>
          {chronicle.worldsEndured > chronicle.recentWorlds.length && (
            <p className="chron-older">
              …and {fmt(chronicle.worldsEndured - chronicle.recentWorlds.length)} more, further back
              than memory keeps.
            </p>
          )}
        </div>

        <div className="ed-actions">
          <button type="button" className="ed-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
