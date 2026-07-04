import { describe, expect, it } from 'vitest';
import { CANONICAL_SIM_ID, schemaDdl } from './schema';

describe('schemaDdl', () => {
  it('creates the schema and the single-row sim_state table', () => {
    const sql = schemaDdl('operant_test');
    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS "operant_test"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "operant_test".sim_state');
    expect(sql).toContain('jsonb');
  });
});

describe('CANONICAL_SIM_ID', () => {
  it('is a single fixed id — there is exactly one Sim', () => {
    expect(CANONICAL_SIM_ID).toBe('canonical');
  });
});
