import type { GridPosition } from '@operant/core';
import type { NarrationTrigger } from './triggers';

/** What the narrator knows when composing a line. */
export interface NarrationContext {
  readonly trigger: NarrationTrigger;
  readonly tick: number;
  readonly position: GridPosition;
  /** A qualitative memory of the Sim's life it may draw on (may be empty). */
  readonly memory?: string;
}

/**
 * A source of narration lines. Abstracted so the canned/scripted source and the
 * (later) OpenAI source are interchangeable and independently mockable — this is
 * the seam that keeps RL and narration decoupled at the code level. Returns null
 * to say nothing this time (e.g. an LLM failure degrading gracefully).
 */
export interface NarrationSource {
  generate(context: NarrationContext): Promise<string | null>;
}
