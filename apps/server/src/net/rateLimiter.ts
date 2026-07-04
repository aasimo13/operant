/**
 * A minimal per-connection rate limiter. One instance per WebSocket connection
 * throttles that Observer's Providence/Intervene inputs so a single visitor
 * can't spam the Sim's permanent record (CLAUDE.md constraint 12).
 *
 * The clock is injectable for deterministic tests.
 */
export class RateLimiter {
  private lastAllowedAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly minIntervalMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** True if an action is permitted now; records the time when it is. */
  allow(): boolean {
    const t = this.now();
    if (t - this.lastAllowedAt < this.minIntervalMs) return false;
    this.lastAllowedAt = t;
    return true;
  }
}
