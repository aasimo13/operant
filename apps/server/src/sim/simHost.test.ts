import { describe, expect, it, vi } from 'vitest';
import {
  SimEngine,
  QLearningAgent,
  FIRST_CONSTRUCT,
  createRng,
  positionKey,
  ACTIONS,
} from '@operant/core';
import { SimHost, createSimHost } from './simHost';
import type { SimStore } from '../persistence/simStore';
import { initialSimState } from '../persistence/simStore';
import type { PersistedSimState } from '../persistence/types';
import type { TickMessage } from '../net/protocol';

function fakeStore(
  seed: PersistedSimState | null = null,
): SimStore & { saved: PersistedSimState | null } {
  let saved = seed;
  return {
    get saved() {
      return saved;
    },
    init: vi.fn(async () => {}),
    loadSim: vi.fn(async () => saved),
    saveSim: vi.fn(async (s: PersistedSimState) => {
      saved = s;
    }),
    close: vi.fn(async () => {}),
  };
}

function makeHost(rngSeed = 1, position = FIRST_CONSTRUCT.start) {
  const engine = new SimEngine({
    construct: FIRST_CONSTRUCT,
    agent: new QLearningAgent({ epsilon: 0 }),
    rng: createRng(rngSeed),
    position,
  });
  const store = fakeStore();
  const host = new SimHost({ engine, store, recentLimit: 3 });
  return { engine, store, host };
}

describe('SimHost.tick', () => {
  it('persists a snapshot of the Sim after every tick', async () => {
    const { host, store, engine } = makeHost();
    await host.tick();
    expect(store.saveSim).toHaveBeenCalledOnce();
    expect(store.saved?.tickCount).toBe(engine.tickCount);
    expect(store.saved?.position).toEqual(engine.position);
    expect(store.saved?.agent.qTable).not.toEqual({}); // it learned this tick
  });

  it('broadcasts a tick message to subscribers, and stops after unsubscribe', async () => {
    const { host } = makeHost();
    const received: TickMessage[] = [];
    const unsubscribe = host.subscribe((m) => received.push(m));

    const record = await host.tick();
    expect(received).toHaveLength(1);
    expect(received[0]!.type).toBe('tick');
    expect(received[0]!.record).toEqual(record);

    unsubscribe();
    await host.tick();
    expect(received).toHaveLength(1); // no more after unsubscribe
  });
});

describe('SimHost input application', () => {
  it('applies a queued Intervene before the decision, relocating the Sim', async () => {
    const { host } = makeHost();
    const target = { x: 0, y: 5 }; // an open cell in column 0
    host.enqueueInput({ type: 'intervene', position: target });

    const record = await host.tick();
    expect(record.from).toEqual(target); // the Sim decided from where it was dropped
  });

  it('maps Providence reward/punish to a positive/negative learning nudge', async () => {
    const startKey = positionKey(FIRST_CONSTRUCT.start);
    const q = async (input?: 'reward' | 'punish') => {
      const { host, engine } = makeHost(7);
      if (input) host.enqueueInput({ type: 'providence', kind: input });
      const record = await host.tick();
      return engine.agent.getQValues(startKey)[ACTIONS.indexOf(record.action)]!;
    };

    const [none, reward, punish] = [await q(), await q('reward'), await q('punish')];
    expect(reward).toBeGreaterThan(none);
    expect(punish).toBeLessThan(none);
  });
});

describe('SimHost recent backfill and welcome', () => {
  it('keeps only a bounded window of recent records (newest last)', async () => {
    const { host } = makeHost();
    const records = [];
    for (let i = 0; i < 5; i++) records.push(await host.tick());
    const recent = host.recent();
    expect(recent).toHaveLength(3); // recentLimit
    expect(recent).toEqual(records.slice(-3));
  });

  it('builds a welcome payload with construct, current state, and recent backfill', async () => {
    const { host } = makeHost();
    await host.tick();
    const welcome = host.welcomeFor();
    expect(welcome.type).toBe('welcome');
    expect(welcome.construct.id).toBe(FIRST_CONSTRUCT.id);
    expect(welcome.state.tickCount).toBe(1);
    expect(welcome.recent).toHaveLength(1);
  });

  it('builds a heatmap sized to the Construct', async () => {
    const { host } = makeHost();
    await host.tick();
    const heatmap = host.heatmap();
    expect(heatmap.type).toBe('heatmap');
    expect(heatmap.values).toHaveLength(FIRST_CONSTRUCT.height);
    expect(heatmap.values[0]).toHaveLength(FIRST_CONSTRUCT.width);
  });
});

describe('createSimHost (boot / rehydration)', () => {
  it('initializes a fresh Sim when storage is empty', async () => {
    const store = fakeStore(null);
    const host = await createSimHost({ store, rng: createRng(1) });
    expect(host.welcomeFor().state.tickCount).toBe(0);
    expect(store.saveSim).toHaveBeenCalledOnce(); // persisted the newborn
  });

  it('rehydrates an existing Sim exactly, never reinitializing it (constraints 1 & 2)', async () => {
    const lived: PersistedSimState = {
      ...initialSimState(FIRST_CONSTRUCT),
      tickCount: 9000,
      position: { x: 0, y: 5 },
      agent: { ...initialSimState(FIRST_CONSTRUCT).agent, qTable: { '0,5': [1, 2, 3, 4] } },
    };
    const store = fakeStore(lived);

    const host = await createSimHost({ store, rng: createRng(1) });

    const welcome = host.welcomeFor();
    expect(welcome.state.tickCount).toBe(9000);
    expect(welcome.state.position).toEqual({ x: 0, y: 5 });
    expect(store.saveSim).not.toHaveBeenCalled(); // nothing overwritten on boot
  });
});
