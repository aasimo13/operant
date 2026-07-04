export interface ProvidenceControlsProps {
  readonly onReward: () => void;
  readonly onPunish: () => void;
}

/**
 * Providence: the Observer's reward/punish input. Discrete buttons (not a
 * slider — see CLAUDE.md), framed as an unexplainable force acting on the Sim.
 * The host rate-limits these per connection and folds them into the Sim's
 * learning; punishment is written permanently but its influence decays.
 */
export function ProvidenceControls({
  onReward,
  onPunish,
}: ProvidenceControlsProps): React.JSX.Element {
  return (
    <div className="providence" role="group" aria-label="Providence">
      <button type="button" className="providence__btn providence__btn--reward" onClick={onReward}>
        Reward
      </button>
      <button type="button" className="providence__btn providence__btn--punish" onClick={onPunish}>
        Punish
      </button>
    </div>
  );
}
