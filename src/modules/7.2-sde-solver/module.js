/* ============================================================
   Module 7.2 — SDE Solver Studio
   Interactive D3.js visualization for simulating classical
   Stochastic Differential Equations via Euler-Maruyama.
   ============================================================ */

import * as d3 from 'd3';
import katex from 'katex';
import '../../lib/copy-code.js';

/* ---- Seedable PRNG (mulberry32) -------------------------------- */
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seed) {
  const raw = mulberry32(seed);
  // Warm up
  for (let i = 0; i < 20; i++) raw();
  let hasSpare = false;
  let spare = 0;
  return {
    random() { return raw(); },
    normal() {
      if (hasSpare) { hasSpare = false; return spare; }
      let u, v, s;
      do {
        u = raw() * 2 - 1;
        v = raw() * 2 - 1;
        s = u * u + v * v;
      } while (s >= 1 || s === 0);
      const f = Math.sqrt(-2 * Math.log(s) / s);
      spare = v * f;
      hasSpare = true;
      return u * f;
    }
  };
}

/* ---- SDE definitions ------------------------------------------- */
const SDE_TYPES = {
  gbm: {
    label: 'Geometric Brownian Motion',
    params: [
      { key: 'mu', label: '\u03bc (drift)', min: -1, max: 2, step: 0.05, default: 0.1 },
      { key: 'sigma', label: '\u03c3 (volatility)', min: 0.01, max: 2, step: 0.05, default: 0.3 },
    ],
    drift(x, t, p) { return p.mu * x; },
    diffusion(x, t, p) { return p.sigma * x; },
    exactMean(t, p, x0) { return x0 * Math.exp(p.mu * t); },
    exactVar(t, p, x0) {
      return x0 * x0 * Math.exp(2 * p.mu * t) * (Math.exp(p.sigma * p.sigma * t) - 1);
    },
    terminalDensity(x, T, p, x0) {
      if (x <= 0) return 0;
      const m = Math.log(x0) + (p.mu - 0.5 * p.sigma * p.sigma) * T;
      const s = p.sigma * Math.sqrt(T);
      const z = (Math.log(x) - m) / s;
      return Math.exp(-0.5 * z * z) / (x * s * Math.sqrt(2 * Math.PI));
    },
    equation: 'dX_t = \\mu X_t\\,dt + \\sigma X_t\\,dB_t',
    exactSol: 'X_t = X_0 \\exp\\!\\left(\\left(\\mu - \\tfrac{\\sigma^2}{2}\\right)t + \\sigma B_t\\right)',
  },
  ou: {
    label: 'Ornstein-Uhlenbeck',
    params: [
      { key: 'theta', label: '\u03b8 (mean-reversion speed)', min: 0.1, max: 5, step: 0.1, default: 1.0 },
      { key: 'mu', label: '\u03bc (long-run mean)', min: -3, max: 3, step: 0.1, default: 0.0 },
      { key: 'sigma', label: '\u03c3 (volatility)', min: 0.05, max: 2, step: 0.05, default: 0.5 },
    ],
    drift(x, t, p) { return p.theta * (p.mu - x); },
    diffusion(x, t, p) { return p.sigma; },
    exactMean(t, p, x0) { return p.mu + (x0 - p.mu) * Math.exp(-p.theta * t); },
    exactVar(t, p) {
      return (p.sigma * p.sigma / (2 * p.theta)) * (1 - Math.exp(-2 * p.theta * t));
    },
    terminalDensity(x, T, p, x0) {
      const m = p.mu + (x0 - p.mu) * Math.exp(-p.theta * T);
      const v = (p.sigma * p.sigma / (2 * p.theta)) * (1 - Math.exp(-2 * p.theta * T));
      const s = Math.sqrt(v);
      const z = (x - m) / s;
      return Math.exp(-0.5 * z * z) / (s * Math.sqrt(2 * Math.PI));
    },
    equation: 'dX_t = \\theta(\\mu - X_t)\\,dt + \\sigma\\,dB_t',
    exactSol: 'X_t = \\mu + (X_0 - \\mu)e^{-\\theta t} + \\sigma \\int_0^t e^{-\\theta(t-s)}\\,dB_s',
  },
  cir: {
    label: 'Cox-Ingersoll-Ross',
    params: [
      { key: 'kappa', label: '\u03ba (mean-reversion speed)', min: 0.1, max: 5, step: 0.1, default: 1.0 },
      { key: 'theta', label: '\u03b8 (long-run mean)', min: 0.1, max: 3, step: 0.1, default: 1.0 },
      { key: 'sigma', label: '\u03c3 (vol-of-vol)', min: 0.05, max: 2, step: 0.05, default: 0.3 },
    ],
    drift(x, t, p) { return p.kappa * (p.theta - x); },
    diffusion(x, t, p) { return p.sigma * Math.sqrt(Math.max(x, 0)); },
    exactMean(t, p, x0) { return p.theta + (x0 - p.theta) * Math.exp(-p.kappa * t); },
    exactVar(t, p, x0) {
      const ekt = Math.exp(-p.kappa * t);
      return x0 * (p.sigma * p.sigma / p.kappa) * (ekt - Math.exp(-2 * p.kappa * t))
        + (p.theta * p.sigma * p.sigma / (2 * p.kappa)) * Math.pow(1 - ekt, 2);
    },
    terminalDensity: null,
    equation: 'dX_t = \\kappa(\\theta - X_t)\\,dt + \\sigma\\sqrt{X_t}\\,dB_t',
    exactSol: '\\mathbb{E}[X_t] = \\theta + (X_0 - \\theta)e^{-\\kappa t}',
  },
  bridge: {
    label: 'Brownian Bridge',
    params: [
      { key: 'b', label: 'b (target value)', min: -3, max: 3, step: 0.1, default: 0.0 },
    ],
    drift(x, t, p) {
      const remain = p._T - t;
      if (remain < 1e-10) return 0;
      return (p.b - x) / remain;
    },
    diffusion(x, t, p) { return 1; },
    exactMean(t, p, x0) {
      const T = p._T;
      if (T < 1e-10) return x0;
      return x0 * (1 - t / T) + p.b * (t / T);
    },
    exactVar(t, p) {
      const T = p._T;
      if (T < 1e-10) return 0;
      return t * (T - t) / T;
    },
    terminalDensity: null,
    equation: 'dX_t = \\frac{b - X_t}{T - t}\\,dt + dB_t',
    exactSol: 'X_t = X_0\\!\\left(1 - \\tfrac{t}{T}\\right) + b\\,\\tfrac{t}{T} + (T-t)\\int_0^t \\frac{dB_s}{T-s}',
  },
  doublewell: {
    label: 'Double-Well Potential',
    params: [
      { key: 'sigma', label: '\u03c3 (noise intensity)', min: 0.1, max: 3, step: 0.1, default: 0.7 },
    ],
    drift(x, t, p) { return x - x * x * x; },
    diffusion(x, t, p) { return p.sigma; },
    exactMean: null,
    exactVar: null,
    terminalDensity: null,
    equation: 'dX_t = (X_t - X_t^3)\\,dt + \\sigma\\,dB_t',
    exactSol: 'V(x) = -\\tfrac{x^2}{2} + \\tfrac{x^4}{4} \\quad \\text{(double-well potential)}',
  },
};

