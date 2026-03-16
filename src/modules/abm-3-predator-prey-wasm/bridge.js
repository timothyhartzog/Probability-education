/**
 * @module bridge
 * @description WASM engine bridge — lazy-loads engine.wasm, exposes the same
 *              API as abm-2's engine.js, and falls back gracefully to the
 *              pure-JS engine if WASM is unavailable (e.g. not yet built).
 *
 *  Usage:
 *    import { getEngine } from './bridge.js';
 *    const engine = await getEngine();       // downloads WASM once, then cached
 *    const state  = engine.initSim(params, seed);
 *    const next   = engine.stepSim(state, params);
 *
 *  The returned state objects are compatible with renderer.js and charts.js.
 *  Trails are maintained JS-side in a WeakMap-equivalent (id → positions[]).
 *
 *  Build WASM first:
 *    npm run build:wasm
 *  If pkg/engine.wasm is absent, bridge falls back to the JS engine silently.
 */

// ── Re-export JS constants (always available) ─────────────────
export {
  DEFAULT_PARAMS, PARAM_LIMITS, PRESETS, RULE_SETS,
  GRID_W, GRID_H,
  computeStats, giniCoefficient,
} from '../abm-2-predator-prey-d3/engine.js';

// ── Action name lookup (mirrors AssemblyScript ACT_* constants) ─
const ACTION_NAMES = ['idle', 'flee', 'eat', 'forage', 'wander', 'pursue'];

// ── Rule name → integer for WASM ─────────────────────────────
const RULE_CODE = { reactive: 0, bounded: 1, bdi: 2 };

// ── WASM module singleton ─────────────────────────────────────
let _wasmInstance = null;      // WebAssembly.Instance, or null if JS fallback
let _loadPromise  = null;      // in-flight import promise
let _jsEngine     = null;      // JS fallback module

// JS-side trail buffer:  agentId → [{x, y}, ...]
const _trails = new Map();
const TRAIL_MAX = 30;

/**
 * Returns the engine object (WASM-backed or JS fallback).
 * Calling this multiple times is cheap after the first load.
 *
 * @returns {Promise<{initSim, stepSim, isWasm}>}
 */
export async function getEngine() {
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    // ── Try to load WASM ────────────────────────────────────
    try {
      // Vite resolves ?url to the hashed asset path at build time.
      // At dev time it uses the raw path — both work with fetch().
      const wasmUrl = new URL('./pkg/engine.wasm', import.meta.url);
      const response = await fetch(wasmUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const { instance } = await WebAssembly.instantiateStreaming(response, {
        // AssemblyScript stub runtime needs no imports for this module
        env: {
          abort(_msg, _file, line, col) {
            console.error(`WASM abort at ${line}:${col}`);
          },
        },
      });

      _wasmInstance = instance.exports;
      console.info('[abm-3] WASM engine loaded');
      return _makeWasmEngine(_wasmInstance);

    } catch (err) {
      console.warn('[abm-3] WASM unavailable, falling back to JS engine:', err.message);
      _jsEngine = await import('../abm-2-predator-prey-d3/engine.js');
      return _makeJsEngine(_jsEngine);
    }
  })();

  return _loadPromise;
}

// ════════════════════════════════════════════════════════════════
//  WASM ENGINE WRAPPER
// ════════════════════════════════════════════════════════════════

