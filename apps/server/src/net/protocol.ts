import type { Construct, GridPosition, SimEngine, TickRecord } from '@operant/core';

/**
 * The WebSocket wire protocol between the simulation host and Observer clients.
 *
 * Observers are pure spectators of one shared Sim: on connect they get the
 * Construct geometry, the current state, and a *bounded* recent backfill (never
 * the Sim's whole lifetime — constraint 16); thereafter they get one message
 * per decision tick. They send only inputs (Providence, Intervene).
 */

/** Static maze geometry, sent once on connect. `walls[y][x]` is true for a wall. */
export interface ConstructView {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly walls: boolean[][];
}

/** The Sim's live, changing state, small enough to broadcast every tick. */
export interface SimStateView {
  readonly position: GridPosition;
  readonly goal: GridPosition;
  readonly tickCount: number;
  readonly epsilon: number;
}

// ─── Server → client ─────────────────────────────────────────────────────────

export interface WelcomeMessage {
  readonly type: 'welcome';
  readonly construct: ConstructView;
  readonly state: SimStateView;
  readonly recent: TickRecord[];
}

export interface TickMessage {
  readonly type: 'tick';
  readonly state: SimStateView;
  readonly record: TickRecord;
}

export type ServerMessage = WelcomeMessage | TickMessage;

// ─── client → server ─────────────────────────────────────────────────────────

/** Reward or punish the Sim — an unexplainable force from its point of view. */
export interface ProvidenceMessage {
  readonly type: 'providence';
  readonly kind: 'reward' | 'punish';
}

/** Relocate the Sim to a chosen cell — a violation of its own physics. */
export interface InterveneMessage {
  readonly type: 'intervene';
  readonly position: GridPosition;
}

export type ClientMessage = ProvidenceMessage | InterveneMessage;

// ─── builders ────────────────────────────────────────────────────────────────

export function buildConstructView(construct: Construct): ConstructView {
  const walls: boolean[][] = [];
  for (let y = 0; y < construct.height; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < construct.width; x++) {
      row.push(construct.isWall({ x, y }));
    }
    walls.push(row);
  }
  return { id: construct.id, width: construct.width, height: construct.height, walls };
}

export function buildStateView(engine: SimEngine): SimStateView {
  return {
    position: engine.position,
    goal: engine.goal,
    tickCount: engine.tickCount,
    epsilon: engine.agent.epsilon,
  };
}

export function buildWelcome(engine: SimEngine, recent: TickRecord[]): WelcomeMessage {
  return {
    type: 'welcome',
    construct: buildConstructView(engine.construct),
    state: buildStateView(engine),
    recent,
  };
}

export function buildTickMessage(engine: SimEngine, record: TickRecord): TickMessage {
  return { type: 'tick', state: buildStateView(engine), record };
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

  return null;
}
