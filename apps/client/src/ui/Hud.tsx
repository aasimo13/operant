/**
 * The instrument overlay drawn on top of the 3D Substrate.
 *
 * Kept as a plain DOM component (no Three.js) so it renders and tests in jsdom
 * without a WebGL context, and so the clinical instrument-style chrome stays
 * decoupled from the scene. This is a scaffold placeholder — Providence /
 * Intervene controls, camera/FOV controls, and the narrator transcript are
 * later build-order steps.
 */
export function Hud(): React.JSX.Element {
  return (
    <div className="hud" aria-label="Operant instrument overlay">
      <h1 className="hud__wordmark">Operant</h1>
      <p className="hud__status" role="status">
        Substrate online — scaffold
      </p>
    </div>
  );
}
