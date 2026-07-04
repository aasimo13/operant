import type { Rng } from '@operant/core';
import type { NarrationSource } from './source';
import { CannedNarrationSource } from './cannedSource';
import { OpenAiNarrationSource } from './openAiSource';

/**
 * Choose a narration source from the environment: live OpenAI narration when
 * OPENAI_API_KEY is set, otherwise the scripted canned lines. This is the single
 * seam that takes the narrator live — no other code changes when a key appears.
 */
export function createNarrationSource(
  env: NodeJS.ProcessEnv = process.env,
  rng: Rng = Math.random,
): NarrationSource {
  const key = env.OPENAI_API_KEY;
  if (key && key.trim() !== '') {
    return new OpenAiNarrationSource(key);
  }
  return new CannedNarrationSource(rng);
}
