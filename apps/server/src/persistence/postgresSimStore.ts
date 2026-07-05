import { Pool } from 'pg';
import type { NarrationLine } from '@operant/core';
import type { CompactionResult, SimStore, TranscriptEpoch } from './simStore';
import type { PostgresSimStoreConfig } from './postgresConfig';
import { CANONICAL_SIM_ID, schemaDdl } from './schema';
import type { PersistedSimState } from './types';

/**
 * Postgres-backed {@link SimStore}: the canonical home of the one persistent
 * Sim. The entire state snapshot lives as a single `jsonb` row keyed by a fixed
 * id — trivial to write every tick and to rehydrate on boot.
 *
 * There is intentionally no delete/clear/reset method: the Sim's state only
 * ever accumulates and is only ever overwritten with a *newer* full snapshot
 * (CLAUDE.md constraint 1).
 */
export class PostgresSimStore implements SimStore {
  private readonly pool: Pool;
  private readonly schema: string;

  constructor(config: PostgresSimStoreConfig) {
    this.schema = config.schema;
    this.pool = new Pool({
      connectionString: config.connectionString,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
    });
  }

  async init(): Promise<void> {
    await this.pool.query(schemaDdl(this.schema));
  }

  async loadSim(): Promise<PersistedSimState | null> {
    const { rows } = await this.pool.query<{ state: PersistedSimState }>(
      `SELECT state FROM "${this.schema}".sim_state WHERE id = $1`,
      [CANONICAL_SIM_ID],
    );
    return rows[0]?.state ?? null;
  }

  async saveSim(state: PersistedSimState): Promise<void> {
    await this.pool.query(
      `INSERT INTO "${this.schema}".sim_state (id, state, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
      [CANONICAL_SIM_ID, JSON.stringify(state)],
    );
  }

  async appendTranscript(line: NarrationLine): Promise<void> {
    await this.pool.query(`INSERT INTO "${this.schema}".transcript (tick, text) VALUES ($1, $2)`, [
      line.tick,
      line.text,
    ]);
  }

  async recentTranscript(limit: number): Promise<NarrationLine[]> {
    const { rows } = await this.pool.query<{ tick: number; text: string }>(
      `SELECT tick, text FROM "${this.schema}".transcript ORDER BY id DESC LIMIT $1`,
      [limit],
    );
    // Fetched newest-first; return oldest-first for chronological display.
    return rows.reverse().map((r) => ({ tick: r.tick, text: r.text }));
  }

  async compactTranscript(opts: {
    retainRaw: number;
    epochSize: number;
  }): Promise<CompactionResult> {
    const { retainRaw, epochSize } = opts;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: countRows } = await client.query<{ n: string }>(
        `SELECT count(*)::bigint AS n FROM "${this.schema}".transcript`,
      );
      const total = Number(countRows[0]?.n ?? 0);
      const compactable = total - retainRaw;
      const epochs = compactable >= epochSize ? Math.floor(compactable / epochSize) : 0;
      if (epochs === 0) {
        await client.query('COMMIT');
        return { epochsCreated: 0, linesCompacted: 0 };
      }

      const linesToCompact = epochs * epochSize;
      // The oldest lines, in order — grouped into consecutive epochs below.
      const { rows: old } = await client.query<{ tick: number; text: string }>(
        `SELECT tick, text FROM "${this.schema}".transcript ORDER BY id ASC LIMIT $1`,
        [linesToCompact],
      );

      for (let e = 0; e < epochs; e++) {
        const group = old.slice(e * epochSize, (e + 1) * epochSize);
        const first = group[0]!;
        const last = group[group.length - 1]!;
        const sample = group.length > 1 ? [first.text, last.text] : [first.text];
        await client.query(
          `INSERT INTO "${this.schema}".transcript_epoch (from_tick, to_tick, line_count, sample)
           VALUES ($1, $2, $3, $4)`,
          [first.tick, last.tick, group.length, sample],
        );
      }

      // Delete exactly the oldest linesToCompact raw rows (now summarized).
      await client.query(
        `DELETE FROM "${this.schema}".transcript
         WHERE id IN (
           SELECT id FROM "${this.schema}".transcript ORDER BY id ASC LIMIT $1
         )`,
        [linesToCompact],
      );
      await client.query('COMMIT');
      return { epochsCreated: epochs, linesCompacted: linesToCompact };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async recentEpochs(limit: number): Promise<TranscriptEpoch[]> {
    const { rows } = await this.pool.query<{
      from_tick: number;
      to_tick: number;
      line_count: number;
      sample: string[];
    }>(
      `SELECT from_tick, to_tick, line_count, sample
       FROM "${this.schema}".transcript_epoch ORDER BY id DESC LIMIT $1`,
      [limit],
    );
    return rows.reverse().map((r) => ({
      fromTick: r.from_tick,
      toTick: r.to_tick,
      lineCount: r.line_count,
      sample: r.sample,
    }));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
