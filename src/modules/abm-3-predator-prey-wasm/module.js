/**
 * @module module
 * @description Main entry for abm-3 — identical control flow to abm-2 except:
 *   1. Engine is loaded asynchronously via bridge.js (WASM or JS fallback).
 *   2. A loading overlay is shown while WASM downloads.
 *   3. computeStats / giniCoefficient come from bridge.js (re-exported from JS engine).
 *
 * Once the engine promise resolves, everything runs identically to abm-2.
 */

import * as d3 from 'd3';
import {
  DEFAULT_PARAMS, PARAM_LIMITS, PRESETS, RULE_SETS, GRID_W, GRID_H,
  computeStats, giniCoefficient,
  getEngine,
} from './bridge.js';
import { drawFrame, hitTest, PALETTE } from './renderer.js';
import {
  drawPopulationChart, drawPhasePortrait, drawEnergyHistogram,
  drawActionDonut, drawGrassHeatmap,
} from './charts.js';
import '../../lib/copy-code.js';

// ════════════════════════════════════════════════════════════════
//  D3 DISPATCH — central event bus
// ════════════════════════════════════════════════════════════════

const dispatch = d3.dispatch(
  'sim:start', 'sim:pause', 'sim:reset', 'sim:step', 'sim:tick',
  'param:change', 'param:preset',
  'agent:select', 'agent:deselect',
  'rule:change',
  'engine:error',
  'engine:ready',    // fired once WASM (or JS fallback) is loaded
);

// ════════════════════════════════════════════════════════════════
//  STORES
// ════════════════════════════════════════════════════════════════

// ── ParamStore ──────────────────────────────────────────────
const paramState = { ...DEFAULT_PARAMS };

const ParamStore = {
  get() { return { ...paramState }; },
  set(key, value) {
    const limits = PARAM_LIMITS[key];
    if (limits) {
      if (value < limits.min || value > limits.max)
        return { ok: false, error: `Out of range [${limits.min}, ${limits.max}]` };
    }
    const prev = paramState[key];
    paramState[key] = value;
    dispatch.call('param:change', null, { key, value, prev });
    return { ok: true };
  },
  loadPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;
    for (const [k, v] of Object.entries(preset.params)) paramState[k] = v;
    dispatch.call('param:preset', null, { name, params: { ...paramState } });
  },
};

// ── SimStore ────────────────────────────────────────────────
let simState   = null;
let canvasRef  = null;
let simRunning = false;
let _engine    = null;   // set once WASM/fallback resolves

const SimStore = {
  async init(seed) {
    if (!_engine) return;
    const params = ParamStore.get();
    simState   = _engine.initSim(params, seed ?? params.seed);
    simRunning = false;
    dispatch.call('sim:reset', null, { state: simState });
  },
  tick(dt) {
    if (!simRunning || !simState || !_engine) return;
    try {
      const params = ParamStore.get();
      simState = _engine.stepSim(simState, params);
      dispatch.call('sim:tick', null, { state: simState, dt });
    } catch (err) {
      simRunning = false;
      dispatch.call('engine:error', null, { error: err, state: simState });
    }
  },
  start()    { simRunning = true;  dispatch.call('sim:start', null, {}); },
  pause()    { simRunning = false; dispatch.call('sim:pause', null, {}); },
  async step() {
    if (!_engine) return;
    simRunning = false;
    const params = ParamStore.get();
    simState = _engine.stepSim(simState, params);
    dispatch.call('sim:tick', null, { state: simState, dt: 0 });
  },
  getState() { return simState; },
  isRunning() { return simRunning; },
};

// ── UIStore ─────────────────────────────────────────────────
const uiState = {
  selectedId:     null,
  activeChart:    'population',
  speed:          1,
  zoomTransform:  d3.zoomIdentity,
};

// ── FPS Monitor ─────────────────────────────────────────────
const fpsMonitor = {
  frames: [],
  fps: 0,
  record() {
    const now = performance.now();
    this.frames.push(now);
    while (this.frames.length > 60) this.frames.shift();
    if (this.frames.length > 1) {
      const elapsed = now - this.frames[0];
      this.fps = Math.round((this.frames.length - 1) / (elapsed / 1000));
    }
  },
};

