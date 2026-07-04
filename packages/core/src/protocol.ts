import type { GridPosition } from './grid';
import type { TickRecord } from './simEngine';
import type { WearBreakdown } from './wear';

/**
 * The WebSocket wire protocol shared by the simulation host and Observer
 * clients. Types only — no framework or transport dependency — so both sides
 * import the exact same shapes and can't drift. Message *builders* and inbound
 * validation live in the server; the client only needs these types.
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
  /** Accumulated wear — the `wear` scalar drives client jitter; parts feed the dev readout. */
  readonly wear: WearBreakdown;
}

// ─── server → client ─────────────────────────────────────────────────────────

/** One line in the Sim's "transcript of consciousness". */
export interface NarrationLine {
  /** The tick this line was occasioned by. */
  readonly tick: number;
  /** The line itself — first-person, from the Sim's point of view. */
  readonly text: string;
}

export interface WelcomeMessage {
  readonly type: 'welcome';
  readonly construct: ConstructView;
  readonly state: SimStateView;
  readonly recent: TickRecord[];
  /** Bounded recent narrator lines — not the whole lifetime (constraint 16). */
  readonly transcript: NarrationLine[];
}

export interface TickMessage {
  readonly type: 'tick';
  readonly state: SimStateView;
  readonly record: TickRecord;
}

/**
 * The Sim's value landscape for the god-view heatmap: best-action Q per open
 * cell, `null` for walls, as `values[y][x]`. Sent on request (not every tick)
 * so it only costs bandwidth for Observers actually looking at it.
 */
export interface HeatmapMessage {
  readonly type: 'heatmap';
  readonly values: Array<Array<number | null>>;
}

/** A new narrator line — the Sim voicing (never driving) its experience. */
export interface NarrationMessage {
  readonly type: 'narration';
  readonly line: NarrationLine;
}

export type ServerMessage = WelcomeMessage | TickMessage | HeatmapMessage | NarrationMessage;

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

/** Ask the host for the current value-landscape heatmap (god view only). */
export interface HeatmapRequestMessage {
  readonly type: 'requestHeatmap';
}

export type ClientMessage = ProvidenceMessage | InterveneMessage | HeatmapRequestMessage;
