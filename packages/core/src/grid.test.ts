import { describe, expect, it } from 'vitest';
import { ACTIONS, applyAction, positionKey, type GridPosition } from './grid';

describe('grid', () => {
  it('has exactly the four cardinal actions in a stable order', () => {
    expect([...ACTIONS]).toEqual(['up', 'down', 'left', 'right']);
  });

  it('serializes a position to a stable string key', () => {
    expect(positionKey({ x: 3, y: 7 })).toBe('3,7');
  });

  describe('applyAction (intended move, ignoring walls/bounds)', () => {
    const origin: GridPosition = { x: 4, y: 4 };

    it('moves up by decrementing y (rows increase downward)', () => {
      expect(applyAction(origin, 'up')).toEqual({ x: 4, y: 3 });
    });

    it('moves down by incrementing y', () => {
      expect(applyAction(origin, 'down')).toEqual({ x: 4, y: 5 });
    });

    it('moves left by decrementing x', () => {
      expect(applyAction(origin, 'left')).toEqual({ x: 3, y: 4 });
    });

    it('moves right by incrementing x', () => {
      expect(applyAction(origin, 'right')).toEqual({ x: 5, y: 4 });
    });

    it('does not mutate the input position', () => {
      applyAction(origin, 'right');
      expect(origin).toEqual({ x: 4, y: 4 });
    });
  });
});
