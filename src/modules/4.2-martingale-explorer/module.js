/* ============================================================
   Module 4.2 — Martingale Path Explorer
   Full D3.js visualization: sample paths, stopped-value
   histogram, and quadratic variation panel.
   ============================================================ */

import * as d3 from 'd3';
import katex from 'katex';
import '../../lib/copy-code.js';
import '../../lib/param-tooltips.js';

/* ---- Seedable PRNG (xoshiro128**) -------------------------- */
function makeRng(seed) {
  let s = [seed | 0, (seed * 1597334677) | 0, (seed * 2013368947) | 0, (seed * 1013904223) | 0];
  function rotl(x, k) { return ((x << k) | (x >>> (32 - k))) >>> 0; }
  function next() {
    const result = (rotl((s[1] * 5) >>> 0, 7) * 9) >>> 0;
    const t = (s[1] << 9) >>> 0;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
    s[2] ^= t;
    s[3] = rotl(s[3], 11);
    return result;
  }
  // Warm up
  for (let i = 0; i < 20; i++) next();
  return {
    /** Uniform in [0, 1) */
    random() { return next() / 4294967296; },
    /** Standard normal via Box-Muller */
    normal() {
      const u1 = (next() + 1) / 4294967297;
      const u2 = next() / 4294967296;
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }
  };
}

/* ---- State -------------------------------------------------- */
let state = {
  type: 'simple',
  T: 500,
  numPaths: 50,
  stoppingRule: 'none',
  barrier: 10,
  p: 0.5,
  theta: 0.5,
  seed: 42,
};

/* ---- DOM refs ----------------------------------------------- */
const dom = {};

function cacheDom() {
  dom.typeSelect      = document.getElementById('martingale-type');
  dom.timeSlider      = document.getElementById('time-horizon');
  dom.timeVal         = document.getElementById('time-horizon-val');
  dom.pathsSlider     = document.getElementById('num-paths');
  dom.pathsVal        = document.getElementById('num-paths-val');
  dom.stoppingSelect  = document.getElementById('stopping-rule');
  dom.barrierSlider   = document.getElementById('barrier-level');
  dom.barrierVal      = document.getElementById('barrier-level-val');
  dom.barrierGroup    = document.getElementById('barrier-group');
  dom.pSlider         = document.getElementById('p-value');
  dom.pVal            = document.getElementById('p-value-val');
  dom.pGroup          = document.getElementById('p-group');
  dom.thetaSlider     = document.getElementById('theta-value');
  dom.thetaVal        = document.getElementById('theta-value-val');
  dom.thetaGroup      = document.getElementById('theta-group');
  dom.regenerateBtn   = document.getElementById('regenerate-btn');
  dom.pathsSubtitle   = document.getElementById('paths-subtitle');
  dom.histSubtitle    = document.getElementById('histogram-subtitle');
  dom.qvSubtitle      = document.getElementById('qv-subtitle');
}

/* ---- Path generation ---------------------------------------- */

function generatePaths(rng) {
  const { type, T, numPaths, p, theta } = state;
  const paths = [];

  for (let i = 0; i < numPaths; i++) {
    const path = new Float64Array(T + 1);
    path[0] = 0;

    if (type === 'simple') {
      // Simple symmetric random walk: +1/-1 with p = 0.5
      for (let n = 1; n <= T; n++) {
        const step = rng.random() < 0.5 ? 1 : -1;
        path[n] = path[n - 1] + step;
      }
    } else if (type === 'scaled') {
      // Scaled random walk with adjustable p
      // Step = +1 with prob p, -1 with prob 1-p
      // Mean step = 2p - 1. Martingale only when p = 0.5.
      for (let n = 1; n <= T; n++) {
        const step = rng.random() < p ? 1 : -1;
        path[n] = path[n - 1] + step;
      }
    } else if (type === 'doob') {
      // Doob martingale: M_k = E[S_T | F_k]
      // Where S_T = X_1 + ... + X_T, X_i ~ Uniform(-1,1)
      // M_k = (X_1+...+X_k) + (T-k)*E[X_i] = X_1+...+X_k  (since E[X_i]=0)
      // So M_k is just the running partial sum of uniform r.v.s
      for (let n = 1; n <= T; n++) {
        const xi = rng.random() * 2 - 1; // Uniform(-1, 1)
        path[n] = path[n - 1] + xi;
      }
    } else if (type === 'exponential') {
      // Exponential martingale: M_n = exp(theta * S_n - n * log(cosh(theta)))
      // where S_n is a symmetric random walk (±1 steps with p = 0.5)
      const logCosh = Math.log(Math.cosh(theta));
      let sn = 0;
      for (let n = 1; n <= T; n++) {
        sn += rng.random() < 0.5 ? 1 : -1;
        const val = Math.exp(theta * sn - n * logCosh);
        // Cap at a finite ceiling to prevent Infinity from breaking the y-scale
        path[n] = isFinite(val) ? val : 1e15;
      }
      // M_0 = exp(0) = 1; shift so M_0 = 0 for consistent display?
      // Actually keep it natural: M_0 = 1 for exponential martingale.
      path[0] = 1;
    }

    paths.push(path);
  }

  return paths;
}

