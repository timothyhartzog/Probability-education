/**
 * @module engine
 * @description Pure simulation engine — seeded RNG, grid environment, agent factory,
 *              spatial index, three decision rule sets, and immutable step function.
 *              ZERO DOM/D3 imports. Pure ES2022 logic.
 * @see Project Plan Sections 3.1, 7.2
 */

// ════════════════════════════════════════════════════════════════
//  CONSTANTS
// ════════════════════════════════════════════════════════════════

export const GRID_W = 80;
export const GRID_H = 60;

export const DEFAULT_PARAMS = {
  preyCount:               80,
  predatorCount:           15,
  preySpeed:               0.35,
  predatorSpeed:           0.45,
  visionRadius:            8,
  maxEnergy:               100,
  preyMetabolism:          0.08,
  predatorMetabolism:      0.12,
  preyReproductionRate:    0.003,
  predatorReproductionRate:0.001,
  preyGrassGain:           25,
  predatorHuntGain:        40,
  grassRegrowRate:         0.003,
  fleeThreshold:          0.3,
  decisionRule:            'bounded',
  showTrails:              true,
  showVision:              false,
  seed:                    42,
};

export const PARAM_LIMITS = {
  preyCount:               { min: 10,    max: 300,   step: 5    },
  predatorCount:           { min: 2,     max: 80,    step: 1    },
  preySpeed:               { min: 0.05,  max: 1.2,   step: 0.05 },
  predatorSpeed:           { min: 0.05,  max: 1.5,   step: 0.05 },
  visionRadius:            { min: 2,     max: 25,    step: 1    },
  maxEnergy:               { min: 50,    max: 200,   step: 10   },
  preyMetabolism:          { min: 0.01,  max: 0.4,   step: 0.01 },
  predatorMetabolism:      { min: 0.01,  max: 0.5,   step: 0.01 },
  preyReproductionRate:    { min: 0,     max: 0.02,  step: 0.001},
  predatorReproductionRate:{ min: 0,     max: 0.008, step: 0.001},
  preyGrassGain:           { min: 5,     max: 80,    step: 5    },
  predatorHuntGain:        { min: 10,    max: 120,   step: 5    },
  grassRegrowRate:         { min: 0.001, max: 0.02,  step: 0.001},
  fleeThreshold:           { min: 0,     max: 1.0,   step: 0.05 },
};

export const PRESETS = {
  stable: {
    label: 'Stable Ecosystem',
    params: { preyCount: 80, predatorCount: 15, preyReproductionRate: 0.003,
              predatorReproductionRate: 0.001, grassRegrowRate: 0.003,
              preyMetabolism: 0.08, predatorMetabolism: 0.12 }
  },
  preyBoom: {
    label: 'Prey Boom',
    params: { preyCount: 120, predatorCount: 8, preyReproductionRate: 0.008,
              predatorReproductionRate: 0.001, grassRegrowRate: 0.006,
              preyMetabolism: 0.05, predatorMetabolism: 0.15 }
  },
  collapse: {
    label: 'Ecosystem Collapse',
    params: { preyCount: 60, predatorCount: 30, preyReproductionRate: 0.002,
              predatorReproductionRate: 0.003, grassRegrowRate: 0.002,
              preyMetabolism: 0.10, predatorMetabolism: 0.08 }
  },
  highEnergy: {
    label: 'High Energy',
    params: { preyCount: 100, predatorCount: 20, preyGrassGain: 60,
              predatorHuntGain: 80, preyMetabolism: 0.04, predatorMetabolism: 0.06,
              grassRegrowRate: 0.008 }
  },
};

// ════════════════════════════════════════════════════════════════
//  SEEDED RNG — Mulberry32
// ════════════════════════════════════════════════════════════════

export function createRNG(seed) {
  let s = seed | 0;
  return {
    next() {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    },
    range(lo, hi) { return lo + this.next() * (hi - lo); },
    int(lo, hi) { return Math.floor(this.range(lo, hi)); },
    getSeed() { return s; },
  };
}

// ════════════════════════════════════════════════════════════════
//  GEOMETRY UTILITIES
// ════════════════════════════════════════════════════════════════

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function wrapX(x) {
  return ((x % GRID_W) + GRID_W) % GRID_W;
}