// ════════════════════════════════════════════════════════════════
//  SIMULATION LOOP — d3.timer
// ════════════════════════════════════════════════════════════════

let activeTimer  = null;
let lastElapsed  = 0;
let tickAccum    = 0;
const TICK_INTERVAL = 50; // ms per sim tick at speed 1

function startLoop() {
  stopLoop();
  lastElapsed = 0;
  tickAccum   = 0;
  activeTimer = d3.timer((elapsed) => {
    const dt = elapsed - lastElapsed;
    lastElapsed = elapsed;
    tickAccum  += dt * uiState.speed;
    fpsMonitor.record();
    while (tickAccum >= TICK_INTERVAL) {
      tickAccum -= TICK_INTERVAL;
      SimStore.tick(dt);
    }
  });
}

function stopLoop() {
  if (activeTimer) { activeTimer.stop(); activeTimer = null; }
  lastElapsed = 0;
  tickAccum   = 0;
}

dispatch.on('sim:start.loop', () => startLoop());
dispatch.on('sim:pause.loop', () => stopLoop());
dispatch.on('sim:reset.loop', () => stopLoop());

// ════════════════════════════════════════════════════════════════
//  LOADING OVERLAY
// ════════════════════════════════════════════════════════════════

function showLoadingOverlay() {
  const root = d3.select('#abm-root');
  root.append('div')
    .attr('class', 'abm-loading-overlay')
    .attr('data-testid', 'wasm-loading')
    .html(`
      <div class="abm-loading-inner">
        <div class="abm-loading-spinner"></div>
        <p class="abm-loading-text">Loading WASM engine…</p>
      </div>
    `);
}

function hideLoadingOverlay() {
  d3.select('.abm-loading-overlay').remove();
}

// ════════════════════════════════════════════════════════════════
//  D3 DOM CONSTRUCTION
// ════════════════════════════════════════════════════════════════

function buildLayout() {
  const root = d3.select('#abm-root');
  root.selectAll('*').remove();

  const app = root.append('div')
    .attr('class', 'abm-app')
    .attr('data-testid', 'abm-app');

  // ── Engine badge ──────────────────────────────────────────
  app.append('div')
    .attr('class', 'abm-engine-badge')
    .attr('data-testid', 'engine-badge')
    .text('…');   // updated once engine resolves

  dispatch.on('engine:ready.badge', ({ isWasm }) => {
    d3.select('[data-testid="engine-badge"]')
      .text(isWasm ? 'Engine: WASM' : 'Engine: JS fallback')
      .classed('abm-badge-wasm', isWasm)
      .classed('abm-badge-js',   !isWasm);
  });

  // ── Stats Bar ─────────────────────────────────────────────
  const statsBar = app.append('div')
    .attr('class', 'abm-stats-bar')
    .attr('data-testid', 'stats-bar');

  const statItems = [
    { id: 'stat-tick',     label: 'Tick',       value: '0' },
    { id: 'stat-prey',     label: 'Prey',       value: '0', color: '#3b82f6' },
    { id: 'stat-predator', label: 'Predators',  value: '0', color: '#ef4444' },
    { id: 'stat-grass',    label: 'Grass',      value: '0%', color: '#4ade80' },
    { id: 'stat-gini',     label: 'Gini',       value: '—' },
    { id: 'stat-fps',      label: 'FPS',        value: '—', color: '#94a3b8' },
    { id: 'stat-rule',     label: 'Rule',       value: 'bounded' },
  ];

  for (const item of statItems) {
    const stat = statsBar.append('div').attr('class', 'abm-stat');
    stat.append('span').attr('class', 'abm-stat-label').text(item.label);
    stat.append('span')
      .attr('class', 'abm-stat-value')
      .attr('data-testid', item.id)
      .style('color', item.color || null)
      .text(item.value);
  }

  // ── Main Layout ───────────────────────────────────────────
  const main = app.append('div').attr('class', 'abm-main');

  // ── Left Sidebar ──────────────────────────────────────────
  const sidebar = main.append('aside')
    .attr('class', 'abm-sidebar')
    .attr('data-testid', 'sidebar');

  buildPlaybackControls(sidebar);
  buildRuleSelector(sidebar);
  buildParamSliders(sidebar);
  buildPresetSelector(sidebar);
  buildExportControls(sidebar);

  // ── Error Banner ──────────────────────────────────────────
  const errorBanner = app.append('div')
    .attr('class', 'abm-error-banner')
    .attr('data-testid', 'error-banner')
    .style('display', 'none');
  errorBanner.append('span').attr('class', 'abm-error-text');
  errorBanner.append('button')
    .attr('class', 'abm-btn abm-error-dismiss')
    .attr('data-testid', 'btn-dismiss-error')
    .text('Dismiss')
    .on('click', () => { errorBanner.style('display', 'none'); });

  dispatch.on('engine:error.display', ({ error }) => {
    errorBanner.style('display', 'flex');
    errorBanner.select('.abm-error-text').text('Engine error: ' + (error?.message || error));
  });

  // ── Center: Canvas + Charts ───────────────────────────────
  const center = main.append('div').attr('class', 'abm-center');

  const canvasWrap = center.append('div').attr('class', 'abm-canvas-wrap');
  const canvas = canvasWrap.append('canvas')
    .attr('id', 'sim-canvas')
    .attr('data-testid', 'sim-canvas')
    .attr('width', 720)
    .attr('height', 540);

  const chartsPanel = center.append('div')
    .attr('class', 'abm-charts-panel')
    .attr('data-testid', 'charts-panel');

  buildChartTabs(chartsPanel);

  // ── Right: Agent Inspector ────────────────────────────────
  const inspector = main.append('aside')
    .attr('class', 'abm-inspector')
    .attr('data-testid', 'agent-inspector');

  buildAgentInspector(inspector);

  return { canvas: canvas.node(), chartsPanel };
}

