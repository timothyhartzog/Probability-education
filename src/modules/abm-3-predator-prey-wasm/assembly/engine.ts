/**
 * @module assembly/engine
 * @description AssemblyScript → WASM predator-prey ABM engine.
 *              Pure computation — no DOM, no JS objects, no closures.
 *              Flat typed arrays for all agent/grid state.
 *              Three decision rules: reactive, bounded rationality, BDI.
 *
 * Memory layout: all state lives in typed arrays allocated in WASM heap.
 * JS reads agent/grid data via pointer getters + typed array views.
 *
 * Build: npx asc assembly/engine.ts -o pkg/engine.wasm --exportRuntime --optimize
 */

// ════════════════════════════════════════════════════════════════
//  CONSTANTS
// ════════════════════════════════════════════════════════════════

const GRID_W: i32 = 80;
const GRID_H: i32 = 60;
const GRID_SIZE: i32 = GRID_W * GRID_H;   // 4800

const MAX_AGENTS: i32  = 600;
const MAX_HISTORY: i32 = 2000;

// Spatial grid — fixed cell size, covers GRID_W × GRID_H
const SPATIAL_CELL_SIZE: f64 = 8.0;
const SPATIAL_COLS: i32 = 10;  // ceil(80 / 8)
const SPATIAL_ROWS: i32 = 8;   // ceil(60 / 8)
const SPATIAL_CELLS: i32 = SPATIAL_COLS * SPATIAL_ROWS;  // 80
const MAX_PER_CELL: i32  = 64;

// Neighbor scratch buffer (reused each query call)
const MAX_NEIGHBORS: i32 = 200;

// ── Action codes (exported as i32 in agent arrays) ────────────
const ACT_IDLE:   i32 = 0;
const ACT_FLEE:   i32 = 1;
const ACT_EAT:    i32 = 2;
const ACT_FORAGE: i32 = 3;
const ACT_WANDER: i32 = 4;
const ACT_PURSUE: i32 = 5;

// ── Type codes ────────────────────────────────────────────────
const TYPE_PREY: i32 = 0;
const TYPE_PRED: i32 = 1;

// ── Rule codes ────────────────────────────────────────────────
const RULE_REACTIVE: i32 = 0;
const RULE_BOUNDED:  i32 = 1;
const RULE_BDI:      i32 = 2;

// ── Intention codes (BDI) ─────────────────────────────────────
const INT_NONE:    i32 = 0;
const INT_SURVIVE: i32 = 1;
const INT_EAT:     i32 = 2;
const INT_HUNT:    i32 = 3;
const INT_EXPLORE: i32 = 4;
const INT_PATROL:  i32 = 5;
const INT_REST:    i32 = 6;

// ════════════════════════════════════════════════════════════════
//  STATE ARRAYS  (JS reads these via pointer + typed-array view)
// ════════════════════════════════════════════════════════════════

const agentX       = new Float64Array(MAX_AGENTS);
const agentY       = new Float64Array(MAX_AGENTS);
const agentVX      = new Float64Array(MAX_AGENTS);
const agentVY      = new Float64Array(MAX_AGENTS);
const agentEnergy  = new Float64Array(MAX_AGENTS);
const agentType    = new Int32Array(MAX_AGENTS);
const agentAction  = new Int32Array(MAX_AGENTS);
const agentAlive   = new Int32Array(MAX_AGENTS);   // 1 = alive, 0 = dead
const agentAge     = new Int32Array(MAX_AGENTS);
const agentKills   = new Int32Array(MAX_AGENTS);
const agentId      = new Int32Array(MAX_AGENTS);
const agentIntent  = new Int32Array(MAX_AGENTS);   // BDI intention

const grassGrid    = new Float64Array(GRID_SIZE);

const histTick     = new Int32Array(MAX_HISTORY);
const histPrey     = new Int32Array(MAX_HISTORY);
const histPred     = new Int32Array(MAX_HISTORY);
const histGrass    = new Float64Array(MAX_HISTORY);

// Internal scratch buffers
const spatialBuckets = new Int32Array(SPATIAL_CELLS * MAX_PER_CELL);
const spatialCount   = new Int32Array(SPATIAL_CELLS);
const neighborBuf    = new Int32Array(MAX_NEIGHBORS);

// ── Global mutable state ──────────────────────────────────────
let _agentCount: i32 = 0;
let _histLen:    i32 = 0;
let _tick:       i32 = 0;
let _nextId:     i32 = 1;
let _rngState:   u32 = 42;

// ════════════════════════════════════════════════════════════════
//  EXPORTS: state queries & pointer getters
// ════════════════════════════════════════════════════════════════

