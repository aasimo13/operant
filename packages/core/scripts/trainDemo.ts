/**
 * A runnable proof that the Sim learns — no rendering, no networking, just the
 * RL core and console output (build-order step 2: "prove it learns via
 * console/debug output before touching any rendering or networking").
 *
 * Run with:  pnpm --filter @operant/core demo
 *
 * It trains a Q-learning agent against the first Construct, prints how its
 * greedy path length falls toward the optimal (BFS) path over training, and
 * draws the final learned route through the maze.
 */
import {
  FIRST_CONSTRUCT,
  QLearningAgent,
  createRng,
  positionKey,
  shortestPathLength,
  step,
  type GridPosition,
  type Rng,
} from '../src/index';

const construct = FIRST_CONSTRUCT;
const goal = construct.goal;
const optimal = shortestPathLength(construct, construct.start, goal)!;
const openCells = construct.openCells();
const rng: Rng = createRng(0xc0ffee);

function randomOpenCell(): GridPosition {
  return openCells[Math.floor(rng() * openCells.length)]!;
}

/** Greedy path from start; returns the cells visited (capped to avoid loops). */
function greedyPath(agent: QLearningAgent, cap = 500): GridPosition[] {
  const path: GridPosition[] = [construct.start];
  let pos = construct.start;
  for (let i = 0; i < cap && positionKey(pos) !== positionKey(goal); i++) {
    const action = agent.greedyAction(positionKey(pos));
    pos = step(construct, pos, action, goal).nextPosition;
    path.push(pos);
  }
  return path;
}

function reached(path: GridPosition[]): boolean {
  return positionKey(path[path.length - 1]!) === positionKey(goal);
}

function render(path: GridPosition[]): string {
  const onPath = new Set(path.map(positionKey));
  const lines: string[] = [];
  for (let y = 0; y < construct.height; y++) {
    let line = '';
    for (let x = 0; x < construct.width; x++) {
      const key = positionKey({ x, y });
      if (key === positionKey(construct.start)) line += 'S';
      else if (key === positionKey(goal)) line += 'G';
      else if (construct.isWall({ x, y })) line += '█';
      else if (onPath.has(key)) line += '·';
      else line += ' ';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

const agent = new QLearningAgent();

console.log(`Operant — first Construct (${construct.width}x${construct.height})`);
console.log(`Optimal path (BFS): ${optimal} steps\n`);

const before = greedyPath(agent);
console.log(`Untrained greedy walk: reached goal = ${reached(before)}\n`);

const TOTAL = 300_000;
const REPORT_EVERY = 50_000;
let pos = randomOpenCell();
for (let i = 1; i <= TOTAL; i++) {
  const stateKey = positionKey(pos);
  const action = agent.chooseAction(stateKey, rng);
  const outcome = step(construct, pos, action, goal);
  agent.update(stateKey, action, outcome.reward, positionKey(outcome.nextPosition));
  agent.decayEpsilon();
  pos = outcome.reachedGoal ? randomOpenCell() : outcome.nextPosition;

  if (i % REPORT_EVERY === 0) {
    const path = greedyPath(agent);
    const len = reached(path) ? String(path.length - 1) : 'unreached';
    console.log(
      `  tick ${String(i).padStart(7)} | ε=${agent.epsilon.toFixed(3)} | greedy path: ${len}`,
    );
  }
}

const after = greedyPath(agent);
console.log(`\nTrained greedy route (· = path, █ = wall):\n`);
console.log(render(after));
console.log(
  `\nLearned path: ${after.length - 1} steps  (optimal ${optimal})  reached = ${reached(after)}`,
);