// ── Playback Controls ───────────────────────────────────────
function buildPlaybackControls(sidebar) {
  const section = sidebar.append('div').attr('class', 'abm-control-section');
  section.append('div').attr('class', 'abm-section-title').text('Playback');

  const btnRow = section.append('div').attr('class', 'abm-btn-row');

  const runBtn   = btnRow.append('button').attr('class', 'abm-btn abm-btn-primary').attr('data-testid', 'btn-run').text('Run');
  const pauseBtn = btnRow.append('button').attr('class', 'abm-btn').attr('data-testid', 'btn-pause').text('Pause');
  const stepBtn  = btnRow.append('button').attr('class', 'abm-btn').attr('data-testid', 'btn-step').text('Step');
  const resetBtn = btnRow.append('button').attr('class', 'abm-btn').attr('data-testid', 'btn-reset').text('Reset');

  const speedWrap = section.append('div').attr('class', 'abm-slider-wrap');
  speedWrap.append('span').attr('class', 'abm-slider-label').text('Speed');
  const speedBadge = speedWrap.append('span').attr('class', 'abm-slider-badge').attr('data-testid', 'slider-speed').text('1×');
  speedWrap.append('input')
    .attr('type', 'range').attr('min', 0.25).attr('max', 5).attr('step', 0.25).attr('value', 1)
    .attr('data-testid', 'input-speed')
    .on('input', function() { uiState.speed = +this.value; speedBadge.text(uiState.speed + '×'); });

  runBtn.on('click', async () => {
    if (!simState) await SimStore.init();
    SimStore.start();
    runBtn.classed('abm-btn-active', true);
    pauseBtn.classed('abm-btn-active', false);
  });
  pauseBtn.on('click', () => {
    SimStore.pause();
    pauseBtn.classed('abm-btn-active', true);
    runBtn.classed('abm-btn-active', false);
  });
  stepBtn.on('click', async () => {
    if (!simState) await SimStore.init();
    await SimStore.step();
    runBtn.classed('abm-btn-active', false);
    pauseBtn.classed('abm-btn-active', true);
  });
  resetBtn.on('click', async () => {
    await SimStore.init();
    runBtn.classed('abm-btn-active', false);
    pauseBtn.classed('abm-btn-active', false);
  });

  dispatch.on('sim:start.playback', () => {
    runBtn.classed('abm-btn-active', true);
    pauseBtn.classed('abm-btn-active', false);
  });
  dispatch.on('sim:pause.playback', () => {
    runBtn.classed('abm-btn-active', false);
    pauseBtn.classed('abm-btn-active', true);
  });
}

