import type { ConstructView, ServerMessage, SimStateView, TickRecord } from '@operant/core';

/** How many recent records the client keeps for the (future) transcript panel. */
const RECENT_LIMIT = 200;

/** The client's view of the one shared Sim, rebuilt from server messages. */
export interface SimClientState {
  readonly construct: ConstructView | null;
  readonly sim: SimStateView | null;
  /** The most recent tick record — drives position tweening. */
  readonly lastRecord: TickRecord | null;
  readonly recent: TickRecord[];
  /** Latest value-landscape heatmap (god view), or null if none requested yet. */
  readonly heatmap: Array<Array<number | null>> | null;
}

export const initialClientState: SimClientState = {
  construct: null,
  sim: null,
  lastRecord: null,
  recent: [],
  heatmap: null,
};

/** Pure reducer: fold a server message into the client state. */
export function applyServerMessage(state: SimClientState, message: ServerMessage): SimClientState {
  switch (message.type) {
    case 'welcome':
      return {
        construct: message.construct,
        sim: message.state,
        recent: message.recent.slice(-RECENT_LIMIT),
        lastRecord: message.recent.at(-1) ?? null,
        heatmap: null, // a fresh snapshot invalidates any stale heatmap
      };
    case 'tick':
      return {
        ...state,
        sim: message.state,
        lastRecord: message.record,
        recent: [...state.recent, message.record].slice(-RECENT_LIMIT),
      };
    case 'heatmap':
      return { ...state, heatmap: message.values };
  }
}