export function wrapY(y) {
  return ((y % GRID_H) + GRID_H) % GRID_H;
}

export function wrappedDist(ax, ay, bx, by) {
  let dx = Math.abs(ax - bx);
  let dy = Math.abs(ay - by);
  if (dx > GRID_W / 2) dx = GRID_W - dx;
  if (dy > GRID_H / 2) dy = GRID_H - dy;
  return Math.hypot(dx, dy);
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ════════════════════════════════════════════════════════════════
//  GRID ENVIRONMENT
// ════════════════════════════════════════════════════════════════

export function makeGrid(rng) {
  const grid = new Float32Array(GRID_W * GRID_H);
  for (let i = 0; i < grid.length; i++) {
    grid[i] = 0.3 + rng.next() * 0.7; // initial grass 0.3–1.0
  }
  return grid;
}

export function grassRegrow(grid, rate, rng) {
  const newGrid = new Float32Array(grid);
  for (let i = 0; i < newGrid.length; i++) {
    if (newGrid[i] < 1.0) {
      newGrid[i] = Math.min(1.0, newGrid[i] + rate + rng.next() * rate * 0.5);
    }
  }
  return newGrid;
}

export function getGrassAt(grid, x, y) {
  const gx = clamp(Math.floor(x), 0, GRID_W - 1);
  const gy = clamp(Math.floor(y), 0, GRID_H - 1);
  return grid[gy * GRID_W + gx];
}

export function eatGrass(grid, x, y) {
  const gx = clamp(Math.floor(x), 0, GRID_W - 1);
  const gy = clamp(Math.floor(y), 0, GRID_H - 1);
  const newGrid = new Float32Array(grid);
  const eaten = newGrid[gy * GRID_W + gx];
  newGrid[gy * GRID_W + gx] = 0;
  return { newGrid, eaten };
}

export function findRichestGrass(grid, x, y, radius) {
  let bestVal = -1, bestX = x, bestY = y;
  const r = Math.ceil(radius);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const gx = ((Math.floor(x) + dx) % GRID_W + GRID_W) % GRID_W;
      const gy = ((Math.floor(y) + dy) % GRID_H + GRID_H) % GRID_H;
      const val = grid[gy * GRID_W + gx];
      if (val > bestVal) {
        bestVal = val;
        bestX = gx + 0.5;
        bestY = gy + 0.5;
      }
    }
  }
  return { x: bestX, y: bestY, value: bestVal };
}

// ════════════════════════════════════════════════════════════════
//  SPATIAL INDEX — Grid-based O(1) neighbor queries
// ════════════════════════════════════════════════════════════════

export class SpatialGrid {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  clear() { this.cells.clear(); }

  insert(agent) {
    const cx = Math.floor(agent.x / this.cellSize);
    const cy = Math.floor(agent.y / this.cellSize);
    const key = `${cx},${cy}`;
    if (!this.cells.has(key)) this.cells.set(key, []);
    this.cells.get(key).push(agent);
  }

  build(agents) {
    this.clear();
    for (const a of agents) {
      if (a.alive) this.insert(a);
    }
  }

  queryRadius(x, y, radius) {
    const results = [];
    const cr = Math.ceil(radius / this.cellSize);
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);

    for (let dy = -cr; dy <= cr; dy++) {
      for (let dx = -cr; dx <= cr; dx++) {
        const key = `${cx + dx},${cy + dy}`;
        const cell = this.cells.get(key);
        if (!cell) continue;
        for (const a of cell) {
          if (wrappedDist(x, y, a.x, a.y) <= radius) {
            results.push(a);
          }
        }
      }
    }
    return results;
  }
}

// ════════════════════════════════════════════════════════════════
//  AGENT FACTORY
// ════════════════════════════════════════════════════════════════

let _idCounter = 0;
export function resetIdCounter() { _idCounter = 0; }

export function makeAgent(type, x, y, energy, rng) {
  const speed = type === 'prey' ? 0.35 : 0.45;
  const angle = rng.next() * Math.PI * 2;
  return {
    id: ++_idCounter,
    type,
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    energy,
    action: 'idle',
    alive: true,
    age: 0,
    kills: 0,
    // BDI state
    beliefs: { nearestPredator: null, nearestPrey: null, richestGrass: null },
    desires: [],
    intention: null,
    // Trail
    trail: [],
  };
}

