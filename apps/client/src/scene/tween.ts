import type { GridPosition } from '@operant/core';

/** A continuous 2D point (fractional grid coordinates during a tween). */
export interface Point2 {
  readonly x: number;
  readonly y: number;
}

/**
 * Linearly interpolate between two grid cells. `t` is the fraction through the
 * current decision tick, clamped to [0,1] so a late render frame never
 * overshoots. A wall bump (from == to) simply holds position.
 *
 * Intervene needs no special case here: it changes which cells `from`/`to` are,
 * so the next tick's tween simply starts from the new drop cell — an instant
 * jump rather than a slide (see CLAUDE.md: an Intervene snaps, never tweens).
 */
export function lerpPosition(from: GridPosition, to: GridPosition, t: number): Point2 {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return {
    x: from.x + (to.x - from.x) * clamped,
    y: from.y + (to.y - from.y) * clamped,
  };
}