/* ---- Stopping times ----------------------------------------- */

function computeStoppingTimes(paths) {
  const { stoppingRule, barrier, T } = state;
  if (stoppingRule === 'none') return null;

  return paths.map(path => {
    if (stoppingRule === 'first-passage') {
      for (let n = 0; n <= T; n++) {
        if (Math.abs(path[n]) >= barrier) return n;
      }
      return T; // Never hit barrier
    } else if (stoppingRule === 'fixed-time') {
      return Math.min(barrier * 10, T); // Use barrier * 10 as fixed time
    }
    return T;
  });
}

/* ---- Quadratic variation ------------------------------------ */

function computeQV(paths) {
  const T = state.T;
  return paths.map(path => {
    const qv = new Float64Array(T + 1);
    qv[0] = 0;
    for (let n = 1; n <= T; n++) {
      const inc = path[n] - path[n - 1];
      qv[n] = qv[n - 1] + inc * inc;
    }
    return qv;
  });
}

/* ---- Chart dimensions --------------------------------------- */

function dims(container, overrides = {}) {
  const w = container.clientWidth || 600;
  const margin = { top: 20, right: 20, bottom: 36, left: 50, ...overrides };
  return {
    width: w,
    height: overrides.height || Math.min(w * 0.55, 380),
    margin,
    innerW: w - margin.left - margin.right,
    innerH: (overrides.height || Math.min(w * 0.55, 380)) - margin.top - margin.bottom,
  };
}

/* ---- Color scale for paths ---------------------------------- */

const pathColors = [
  '#2563eb', '#e97319', '#059669', '#7c3aed', '#db2777',
  '#0891b2', '#ca8a04', '#64748b',
];

function pathColor(i) {
  return pathColors[i % pathColors.length];
}

/* ---- Render: paths panel ------------------------------------ */

