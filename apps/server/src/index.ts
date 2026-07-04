import { loadConfig } from './config';
import { createSimHostServer } from './server';

/**
 * Entry point for the always-on simulation host.
 *
 * At this scaffold stage it only starts the HTTP server (health endpoint). The
 * Sim itself — the continuously-ticking Q-learning loop that runs whether or
 * not anyone is connected — is wired in at build-order step 4, on top of the
 * persistence layer from step 3.
 */
function main(): void {
  const config = loadConfig();
  const server = createSimHostServer();

  server.listen(config.port, () => {
    console.log(`[operant] simulation host listening on :${config.port} (tick ${config.tickMs}ms)`);
  });
}

main();