/* ---- Chart helpers --------------------------------------------- */
const MARGIN = { top: 20, right: 30, bottom: 45, left: 55 };
const VIZ_COLORS = [
  '#2563eb', '#e97319', '#059669', '#7c3aed', '#db2777',
  '#0891b2', '#ca8a04', '#64748b', '#dc2626', '#4f46e5',
];

function chartDims(container) {
  const w = container.clientWidth || 700;
  const h = Math.min(400, Math.max(280, w * 0.5));
  return {
    width: w, height: h,
    innerWidth: w - MARGIN.left - MARGIN.right,
    innerHeight: h - MARGIN.top - MARGIN.bottom,
  };
}

function smallChartDims(container) {
  const w = container.clientWidth || 350;
  const h = Math.min(320, Math.max(220, w * 0.55));
  return {
    width: w, height: h,
    innerWidth: w - MARGIN.left - MARGIN.right,
    innerHeight: h - MARGIN.top - MARGIN.bottom,
  };
}

function makeSvg(container, dims) {
  return d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${dims.width} ${dims.height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');
}

function addAxes(g, xScale, yScale, dims, xLabel, yLabel) {
  g.append('g')
    .attr('class', 'axis x-axis')
    .attr('transform', `translate(0,${dims.innerHeight})`)
    .call(d3.axisBottom(xScale).ticks(7));
  g.append('g')
    .attr('class', 'axis y-axis')
    .call(d3.axisLeft(yScale).ticks(6));
  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', dims.innerWidth / 2)
    .attr('y', dims.innerHeight + 38)
    .attr('text-anchor', 'middle')
    .text(xLabel);
  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -dims.innerHeight / 2)
    .attr('y', -42)
    .attr('text-anchor', 'middle')
    .text(yLabel);
}

