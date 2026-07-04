import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('falls back to design defaults when env is empty', () => {
    expect(loadConfig({})).toEqual({ port: 8787, tickMs: 1500 });
  });

  it('reads positive integer overrides from the environment', () => {
    expect(loadConfig({ PORT: '3000', SIM_TICK_MS: '750' })).toEqual({
      port: 3000,
      tickMs: 750,
    });
  });

  it('rejects a non-positive tick interval', () => {
    expect(() => loadConfig({ SIM_TICK_MS: '0' })).toThrow(/SIM_TICK_MS/);
  });
});