export function getTick():       i32 { return _tick; }
export function getAgentCount(): i32 { return _agentCount; }
export function getHistoryLen(): i32 { return _histLen; }
export function getGridW():      i32 { return GRID_W; }
export function getGridH():      i32 { return GRID_H; }

export function getAgentXPtr():      usize { return agentX.dataStart; }
export function getAgentYPtr():      usize { return agentY.dataStart; }
export function getAgentVXPtr():     usize { return agentVX.dataStart; }
export function getAgentVYPtr():     usize { return agentVY.dataStart; }
export function getAgentEnergyPtr(): usize { return agentEnergy.dataStart; }
export function getAgentTypePtr():   usize { return agentType.dataStart; }
export function getAgentActionPtr(): usize { return agentAction.dataStart; }
export function getAgentAlivePtr():  usize { return agentAlive.dataStart; }
export function getAgentAgePtr():    usize { return agentAge.dataStart; }
export function getAgentKillsPtr():  usize { return agentKills.dataStart; }
export function getAgentIdPtr():     usize { return agentId.dataStart; }
export function getAgentIntentPtr(): usize { return agentIntent.dataStart; }
export function getGrassPtr():       usize { return grassGrid.dataStart; }
export function getHistTickPtr():    usize { return histTick.dataStart; }
export function getHistPreyPtr():    usize { return histPrey.dataStart; }
export function getHistPredPtr():    usize { return histPred.dataStart; }
export function getHistGrassPtr():   usize { return histGrass.dataStart; }

// ════════════════════════════════════════════════════════════════
//  SEEDED RNG — Mulberry32 variant
// ════════════════════════════════════════════════════════════════

function rngNext(): f64 {
  _rngState = ((_rngState + 0x6D2B79F5) as u32);
  let t: u32 = (_rngState ^ (_rngState >>> 15)) * (1 | _rngState);
  t = (t ^ (t >>> 7)) * (61 | t) ^ t;
  return <f64>((t ^ (t >>> 14)) >>> 0) / 4294967296.0;
}

function rngRange(lo: f64, hi: f64): f64 {
  return lo + rngNext() * (hi - lo);
}

// ════════════════════════════════════════════════════════════════
//  GEOMETRY UTILITIES
// ════════════════════════════════════════════════════════════════

function wrapX(x: f64): f64 {
  return ((x % <f64>GRID_W) + <f64>GRID_W) % <f64>GRID_W;
}

function wrapY(y: f64): f64 {
  return ((y % <f64>GRID_H) + <f64>GRID_H) % <f64>GRID_H;
}

function clampF(v: f64, lo: f64, hi: f64): f64 {
  return v < lo ? lo : (v > hi ? hi : v);
}

function wrappedDist(ax: f64, ay: f64, bx: f64, by: f64): f64 {
  let dx = Math.abs(ax - bx);
  let dy = Math.abs(ay - by);
  const hw = <f64>GRID_W * 0.5, hh = <f64>GRID_H * 0.5;
  if (dx > hw) dx = <f64>GRID_W - dx;
  if (dy > hh) dy = <f64>GRID_H - dy;
  return Math.sqrt(dx * dx + dy * dy);
}

// ════════════════════════════════════════════════════════════════
//  GRID HELPERS
// ════════════════════════════════════════════════════════════════

function getGrassAt(x: f64, y: f64): f64 {
  const gx = <i32>clampF(Math.floor(x), 0, <f64>(GRID_W - 1));
  const gy = <i32>clampF(Math.floor(y), 0, <f64>(GRID_H - 1));
  return grassGrid[gy * GRID_W + gx];
}

function eatGrass(x: f64, y: f64): f64 {
  const gx = <i32>clampF(Math.floor(x), 0, <f64>(GRID_W - 1));
  const gy = <i32>clampF(Math.floor(y), 0, <f64>(GRID_H - 1));
  const idx = gy * GRID_W + gx;
  const val = grassGrid[idx];
  grassGrid[idx] = 0.0;
  return val;
}

// Returns best (x, y, val) as module-level temporaries to avoid allocation
let _grassBestX:   f64 = 0.0;
let _grassBestY:   f64 = 0.0;
let _grassBestVal: f64 = -1.0;

function findRichestGrass(x: f64, y: f64, radius: f64): void {
  _grassBestVal = -1.0;
  _grassBestX = x;
  _grassBestY = y;
  const r = <i32>Math.ceil(radius);
  for (let dy: i32 = -r; dy <= r; dy++) {
    for (let dx: i32 = -r; dx <= r; dx++) {
      if (<f64>(dx * dx + dy * dy) > radius * radius) continue;
      const gx = ((<i32>Math.floor(x) + dx) % GRID_W + GRID_W) % GRID_W;
      const gy = ((<i32>Math.floor(y) + dy) % GRID_H + GRID_H) % GRID_H;
      const val = grassGrid[gy * GRID_W + gx];
      if (val > _grassBestVal) {
        _grassBestVal = val;
        _grassBestX   = <f64>gx + 0.5;
        _grassBestY   = <f64>gy + 0.5;
      }
    }
  }
}