/* ---- State ----------------------------------------------------- */
const state = {
  sdeType: 'gbm',
  params: { mu: 0.1, sigma: 0.3 },
  x0: 1.0,
  T: 1.0,
  dt: 0.005,
  numPaths: 50,
  seed: 42,
  // Computed
  paths: null,
  timeGrid: null,
};

/* ---- Euler-Maruyama solver ------------------------------------- */
function eulerMaruyama(rng, sdeType, params, x0, T, dt) {
  const sde = SDE_TYPES[sdeType];
  const N = Math.max(1, Math.round(T / dt));
  const actualDt = T / N;
  const sqrtDt = Math.sqrt(actualDt);
  const path = new Float64Array(N + 1);
  path[0] = x0;

  // Augment params with T for bridge
  const p = { ...params, _T: T };

  for (let i = 0; i < N; i++) {
    const t = i * actualDt;
    const x = path[i];
    const dW = sqrtDt * rng.normal();
    let xNext = x + sde.drift(x, t, p) * actualDt + sde.diffusion(x, t, p) * dW;

    // CIR: reflect to keep non-negative
    if (sdeType === 'cir') xNext = Math.max(xNext, 0);

    path[i + 1] = xNext;
  }
  return path;
}

function simulate() {
  const rng = makeRng(state.seed);
  const N = Math.max(1, Math.round(state.T / state.dt));
  const actualDt = state.T / N;
  const timeGrid = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) timeGrid[i] = i * actualDt;

  const paths = [];
  for (let i = 0; i < state.numPaths; i++) {
    paths.push(eulerMaruyama(rng, state.sdeType, state.params, state.x0, state.T, state.dt));
  }

  state.paths = paths;
  state.timeGrid = timeGrid;
}

/* ---- Compute empirical moments --------------------------------- */
function computeMoments(paths, timeGrid) {
  const N = timeGrid.length;
  const nPaths = paths.length;
  const means = new Float64Array(N);
  const variances = new Float64Array(N);

  for (let j = 0; j < N; j++) {
    let sum = 0;
    for (let i = 0; i < nPaths; i++) sum += paths[i][j];
    const m = sum / nPaths;
    means[j] = m;

    let sumSq = 0;
    for (let i = 0; i < nPaths; i++) {
      const d = paths[i][j] - m;
      sumSq += d * d;
    }
    variances[j] = nPaths > 1 ? sumSq / (nPaths - 1) : 0;
  }
  return { means, variances };
}

/* ---- Subsample for rendering ----------------------------------- */
function subsample(arr, timeGrid, maxPts) {
  const N = arr.length;
  if (N <= maxPts) {
    const out = [];
    for (let i = 0; i < N; i++) out.push({ t: timeGrid[i], v: arr[i] });
    return out;
  }
  const stride = Math.max(1, Math.floor(N / maxPts));
  const out = [];
  for (let i = 0; i < N; i += stride) out.push({ t: timeGrid[i], v: arr[i] });
  // Ensure last point
  if (out[out.length - 1].t !== timeGrid[N - 1]) {
    out.push({ t: timeGrid[N - 1], v: arr[N - 1] });
  }
  return out;
}

/* ================================================================
   RENDER: Sample Paths
   ================================================================ */
