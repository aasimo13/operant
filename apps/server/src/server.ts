import { createServer, type Server } from 'node:http';
import { buildHealthPayload } from './health';

/**
 * Build the HTTP server for the simulation host.
 *
 * Right now this only serves `/health`. The continuous decision-tick loop, the
 * WebSocket live-state stream, per-connection rate limiting, and persistence
 * rehydration are later build-order steps (4 and 3) — deliberately not here.
 * Returned unstarted so tests can bind an ephemeral port and callers control
 * the lifecycle.
 */
export function createSimHostServer(): Server {
  return createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(buildHealthPayload()));
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });
}
