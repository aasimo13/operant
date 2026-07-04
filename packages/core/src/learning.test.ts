import { describe, expect, it } from 'vitest';
import { QLearningAgent } from './qLearningAgent';
import { FIRST_CONSTRUCT } from './firstConstruct';
import { shortestPathLength } from './construct';
import { step } from './environment';
import { positionKey, type GridPosition } from './grid';
import { createRng, type Rng } from './rng';

const GOAL = FIRST_CONSTRUCT.goal;
const OPEN = FIRST_CONSTRUCT.openCells();
const OPTIMAL = shortestPathLength(FIRST_CONSTRUCT, FIRST_CONSTRUCT.start, GOAL)!;

function randomOpenCell(rng: Rng): GridPosition {
  return OPEN[Math.floor(rng() * OPEN.length)]!;
}

/**
 * Train an agent against the (fixed) first-Construct goal. Random restarts on
 * arrival keep exploration covering the whole space — the Sim keeps its learned
 * Q-values across restarts, only its position changes.
 */
function train(agent: QLearningAgent, steps: number, rng: Rng): void {
  let pos = randomOpenCell(rng);
  for (let i = 0; i < steps; i++) {
    const stateKey = positionKey(pos);
    const action = agent.chooseAction(stateKey, rng);
    const outcome = step(FIRST_CONSTRUCT, pos, action, GOAL);
    agent.update(stateKey, action, outcome.reward, positionKey(outcome.nextPosition));
    agent.decayEpsilon();
    pos = outcome.reachedGoal ? randomOpenCell(rng) : outcome.nextPosition;
  }
}

/** Follow the greedy policy from start; return steps taken (capped). */
function greedyStepsToGoal(agent: QLearningAgent, cap: number): number {
  let pos = FIRST_CONSTRUCT.start;
  let steps = 0;
  while (positionKey(pos) !== positionKey(GOAL) && steps < cap) {
    const action = agent.greedyAction(positionKey(pos));
    pos = step(FIRST_CONSTRUCT, pos, action, GOAL).nextPosition;
    steps += 1;
  }
  return steps;
}

describe('Q-learning convergence on the first Construct', () => {
  const CAP = 500;

  it('an untrained Sim cannot reach the goal (greedy walk loops)', () => {
    const fresh = new QLearningAgent();
    expect(greedyStepsToGoal(fresh, CAP)).toBe(CAP); // never arrives
  });

  it('a trained Sim reaches the goal on a near-optimal path', () => {
    const agent = new QLearningAgent();
    train(agent, 300_000, createRng(123_456));

    const steps = greedyStepsToGoal(agent, CAP);

    expect(steps).toBeLessThan(CAP); // actually arrives
    expect(positionKeyReached(agent)).toBe(true);
    // Converged policy should be optimal, allowing a tiny slack for ties.
    expect(steps).toBeLessThanOrEqual(OPTIMAL + 2);
    expect(steps).toBeGreaterThanOrEqual(OPTIMAL); // can't beat the shortest path
  });
});

function positionKeyReached(agent: QLearningAgent): boolean {
  let pos = FIRST_CONSTRUCT.start;
  for (let i = 0; i < 500; i++) {
    if (positionKey(pos) === positionKey(GOAL)) return true;
    const action = agent.greedyAction(positionKey(pos));
    pos = step(FIRST_CONSTRUCT, pos, action, GOAL).nextPosition;
  }
  return positionKey(pos) === positionKey(GOAL);
}
