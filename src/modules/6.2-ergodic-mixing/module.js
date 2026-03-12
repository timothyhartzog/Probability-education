// ============================================================
//  Module 6.2 — Ergodic Theory & Mixing Times
//  Visualize the ergodic theorem for Markov chains and how
//  mixing time measures convergence speed to stationarity.
// ============================================================

import * as d3 from 'd3';
import katex from 'katex';

// ============================================================
//  Seeded PRNG — mulberry32
// ============================================================

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rng = mulberry32(42);

function reseedRng(s) {
  rng = mulberry32(s);
}

// ============================================================
//  Viz palette (from design system)
// ============================================================

const VIZ_COLORS = [
  '#2563eb', '#e97319', '#059669', '#7c3aed',
  '#db2777', '#0891b2', '#ca8a04', '#64748b',
];

// ============================================================
//  Preset Markov Chains
// ============================================================

function lazyRandomWalkCycle(k) {
  // k states arranged in a cycle, P(stay)=1/2, P(left)=P(right)=1/4
  const P = Array.from({ length: k }, () => new Float64Array(k));
  for (let i = 0; i < k; i++) {
    P[i][i] = 0.5;
    P[i][(i + 1) % k] = 0.25;
    P[i][(i - 1 + k) % k] = 0.25;
  }
  return { P, labels: Array.from({ length: k }, (_, i) => `${i}`) };
}

function completeGraphWalk(k) {
  // k states, P(stay)=1/2, uniform jump to others with prob 1/(2(k-1))
  const P = Array.from({ length: k }, () => new Float64Array(k));
  for (let i = 0; i < k; i++) {
    P[i][i] = 0.5;
    for (let j = 0; j < k; j++) {
      if (j !== i) P[i][j] = 0.5 / (k - 1);
    }
  }
  return { P, labels: Array.from({ length: k }, (_, i) => `${i}`) };
}

function barbellGraph() {
  // 6 states: triangle {0,1,2} and triangle {3,4,5}, connected by edge 2-3.
  // Within triangle: P(stay)=1/2, P(each neighbor)=1/4 if 2 neighbors.
  // Node 2: neighbors 0,1,3 => P(stay)=1/2, each neighbor=1/6.
  // Node 3: neighbors 2,4,5 => P(stay)=1/2, each neighbor=1/6.
  const k = 6;
  const adj = [
    [1, 2],       // 0
    [0, 2],       // 1
    [0, 1, 3],    // 2 — bridge
    [2, 4, 5],    // 3 — bridge
    [3, 5],       // 4
    [3, 4],       // 5
  ];
  const P = Array.from({ length: k }, () => new Float64Array(k));
  for (let i = 0; i < k; i++) {
    P[i][i] = 0.5;
    const deg = adj[i].length;
    for (const j of adj[i]) {
      P[i][j] = 0.5 / deg;
    }
  }
  return { P, labels: ['0', '1', '2', '3', '4', '5'] };
}

function birthDeathChain(k, p) {
  // k states, P(up)=p, P(down)=1-p, reflecting boundaries.
  // At boundary 0: P(stay)=1-p, P(up)=p.
  // At boundary k-1: P(stay)=p, P(down)=1-p.
  if (p === undefined) p = 0.4;
  const P = Array.from({ length: k }, () => new Float64Array(k));
  for (let i = 0; i < k; i++) {
    if (i === 0) {
      P[i][0] = 1 - p;
      P[i][1] = p;
    } else if (i === k - 1) {
      P[i][k - 1] = p;
      P[i][k - 2] = 1 - p;
    } else {
      P[i][i + 1] = p;
      P[i][i - 1] = 1 - p;
    }
  }
  return { P, labels: Array.from({ length: k }, (_, i) => `${i}`) };
}

const PRESETS = {
  'lazy-cycle': () => lazyRandomWalkCycle(5),
  'complete-graph': () => completeGraphWalk(5),
  'barbell': () => barbellGraph(),
  'birth-death': () => birthDeathChain(5, 0.4),
};

// ============================================================
//  Linear Algebra Helpers
// ============================================================

