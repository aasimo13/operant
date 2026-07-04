import { describe, expect, it } from 'vitest';
import { SimEngine, QLearningAgent, parseConstruct, createRng } from '@operant/core';
import {
  buildConstructView,
  buildHeatmap,
  buildStateView,
  buildTickMessage,
  buildWelcome,
} from './protocol';

const construct = parseConstruct('view', ['S.#', '.#.', '..G']);

function engine(): SimEngine {
  return new SimEngine({
    construct,
    agent: new QLearningAgent({ epsilon: 0.2 }),
    rng: createRng(1),
  });
}

describe('buildConstructView', () => {
  it('exposes dimensions and a walls[y][x] grid for rendering', () => {
    const view = buildConstructView(construct);
    expect(view).toMatchObject({ id: 'view', width: 3, height: 3 });
    expect(view.walls[0]).toEqual([false, false, true]); // row 0: S . #
    expect(view.walls[1]).toEqual([false, true, false]); // row 1: . # .
    expect(view.walls[2]![2]).toBe(false); // goal cell is open
  });
});

describe('buildStateView', () => {
  it('captures the Sim’s live dynamic state', () => {
    const view = buildStateView(engine());
    expect(view.position).toEqual(construct.start);
    expect(view.goal).toEqual(construct.goal);
    expect(view.tickCount).toBe(0);
    expect(view.epsilon).toBeCloseTo(0.2);
  });
});

describe('buildWelcome', () => {
  it('bundles the construct, current state, and bounded recent backfill', () => {
    const e = engine();
    const r1 = e.tick();
    const welcome = buildWelcome(e, [r1]);
    expect(welcome.type).toBe('welcome');
    expect(welcome.construct.id).toBe('view');
    expect(welcome.state.tickCount).toBe(1);
    expect(welcome.recent).toEqual([r1]);
  });
});

describe('buildTickMessage', () => {
  it('carries the tick record plus the resulting state', () => {
    const e = engine();
    const record = e.tick();
    const msg = buildTickMessage(e, record);
    expect(msg.type).toBe('tick');
    expect(msg.record).toEqual(record);
    expect(msg.state.tickCount).toBe(1);
  });
});

describe('buildHeatmap', () => {
  it('carries a best-action value per cell (null for walls), matching the grid', () => {
    const e = engine();
    e.tick();
    const msg = buildHeatmap(e);
    expect(msg.type).toBe('heatmap');
    expect(msg.values).toHaveLength(construct.height);
    expect(msg.values[0]).toHaveLength(construct.width);
    expect(msg.values[0]![2]).toBeNull(); // wall at (2,0)
  });
});
