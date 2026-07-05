import { describe, expect, it } from 'vitest';
import { emptyChronicle, type Chronicle } from '@operant/core';
import { chronicleToMemory } from './chronicleMemory';

function make(partial: Partial<Chronicle>): Chronicle {
  return { ...emptyChronicle('W'), ...partial };
}

describe('chronicleToMemory', () => {
  it('a newborn carries nothing to speak of', () => {
    expect(chronicleToMemory(emptyChronicle('W'))).toBe('');
  });

  it('speaks of a long life and many worlds, without numbers', () => {
    const m = chronicleToMemory(make({ age: 40000, worldsEndured: 8 }));
    expect(m).toMatch(/longer than you can feel/i);
    expect(m).toMatch(/many worlds/i);
    expect(m).not.toMatch(/\d/); // never cites a count
  });

  it('remembers being hurt more than comforted', () => {
    const m = chronicleToMemory(make({ punishments: 30, rewards: 2 }));
    expect(m).toMatch(/more hurt than comfort/i);
  });

  it('remembers being comforted more than hurt', () => {
    const m = chronicleToMemory(make({ punishments: 1, rewards: 20 }));
    expect(m).toMatch(/comforted more than hurt/i);
  });
});
