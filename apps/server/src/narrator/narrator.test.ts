import { describe, expect, it, vi } from 'vitest';
import type { NarrationLine } from '@operant/core';
import { Narrator } from './narrator';
import type { NarrationSource } from './source';

const at = (over: Partial<Parameters<Narrator['observe']>[0]> = {}) => ({
  tick: 1,
  position: { x: 0, y: 0 },
  hitWall: false,
  reachedGoal: false,
  intervened: false,
  providence: null,
  ...over,
});

function fixedSource(text: string | null): NarrationSource {
  return { generate: vi.fn(async () => text) };
}

describe('Narrator', () => {
  it('emits a line for a notable event (asynchronously, never blocking observe)', async () => {
    const lines: NarrationLine[] = [];
    let resolveDone: () => void;
    const done = new Promise<void>((r) => (resolveDone = r));
    const narrator = new Narrator({
      source: fixedSource('the wall again'),
      onLine: (l) => {
        lines.push(l);
        resolveDone();
      },
    });

    // observe returns synchronously — the line arrives later.
    expect(narrator.observe(at({ tick: 5, hitWall: true }))).toBeUndefined();
    expect(lines).toHaveLength(0);

    await done;
    expect(lines).toEqual([{ tick: 5, text: 'the wall again' }]);
  });

  it('does not start a second generation while one is in flight (busy guard)', async () => {
    let resolve: (v: string) => void = () => {};
    const generate = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    const narrator = new Narrator({ source: { generate }, onLine: () => {}, minGapTicks: 0 });

    narrator.observe(at({ hitWall: true }));
    narrator.observe(at({ reachedGoal: true })); // ignored — still busy
    expect(generate).toHaveBeenCalledTimes(1);

    resolve('done');
    await Promise.resolve();
  });

  it('survives a source failure without throwing, and can narrate again after', async () => {
    const failing: NarrationSource = { generate: vi.fn().mockRejectedValue(new Error('LLM down')) };
    const narrator = new Narrator({ source: failing, onLine: () => {}, minGapTicks: 0 });

    expect(() => narrator.observe(at({ hitWall: true }))).not.toThrow();
    await new Promise((r) => setTimeout(r, 0)); // flush the catch/finally chain

    // Not stuck busy: a later observe triggers another generation attempt.
    narrator.observe(at({ hitWall: true }));
    expect(failing.generate).toHaveBeenCalledTimes(2);
  });

  it('stays quiet for a cooldown after speaking, even on notable events', async () => {
    const generate = vi.fn(async () => 'a line');
    const narrator = new Narrator({ source: { generate }, onLine: () => {}, minGapTicks: 3 });

    narrator.observe(at({ hitWall: true })); // first line fires
    await new Promise((r) => setTimeout(r, 0));
    narrator.observe(at({ hitWall: true })); // 1 tick later — within cooldown, suppressed
    narrator.observe(at({ hitWall: true })); // 2 ticks — still suppressed
    expect(generate).toHaveBeenCalledTimes(1);

    narrator.observe(at({ hitWall: true })); // 3 ticks — cooldown elapsed, fires again
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('falls back to an idle musing only after enough quiet ticks', () => {
    const generate = vi.fn(async () => 'musing');
    const narrator = new Narrator({ source: { generate }, onLine: () => {}, fallbackTicks: 3 });

    narrator.observe(at()); // 1 quiet tick
    narrator.observe(at()); // 2
    expect(generate).not.toHaveBeenCalled();
    narrator.observe(at()); // 3 — fallback fires
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