// ════════════════════════════════════════════════════════════════
//  SPATIAL INDEX — flat bucket array
// ════════════════════════════════════════════════════════════════

function spatialClear(): void {
  for (let i: i32 = 0; i < SPATIAL_CELLS; i++) spatialCount[i] = 0;
}

function spatialCellFor(x: f64, y: f64): i32 {
  let cx = <i32>(x / SPATIAL_CELL_SIZE);
  let cy = <i32>(y / SPATIAL_CELL_SIZE);
  if (cx < 0) cx = 0; else if (cx >= SPATIAL_COLS) cx = SPATIAL_COLS - 1;
  if (cy < 0) cy = 0; else if (cy >= SPATIAL_ROWS) cy = SPATIAL_ROWS - 1;
  return cy * SPATIAL_COLS + cx;
}

function spatialInsert(ai: i32): void {
  const cell = spatialCellFor(agentX[ai], agentY[ai]);
  const cnt  = spatialCount[cell];
  if (cnt < MAX_PER_CELL) {
    spatialBuckets[cell * MAX_PER_CELL + cnt] = ai;
    spatialCount[cell] = cnt + 1;
  }
}

function spatialBuild(): void {
  spatialClear();
  for (let i: i32 = 0; i < _agentCount; i++) {
    if (agentAlive[i]) spatialInsert(i);
  }
}

// Returns count; writes indices into neighborBuf
function spatialQuery(x: f64, y: f64, radius: f64, selfIdx: i32): i32 {
  let count: i32 = 0;
  const cr = <i32>Math.ceil(radius / SPATIAL_CELL_SIZE);
  const cx = <i32>(x / SPATIAL_CELL_SIZE);
  const cy = <i32>(y / SPATIAL_CELL_SIZE);
  for (let dy: i32 = -cr; dy <= cr; dy++) {
    for (let dx: i32 = -cr; dx <= cr; dx++) {
      const ncx = cx + dx;
      const ncy = cy + dy;
      if (ncx < 0 || ncx >= SPATIAL_COLS || ncy < 0 || ncy >= SPATIAL_ROWS) continue;
      const cell = ncy * SPATIAL_COLS + ncx;
      const cnt  = spatialCount[cell];
      for (let k: i32 = 0; k < cnt; k++) {
        const ai = spatialBuckets[cell * MAX_PER_CELL + k];
        if (ai === selfIdx || !agentAlive[ai]) continue;
        if (wrappedDist(x, y, agentX[ai], agentY[ai]) <= radius) {
          if (count < MAX_NEIGHBORS) neighborBuf[count++] = ai;
        }
      }
    }
  }
  return count;
}

// ════════════════════════════════════════════════════════════════
//  DECISION RESULTS — module-level scratch (no heap alloc)
// ════════════════════════════════════════════════════════════════

let _dvx:    f64 = 0.0;
let _dvy:    f64 = 0.0;
let _daction: i32 = ACT_IDLE;

// ════════════════════════════════════════════════════════════════
//  RULE 1: REACTIVE
// ════════════════════════════════════════════════════════════════

