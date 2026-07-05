import type { GridPosition, NarrationLine } from '@operant/core';
import { selectTrigger, type NarrationTrigger, type TickSituation } from './triggers';
import type { NarrationSource } from './source';

/** Everything the narrator needs to react to one tick. */
export type NarrationInput = TickSituation & {
  readonly tick: number;
  readonly position: GridPosition;
};

export interface NarratorOptions {
  readonly source: NarrationSource;
  readonly onLine: (line: NarrationLine) => void;
  /** Ticks of quiet before an idle musing fires (~10–15). */
  readonly fallbackTicks?: number;
  /** Minimum ticks between lines, so the Sim doesn't narrate every wall bump. */
  readonly minGapTicks?: number;
}

const DEFAULT_FALLBACK_TICKS = 12;
// ~15s minimum between lines (at 1.5s/tick): the Sim speaks sparingly, so
// silences carry weight and it never chatters through every wall bump.
const DEFAULT_MIN_GAP_TICKS = 10;

/**
 * The Sim's voice. A logically separate, in-process side-channel that OBSERVES
 * the simulation and comments — it never influences behavior and, critically,
 * never blocks the tick (CLAUDE.md constraint 3). `observe` is synchronous and
 * fire-and-forget: it may kick off an async line, but the caller never awaits
 * it. A single line is composed at a time (busy guard), and any source failure
 * degrades silently so narration can never break the mechanic.
 */
export class Narrator {
  private readonly source: NarrationSource;
  private readonly onLine: (line: NarrationLine) => void;
  private readonly fallbackTicks: number;
  private readonly minGapTicks: number;

  private ticksSinceLast = 0;
  private hasNarrated = false;
  private busy = false;

  constructor(options: NarratorOptions) {
    this.source = options.source;
    this.onLine = options.onLine;
    this.fallbackTicks = options.fallbackTicks ?? DEFAULT_FALLBACK_TICKS;
    this.minGapTicks = options.minGapTicks ?? DEFAULT_MIN_GAP_TICKS;
  }

  /** React to one tick. Returns immediately; any line arrives later via onLine. */
  observe(input: NarrationInput): void {
    this.ticksSinceLast += 1;
    if (this.busy) return;
    // Cooldown: after a line, stay quiet for a few ticks so the Sim isn't
    // narrating every single wall bump. The very first line is exempt.
    if (this.hasNarrated && this.ticksSinceLast < this.minGapTicks) return;

    const trigger = selectTrigger(input, this.ticksSinceLast, this.fallbackTicks);
    if (!trigger) return;
    this.fire(trigger, input.tick, input.position);
  }

  /**
   * Force a narration for an out-of-band event (e.g. a Construct transition),
   * bypassing the cooldown — such moments are always worth a line. Still
   * respects the busy guard so it never overlaps an in-flight line.
   */
  announce(trigger: NarrationTrigger, tick: number, position: GridPosition): void {
    if (this.busy) return;
    this.fire(trigger, tick, position);
  }

  private fire(trigger: NarrationTrigger, tick: number, position: GridPosition): void {
    this.busy = true;
    this.hasNarrated = true;
    this.ticksSinceLast = 0;

    void this.source
      .generate({ trigger, tick, position })
      .then((text) => {
        if (text) this.onLine({ tick, text });
      })
      .catch(() => {
        // Graceful degradation: a narration failure never breaks the Sim.
      })
      .finally(() => {
        this.busy = false;
      });
  }
}
