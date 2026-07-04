/** Configuration for the Postgres-backed SimStore. */
export interface PostgresSimStoreConfig {
  readonly connectionString: string;
  /** Schema to hold the Sim tables. Isolates tests from production data. */
  readonly schema: string;
  /** Whether to connect over TLS. */
  readonly ssl: boolean;
}

/**
 * A safe SQL identifier. The schema name is interpolated into DDL, so we only
 * allow characters that can't break out of an identifier — an injection guard,
 * even though the value comes from config rather than user input.
 */
export function isValidSchemaName(name: string): boolean {
  return /^[a-z_][a-z0-9_]*$/.test(name);
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function inferSsl(connectionString: string): boolean {
  try {
    const host = new URL(connectionString).hostname;
    return !LOCAL_HOSTS.has(host);
  } catch {
    // Unparseable URL: default to secure.
    return true;
  }
}

/**
 * Build store config from the environment. `DATABASE_URL` is required;
 * `DATABASE_SCHEMA` defaults to `public`; SSL is inferred from the host (off for
 * localhost, on for remote) unless `DATABASE_SSL` overrides it.
 */
export function postgresConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): PostgresSimStoreConfig {
  const connectionString = env.DATABASE_URL;
  if (!connectionString || connectionString.trim() === '') {
    throw new Error('DATABASE_URL is not set — the Sim has nowhere persistent to live.');
  }

  const schema = env.DATABASE_SCHEMA ?? 'public';
  if (!isValidSchemaName(schema)) {
    throw new Error(`Invalid DATABASE_SCHEMA "${schema}": must match /^[a-z_][a-z0-9_]*$/.`);
  }

  let ssl: boolean;
  if (env.DATABASE_SSL === 'true') ssl = true;
  else if (env.DATABASE_SSL === 'false') ssl = false;
  else ssl = inferSsl(connectionString);

  return { connectionString, schema, ssl };
}
