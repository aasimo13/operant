import { FIRST_CONSTRUCT, THE_TRACK, type Construct } from '@operant/core';

/**
 * Registry of the built-in Constructs by id. The Sim moves through a *sequence*
 * of these over its one life (constraint 9); Observer-authored worlds are held
 * in the host's queue as designs, not here. Built-ins carry a human name so the
 * Chronicle and the "current world" display can title them.
 */
const CONSTRUCTS: Record<string, { construct: Construct; name: string }> = {
  [FIRST_CONSTRUCT.id]: { construct: FIRST_CONSTRUCT, name: 'The First Construct' },
  [THE_TRACK.id]: { construct: THE_TRACK, name: 'The Circuit' },
};

export function lookupConstruct(id: string): Construct {
  const entry = CONSTRUCTS[id];
  if (!entry) {
    throw new Error(`Unknown Construct id "${id}" — no such maze is registered.`);
  }
  return entry.construct;
}

/** Human title for a built-in Construct id (falls back to the id itself). */
export function constructName(id: string): string {
  return CONSTRUCTS[id]?.name ?? id;
}