function decideReactive(
  i: i32, nCount: i32,
  preySpeed: f64, predatorSpeed: f64, visionRadius: f64
): void {
  const x = agentX[i], y = agentY[i];

  if (agentType[i] == TYPE_PREY) {
    // Find nearest predator
    let nearDist: f64 = 1e9;
    let nearIdx:  i32 = -1;
    for (let k: i32 = 0; k < nCount; k++) {
      const ni = neighborBuf[k];
      if (agentType[ni] != TYPE_PRED) continue;
      const d = wrappedDist(x, y, agentX[ni], agentY[ni]);
      if (d < nearDist) { nearDist = d; nearIdx = ni; }
    }
    if (nearIdx >= 0) {
      const dx = x - agentX[nearIdx], dy = y - agentY[nearIdx];
      const d = Math.sqrt(dx * dx + dy * dy) || 1.0;
      _dvx = (dx / d) * preySpeed * 1.4;
      _dvy = (dy / d) * preySpeed * 1.4;
      _daction = ACT_FLEE;
      return;
    }
    const grassHere = getGrassAt(x, y);
    if (grassHere > 0.1) {
      _dvx = agentVX[i] * 0.2; _dvy = agentVY[i] * 0.2;
      _daction = ACT_EAT;
      return;
    }
    findRichestGrass(x, y, visionRadius * 0.6);
    if (_grassBestVal > 0.1) {
      const dx = _grassBestX - x, dy = _grassBestY - y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1.0;
      _dvx = (dx / d) * preySpeed; _dvy = (dy / d) * preySpeed;
      _daction = ACT_FORAGE;
      return;
    }
    _dvx = agentVX[i] + rngRange(-0.1, 0.1);
    _dvy = agentVY[i] + rngRange(-0.1, 0.1);
    _daction = ACT_WANDER;

  } else {
    // Predator: pursue nearest prey
    let nearDist: f64 = 1e9;
    let nearIdx:  i32 = -1;
    for (let k: i32 = 0; k < nCount; k++) {
      const ni = neighborBuf[k];
      if (agentType[ni] != TYPE_PREY) continue;
      const d = wrappedDist(x, y, agentX[ni], agentY[ni]);
      if (d < nearDist) { nearDist = d; nearIdx = ni; }
    }
    if (nearIdx >= 0) {
      const dx = agentX[nearIdx] - x, dy = agentY[nearIdx] - y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1.0;
      _dvx = (dx / d) * predatorSpeed; _dvy = (dy / d) * predatorSpeed;
      _daction = ACT_PURSUE;
      return;
    }
    _dvx = agentVX[i] + rngRange(-0.15, 0.15);
    _dvy = agentVY[i] + rngRange(-0.15, 0.15);
    _daction = ACT_WANDER;
  }
}

// ════════════════════════════════════════════════════════════════
//  RULE 2: BOUNDED RATIONALITY (satisficing)
// ════════════════════════════════════════════════════════════════

function decideBounded(
  i: i32, nCount: i32,
  preySpeed: f64, predatorSpeed: f64, visionRadius: f64,
  maxEnergy: f64, fleeThreshold: f64
): void {
  const x = agentX[i], y = agentY[i];
  const energy = agentEnergy[i];

  if (agentType[i] == TYPE_PREY) {
    // Candidate 1: flee
    let fleeDist: f64 = 1e9;
    let fleeIdx:  i32 = -1;
    for (let k: i32 = 0; k < nCount; k++) {
      const ni = neighborBuf[k];
      if (agentType[ni] != TYPE_PRED) continue;
      const d = wrappedDist(x, y, agentX[ni], agentY[ni]);
      if (d < fleeDist) { fleeDist = d; fleeIdx = ni; }
    }
    const fleeScore = fleeIdx >= 0 ? (1.0 - fleeDist / visionRadius) * 1.5 : -1.0;
    if (fleeScore >= fleeThreshold) {
      const dx = x - agentX[fleeIdx], dy = y - agentY[fleeIdx];
      const d = Math.sqrt(dx * dx + dy * dy) || 1.0;
      _dvx = (dx / d) * preySpeed * 1.3;
      _dvy = (dy / d) * preySpeed * 1.3;
      _daction = ACT_FLEE;
      return;
    }
    // Candidate 2: eat here
    const grassHere = getGrassAt(x, y);
    const eatScore  = grassHere > 0.2 ? (1.0 - energy / maxEnergy) * grassHere : -1.0;
    if (eatScore >= fleeThreshold) {
      _dvx = agentVX[i] * 0.1; _dvy = agentVY[i] * 0.1;
      _daction = ACT_EAT;
      return;
    }
    // Candidate 3: forage
    findRichestGrass(x, y, visionRadius * 0.6);
    const forageScore = _grassBestVal > 0.4 ? _grassBestVal * 0.5 : -1.0;
    if (forageScore >= fleeThreshold) {
      const dx = _grassBestX - x, dy = _grassBestY - y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1.0;
      _dvx = (dx / d) * preySpeed; _dvy = (dy / d) * preySpeed;
      _daction = ACT_FORAGE;
      return;
    }
    // Fallback: pick best
    let bestScore = fleeScore;
    let bestAct   = ACT_FLEE;
    if (eatScore > bestScore)    { bestScore = eatScore;    bestAct = ACT_EAT; }
    if (forageScore > bestScore) { bestScore = forageScore; bestAct = ACT_FORAGE; }
    if (bestAct == ACT_FLEE && fleeIdx >= 0) {
      const dx = x - agentX[fleeIdx], dy = y - agentY[fleeIdx];
      const d = Math.sqrt(dx * dx + dy * dy) || 1.0;
      _dvx = (dx / d) * preySpeed * 1.3;
      _dvy = (dy / d) * preySpeed * 1.3;
    } else if (bestAct == ACT_EAT) {
      _dvx = agentVX[i] * 0.1; _dvy = agentVY[i] * 0.1;
    } else if (bestAct == ACT_FORAGE) {
      const dx = _grassBestX - x, dy = _grassBestY - y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1.0;
      _dvx = (dx / d) * preySpeed; _dvy = (dy / d) * preySpeed;
    } else {
      _dvx = agentVX[i] + rngRange(-0.1, 0.1);
      _dvy = agentVY[i] + rngRange(-0.1, 0.1);
      bestAct = ACT_WANDER;
    }
    _daction = bestAct;

  } else {
    // Predator — bounded: consider up to 3 prey
    let bestScore: f64 = -1.0;
    let bestIdx:   i32 = -1;
    let considered: i32 = 0;
    for (let k: i32 = 0; k < nCount && considered < 3; k++) {
      const ni = neighborBuf[k];
      if (agentType[ni] != TYPE_PREY) continue;
      const d = wrappedDist(x, y, agentX[ni], agentY[ni]);
      const catchability = (1.0 - d / visionRadius) * (agentEnergy[ni] < 30.0 ? 1.3 : 1.0);
      if (catchability > bestScore) { bestScore = catchability; bestIdx = ni; }
      considered++;
    }
    const threshold = fleeThreshold * 0.5;
    if (bestIdx >= 0 && bestScore >= threshold) {
      const dx = agentX[bestIdx] - x, dy = agentY[bestIdx] - y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1.0;
      _dvx = (dx / d) * predatorSpeed; _dvy = (dy / d) * predatorSpeed;
      _daction = ACT_PURSUE;
      return;
    }
    _dvx = agentVX[i] + rngRange(-0.15, 0.15);
    _dvy = agentVY[i] + rngRange(-0.15, 0.15);
    _daction = ACT_WANDER;
  }
}