// ── Rule Selector ───────────────────────────────────────────
function buildRuleSelector(sidebar) {
  const section = sidebar.append('div').attr('class', 'abm-control-section');
  section.append('div').attr('class', 'abm-section-title').text('Decision Rule');

  const btnRow = section.append('div').attr('class', 'abm-btn-row abm-rule-btns');

  for (const [key, rule] of Object.entries(RULE_SETS)) {
    btnRow.append('button')
      .attr('class', 'abm-btn abm-rule-btn' + (key === paramState.decisionRule ? ' abm-btn-active' : ''))
      .attr('data-testid', `btn-rule-${key}`)
      .attr('data-rule', key)
      .text(rule.name)
      .on('click', function() {
        const prev = paramState.decisionRule;
        ParamStore.set('decisionRule', key);
        btnRow.selectAll('.abm-rule-btn').classed('abm-btn-active', false);
        d3.select(this).classed('abm-btn-active', true);
        pseudoPanel.text(RULE_SETS[key].pseudocode);
        dispatch.call('rule:change', null, { prev, next: key });
      });
  }

  const pseudoPanel = section.append('pre')
    .attr('class', 'abm-pseudocode')
    .attr('data-testid', 'pseudocode-panel')
    .text(RULE_SETS[paramState.decisionRule].pseudocode);
}

// ── Parameter Sliders ───────────────────────────────────────
function buildParamSliders(sidebar) {
  const section = sidebar.append('div').attr('class', 'abm-control-section');
  section.append('div').attr('class', 'abm-section-title').text('Parameters');

  const sliderDefs = [
    { key: 'preyCount',                label: 'Prey Count',          fmt: '.0f' },
    { key: 'predatorCount',            label: 'Predator Count',      fmt: '.0f' },
    { key: 'preySpeed',                label: 'Prey Speed',          fmt: '.2f' },
    { key: 'predatorSpeed',            label: 'Predator Speed',      fmt: '.2f' },
    { key: 'visionRadius',             label: 'Vision Radius',       fmt: '.0f' },
    { key: 'preyMetabolism',           label: 'Prey Metabolism',     fmt: '.2f' },
    { key: 'predatorMetabolism',       label: 'Predator Metabolism', fmt: '.2f' },
    { key: 'preyReproductionRate',     label: 'Prey Reproduce',      fmt: '.3f' },
    { key: 'predatorReproductionRate', label: 'Pred Reproduce',      fmt: '.3f' },
    { key: 'preyGrassGain',            label: 'Grass Energy Gain',   fmt: '.0f' },
    { key: 'predatorHuntGain',         label: 'Hunt Energy Gain',    fmt: '.0f' },
    { key: 'grassRegrowRate',          label: 'Grass Regrow Rate',   fmt: '.3f' },
    { key: 'fleeThreshold',            label: 'Flee Threshold',      fmt: '.2f' },
    { key: 'maxEnergy',                label: 'Max Energy',          fmt: '.0f' },
    { key: 'seed',                     label: 'Random Seed',         fmt: '.0f' },
  ];

  for (const def of sliderDefs) {
    const limits = PARAM_LIMITS[def.key] || { min: 1, max: 999, step: 1 };
    const wrap = section.append('div').attr('class', 'abm-slider-wrap').attr('data-testid', `slider-${def.key}`);
    wrap.append('span').attr('class', 'abm-slider-label').text(def.label);
    const badge = wrap.append('span').attr('class', 'abm-slider-badge').text(d3.format(def.fmt)(paramState[def.key]));
    wrap.append('input')
      .attr('type', 'range')
      .attr('min', limits.min).attr('max', limits.max).attr('step', limits.step)
      .attr('value', paramState[def.key])
      .attr('data-testid', `input-${def.key}`)
      .on('input', function() {
        const v = +this.value;
        const result = ParamStore.set(def.key, v);
        if (result.ok) badge.text(d3.format(def.fmt)(v));
      });
    dispatch.on(`param:preset.slider-${def.key}`, () => {
      const v = paramState[def.key];
      wrap.select('input').property('value', v);
      badge.text(d3.format(def.fmt)(v));
    });
  }

  const toggles = [
    { key: 'showTrails', label: 'Movement Trails' },
    { key: 'showVision', label: 'Vision Circles' },
  ];
  for (const tog of toggles) {
    const wrap = section.append('label').attr('class', 'abm-toggle');
    wrap.append('input').attr('type', 'checkbox')
      .property('checked', paramState[tog.key])
      .on('change', function() { ParamStore.set(tog.key, this.checked); });
    wrap.append('span').attr('class', 'abm-toggle-track');
    wrap.append('span').attr('class', 'abm-toggle-label').text(tog.label);
  }
}

