import type { WearBreakdown } from '@operant/core';

/**
 * A private, developer-only readout of the visible-wear internals, so the
 * starting constants can be retuned against a real Sim (see CLAUDE.md). It is
 * NEVER shown to visitors — App only mounts it under `import.meta.env.DEV`.
 */
export function WearDebug({ wear }: { wear: WearBreakdown }): React.JSX.Element {
  return (
    <div className="wear-debug" aria-label="Wear debug readout">
      <div className="wear-debug__title">wear · dev</div>
      <Row label="baseline" value={wear.baselineWear} />
      <Row label="strain" value={wear.recentStrain} />
      <Row label="wear" value={wear.wear} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div className="wear-debug__row">
      <span>{label}</span>
      <span>{value.toFixed(3)}</span>
    </div>
  );
}
