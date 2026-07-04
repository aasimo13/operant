import { WEAR } from './config';

/**
 * The Sim's accumulated wear, stored structurally SEPARATE from its Q-values
 * (CLAUDE.md). This is presentation state — it maps to jitter and hesitation in
 * the client — and never feeds back into learning. `totalNegativeWeight` is a
 * permanent scar that only ever grows (consistent with the no-erase principle);
 * `recentStrain` is a reactive flinch that decays on its own.
 */
export interface WearState {
  readonly totalNegativeWeight: number;
  readonly recentStrain: number;
}

/** Which negative/positive things happened to the Sim on one tick. */
export interface WearEvents {
  readonly hitWall: boolean;
  readonly intervened: boolean;
  readonly providence: 'reward' | 'punish' | null;
}

export function initialWearState(): WearState {
  return { totalNegativeWeight: 0, recentStrain: 0 };
}

/** Per-tick decay factor for recent strain, from its real-time half-life. */
export function strainDecayPerTick(tickMs: number): number {
  return Math.pow(0.5, tickMs / WEAR.strainHalfLifeMs);
}

/**
 * Advance wear by one tick: accumulate this tick's negative weight into the
 * permanent total and the decaying recent strain; a positive Providence applies
 * a one-time relief multiplier to strain (never touching the permanent total).
 */
export function advanceWear(prev: WearState, events: WearEvents, decayPerTick: number): WearState {
  let negative = 0;
  if (events.hitWall) negative += WEAR.weights.wallBump;
  if (events.intervened) negative += WEAR.weights.relocation;
  if (events.providence === 'punish') negative += WEAR.weights.punishment;

  const totalNegativeWeight = prev.totalNegativeWeight + negative;
  let recentStrain = prev.recentStrain * decayPerTick + negative;
  if (events.providence === 'reward') recentStrain *= WEAR.reliefFactor;

  return { totalNegativeWeight, recentStrain };
}

export interface WearBreakdown {
  readonly baselineWear: number;
  readonly recentStrain: number;
  /** The combined 0–1 scalar the client maps to jitter/hesitation. */
  readonly wear: number;
}

/**
 * The combined wear scalar plus its parts (the parts feed the dev-only debug
 * readout). `wear = clamp(w1·baselineWear + w2·recentStrain, 0, 1)`.
 */
export function wearBreakdown(state: WearState): WearBreakdown {
  const baselineWear = 1 - Math.exp(-state.totalNegativeWeight / WEAR.K);
  const combined = WEAR.baselineWeight * baselineWear + WEAR.strainWeight * state.recentStrain;
  return {
    baselineWear,
    recentStrain: state.recentStrain,
    wear: Math.max(0, Math.min(1, combined)),
  };
}
