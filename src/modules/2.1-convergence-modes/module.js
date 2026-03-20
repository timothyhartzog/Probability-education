// ============================================================
//  Module 2.1 — Convergence Mode Comparator
//  Visualizes four modes of convergence in probability theory.
// ============================================================

import * as d3 from 'd3';
import katex from 'katex';
import '../../lib/copy-code.js';
import { makeInfoBtn } from '../../lib/param-tooltips.js';

// ---- Seedable PRNG (xoshiro128**) ---------------------------
function xoshiro128ss(seed) {
  let s = [seed >>> 0, (seed * 1597334677) >>> 0, (seed * 2246822519) >>> 0, (seed * 3266489917) >>> 0];
  if (s.every(v => v === 0)) s[0] = 1;
  function rotl(x, k) { return ((x << k) | (x >>> (32 - k))) >>> 0; }
  return function () {
    const result = (rotl((s[1] * 5) >>> 0, 7) * 9) >>> 0;
    const t = (s[1] << 9) >>> 0;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
    s[2] ^= t; s[3] = rotl(s[3], 11);
    return result / 4294967296;
  };
}

// ---- Box-Muller normal from uniform -------------------------
function normalFromU(u1, u2) {
  const r = Math.sqrt(-2 * Math.log(u1 || 1e-15));
  return r * Math.cos(2 * Math.PI * u2);
}

// ---- Standard normal CDF (approximation) --------------------
function normalCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

// ---- Global state -------------------------------------------
const state = {
  seqType: 'standard',
  maxN: 200,
  numPaths: 50,
  epsilon: 0.25,
  pValue: 1.0,
  seed: 42,
  data: null,  // { paths: number[][], limit: number[] }
};

const VIZ_COLORS = [
  '#2563eb', '#e97319', '#059669', '#7c3aed', '#db2777',
  '#0891b2', '#ca8a04', '#64748b',
];

// ---- Sequence generators ------------------------------------
// Each returns { paths, limit } where
//   paths[i][n] = X_n(omega_i)
//   limit[i]    = X(omega_i) (the a.s. limit, or 0)
function generateData(type, maxN, numPaths, rng) {
  switch (type) {
    case 'standard': return genStandard(maxN, numPaths, rng);
    case 'typewriter': return genTypewriter(maxN, numPaths, rng);
    case 'lp_failure': return genLpFailure(maxN, numPaths, rng);
    default: return genStandard(maxN, numPaths, rng);
  }
}

function genStandard(maxN, numPaths, rng) {
  // X_n(omega) = X(omega) * 1_{U(omega) > 1/n}
  // limit X(omega), converges a.s. and in all modes
  const paths = [];
  const limit = [];
  for (let i = 0; i < numPaths; i++) {
    const u1 = rng(), u2 = rng();
    const X = normalFromU(u1, u2);
    const U = rng();
    limit.push(X);
    const path = new Array(maxN);
    for (let n = 0; n < maxN; n++) {
      path[n] = U > 1 / (n + 1) ? X : 0;
    }
    paths.push(path);
  }
  return { paths, limit };
}

function genTypewriter(maxN, numPaths, rng) {
  // Typewriter / sliding bump: indicators cycling on [0,1]
  // For each omega ~ U(0,1), X_n(omega) = 1 if omega in [a_n, b_n]
  // The intervals tile [0,1] in rounds of decreasing length
  // Converges in probability to 0, but NOT a.s.
  const paths = [];
  const limit = [];
  for (let i = 0; i < numPaths; i++) {
    const omega = rng();
    limit.push(0);
    const path = new Array(maxN);
    for (let n = 0; n < maxN; n++) {
      const idx = n + 1;
      // Determine which "round" k and position j: idx = 2^k + j
      const k = Math.floor(Math.log2(idx));
      const base = 1 << k;
      const j = idx - base;
      const len = 1 / base;
      const a = j * len;
      const b = a + len;
      path[n] = (omega >= a && omega < b) ? 1 : 0;
    }
    paths.push(path);
  }
  return { paths, limit };
}

function genLpFailure(maxN, numPaths, rng) {
  // X_n = n^(1) * 1_{U < 1/n}
  // Converges a.s. and in probability to 0
  // But E[|X_n|] = n * (1/n) = 1 for all n, so L1 fails
  const paths = [];
  const limit = [];
  for (let i = 0; i < numPaths; i++) {
    const U = rng();
    limit.push(0);
    const path = new Array(maxN);
    for (let n = 0; n < maxN; n++) {
      const nn = n + 1;
      path[n] = U < 1 / nn ? nn : 0;
    }
    paths.push(path);
  }
  return { paths, limit };
}

