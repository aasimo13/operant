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
  `;
}