/** Multiply two square matrices (arrays of Float64Array rows). */
function matMul(A, B) {
  const n = A.length;
  const C = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      if (A[i][k] === 0) continue;
      for (let j = 0; j < n; j++) {
        C[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return C;
}

/** Matrix-vector multiply: v * M (row vector times matrix). */
function vecMatMul(v, M) {
  const n = M.length;
  const result = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      result[j] += v[i] * M[i][j];
    }
  }
  return result;
}

/** Compute stationary distribution via power method. */
function stationaryDistribution(P) {
  const n = P.length;
  let v = new Float64Array(n).fill(1 / n);
  for (let iter = 0; iter < 2000; iter++) {
    const vNew = vecMatMul(v, P);
    let diff = 0;
    for (let i = 0; i < n; i++) diff += Math.abs(vNew[i] - v[i]);
    v = vNew;
    if (diff < 1e-14) break;
  }
  // Normalize
  let s = 0;
  for (let i = 0; i < n; i++) s += v[i];
  for (let i = 0; i < n; i++) v[i] /= s;
  return v;
}

/**
 * Compute eigenvalues of transition matrix via QR iteration (for small matrices).
 * Returns sorted array of real eigenvalues (descending).
 */
function eigenvaluesQR(M) {
  const n = M.length;
  // Copy M to a working array
  let A = Array.from({ length: n }, (_, i) => Float64Array.from(M[i]));

  for (let iter = 0; iter < 500; iter++) {
    // QR decomposition via Gram-Schmidt
    const Q = Array.from({ length: n }, () => new Float64Array(n));
    const R = Array.from({ length: n }, () => new Float64Array(n));

    for (let j = 0; j < n; j++) {
      // Column j of A
      const col = new Float64Array(n);
      for (let i = 0; i < n; i++) col[i] = A[i][j];

      for (let k = 0; k < j; k++) {
        let dot = 0;
        for (let i = 0; i < n; i++) dot += Q[i][k] * col[i];
        R[k][j] = dot;
        for (let i = 0; i < n; i++) col[i] -= dot * Q[i][k];
      }

      let norm = 0;
      for (let i = 0; i < n; i++) norm += col[i] * col[i];
      norm = Math.sqrt(norm);
      R[j][j] = norm;
      if (norm > 1e-15) {
        for (let i = 0; i < n; i++) Q[i][j] = col[i] / norm;
      }
    }

    // A = R * Q
    const newA = Array.from({ length: n }, () => new Float64Array(n));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        for (let k = 0; k < n; k++) {
          newA[i][j] += R[i][k] * Q[k][j];
        }
      }
    }
    A = newA;

    // Check if off-diagonal is small enough
    let offDiag = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) offDiag += Math.abs(A[i][j]);
      }
    }
    if (offDiag < 1e-12) break;
  }

  const eigs = [];
  for (let i = 0; i < n; i++) eigs.push(A[i][i]);
  eigs.sort((a, b) => b - a);
  return eigs;
}

/**
 * Compute matrix power P^n using repeated squaring.
 * Returns the resulting matrix.
 */
function matPow(P, n) {
  const sz = P.length;
  // Start with identity
  let result = Array.from({ length: sz }, (_, i) => {
    const row = new Float64Array(sz);
    row[i] = 1;
    return row;
  });
  let base = P.map(row => Float64Array.from(row));
  let exp = n;
  while (exp > 0) {
    if (exp & 1) result = matMul(result, base);
    base = matMul(base, base);
    exp >>= 1;
  }
  return result;
}

/** Total variation distance between two distributions. */
function tvDistance(p, q) {
  let s = 0;
  for (let i = 0; i < p.length; i++) s += Math.abs(p[i] - q[i]);
  return s / 2;
}

/** Shannon entropy of a distribution. */
function entropy(p) {
  let h = 0;
  for (let i = 0; i < p.length; i++) {
    if (p[i] > 1e-15) h -= p[i] * Math.log2(p[i]);
  }
  return h;
}

// ============================================================
//  Simulation helpers
// ============================================================

/** Simulate a single Markov chain path for N steps starting from state x0. */
function simulatePath(P, x0, N) {
  const path = [x0];
  let state = x0;
  const k = P.length;
  for (let step = 0; step < N; step++) {
    const u = rng();
    let cum = 0;
    let next = state;
    for (let j = 0; j < k; j++) {
      cum += P[state][j];
      if (u < cum) { next = j; break; }
    }
    state = next;
    path.push(state);
  }
  return path;
}