// ── Preset Selector ─────────────────────────────────────────
function buildPresetSelector(sidebar) {
  const section = sidebar.append('div').attr('class', 'abm-control-section');
  section.append('div').attr('class', 'abm-section-title').text('Presets');
  const btnRow = section.append('div').attr('class', 'abm-btn-row');
  for (const [key, preset] of Object.entries(PRESETS)) {
    btnRow.append('button')
      .attr('class', 'abm-btn abm-preset-btn')
      .text(preset.label)
      .on('click', async () => {
        ParamStore.loadPreset(key);
        await SimStore.init();
      });
  }
}

// ── Export Controls ──────────────────────────────────────────
function buildExportControls(sidebar) {
  const section = sidebar.append('div').attr('class', 'abm-control-section');
  section.append('div').attr('class', 'abm-section-title').text('Export');

  section.append('button')
    .attr('class', 'abm-btn').attr('data-testid', 'btn-export-csv').text('Download CSV')
    .on('click', () => {
      if (!simState?.history?.length) return;
      const csv = 'tick,prey,predator,grass\n' +
        simState.history.map(h => `${h.tick},${h.prey},${h.predator},${h.grass.toFixed(4)}`).join('\n');
      _download(csv, `abm3-simulation-${Date.now()}.csv`, 'text/csv');
    });

  section.append('button')
    .attr('class', 'abm-btn').attr('data-testid', 'btn-export-snapshot').text('Download Snapshot')
    .on('click', () => {
      if (!simState) return;
      const snapshot = {
        engine:  _engine?.isWasm ? 'wasm' : 'js',
        tick:    simState.tick,
        params:  ParamStore.get(),
        agents:  simState.agents.map(a => ({
          id: a.id, type: a.type, x: +a.x.toFixed(2), y: +a.y.toFixed(2),
          energy: +a.energy.toFixed(1), action: a.action, age: a.age, kills: a.kills,
        })),
        history: simState.history,
      };
      _download(JSON.stringify(snapshot, null, 2), `abm3-snapshot-tick${simState.tick}.json`, 'application/json');
    });
}

