import type { TickRecord } from './simEngine';

/**
 * The Sim's life, in aggregate — a record of everything it has endured across
 * its one continuous existence. Like the Q-values, it is only ever added to;
 * nothing here is reset (CLAUDE.md constraint 1). It makes the Sim's endurance
 * legible: how far it has walked, how often it has been hurt, how many worlds it
 * has been made to live and leave.
 *
 * To bound growth (constraint 15) the full list of worlds is kept only for a
 * recent window; older ones survive as the `worldsEndured` count.
 */
export interface WorldSojourn {
  readonly name: string;
  /** The lifetime tick at which the Sim was placed into this world. */
  readonly enteredAtTick: number;
}

export interface Chronicle {
  /** Total decision ticks lived (mirrors tickCount; the Sim's "age"). */
  readonly age: number;
  readonly goalsReached: number;
  readonly wallBumps: number;
  readonly rewards: number;
  readonly punishments: number;
  readonly interventions: number;
  /** Cells the Sim has actually moved through (bumps don't count). */
  readonly distance: number;
  /** How many worlds the Sim has ever been made to live (monotonic). */
  readonly worldsEndured: number;
  /** The most recent worlds, oldest first — bounded for storage. */
  readonly recentWorlds: WorldSojourn[];
}

/** How many recent worlds to keep in full; older ones live on only in the count. */
export const RECENT_WORLDS_LIMIT = 24;

/** A newborn Sim's chronicle: it has endured exactly the world it was born into. */
export function emptyChronicle(firstWorldName: string): Chronicle {
  return {
    age: 0,
    goalsReached: 0,
    wallBumps: 0,
    rewards: 0,
    punishments: 0,
    interventions: 0,
    distance: 0,
    worldsEndured: 1,
    recentWorlds: [{ name: firstWorldName, enteredAtTick: 0 }],
  };
}

/** One tick's worth of things that happened, folded into the chronicle. */
export interface ChronicleEvent {
  readonly record: TickRecord;
  readonly intervened: boolean;
  readonly providence: 'reward' | 'punish' | null;
}

/** Fold one tick into the chronicle. Pure; only ever grows the totals. */
export function advanceChronicle(chronicle: Chronicle, event: ChronicleEvent): Chronicle {
  const { record, intervened, providence } = event;
  const moved = record.from.x !== record.to.x || record.from.y !== record.to.y;
  return {
    ...chronicle,
    age: chronicle.age + 1,
    goalsReached: chronicle.goalsReached + (record.reachedGoal ? 1 : 0),
    wallBumps: chronicle.wallBumps + (record.hitWall ? 1 : 0),
    rewards: chronicle.rewards + (providence === 'reward' ? 1 : 0),
    punishments: chronicle.punishments + (providence === 'punish' ? 1 : 0),
    interventions: chronicle.interventions + (intervened ? 1 : 0),
    distance: chronicle.distance + (moved ? 1 : 0),
  };
}

/** Record that the Sim has been placed into a new world. */
export function enterWorld(chronicle: Chronicle, name: string, atTick: number): Chronicle {
  const recentWorlds = [...chronicle.recentWorlds, { name, enteredAtTick: atTick }].slice(
    -RECENT_WORLDS_LIMIT,
  );
  return { ...chronicle, worldsEndured: chronicle.worldsEndured + 1, recentWorlds };
}