// ════════════════════════════════════════════════════════════════
//  DECISION RULES — Three rule sets
// ════════════════════════════════════════════════════════════════

/**
 * REACTIVE — simple if-then stimulus-response
 * Prey: flee if predator near, else forage (eat or move to grass)
 * Predator: pursue if prey near, else wander
 */
function reactiveDecision(agent, neighbors, grid, params, rng) {
  if (agent.type === 'prey') {
    // Check for nearby predators
    const threats = neighbors.filter(n => n.type === 'predator');
    if (threats.length > 0) {
      // Flee from nearest predator
      const nearest = threats.reduce((best, t) =>
        wrappedDist(agent.x, agent.y, t.x, t.y) <
        wrappedDist(agent.x, agent.y, best.x, best.y) ? t : best);
      const dx = agent.x - nearest.x;
      const dy = agent.y - nearest.y;
      const d = Math.hypot(dx, dy) || 1;
      return { action: 'flee', vx: (dx / d) * params.preySpeed * 1.4, vy: (dy / d) * params.preySpeed * 1.4 };
    }
    // Forage — eat grass at current position or move to richer patch
    const grassHere = getGrassAt(grid, agent.x, agent.y);
    if (grassHere > 0.3) {
      return { action: 'eat', vx: agent.vx * 0.2, vy: agent.vy * 0.2 };
    }
    const richest = findRichestGrass(grid, agent.x, agent.y, params.visionRadius * 0.5);
    if (richest.value > 0.3) {
      const dx = richest.x - agent.x;
      const dy = richest.y - agent.y;
      const d = Math.hypot(dx, dy) || 1;
      return { action: 'forage', vx: (dx / d) * params.preySpeed, vy: (dy / d) * params.preySpeed };
    }
    return { action: 'wander', vx: agent.vx + rng.range(-0.1, 0.1), vy: agent.vy + rng.range(-0.1, 0.1) };
  } else {
    // Predator
    const prey = neighbors.filter(n => n.type === 'prey');
    if (prey.length > 0) {
      const nearest = prey.reduce((best, p) =>
        wrappedDist(agent.x, agent.y, p.x, p.y) <
        wrappedDist(agent.x, agent.y, best.x, best.y) ? p : best);
      const dx = nearest.x - agent.x;
      const dy = nearest.y - agent.y;
      const d = Math.hypot(dx, dy) || 1;
      return { action: 'pursue', vx: (dx / d) * params.predatorSpeed, vy: (dy / d) * params.predatorSpeed };
    }
    return { action: 'wander', vx: agent.vx + rng.range(-0.15, 0.15), vy: agent.vy + rng.range(-0.15, 0.15) };
  }
}

/**
 * BOUNDED RATIONALITY — satisficing (Herbert Simon)
 * Agents consider a limited set of options and pick the first "good enough"
 */
