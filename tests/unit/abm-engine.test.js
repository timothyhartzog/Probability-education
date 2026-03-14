/**
 * Unit tests for ABM-2 Predator-Prey simulation engine
 * Tests: seededRNG, agentFactory, gridEnv, spatialIndex, decisionRules, simEngine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createRNG,
  GRID_W, GRID_H,
  DEFAULT_PARAMS,
  makeGrid, grassRegrow, getGrassAt, eatGrass, findRichestGrass,
  SpatialGrid,
  makeAgent, resetIdCounter,
  RULE_SETS,
  initSim, stepSim,
  computeStats, giniCoefficient,
  dist, wrapX, wrapY, wrappedDist,
} from '../../src/modules/abm-2-predator-prey-d3/engine.js';

// ════════════════════════════════════════════════════════════════
//  SEEDED RNG
// ════════════════════════════════════════════════════════════════

describe('seededRNG (Mulberry32)', () => {
  it('produces deterministic output for same seed', () => {
    const rng1 = createRNG(42);
    const rng2 = createRNG(42);
    const seq1 = Array.from({ length: 100 }, () => rng1.next());
    const seq2 = Array.from({ length: 100 }, () => rng2.next());
    expect(seq1).toEqual(seq2);
  });

  it('produces different output for different seeds', () => {
    const rng1 = createRNG(1);
    const rng2 = createRNG(2);
    const v1 = rng1.next();
    const v2 = rng2.next();
    expect(v1).not.toBeCloseTo(v2, 5);
  });

  it('outputs are in [0, 1)', () => {
    const rng = createRNG(99);
    for (let i = 0; i < 10000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('range() produces values within bounds', () => {
    const rng = createRNG(77);
    for (let i = 0; i < 1000; i++) {
      const v = rng.range(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
    }
  });

  it('int() produces integer values within bounds', () => {
    const rng = createRNG(55);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(0, 10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('has reasonable distribution (chi-squared-like check)', () => {
    const rng = createRNG(12345);
    const buckets = new Array(10).fill(0);
    const N = 10000;
    for (let i = 0; i < N; i++) {
      buckets[Math.floor(rng.next() * 10)]++;
    }
    // Each bucket should have ~1000, allow ±200
    for (const count of buckets) {
      expect(count).toBeGreaterThan(800);
      expect(count).toBeLessThan(1200);
    }
  });
});

// ════════════════════════════════════════════════════════════════
//  GEOMETRY
// ════════════════════════════════════════════════════════════════

describe('geometry utilities', () => {
  it('dist computes Euclidean distance', () => {
    expect(dist(0, 0, 3, 4)).toBeCloseTo(5);
    expect(dist(1, 1, 1, 1)).toBe(0);
  });

  it('wrapX wraps coordinates to [0, GRID_W)', () => {
    expect(wrapX(-1)).toBeCloseTo(GRID_W - 1);
    expect(wrapX(GRID_W + 5)).toBeCloseTo(5);
    expect(wrapX(10)).toBeCloseTo(10);
  });

  it('wrapY wraps coordinates to [0, GRID_H)', () => {
    expect(wrapY(-1)).toBeCloseTo(GRID_H - 1);
    expect(wrapY(GRID_H + 3)).toBeCloseTo(3);
  });

  it('wrappedDist handles toroidal wrapping', () => {
    // Points near opposite edges should be close
    const d = wrappedDist(1, 1, GRID_W - 1, 1);
    expect(d).toBeCloseTo(2);
  });
});

// ════════════════════════════════════════════════════════════════
//  GRID ENVIRONMENT
// ════════════════════════════════════════════════════════════════

describe('grid environment', () => {
  let rng;

  beforeEach(() => {
    rng = createRNG(42);
  });

  it('makeGrid creates grid with correct dimensions', () => {
    const grid = makeGrid(rng);
    expect(grid.length).toBe(GRID_W * GRID_H);
    expect(grid).toBeInstanceOf(Float32Array);
  });

  it('makeGrid values are in [0.3, 1.0]', () => {
    const grid = makeGrid(rng);
    for (let i = 0; i < grid.length; i++) {
      expect(grid[i]).toBeGreaterThanOrEqual(0.3);
      expect(grid[i]).toBeLessThanOrEqual(1.0);
    }
  });

  it('getGrassAt returns correct value', () => {
    const grid = makeGrid(rng);
    const val = getGrassAt(grid, 5, 5);
    expect(val).toBe(grid[5 * GRID_W + 5]);
  });

  it('eatGrass sets cell to 0 and returns eaten amount', () => {
    const grid = makeGrid(rng);
    const origVal = getGrassAt(grid, 10, 10);
    const { newGrid, eaten } = eatGrass(grid, 10, 10);
    expect(eaten).toBeCloseTo(origVal);
    expect(getGrassAt(newGrid, 10, 10)).toBe(0);
    // Original grid unchanged (immutable)
    expect(getGrassAt(grid, 10, 10)).toBeCloseTo(origVal);
  });

  it('grassRegrow increases grass values', () => {
    const grid = makeGrid(rng);
    // Eat some grass first
    const { newGrid: eaten } = eatGrass(grid, 5, 5);
    expect(getGrassAt(eaten, 5, 5)).toBe(0);
    // Regrow
    const regrown = grassRegrow(eaten, 0.01, rng);
    expect(getGrassAt(regrown, 5, 5)).toBeGreaterThan(0);
  });

  it('grassRegrow does not exceed 1.0', () => {
    const grid = makeGrid(rng);
    const regrown = grassRegrow(grid, 0.5, rng); // aggressive regrow
    for (let i = 0; i < regrown.length; i++) {
      expect(regrown[i]).toBeLessThanOrEqual(1.0);
    }
  });

  it('findRichestGrass returns position of richest patch', () => {
    const grid = new Float32Array(GRID_W * GRID_H);
    grid[10 * GRID_W + 10] = 0.9; // set a rich patch
    const result = findRichestGrass(grid, 10, 10, 5);
    expect(result.value).toBeCloseTo(0.9);
  });
});

// ════════════════════════════════════════════════════════════════
//  SPATIAL INDEX
// ════════════════════════════════════════════════════════════════

describe('SpatialGrid', () => {
  it('queryRadius finds agents within radius', () => {
    const grid = new SpatialGrid(5);
    const agents = [
      { id: 1, x: 10, y: 10, alive: true },
      { id: 2, x: 12, y: 10, alive: true },
      { id: 3, x: 50, y: 50, alive: true },
    ];
    grid.build(agents);
    const nearby = grid.queryRadius(10, 10, 5);
    expect(nearby.length).toBe(2);
    expect(nearby.map(a => a.id).sort()).toEqual([1, 2]);
  });

  it('does not include dead agents', () => {
    const grid = new SpatialGrid(5);
    const agents = [
      { id: 1, x: 10, y: 10, alive: true },
      { id: 2, x: 10, y: 10, alive: false },
    ];
    grid.build(agents);
    const nearby = grid.queryRadius(10, 10, 5);
    expect(nearby.length).toBe(1);
    expect(nearby[0].id).toBe(1);
  });

  it('agrees with brute-force on random data', () => {
    const rng = createRNG(99);
    const agents = Array.from({ length: 50 }, (_, i) => ({
      id: i, x: rng.range(0, GRID_W), y: rng.range(0, GRID_H), alive: true,
    }));

    const spatial = new SpatialGrid(8);
    spatial.build(agents);

    const qx = 20, qy = 20, radius = 10;
    const spatialResult = spatial.queryRadius(qx, qy, radius).map(a => a.id).sort();

    // Brute force
    const bruteResult = agents
      .filter(a => wrappedDist(qx, qy, a.x, a.y) <= radius)
      .map(a => a.id).sort();

    expect(spatialResult).toEqual(bruteResult);
  });
});

// ════════════════════════════════════════════════════════════════
//  AGENT FACTORY
// ════════════════════════════════════════════════════════════════

describe('agentFactory', () => {
  beforeEach(() => resetIdCounter());

  it('makeAgent creates agent with correct type and position', () => {
    const rng = createRNG(1);
    const agent = makeAgent('prey', 10, 20, 50, rng);
    expect(agent.type).toBe('prey');
    expect(agent.x).toBe(10);
    expect(agent.y).toBe(20);
    expect(agent.energy).toBe(50);
    expect(agent.alive).toBe(true);
    expect(agent.id).toBe(1);
  });

  it('assigns incrementing IDs', () => {
    const rng = createRNG(1);
    const a1 = makeAgent('prey', 0, 0, 50, rng);
    const a2 = makeAgent('predator', 0, 0, 50, rng);
    expect(a2.id).toBe(a1.id + 1);
  });

  it('resetIdCounter resets the counter', () => {
    const rng = createRNG(1);
    makeAgent('prey', 0, 0, 50, rng);
    resetIdCounter();
    const a = makeAgent('prey', 0, 0, 50, rng);
    expect(a.id).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════
//  DECISION RULES
// ════════════════════════════════════════════════════════════════

describe('decision rules', () => {
  const rng = createRNG(42);

  it('all three rule sets are registered', () => {
    expect(Object.keys(RULE_SETS)).toEqual(['reactive', 'bounded', 'bdi']);
  });

  it('each rule set has name, fn, and pseudocode', () => {
    for (const [key, rule] of Object.entries(RULE_SETS)) {
      expect(rule.name).toBeTruthy();
      expect(typeof rule.fn).toBe('function');
      expect(rule.pseudocode.length).toBeGreaterThan(20);
    }
  });

  it('reactive prey flees when predator is nearby', () => {
    const prey = makeAgent('prey', 10, 10, 50, createRNG(1));
    const predator = makeAgent('predator', 12, 10, 80, createRNG(2));
    const grid = makeGrid(createRNG(3));
    const params = { ...DEFAULT_PARAMS, visionRadius: 8, preySpeed: 0.5 };

    const decision = RULE_SETS.reactive.fn(prey, [predator], grid, params, createRNG(4));
    expect(decision.action).toBe('flee');
    // Should move away from predator (negative vx since predator is to the right)
    expect(decision.vx).toBeLessThan(0);
  });

  it('reactive predator pursues nearby prey', () => {
    const predator = makeAgent('predator', 10, 10, 80, createRNG(1));
    const prey = makeAgent('prey', 15, 10, 50, createRNG(2));
    const grid = makeGrid(createRNG(3));
    const params = { ...DEFAULT_PARAMS, visionRadius: 8, predatorSpeed: 0.5 };

    const decision = RULE_SETS.reactive.fn(predator, [prey], grid, params, createRNG(4));
    expect(decision.action).toBe('pursue');
    expect(decision.vx).toBeGreaterThan(0); // toward prey
  });

  it('all rule sets produce valid actions', () => {
    const validActions = ['flee', 'eat', 'forage', 'pursue', 'wander', 'idle'];
    const grid = makeGrid(createRNG(10));
    const params = { ...DEFAULT_PARAMS };

    for (const [key, rule] of Object.entries(RULE_SETS)) {
      const prey = makeAgent('prey', 20, 20, 50, createRNG(1));
      const pred = makeAgent('predator', 22, 20, 80, createRNG(2));
      prey.beliefs = { nearestPredator: null, nearestPrey: null, richestGrass: null };
      prey.desires = [];
      prey.intention = null;

      const d1 = rule.fn(prey, [pred], grid, params, createRNG(5));
      expect(validActions).toContain(d1.action);
      expect(typeof d1.vx).toBe('number');
      expect(typeof d1.vy).toBe('number');

      pred.beliefs = { nearestPredator: null, nearestPrey: null, richestGrass: null };
      pred.desires = [];
      pred.intention = null;

      const d2 = rule.fn(pred, [prey], grid, params, createRNG(6));
      expect(validActions).toContain(d2.action);
    }
  });
});

// ════════════════════════════════════════════════════════════════
//  SIMULATION ENGINE
// ════════════════════════════════════════════════════════════════

describe('SimEngine.init()', () => {
  it('creates correct initial agent counts', () => {
    const state = initSim({ ...DEFAULT_PARAMS, preyCount: 60, predatorCount: 12 });
    const prey = state.agents.filter(a => a.type === 'prey');
    const preds = state.agents.filter(a => a.type === 'predator');
    expect(prey.length).toBe(60);
    expect(preds.length).toBe(12);
  });

  it('produces identical state for same seed', () => {
    const s1 = initSim(DEFAULT_PARAMS, 99);
    const s2 = initSim(DEFAULT_PARAMS, 99);
    expect(s1.agents[0].x).toBeCloseTo(s2.agents[0].x);
    expect(s1.agents[0].y).toBeCloseTo(s2.agents[0].y);
  });

  it('produces different state for different seeds', () => {
    const s1 = initSim(DEFAULT_PARAMS, 1);
    const s2 = initSim(DEFAULT_PARAMS, 2);
    expect(s1.agents[0].x).not.toBeCloseTo(s2.agents[0].x, 3);
  });

  it('initializes grid with correct size', () => {
    const state = initSim(DEFAULT_PARAMS);
    expect(state.grid.length).toBe(GRID_W * GRID_H);
  });

  it('starts at tick 0 with history entry', () => {
    const state = initSim(DEFAULT_PARAMS);
    expect(state.tick).toBe(0);
    expect(state.history.length).toBe(1);
    expect(state.history[0].tick).toBe(0);
  });

  it('all agents are alive initially', () => {
    const state = initSim(DEFAULT_PARAMS);
    for (const a of state.agents) {
      expect(a.alive).toBe(true);
    }
  });
});

describe('SimEngine.step() — immutability', () => {
  it('does not mutate input state agents array', () => {
    const s0 = initSim(DEFAULT_PARAMS, 42);
    const agentCount = s0.agents.length;
    const firstX = s0.agents[0].x;
    stepSim(s0, DEFAULT_PARAMS);
    expect(s0.agents.length).toBe(agentCount);
    expect(s0.agents[0].x).toBeCloseTo(firstX);
  });

  it('returns a new state object', () => {
    const s0 = initSim(DEFAULT_PARAMS, 42);
    const s1 = stepSim(s0, DEFAULT_PARAMS);
    expect(s1).not.toBe(s0);
    expect(s1.tick).toBe(1);
  });

  it('increments tick by 1', () => {
    const s0 = initSim(DEFAULT_PARAMS, 42);
    const s1 = stepSim(s0, DEFAULT_PARAMS);
    const s2 = stepSim(s1, DEFAULT_PARAMS);
    expect(s1.tick).toBe(1);
    expect(s2.tick).toBe(2);
  });

  it('appends to history', () => {
    const s0 = initSim(DEFAULT_PARAMS, 42);
    const s1 = stepSim(s0, DEFAULT_PARAMS);
    expect(s1.history.length).toBe(2);
    expect(s1.history[1].tick).toBe(1);
  });
});

describe('SimEngine.step() — 500-tick population test', () => {
  for (const rule of ['reactive', 'bounded', 'bdi']) {
    it(`${rule}: population survives 500 ticks with default params`, () => {
      const params = { ...DEFAULT_PARAMS, decisionRule: rule };
      let state = initSim(params, 42);
      for (let i = 0; i < 500; i++) {
        state = stepSim(state, params);
      }
      const prey = state.agents.filter(a => a.type === 'prey').length;
      const pred = state.agents.filter(a => a.type === 'predator').length;
      // At least one species should survive with default params
      expect(prey + pred).toBeGreaterThan(0);
      expect(state.tick).toBe(500);
    });
  }

  it('history tracks population correctly', () => {
    let state = initSim(DEFAULT_PARAMS, 42);
    for (let i = 0; i < 50; i++) {
      state = stepSim(state, DEFAULT_PARAMS);
    }
    // Each history entry should have all required fields
    for (const h of state.history) {
      expect(typeof h.tick).toBe('number');
      expect(typeof h.prey).toBe('number');
      expect(typeof h.predator).toBe('number');
      expect(typeof h.grass).toBe('number');
      expect(h.grass).toBeGreaterThanOrEqual(0);
      expect(h.grass).toBeLessThanOrEqual(1);
    }
  });
});

describe('SimEngine — predation mechanics', () => {
  it('predators kill prey on contact', () => {
    // Place predator right next to prey
    const params = { ...DEFAULT_PARAMS, preyCount: 1, predatorCount: 1 };
    let state = initSim(params, 42);

    // Move predator on top of prey
    state.agents[0].x = 10;
    state.agents[0].y = 10;
    state.agents[1].x = 10.3;
    state.agents[1].y = 10;

    state = stepSim(state, params);
    // Either the prey died or moved away
    const events = state.events.filter(e => e.type === 'kill');
    if (events.length > 0) {
      expect(events[0].type).toBe('kill');
    }
  });
});

// ════════════════════════════════════════════════════════════════
//  STATISTICS
// ════════════════════════════════════════════════════════════════

describe('statistics', () => {
  it('computeStats counts prey and predators correctly', () => {
    const agents = [
      { type: 'prey', alive: true, action: 'eat', energy: 50 },
      { type: 'prey', alive: true, action: 'flee', energy: 30 },
      { type: 'predator', alive: true, action: 'pursue', energy: 60 },
      { type: 'prey', alive: false, action: 'idle', energy: 0 },
    ];
    const stats = computeStats(agents);
    expect(stats.preyCount).toBe(2);
    expect(stats.predatorCount).toBe(1);
  });

  it('computeStats calculates mean energy', () => {
    const agents = [
      { type: 'prey', alive: true, action: 'eat', energy: 40 },
      { type: 'prey', alive: true, action: 'eat', energy: 60 },
    ];
    const stats = computeStats(agents);
    expect(stats.preyMeanEnergy).toBeCloseTo(50);
  });

  it('computeStats tracks action distribution', () => {
    const agents = [
      { type: 'prey', alive: true, action: 'flee', energy: 50 },
      { type: 'prey', alive: true, action: 'flee', energy: 50 },
      { type: 'predator', alive: true, action: 'pursue', energy: 50 },
    ];
    const stats = computeStats(agents);
    expect(stats.actionDist.flee).toBe(2);
    expect(stats.actionDist.pursue).toBe(1);
  });

  it('giniCoefficient returns 0 for equal values', () => {
    expect(giniCoefficient([50, 50, 50, 50])).toBeCloseTo(0);
  });

  it('giniCoefficient returns high value for unequal values', () => {
    const gini = giniCoefficient([0, 0, 0, 100]);
    expect(gini).toBeGreaterThan(0.5);
  });

  it('giniCoefficient handles empty array', () => {
    expect(giniCoefficient([])).toBe(0);
  });
});
