import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

// Load the repo-root .env for local dev (no-op in production, where Railway
// injects env vars directly). Must run before reading any config.
loadDotenv({ path: resolve(process.cwd(), '../../.env') });

import { loadConfig } from './config';
import { createSimHostServer } from './server';
import { PostgresSimStore } from './persistence/postgresSimStore';
import { postgresConfigFromEnv } from './persistence/postgresConfig';
import { createSimHost } from './sim/simHost';
import { attachWsServer } from './net/wsServer';

/**
 * Entry point for the always-on simulation host.
 *
 * Boots by rehydrating the one Sim from Postgres (never reinitializing existing
 * state), serves /health and the WebSocket live-state stream, and starts the
 * Sim ticking on its own fixed clock — so it runs whether or not anyone is
 * watching (CLAUDE.md constraints 7 & 8).
 */
async function main(): Promise<void> {
  const config = loadConfig();

  const store = new PostgresSimStore(postgresConfigFromEnv());
  await store.init();

  // Production randomness is genuinely random; determinism is only for tests.
  const host = await createSimHost({ store, rng: Math.random });

  const httpServer = createSimHostServer();
  attachWsServer({ server: httpServer, host });

  httpServer.listen(config.port, () => {
    console.log(`[operant] simulation host listening on :${config.port} (tick ${config.tickMs}ms)`);
  });

  host.start(config.tickMs);

  const shutdown = (signal: string) => {
    console.log(`[operant] ${signal} received — stopping the Sim's clock and closing cleanly.`);
    host.stop();
    httpServer.close();
    void store.close().finally(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  console.error('[operant] fatal startup error:', error);
  process.exit(1);
});
