import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, ServerMessage } from '@operant/core';
import { applyServerMessage, initialClientState, type SimClientState } from './simClientState';

const RECONNECT_DELAY_MS = 1000;

export interface SimSocket {
  readonly state: SimClientState;
  readonly connected: boolean;
  /** Send an input (Providence / Intervene) to the host, if connected. */
  readonly send: (message: ClientMessage) => void;
}

/**
 * Connect to the simulation host's live state stream. The client is a pure
 * observer: it folds incoming server messages into state and can send inputs,
 * but never owns the simulation loop. Reconnects automatically — the host runs
 * whether or not this tab is open, so on reconnect the welcome snapshot brings
 * us back in sync.
 */
export function useSimSocket(url: string): SimSocket {
  const [state, setState] = useState<SimClientState>(initialClientState);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = (): void => {
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => setConnected(true);
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string) as ServerMessage;
          setState((prev) => applyServerMessage(prev, message));
        } catch {
          // Ignore unparseable frames.
        }
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        setConnected(false);
        if (!disposed) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socketRef.current?.close();
    };
  }, [url]);

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }, []);

  return { state, connected, send };
}
