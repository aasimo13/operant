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
  const host = await createSimHost({ store, rng: Math.random, tickMs: config.tickMs });

  const httpServer = createSimHostServer();
  attachWsServer({ server: httpServer, host });

  httpServer.listen(config.port, () => {
    console.log(`[operant] simulation host listening on :${config.port} (tick ${config.tickMs}ms)`);
  });

  host.start(config.tickMs);

  // Log-compaction: the Sim writes a transcript line whenever it speaks, forever.
  // Periodically fold the older lines into per-epoch aggregates so the raw table
  // stays bounded without ever erasing the past (constraint 15).
  const COMPACT_INTERVAL_MS = 30 * 60 * 1000; // every 30 minutes
  const compactTimer = setInterval(() => {
    void store
      .compactTranscript({ retainRaw: 2000, epochSize: 500 })
      .then((r) => {
        if (r.linesCompacted > 0) {
          console.log(
            `[operant] compacted ${r.linesCompacted} transcript lines into ${r.epochsCreated} epoch(s)`,
          );
        }
      })
      .catch((error: unknown) => console.error('[operant] transcript compaction failed:', error));
  }, COMPACT_INTERVAL_MS);
  compactTimer.unref?.(); // never keep the process alive just for compaction

  const shutdown = (signal: string) => {
    console.log(`[operant] ${signal} received — stopping the Sim's clock and closing cleanly.`);
    host.stop();
    clearInterval(compactTimer);
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