// ---- Convergence badge info ---------------------------------
const CONVERGENCE_INFO = {
  standard: { as: true, prob: true, lp: true, dist: true },
  typewriter: { as: false, prob: true, lp: true, dist: true },
  lp_failure: { as: true, prob: true, lp: false, dist: true },
};

// ---- Build controls -----------------------------------------
function buildControls() {
  const panel = d3.select('#controls');
  panel.html('');

  panel.append('h2').text('Controls');

  // Sequence type
  const seqGroup = panel.append('div').attr('class', 'control-group dropdown-control');
  const seqLbl = seqGroup.append('label');
  seqLbl.append('span').text('Sequence Type');
  seqLbl.node().appendChild(makeInfoBtn({
    param: 'Sequence Type',
    tip: 'Which example sequence to visualize. "Standard a.s." converges in all senses. "Typewriter" converges in probability and Lᵖ but NOT almost surely — paths keep spiking back to 1 forever. "Lp failure" shows convergence a.s. and in probability but failure of Lᵖ convergence due to growing spike height.',
    default: 'Standard a.s.',
  }));
  const sel = seqGroup.append('select');
  [['standard', 'Standard a.s.'], ['typewriter', 'Typewriter'], ['lp_failure', 'Lp failure']]
    .forEach(([v, t]) => sel.append('option').attr('value', v).text(t));
  sel.property('value', state.seqType);
  sel.on('change', function () { state.seqType = this.value; regenerate(); });

  panel.append('hr').attr('class', 'control-divider');

  // Max n (log scale)
  addSlider(panel, 'Max n', 'maxN', 1, 4, state.maxN,
    v => Math.round(Math.pow(10, v)),
    v => Math.log10(v),
    v => v.toLocaleString(), {
      param: 'Maximum n',
      tip: 'The time horizon for the simulation. The a.s. convergence panel shows all sample paths up to n. Larger n makes the tail behavior (does it stabilize?) more apparent.',
      default: '1,000', range: '10–10,000',
    });

  // Num paths
  addSlider(panel, 'Sample Paths', 'numPaths', 10, 200, state.numPaths,
    v => Math.round(v), v => v, v => String(v), {
      param: 'Number of Sample Paths',
      tip: 'How many independent realizations ω₁, ω₂, … to draw. Each path shows the value of Xₙ(ωᵢ) as n increases. The a.s. panel lets you see whether individual paths converge; the probability panel shows the fraction outside ε.',
      default: '50', range: '10–200',
    });

  // Epsilon
  addSlider(panel, 'Epsilon (probability panel)', 'epsilon', 0.01, 1.0, state.epsilon,
    v => +v.toFixed(3), v => v, v => v.toFixed(2), {
      param: 'Epsilon (ε) — Tolerance Band',
      tip: 'The tolerance used in the convergence-in-probability panel. It plots P(|Xₙ − X| > ε) as a function of n. This must go to 0 for convergence in probability. Smaller ε is a stricter test.',
      default: '0.1', range: '0.01–1.0',
    });

  // p
  addSlider(panel, 'p (Lp panel)', 'pValue', 0.5, 4.0, state.pValue,
    v => +v.toFixed(2), v => v, v => v.toFixed(1), {
      param: 'Moment Order p (Lᵖ panel)',
      tip: 'The exponent used in Lᵖ convergence: E[|Xₙ − X|ᵖ] → 0. Larger p is a stricter requirement. p=1 is mean convergence, p=2 is mean-square convergence. The "Lp failure" sequence illustrates how convergence can fail for large p despite converging a.s.',
      default: '2', range: '0.5–4.0',
    });

  panel.append('hr').attr('class', 'control-divider');

  // Regenerate button
  const actionRow = panel.append('div').attr('class', 'action-row');
  actionRow.append('button')
    .attr('class', 'btn btn-primary')
    .text('Regenerate')
    .on('click', () => { state.seed = Math.floor(Math.random() * 1e8); regenerate(); });
}

