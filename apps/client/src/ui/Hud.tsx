/**
 * The instrument overlay drawn on top of the 3D Substrate.
 *
 * A plain DOM component (no Three.js) so it renders and tests in jsdom without a
 * WebGL context, and so the clinical instrument-style chrome stays decoupled
 * from the scene. Providence / Intervene controls and the narrator transcript
 * are later build-order steps.
 */
export interface HudProps {
  readonly connected?: boolean;
  readonly tickCount?: number | null;
  /** How many Observers (including this one) are watching right now. */
  readonly watching?: number;
}

export function Hud({ connected, tickCount, watching }: HudProps = {}): React.JSX.Element {
  return (
    <div className="hud" aria-label="Operant instrument overlay">
      <h1 className="hud__wordmark">Operant</h1>
      <p className="hud__status" role="status">
        {connected ? 'Substrate online' : 'Connecting to the Substrate…'}
        {tickCount !== null && tickCount !== undefined
          ? ` · cycle ${tickCount.toLocaleString()}`
          : ''}
        {connected && watching !== undefined
          ? ` · ${watching === 1 ? 'you alone are watching' : `${watching.toLocaleString()} watching`}`
          : ''}
      </p>
    </div>
  );
}