function renderPaths(paths, stoppingTimes) {
  const container = document.getElementById('paths-chart');
  container.innerHTML = '';

  const d = dims(container, { height: 340 });
  const { T } = state;

  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${d.width} ${d.height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('transform', `translate(${d.margin.left},${d.margin.top})`);

  // Determine y extent across all paths (up to stopping time if applicable)
  let yMin = Infinity, yMax = -Infinity;
  paths.forEach((path, i) => {
    const stop = stoppingTimes ? stoppingTimes[i] : T;
    for (let n = 0; n <= stop; n++) {
      if (path[n] < yMin) yMin = path[n];
      if (path[n] > yMax) yMax = path[n];
    }
  });

  const yPad = Math.max((yMax - yMin) * 0.1, 1);
  yMin -= yPad;
  yMax += yPad;

  const x = d3.scaleLinear().domain([0, T]).range([0, d.innerW]);
  const y = d3.scaleLinear().domain([yMin, yMax]).range([d.innerH, 0]);

  // Axes
  g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${d.innerH})`)
    .call(d3.axisBottom(x).ticks(8));

  g.append('g')
    .attr('class', 'y-axis')
    .call(d3.axisLeft(y).ticks(6));

  // Axis labels
  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', d.innerW / 2)
    .attr('y', d.innerH + 32)
    .attr('text-anchor', 'middle')
    .text('Step n');

  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', -d.innerH / 2)
    .attr('y', -38)
    .attr('text-anchor', 'middle')
    .attr('transform', 'rotate(-90)')
    .text(state.type === 'exponential' ? 'M_n' : 'M_n');

  // Reference line at M_0
  const m0 = state.type === 'exponential' ? 1 : 0;
  if (y(m0) >= 0 && y(m0) <= d.innerH) {
    g.append('g')
      .attr('class', 'reference-line')
      .append('line')
      .attr('x1', 0).attr('x2', d.innerW)
      .attr('y1', y(m0)).attr('y2', y(m0));
  }

  // Barrier lines (if first-passage)
  if (state.stoppingRule === 'first-passage') {
    const b = state.barrier;
    [-b, b].forEach(level => {
      if (y(level) >= 0 && y(level) <= d.innerH) {
        g.append('line')
          .attr('x1', 0).attr('x2', d.innerW)
          .attr('y1', y(level)).attr('y2', y(level))
          .attr('stroke', '#dc2626')
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '6 3')
          .attr('opacity', 0.6);
      }
    });
  }

  // Draw paths
  const lineGen = d3.line()
    .x((_, idx) => x(idx))
    .y(val => y(val));

  // Subsample for performance: when T is large, only plot every kth point
  const maxPoints = 800;
  const stride = Math.max(1, Math.floor(T / maxPoints));

  paths.forEach((path, i) => {
    const stop = stoppingTimes ? stoppingTimes[i] : T;
    const points = [];
    for (let n = 0; n <= stop; n += stride) {
      points.push([n, path[n]]);
    }
    // Ensure final point is included
    if (points.length === 0 || points[points.length - 1][0] !== stop) {
      points.push([stop, path[stop]]);
    }

    const lineGenPath = d3.line()
      .x(d => x(d[0]))
      .y(d => y(d[1]));

    g.append('path')
      .datum(points)
      .attr('class', 'sample-path')
      .attr('d', lineGenPath)
      .attr('stroke', pathColor(i))
      .attr('opacity', Math.max(0.12, 0.7 - state.numPaths * 0.005));

    // Mark stopping dot
    if (stoppingTimes && stop <= T) {
      g.append('circle')
        .attr('class', 'stop-dot')
        .attr('cx', x(stop))
        .attr('cy', y(path[stop]))
        .attr('r', 3.5)
        .attr('fill', pathColor(i));
    }
  });
}

/* ---- Render: histogram panel -------------------------------- */

function renderHistogram(paths, stoppingTimes) {
  const container = document.getElementById('histogram-chart');
  const statsContainer = document.getElementById('histogram-stats');
  container.innerHTML = '';
  statsContainer.innerHTML = '';

  if (!stoppingTimes) {
    dom.histSubtitle.innerHTML = 'Enable a stopping rule to view M<sub>T</sub> histogram';
    return;
  }

  // Collect stopped values
  const stoppedValues = paths.map((path, i) => path[stoppingTimes[i]]);
  const mean = d3.mean(stoppedValues);
  const std = d3.deviation(stoppedValues) || 0;

  dom.histSubtitle.textContent = `Distribution of M_T across ${stoppedValues.length} paths`;

  const d = dims(container, { height: 240 });

  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${d.width} ${d.height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('transform', `translate(${d.margin.left},${d.margin.top})`);

  // Histogram bins
  const extent = d3.extent(stoppedValues);
  const pad = Math.max((extent[1] - extent[0]) * 0.1, 1);

  const histGen = d3.bin()
    .domain([extent[0] - pad, extent[1] + pad])
    .thresholds(Math.min(30, Math.max(10, Math.ceil(Math.sqrt(stoppedValues.length)))));

  const bins = histGen(stoppedValues);

  const x = d3.scaleLinear()
    .domain([bins[0].x0, bins[bins.length - 1].x1])
    .range([0, d.innerW]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(bins, b => b.length)])
    .nice()
    .range([d.innerH, 0]);

  g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${d.innerH})`)
    .call(d3.axisBottom(x).ticks(6));

  g.append('g')
    .attr('class', 'y-axis')
    .call(d3.axisLeft(y).ticks(4));

  // Bars
  g.selectAll('.hist-bar')
    .data(bins)
    .join('rect')
    .attr('class', 'hist-bar')
    .attr('x', b => x(b.x0) + 1)
    .attr('y', b => y(b.length))
    .attr('width', b => Math.max(0, x(b.x1) - x(b.x0) - 2))
    .attr('height', b => d.innerH - y(b.length));

  // Mean line (E[M_T])
  g.append('line')
    .attr('class', 'mean-line')
    .attr('x1', x(mean)).attr('x2', x(mean))
    .attr('y1', 0).attr('y2', d.innerH);

  g.append('text')
    .attr('class', 'mean-label')
    .attr('x', x(mean) + 4)
    .attr('y', 12)
    .text(`E[M_T] = ${mean.toFixed(3)}`);

  // Stats cards
  statsContainer.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${mean.toFixed(3)}</div>
      <div class="stat-label">E[M_T]</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${std.toFixed(3)}</div>
      <div class="stat-label">Std Dev</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${d3.mean(stoppingTimes).toFixed(1)}</div>
      <div class="stat-label">E[T]</div>
    </div>
  `;
}

/* ---- Render: quadratic variation panel ---------------------- */

function renderQV(paths, qvPaths) {
  const container = document.getElementById('qv-chart');
  container.innerHTML = '';

  const { T, type } = state;
  const d = dims(container, { height: 240 });

  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${d.width} ${d.height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('transform', `translate(${d.margin.left},${d.margin.top})`);

  // y extent
  let qvMax = 0;
  qvPaths.forEach(qv => {
    if (qv[T] > qvMax) qvMax = qv[T];
  });
  qvMax = Math.max(qvMax * 1.1, T * 0.5);

  const x = d3.scaleLinear().domain([0, T]).range([0, d.innerW]);
  const y = d3.scaleLinear().domain([0, qvMax]).range([d.innerH, 0]);

  g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${d.innerH})`)
    .call(d3.axisBottom(x).ticks(6));

  g.append('g')
    .attr('class', 'y-axis')
    .call(d3.axisLeft(y).ticks(5));

  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', d.innerW / 2)
    .attr('y', d.innerH + 32)
    .attr('text-anchor', 'middle')
    .text('Step n');

  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', -d.innerH / 2)
    .attr('y', -38)
    .attr('text-anchor', 'middle')
    .attr('transform', 'rotate(-90)')
    .text('[M]_n');

  // Reference line y = n for simple random walk and scaled walk (since increments are ±1)
  if (type === 'simple' || type === 'scaled') {
    // [M]_n = n for ±1 steps (regardless of p)
    g.append('line')
      .attr('class', 'qv-reference')
      .attr('x1', x(0)).attr('x2', x(T))
      .attr('y1', y(0)).attr('y2', y(T));
  } else if (type === 'doob') {
    // Increments are Uniform(-1,1), variance = 1/3, so [M]_n ~ n/3
    g.append('line')
      .attr('class', 'qv-reference')
      .attr('x1', x(0)).attr('x2', x(T))
      .attr('y1', y(0)).attr('y2', y(T / 3));
  }

  // Subsample
  const maxPoints = 600;
  const stride = Math.max(1, Math.floor(T / maxPoints));

  qvPaths.forEach((qv, i) => {
    const points = [];
    for (let n = 0; n <= T; n += stride) {
      points.push([n, qv[n]]);
    }
    if (points[points.length - 1][0] !== T) {
      points.push([T, qv[T]]);
    }

    const lineGenQV = d3.line()
      .x(p => x(p[0]))
      .y(p => y(p[1]));

    g.append('path')
      .datum(points)
      .attr('class', 'sample-path')
      .attr('d', lineGenQV)
      .attr('stroke', pathColor(i))
      .attr('opacity', Math.max(0.12, 0.6 - state.numPaths * 0.004));
  });

  // Subtitle
  if (type === 'simple') {
    dom.qvSubtitle.textContent = 'Orange dashed line: [M]_n = n (theoretical)';
  } else if (type === 'scaled') {
    dom.qvSubtitle.textContent = 'Orange dashed: [M]_n = n (each increment squared is 1)';
  } else if (type === 'doob') {
    dom.qvSubtitle.textContent = 'Orange dashed: [M]_n = n/3 (Var of Uniform(-1,1) = 1/3)';
  } else {
    dom.qvSubtitle.textContent = 'Quadratic variation of the exponential martingale';
  }
}