function addSlider(panel, label, key, min, max, initial, toVal, fromVal, fmt, tooltip) {
  const group = panel.append('div').attr('class', 'control-group slider-control');
  const lbl = group.append('label');
  lbl.append('span').text(label + ' ');
  const valSpan = lbl.append('span').attr('class', 'value-display');
  valSpan.text(fmt(initial));
  if (tooltip) lbl.node().appendChild(makeInfoBtn(tooltip));

  const slider = group.append('input')
    .attr('type', 'range')
    .attr('min', min)
    .attr('max', max)
    .attr('step', (max - min) / 500)
    .property('value', fromVal(initial));

  slider.on('input', function () {
    const raw = +this.value;
    const val = toVal(raw);
    state[key] = val;
    valSpan.text(fmt(val));
    // For epsilon and p, only redraw (no data regen needed)
    if (key === 'epsilon' || key === 'pValue') {
      drawAll();
    } else {
      regenerate();
    }
  });
}

// ---- Regenerate data and redraw -----------------------------
function regenerate() {
  const rng = xoshiro128ss(state.seed);
  state.data = generateData(state.seqType, state.maxN, state.numPaths, rng);
  drawAll();
  updateBadges();
}

// ---- SVG helpers --------------------------------------------
const MARGIN = { top: 12, right: 16, bottom: 32, left: 48 };

function ensureSVG(panelId) {
  const container = d3.select(`#${panelId} .chart-area`);
  let svg = container.select('svg');
  if (svg.empty()) {
    svg = container.append('svg')
      .attr('preserveAspectRatio', 'xMidYMid meet');
  }
  const w = container.node().clientWidth || 400;
  const h = container.node().clientHeight || 260;
  svg.attr('viewBox', `0 0 ${w} ${h}`);
  return { svg, width: w, height: h };
}

function innerSize(width, height) {
  return {
    iw: width - MARGIN.left - MARGIN.right,
    ih: height - MARGIN.top - MARGIN.bottom,
  };
}

// ---- Draw all panels ----------------------------------------
function drawAll() {
  drawASPanel();
  drawProbPanel();
  drawLpPanel();
  drawDistPanel();
}

// ---- Panel 1: Almost Sure -----------------------------------
function drawASPanel() {
  const { svg, width, height } = ensureSVG('panel-as');
  const { iw, ih } = innerSize(width, height);
  const { paths, limit } = state.data;
  const N = state.maxN;

  svg.selectAll('*').remove();
  const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  // Determine y range
  let yMin = Infinity, yMax = -Infinity;
  for (const p of paths) {
    for (let n = 0; n < N; n++) {
      if (p[n] < yMin) yMin = p[n];
      if (p[n] > yMax) yMax = p[n];
    }
  }
  for (const l of limit) {
    if (l < yMin) yMin = l;
    if (l > yMax) yMax = l;
  }
  const yPad = (yMax - yMin) * 0.1 || 1;
  yMin -= yPad; yMax += yPad;

  const xScale = d3.scaleLinear().domain([1, N]).range([0, iw]);
  const yScale = d3.scaleLinear().domain([yMin, yMax]).range([ih, 0]);

  // Axes
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.format('d')));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(yScale).ticks(5));

  // Axis labels
  g.append('text').attr('class', 'axis-label')
    .attr('x', iw / 2).attr('y', ih + 28).attr('text-anchor', 'middle').text('n');

  // Sample paths
  const line = d3.line()
    .x((_, i) => xScale(i + 1))
    .y(d => yScale(d))
    .curve(d3.curveLinear);

  paths.forEach((p, i) => {
    g.append('path')
      .attr('class', 'sample-path')
      .attr('d', line(p.slice(0, N)))
      .attr('stroke', VIZ_COLORS[i % VIZ_COLORS.length]);
  });

  // Limit line (average / most common)
  if (state.seqType === 'standard') {
    // For standard, each path has its own limit; draw dashed lines at 0 as reference
    g.append('line')
      .attr('class', 'limit-line')
      .attr('x1', 0).attr('x2', iw)
      .attr('y1', yScale(0)).attr('y2', yScale(0));
  } else {
    // Limit is 0
    g.append('line')
      .attr('class', 'limit-line')
      .attr('x1', 0).attr('x2', iw)
      .attr('y1', yScale(0)).attr('y2', yScale(0));
  }

  // Annotation
  addAnnotation('panel-as', state.seqType === 'standard'
    ? 'X_n \\to X \\text{ a.s.}'
    : (state.seqType === 'typewriter'
      ? 'X_n \\not\\to 0 \\text{ a.s.}'
      : 'X_n \\to 0 \\text{ a.s.}'));
}

