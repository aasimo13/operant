import { vi } from 'vitest';
import type { NarrationLine } from '@operant/core';
import type { SimStore, TranscriptEpoch } from '../persistence/simStore';
import type { PersistedSimState } from '../persistence/types';

/** An in-memory SimStore for tests, with the saved state and transcript exposed. */
export interface FakeStore extends SimStore {
  readonly saved: PersistedSimState | null;
  readonly transcript: NarrationLine[];
  readonly epochs: TranscriptEpoch[];
}

export function createFakeStore(seed: PersistedSimState | null = null): FakeStore {
  let saved = seed;
  const transcript: NarrationLine[] = [];
  const epochs: TranscriptEpoch[] = [];
  return {
    get saved() {
      return saved;
    },
    get transcript() {
      return transcript;
    },
    get epochs() {
      return epochs;
    },
    init: vi.fn(async () => {}),
    loadSim: vi.fn(async () => saved),
    saveSim: vi.fn(async (state: PersistedSimState) => {
      saved = state;
    }),
    appendTranscript: vi.fn(async (line: NarrationLine) => {
      transcript.push(line);
    }),
    recentTranscript: vi.fn(async (limit: number) => transcript.slice(-limit)),
    compactTranscript: vi.fn(async ({ retainRaw, epochSize }) => {
      const compactable = transcript.length - retainRaw;
      const n = compactable >= epochSize ? Math.floor(compactable / epochSize) : 0;
      for (let e = 0; e < n; e++) {
        const group = transcript.splice(0, epochSize); // oldest first
        const first = group[0]!;
        const last = group[group.length - 1]!;
        epochs.push({
          fromTick: first.tick,
          toTick: last.tick,
          lineCount: group.length,
          sample: group.length > 1 ? [first.text, last.text] : [first.text],
        });
      }
      return { epochsCreated: n, linesCompacted: n * epochSize };
    }),
    recentEpochs: vi.fn(async (limit: number) => epochs.slice(-limit)),
    close: vi.fn(async () => {}),
  };
}