/* ---- KaTeX formulas ----------------------------------------- */

function renderFormulas() {
  const formulaEl = document.getElementById('paths-formula');
  const martDef   = document.getElementById('info-martingale-def');
  const ostDef    = document.getElementById('info-ost-def');
  const qvDef     = document.getElementById('info-qv-def');

  const formulas = {
    simple:      'M_n = \\sum_{k=1}^{n} X_k, \\quad X_k \\stackrel{\\text{iid}}{\\sim} \\{+1, -1\\} \\text{ with } p = \\tfrac{1}{2}',
    scaled:      `M_n = \\sum_{k=1}^{n} X_k, \\quad P(X_k = +1) = ${state.p.toFixed(2)}, \\; P(X_k = -1) = ${(1 - state.p).toFixed(2)}`,
    doob:        'M_k = \\mathbb{E}[S_T \\mid \\mathcal{F}_k] = X_1 + \\cdots + X_k, \\quad X_i \\sim \\text{Unif}(-1, 1)',
    exponential: `M_n = \\exp\\!\\bigl(\\theta S_n - n \\ln \\cosh \\theta\\bigr), \\quad \\theta = ${state.theta.toFixed(2)}`,
  };

  try {
    katex.render(formulas[state.type], formulaEl, { displayMode: true, throwOnError: false });
  } catch (_) { /* ignore */ }

  // Info panel formulas
  try {
    katex.render(
      '\\mathbb{E}[M_{n+1} \\mid \\mathcal{F}_n] = M_n',
      martDef, { displayMode: true, throwOnError: false }
    );
    katex.render(
      '\\mathbb{E}[M_T] = \\mathbb{E}[M_0]',
      ostDef, { displayMode: true, throwOnError: false }
    );
    katex.render(
      '[M]_n = \\sum_{k=1}^{n} (M_k - M_{k-1})^2',
      qvDef, { displayMode: true, throwOnError: false }
    );
  } catch (_) { /* ignore */ }
}

