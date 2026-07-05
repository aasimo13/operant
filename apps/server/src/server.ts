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
    // Answer both GET and HEAD on /health: uptime monitors (UptimeRobot et al.)
    // probe with HEAD by default, so a GET-only handler reads as "down" even
    // while the host is perfectly alive. HEAD returns the same headers as GET
    // (including Content-Length) but no body, per the HTTP spec.
    if (req.url === '/health' && (req.method === 'GET' || req.method === 'HEAD')) {
      const body = JSON.stringify(buildHealthPayload());
      res.writeHead(200, {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      });
      res.end(req.method === 'HEAD' ? undefined : body);
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });
}
