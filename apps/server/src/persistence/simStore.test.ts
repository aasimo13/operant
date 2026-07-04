import { describe, expect, it, vi } from 'vitest';
import { FIRST_CONSTRUCT } from '@operant/core';
import { initialSimState, loadOrInitializeSim } from './simStore';
import type { PersistedSimState } from './types';
import { createFakeStore as fakeStore } from '../test/fakeStore';

describe('initialSimState', () => {
  it('starts a brand-new Sim at the Construct’s start with an unlearned agent', () => {
    const state = initialSimState(FIRST_CONSTRUCT);
    expect(state.constructId).toBe(FIRST_CONSTRUCT.id);
    expect(state.position).toEqual(FIRST_CONSTRUCT.start);
    expect(state.goal).toEqual(FIRST_CONSTRUCT.goal);
    expect(state.tickCount).toBe(0);
    expect(state.agent.qTable).toEqual({}); // nothing learned yet
  });
});

describe('loadOrInitializeSim', () => {
  it('initializes and persists a fresh Sim when storage is empty', async () => {
    const store = fakeStore(null);
    const state = await loadOrInitializeSim(store, () => initialSimState(FIRST_CONSTRUCT));

    expect(state.tickCount).toBe(0);
    expect(store.saveSim).toHaveBeenCalledOnce();
    expect(store.saved).toEqual(state);
  });

  it('rehydrates existing state and NEVER reinitializes it (constraints 1 & 2)', async () => {
    // A Sim that has already lived: advanced ticks and learned Q-values.
    const lived: PersistedSimState = {
      ...initialSimState(FIRST_CONSTRUCT),
      tickCount: 4321,
      agent: { ...initialSimState(FIRST_CONSTRUCT).agent, qTable: { '0,0': [1, 2, 3, 4] } },
    };
    const store = fakeStore(lived);
    const initial = vi.fn(() => initialSimState(FIRST_CONSTRUCT));

    const state = await loadOrInitializeSim(store, initial);

    expect(state).toEqual(lived); // returned as-is
    expect(initial).not.toHaveBeenCalled(); // no fresh state was built
    expect(store.saveSim).not.toHaveBeenCalled(); // nothing overwritten
  });
});