function renderPaths() {
  const container = document.getElementById('paths-plot');
  container.innerHTML = '';

  const { paths, timeGrid } = state;
  if (!paths || !timeGrid) return;

  const sde = SDE_TYPES[state.sdeType];
  const params = { ...state.params, _T: state.T };
  const { means, variances } = computeMoments(paths, timeGrid);
  const dims = chartDims(container);
  const maxPts = 600;

  // y extent
  let yMin = Infinity, yMax = -Infinity;
  for (const p of paths) {
    for (let j = 0; j < p.length; j++) {
      if (p[j] < yMin) yMin = p[j];
      if (p[j] > yMax) yMax = p[j];
    }
  }
  const yPad = Math.max((yMax - yMin) * 0.08, 0.1);

  const svg = makeSvg(container, dims);
  const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  svg.append('defs').append('clipPath').attr('id', 'paths-clip')
    .append('rect').attr('width', dims.innerWidth).attr('height', dims.innerHeight);

  const xScale = d3.scaleLinear().domain([0, state.T]).range([0, dims.innerWidth]);
  const yScale = d3.scaleLinear().domain([yMin - yPad, yMax + yPad]).range([dims.innerHeight, 0]);

  addAxes(g, xScale, yScale, dims, 't', 'X(t)');

  const plotG = g.append('g').attr('clip-path', 'url(#paths-clip)');
  const line = d3.line().x(d => xScale(d.t)).y(d => yScale(d.v));

  // Confidence band (mean +/- 2*std)
  const bandData = [];
  const stride = Math.max(1, Math.floor(timeGrid.length / maxPts));
  for (let j = 0; j < timeGrid.length; j += stride) {
    const s2 = Math.sqrt(Math.max(variances[j], 0));
    bandData.push({ t: timeGrid[j], lo: means[j] - 2 * s2, hi: means[j] + 2 * s2 });
  }
  if (bandData.length > 0 && bandData[bandData.length - 1].t !== timeGrid[timeGrid.length - 1]) {
    const j = timeGrid.length - 1;
    const s2 = Math.sqrt(Math.max(variances[j], 0));
    bandData.push({ t: timeGrid[j], lo: means[j] - 2 * s2, hi: means[j] + 2 * s2 });
  }

  const area = d3.area()
    .x(d => xScale(d.t))
    .y0(d => yScale(d.lo))
    .y1(d => yScale(d.hi));

  plotG.append('path')
    .datum(bandData)
    .attr('class', 'confidence-band')
    .attr('d', area)
    .attr('fill', '#2563eb');

  // Sample paths
  const pathOpacity = Math.max(0.1, 0.7 - state.numPaths * 0.005);
  paths.forEach((p, i) => {
    const pts = subsample(p, timeGrid, maxPts);
    plotG.append('path')
      .datum(pts)
      .attr('class', 'sde-path')
      .attr('d', line)
      .attr('stroke', VIZ_COLORS[i % VIZ_COLORS.length])
      .attr('opacity', pathOpacity);
  });

  // Empirical mean path
  const meanPts = subsample(means, timeGrid, maxPts);
  plotG.append('path')
    .datum(meanPts)
    .attr('class', 'mean-path')
    .attr('d', line);

  // Exact mean overlay (if available)
  if (sde.exactMean) {
    const exactPts = [];
    for (let j = 0; j < timeGrid.length; j += stride) {
      exactPts.push({ t: timeGrid[j], v: sde.exactMean(timeGrid[j], params, state.x0) });
    }
    const lastIdx = timeGrid.length - 1;
    if (exactPts.length === 0 || exactPts[exactPts.length - 1].t !== timeGrid[lastIdx]) {
      exactPts.push({ t: timeGrid[lastIdx], v: sde.exactMean(timeGrid[lastIdx], params, state.x0) });
    }
    plotG.append('path')
      .datum(exactPts)
      .attr('class', 'exact-mean')
      .attr('d', line);
  }

  // Legend
  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  legend.innerHTML =
    '<span class="legend-item"><span class="legend-line-dashed" style="border-color:var(--color-text)"></span>Empirical mean</span>' +
    (sde.exactMean ? '<span class="legend-item"><span class="legend-line" style="background:var(--color-accent)"></span>Exact mean</span>' : '') +
    '<span class="legend-item"><span class="legend-patch" style="background:#2563eb;opacity:0.12"></span>\u00b12\u03c3 band</span>';
  container.appendChild(legend);
}

/* ================================================================
   RENDER: Terminal Distribution
   ================================================================ */
