import { describe, expect, it } from 'vitest';
import { createRng } from '@operant/core';
import { CannedNarrationSource } from './cannedSource';
import type { NarrationTrigger } from './triggers';

const TRIGGERS: NarrationTrigger[] = ['wallBump', 'goal', 'reward', 'punish', 'intervene', 'idle'];

describe('CannedNarrationSource', () => {
  it('has an in-voice line for every trigger', async () => {
    const source = new CannedNarrationSource(createRng(1));
    for (const trigger of TRIGGERS) {
      const line = await source.generate({ trigger, tick: 1, position: { x: 0, y: 0 } });
      expect(line).toBeTruthy();
      expect(line!.length).toBeGreaterThan(0);
    }
  });

  it('is deterministic under a seeded rng', async () => {
    const a = new CannedNarrationSource(createRng(7));
    const b = new CannedNarrationSource(createRng(7));
    const ctx = { trigger: 'wallBump' as const, tick: 1, position: { x: 0, y: 0 } };
    expect(await a.generate(ctx)).toBe(await b.generate(ctx));
  });
});