// ════════════════════════════════════════════════════════════════
//  RULE 3: BDI — Beliefs-Desires-Intentions
// ════════════════════════════════════════════════════════════════

// BDI belief temporaries (computed inline, no heap)
let _bNearThreatIdx:  i32 = -1;
let _bNearThreatDist: f64 = 1e9;
let _bNearPreyIdx:    i32 = -1;
let _bNearPreyDist:   f64 = 1e9;
let _bEnergyRatio:    f64 = 0.0;
let _bThreatCount:    i32 = 0;
let _bPreyCount:      i32 = 0;

function executeIntention(
  i: i32, intention: i32,
  preySpeed: f64, predatorSpeed: f64, visionRadius: f64
): void {
  const x = agentX[i], y = agentY[i];
  switch (intention) {
    case INT_SURVIVE: {
      if (_bNearThreatIdx < 0) {
        _dvx = agentVX[i]; _dvy = agentVY[i]; _daction = ACT_WANDER;
        break;
      }
      const dx = x - agentX[_bNearThreatIdx], dy = y - agentY[_bNearThreatIdx];
      const d = Math.sqrt(dx * dx + dy * dy) || 1.0;
      _dvx = (dx / d) * preySpeed * 1.5;
      _dvy = (dy / d) * preySpeed * 1.5;
      _daction = ACT_FLEE;
      break;
    }
    case INT_EAT: {
      const grassHere = getGrassAt(x, y);
      if (grassHere > 0.2) {
        _dvx = 0.0; _dvy = 0.0; _daction = ACT_EAT;
        break;
      }
      findRichestGrass(x, y, visionRadius * 0.7);
      if (_grassBestVal > 0.3) {
        const dx = _grassBestX - x, dy = _grassBestY - y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1.0;
        _dvx = (dx / d) * preySpeed; _dvy = (dy / d) * preySpeed;
        _daction = ACT_FORAGE;
        break;
      }
      _dvx = agentVX[i] + rngRange(-0.1, 0.1);
      _dvy = agentVY[i] + rngRange(-0.1, 0.1);
      _daction = ACT_WANDER;
      break;
    }
    case INT_HUNT: {
      if (_bNearPreyIdx < 0) {
        _dvx = agentVX[i] + rngRange(-0.2, 0.2);
        _dvy = agentVY[i] + rngRange(-0.2, 0.2);
        _daction = ACT_WANDER;
        break;
      }
      const dx = agentX[_bNearPreyIdx] - x, dy = agentY[_bNearPreyIdx] - y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1.0;
      _dvx = (dx / d) * predatorSpeed; _dvy = (dy / d) * predatorSpeed;
      _daction = ACT_PURSUE;
      break;
    }
    default: {
      _dvx = agentVX[i] + rngRange(-0.1, 0.1);
      _dvy = agentVY[i] + rngRange(-0.1, 0.1);
      _daction = ACT_WANDER;
      break;
    }
  }
}