// ============================================================
//  Functions for ergodic averages
// ============================================================

function fnIndicator0(state) { return state === 0 ? 1 : 0; }
function fnStateValue(state) { return state; }
function fnParity(state) { return state % 2; }

function expectedValue(pi, fn) {
  let ev = 0;
  for (let i = 0; i < pi.length; i++) ev += pi[i] * fn(i);
  return ev;
}

// ============================================================
//  State
// ============================================================

const state = {
  presetKey: 'lazy-cycle',
  chain: null,     // { P, labels }
  pi: null,        // stationary distribution
  eigenvalues: null,
  numSteps: 100,
  numPaths: 20,
  startState: 0,
  fnChoice: 'indicator-0',
  showStationary: true,
  animStep: 0,      // current animation step for dist-chart
  animRunning: false,
  animTimer: null,
};

// ============================================================
//  DOM References
// ============================================================

const presetSelect = document.getElementById('preset-chain');
const numStepsSlider = document.getElementById('num-steps');
const numStepsVal = document.getElementById('num-steps-val');
const numPathsSlider = document.getElementById('num-paths');
const numPathsVal = document.getElementById('num-paths-val');
const startStateSelect = document.getElementById('start-state');
const fnChoiceSelect = document.getElementById('fn-choice');
const stationaryToggle = document.getElementById('toggle-stationary');
const animateBtn = document.getElementById('animate-btn');
const stepBtn = document.getElementById('step-btn');
const resetBtn = document.getElementById('reset-btn');
const statTmix = document.getElementById('stat-tmix');
const statGap = document.getElementById('stat-gap');
const statEntropy = document.getElementById('stat-entropy');

const tvChartEl = document.getElementById('tv-chart');
const ergodicChartEl = document.getElementById('ergodic-chart');
const distChartEl = document.getElementById('dist-chart');

// KaTeX info blocks
const infoErgodicDef = document.getElementById('info-ergodic-def');
const infoTvDef = document.getElementById('info-tv-def');
const infoTmixDef = document.getElementById('info-tmix-def');

// ============================================================
//  Render KaTeX
// ============================================================

function renderKaTeX() {
  if (infoErgodicDef) {
    katex.render(
      String.raw`\frac{1}{n}\sum_{k=0}^{n-1} f(X_k) \xrightarrow{a.s.} \mathbb{E}_\pi[f] = \sum_{x \in S} f(x)\,\pi(x)`,
      infoErgodicDef,
      { displayMode: true, throwOnError: false }
    );
  }
  if (infoTvDef) {
    katex.render(
      String.raw`d_{TV}(\mu, \nu) = \frac{1}{2}\sum_{x \in S} |\mu(x) - \nu(x)| = \max_{A \subseteq S} |\mu(A) - \nu(A)|`,
      infoTvDef,
      { displayMode: true, throwOnError: false }
    );
  }
  if (infoTmixDef) {
    katex.render(
      String.raw`t_{\text{mix}}(\varepsilon) = \min\!\bigl\{n \ge 0 : \max_{x} d_{TV}(P^n(x,\cdot),\,\pi) \le \varepsilon\bigr\}, \quad \varepsilon = \tfrac{1}{4}`,
      infoTmixDef,
      { displayMode: true, throwOnError: false }
    );
  }
}

// ============================================================
//  Build / rebuild chain
// ============================================================

function rebuildChain() {
  const factory = PRESETS[state.presetKey];
  if (!factory) return;
  state.chain = factory();
  state.pi = stationaryDistribution(state.chain.P);
  state.eigenvalues = eigenvaluesQR(state.chain.P);

  // Populate start state dropdown
  startStateSelect.innerHTML = '';
  state.chain.labels.forEach((lbl, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `State ${lbl}`;
    startStateSelect.appendChild(opt);
  });
  state.startState = 0;
  startStateSelect.value = '0';

  state.animStep = 0;
  stopAnimation();
}

// ============================================================
//  Compute data for visualizations
// ============================================================