function boundedDecision(agent, neighbors, grid, params, rng) {
  if (agent.type === 'prey') {
    const threats = neighbors.filter(n => n.type === 'predator');
    const grassHere = getGrassAt(grid, agent.x, agent.y);

    // Generate candidate actions (bounded set)
    const candidates = [];

    // Option 1: Flee if threatened
    if (threats.length > 0) {
      const nearest = threats.reduce((best, t) =>
        wrappedDist(agent.x, agent.y, t.x, t.y) <
        wrappedDist(agent.x, agent.y, best.x, best.y) ? t : best);
      const d = wrappedDist(agent.x, agent.y, nearest.x, nearest.y);
      const urgency = 1 - (d / params.visionRadius);
      candidates.push({ action: 'flee', score: urgency * 1.5,
        vx: ((agent.x - nearest.x) / (d || 1)) * params.preySpeed * 1.3,
        vy: ((agent.y - nearest.y) / (d || 1)) * params.preySpeed * 1.3 });
    }

    // Option 2: Eat if grass here
    if (grassHere > 0.2) {
      const hungerScore = 1 - (agent.energy / params.maxEnergy);
      candidates.push({ action: 'eat', score: hungerScore * grassHere,
        vx: agent.vx * 0.1, vy: agent.vy * 0.1 });
    }

    // Option 3: Forage toward rich grass
    const richest = findRichestGrass(grid, agent.x, agent.y, params.visionRadius * 0.6);
    if (richest.value > 0.4) {
      const dx = richest.x - agent.x;
      const dy = richest.y - agent.y;
      const d = Math.hypot(dx, dy) || 1;
      candidates.push({ action: 'forage', score: richest.value * 0.5,
        vx: (dx / d) * params.preySpeed, vy: (dy / d) * params.preySpeed });
    }

    // Option 4: Wander
    candidates.push({ action: 'wander', score: 0.1,
      vx: agent.vx + rng.range(-0.1, 0.1), vy: agent.vy + rng.range(-0.1, 0.1) });

    // Satisfice: pick first action that exceeds threshold
    const threshold = params.fleeThreshold;
    for (const c of candidates) {
      if (c.score >= threshold) return c;
    }
    // Fallback: best option
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
  } else {
    // Predator — bounded rationality
    const prey = neighbors.filter(n => n.type === 'prey');
    const candidates = [];

    if (prey.length > 0) {
      // Pick among visible prey — not necessarily the nearest
      const considered = prey.slice(0, 3); // bounded attention
      for (const p of considered) {
        const d = wrappedDist(agent.x, agent.y, p.x, p.y);
        const catchability = (1 - d / params.visionRadius) * (p.energy < 30 ? 1.3 : 1);
        const dx = p.x - agent.x;
        const dy = p.y - agent.y;
        const dd = Math.hypot(dx, dy) || 1;
        candidates.push({ action: 'pursue', score: catchability,
          vx: (dx / dd) * params.predatorSpeed, vy: (dy / dd) * params.predatorSpeed });
      }
    }

    candidates.push({ action: 'wander', score: 0.05,
      vx: agent.vx + rng.range(-0.15, 0.15), vy: agent.vy + rng.range(-0.15, 0.15) });

    const threshold = params.fleeThreshold * 0.5;
    for (const c of candidates) {
      if (c.score >= threshold) return c;
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
  }
}

/**
 * BDI — Beliefs-Desires-Intentions
 * Agents maintain beliefs about the world, form desires, and commit to intentions
 */
function bdiDecision(agent, neighbors, grid, params, rng) {
  // ── Update Beliefs ──
  const threats = neighbors.filter(n => n.type === 'predator');
  const preyNear = neighbors.filter(n => n.type === 'prey');
  const nearestThreat = threats.length > 0
    ? threats.reduce((best, t) =>
        wrappedDist(agent.x, agent.y, t.x, t.y) <
        wrappedDist(agent.x, agent.y, best.x, best.y) ? t : best)
    : null;
  const nearestPrey = preyNear.length > 0
    ? preyNear.reduce((best, p) =>
        wrappedDist(agent.x, agent.y, p.x, p.y) <
        wrappedDist(agent.x, agent.y, best.x, best.y) ? p : best)
    : null;
  const grassHere = getGrassAt(grid, agent.x, agent.y);
  const richest = findRichestGrass(grid, agent.x, agent.y, params.visionRadius * 0.7);

  agent.beliefs = {
    nearestPredator: nearestThreat ? { x: nearestThreat.x, y: nearestThreat.y,
      dist: wrappedDist(agent.x, agent.y, nearestThreat.x, nearestThreat.y) } : null,
    nearestPrey: nearestPrey ? { x: nearestPrey.x, y: nearestPrey.y,
      dist: wrappedDist(agent.x, agent.y, nearestPrey.x, nearestPrey.y),
      energy: nearestPrey.energy } : null,
    grassHere,
    richestGrass: richest,
    energyRatio: agent.energy / params.maxEnergy,
    threatCount: threats.length,
    preyCount: preyNear.length,
  };

  // ── Form Desires ──
  const desires = [];
  if (agent.type === 'prey') {
    if (agent.beliefs.nearestPredator && agent.beliefs.nearestPredator.dist < params.visionRadius * 0.7) {
      desires.push({ name: 'survive', priority: 2.0 - agent.beliefs.nearestPredator.dist / params.visionRadius });
    }
    if (agent.beliefs.energyRatio < 0.7) {
      desires.push({ name: 'eat', priority: 1.0 - agent.beliefs.energyRatio });
    }
    if (agent.beliefs.energyRatio > 0.8 && threats.length === 0) {
      desires.push({ name: 'explore', priority: 0.3 });
    }
    desires.push({ name: 'rest', priority: 0.1 });
  } else {
    // Predator desires
    if (agent.beliefs.nearestPrey) {
      const huntUrgency = (1 - agent.beliefs.energyRatio) + 0.3;
      desires.push({ name: 'hunt', priority: Math.min(huntUrgency, 1.5) });
    }
    if (agent.beliefs.energyRatio < 0.3) {
      desires.push({ name: 'hunt', priority: 1.8 }); // desperate
    }
    desires.push({ name: 'patrol', priority: 0.2 });
  }

  desires.sort((a, b) => b.priority - a.priority);
  agent.desires = desires.map(d => d.name);

  // ── Select Intention ──
  const topDesire = desires[0];
  // Commitment: stick with current intention unless a higher priority arises
  if (agent.intention && topDesire.priority < 0.8) {
    // Keep current intention with some probability
    if (rng.next() < 0.7) {
      // Re-execute current intention
      return executeIntention(agent, agent.intention, params, rng);
    }
  }
  agent.intention = topDesire.name;
  return executeIntention(agent, agent.intention, params, rng);
}

function executeIntention(agent, intention, params, rng) {
  const b = agent.beliefs;
  switch (intention) {
    case 'survive': {
      const pred = b.nearestPredator;
      if (!pred) return { action: 'wander', vx: agent.vx, vy: agent.vy };
      const dx = agent.x - pred.x;
      const dy = agent.y - pred.y;
      const d = Math.hypot(dx, dy) || 1;
      return { action: 'flee', vx: (dx / d) * params.preySpeed * 1.5, vy: (dy / d) * params.preySpeed * 1.5 };
    }
    case 'eat': {
      if (b.grassHere > 0.2) {
        return { action: 'eat', vx: 0, vy: 0 };
      }
      if (b.richestGrass && b.richestGrass.value > 0.3) {
        const dx = b.richestGrass.x - agent.x;
        const dy = b.richestGrass.y - agent.y;
        const d = Math.hypot(dx, dy) || 1;
        return { action: 'forage', vx: (dx / d) * params.preySpeed, vy: (dy / d) * params.preySpeed };
      }
      return { action: 'wander', vx: agent.vx + rng.range(-0.1, 0.1), vy: agent.vy + rng.range(-0.1, 0.1) };
    }
    case 'hunt': {
      const prey = b.nearestPrey;
      if (!prey) return { action: 'wander', vx: agent.vx + rng.range(-0.2, 0.2), vy: agent.vy + rng.range(-0.2, 0.2) };
      const dx = prey.x - agent.x;
      const dy = prey.y - agent.y;
      const d = Math.hypot(dx, dy) || 1;
      return { action: 'pursue', vx: (dx / d) * params.predatorSpeed, vy: (dy / d) * params.predatorSpeed };
    }
    case 'explore':
    case 'patrol':
    case 'rest':
    default:
      return { action: 'wander', vx: agent.vx + rng.range(-0.1, 0.1), vy: agent.vy + rng.range(-0.1, 0.1) };
  }
}

// Rule set registry
export const RULE_SETS = {
  reactive: {
    name: 'Reactive',
    fn: reactiveDecision,
    pseudocode:
`IF type = PREY:
  IF predator within vision THEN
    FLEE away from nearest predator
  ELSE IF grass > 0.3 at position THEN
    EAT grass
  ELSE IF rich grass in sight THEN
    FORAGE toward richest patch
  ELSE
    WANDER randomly

IF type = PREDATOR:
  IF prey within vision THEN
    PURSUE nearest prey
  ELSE
    WANDER randomly`,
  },
  bounded: {
    name: 'Bounded Rationality',
    fn: boundedDecision,
    pseudocode:
`Generate candidate actions (bounded set):
  1. Flee (if threat nearby, score = urgency)
  2. Eat  (if grass here, score = hunger × grass)
  3. Forage (if rich grass in sight, score = value)
  4. Wander (fallback, score = 0.1)

Satisfice: pick FIRST action with score ≥ threshold
If none: pick highest-scoring action`,
  },
  bdi: {
    name: 'BDI (Beliefs-Desires-Intentions)',
    fn: bdiDecision,
    pseudocode:
`UPDATE BELIEFS:
  Scan neighbors → nearest threat, prey, grass

FORM DESIRES (ranked by priority):
  Prey:  survive > eat > explore > rest
  Pred:  hunt > patrol

SELECT INTENTION:
  If committed & new priority < 0.8:
    70% chance: keep current intention
  Else: adopt top desire as intention

EXECUTE INTENTION:
  survive → flee from nearest predator
  eat     → eat here or forage to richest grass
  hunt    → pursue nearest prey
  patrol  → random walk`,
  },
};

// ════════════════════════════════════════════════════════════════
//  STATISTICS
// ════════════════════════════════════════════════════════════════

export function computeStats(agents) {
  const prey = agents.filter(a => a.alive && a.type === 'prey');
  const preds = agents.filter(a => a.alive && a.type === 'predator');

  const actionDist = {};
  for (const a of [...prey, ...preds]) {
    actionDist[a.action] = (actionDist[a.action] || 0) + 1;
  }

  const preyEnergies = prey.map(a => a.energy);
  const predEnergies = preds.map(a => a.energy);

  return {
    preyCount: prey.length,
    predatorCount: preds.length,
    preyMeanEnergy: preyEnergies.length > 0
      ? preyEnergies.reduce((s, e) => s + e, 0) / preyEnergies.length : 0,
    predMeanEnergy: predEnergies.length > 0
      ? predEnergies.reduce((s, e) => s + e, 0) / predEnergies.length : 0,
    preyEnergies,
    predEnergies,
    actionDist,
  };
}

export function giniCoefficient(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  if (mean === 0) return 0;
  let sumDiff = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumDiff += Math.abs(sorted[i] - sorted[j]);
    }
  }
  return sumDiff / (2 * n * n * mean);
}

