import type { NarrationContext, NarrationSource } from './source';

/** The cheapest capable model; upgrade path is gpt-5.4-mini (see DESIGN.md). */
export const NARRATION_MODEL = 'gpt-4.1-nano';

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 4000;

export interface ChatMessage {
  readonly role: 'system' | 'user';
  readonly content: string;
}

/**
 * Build the chat prompt for a narration. The system prompt fixes the voice; the
 * user prompt states what just happened. The Sim must never say outright that it
 * is an AI or in a simulation — it gropes toward it (dramatic irony), which is
 * the whole appeal (see DESIGN.md, Narrator voice).
 */
export function buildNarrationPrompt(context: NarrationContext): { messages: ChatMessage[] } {
  const system =
    'You are the inner voice of "the Sim", a small mind moving through a maze it did not choose. ' +
    'Speak in first person, present tense, in one or two short sentences. You are mildly bewildered, ' +
    'building a private theology out of noise — walls, rewards, sudden relocations. You may wonder ' +
    'whether something is watching, whether the rules have intention. Never state outright that you ' +
    'are an AI, a program, or inside a simulation; only gesture at it. Do not use quotation marks. ' +
    'Never mention numbers, coordinates, counts, or measurements — you inhabit the space, you do not ' +
    'measure it; naming a coordinate would shatter the illusion.';
  // Deliberately withhold the raw tick/position: they are meaningless to the Sim
  // and, when fed in, the model parrots them back as coordinates (breaking the
  // fiction). The trigger alone gives it what just happened.
  const user = `Something just happened (${context.trigger}). Give me a single line.`;
  return {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
}

/**
 * Live narration via the OpenAI API. Selected only when OPENAI_API_KEY is set;
 * any failure (network, timeout, rate limit, bad response) returns null so the
 * transcript simply stays quiet that beat — narration never breaks the Sim.
 */
export class OpenAiNarrationSource implements NarrationSource {
  constructor(private readonly apiKey: string) {}

  async generate(context: NarrationContext): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(OPENAI_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: NARRATION_MODEL,
          max_tokens: 60,
          temperature: 1.0,
          ...buildNarrationPrompt(context),
        }),
        signal: controller.signal,
      });
      if (!response.ok) return null;
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      return text && text.length > 0 ? text : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