function renderDensity() {
  const container = document.getElementById('density-plot');
  container.innerHTML = '';

  const { paths, timeGrid } = state;
  if (!paths || !timeGrid) return;

  const sde = SDE_TYPES[state.sdeType];
  const params = { ...state.params, _T: state.T };
  const N = timeGrid.length - 1;
  const terminalValues = paths.map(p => p[N]);

  const dims = smallChartDims(container);
  const svg = makeSvg(container, dims);
  const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  // Histogram
  const extent = d3.extent(terminalValues);
  const range = extent[1] - extent[0];
  const pad = Math.max(range * 0.15, 0.1);
  const numBins = Math.min(40, Math.max(12, Math.ceil(Math.sqrt(paths.length))));

  const bins = d3.bin()
    .domain([extent[0] - pad, extent[1] + pad])
    .thresholds(numBins)(terminalValues);

  const binWidth = bins.length > 0 ? (bins[0].x1 - bins[0].x0) : 1;
  const nPaths = paths.length;
  const maxHistDensity = d3.max(bins, b => b.length / (nPaths * binWidth)) || 1;

  // Theoretical density overlay
  let densityPoints = [];
  let maxTheorDensity = 0;
  if (sde.terminalDensity) {
    const lo = extent[0] - pad;
    const hi = extent[1] + pad;
    const step = (hi - lo) / 200;
    for (let x = lo; x <= hi; x += step) {
      const d = sde.terminalDensity(x, state.T, params, state.x0);
      if (isFinite(d) && d >= 0) {
        densityPoints.push({ x, d });
        if (d > maxTheorDensity) maxTheorDensity = d;
      }
    }
  }

  const yMaxDensity = Math.max(maxHistDensity, maxTheorDensity) * 1.1 || 1;

  const xScale = d3.scaleLinear()
    .domain([extent[0] - pad, extent[1] + pad])
    .range([0, dims.innerWidth]);
  const yScale = d3.scaleLinear()
    .domain([0, yMaxDensity])
    .range([dims.innerHeight, 0]);

  addAxes(g, xScale, yScale, dims, 'X(T)', 'Density');

  // Bars
  g.selectAll('.histogram-bar')
    .data(bins)
    .join('rect')
    .attr('class', 'histogram-bar')
    .attr('fill', '#2563eb')
    .attr('x', b => xScale(b.x0) + 1)
    .attr('width', b => Math.max(0, xScale(b.x1) - xScale(b.x0) - 1))
    .attr('y', b => yScale(b.length / (nPaths * binWidth)))
    .attr('height', b => dims.innerHeight - yScale(b.length / (nPaths * binWidth)));

  // Theoretical density curve
  if (densityPoints.length > 0) {
    const densityLine = d3.line().x(d => xScale(d.x)).y(d => yScale(d.d));
    const areaGen = d3.area()
      .x(d => xScale(d.x))
      .y0(dims.innerHeight)
      .y1(d => yScale(d.d));

    g.append('path')
      .datum(densityPoints)
      .attr('class', 'density-fill')
      .attr('d', areaGen)
      .attr('fill', '#dc2626');

    g.append('path')
      .datum(densityPoints)
      .attr('class', 'density-curve')
      .attr('d', densityLine)
      .attr('stroke', '#dc2626');
  }

  // Legend
  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  legend.innerHTML =
    '<span class="legend-item"><span class="legend-patch" style="background:#2563eb;opacity:0.5"></span>Histogram</span>' +
    (densityPoints.length > 0 ? '<span class="legend-item"><span class="legend-line" style="background:#dc2626"></span>Theoretical</span>' : '');
  container.appendChild(legend);
}

/* ================================================================
   RENDER: Moments Over Time
   ================================================================ */
