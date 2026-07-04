import { FIRST_CONSTRUCT, type Construct } from '@operant/core';

/**
 * Registry of known Constructs by id. The Sim moves through a *sequence* of
 * these over its one life (constraint 9); persistence stores only the current
 * constructId, and boot looks the geometry up here.
 */
const CONSTRUCTS: Record<string, Construct> = {
  [FIRST_CONSTRUCT.id]: FIRST_CONSTRUCT,
};

export function lookupConstruct(id: string): Construct {
  const construct = CONSTRUCTS[id];
  if (!construct) {
    throw new Error(`Unknown Construct id "${id}" — no such maze is registered.`);
  }
  return construct;
}