function _download(text, filename, mime) {
  const blob = new Blob([text], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Chart Tabs ──────────────────────────────────────────────
function buildChartTabs(panel) {
  const tabBar      = panel.append('div').attr('class', 'abm-chart-tabs');
  const chartContent = panel.append('div').attr('class', 'abm-chart-content');

  const tabs = [
    { id: 'population', label: 'Population' },
    { id: 'phase',      label: 'Phase Portrait' },
    { id: 'energy',     label: 'Energy' },
    { id: 'actions',    label: 'Actions' },
    { id: 'grass',      label: 'Grass Map' },
  ];

  for (const tab of tabs) {
    tabBar.append('button')
      .attr('class', 'abm-chart-tab' + (tab.id === 'population' ? ' active' : ''))
      .attr('data-chart', tab.id)
      .text(tab.label)
      .on('click', function() {
        uiState.activeChart = tab.id;
        tabBar.selectAll('.abm-chart-tab').classed('active', false);
        d3.select(this).classed('active', true);
        updateCharts();
      });
  }

  for (const tab of tabs) {
    chartContent.append('div')
      .attr('class', 'abm-chart-container')
      .attr('id', `chart-${tab.id}`)
      .style('display', tab.id === 'population' ? 'block' : 'none');
  }
}

// ── Agent Inspector ─────────────────────────────────────────
function buildAgentInspector(inspector) {
  inspector.append('div').attr('class', 'abm-section-title').text('Agent Inspector');
  const placeholder = inspector.append('div').attr('class', 'abm-inspector-empty')
    .text('Click an agent on the canvas to inspect it');
  const detail = inspector.append('div').attr('class', 'abm-inspector-detail').style('display', 'none');

  const fields = [
    { id: 'insp-id',     label: 'ID' },
    { id: 'insp-type',   label: 'Type' },
    { id: 'insp-action', label: 'Action' },
    { id: 'insp-energy', label: 'Energy' },
    { id: 'insp-age',    label: 'Age' },
    { id: 'insp-kills',  label: 'Kills' },
    { id: 'insp-pos',    label: 'Position' },
    { id: 'insp-vel',    label: 'Velocity' },
  ];
  for (const f of fields) {
    const row = detail.append('div').attr('class', 'abm-insp-row');
    row.append('span').attr('class', 'abm-insp-label').text(f.label);
    row.append('span').attr('class', 'abm-insp-value').attr('data-testid', f.id).text('—');
  }

  const barWrap = detail.append('div').attr('class', 'abm-energy-bar-wrap');
  barWrap.append('div').attr('class', 'abm-energy-bar').attr('data-testid', 'agent-energy-bar');
  barWrap.append('span').attr('class', 'abm-energy-pct').attr('data-testid', 'agent-energy-value').text('0%');

  detail.append('button').attr('class', 'abm-btn').text('Deselect')
    .on('click', () => { uiState.selectedId = null; dispatch.call('agent:deselect', null, {}); });

  dispatch.on('agent:select.inspector',  () => { placeholder.style('display', 'none');  detail.style('display', 'block'); });
  dispatch.on('agent:deselect.inspector',() => { placeholder.style('display', 'block'); detail.style('display', 'none');  });
}

// ════════════════════════════════════════════════════════════════
//  UPDATE FUNCTIONS
// ════════════════════════════════════════════════════════════════

function updateStatsBar(state) {
  const stats    = computeStats(state.agents);
  const grassPct = (state.grid.reduce((s, v) => s + v, 0) / state.grid.length * 100);

  d3.select('[data-testid="stat-tick"]').text(state.tick);
  d3.select('[data-testid="stat-prey"]').text(stats.preyCount);
  d3.select('[data-testid="stat-predator"]').text(stats.predatorCount);
  d3.select('[data-testid="stat-grass"]').text(grassPct.toFixed(0) + '%');
  d3.select('[data-testid="stat-rule"]').text(paramState.decisionRule);
  if (stats.preyEnergies.length > 2) {
    d3.select('[data-testid="stat-gini"]').text(giniCoefficient(stats.preyEnergies).toFixed(3));
  }
  d3.select('[data-testid="stat-fps"]').text(fpsMonitor.fps || '—');
  return stats;
}

function updateInspector(state) {
  if (uiState.selectedId === null) return;
  const agent = state.agents.find(a => a.id === uiState.selectedId && a.alive);
  if (!agent) {
    uiState.selectedId = null;
    dispatch.call('agent:deselect', null, {});
    return;
  }
  d3.select('[data-testid="insp-id"]').text('#' + agent.id);
  d3.select('[data-testid="insp-type"]').text(agent.type);
  d3.select('[data-testid="insp-action"]').text(agent.action);
  d3.select('[data-testid="insp-energy"]').text(agent.energy.toFixed(1));
  d3.select('[data-testid="insp-age"]').text(agent.age);
  d3.select('[data-testid="insp-kills"]').text(agent.kills);
  d3.select('[data-testid="insp-pos"]').text(`(${agent.x.toFixed(1)}, ${agent.y.toFixed(1)})`);
  d3.select('[data-testid="insp-vel"]').text(`(${agent.vx.toFixed(2)}, ${agent.vy.toFixed(2)})`);
  const pct = Math.max(0, Math.min(100, agent.energy / paramState.maxEnergy * 100));
  d3.select('[data-testid="agent-energy-bar"]')
    .style('width', pct + '%')
    .style('background', agent.type === 'prey' ? '#3b82f6' : '#ef4444');
  d3.select('[data-testid="agent-energy-value"]').text(pct.toFixed(0) + '%');
}

function updateCharts() {
  if (!simState) return;
  const stats = computeStats(simState.agents);
  d3.selectAll('.abm-chart-container').style('display', 'none');
  d3.select(`#chart-${uiState.activeChart}`).style('display', 'block');
  const container = document.getElementById(`chart-${uiState.activeChart}`);
  if (!container) return;
  switch (uiState.activeChart) {
    case 'population': drawPopulationChart(container, simState.history, simRunning); break;
    case 'phase':      drawPhasePortrait(container, simState.history); break;
    case 'energy':     drawEnergyHistogram(container, stats.preyEnergies, stats.predEnergies, paramState.maxEnergy); break;
    case 'actions':    drawActionDonut(container, stats.actionDist); break;
    case 'grass':      drawGrassHeatmap(container, simState.grid, GRID_W, GRID_H); break;
  }
}

function renderCanvas(canvas) {
  if (!simState) return;
  const ctx = canvas.getContext('2d');
  const t   = uiState.zoomTransform;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  ctx.save(); ctx.setTransform(t.k, 0, 0, t.k, t.x, t.y);
  drawFrame(ctx, simState, paramState, uiState);
  ctx.restore();
  if (t.k !== 1) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(15,23,42,0.7)'; ctx.fillRect(canvas.width - 60, 4, 56, 20);
    ctx.fillStyle = '#94a3b8'; ctx.font = '11px monospace';
    ctx.fillText(`${t.k.toFixed(1)}×`, canvas.width - 52, 17);
    ctx.restore();
  }
}

// ════════════════════════════════════════════════════════════════
//  CANVAS INTERACTION
// ════════════════════════════════════════════════════════════════

function setupCanvasInteraction(canvas) {
  const zoomBehavior = d3.zoom().scaleExtent([0.5, 6])
    .on('zoom', (event) => {
      uiState.zoomTransform = event.transform;
      if (simState) renderCanvas(canvas);
    });
  d3.select(canvas).call(zoomBehavior);
  d3.select(canvas).on('dblclick.zoom', () => {
    d3.select(canvas).transition().duration(400).call(zoomBehavior.transform, d3.zoomIdentity);
    uiState.zoomTransform = d3.zoomIdentity;
  });
  d3.select(canvas).on('click.select', function(event) {
    if (!simState) return;
    const rect = canvas.getBoundingClientRect();
    const [cx, cy] = uiState.zoomTransform.invert([event.clientX - rect.left, event.clientY - rect.top]);
    const agent = hitTest(simState.agents, cx, cy, canvas.width, canvas.height, 1.5 / uiState.zoomTransform.k);
    if (agent) {
      uiState.selectedId = agent.id;
      dispatch.call('agent:select', null, { id: agent.id });
      updateInspector(simState);
    } else {
      uiState.selectedId = null;
      dispatch.call('agent:deselect', null, {});
    }
  });
  const resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const { width } = entry.contentRect;
      if (width > 0) {
        canvas.width  = Math.floor(width);
        canvas.height = Math.floor(width * (540 / 720));
        if (simState) renderCanvas(canvas);
      }
    }
  });
  resizeObserver.observe(canvas.parentElement);
  canvas._zoomBehavior = zoomBehavior;
}