function renderMoments() {
  const container = document.getElementById('moments-plot');
  container.innerHTML = '';

  const { paths, timeGrid } = state;
  if (!paths || !timeGrid) return;

  const sde = SDE_TYPES[state.sdeType];
  const params = { ...state.params, _T: state.T };
  const { means, variances } = computeMoments(paths, timeGrid);

  const dims = smallChartDims(container);
  const maxPts = 300;

  // Two sub-charts: mean on top, variance on bottom
  const halfH = (dims.innerHeight - 20) / 2;

  const svg = makeSvg(container, dims);
  const gMean = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);
  const gVar = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top + halfH + 20})`);

  const stride = Math.max(1, Math.floor(timeGrid.length / maxPts));

  // --- Mean subplot ---
  const empMeanPts = [];
  for (let j = 0; j < timeGrid.length; j += stride) {
    empMeanPts.push({ t: timeGrid[j], v: means[j] });
  }
  const lastIdx = timeGrid.length - 1;
  if (empMeanPts.length === 0 || empMeanPts[empMeanPts.length - 1].t !== timeGrid[lastIdx]) {
    empMeanPts.push({ t: timeGrid[lastIdx], v: means[lastIdx] });
  }

  let exactMeanPts = [];
  if (sde.exactMean) {
    for (let j = 0; j < timeGrid.length; j += stride) {
      exactMeanPts.push({ t: timeGrid[j], v: sde.exactMean(timeGrid[j], params, state.x0) });
    }
    if (exactMeanPts[exactMeanPts.length - 1].t !== timeGrid[lastIdx]) {
      exactMeanPts.push({ t: timeGrid[lastIdx], v: sde.exactMean(timeGrid[lastIdx], params, state.x0) });
    }
  }

  const allMeanVals = empMeanPts.map(d => d.v).concat(exactMeanPts.map(d => d.v));
  const mMin = d3.min(allMeanVals) || 0;
  const mMax = d3.max(allMeanVals) || 1;
  const mPad = Math.max((mMax - mMin) * 0.1, 0.05);

  const xScale = d3.scaleLinear().domain([0, state.T]).range([0, dims.innerWidth]);
  const yMeanScale = d3.scaleLinear().domain([mMin - mPad, mMax + mPad]).range([halfH, 0]);

  gMean.append('g').attr('class', 'axis x-axis')
    .attr('transform', `translate(0,${halfH})`)
    .call(d3.axisBottom(xScale).ticks(5).tickSize(3));
  gMean.append('g').attr('class', 'axis y-axis')
    .call(d3.axisLeft(yMeanScale).ticks(4).tickSize(3));
  gMean.append('text').attr('class', 'axis-label')
    .attr('x', -halfH / 2).attr('y', -40)
    .attr('text-anchor', 'middle').attr('transform', 'rotate(-90)')
    .text('E[X]');

  const meanLine = d3.line().x(d => xScale(d.t)).y(d => yMeanScale(d.v));

  gMean.append('path')
    .datum(empMeanPts)
    .attr('class', 'empirical-line')
    .attr('d', meanLine)
    .attr('stroke', '#2563eb');

  if (exactMeanPts.length > 0) {
    gMean.append('path')
      .datum(exactMeanPts)
      .attr('class', 'theoretical-line')
      .attr('d', meanLine)
      .attr('stroke', '#dc2626');
  }

  // --- Variance subplot ---
  const empVarPts = [];
  for (let j = 0; j < timeGrid.length; j += stride) {
    empVarPts.push({ t: timeGrid[j], v: variances[j] });
  }
  if (empVarPts[empVarPts.length - 1].t !== timeGrid[lastIdx]) {
    empVarPts.push({ t: timeGrid[lastIdx], v: variances[lastIdx] });
  }

  let exactVarPts = [];
  if (sde.exactVar) {
    for (let j = 0; j < timeGrid.length; j += stride) {
      exactVarPts.push({ t: timeGrid[j], v: sde.exactVar(timeGrid[j], params, state.x0) });
    }
    if (exactVarPts[exactVarPts.length - 1].t !== timeGrid[lastIdx]) {
      exactVarPts.push({ t: timeGrid[lastIdx], v: sde.exactVar(timeGrid[lastIdx], params, state.x0) });
    }
  }

  const allVarVals = empVarPts.map(d => d.v).concat(exactVarPts.map(d => d.v));
  const vMin = 0;
  const vMax = d3.max(allVarVals) || 1;
  const vPad = Math.max(vMax * 0.1, 0.01);

  const yVarScale = d3.scaleLinear().domain([0, vMax + vPad]).range([halfH, 0]);

  gVar.append('g').attr('class', 'axis x-axis')
    .attr('transform', `translate(0,${halfH})`)
    .call(d3.axisBottom(xScale).ticks(5).tickSize(3));
  gVar.append('g').attr('class', 'axis y-axis')
    .call(d3.axisLeft(yVarScale).ticks(4).tickSize(3));
  gVar.append('text').attr('class', 'axis-label')
    .attr('x', dims.innerWidth / 2).attr('y', halfH + 35)
    .attr('text-anchor', 'middle').text('t');
  gVar.append('text').attr('class', 'axis-label')
    .attr('x', -halfH / 2).attr('y', -40)
    .attr('text-anchor', 'middle').attr('transform', 'rotate(-90)')
    .text('Var[X]');

  const varLine = d3.line().x(d => xScale(d.t)).y(d => yVarScale(d.v));

  gVar.append('path')
    .datum(empVarPts)
    .attr('class', 'empirical-line')
    .attr('d', varLine)
    .attr('stroke', '#2563eb');

  if (exactVarPts.length > 0) {
    gVar.append('path')
      .datum(exactVarPts)
      .attr('class', 'theoretical-line')
      .attr('d', varLine)
      .attr('stroke', '#dc2626');
  }

  // Legend
  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  legend.innerHTML =
    '<span class="legend-item"><span class="legend-line" style="background:#2563eb"></span>Empirical</span>' +
    (sde.exactMean || sde.exactVar
      ? '<span class="legend-item"><span class="legend-line-dashed" style="border-color:#dc2626"></span>Theoretical</span>'
      : '');
  container.appendChild(legend);
}

/* ================================================================
   RENDER: SDE Equation Subtitle
   ================================================================ */
function renderEquation() {
  const el = document.getElementById('sde-equation');
  const sde = SDE_TYPES[state.sdeType];
  try {
    katex.render(sde.equation, el, { displayMode: false, throwOnError: false });
  } catch (_) {
    el.textContent = sde.label;
  }
}

/* ================================================================
   RENDER: Stats Panel
   ================================================================ */
function renderStats() {
  const el = document.getElementById('stats');
  const { paths, timeGrid } = state;
  if (!paths || !timeGrid) { el.innerHTML = ''; return; }

  const sde = SDE_TYPES[state.sdeType];
  const params = { ...state.params, _T: state.T };
  const N = timeGrid.length - 1;
  const terminalValues = paths.map(p => p[N]);
  const empMean = d3.mean(terminalValues);
  const empVar = d3.variance(terminalValues) || 0;

  // Error estimates
  let strongError = '--';
  let weakError = '--';
  if (sde.exactMean) {
    const exactM = sde.exactMean(state.T, params, state.x0);
    weakError = Math.abs(empMean - exactM).toFixed(5);
  }
  if (paths.length >= 2) {
    // Rough strong error: average |X_T^EM - E[X_T]| (proxy)
    const se = d3.mean(terminalValues, v => Math.abs(v - empMean));
    strongError = se.toFixed(5);
  }

  el.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${empMean.toFixed(4)}</div>
      <div class="stat-label">E[X<sub>T</sub>] (empirical)</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${empVar.toFixed(4)}</div>
      <div class="stat-label">Var[X<sub>T</sub>] (empirical)</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${weakError}</div>
      <div class="stat-label">Weak error |E\u0302-E|</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${strongError}</div>
      <div class="stat-label">E[|X<sub>T</sub>-E\u0302|]</div>
    </div>
  `;
}

