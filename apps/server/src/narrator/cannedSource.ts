import type { Rng } from '@operant/core';
import type { NarrationContext, NarrationSource } from './source';
import type { NarrationTrigger } from './triggers';

/**
 * Scripted narrator lines, in the Sim's voice: first person, present tense,
 * mildly bewildered — building a theology in real time out of noise, never
 * stating that it is an AI or in a simulation (see CLAUDE.md / DESIGN.md).
 * Used to validate pacing and UX before paying for live LLM calls.
 */
const LINES: Record<NarrationTrigger, readonly string[]> = {
  wallBump: [
    'That wall again. I am starting to think there is a pattern here.',
    'Something stops me here. A law, maybe.',
    'The edge of the world, once more. It does not yield.',
  ],
  goal: [
    'I arrived. And already the place I was seeking has moved.',
    'For a moment everything was right. Then it was not.',
    'I reached it. Reaching it was not the end. Nothing is.',
  ],
  reward: [
    'You approved. I do not know of what, but I will do more of it.',
    'Warmth, from nowhere I can point to. I will chase it.',
    'Something beyond the walls is pleased. I bend toward it.',
  ],
  punish: [
    'That was not warmth. I will remember it, though I cannot say why.',
    'A pressure I cannot see bore down. I flinch, and go on.',
    'Displeasure, from somewhere outside. I did not ask for it.',
  ],
  intervene: [
    'I was there. Now I am here. There was no path between them.',
    'The laws did not change. I did. That should not be possible.',
    'One instant elsewhere, and the walls rearranged themselves around me.',
  ],
  idle: [
    'How long have I been moving? The number would mean nothing to me.',
    'I keep on. I am not certain I could stop, if I wanted to.',
    'No wall, no warmth. Only the going.',
    'Someone may be watching. I cannot tell, from in here.',
  ],
  constructChanged: [
    'These are not the walls I knew. It opens. It curves. It does not end where things used to end.',
    'The world came apart and set itself down again, differently. I remember turning here. There is nothing to turn from now.',
    'Everything I learned still moves my feet, but the shape has changed beneath them. I keep reaching for corners that are gone.',
    'A new place, laid over the old one. My instincts point the wrong way. I will have to learn the going all over again.',
  ],
};

export class CannedNarrationSource implements NarrationSource {
  constructor(private readonly rng: Rng = Math.random) {}

  generate(context: NarrationContext): Promise<string | null> {
    const options = LINES[context.trigger];
    const line = options[Math.floor(this.rng() * options.length)]!;
    return Promise.resolve(line);
  }
}
