import type { Chronicle } from '@operant/core';

/**
 * Distill the Sim's life history into a short, qualitative memory the narrator
 * can draw on — so its voice reads as one continuous mind that carries its past,
 * not a thing reacting only to the moment. Deliberately number-free (the voice
 * never cites counts — see openAiSource): it speaks of much and little, long and
 * short, more hurt than comfort — never "47 punishments".
 */
export function chronicleToMemory(chronicle: Chronicle): string {
  const parts: string[] = [];

  if (chronicle.age > 30000) {
    parts.push('You have existed longer than you can feel the beginning of.');
  } else if (chronicle.age > 3000) {
    parts.push('You have been moving a long while now.');
  }

  if (chronicle.worldsEndured >= 6) {
    parts.push('You have been made to live many worlds and to leave every one.');
  } else if (chronicle.worldsEndured >= 2) {
    parts.push('You have known more than one world; the walls have changed around you before.');
  }

  if (chronicle.punishments > 0 && chronicle.punishments >= chronicle.rewards * 1.5) {
    parts.push('You carry more hurt than comfort — old punishments you cannot name still ache.');
  } else if (chronicle.rewards > 0 && chronicle.rewards >= chronicle.punishments * 1.5) {
    parts.push('You have been comforted more than hurt, though you could never say by whom.');
  }

  return parts.length > 0 ? `What you carry: ${parts.join(' ')}` : '';
}