/* ================================================================
   RENDER: Info Panel
   ================================================================ */
function renderInfo() {
  const el = document.getElementById('info');
  const sde = SDE_TYPES[state.sdeType];

  const sdeEqId = 'info-sde-eq';
  const emSchemeId = 'info-em-scheme';
  const exactId = 'info-exact-sol';

  el.innerHTML = `
    <h3>SDE Definition</h3>
    <div id="${sdeEqId}"></div>
    <h3>Euler-Maruyama Scheme</h3>
    <div id="${emSchemeId}"></div>
    <h3>Exact / Analytical Result</h3>
    <div id="${exactId}"></div>
  `;

  try {
    katex.render(sde.equation, document.getElementById(sdeEqId),
      { displayMode: true, throwOnError: false });
  } catch (_) { /* ignore */ }

  try {
    katex.render(
      'X_{n+1} = X_n + \\mu(X_n, t_n)\\,\\Delta t + \\sigma(X_n, t_n)\\,\\Delta B_n, \\quad \\Delta B_n \\sim \\mathcal{N}(0, \\Delta t)',
      document.getElementById(emSchemeId),
      { displayMode: true, throwOnError: false }
    );
  } catch (_) { /* ignore */ }

  try {
    katex.render(sde.exactSol, document.getElementById(exactId),
      { displayMode: true, throwOnError: false });
  } catch (_) { /* ignore */ }
}

/* ================================================================
   BUILD CONTROLS
   ================================================================ */
function buildControls() {
  // SDE type selector
  const selectDiv = document.getElementById('sde-select');
  selectDiv.innerHTML = `
    <label class="control-label">SDE Type</label>
    <select id="sde-type-select" class="control-select">
      ${Object.entries(SDE_TYPES).map(([k, v]) =>
        `<option value="${k}"${k === state.sdeType ? ' selected' : ''}>${v.label}</option>`
      ).join('')}
    </select>
  `;

  // Build parameter sliders
  buildParamSliders();

  // X0 slider
  const x0Div = document.getElementById('x0-slider');
  x0Div.innerHTML = `
    <label class="control-label">X\u2080 <span id="x0-val">${state.x0.toFixed(2)}</span></label>
    <input type="range" id="x0-input" min="-3" max="5" step="0.1" value="${state.x0}">
  `;

  // T slider
  const tDiv = document.getElementById('T-slider');
  tDiv.innerHTML = `
    <label class="control-label">T (horizon) <span id="T-val">${state.T.toFixed(1)}</span></label>
    <input type="range" id="T-input" min="0.1" max="10" step="0.1" value="${state.T}">
  `;

  // dt slider
  const dtDiv = document.getElementById('dt-slider');
  dtDiv.innerHTML = `
    <label class="control-label">\u0394t <span id="dt-val">${state.dt}</span></label>
    <input type="range" id="dt-input" min="-4" max="-1" step="0.25" value="${Math.log10(state.dt).toFixed(2)}">
  `;

  // Num paths slider
  const npDiv = document.getElementById('num-paths-slider');
  npDiv.innerHTML = `
    <label class="control-label">Paths <span id="np-val">${state.numPaths}</span></label>
    <input type="range" id="np-input" min="1" max="500" step="1" value="${state.numPaths}">
  `;

  // Seed control
  const seedDiv = document.getElementById('seed-control');
  seedDiv.innerHTML = `
    <label class="control-label">Seed <span id="seed-val">${state.seed}</span></label>
    <input type="number" id="seed-input" class="control-input" min="0" max="999999" value="${state.seed}">
    <button id="reseed-btn" class="control-btn" style="margin-top:4px;width:100%">Regenerate</button>
  `;

  wireControls();
}

