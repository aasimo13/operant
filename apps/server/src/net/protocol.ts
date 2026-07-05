import { bestActionValues } from '@operant/core';
import type {
  Chronicle,
  ChronicleMessage,
  ClientMessage,
  Construct,
  ConstructView,
  HeatmapMessage,
  NarrationLine,
  PresenceMessage,
  QueueMessage,
  SimEngine,
  SimStateView,
  TickMessage,
  TickRecord,
  TransitionMessage,
  WearBreakdown,
  WelcomeMessage,
} from '@operant/core';

/**
 * Server-side helpers for the WebSocket wire protocol: building outbound
 * messages from live engine state and validating untrusted inbound frames. The
 * message *types* are shared via @operant/core so client and server can't drift.
 *
 * Observers are pure spectators of one shared Sim: on connect they get the
 * Construct geometry, the current state, and a *bounded* recent backfill (never
 * the Sim's whole lifetime — constraint 16); thereafter they get one message
 * per decision tick. They send only inputs (Providence, Intervene).
 */

// Re-export the shared wire types so server modules can import them from here.
export type {
  ConstructView,
  SimStateView,
  WelcomeMessage,
  TickMessage,
  HeatmapMessage,
  NarrationLine,
  NarrationMessage,
  TransitionMessage,
  QueueMessage,
  ChronicleMessage,
  PresenceMessage,
  ServerMessage,
  ProvidenceMessage,
  InterveneMessage,
  HeatmapRequestMessage,
  TransitionRequestMessage,
  SubmitConstructMessage,
  ClientMessage,
} from '@operant/core';

// ─── builders ────────────────────────────────────────────────────────────────

export function buildConstructView(construct: Construct, name: string): ConstructView {
  const walls: boolean[][] = [];
  for (let y = 0; y < construct.height; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < construct.width; x++) {
      row.push(construct.isWall({ x, y }));
    }
    walls.push(row);
  }
  return {
    id: construct.id,
    name,
    width: construct.width,
    height: construct.height,
    walls,
    checkpoints: construct.checkpoints.map((cp) => ({ x: cp.x, y: cp.y })),
  };
}

export function buildStateView(engine: SimEngine, wear: WearBreakdown): SimStateView {
  return {
    position: engine.position,
    goal: engine.goal,
    tickCount: engine.tickCount,
    epsilon: engine.agent.epsilon,
    wear,
  };
}

export function buildWelcome(
  engine: SimEngine,
  wear: WearBreakdown,
  recent: TickRecord[],
  transcript: NarrationLine[],
  name: string,
  queue: string[],
  chronicle: Chronicle,
  watching: number,
): WelcomeMessage {
  return {
    type: 'welcome',
    construct: buildConstructView(engine.construct, name),
    state: buildStateView(engine, wear),
    recent,
    transcript,
    queue,
    chronicle,
    watching,
  };
}

export function buildPresence(watching: number): PresenceMessage {
  return { type: 'presence', watching };
}

export function buildQueue(names: string[]): QueueMessage {
  return { type: 'queue', names };
}

export function buildChronicle(chronicle: Chronicle): ChronicleMessage {
  return { type: 'chronicle', chronicle };
}

export function buildTickMessage(
  engine: SimEngine,
  wear: WearBreakdown,
  record: TickRecord,
  providence: 'reward' | 'punish' | null = null,
): TickMessage {
  return { type: 'tick', state: buildStateView(engine, wear), record, providence };
}

export function buildHeatmap(engine: SimEngine): HeatmapMessage {
  return { type: 'heatmap', values: bestActionValues(engine.construct, engine.agent, engine.goal) };
}

export function buildTransition(
  engine: SimEngine,
  wear: WearBreakdown,
  name: string,
): TransitionMessage {
  return {
    type: 'transition',
    construct: buildConstructView(engine.construct, name),
    state: buildStateView(engine, wear),
  };
}

// ─── validation ──────────────────────────────────────────────────────────────

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Parse and validate a raw client frame into a {@link ClientMessage}, or null if
 * it is malformed. Untrusted input from the socket — anything that isn't a
 * recognized, well-formed message is rejected rather than trusted.
 */
export function parseClientMessage(raw: string): ClientMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const msg = value as Record<string, unknown>;

  if (msg.type === 'providence' && (msg.kind === 'reward' || msg.kind === 'punish')) {
    return { type: 'providence', kind: msg.kind };
  }

  if (msg.type === 'intervene' && typeof msg.position === 'object' && msg.position !== null) {
    const pos = msg.position as Record<string, unknown>;
    if (isFiniteNumber(pos.x) && isFiniteNumber(pos.y)) {
      return { type: 'intervene', position: { x: pos.x, y: pos.y } };
    }
  }

  if (msg.type === 'requestHeatmap') {
    return { type: 'requestHeatmap' };
  }

  if (
    msg.type === 'transitionTo' &&
    typeof msg.constructId === 'string' &&
    msg.constructId !== ''
  ) {
    return { type: 'transitionTo', constructId: msg.constructId };
  }

  if (msg.type === 'submitConstruct' && typeof msg.design === 'object' && msg.design !== null) {
    const d = msg.design as Record<string, unknown>;
    // Shape check only — semantic validation (solvable, sized, named) happens in
    // the host via validateConstructDesign before anything is queued.
    if (
      typeof d.id === 'string' &&
      typeof d.name === 'string' &&
      Array.isArray(d.rows) &&
      d.rows.every((r) => typeof r === 'string')
    ) {
      return {
        type: 'submitConstruct',
        design: { id: d.id, name: d.name, rows: d.rows as string[] },
      };
    }
  }

  return null;
}
