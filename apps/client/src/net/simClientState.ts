import type {
  ConstructView,
  NarrationLine,
  ServerMessage,
  SimStateView,
  TickRecord,
} from '@operant/core';

/** How many recent tick records the client keeps. */
const RECENT_LIMIT = 200;
/** How many narrator lines the transcript panel keeps in view. */
const TRANSCRIPT_LIMIT = 100;

/** The client's view of the one shared Sim, rebuilt from server messages. */
export interface SimClientState {
  readonly construct: ConstructView | null;
  readonly sim: SimStateView | null;
  /** The most recent tick record — drives position tweening. */
  readonly lastRecord: TickRecord | null;
  readonly recent: TickRecord[];
  /** Latest value-landscape heatmap (god view), or null if none requested yet. */
  readonly heatmap: Array<Array<number | null>> | null;
  /** The Sim's transcript of consciousness (narrator lines), oldest first. */
  readonly transcript: NarrationLine[];
  /** Names of Observer-authored worlds queued as the Sim's next chapters, in order. */
  readonly queue: string[];
}

export const initialClientState: SimClientState = {
  construct: null,
  sim: null,
  lastRecord: null,
  recent: [],
  heatmap: null,
  transcript: [],
  queue: [],
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
        transcript: message.transcript.slice(-TRANSCRIPT_LIMIT),
        queue: message.queue ?? [], // tolerate an older host that predates the queue
      };
    case 'queue':
      return { ...state, queue: message.names };
    case 'tick':
      return {
        ...state,
        sim: message.state,
        lastRecord: message.record,
        recent: [...state.recent, message.record].slice(-RECENT_LIMIT),
      };
    case 'heatmap':
      return { ...state, heatmap: message.values };
    case 'narration':
      return {
        ...state,
        transcript: [...state.transcript, message.line].slice(-TRANSCRIPT_LIMIT),
      };
    case 'transition':
      // The Sim was moved into a different Construct — swap geometry and state,
      // invalidate the heatmap, keep the transcript.
      return { ...state, construct: message.construct, sim: message.state, heatmap: null };
  }
}