// ── Keyboard Shortcuts ──────────────────────────────────────
function setupKeyboard() {
  d3.select(window).on('keydown.abm', (event) => {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
    switch (event.key) {
      case ' ':
        event.preventDefault();
        if (SimStore.isRunning()) SimStore.pause();
        else { if (!simState) SimStore.init(); SimStore.start(); }
        break;
      case 'r': case 'R': SimStore.init(); break;
      case 'ArrowRight':
        if (!SimStore.isRunning()) { if (!simState) SimStore.init(); SimStore.step(); }
        break;
      case '1': _setRule('reactive'); break;
      case '2': _setRule('bounded');  break;
      case '3': _setRule('bdi');      break;
      case 't': case 'T': ParamStore.set('showTrails', !paramState.showTrails); break;
      case 'v': case 'V': ParamStore.set('showVision', !paramState.showVision); break;
      case 'Escape': uiState.selectedId = null; dispatch.call('agent:deselect', null, {}); break;
      case '=': case '+': _adjustSpeed(+0.25); break;
      case '-':           _adjustSpeed(-0.25); break;
      case 'z': case 'Z':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          if (canvasRef?._zoomBehavior) {
            d3.select(canvasRef).transition().duration(400).call(canvasRef._zoomBehavior.transform, d3.zoomIdentity);
            uiState.zoomTransform = d3.zoomIdentity;
          }
        }
        break;
      case '?': toggleHelpPanel(); break;
    }
  });
}