/* ---- Subtitle ----------------------------------------------- */

function updateSubtitles() {
  const labels = {
    simple:      'Simple symmetric random walk (p = 0.5)',
    scaled:      `Scaled random walk (p = ${state.p.toFixed(2)})` + (state.p !== 0.5 ? ' — NOT a martingale' : ' — martingale'),
    doob:        'Doob martingale with Uniform(-1,1) increments',
    exponential: `Exponential martingale (theta = ${state.theta.toFixed(2)})`,
  };
  dom.pathsSubtitle.textContent = `${labels[state.type]} — ${state.numPaths} paths, T = ${state.T}`;
}

/* ---- Main update -------------------------------------------- */

function update() {
  const rng = makeRng(state.seed);
  const paths = generatePaths(rng);
  const stoppingTimes = computeStoppingTimes(paths);
  const qvPaths = computeQV(paths);

  updateSubtitles();
  renderFormulas();
  renderPaths(paths, stoppingTimes);
  renderHistogram(paths, stoppingTimes);
  renderQV(paths, qvPaths);
}

/* ---- Wire up controls --------------------------------------- */

function wireControls() {
  dom.typeSelect.addEventListener('change', () => {
    state.type = dom.typeSelect.value;
    // Show/hide conditional controls
    dom.pGroup.style.display = state.type === 'scaled' ? '' : 'none';
    dom.thetaGroup.style.display = state.type === 'exponential' ? '' : 'none';
    update();
  });

  dom.timeSlider.addEventListener('input', () => {
    state.T = +dom.timeSlider.value;
    dom.timeVal.textContent = state.T;
    update();
  });

  dom.pathsSlider.addEventListener('input', () => {
    state.numPaths = +dom.pathsSlider.value;
    dom.pathsVal.textContent = state.numPaths;
    update();
  });

  dom.stoppingSelect.addEventListener('change', () => {
    state.stoppingRule = dom.stoppingSelect.value;
    dom.barrierGroup.style.display =
      state.stoppingRule !== 'none' ? '' : 'none';
    update();
  });

  dom.barrierSlider.addEventListener('input', () => {
    state.barrier = +dom.barrierSlider.value;
    dom.barrierVal.textContent = state.barrier;
    update();
  });

  dom.pSlider.addEventListener('input', () => {
    state.p = +dom.pSlider.value;
    dom.pVal.textContent = state.p.toFixed(2);
    update();
  });

  dom.thetaSlider.addEventListener('input', () => {
    state.theta = +dom.thetaSlider.value;
    dom.thetaVal.textContent = state.theta.toFixed(2);
    update();
  });

  dom.regenerateBtn.addEventListener('click', () => {
    state.seed = Math.floor(Math.random() * 1e9);
    update();
  });
}

/* ---- Init --------------------------------------------------- */

function init() {
  cacheDom();
  wireControls();

  // Set initial visibility
  dom.pGroup.style.display = 'none';
  dom.thetaGroup.style.display = 'none';
  dom.barrierGroup.style.display = state.stoppingRule !== 'none' ? '' : 'none';

  // Initial render
  update();
}

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