/** Compute TV distance data: for each starting state, TV dist at each step. */
function computeTVData() {
  const { P } = state.chain;
  const pi = state.pi;
  const k = P.length;
  const N = state.numSteps;

  // For each starting state x, compute P^n(x, ·) for n=0..N
  const tvData = []; // array of { state, distances: [d0, d1, ...] }

  for (let x = 0; x < k; x++) {
    const distances = [];
    // Start from delta at x
    let dist = new Float64Array(k);
    dist[x] = 1;
    distances.push(tvDistance(dist, pi));

    for (let n = 1; n <= N; n++) {
      dist = vecMatMul(dist, P);
      distances.push(tvDistance(dist, pi));
    }

    tvData.push({ state: x, label: state.chain.labels[x], distances });
  }

  return tvData;
}

/** Find mixing time: first n where max_x d_TV(P^n(x,·), π) <= 1/4. */
function computeMixingTime(tvData) {
  const N = tvData[0].distances.length;
  for (let n = 0; n < N; n++) {
    let maxTV = 0;
    for (const d of tvData) {
      if (d.distances[n] > maxTV) maxTV = d.distances[n];
    }
    if (maxTV <= 0.25) return n;
  }
  return N - 1; // did not mix within range
}

/** Compute spectral gap. */
function computeSpectralGap() {
  const eigs = state.eigenvalues;
  // lambda_1 should be 1 (or very close). The spectral gap is 1 - |lambda_2|.
  if (eigs.length < 2) return 0;
  // Find second largest absolute eigenvalue
  const absEigs = eigs.map(e => Math.abs(e)).sort((a, b) => b - a);
  // absEigs[0] should be ~1
  return 1 - absEigs[1];
}

// ============================================================
//  Functions map
// ============================================================

function getCurrentFn() {
  switch (state.fnChoice) {
    case 'indicator-0': return fnIndicator0;
    case 'state-value': return fnStateValue;
    case 'parity': return fnParity;
    default: return fnIndicator0;
  }
}

// ============================================================
//  Visualization 1: TV Distance Chart
// ============================================================

function renderTVChart() {
  tvChartEl.innerHTML = '';

  const tvData = computeTVData();
  const tmix = computeMixingTime(tvData);
  const N = state.numSteps;
  const k = state.chain.P.length;

  const margin = { top: 20, right: 24, bottom: 44, left: 54 };
  const width = 900;
  const height = 340;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3.select(tvChartEl)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleLinear().domain([0, N]).range([0, innerW]);
  const yScale = d3.scaleLinear().domain([0, 1]).range([innerH, 0]);

  // X axis
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(Math.min(N / 10, 15)));

  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', innerW / 2)
    .attr('y', innerH + 38)
    .attr('text-anchor', 'middle')
    .text('Step n');

  // Y axis
  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(5));

  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerH / 2)
    .attr('y', -40)
    .attr('text-anchor', 'middle')
    .text('d_TV(Pⁿ(x, ·), π)');

  // Threshold line at 1/4
  g.append('line')
    .attr('class', 'tv-threshold')
    .attr('x1', 0).attr('x2', innerW)
    .attr('y1', yScale(0.25)).attr('y2', yScale(0.25));

  g.append('text')
    .attr('x', innerW + 4)
    .attr('y', yScale(0.25) + 4)
    .attr('font-size', 10)
    .attr('fill', '#888')
    .attr('font-family', 'var(--font-heading)')
    .text('1/4');

  // Mixing time vertical marker
  if (tmix < N) {
    g.append('line')
      .attr('class', 'tv-tmix-marker')
      .attr('x1', xScale(tmix)).attr('x2', xScale(tmix))
      .attr('y1', 0).attr('y2', innerH)
      .attr('stroke', VIZ_COLORS[4]);

    g.append('text')
      .attr('x', xScale(tmix) + 4)
      .attr('y', 14)
      .attr('font-size', 11)
      .attr('fill', VIZ_COLORS[4])
      .attr('font-family', 'var(--font-heading)')
      .text(`t_mix = ${tmix}`);
  }

  // Lines for each starting state
  const lineGen = d3.line()
    .x((_, i) => xScale(i))
    .y(d => yScale(d));

  tvData.forEach((d, idx) => {
    g.append('path')
      .datum(d.distances)
      .attr('class', 'tv-line')
      .attr('d', lineGen)
      .attr('stroke', VIZ_COLORS[idx % VIZ_COLORS.length]);
  });

  // Legend
  const legendDiv = document.createElement('div');
  legendDiv.className = 'chart-legend';
  tvData.forEach((d, idx) => {
    const item = document.createElement('span');
    item.innerHTML = `<span class="legend-dot" style="background:${VIZ_COLORS[idx % VIZ_COLORS.length]}"></span>x=${d.label}`;
    legendDiv.appendChild(item);
  });
  tvChartEl.appendChild(legendDiv);

  // Update stats
  statTmix.textContent = tmix < N ? tmix : `>${N}`;
  const gap = computeSpectralGap();
  statGap.textContent = gap.toFixed(4);
  statEntropy.textContent = entropy(state.pi).toFixed(3);
}

