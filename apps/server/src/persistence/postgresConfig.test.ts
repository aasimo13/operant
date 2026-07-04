import { describe, expect, it } from 'vitest';
import { isValidSchemaName, postgresConfigFromEnv } from './postgresConfig';

describe('isValidSchemaName', () => {
  it('accepts plain lowercase identifiers', () => {
    expect(isValidSchemaName('public')).toBe(true);
    expect(isValidSchemaName('operant_test')).toBe(true);
  });

  it('rejects anything that could break out of an identifier (injection guard)', () => {
    expect(isValidSchemaName('public; drop table x')).toBe(false);
    expect(isValidSchemaName('"quoted"')).toBe(false);
    expect(isValidSchemaName('has space')).toBe(false);
    expect(isValidSchemaName('')).toBe(false);
  });
});

describe('postgresConfigFromEnv', () => {
  it('throws a clear error when DATABASE_URL is missing', () => {
    expect(() => postgresConfigFromEnv({})).toThrow(/DATABASE_URL/);
  });

  it('defaults to the public schema', () => {
    const cfg = postgresConfigFromEnv({ DATABASE_URL: 'postgres://localhost:5432/db' });
    expect(cfg.schema).toBe('public');
  });

  it('honors an explicit, valid schema and rejects an invalid one', () => {
    expect(
      postgresConfigFromEnv({ DATABASE_URL: 'postgres://localhost/db', DATABASE_SCHEMA: 'op_test' })
        .schema,
    ).toBe('op_test');
    expect(() =>
      postgresConfigFromEnv({
        DATABASE_URL: 'postgres://localhost/db',
        DATABASE_SCHEMA: 'bad;name',
      }),
    ).toThrow(/schema/i);
  });

  it('infers SSL off for local hosts and on for remote hosts', () => {
    expect(postgresConfigFromEnv({ DATABASE_URL: 'postgres://localhost:5432/db' }).ssl).toBe(false);
    expect(postgresConfigFromEnv({ DATABASE_URL: 'postgres://127.0.0.1/db' }).ssl).toBe(false);
    expect(
      postgresConfigFromEnv({
        DATABASE_URL: 'postgres://user:pw@some.proxy.rlwy.net:12345/railway',
      }).ssl,
    ).toBe(true);
  });

  it('lets DATABASE_SSL override the inference explicitly', () => {
    expect(
      postgresConfigFromEnv({ DATABASE_URL: 'postgres://remote.example/db', DATABASE_SSL: 'false' })
        .ssl,
    ).toBe(false);
    expect(
      postgresConfigFromEnv({ DATABASE_URL: 'postgres://localhost/db', DATABASE_SSL: 'true' }).ssl,
    ).toBe(true);
  });
});
