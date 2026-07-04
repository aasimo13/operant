/** What occasioned a potential narration on a given tick. */
export type NarrationTrigger = 'intervene' | 'goal' | 'punish' | 'reward' | 'wallBump' | 'idle';

/** What happened to the Sim on one tick, from the narrator's point of view. */
export interface TickSituation {
  readonly hitWall: boolean;
  readonly reachedGoal: boolean;
  readonly intervened: boolean;
  readonly providence: 'reward' | 'punish' | null;
}

/**
 * Decide what, if anything, the narrator should react to this tick. Notable
 * events win by significance; failing those, an idle musing fires once enough
 * quiet ticks have passed so the transcript never goes silent for long (see
 * CLAUDE.md — narrator cadence). Returns null when nothing warrants a line.
 */
export function selectTrigger(
  situation: TickSituation,
  ticksSinceLast: number,
  fallbackTicks: number,
): NarrationTrigger | null {
  if (situation.intervened) return 'intervene';
  if (situation.reachedGoal) return 'goal';
  if (situation.providence === 'punish') return 'punish';
  if (situation.providence === 'reward') return 'reward';
  if (situation.hitWall) return 'wallBump';
  if (ticksSinceLast >= fallbackTicks) return 'idle';
  return null;
}
