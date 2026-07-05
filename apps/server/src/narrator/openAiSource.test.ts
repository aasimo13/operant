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
    // Forbid numbers/coordinates in the voice, and never feed raw coords into
    // the prompt (the model would parrot them and break the fiction).
    expect(system).toMatch(/number|coordinate|measure/);
    expect(user).toContain('wallBump');
    expect(user).not.toContain('3');
    expect(user).not.toContain('42');
    expect(user).not.toMatch(/position|tick/i);
  });

  it('weaves in a memory when present, and omits the framing when absent', () => {
    const withMem = buildNarrationPrompt({
      trigger: 'idle',
      tick: 1,
      position: { x: 0, y: 0 },
      memory: 'What you carry: You have known more than one world.',
    });
    const u1 = withMem.messages.find((m) => m.role === 'user')!.content;
    expect(u1).toContain('You have known more than one world');
    expect(u1).toMatch(/only when it feels true/i);

    const without = buildNarrationPrompt({ trigger: 'idle', tick: 1, position: { x: 0, y: 0 } });
    const u2 = without.messages.find((m) => m.role === 'user')!.content;
    expect(u2).not.toMatch(/feels true/i);
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