// ============================================================
//  Visualization 2: Ergodic Average Chart
// ============================================================

function renderErgodicChart() {
  ergodicChartEl.innerHTML = '';

  const { P } = state.chain;
  const pi = state.pi;
  const N = state.numSteps;
  const nPaths = state.numPaths;
  const x0 = state.startState;
  const fn = getCurrentFn();
  const target = expectedValue(pi, fn);

  reseedRng(12345); // reproducible paths

  // Simulate paths and compute running averages
  const paths = [];
  for (let p = 0; p < nPaths; p++) {
    const traj = simulatePath(P, x0, N);
    const avgs = [];
    let cumSum = 0;
    for (let i = 0; i <= N; i++) {
      cumSum += fn(traj[i]);
      avgs.push(cumSum / (i + 1));
    }
    paths.push(avgs);
  }

  // Ensemble average
  const ensemble = [];
  for (let i = 0; i <= N; i++) {
    let s = 0;
    for (let p = 0; p < nPaths; p++) s += paths[p][i];
    ensemble.push(s / nPaths);
  }

  const margin = { top: 16, right: 20, bottom: 40, left: 50 };
  const width = 450;
  const height = 280;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  // Determine Y range
  let yMin = target, yMax = target;
  for (const p of paths) {
    for (const v of p) {
      if (v < yMin) yMin = v;
      if (v > yMax) yMax = v;
    }
  }
  const yPad = Math.max((yMax - yMin) * 0.1, 0.05);

  const svg = d3.select(ergodicChartEl)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleLinear().domain([0, N]).range([0, innerW]);
  const yScale = d3.scaleLinear().domain([yMin - yPad, yMax + yPad]).range([innerH, 0]);

  // Axes
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(6));

  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', innerW / 2)
    .attr('y', innerH + 34)
    .attr('text-anchor', 'middle')
    .text('Step n');

  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(5));

  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerH / 2)
    .attr('y', -36)
    .attr('text-anchor', 'middle')
    .text('Running avg');

  // Target line E_π[f]
  g.append('line')
    .attr('class', 'ergodic-target')
    .attr('x1', 0).attr('x2', innerW)
    .attr('y1', yScale(target)).attr('y2', yScale(target));

  g.append('text')
    .attr('x', innerW + 4)
    .attr('y', yScale(target) + 4)
    .attr('font-size', 10)
    .attr('fill', '#dc2626')
    .attr('font-family', 'var(--font-heading)')
    .text(`E_π[f]=${target.toFixed(3)}`);

  const lineGen = d3.line()
    .x((_, i) => xScale(i))
    .y(d => yScale(d));

  // Individual paths (thin, semi-transparent)
  paths.forEach((p) => {
    g.append('path')
      .datum(p)
      .attr('class', 'ergodic-path')
      .attr('d', lineGen)
      .attr('stroke', VIZ_COLORS[0]);
  });

  // Ensemble average (bold)
  g.append('path')
    .datum(ensemble)
    .attr('class', 'ergodic-path ensemble')
    .attr('d', lineGen)
    .attr('stroke', VIZ_COLORS[1]);
}

// ============================================================
//  Visualization 3: Distribution Evolution Chart
// ============================================================

