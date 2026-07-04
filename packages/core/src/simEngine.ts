import { step } from './environment';
import { positionKey, type Action, type GridPosition } from './grid';
import type { Construct } from './construct';
import type { QLearningAgent } from './qLearningAgent';
import type { Rng } from './rng';

/** A full record of one decision tick, for the state stream and narrator. */
export interface TickRecord {
  /** 1-based tick index this record corresponds to. */
  readonly tick: number;
  /** The action the Sim chose. */
  readonly action: Action;
  /** Position before the action. */
  readonly from: GridPosition;
  /** Position after the action (equal to `from` on a wall bump). */
  readonly to: GridPosition;
  readonly reward: number;
  readonly hitWall: boolean;
  readonly reachedGoal: boolean;
  /** True if reaching the goal relocated it (always true when reachedGoal). */
  readonly goalRelocated: boolean;
}

/**
 * Chooses where the goal moves to once reached. Because there is no completion
 * state, arrival relocates the goal rather than ending anything.
 */
export type RelocateGoal = (
  construct: Construct,
  currentGoal: GridPosition,
  simPosition: GridPosition,
  rng: Rng,
) => GridPosition;

export interface SimEngineOptions {
  readonly construct: Construct;
  readonly agent: QLearningAgent;
  readonly rng: Rng;
  /** Starting position (defaults to the Construct's start cell). */
  readonly position?: GridPosition;
  /** Starting goal (defaults to the Construct's initial goal). */
  readonly goal?: GridPosition;
  /** Restored tick count (defaults to 0). Used to rehydrate on boot. */
  readonly tickCount?: number;
  /** Restored checkpoint index for a circuit (defaults to 0). */
  readonly checkpointIndex?: number;
  /** Goal-relocation strategy for a maze (defaults to a random open cell). */
  readonly relocateGoal?: RelocateGoal;
}

/**
 * Drives one Sim through one Construct as a continuing task: choose an action,
 * apply it, learn from it, and — on reaching the goal — relocate the goal and
 * keep going. There is no terminal state and nothing here ever resets the
 * agent's learned Q-values (see CLAUDE.md constraints 7 and 1). This is the
 * unit the always-on simulation host ticks on its fixed clock.
 */
export class SimEngine {
  private readonly constructRef: Construct;
  private readonly agentRef: QLearningAgent;
  private readonly rng: Rng;
  private readonly relocateGoalFn: RelocateGoal;

  private currentPosition: GridPosition;
  private currentGoal: GridPosition;
  private ticks: number;
  private checkpoint: number;

  constructor(options: SimEngineOptions) {
    this.constructRef = options.construct;
    this.agentRef = options.agent;
    this.rng = options.rng;
    this.relocateGoalFn = options.relocateGoal ?? randomOpenCell;
    this.currentPosition = options.position ?? options.construct.start;
    this.ticks = options.tickCount ?? 0;
    this.checkpoint = options.checkpointIndex ?? 0;
    const checkpoints = options.construct.checkpoints;
    this.currentGoal =
      options.goal ??
      (checkpoints.length > 0
        ? checkpoints[this.checkpoint % checkpoints.length]!
        : options.construct.goal);
  }

  /** The Construct the Sim is currently running (immutable geometry). */
  get construct(): Construct {
    return this.constructRef;
  }

  get constructId(): string {
    return this.constructRef.id;
  }

  get position(): GridPosition {
    return this.currentPosition;
  }

  get goal(): GridPosition {
    return this.currentGoal;
  }

  get tickCount(): number {
    return this.ticks;
  }

  /** Which checkpoint the Sim is currently seeking (0 for a maze). */
  get checkpointIndex(): number {
    return this.checkpoint;
  }

  /** The learning agent, exposed so the host can persist it. Never replaced. */
  get agent(): QLearningAgent {
    return this.agentRef;
  }

  /**
   * Relocate the Sim to an open cell (an Observer "Intervene"). Changes only its
   * position — never its learned Q-values and never the tick count. Returns
   * false (and does nothing) if the target isn't an open cell.
   */
  intervene(position: GridPosition): boolean {
    if (!this.constructRef.isOpen(position)) return false;
    this.currentPosition = position;
    return true;
  }

  /**
   * Advance the simulation by one decision step.
   *
   * `bonusReward` (default 0) is a one-off manual reward folded into this tick's
   * Q-update — this is how Observer "Providence" shapes the policy. It affects
   * learning only; the returned record's `reward` remains the environment reward.
   */
  tick(options: { bonusReward?: number } = {}): TickRecord {
    const bonusReward = options.bonusReward ?? 0;
    const from = this.currentPosition;
    const stateKey = positionKey(from);
    const action = this.agentRef.chooseAction(stateKey, this.rng);
    const outcome = step(this.constructRef, from, action, this.currentGoal);

    this.agentRef.update(
      stateKey,
      action,
      outcome.reward + bonusReward,
      positionKey(outcome.nextPosition),
    );
    this.currentPosition = outcome.nextPosition;

    let goalRelocated = false;
    if (outcome.reachedGoal) {
      const checkpoints = this.constructRef.checkpoints;
      if (checkpoints.length > 0) {
        // Circuit: advance to the next checkpoint in order, wrapping into a new
        // lap (no completion state — it just keeps going around).
        this.checkpoint = (this.checkpoint + 1) % checkpoints.length;
        this.currentGoal = checkpoints[this.checkpoint]!;
      } else {
        // Maze: the single goal relocates to a new open cell.
        this.currentGoal = this.relocateGoalFn(
          this.constructRef,
          this.currentGoal,
          this.currentPosition,
          this.rng,
        );
      }
      goalRelocated = true;
    }

    this.agentRef.decayEpsilon();
    this.ticks += 1;

    return {
      tick: this.ticks,
      action,
      from,
      to: this.currentPosition,
      reward: outcome.reward,
      hitWall: outcome.hitWall,
      reachedGoal: outcome.reachedGoal,
      goalRelocated,
    };
  }
}

/** Default relocation: a random open cell that is neither the Sim's cell nor the old goal. */
const randomOpenCell: RelocateGoal = (construct, currentGoal, simPosition, rng) => {
  const oldKey = positionKey(currentGoal);
  const simKey = positionKey(simPosition);
  const candidates = construct
    .openCells()
    .filter((cell) => positionKey(cell) !== oldKey && positionKey(cell) !== simKey);
  if (candidates.length === 0) return currentGoal; // degenerate Construct; keep the goal put
  return candidates[Math.floor(rng() * candidates.length)]!;
};