function decideBDI(
  i: i32, nCount: i32,
  preySpeed: f64, predatorSpeed: f64, visionRadius: f64,
  maxEnergy: f64, fleeThreshold: f64
): void {
  const x = agentX[i], y = agentY[i];
  const energy = agentEnergy[i];

  // ── Update Beliefs (inline) ────────────────────────────────
  _bNearThreatIdx  = -1;
  _bNearThreatDist = 1e9;
  _bNearPreyIdx    = -1;
  _bNearPreyDist   = 1e9;
  _bThreatCount    = 0;
  _bPreyCount      = 0;
  _bEnergyRatio    = energy / maxEnergy;

  for (let k: i32 = 0; k < nCount; k++) {
    const ni = neighborBuf[k];
    const d = wrappedDist(x, y, agentX[ni], agentY[ni]);
    if (agentType[ni] == TYPE_PRED) {
      _bThreatCount++;
      if (d < _bNearThreatDist) { _bNearThreatDist = d; _bNearThreatIdx = ni; }
    } else {
      _bPreyCount++;
      if (d < _bNearPreyDist) { _bNearPreyDist = d; _bNearPreyIdx = ni; }
    }
  }

  // ── Form top desire → intention ─────────────────────────────
  let topPriority: f64 = -1.0;
  let topIntention: i32 = INT_REST;

  if (agentType[i] == TYPE_PREY) {
    if (_bNearThreatIdx >= 0 && _bNearThreatDist < visionRadius * 0.7) {
      const p = 2.0 - _bNearThreatDist / visionRadius;
      if (p > topPriority) { topPriority = p; topIntention = INT_SURVIVE; }
    }
    if (_bEnergyRatio < 0.7) {
      const p = 1.0 - _bEnergyRatio;
      if (p > topPriority) { topPriority = p; topIntention = INT_EAT; }
    }
    if (_bEnergyRatio > 0.8 && _bThreatCount == 0) {
      if (0.3 > topPriority) { topPriority = 0.3; topIntention = INT_EXPLORE; }
    }
    if (0.1 > topPriority) { topPriority = 0.1; topIntention = INT_REST; }
  } else {
    // Predator
    if (_bNearPreyIdx >= 0) {
      const urgency = clampF((1.0 - _bEnergyRatio) + 0.3, 0.0, 1.5);
      if (urgency > topPriority) { topPriority = urgency; topIntention = INT_HUNT; }
    }
    if (_bEnergyRatio < 0.3 && topPriority < 1.8) {
      topPriority = 1.8; topIntention = INT_HUNT;
    }
    if (0.2 > topPriority) { topPriority = 0.2; topIntention = INT_PATROL; }
  }

  // ── Commitment: 70% stick to current intention if new priority < 0.8 ──
  const curIntention = agentIntent[i];
  if (curIntention != INT_NONE && topPriority < 0.8) {
    if (rngNext() < 0.7) {
      executeIntention(i, curIntention, preySpeed, predatorSpeed, visionRadius);
      return;
    }
  }
  agentIntent[i] = topIntention;
  executeIntention(i, topIntention, preySpeed, predatorSpeed, visionRadius);
}

// ════════════════════════════════════════════════════════════════
//  SIMULATION — init & step
// ════════════════════════════════════════════════════════════════

function spawnAgent(
  type: i32, x: f64, y: f64, energy: f64, speed: f64
): i32 {
  if (_agentCount >= MAX_AGENTS) return -1;
  const i = _agentCount++;
  const angle = rngRange(0.0, Math.PI * 2.0);
  agentX[i]       = x;
  agentY[i]       = y;
  agentVX[i]      = Math.cos(angle) * speed;
  agentVY[i]      = Math.sin(angle) * speed;
  agentEnergy[i]  = energy;
  agentType[i]    = type;
  agentAction[i]  = ACT_IDLE;
  agentAlive[i]   = 1;
  agentAge[i]     = 0;
  agentKills[i]   = 0;
  agentId[i]      = _nextId++;
  agentIntent[i]  = INT_NONE;
  return i;
}

function grassPercent(): f64 {
  let total: f64 = 0.0;
  for (let i: i32 = 0; i < GRID_SIZE; i++) total += grassGrid[i];
  return total / <f64>GRID_SIZE;
}

function countAlive(type: i32): i32 {
  let n: i32 = 0;
  for (let i: i32 = 0; i < _agentCount; i++) {
    if (agentAlive[i] && agentType[i] == type) n++;
  }
  return n;
}

