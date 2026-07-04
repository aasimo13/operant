/**
 * Simulation-host configuration, resolved once from the environment.
 *
 * Every tunable lives here as a named constant rather than a magic number
 * scattered through the code (see CLAUDE.md — "Keep all constants in one config
 * module"). Real values come from Railway env vars in production and `.env`
 * locally; see `.env.example` for the documented template.
 */

export interface SimHostConfig {
  /** Port the always-on host listens on. */
  readonly port: number;
  /**
   * Decision-tick interval in milliseconds — how often the Sim takes one
   * Q-learning step. Fixed, shared infrastructure; never a per-visitor control.
   * Design default is 1500ms (see CLAUDE.md — "Tick rate & timing model").
   */
  readonly tickMs: number;
}

const DEFAULTS = {
  port: 8787,
  tickMs: 1500,
} as const;

function readPositiveInt(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}: expected a positive integer, got "${raw}".`);
  }
  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): SimHostConfig {
  return {
    port: readPositiveInt(env, 'PORT', DEFAULTS.port),
    tickMs: readPositiveInt(env, 'SIM_TICK_MS', DEFAULTS.tickMs),
  };
}
