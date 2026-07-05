/**
 * Database schema for the Sim's persistent state.
 *
 * There is exactly one Sim, so `sim_state` holds exactly one row, keyed by a
 * fixed id. The whole snapshot is stored as `jsonb` — simple, and one row's
 * worth of Q-table is trivial to read and write every tick.
 *
 * The schema name is validated as a safe identifier before it reaches here (see
 * isValidSchemaName), so interpolating it into DDL is safe.
 */

/** The single canonical Sim id — there is one shared Sim, globally. */
export const CANONICAL_SIM_ID = 'canonical';

export function schemaDdl(schema: string): string {
  return `
    CREATE SCHEMA IF NOT EXISTS "${schema}";
    CREATE TABLE IF NOT EXISTS "${schema}".sim_state (
      id         text        PRIMARY KEY,
      state      jsonb       NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS "${schema}".transcript (
      id         bigserial   PRIMARY KEY,
      tick       integer     NOT NULL,
      text       text        NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    -- Older transcript lines are folded into per-epoch aggregates (never simply
    -- deleted — CLAUDE.md constraints 1 & 15), so the raw table stays bounded on
    -- the always-on Sim while the deep past survives as a summary you can still read.
    CREATE TABLE IF NOT EXISTS "${schema}".transcript_epoch (
      id         bigserial   PRIMARY KEY,
      from_tick  integer     NOT NULL,
      to_tick    integer     NOT NULL,
      line_count integer     NOT NULL,
      sample     text[]      NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `;
}
