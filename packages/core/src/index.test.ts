import { describe, expect, it } from 'vitest';
import { ACTIONS, CORE_VERSION, type Action } from './index';

describe('@operant/core scaffold', () => {
  it('exposes a version marker', () => {
    expect(CORE_VERSION).toBe('0.0.0');
  });

  it('defines exactly the four grid actions in a stable order', () => {
    const expected: Action[] = ['up', 'down', 'left', 'right'];
    expect([...ACTIONS]).toEqual(expected);
  });
});