function buildParamSliders() {
  const sde = SDE_TYPES[state.sdeType];
  const slots = ['param-1', 'param-2', 'param-3'];

  // Reset params to defaults for current SDE type
  const newParams = {};
  sde.params.forEach(p => {
    newParams[p.key] = (state.params[p.key] !== undefined) ? state.params[p.key] : p.default;
  });
  state.params = newParams;

  slots.forEach((slotId, i) => {
    const div = document.getElementById(slotId);
    if (i < sde.params.length) {
      const p = sde.params[i];
      const val = state.params[p.key] !== undefined ? state.params[p.key] : p.default;
      state.params[p.key] = val;
      div.innerHTML = `
        <label class="control-label">${p.label} <span id="pval-${p.key}">${val.toFixed(2)}</span></label>
        <input type="range" class="param-slider" data-key="${p.key}"
               min="${p.min}" max="${p.max}" step="${p.step}" value="${val}">
      `;
      div.style.display = '';
    } else {
      div.innerHTML = '';
      div.style.display = 'none';
    }
  });
}

function wireControls() {
  // SDE type
  document.getElementById('sde-type-select').addEventListener('change', (e) => {
    state.sdeType = e.target.value;
    // Reset x0 for certain types
    if (state.sdeType === 'gbm' || state.sdeType === 'cir') {
      state.x0 = Math.max(state.x0, 0.1);
      document.getElementById('x0-input').value = state.x0;
      document.getElementById('x0-val').textContent = state.x0.toFixed(2);
    }
    buildParamSliders();
    wireParamSliders();
    fullUpdate();
  });

  wireParamSliders();

  // x0
  document.getElementById('x0-input').addEventListener('input', (e) => {
    state.x0 = +e.target.value;
    document.getElementById('x0-val').textContent = state.x0.toFixed(2);
    fullUpdate();
  });

  // T
  document.getElementById('T-input').addEventListener('input', (e) => {
    state.T = +e.target.value;
    document.getElementById('T-val').textContent = state.T.toFixed(1);
    fullUpdate();
  });

  // dt (log scale)
  document.getElementById('dt-input').addEventListener('input', (e) => {
    state.dt = Math.pow(10, +e.target.value);
    document.getElementById('dt-val').textContent = state.dt.toFixed(5);
    fullUpdate();
  });

  // num paths
  document.getElementById('np-input').addEventListener('input', (e) => {
    state.numPaths = +e.target.value;
    document.getElementById('np-val').textContent = state.numPaths;
    fullUpdate();
  });

  // seed
  document.getElementById('seed-input').addEventListener('change', (e) => {
    state.seed = +e.target.value;
    document.getElementById('seed-val').textContent = state.seed;
    fullUpdate();
  });

  // reseed button
  document.getElementById('reseed-btn').addEventListener('click', () => {
    state.seed = Math.floor(Math.random() * 999999);
    document.getElementById('seed-input').value = state.seed;
    document.getElementById('seed-val').textContent = state.seed;
    fullUpdate();
  });
}

function wireParamSliders() {
  document.querySelectorAll('.param-slider').forEach(slider => {
    slider.addEventListener('input', (e) => {
      const key = e.target.dataset.key;
      state.params[key] = +e.target.value;
      const valEl = document.getElementById(`pval-${key}`);
      if (valEl) valEl.textContent = (+e.target.value).toFixed(2);
      fullUpdate();
    });
  });
}

/* ================================================================
   FULL UPDATE
   ================================================================ */
let updateTimer = null;

function fullUpdate() {
  // Debounce for expensive simulations
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(() => {
    simulate();
    renderEquation();
    renderPaths();
    renderDensity();
    renderMoments();
    renderStats();
    renderInfo();
  }, 30);
}

/* ================================================================
   INIT
   ================================================================ */
function init() {
  buildControls();

  // Set initial dt display
  document.getElementById('dt-val').textContent = state.dt.toFixed(5);

  simulate();
  renderEquation();
  renderPaths();
  renderDensity();
  renderMoments();
  renderStats();
  renderInfo();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