function _makeWasmEngine(w) {
  const mem = w.memory;

  function _readAgents() {
    const n    = w.getAgentCount();
    const xArr = new Float64Array(mem.buffer, w.getAgentXPtr(),      n);
    const yArr = new Float64Array(mem.buffer, w.getAgentYPtr(),      n);
    const vxArr= new Float64Array(mem.buffer, w.getAgentVXPtr(),     n);
    const vyArr= new Float64Array(mem.buffer, w.getAgentVYPtr(),     n);
    const eArr = new Float64Array(mem.buffer, w.getAgentEnergyPtr(), n);
    const tArr = new Int32Array  (mem.buffer, w.getAgentTypePtr(),   n);
    const aArr = new Int32Array  (mem.buffer, w.getAgentActionPtr(), n);
    const ageArr  = new Int32Array(mem.buffer, w.getAgentAgePtr(),   n);
    const kilArr  = new Int32Array(mem.buffer, w.getAgentKillsPtr(), n);
    const idArr   = new Int32Array(mem.buffer, w.getAgentIdPtr(),    n);

    // Prune dead IDs from trail cache
    const liveIds = new Set();
    const agents  = [];

    for (let i = 0; i < n; i++) {
      const id   = idArr[i];
      const x    = xArr[i];
      const y    = yArr[i];

      liveIds.add(id);

      // Update trail
      let trail = _trails.get(id);
      if (!trail) { trail = []; _trails.set(id, trail); }
      trail.push({ x, y });
      if (trail.length > TRAIL_MAX) trail.shift();

      agents.push({
        id,
        type:      tArr[i] === 0 ? 'prey' : 'predator',
        x,
        y,
        vx:        vxArr[i],
        vy:        vyArr[i],
        energy:    eArr[i],
        action:    ACTION_NAMES[aArr[i]] ?? 'idle',
        alive:     true,
        age:       ageArr[i],
        kills:     kilArr[i],
        trail,
        // BDI stubs (renderer doesn't use these, inspector shows '—')
        beliefs:   {},
        desires:   [],
        intention: null,
      });
    }

    // Purge stale trails
    for (const id of _trails.keys()) {
      if (!liveIds.has(id)) _trails.delete(id);
    }

    return agents;
  }

  function _readGrid() {
    const n    = w.getGridW() * w.getGridH();
    // Copy to avoid stale view after future memory.grow()
    return new Float64Array(
      new Float64Array(mem.buffer, w.getGrassPtr(), n)
    );
  }

  function _readHistory() {
    const h     = w.getHistoryLen();
    const ticks = new Int32Array  (mem.buffer, w.getHistTickPtr(),  h);
    const prey  = new Int32Array  (mem.buffer, w.getHistPreyPtr(),  h);
    const pred  = new Int32Array  (mem.buffer, w.getHistPredPtr(),  h);
    const grass = new Float64Array(mem.buffer, w.getHistGrassPtr(), h);
    const history = [];
    for (let i = 0; i < h; i++) {
      history.push({ tick: ticks[i], prey: prey[i], predator: pred[i], grass: grass[i] });
    }
    return history;
  }

  function _readState() {
    return {
      tick:      w.getTick(),
      agents:    _readAgents(),
      grid:      _readGrid(),
      history:   _readHistory(),
      events:    [],
      rng:       null,   // owned by WASM
      gridDirty: true,
    };
  }

  return {
    isWasm: true,

    initSim(params, seed) {
      _trails.clear();
      w.simInit(
        params.preyCount,
        params.predatorCount,
        (seed ?? params.seed) | 0,
        params.preySpeed,
        params.predatorSpeed,
        params.maxEnergy,
        params.grassRegrowRate,
      );
      return _readState();
    },

    stepSim(state, params) {
      w.simStep(
        RULE_CODE[params.decisionRule] ?? 1,
        params.preySpeed,
        params.predatorSpeed,
        params.visionRadius,
        params.maxEnergy,
        params.preyMetabolism,
        params.predatorMetabolism,
        params.preyReproductionRate,
        params.predatorReproductionRate,
        params.preyGrassGain,
        params.predatorHuntGain,
        params.grassRegrowRate,
        params.fleeThreshold,
      );
      return _readState();
    },
  };
}

// ════════════════════════════════════════════════════════════════
//  JS FALLBACK ENGINE WRAPPER
// ════════════════════════════════════════════════════════════════

function _makeJsEngine(eng) {
  return {
    isWasm: false,

    initSim(params, seed) {
      return eng.initSim(params, seed);
    },

    stepSim(state, params) {
      return eng.stepSim(state, params);
    },
  };
}
