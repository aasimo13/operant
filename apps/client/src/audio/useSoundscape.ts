import { useCallback, useEffect, useRef, useState } from 'react';
import type { TickRecord } from '@operant/core';
import { Soundscape } from './soundscape';

/**
 * Drives the {@link Soundscape} from live state: the drone tracks wear, a felt
 * Providence rings, and a wall-bump thuds. Off until the Observer opts in (the
 * toggle click also satisfies the browser's audio-gesture requirement).
 */
export function useSoundscape(input: {
  wear: number;
  providencePulse: { kind: 'reward' | 'punish'; seq: number } | null;
  lastRecord: TickRecord | null;
}): { on: boolean; toggle: () => void } {
  const ref = useRef<Soundscape | null>(null);
  if (ref.current === null) ref.current = new Soundscape();
  const [on, setOn] = useState(false);

  const toggle = useCallback(() => {
    setOn((prev) => {
      const next = !prev;
      void ref.current?.setEnabled(next);
      return next;
    });
  }, []);

  // The drone strains with wear.
  useEffect(() => {
    ref.current?.setWear(input.wear);
  }, [input.wear]);

  // A felt Providence rings (seq changes each time anyone reaches in).
  const pulse = input.providencePulse;
  useEffect(() => {
    if (!pulse) return;
    if (pulse.kind === 'reward') ref.current?.reward();
    else ref.current?.punish();
    // Intentionally keyed on the pulse seq only — fire once per felt Providence.
  }, [pulse?.seq]);

  // A wall-bump thuds (fire on the tick it happened, not on every render).
  const bumpTick = input.lastRecord?.hitWall ? input.lastRecord.tick : null;
  useEffect(() => {
    if (bumpTick !== null) ref.current?.bump();
  }, [bumpTick]);

  // Release the AudioContext when the view unmounts.
  useEffect(() => () => ref.current?.dispose(), []);

  return { on, toggle };
}
