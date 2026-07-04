import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';
import { SimEngine, QLearningAgent, FIRST_CONSTRUCT, createRng } from '@operant/core';
import { attachWsServer } from './wsServer';
import { SimHost } from '../sim/simHost';
import type { ServerMessage } from './protocol';
import { createFakeStore as fakeStore } from '../test/fakeStore';

/** Collect incoming messages and hand them out one at a time as they arrive. */
function messageStream(socket: WebSocket) {
  const buffer: ServerMessage[] = [];
  let resolveNext: ((m: ServerMessage) => void) | null = null;
  socket.on('message', (data) => {
    const msg = JSON.parse(data.toString()) as ServerMessage;
    if (resolveNext) {
      resolveNext(msg);
      resolveNext = null;
    } else {
      buffer.push(msg);
    }
  });
  return () =>
    new Promise<ServerMessage>((resolve) => {
      const queued = buffer.shift();
      if (queued) resolve(queued);
      else resolveNext = resolve;
    });
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('attachWsServer (integration)', () => {
  let httpServer: Server;
  let host: SimHost;
  let url: string;

  beforeAll(async () => {
    const engine = new SimEngine({
      construct: FIRST_CONSTRUCT,
      agent: new QLearningAgent({ epsilon: 0 }),
      rng: createRng(1),
    });
    host = new SimHost({
      engine,
      store: fakeStore(),
      narrationSource: { generate: async () => null },
    });
    httpServer = createServer();
    attachWsServer({ server: httpServer, host });
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    url = `ws://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    host.stop();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it('sends a welcome snapshot on connect, then streams ticks', async () => {
    const client = new WebSocket(url);
    const next = messageStream(client);
    await new Promise((resolve) => client.on('open', resolve));

    const welcome = await next();
    expect(welcome.type).toBe('welcome');

    await host.tick();
    const tick = await next();
    expect(tick.type).toBe('tick');

    client.close();
  });

  it('applies a client Intervene through the full socket round-trip', async () => {
    const client = new WebSocket(url);
    const next = messageStream(client);
    await new Promise((resolve) => client.on('open', resolve));
    await next(); // welcome

    client.send(JSON.stringify({ type: 'intervene', position: { x: 0, y: 5 } }));
    await delay(50); // let the server receive + enqueue

    await host.tick();
    const tick = await next();
    expect(tick.type).toBe('tick');
    if (tick.type === 'tick') {
      expect(tick.record.from).toEqual({ x: 0, y: 5 }); // the Sim decided from where it was dropped
    }
    client.close();
  });

  it('answers a heatmap request with a heatmap message', async () => {
    const client = new WebSocket(url);
    const next = messageStream(client);
    await new Promise((resolve) => client.on('open', resolve));
    await next(); // welcome

    client.send(JSON.stringify({ type: 'requestHeatmap' }));
    const reply = await next();
    expect(reply.type).toBe('heatmap');
    if (reply.type === 'heatmap') {
      expect(reply.values.length).toBeGreaterThan(0);
    }
    client.close();
  });

  it('ignores malformed client frames without crashing', async () => {
    const client = new WebSocket(url);
    const next = messageStream(client);
    await new Promise((resolve) => client.on('open', resolve));
    await next(); // welcome

    client.send('garbage, not json');
    await delay(30);

    await host.tick();
    const tick = await next();
    expect(tick.type).toBe('tick'); // still alive and ticking
    client.close();
  });
});