function renderDistChart(step) {
  distChartEl.innerHTML = '';

  if (step === undefined) step = state.animStep;

  const { P } = state.chain;
  const pi = state.pi;
  const k = P.length;
  const x0 = state.startState;

  // Compute P^step(x0, ·)
  let dist;
  if (step === 0) {
    dist = new Float64Array(k);
    dist[x0] = 1;
  } else {
    const Pn = matPow(P, step);
    dist = Float64Array.from(Pn[x0]);
  }

  const margin = { top: 16, right: 20, bottom: 44, left: 50 };
  const width = 450;
  const height = 280;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3.select(distChartEl)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleBand()
    .domain(state.chain.labels)
    .range([0, innerW])
    .padding(0.25);

  const yScale = d3.scaleLinear().domain([0, 1]).range([innerH, 0]);

  // Axes
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale));

  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', innerW / 2)
    .attr('y', innerH + 36)
    .attr('text-anchor', 'middle')
    .text('State');

  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(5));

  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerH / 2)
    .attr('y', -36)
    .attr('text-anchor', 'middle')
    .text('Probability');

  // Stationary distribution outlines
  if (state.showStationary) {
    state.chain.labels.forEach((lbl, i) => {
      g.append('rect')
        .attr('class', 'dist-target-outline')
        .attr('x', xScale(lbl))
        .attr('y', yScale(pi[i]))
        .attr('width', xScale.bandwidth())
        .attr('height', innerH - yScale(pi[i]))
        .attr('stroke', VIZ_COLORS[1]);
    });
  }

  // Current distribution bars
  state.chain.labels.forEach((lbl, i) => {
    g.append('rect')
      .attr('class', 'dist-bar')
      .attr('x', xScale(lbl))
      .attr('y', yScale(dist[i]))
      .attr('width', xScale.bandwidth())
      .attr('height', innerH - yScale(dist[i]))
      .attr('fill', VIZ_COLORS[0])
      .attr('fill-opacity', 0.7)
      .attr('rx', 2);
  });

  // Step indicator
  const indicator = document.createElement('div');
  indicator.className = 'step-indicator';
  indicator.textContent = `Step n = ${step}`;
  distChartEl.appendChild(indicator);
}

// ============================================================
//  Animation controls
// ============================================================

function stopAnimation() {
  if (state.animTimer) {
    clearInterval(state.animTimer);
    state.animTimer = null;
  }
  state.animRunning = false;
  animateBtn.textContent = 'Animate';
}

function startAnimation() {
  state.animRunning = true;
  animateBtn.textContent = 'Pause';
  state.animTimer = setInterval(() => {
    state.animStep++;
    if (state.animStep > state.numSteps) {
      stopAnimation();
      state.animStep = state.numSteps;
      return;
    }
    renderDistChart(state.animStep);
  }, 80);
}

function toggleAnimation() {
  if (state.animRunning) {
    stopAnimation();
  } else {
    if (state.animStep >= state.numSteps) state.animStep = 0;
    startAnimation();
  }
}

function stepOnce() {
  stopAnimation();
  if (state.animStep < state.numSteps) {
    state.animStep++;
    renderDistChart(state.animStep);
  }
}

function resetAll() {
  stopAnimation();
  state.animStep = 0;
  renderAll();
}

// ============================================================
//  Render all visualizations
// ============================================================

function renderAll() {
  renderTVChart();
  renderErgodicChart();
  renderDistChart(state.animStep);
}

// ============================================================
//  Event Listeners
// ============================================================

presetSelect.addEventListener('change', () => {
  state.presetKey = presetSelect.value;
  rebuildChain();
  renderAll();
});

numStepsSlider.addEventListener('input', () => {
  state.numSteps = parseInt(numStepsSlider.value);
  numStepsVal.textContent = state.numSteps;
  stopAnimation();
  state.animStep = 0;
  renderAll();
});

numPathsSlider.addEventListener('input', () => {
  state.numPaths = parseInt(numPathsSlider.value);
  numPathsVal.textContent = state.numPaths;
  renderErgodicChart();
});

startStateSelect.addEventListener('change', () => {
  state.startState = parseInt(startStateSelect.value);
  stopAnimation();
  state.animStep = 0;
  renderAll();
});

fnChoiceSelect.addEventListener('change', () => {
  state.fnChoice = fnChoiceSelect.value;
  renderErgodicChart();
});

stationaryToggle.addEventListener('change', () => {
  state.showStationary = stationaryToggle.checked;
  renderDistChart(state.animStep);
});

animateBtn.addEventListener('click', toggleAnimation);
stepBtn.addEventListener('click', stepOnce);
resetBtn.addEventListener('click', resetAll);

// ============================================================
//  Initialize
// ============================================================

renderKaTeX();
rebuildChain();
renderAll();
