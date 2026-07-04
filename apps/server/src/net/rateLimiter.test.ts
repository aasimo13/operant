import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rateLimiter';

describe('RateLimiter (per-connection input throttle)', () => {
  it('allows the first action immediately', () => {
    const limiter = new RateLimiter(1000, () => 0);
    expect(limiter.allow()).toBe(true);
  });

  it('blocks a second action within the interval', () => {
    let now = 0;
    const limiter = new RateLimiter(1000, () => now);
    expect(limiter.allow()).toBe(true);
    now = 999;
    expect(limiter.allow()).toBe(false);
  });

  it('allows again once the interval has fully elapsed', () => {
    let now = 0;
    const limiter = new RateLimiter(1000, () => now);
    expect(limiter.allow()).toBe(true);
    now = 1000;
    expect(limiter.allow()).toBe(true);
    now = 1500;
    expect(limiter.allow()).toBe(false);
    now = 2000;
    expect(limiter.allow()).toBe(true);
  });
});