function _setRule(key) {
  ParamStore.set('decisionRule', key);
  d3.selectAll('.abm-rule-btn').classed('abm-btn-active', false);
  d3.select(`[data-rule="${key}"]`).classed('abm-btn-active', true);
  d3.select('[data-testid="pseudocode-panel"]').text(RULE_SETS[key].pseudocode);
}

function _adjustSpeed(delta) {
  uiState.speed = Math.max(0.25, Math.min(5, uiState.speed + delta));
  d3.select('[data-testid="slider-speed"]').text(uiState.speed + '×');
  d3.select('[data-testid="input-speed"]').property('value', uiState.speed);
}

// ── Help Panel ──────────────────────────────────────────────
function toggleHelpPanel() {
  let panel = d3.select('.abm-help-overlay');
  if (!panel.empty()) { panel.remove(); return; }
  const shortcuts = [
    ['Space','Play / Pause'],['R','Reset'],['→','Step one tick'],
    ['1/2/3','Switch rule'],['T','Toggle trails'],['V','Toggle vision'],
    ['+/−','Speed'],['Esc','Deselect'],['Ctrl+Z','Reset zoom'],
    ['?','This help'],['Scroll','Zoom'],['Drag','Pan'],['Dbl-click','Reset zoom'],
    ['Click','Select agent'],
  ];
  const overlay = d3.select('.abm-app').append('div').attr('class', 'abm-help-overlay')
    .on('click', function(event) { if (event.target === this) d3.select(this).remove(); });
  const modal = overlay.append('div').attr('class', 'abm-help-modal');
  modal.append('div').attr('class', 'abm-help-title').text('Keyboard Shortcuts');
  const table = modal.append('div').attr('class', 'abm-help-table');
  shortcuts.forEach(([key, desc]) => {
    const row = table.append('div').attr('class', 'abm-help-row');
    row.append('kbd').attr('class', 'abm-help-key').text(key);
    row.append('span').attr('class', 'abm-help-desc').text(desc);
  });
  modal.append('div').attr('class', 'abm-help-footer').text('Press ? or click outside to close');
}

// ════════════════════════════════════════════════════════════════
//  DISPATCH WIRING
// ════════════════════════════════════════════════════════════════

function wireDispatch(canvas) {
  let chartThrottle = 0;
  dispatch.on('sim:tick.render', ({ state }) => {
    renderCanvas(canvas);
    updateStatsBar(state);
    updateInspector(state);
    if (++chartThrottle % 8 === 0) updateCharts();
  });
  dispatch.on('sim:reset.render', ({ state }) => {
    chartThrottle = 0;
    renderCanvas(canvas);
    updateStatsBar(state);
    updateCharts();
  });
}

// ════════════════════════════════════════════════════════════════
//  INITIALIZATION
// ════════════════════════════════════════════════════════════════

async function init() {
  showLoadingOverlay();

  // Load engine (WASM or JS fallback) — this is the only async operation
  _engine = await getEngine();
  hideLoadingOverlay();

  const { canvas } = buildLayout();
  canvasRef = canvas;
  setupCanvasInteraction(canvas);
  setupKeyboard();
  wireDispatch(canvas);

  dispatch.call('engine:ready', null, { isWasm: _engine.isWasm });

  await SimStore.init();
  renderCanvas(canvas);
  updateCharts();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
