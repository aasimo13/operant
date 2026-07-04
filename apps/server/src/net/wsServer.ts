import { WebSocketServer, type WebSocket } from 'ws';
import type { Server } from 'node:http';
import { parseClientMessage, type ServerMessage } from './protocol';
import { RateLimiter } from './rateLimiter';
import type { SimHost } from '../sim/simHost';

/** Default per-connection input throttle: one action per second (constraint 12). */
const DEFAULT_INPUT_INTERVAL_MS = 1000;

export interface WsServerOptions {
  readonly server: Server;
  readonly host: SimHost;
  /** Minimum ms between accepted inputs per connection. */
  readonly inputIntervalMs?: number;
}

/**
 * Attach a WebSocket endpoint to an HTTP server, bridging Observers to the Sim.
 *
 * On connect a client gets the welcome snapshot and is subscribed to live tick
 * broadcasts. Inbound frames are validated and per-connection rate-limited
 * before being handed to the host as inputs — the client never drives the loop.
 */
export function attachWsServer(options: WsServerOptions): WebSocketServer {
  const intervalMs = options.inputIntervalMs ?? DEFAULT_INPUT_INTERVAL_MS;
  const wss = new WebSocketServer({ server: options.server });

  wss.on('connection', (socket) => {
    const limiter = new RateLimiter(intervalMs);

    send(socket, options.host.welcomeFor());
    const unsubscribe = options.host.subscribe((message) => send(socket, message));

    socket.on('message', (data) => {
      const input = parseClientMessage(data.toString());
      if (!input) return; // malformed — ignore
      if (!limiter.allow()) return; // rate-limited — drop, don't record
      options.host.enqueueInput(input);
    });

    socket.on('close', unsubscribe);
    socket.on('error', unsubscribe);
  });

  return wss;
}

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}