function appendHistory(): void {
  const h = _histLen < MAX_HISTORY ? _histLen : MAX_HISTORY - 1;
  if (_histLen >= MAX_HISTORY) {
    // Shift history left by 1
    for (let i: i32 = 0; i < MAX_HISTORY - 1; i++) {
      histTick[i]  = histTick[i + 1];
      histPrey[i]  = histPrey[i + 1];
      histPred[i]  = histPred[i + 1];
      histGrass[i] = histGrass[i + 1];
    }
  } else {
    _histLen++;
  }
  histTick[h]  = _tick;
  histPrey[h]  = countAlive(TYPE_PREY);
  histPred[h]  = countAlive(TYPE_PRED);
  histGrass[h] = grassPercent();
}

export function simInit(
  preyCount: i32, predatorCount: i32, seed: i32,
  preySpeed: f64, predatorSpeed: f64,
  maxEnergy: f64, grassRegrowRate: f64
): void {
  _rngState   = seed as u32;
  _agentCount = 0;
  _histLen    = 0;
  _tick       = 0;
  _nextId     = 1;

  // Init grass grid
  for (let i: i32 = 0; i < GRID_SIZE; i++) {
    grassGrid[i] = 0.3 + rngNext() * 0.7;
  }

  // Spawn prey
  for (let i: i32 = 0; i < preyCount; i++) {
    const x = rngRange(0.0, <f64>GRID_W);
    const y = rngRange(0.0, <f64>GRID_H);
    const e = maxEnergy * (0.5 + rngNext() * 0.5);
    spawnAgent(TYPE_PREY, x, y, e, preySpeed);
  }

  // Spawn predators
  for (let i: i32 = 0; i < predatorCount; i++) {
    const x = rngRange(0.0, <f64>GRID_W);
    const y = rngRange(0.0, <f64>GRID_H);
    const e = maxEnergy * (0.6 + rngNext() * 0.4);
    spawnAgent(TYPE_PRED, x, y, e, predatorSpeed);
  }

  appendHistory();
}