// ---- Panel 2: Convergence in Probability --------------------
function drawProbPanel() {
  const { svg, width, height } = ensureSVG('panel-prob');
  const { iw, ih } = innerSize(width, height);
  const { paths, limit } = state.data;
  const N = state.maxN;
  const eps = state.epsilon;

  svg.selectAll('*').remove();
  const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  // Compute P(|X_n - X| > epsilon) for each n
  const probData = [];
  for (let n = 0; n < N; n++) {
    let count = 0;
    for (let i = 0; i < paths.length; i++) {
      if (Math.abs(paths[i][n] - limit[i]) > eps) count++;
    }
    probData.push({ n: n + 1, p: count / paths.length });
  }

  const xScale = d3.scaleLinear().domain([1, N]).range([0, iw]);
  const yScale = d3.scaleLinear().domain([0, 1]).range([ih, 0]);

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.format('d')));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(yScale).ticks(5));

  g.append('text').attr('class', 'axis-label')
    .attr('x', iw / 2).attr('y', ih + 28).attr('text-anchor', 'middle').text('n');

  // Area under curve
  const area = d3.area()
    .x(d => xScale(d.n))
    .y0(ih)
    .y1(d => yScale(d.p))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .attr('class', 'metric-area')
    .attr('d', area(probData));

  // Line
  const line = d3.line()
    .x(d => xScale(d.n))
    .y(d => yScale(d.p))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .attr('class', 'metric-curve')
    .attr('d', line(probData));

  addAnnotation('panel-prob',
    `P(|X_n - X| > ${eps.toFixed(2)})`);
}

// ---- Panel 3: Lp Convergence --------------------------------
function drawLpPanel() {
  const { svg, width, height } = ensureSVG('panel-lp');
  const { iw, ih } = innerSize(width, height);
  const { paths, limit } = state.data;
  const N = state.maxN;
  const p = state.pValue;

  svg.selectAll('*').remove();
  const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  // Compute E[|X_n - X|^p] for each n
  const lpData = [];
  let yMax = 0;
  for (let n = 0; n < N; n++) {
    let sum = 0;
    for (let i = 0; i < paths.length; i++) {
      sum += Math.pow(Math.abs(paths[i][n] - limit[i]), p);
    }
    const val = sum / paths.length;
    lpData.push({ n: n + 1, v: val });
    if (val > yMax) yMax = val;
  }

  // Cap yMax for display
  yMax = Math.min(yMax * 1.1 || 1, yMax + 0.5);

  const xScale = d3.scaleLinear().domain([1, N]).range([0, iw]);
  const yScale = d3.scaleLinear().domain([0, yMax]).range([ih, 0]).nice();

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.format('d')));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(yScale).ticks(5));

  g.append('text').attr('class', 'axis-label')
    .attr('x', iw / 2).attr('y', ih + 28).attr('text-anchor', 'middle').text('n');

  const area = d3.area()
    .x(d => xScale(d.n))
    .y0(ih)
    .y1(d => yScale(Math.min(d.v, yMax)))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .attr('class', 'metric-area')
    .attr('d', area(lpData));

  const line = d3.line()
    .x(d => xScale(d.n))
    .y(d => yScale(Math.min(d.v, yMax)))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .attr('class', 'metric-curve')
    .attr('d', line(lpData))
    .attr('stroke', 'var(--viz-3)');

  addAnnotation('panel-lp',
    `E[|X_n - X|^{${p.toFixed(1)}}]`);
}

