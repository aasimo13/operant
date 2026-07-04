import { parseConstruct, type Construct } from './construct';

/**
 * The first Construct the Sim wakes into: a hand-designed 10x10 maze with a
 * single goal, a mix of dead ends, and at least one solvable path (see
 * CLAUDE.md — "First Construct"). Column 0 and the bottom row are kept open so
 * a path from start (top-left) to goal (bottom-right) always exists; the
 * interior adds branches and dead ends so it reads as a real space to explore.
 *
 * `S` = start, `G` = goal, `#` = wall, `.` = open.
 */
const LAYOUT = [
  'S...#.....',
  '..#.#.###.',
  '..#...#...',
  '.##.####.#',
  '....#....#',
  '.#.##.##.#',
  '...#..#...',
  '.#.#.##.##',
  '.#.....#..',
  '.........G',
] as const;

export const FIRST_CONSTRUCT: Construct = parseConstruct('first', LAYOUT);