export function simStep(
  decisionRule: i32,
  preySpeed: f64, predatorSpeed: f64, visionRadius: f64,
  maxEnergy: f64, preyMetabolism: f64, predatorMetabolism: f64,
  preyReproductionRate: f64, predatorReproductionRate: f64,
  preyGrassGain: f64, predatorHuntGain: f64,
  grassRegrowRate: f64, fleeThreshold: f64
): void {

  // ── Build spatial index ────────────────────────────────────
  spatialBuild();

  // ── Decision + movement ────────────────────────────────────
  for (let i: i32 = 0; i < _agentCount; i++) {
    if (!agentAlive[i]) continue;
    const x = agentX[i], y = agentY[i];
    const nCount = spatialQuery(x, y, visionRadius, i);

    switch (decisionRule) {
      case RULE_REACTIVE:
        decideReactive(i, nCount, preySpeed, predatorSpeed, visionRadius);
        break;
      case RULE_BDI:
        decideBDI(i, nCount, preySpeed, predatorSpeed, visionRadius, maxEnergy, fleeThreshold);
        break;
      default: // RULE_BOUNDED
        decideBounded(i, nCount, preySpeed, predatorSpeed, visionRadius, maxEnergy, fleeThreshold);
        break;
    }

    agentAction[i] = _daction;

    // Clamp velocity
    const speed = agentType[i] == TYPE_PREY ? preySpeed : predatorSpeed;
    const maxSpd = speed * (_daction == ACT_FLEE ? 1.5 : 1.2);
    const mag    = Math.sqrt(_dvx * _dvx + _dvy * _dvy);
    if (mag > maxSpd) {
      _dvx = (_dvx / mag) * maxSpd;
      _dvy = (_dvy / mag) * maxSpd;
    }

    agentVX[i] = _dvx;
    agentVY[i] = _dvy;
    agentX[i]  = wrapX(x + _dvx);
    agentY[i]  = wrapY(y + _dvy);
  }

  // ── Prey eat grass ─────────────────────────────────────────
  for (let i: i32 = 0; i < _agentCount; i++) {
    if (!agentAlive[i] || agentType[i] != TYPE_PREY) continue;
    const act = agentAction[i];
    if (act == ACT_EAT || act == ACT_FORAGE) {
      const grassVal = getGrassAt(agentX[i], agentY[i]);
      if (grassVal > 0.1) {
        const eaten = eatGrass(agentX[i], agentY[i]);
        agentEnergy[i] = clampF(agentEnergy[i] + eaten * preyGrassGain, 0.0, maxEnergy);
      }
    }
  }

  // ── Predators eat prey ─────────────────────────────────────
  for (let pi: i32 = 0; pi < _agentCount; pi++) {
    if (!agentAlive[pi] || agentType[pi] != TYPE_PRED) continue;
    for (let prey: i32 = 0; prey < _agentCount; prey++) {
      if (!agentAlive[prey] || agentType[prey] != TYPE_PREY) continue;
      if (wrappedDist(agentX[pi], agentY[pi], agentX[prey], agentY[prey]) < 0.8) {
        agentAlive[prey] = 0;
        agentEnergy[pi]  = clampF(agentEnergy[pi] + predatorHuntGain, 0.0, maxEnergy);
        agentKills[pi]++;
        break; // one kill per tick
      }
    }
  }

  // ── Metabolism + aging ─────────────────────────────────────
  for (let i: i32 = 0; i < _agentCount; i++) {
    if (!agentAlive[i]) continue;
    const metabolism = agentType[i] == TYPE_PREY ? preyMetabolism : predatorMetabolism;
    const act = agentAction[i];
    const cost = act == ACT_FLEE ? 1.5 : act == ACT_PURSUE ? 1.3 : 1.0;
    agentEnergy[i] -= metabolism * maxEnergy * cost;
    agentAge[i]++;
    if (agentEnergy[i] <= 0.0) agentAlive[i] = 0;
  }

  // ── Reproduction ───────────────────────────────────────────
  const countBefore = _agentCount; // only iterate original agents
  for (let i: i32 = 0; i < countBefore; i++) {
    if (!agentAlive[i]) continue;
    const reproRate = agentType[i] == TYPE_PREY ? preyReproductionRate : predatorReproductionRate;
    if (agentEnergy[i] > maxEnergy * 0.5 && rngNext() < reproRate) {
      agentEnergy[i] *= 0.5;
      const cx    = wrapX(agentX[i] + rngRange(-1.0, 1.0));
      const cy    = wrapY(agentY[i] + rngRange(-1.0, 1.0));
      const speed = agentType[i] == TYPE_PREY ? preySpeed : predatorSpeed;
      spawnAgent(agentType[i], cx, cy, agentEnergy[i], speed);
    }
  }

  // ── Grass regrowth ─────────────────────────────────────────
  for (let idx: i32 = 0; idx < GRID_SIZE; idx++) {
    if (grassGrid[idx] < 1.0) {
      grassGrid[idx] = clampF(grassGrid[idx] + grassRegrowRate + rngNext() * grassRegrowRate * 0.5, 0.0, 1.0);
    }
  }

  // ── Compact dead agents ─────────────────────────────────────
  let writeIdx: i32 = 0;
  for (let i: i32 = 0; i < _agentCount; i++) {
    if (!agentAlive[i]) continue;
    if (writeIdx != i) {
      agentX[writeIdx]      = agentX[i];
      agentY[writeIdx]      = agentY[i];
      agentVX[writeIdx]     = agentVX[i];
      agentVY[writeIdx]     = agentVY[i];
      agentEnergy[writeIdx] = agentEnergy[i];
      agentType[writeIdx]   = agentType[i];
      agentAction[writeIdx] = agentAction[i];
      agentAlive[writeIdx]  = 1;
      agentAge[writeIdx]    = agentAge[i];
      agentKills[writeIdx]  = agentKills[i];
      agentId[writeIdx]     = agentId[i];
      agentIntent[writeIdx] = agentIntent[i];
    }
    writeIdx++;
  }
  _agentCount = writeIdx;

  // ── Cap prey population ────────────────────────────────────
  let preyAlive: i32 = 0;
  for (let i: i32 = 0; i < _agentCount; i++) {
    if (agentType[i] == TYPE_PREY) preyAlive++;
  }
  if (preyAlive > 400) {
    let killed: i32 = 0;
    const toKill = preyAlive - 400;
    let w: i32 = 0;
    for (let i: i32 = 0; i < _agentCount; i++) {
      if (agentType[i] == TYPE_PREY && killed < toKill) {
        killed++;
        continue;
      }
      if (w != i) {
        agentX[w]      = agentX[i];
        agentY[w]      = agentY[i];
        agentVX[w]     = agentVX[i];
        agentVY[w]     = agentVY[i];
        agentEnergy[w] = agentEnergy[i];
        agentType[w]   = agentType[i];
        agentAction[w] = agentAction[i];
        agentAlive[w]  = agentAlive[i];
        agentAge[w]    = agentAge[i];
        agentKills[w]  = agentKills[i];
        agentId[w]     = agentId[i];
        agentIntent[w] = agentIntent[i];
      }
      w++;
    }
    _agentCount = w;
  }

  _tick++;
  appendHistory();
}
