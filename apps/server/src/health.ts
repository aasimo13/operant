import { CORE_VERSION } from '@operant/core';

/**
 * Shape of the `/health` payload. External uptime monitoring (a hard project
 * requirement — see CLAUDE.md constraint 13) pings this endpoint; the premise
 * is that the Sim "runs whether or not anyone is watching", so a silent crash
 * must be detectable.
 */
export interface HealthPayload {
  readonly status: 'ok';
  readonly service: 'operant-simulation-host';
  readonly coreVersion: string;
}

export function buildHealthPayload(): HealthPayload {
  return {
    status: 'ok',
    service: 'operant-simulation-host',
    coreVersion: CORE_VERSION,
  };
}