// ---- Panel 4: Distribution ---------------------------------
function drawDistPanel() {
  const { svg, width, height } = ensureSVG('panel-dist');
  const { iw, ih } = innerSize(width, height);
  const { paths, limit } = state.data;
  const N = state.maxN;

  svg.selectAll('*').remove();
  const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  // Pick several values of n to show CDFs
  const nValues = [];
  const steps = 5;
  for (let k = 0; k < steps; k++) {
    const idx = Math.max(0, Math.round((k / (steps - 1)) * (N - 1)));
    nValues.push(idx);
  }
  // Deduplicate
  const uniqueN = [...new Set(nValues)];

  // Collect all values to determine x range
  let allVals = [];
  for (const nIdx of uniqueN) {
    for (const p of paths) {
      allVals.push(p[nIdx]);
    }
  }
  // Also include limit values
  for (const l of limit) allVals.push(l);

  allVals = allVals.filter(v => isFinite(v));
  let xMin = d3.min(allVals);
  let xMax = d3.max(allVals);
  const xPad = (xMax - xMin) * 0.1 || 1;
  xMin -= xPad; xMax += xPad;

  const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, iw]);
  const yScale = d3.scaleLinear().domain([0, 1]).range([ih, 0]);

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(xScale).ticks(5));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(yScale).ticks(5));

  g.append('text').attr('class', 'axis-label')
    .attr('x', iw / 2).attr('y', ih + 28).attr('text-anchor', 'middle').text('x');

  // Empirical CDF for each n
  uniqueN.forEach((nIdx, ci) => {
    const vals = paths.map(p => p[nIdx]).filter(v => isFinite(v)).sort((a, b) => a - b);
    const M = vals.length;
    if (M === 0) return;

    const cdfPoints = [{ x: xMin, y: 0 }];
    for (let j = 0; j < M; j++) {
      cdfPoints.push({ x: vals[j], y: j / M });
      cdfPoints.push({ x: vals[j], y: (j + 1) / M });
    }
    cdfPoints.push({ x: xMax, y: 1 });

    const line = d3.line()
      .x(d => xScale(d.x))
      .y(d => yScale(d.y));

    g.append('path')
      .attr('class', 'cdf-line')
      .attr('d', line(cdfPoints))
      .attr('stroke', VIZ_COLORS[ci % VIZ_COLORS.length])
      .attr('opacity', 0.4 + 0.6 * (ci / (uniqueN.length - 1 || 1)));
  });

  // Limit CDF
  if (state.seqType === 'standard') {
    // Limit is N(0,1)
    const cdfPoints = [];
    for (let i = 0; i <= 100; i++) {
      const x = xMin + (xMax - xMin) * i / 100;
      cdfPoints.push({ x, y: normalCDF(x) });
    }
    const line = d3.line().x(d => xScale(d.x)).y(d => yScale(d.y));
    g.append('path')
      .attr('class', 'cdf-limit')
      .attr('d', line(cdfPoints));
  } else {
    // Limit is 0 (point mass): CDF = step at 0
    g.append('line')
      .attr('class', 'cdf-limit')
      .attr('x1', xScale(xMin)).attr('x2', xScale(0))
      .attr('y1', yScale(0)).attr('y2', yScale(0));
    g.append('line')
      .attr('class', 'cdf-limit')
      .attr('x1', xScale(0)).attr('x2', xScale(0))
      .attr('y1', yScale(0)).attr('y2', yScale(1));
    g.append('line')
      .attr('class', 'cdf-limit')
      .attr('x1', xScale(0)).attr('x2', xScale(xMax))
      .attr('y1', yScale(1)).attr('y2', yScale(1));
  }

  // Legend
  const legend = g.append('g').attr('transform', `translate(${iw - 90}, 6)`);
  uniqueN.forEach((nIdx, ci) => {
    legend.append('line')
      .attr('x1', 0).attr('x2', 16)
      .attr('y1', ci * 14).attr('y2', ci * 14)
      .attr('stroke', VIZ_COLORS[ci % VIZ_COLORS.length])
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.4 + 0.6 * (ci / (uniqueN.length - 1 || 1)));
    legend.append('text')
      .attr('x', 20).attr('y', ci * 14 + 4)
      .attr('font-size', '9px')
      .attr('fill', 'var(--color-text-secondary)')
      .attr('font-family', 'var(--font-mono)')
      .text(`n=${nIdx + 1}`);
  });

  addAnnotation('panel-dist', 'F_{X_n}(x) \\to F_X(x)');
}

// ---- KaTeX annotation in panel corner -----------------------
function addAnnotation(panelId, tex) {
  const container = d3.select(`#${panelId} .chart-area`);
  let ann = container.select('.panel-annotation');
  if (ann.empty()) {
    ann = container.append('div').attr('class', 'panel-annotation');
  }
  try {
    ann.html(katex.renderToString(tex, { throwOnError: false, displayMode: false }));
  } catch {
    ann.text(tex);
  }
}

