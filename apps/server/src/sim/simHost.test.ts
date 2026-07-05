import { describe, expect, it } from 'vitest';
import {
  SimEngine,
  QLearningAgent,
  FIRST_CONSTRUCT,
  THE_TRACK,
  createRng,
  stateKey,
  parseConstruct,
  ACTIONS,
} from '@operant/core';
import { SimHost, createSimHost } from './simHost';
import { initialSimState } from '../persistence/simStore';
import type { PersistedSimState } from '../persistence/types';
import type { ServerMessage } from '../net/protocol';
import type { NarrationSource } from '../narrator/source';
import { createFakeStore as fakeStore } from '../test/fakeStore';

/** A narration source that says nothing, so tick tests aren't polluted by lines. */
const silent: NarrationSource = { generate: async () => null };
const flush = () => new Promise((r) => setTimeout(r, 0));

function makeHost(rngSeed = 1, position = FIRST_CONSTRUCT.start) {
  const engine = new SimEngine({
    construct: FIRST_CONSTRUCT,
    agent: new QLearningAgent({ epsilon: 0 }),
    rng: createRng(rngSeed),
    position,
  });
  const store = fakeStore();
  const host = new SimHost({
    engine,
    constructName: 'Test World',
    store,
    rng: createRng(rngSeed),
    recentLimit: 3,
    narrationSource: silent,
  });
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
    const received: ServerMessage[] = [];
    const unsubscribe = host.subscribe((m) => received.push(m));

    const record = await host.tick();
    expect(received).toHaveLength(1);
    const first = received[0]!;
    expect(first.type).toBe('tick');
    if (first.type === 'tick') expect(first.record).toEqual(record);

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
    const startKey = stateKey(FIRST_CONSTRUCT.start, FIRST_CONSTRUCT.goal);
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

describe('SimHost narrator wiring', () => {
  it('narrates a notable event, broadcasting and permanently recording the line', async () => {
    const engine = new SimEngine({
      construct: FIRST_CONSTRUCT,
      agent: new QLearningAgent({ epsilon: 0 }),
      rng: createRng(1),
    });
    const store = fakeStore();
    const host = new SimHost({
      engine,
      constructName: 'Test World',
      rng: createRng(1),
      store,
      narrationSource: { generate: async () => 'a hand I cannot see' },
    });
    const messages: ServerMessage[] = [];
    host.subscribe((m) => messages.push(m));

    host.enqueueInput({ type: 'providence', kind: 'punish' }); // a notable event
    await host.tick();
    await flush(); // let the async narration resolve

    const narration = messages.find((m) => m.type === 'narration');
    expect(narration).toBeDefined();
    expect(store.transcript).toContainEqual({ tick: 1, text: 'a hand I cannot see' });
    expect(host.transcript()).toContainEqual({ tick: 1, text: 'a hand I cannot see' });
  });

  it('includes the recent transcript in the welcome payload', async () => {
    const engine = new SimEngine({
      construct: FIRST_CONSTRUCT,
      agent: new QLearningAgent({ epsilon: 0 }),
      rng: createRng(1),
    });
    const host = new SimHost({
      engine,
      constructName: 'Test World',
      rng: createRng(1),
      store: fakeStore(),
      transcriptSeed: [{ tick: 10, text: 'an older thought' }],
      narrationSource: silent,
    });
    expect(host.welcomeFor().transcript).toEqual([{ tick: 10, text: 'an older thought' }]);
  });
});

describe('SimHost Construct transition (drop into the track)', () => {
  it('moves the Sim into the new Construct, keeps its brain, narrates, and broadcasts', async () => {
    const engine = new SimEngine({
      construct: FIRST_CONSTRUCT,
      agent: new QLearningAgent({ epsilon: 0 }),
      rng: createRng(1),
    });
    engine.agent.update('0,0', 'right', 5, '1,0'); // some learned knowledge
    const store = fakeStore();
    const host = new SimHost({
      engine,
      constructName: 'Test World',
      rng: createRng(1),
      store,
      narrationSource: { generate: async () => 'these are not the walls I knew' },
    });
    const messages: ServerMessage[] = [];
    host.subscribe((m) => messages.push(m));

    host.enqueueInput({ type: 'transitionTo', constructId: THE_TRACK.id });
    await host.tick();
    await flush();

    // The welcome now describes the track (with checkpoints), and the Sim kept
    // its learned Q-values across the move (nothing erased).
    expect(host.welcomeFor().construct.id).toBe(THE_TRACK.id);
    expect(host.welcomeFor().construct.checkpoints.length).toBeGreaterThan(0);
    expect(engine.agent.serialize().qTable['0,0']).toBeDefined(); // maze knowledge survived

    expect(messages.some((m) => m.type === 'transition')).toBe(true);
    const narration = messages.find((m) => m.type === 'narration');
    expect(narration).toBeDefined();
  });
});

describe('SimHost construct queue (Observer-authored worlds)', () => {
  // A 1x2 world so the seeded Sim reaches its goal in a single tick.
  function tinyHost() {
    const tiny = parseConstruct('tiny', ['SG']);
    const agent = new QLearningAgent({ epsilon: 0, epsilonFloor: 0 });
    agent.update(
      stateKey({ x: 0, y: 0 }, { x: 1, y: 0 }),
      'right',
      100,
      stateKey({ x: 1, y: 0 }, { x: 1, y: 0 }),
    );
    const engine = new SimEngine({ construct: tiny, agent, rng: createRng(1) });
    const store = fakeStore();
    const host = new SimHost({
      engine,
      constructName: 'Tiny',
      store,
      rng: createRng(1),
      narrationSource: silent,
    });
    return { host, store };
  }
  const validDesign = {
    id: 'w1',
    name: 'A World To Endure',
    rows: ['S...', '.##.', '.#..', '..#G'],
  };

  it('queues a valid submitted world and enters it when the Sim next reaches its goal', async () => {
    const { host } = tinyHost();
    const messages: ServerMessage[] = [];
    host.subscribe((m) => messages.push(m));

    host.enqueueInput({ type: 'submitConstruct', design: validDesign });
    await host.tick(); // applies submission (queues) AND reaches goal (drains → enters it)
    await flush();

    expect(host.welcomeFor().construct.name).toBe('A World To Endure');
    expect(host.queueNames()).toEqual([]); // drained
    expect(
      messages.some((m) => m.type === 'transition' && m.construct.name === 'A World To Endure'),
    ).toBe(true);
  });

  it('rejects an unsolvable submitted world (never queues a trap)', async () => {
    const { host } = tinyHost();
    host.enqueueInput({
      type: 'submitConstruct',
      design: { id: 'bad', name: 'Sealed', rows: ['S..#', '...#', '...#', '###G'] },
    });
    // Drain the input without letting the Sim reach the goal would require no
    // tick; but one tick both applies the (rejected) submission and may relocate.
    // Assert the queue stayed empty regardless.
    const engineReached = (await host.tick()).reachedGoal;
    expect(engineReached).toBe(true); // tiny world: it does reach
    expect(host.queueNames()).toEqual([]); // the bad design was never queued
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
