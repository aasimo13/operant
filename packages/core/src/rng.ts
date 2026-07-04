/**
 * A random source: returns a float in [0, 1), like `Math.random`.
 *
 * The RL core takes its randomness through this interface so exploration and
 * goal relocation are deterministic under test (seeded) while still using
 * `Math.random` in production.
 */
export type Rng = () => number;

/**
 * Seeded PRNG (mulberry32) — small, fast, and good enough for exploration
 * noise. Deterministic: the same seed always produces the same sequence.
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
