import { vi } from 'vitest';
import type { NarrationLine } from '@operant/core';
import type { SimStore } from '../persistence/simStore';
import type { PersistedSimState } from '../persistence/types';

/** An in-memory SimStore for tests, with the saved state and transcript exposed. */
export interface FakeStore extends SimStore {
  readonly saved: PersistedSimState | null;
  readonly transcript: NarrationLine[];
}

export function createFakeStore(seed: PersistedSimState | null = null): FakeStore {
  let saved = seed;
  const transcript: NarrationLine[] = [];
  return {
    get saved() {
      return saved;
    },
    get transcript() {
      return transcript;
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
    close: vi.fn(async () => {}),
  };
}