// ---- Update convergence badges on panel headers -------------
function updateBadges() {
  const info = CONVERGENCE_INFO[state.seqType];
  const panels = [
    { id: 'panel-as', key: 'as' },
    { id: 'panel-prob', key: 'prob' },
    { id: 'panel-lp', key: 'lp' },
    { id: 'panel-dist', key: 'dist' },
  ];
  panels.forEach(({ id, key }) => {
    const header = d3.select(`#${id} h3`);
    header.selectAll('.convergence-badge').remove();
    const converges = info[key];
    header.append('span')
      .attr('class', `convergence-badge ${converges ? 'converges' : 'fails'}`)
      .text(converges ? 'Converges' : 'Fails');
  });
}

// ---- Info panel content -------------------------------------
function buildInfoPanel() {
  const info = d3.select('#info');
  info.html('');

  info.append('h2').text('Convergence Hierarchy');

  const hierarchy = info.append('div').attr('class', 'hierarchy-diagram');
  try {
    hierarchy.html(
      katex.renderToString(
        'L^p \\text{ conv.} \\Rightarrow \\text{conv. in prob.} \\Rightarrow \\text{conv. in dist.}',
        { throwOnError: false, displayMode: true }
      ) +
      '<br>' +
      katex.renderToString(
        '\\text{a.s. conv.} \\Rightarrow \\text{conv. in prob.} \\Rightarrow \\text{conv. in dist.}',
        { throwOnError: false, displayMode: true }
      )
    );
  } catch {
    hierarchy.text('Lp => Prob => Dist ; A.S. => Prob => Dist');
  }

  const details1 = info.append('details');
  details1.append('summary').text('Almost Sure Convergence');
  const body1 = details1.append('div').attr('class', 'detail-body');
  const math1 = body1.append('div').attr('class', 'math-block');
  renderKatexSafe(math1, 'X_n \\xrightarrow{\\text{a.s.}} X \\iff P\\!\\left(\\omega : X_n(\\omega) \\to X(\\omega)\\right) = 1');
  body1.append('p').text(
    'Almost sure convergence means that the set of outcomes where the sequence fails to converge has probability zero. ' +
    'It is the strongest pointwise notion: for almost every sample point, the sequence eventually stays close to the limit.'
  );

  const details2 = info.append('details');
  details2.append('summary').text('Convergence in Probability');
  const body2 = details2.append('div').attr('class', 'detail-body');
  const math2 = body2.append('div').attr('class', 'math-block');
  renderKatexSafe(math2, 'X_n \\xrightarrow{P} X \\iff \\forall \\varepsilon > 0,\\; P(|X_n - X| > \\varepsilon) \\to 0');
  body2.append('p').text(
    'Convergence in probability requires that large deviations become increasingly rare, but occasional excursions are allowed. ' +
    'The typewriter sequence converges in probability but not almost surely because every sample point is hit infinitely often.'
  );

  const details3 = info.append('details');
  details3.append('summary').text('Lp Convergence');
  const body3 = details3.append('div').attr('class', 'detail-body');
  const math3 = body3.append('div').attr('class', 'math-block');
  renderKatexSafe(math3, 'X_n \\xrightarrow{L^p} X \\iff E\\!\\left[|X_n - X|^p\\right] \\to 0');
  body3.append('p').text(
    'Lp convergence controls the average size of deviations raised to the p-th power. ' +
    'The "Lp failure" example shows that even though X_n converges to 0 almost surely, ' +
    'the rare large spikes (of magnitude n) keep E[|X_n|] = 1 for all n.'
  );

  const details4 = info.append('details');
  details4.append('summary').text('Convergence in Distribution');
  const body4 = details4.append('div').attr('class', 'detail-body');
  const math4 = body4.append('div').attr('class', 'math-block');
  renderKatexSafe(math4, 'X_n \\xrightarrow{d} X \\iff F_{X_n}(x) \\to F_X(x) \\text{ at all continuity points of } F_X');
  body4.append('p').text(
    'Convergence in distribution is the weakest mode. It only requires that the CDFs converge pointwise at continuity points. ' +
    'It does not require the random variables to be defined on the same probability space.'
  );
}

function renderKatexSafe(selection, tex) {
  try {
    selection.html(katex.renderToString(tex, { throwOnError: false, displayMode: true }));
  } catch {
    selection.text(tex);
  }
}

// ---- Handle resize ------------------------------------------
function onResize() {
  drawAll();
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(onResize, 150);
});

// ---- Initialize ---------------------------------------------
buildControls();
buildInfoPanel();
regenerate();
