import { Pool } from 'pg';
import type { NarrationLine } from '@operant/core';
import type { SimStore } from './simStore';
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

  async close(): Promise<void> {
    await this.pool.end();
  }
}
