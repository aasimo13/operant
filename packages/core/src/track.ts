import { parseConstruct, type Construct } from './construct';

/**
 * The second Construct in the Sim's life: a race track. A ring corridor around a
 * solid centre, with four ordered checkpoints (0→1→2→3) placed clockwise around
 * the loop. The Sim must reach them in sequence to complete a lap, then wrap to
 * the first and go again — endless laps, no completion state, in the spirit of
 * Can't Help Myself.
 *
 * `S` = start, digits = ordered checkpoints, `#` = wall, `.` = open track.
 */
const LAYOUT = [
  'S....0....',
  '.########.',
  '.########.',
  '.########.',
  '.########1',
  '3########.',
  '.########.',
  '.########.',
  '.########.',
  '....2.....',
] as const;

export const THE_TRACK: Construct = parseConstruct('track', LAYOUT);
