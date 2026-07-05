import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { FIRST_CONSTRUCT } from '@operant/core';
import { PostgresSimStore } from './postgresSimStore';
import { postgresConfigFromEnv } from './postgresConfig';
import { initialSimState, loadOrInitializeSim } from './simStore';
import type { PersistedSimState } from './types';

/**
 * These tests hit a real Postgres. They run whenever DATABASE_URL is set (CI
 * service container, or a local .env pointing at Railway) and skip otherwise,
 * so `pnpm test` never fails for a contributor without a database. They use an
 * isolated `operant_test` schema so they can never touch the real Sim's data.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

const TEST_SCHEMA = 'operant_test';

/** A lived-in Sim: advanced ticks and a non-trivial learned Q-table. */
function livedInState(tickCount: number): PersistedSimState {
  const base = initialSimState(FIRST_CONSTRUCT);
  return {
    ...base,
    tickCount,
    position: { x: 3, y: 3 },
    goal: { x: 8, y: 1 },
    agent: { ...base.agent, epsilon: 0.087, qTable: { '3,3': [-1.2, 0.5, 4.7, -0.3] } },
  };
}

describeDb('PostgresSimStore (integration, real Postgres)', () => {
  // Resolved in beforeAll (not at collection time) so a skipped suite never
  // touches the environment.
  let config: ReturnType<typeof postgresConfigFromEnv>;
  let store: PostgresSimStore;
  let admin: Pool;

  beforeAll(async () => {
    config = postgresConfigFromEnv({ ...process.env, DATABASE_SCHEMA: TEST_SCHEMA });
    store = new PostgresSimStore(config);
    await store.init();
    admin = new Pool({
      connectionString: config.connectionString,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
    });
  });

  afterAll(async () => {
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
      await admin.end();
    }
    if (store) await store.close();
  });

  beforeEach(async () => {
    await admin.query(
      `TRUNCATE "${TEST_SCHEMA}".sim_state, "${TEST_SCHEMA}".transcript, "${TEST_SCHEMA}".transcript_epoch`,
    );
  });

  it('returns null before any Sim has been written', async () => {
    expect(await store.loadSim()).toBeNull();
  });

  it('round-trips the full Sim state, including the nested Q-table', async () => {
    const state = livedInState(7);
    await store.saveSim(state);
    expect(await store.loadSim()).toEqual(state);
  });

  it('upserts — saving repeatedly keeps exactly one canonical row', async () => {
    await store.saveSim(livedInState(1));
    await store.saveSim(livedInState(99));

    const { rows } = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "${TEST_SCHEMA}".sim_state`,
    );
    expect(rows[0]!.n).toBe(1);
    expect((await store.loadSim())?.tickCount).toBe(99);
  });

  it('survives a simulated process restart — a fresh store rehydrates it (constraint 2)', async () => {
    const lived = livedInState(5000);
    await store.saveSim(lived);

    // As if the host process died and rebooted: a brand-new store/pool.
    const rebooted = new PostgresSimStore(config);
    try {
      expect(await rebooted.loadSim()).toEqual(lived);
    } finally {
      await rebooted.close();
    }
  });

  it('appends transcript lines permanently and returns a bounded recent window', async () => {
    for (let i = 1; i <= 5; i++) {
      await store.appendTranscript({ tick: i, text: `line ${i}` });
    }
    const recent = await store.recentTranscript(3);
    // Oldest-first, only the newest 3.
    expect(recent).toEqual([
      { tick: 3, text: 'line 3' },
      { tick: 4, text: 'line 4' },
      { tick: 5, text: 'line 5' },
    ]);
  });

  it('compacts old transcript lines into epochs, keeping a recent raw window (constraint 15)', async () => {
    for (let i = 1; i <= 12; i++) await store.appendTranscript({ tick: i, text: `line ${i}` });

    // retain the newest 4 raw; fold the rest into epochs of 3 → 8 compactable → 2 epochs (6 lines).
    const result = await store.compactTranscript({ retainRaw: 4, epochSize: 3 });
    expect(result).toEqual({ epochsCreated: 2, linesCompacted: 6 });

    // The raw table now holds only the newest 6 lines (nothing newer was touched).
    const recent = await store.recentTranscript(100);
    expect(recent.map((r) => r.tick)).toEqual([7, 8, 9, 10, 11, 12]);

    // The oldest 6 lines survive as two summarized epochs (not erased).
    expect(await store.recentEpochs(10)).toEqual([
      { fromTick: 1, toTick: 3, lineCount: 3, sample: ['line 1', 'line 3'] },
      { fromTick: 4, toTick: 6, lineCount: 3, sample: ['line 4', 'line 6'] },
    ]);

    // Running again is a no-op while too little is compactable — no over-compaction.
    expect(await store.compactTranscript({ retainRaw: 4, epochSize: 3 })).toEqual({
      epochsCreated: 0,
      linesCompacted: 0,
    });
  });

  it('initializes once, then rehydrates without ever overwriting (constraints 1 & 2)', async () => {
    const first = await loadOrInitializeSim(store, () => initialSimState(FIRST_CONSTRUCT));
    expect(first.tickCount).toBe(0);

    // The Sim lives a while and is persisted.
    await store.saveSim({ ...first, tickCount: 123 });

    // A later boot must return the lived state, not a fresh one.
    const later = await loadOrInitializeSim(store, () => initialSimState(FIRST_CONSTRUCT));
    expect(later.tickCount).toBe(123);
  });
});