// ════════════════════════════════════════════════════════════════
//  SIMULATION ENGINE
// ════════════════════════════════════════════════════════════════

export function initSim(params, seed) {
  resetIdCounter();
  const rng = createRNG(seed ?? params.seed);

  const agents = [];
  // Create prey
  for (let i = 0; i < params.preyCount; i++) {
    agents.push(makeAgent('prey', rng.range(0, GRID_W), rng.range(0, GRID_H),
      params.maxEnergy * (0.5 + rng.next() * 0.5), rng));
  }
  // Create predators
  for (let i = 0; i < params.predatorCount; i++) {
    agents.push(makeAgent('predator', rng.range(0, GRID_W), rng.range(0, GRID_H),
      params.maxEnergy * (0.6 + rng.next() * 0.4), rng));
  }

  const grid = makeGrid(rng);
  const stats = computeStats(agents);

  return {
    tick: 0,
    agents,
    grid,
    history: [{ tick: 0, prey: stats.preyCount, predator: stats.predatorCount,
                grass: grassPercent(grid) }],
    events: [],
    rng,
    gridDirty: true,
  };
}

function grassPercent(grid) {
  let total = 0;
  for (let i = 0; i < grid.length; i++) total += grid[i];
  return total / grid.length;
}

export function stepSim(state, params) {
  const rng = state.rng;
  const ruleFn = RULE_SETS[params.decisionRule]?.fn || RULE_SETS.bounded.fn;

  // Clone agents for immutability
  let agents = state.agents.map(a => ({
    ...a,
    beliefs: { ...a.beliefs },
    trail: [...a.trail],
  }));
  let grid = state.grid;
  const events = [];

  // Build spatial index
  const spatial = new SpatialGrid(Math.max(params.visionRadius, 4));
  spatial.build(agents);

  // ── Decision + Movement ──
  for (const agent of agents) {
    if (!agent.alive) continue;

    const neighbors = spatial.queryRadius(agent.x, agent.y, params.visionRadius)
      .filter(n => n.id !== agent.id && n.alive);

    const decision = ruleFn(agent, neighbors, grid, params, rng);
    agent.action = decision.action;

    // Apply velocity
    let speed = agent.type === 'prey' ? params.preySpeed : params.predatorSpeed;
    let vx = decision.vx, vy = decision.vy;
    const mag = Math.hypot(vx, vy);
    const maxSpeed = speed * (decision.action === 'flee' ? 1.5 : 1.2);
    if (mag > maxSpeed) {
      vx = (vx / mag) * maxSpeed;
      vy = (vy / mag) * maxSpeed;
    }

    agent.vx = vx;
    agent.vy = vy;
    agent.x = wrapX(agent.x + vx);
    agent.y = wrapY(agent.y + vy);

    // Trail
    agent.trail.push({ x: agent.x, y: agent.y });
    if (agent.trail.length > 30) agent.trail.shift();
  }

  // ── Prey eat grass ──
  for (const agent of agents) {
    if (!agent.alive || agent.type !== 'prey') continue;
    if (agent.action === 'eat' || agent.action === 'forage') {
      const grassVal = getGrassAt(grid, agent.x, agent.y);
      if (grassVal > 0.1) {
        const result = eatGrass(grid, agent.x, agent.y);
        grid = result.newGrid;
        agent.energy = Math.min(params.maxEnergy, agent.energy + result.eaten * params.preyGrassGain);
      }
    }
  }

  // ── Predators eat prey ──
  for (const pred of agents) {
    if (!pred.alive || pred.type !== 'predator') continue;
    for (const prey of agents) {
      if (!prey.alive || prey.type !== 'prey') continue;
      if (wrappedDist(pred.x, pred.y, prey.x, prey.y) < 0.8) {
        prey.alive = false;
        pred.energy = Math.min(params.maxEnergy, pred.energy + params.predatorHuntGain);
        pred.kills++;
        events.push({ type: 'kill', predId: pred.id, preyId: prey.id, tick: state.tick + 1 });
        break; // one kill per tick
      }
    }
  }

  // ── Metabolism ──
  for (const agent of agents) {
    if (!agent.alive) continue;
    const metabolism = agent.type === 'prey' ? params.preyMetabolism : params.predatorMetabolism;
    const actionCost = agent.action === 'flee' ? 1.5 : agent.action === 'pursue' ? 1.3 : 1.0;
    agent.energy -= metabolism * params.maxEnergy * actionCost;
    agent.age++;

    if (agent.energy <= 0) {
      agent.alive = false;
      events.push({ type: 'death', agentType: agent.type, id: agent.id,
                     cause: 'starvation', tick: state.tick + 1 });
    }
  }

  // ── Reproduction ──
  const newAgents = [];
  for (const agent of agents) {
    if (!agent.alive) continue;
    const reproRate = agent.type === 'prey'
      ? params.preyReproductionRate : params.predatorReproductionRate;
    if (agent.energy > params.maxEnergy * 0.5 && rng.next() < reproRate) {
      agent.energy *= 0.5;
      const child = makeAgent(agent.type,
        wrapX(agent.x + rng.range(-1, 1)),
        wrapY(agent.y + rng.range(-1, 1)),
        agent.energy, rng);
      newAgents.push(child);
      events.push({ type: 'birth', agentType: agent.type, parentId: agent.id,
                     childId: child.id, tick: state.tick + 1 });
    }
  }
  agents = [...agents, ...newAgents];

  // ── Grass regrowth ──
  grid = grassRegrow(grid, params.grassRegrowRate, rng);

  // Remove dead
  agents = agents.filter(a => a.alive);

  // Cap populations to prevent runaway
  if (agents.filter(a => a.type === 'prey').length > 400) {
    const prey = agents.filter(a => a.type === 'prey');
    const preds = agents.filter(a => a.type !== 'prey');
    agents = [...prey.slice(0, 400), ...preds];
  }

  const tick = state.tick + 1;
  const stats = computeStats(agents);
  const history = [...state.history, {
    tick,
    prey: stats.preyCount,
    predator: stats.predatorCount,
    grass: grassPercent(grid),
  }];

  // Keep history bounded
  const maxHistory = 2000;
  const trimmedHistory = history.length > maxHistory
    ? history.slice(history.length - maxHistory) : history;

  return {
    tick,
    agents,
    grid,
    history: trimmedHistory,
    events,
    rng,
    gridDirty: true,
  };
}
