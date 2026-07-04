import { RL_DEFAULTS } from './config';
import { ACTIONS, type Action } from './grid';
import type { Rng } from './rng';

/** Serializable snapshot of an agent's learned state, for persistence. */
export interface QLearningAgentSnapshot {
  /** Q-table: state key → one value per action, in ACTIONS order. */
  readonly qTable: Record<string, number[]>;
  readonly epsilon: number;
  readonly alpha: number;
  readonly gamma: number;
  readonly epsilonFloor: number;
  readonly epsilonDecay: number;
}

export interface QLearningAgentOptions {
  readonly alpha?: number;
  readonly gamma?: number;
  readonly epsilon?: number;
  readonly epsilonFloor?: number;
  readonly epsilonDecay?: number;
}

const ACTION_COUNT = ACTIONS.length;

/**
 * Tabular Q-learning for a continuing task (no terminal states, no episodes —
 * see CLAUDE.md constraint 11). Every update bootstraps off the next state; the
 * loop never resets.
 *
 * NO METHOD EVER CLEARS OR ROLLS BACK THE Q-TABLE. This is the single most
 * important project constraint (no reset, ever): the Sim's learned state only
 * accumulates. Do not add a reset/clear method here for any reason.
 */
export class QLearningAgent {
  private readonly qTable = new Map<string, number[]>();
  private readonly alpha: number;
  private readonly gamma: number;
  private readonly epsilonFloor: number;
  private readonly epsilonDecay: number;
  private currentEpsilon: number;

  constructor(options: QLearningAgentOptions = {}) {
    this.alpha = options.alpha ?? RL_DEFAULTS.alpha;
    this.gamma = options.gamma ?? RL_DEFAULTS.gamma;
    this.epsilonFloor = options.epsilonFloor ?? RL_DEFAULTS.epsilonFloor;
    this.epsilonDecay = options.epsilonDecay ?? RL_DEFAULTS.epsilonDecay;
    this.currentEpsilon = options.epsilon ?? RL_DEFAULTS.epsilonStart;
  }

  /** Current exploration rate. */
  get epsilon(): number {
    return this.currentEpsilon;
  }

  /** Q-values for a state (zeros if never visited). Read-only view. */
  getQValues(stateKey: string): readonly number[] {
    return this.rowFor(stateKey);
  }

  /**
   * Epsilon-greedy action choice: explore with probability epsilon, otherwise
   * exploit the best known action (ties broken randomly, so equal-value states
   * — common early on — don't bias movement in one direction).
   */
  chooseAction(stateKey: string, rng: Rng): Action {
    if (rng() < this.currentEpsilon) {
      return ACTIONS[Math.floor(rng() * ACTION_COUNT)]!;
    }
    return ACTIONS[this.argmax(stateKey, rng)]!;
  }

  /** The purely greedy action (no exploration); deterministic tie-break. */
  greedyAction(stateKey: string): Action {
    return ACTIONS[this.argmax(stateKey)]!;
  }

  /**
   * Temporal-difference update:
   *   Q(s,a) ← Q(s,a) + α · (r + γ · maxₐ' Q(s',a') − Q(s,a))
   * Always bootstraps — there is no terminal case to special-case.
   */
  update(stateKey: string, action: Action, reward: number, nextStateKey: string): void {
    const actionIndex = ACTIONS.indexOf(action);
    const row = this.rowFor(stateKey);
    const nextRow = this.rowFor(nextStateKey);
    const bestNext = Math.max(...nextRow);
    const current = row[actionIndex]!;
    row[actionIndex] = current + this.alpha * (reward + this.gamma * bestNext - current);
  }

  /** Decay epsilon one step toward the floor (never below it). */
  decayEpsilon(): void {
    this.currentEpsilon = Math.max(this.epsilonFloor, this.currentEpsilon * this.epsilonDecay);
  }

  /** Plain, JSON-safe snapshot for persistence. */
  serialize(): QLearningAgentSnapshot {
    const qTable: Record<string, number[]> = {};
    for (const [key, row] of this.qTable) {
      qTable[key] = [...row];
    }
    return {
      qTable,
      epsilon: this.currentEpsilon,
      alpha: this.alpha,
      gamma: this.gamma,
      epsilonFloor: this.epsilonFloor,
      epsilonDecay: this.epsilonDecay,
    };
  }

  /** Rehydrate an agent from a snapshot (used on crash/restart recovery). */
  static deserialize(snapshot: QLearningAgentSnapshot): QLearningAgent {
    const agent = new QLearningAgent({
      alpha: snapshot.alpha,
      gamma: snapshot.gamma,
      epsilon: snapshot.epsilon,
      epsilonFloor: snapshot.epsilonFloor,
      epsilonDecay: snapshot.epsilonDecay,
    });
    for (const [key, row] of Object.entries(snapshot.qTable)) {
      agent.qTable.set(key, [...row]);
    }
    return agent;
  }

  private rowFor(stateKey: string): number[] {
    let row = this.qTable.get(stateKey);
    if (!row) {
      row = new Array(ACTION_COUNT).fill(0) as number[];
      this.qTable.set(stateKey, row);
    }
    return row;
  }

  /** Index of the highest-value action; ties broken randomly if an rng is given. */
  private argmax(stateKey: string, rng?: Rng): number {
    const row = this.rowFor(stateKey);
    let best = row[0]!;
    let ties = [0];
    for (let i = 1; i < row.length; i++) {
      const v = row[i]!;
      if (v > best) {
        best = v;
        ties = [i];
      } else if (v === best) {
        ties.push(i);
      }
    }
    if (rng && ties.length > 1) {
      return ties[Math.floor(rng() * ties.length)]!;
    }
    return ties[0]!;
  }
}
