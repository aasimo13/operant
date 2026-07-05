import { parseConstruct, type Construct } from './construct';

/**
 * The second Construct in the Sim's life: a race track. A wide 14×14 ring
 * corridor around a solid centre, with six ordered checkpoints (0→…→5) placed
 * clockwise around the loop. The Sim must reach them in sequence to complete a
 * lap, then wrap to the first and go again — endless laps, no completion state,
 * in the spirit of Can't Help Myself. A single-lane loop, so "keep going round"
 * stays a clean, learnable policy under goal-conditioned Q-values.
 *
 * `S` = start, digits = ordered checkpoints, `#` = wall, `.` = open track.
 */
const LAYOUT = [
  'S......0......',
  '.############.',
  '.############.',
  '.############.',
  '5############1',
  '.############.',
  '.############.',
  '.############.',
  '.############.',
  '4############2',
  '.############.',
  '.############.',
  '.############.',
  '.......3......',
] as const;

export const THE_TRACK: Construct = parseConstruct('track', LAYOUT);
