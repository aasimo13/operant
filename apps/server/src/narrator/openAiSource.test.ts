import { describe, expect, it } from 'vitest';
import { buildNarrationPrompt, NARRATION_MODEL } from './openAiSource';
import { createNarrationSource } from './narrationFactory';
import { CannedNarrationSource } from './cannedSource';
import { OpenAiNarrationSource } from './openAiSource';

describe('buildNarrationPrompt', () => {
  it('instructs the in-voice constraints and includes the trigger', () => {
    const { messages } = buildNarrationPrompt({
      trigger: 'wallBump',
      tick: 42,
      position: { x: 3, y: 4 },
    });
    const system = messages.find((m) => m.role === 'system')!.content.toLowerCase();
    const user = messages.find((m) => m.role === 'user')!.content;

    expect(system).toContain('first person');
    // Never reveal that it is an AI or in a simulation (dramatic irony).
    expect(system).toMatch(/simulation|a\.?i\.?/);
    expect(user).toContain('wallBump');
  });

  it('targets the configured nano model', () => {
    expect(NARRATION_MODEL).toBe('gpt-4.1-nano');
  });
});

describe('createNarrationSource', () => {
  it('uses the OpenAI source when a key is present', () => {
    expect(createNarrationSource({ OPENAI_API_KEY: 'sk-test' })).toBeInstanceOf(
      OpenAiNarrationSource,
    );
  });

  it('falls back to canned lines when no key is set', () => {
    expect(createNarrationSource({})).toBeInstanceOf(CannedNarrationSource);
    expect(createNarrationSource({ OPENAI_API_KEY: '' })).toBeInstanceOf(CannedNarrationSource);
  });
});
