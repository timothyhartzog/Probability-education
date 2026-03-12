/* ============================================================
   Module 7.1 — Ito Integral & Stochastic Differentials
   Interactive D3.js visualization: Ito vs Stratonovich integrals,
   quadratic variation, and Ito's formula decomposition.
   ============================================================ */

import * as d3 from 'd3';
import katex from 'katex';

/* ----------------------------------------------------------------
   Seedable PRNG (xoshiro128**)
   ---------------------------------------------------------------- */
function makeRng(seed) {
  let s = [
    seed >>> 0,
    ((seed * 1597334677) >>> 0) || 1,
    ((seed * 2013368947) >>> 0) || 1,
    ((seed * 1013904223) >>> 0) || 1
  ];
  function rotl(x, k) {
    return ((x << k) | (x >>> (32 - k))) >>> 0;
  }
  function next() {
    const result = (rotl((s[1] * 5) >>> 0, 7) * 9) >>> 0;
    const t = (s[1] << 9) >>> 0;
    s[2] ^= s[0];
    s[3] ^= s[1];
    s[1] ^= s[2];
    s[0] ^= s[3];
    s[2] ^= t;
    s[3] = rotl(s[3], 11);
    return result;
  }
  // Warm up
  for (let i = 0; i < 20; i++) next();
  return {
    random() {
      return next() / 4294967296;
    },
    normal() {
      const u1 = (next() + 1) / 4294967297;
      const u2 = next() / 4294967296;
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }
  };
}

/* ----------------------------------------------------------------
   Brownian motion generation
   Returns array of { t, value, dB } where dB[i] = B[i] - B[i-1]
   ---------------------------------------------------------------- */
function generateBM(rng, T, N) {
  const dt = T / N;
  const sqrtDt = Math.sqrt(dt);
  const path = new Array(N + 1);
  path[0] = { t: 0, value: 0, dB: 0 };
  let val = 0;
  for (let i = 1; i <= N; i++) {
    const inc = sqrtDt * rng.normal();
    val += inc;
    path[i] = { t: i * dt, value: val, dB: inc };
  }
  return path;
}

/* ----------------------------------------------------------------
   Integrand functions f(t, Bt)
   ---------------------------------------------------------------- */
const INTEGRANDS = {
  identity: {
    label: 'f = B_t',
    fn: (_t, b) => b,
    tex: 'f(t, B_t) = B_t'
  },
  squared: {
    label: 'f = B_t^2',
    fn: (_t, b) => b * b,
    tex: 'f(t, B_t) = B_t^2'
  },
  sin: {
    label: 'f = sin(B_t)',
    fn: (_t, b) => Math.sin(b),
    tex: 'f(t, B_t) = \\sin(B_t)'
  },
  constant: {
    label: 'f = 1',
    fn: (_t, _b) => 1,
    tex: 'f(t, B_t) = 1'
  }
};

/* ----------------------------------------------------------------
   Ito formula functions g(x), g'(x), g''(x)
   ---------------------------------------------------------------- */
const ITO_FUNCTIONS = {
  x2: {
    label: 'g = x^2',
    g: x => x * x,
    gp: x => 2 * x,
    gpp: _x => 2,
    tex: 'B_t^2 = 2\\int_0^t B_s\\,dB_s + t',
    texShort: 'g(x) = x^2'
  },
  exp: {
    label: 'g = exp(x)',
    g: x => Math.exp(x),
    gp: x => Math.exp(x),
    gpp: x => Math.exp(x),
    tex: 'e^{B_t} = 1 + \\int_0^t e^{B_s}\\,dB_s + \\tfrac{1}{2}\\int_0^t e^{B_s}\\,ds',
    texShort: 'g(x) = e^x'
  },
  x3: {
    label: 'g = x^3',
    g: x => x * x * x,
    gp: x => 3 * x * x,
    gpp: x => 6 * x,
    tex: 'B_t^3 = 3\\int_0^t B_s^2\\,dB_s + 3\\int_0^t B_s\\,ds',
    texShort: 'g(x) = x^3'
  }
};

/* ----------------------------------------------------------------
   Palette and layout constants
   ---------------------------------------------------------------- */
const VIZ_COLORS = ['#2563eb', '#e97319', '#059669', '#7c3aed', '#db2777',
  '#0891b2', '#ca8a04', '#64748b', '#be185d', '#4f46e5',
  '#dc2626', '#16a34a', '#9333ea', '#0d9488', '#d97706',
  '#6366f1', '#84cc16', '#f43f5e', '#06b6d4', '#a855f7'];

const MARGIN = { top: 20, right: 24, bottom: 42, left: 52 };

/* ----------------------------------------------------------------
   Global state
   ---------------------------------------------------------------- */
const state = {
  seed: 42,
  numSteps: 500,
  numPaths: 3,
  integrand: 'identity',
  interpretation: 'ito',  // 'ito' or 'strat'
  itoFunction: 'x2',
  T: 1,
  // Computed data (invalidated on param change)
  bmPaths: null,
  dirty: true
};

/* ----------------------------------------------------------------
   Seed advance helper
   ---------------------------------------------------------------- */
function advanceSeed(s) {
  return ((s * 1103515245 + 12345) & 0x7fffffff) || 1;
}

/* ----------------------------------------------------------------
   Chart dimension helper
   ---------------------------------------------------------------- */
function chartDims(container) {
  const w = container.clientWidth || 600;
  const h = Math.min(360, Math.max(220, w * 0.45));
  return {
    width: w,
    height: h,
    iw: w - MARGIN.left - MARGIN.right,
    ih: h - MARGIN.top - MARGIN.bottom
  };
}

/* ----------------------------------------------------------------
   Data generation
   ---------------------------------------------------------------- */
function generateAllPaths() {
  const rng = makeRng(state.seed);
  const paths = [];
  for (let i = 0; i < state.numPaths; i++) {
    paths.push(generateBM(rng, state.T, state.numSteps));
  }
  state.bmPaths = paths;
  state.dirty = false;
}

/* ----------------------------------------------------------------
   Compute stochastic integral via Riemann sums
   Ito: left-point evaluation
   Stratonovich: midpoint evaluation (average of left and right)
   ---------------------------------------------------------------- */
function computeStochasticIntegral(bmPath, integrandFn) {
  const N = bmPath.length - 1;
  const itoVals = new Array(N + 1);
  const stratVals = new Array(N + 1);
  itoVals[0] = 0;
  stratVals[0] = 0;

  let itoSum = 0;
  let stratSum = 0;

  for (let i = 1; i <= N; i++) {
    const tLeft = bmPath[i - 1].t;
    const bLeft = bmPath[i - 1].value;
    const bRight = bmPath[i].value;
    const bMid = (bLeft + bRight) / 2;
    const tMid = (tLeft + bmPath[i].t) / 2;
    const dB = bmPath[i].dB;

    // Ito: f evaluated at left endpoint
    const fLeft = integrandFn(tLeft, bLeft);
    itoSum += fLeft * dB;
    itoVals[i] = itoSum;

    // Stratonovich: f evaluated at midpoint
    const fMid = integrandFn(tMid, bMid);
    stratSum += fMid * dB;
    stratVals[i] = stratSum;
  }

  return { itoVals, stratVals };
}

/* ----------------------------------------------------------------
   Compute quadratic variation along a path
   ---------------------------------------------------------------- */
function computeQuadraticVariation(bmPath) {
  const N = bmPath.length - 1;
  const qv = new Array(N + 1);
  qv[0] = 0;
  let cumQV = 0;
  for (let i = 1; i <= N; i++) {
    const dB = bmPath[i].dB;
    cumQV += dB * dB;
    qv[i] = cumQV;
  }
  return qv;
}

/* ----------------------------------------------------------------
   Compute Ito formula decomposition
   g(Bt) = g(B0) + integral g'(Bs) dBs + 0.5 * integral g''(Bs) ds
   ---------------------------------------------------------------- */
function computeItoDecomposition(bmPath, gFns) {
  const N = bmPath.length - 1;
  const dt = state.T / N;
  const total = new Array(N + 1);      // g(Bt)
  const martingale = new Array(N + 1);  // integral g'dB
  const drift = new Array(N + 1);      // 0.5 * integral g'' ds

  const g0 = gFns.g(0);
  total[0] = g0;
  martingale[0] = 0;
  drift[0] = 0;

  let martSum = 0;
  let driftSum = 0;

  for (let i = 1; i <= N; i++) {
    const bPrev = bmPath[i - 1].value;
    const bCur = bmPath[i].value;
    const dB = bmPath[i].dB;

    // Martingale part: g'(B_{i-1}) dB_i
    martSum += gFns.gp(bPrev) * dB;
    martingale[i] = martSum;

    // Drift part: 0.5 * g''(B_{i-1}) dt
    driftSum += 0.5 * gFns.gpp(bPrev) * dt;
    drift[i] = driftSum;

    // Actual function value
    total[i] = gFns.g(bCur);
  }

  return { total, martingale, drift, g0 };
}

/* ================================================================
   BUILD CONTROLS
   ================================================================ */

function buildControls() {
  // --- Integrand dropdown ---
  const integrandDiv = d3.select('#integrand-select');
  integrandDiv.html('');
  const ig = integrandDiv.append('div').attr('class', 'control-group dropdown-control');
  ig.append('label').text('Integrand f(t, Bt)');
  const igSel = ig.append('select');
  Object.entries(INTEGRANDS).forEach(([key, val]) => {
    igSel.append('option').attr('value', key).text(val.label);
  });
  igSel.property('value', state.integrand);
  igSel.on('change', function () {
    state.integrand = this.value;
    renderAll();
  });

  // --- Interpretation toggle ---
  const interpDiv = d3.select('#interpretation-toggle');
  interpDiv.html('');
  const tg = interpDiv.append('div').attr('class', 'control-group dropdown-control');
  tg.append('label').text('Integration Rule');
  const tgSel = tg.append('select');
  tgSel.append('option').attr('value', 'ito').text('Ito (left-point)');
  tgSel.append('option').attr('value', 'strat').text('Stratonovich (midpoint)');
  tgSel.append('option').attr('value', 'both').text('Both (compare)');
  tgSel.property('value', state.interpretation);
  tgSel.on('change', function () {
    state.interpretation = this.value;
    renderAll();
  });

  // --- Num steps slider ---
  const stepsDiv = d3.select('#num-steps-slider');
  stepsDiv.html('');
  const sg = stepsDiv.append('div').attr('class', 'control-group slider-control');
  const sLabel = sg.append('label');
  sLabel.append('span').text('Time Steps ');
  const sVal = sLabel.append('span').attr('class', 'value-display').text(state.numSteps);
  const sSlider = sg.append('input')
    .attr('type', 'range')
    .attr('min', 50).attr('max', 2000).attr('step', 10)
    .property('value', state.numSteps);
  sSlider.on('input', function () {
    state.numSteps = +this.value;
    sVal.text(state.numSteps);
    state.dirty = true;
    regenerateAndRender();
  });

  // --- Num paths slider ---
  const pathsDiv = d3.select('#num-paths-slider');
  pathsDiv.html('');
  const pg = pathsDiv.append('div').attr('class', 'control-group slider-control');
  const pLabel = pg.append('label');
  pLabel.append('span').text('Paths ');
  const pVal = pLabel.append('span').attr('class', 'value-display').text(state.numPaths);
  const pSlider = pg.append('input')
    .attr('type', 'range')
    .attr('min', 1).attr('max', 20).attr('step', 1)
    .property('value', state.numPaths);
  pSlider.on('input', function () {
    state.numPaths = +this.value;
    pVal.text(state.numPaths);
    state.dirty = true;
    regenerateAndRender();
  });

  // --- Seed button ---
  const seedDiv = d3.select('#seed-control');
  seedDiv.html('');
  const seedGroup = seedDiv.append('div').attr('class', 'control-group');
  seedGroup.append('label').text('Randomness');
  const actionRow = seedGroup.append('div').attr('class', 'action-row');
  actionRow.append('button')
    .attr('class', 'btn btn-primary')
    .text('New Seed')
    .on('click', () => {
      state.seed = advanceSeed(state.seed);
      state.dirty = true;
      regenerateAndRender();
    });
  actionRow.append('span')
    .attr('class', 'value-display seed-display')
    .text('seed: ' + state.seed);

  // --- Ito formula function dropdown ---
  const formulaDiv = d3.select('#formula-select');
  formulaDiv.html('');
  const fg = formulaDiv.append('div').attr('class', 'control-group dropdown-control');
  fg.append('label').text("Ito's Formula g(x)");
  const fgSel = fg.append('select');
  Object.entries(ITO_FUNCTIONS).forEach(([key, val]) => {
    fgSel.append('option').attr('value', key).text(val.label);
  });
  fgSel.property('value', state.itoFunction);
  fgSel.on('change', function () {
    state.itoFunction = this.value;
    renderAll();
  });
}

/* ================================================================
   RENDER: INTEGRAND PANEL
   ================================================================ */

function renderIntegrandPanel() {
  const container = document.getElementById('integrand-plot');
  container.innerHTML = '';

  const paths = state.bmPaths;
  const integrandInfo = INTEGRANDS[state.integrand];
  const fn = integrandInfo.fn;

  // Update subtitle
  const subtitle = document.getElementById('integrand-subtitle');
  try {
    katex.render(integrandInfo.tex, subtitle, { throwOnError: false });
  } catch {
    subtitle.textContent = integrandInfo.label;
  }

  const dims = chartDims(container);
  const { width, height, iw, ih } = dims;

  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  // Compute integrand values for all paths
  const integrandPaths = paths.map(bmPath =>
    bmPath.map(pt => ({ t: pt.t, bm: pt.value, f: fn(pt.t, pt.value) }))
  );

  // Y-range: show both BM and integrand
  let yMin = Infinity, yMax = -Infinity;
  for (const ip of integrandPaths) {
    for (const pt of ip) {
      if (pt.bm < yMin) yMin = pt.bm;
      if (pt.bm > yMax) yMax = pt.bm;
      if (pt.f < yMin) yMin = pt.f;
      if (pt.f > yMax) yMax = pt.f;
    }
  }
  const yPad = (yMax - yMin) * 0.1 || 1;

  const xScale = d3.scaleLinear().domain([0, state.T]).range([0, iw]);
  const yScale = d3.scaleLinear().domain([yMin - yPad, yMax + yPad]).range([ih, 0]);

  // Axes
  g.append('g').attr('class', 'axis')
    .attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(xScale).ticks(8));
  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(6));

  // Axis labels
  g.append('text').attr('class', 'axis-label')
    .attr('x', iw / 2).attr('y', ih + 36)
    .attr('text-anchor', 'middle').text('t');
  g.append('text').attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -ih / 2).attr('y', -40)
    .attr('text-anchor', 'middle').text('Value');

  // Zero line
  g.append('line')
    .attr('class', 'reference-line')
    .attr('x1', 0).attr('x2', iw)
    .attr('y1', yScale(0)).attr('y2', yScale(0))
    .attr('stroke', '#cbd5e1').attr('stroke-dasharray', '4 4');

  const bmLine = d3.line()
    .x(d => xScale(d.t))
    .y(d => yScale(d.bm));

  const fLine = d3.line()
    .x(d => xScale(d.t))
    .y(d => yScale(d.f));

  // Draw BM paths (thin, semi-transparent)
  integrandPaths.forEach((ip, i) => {
    g.append('path')
      .datum(ip)
      .attr('class', 'bm-path')
      .attr('d', bmLine)
      .attr('stroke', VIZ_COLORS[i % VIZ_COLORS.length])
      .attr('opacity', 0.35)
      .attr('stroke-width', 1);
  });

  // Draw integrand f paths (bold)
  integrandPaths.forEach((ip, i) => {
    g.append('path')
      .datum(ip)
      .attr('class', 'integral-path')
      .attr('d', fLine)
      .attr('stroke', VIZ_COLORS[i % VIZ_COLORS.length])
      .attr('stroke-width', 2);
  });

  // Legend
  const legendG = g.append('g')
    .attr('transform', `translate(${iw - 130}, 4)`);

  legendG.append('line')
    .attr('x1', 0).attr('x2', 20)
    .attr('y1', 0).attr('y2', 0)
    .attr('stroke', VIZ_COLORS[0]).attr('stroke-width', 1).attr('opacity', 0.4);
  legendG.append('text')
    .attr('x', 24).attr('y', 4)
    .attr('font-size', '10px').attr('fill', 'var(--color-text-secondary)')
    .text('Bt (BM)');

  legendG.append('line')
    .attr('x1', 0).attr('x2', 20)
    .attr('y1', 16).attr('y2', 16)
    .attr('stroke', VIZ_COLORS[0]).attr('stroke-width', 2);
  legendG.append('text')
    .attr('x', 24).attr('y', 20)
    .attr('font-size', '10px').attr('fill', 'var(--color-text-secondary)')
    .text('f(t, Bt)');
}

/* ================================================================
   RENDER: STOCHASTIC INTEGRAL PANEL
   ================================================================ */

function renderIntegralPanel() {
  const container = document.getElementById('integral-plot');
  container.innerHTML = '';

  const paths = state.bmPaths;
  const integrandFn = INTEGRANDS[state.integrand].fn;
  const showIto = state.interpretation === 'ito' || state.interpretation === 'both';
  const showStrat = state.interpretation === 'strat' || state.interpretation === 'both';

  // Compute integrals for all paths
  const results = paths.map(bm => computeStochasticIntegral(bm, integrandFn));

  const dims = chartDims(container);
  const { width, height, iw, ih } = dims;

  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  // Y-range
  let yMin = Infinity, yMax = -Infinity;
  for (const r of results) {
    for (let i = 0; i < r.itoVals.length; i++) {
      if (showIto) {
        if (r.itoVals[i] < yMin) yMin = r.itoVals[i];
        if (r.itoVals[i] > yMax) yMax = r.itoVals[i];
      }
      if (showStrat) {
        if (r.stratVals[i] < yMin) yMin = r.stratVals[i];
        if (r.stratVals[i] > yMax) yMax = r.stratVals[i];
      }
    }
  }
  if (!isFinite(yMin)) { yMin = -1; yMax = 1; }
  const yPad = (yMax - yMin) * 0.1 || 1;

  const N = state.numSteps;
  const dt = state.T / N;
  const xScale = d3.scaleLinear().domain([0, state.T]).range([0, iw]);
  const yScale = d3.scaleLinear().domain([yMin - yPad, yMax + yPad]).range([ih, 0]);

  // Axes
  g.append('g').attr('class', 'axis')
    .attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(xScale).ticks(8));
  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(6));

  g.append('text').attr('class', 'axis-label')
    .attr('x', iw / 2).attr('y', ih + 36)
    .attr('text-anchor', 'middle').text('t');
  g.append('text').attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -ih / 2).attr('y', -40)
    .attr('text-anchor', 'middle').text('\u222B f dB');

  // Zero line
  g.append('line')
    .attr('x1', 0).attr('x2', iw)
    .attr('y1', yScale(0)).attr('y2', yScale(0))
    .attr('stroke', '#cbd5e1').attr('stroke-dasharray', '4 4');

  // Draw partition rectangles for first path if few steps
  if (N <= 200 && paths.length > 0) {
    const bm0 = paths[0];
    const step = Math.max(1, Math.floor(N / 40));
    for (let i = 0; i < N; i += step) {
      const tLeft = bm0[i].t;
      const tRight = bm0[Math.min(i + step, N)].t;
      const fVal = integrandFn(tLeft, bm0[i].value);
      const rectY = fVal >= 0 ? yScale(fVal) : yScale(0);
      const rectH = Math.abs(yScale(fVal) - yScale(0));
      g.append('rect')
        .attr('class', 'partition-rect')
        .attr('x', xScale(tLeft))
        .attr('width', Math.max(1, xScale(tRight) - xScale(tLeft)))
        .attr('y', rectY)
        .attr('height', rectH)
        .attr('fill', fVal >= 0 ? 'var(--color-primary)' : 'var(--color-secondary)')
        .attr('stroke', fVal >= 0 ? 'var(--color-primary)' : 'var(--color-secondary)');
    }
  }

  // Ito integral lines
  if (showIto) {
    results.forEach((r, pi) => {
      const lineData = r.itoVals.map((v, i) => ({ t: i * dt, v }));
      const line = d3.line().x(d => xScale(d.t)).y(d => yScale(d.v));
      g.append('path')
        .datum(lineData)
        .attr('class', 'integral-path ito-path')
        .attr('d', line)
        .attr('stroke', state.interpretation === 'both' ? 'var(--color-primary)' : VIZ_COLORS[pi % VIZ_COLORS.length]);
    });
  }

  // Stratonovich integral lines
  if (showStrat) {
    results.forEach((r, pi) => {
      const lineData = r.stratVals.map((v, i) => ({ t: i * dt, v }));
      const line = d3.line().x(d => xScale(d.t)).y(d => yScale(d.v));
      g.append('path')
        .datum(lineData)
        .attr('class', 'integral-path strat-path')
        .attr('d', line)
        .attr('stroke', state.interpretation === 'both' ? 'var(--color-secondary)' : VIZ_COLORS[pi % VIZ_COLORS.length]);
    });
  }

  // Correction area (shade between Ito and Strat for first path)
  if (state.interpretation === 'both' && results.length > 0) {
    const r = results[0];
    const areaData = r.itoVals.map((v, i) => ({
      t: i * dt,
      ito: v,
      strat: r.stratVals[i]
    }));
    const corrArea = d3.area()
      .x(d => xScale(d.t))
      .y0(d => yScale(d.ito))
      .y1(d => yScale(d.strat));
    g.append('path')
      .datum(areaData)
      .attr('class', 'correction-area')
      .attr('d', corrArea)
      .attr('fill', 'var(--color-accent)');
  }

  // Legend
  const legendG = g.append('g')
    .attr('transform', `translate(${iw - 150}, 4)`);
  let ly = 0;
  if (showIto) {
    legendG.append('line')
      .attr('x1', 0).attr('x2', 20)
      .attr('y1', ly).attr('y2', ly)
      .attr('stroke', 'var(--color-primary)').attr('stroke-width', 2);
    legendG.append('text')
      .attr('x', 24).attr('y', ly + 4)
      .attr('font-size', '10px').attr('fill', 'var(--color-text-secondary)')
      .text('Ito (left-point)');
    ly += 16;
  }
  if (showStrat) {
    legendG.append('line')
      .attr('x1', 0).attr('x2', 20)
      .attr('y1', ly).attr('y2', ly)
      .attr('stroke', 'var(--color-secondary)').attr('stroke-width', 2)
      .attr('stroke-dasharray', '6 3');
    legendG.append('text')
      .attr('x', 24).attr('y', ly + 4)
      .attr('font-size', '10px').attr('fill', 'var(--color-text-secondary)')
      .text('Stratonovich (mid)');
  }

  return results;
}

/* ================================================================
   RENDER: QUADRATIC VARIATION PANEL
   ================================================================ */

function renderQuadVarPanel() {
  const container = document.getElementById('quadvar-plot');
  container.innerHTML = '';

  const paths = state.bmPaths;

  const dims = chartDims(container);
  const { width, height, iw, ih } = dims;

  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  const N = state.numSteps;
  const dt = state.T / N;

  // Use first path for bar chart, compute cumulative QV
  const qvAll = paths.map(bm => computeQuadraticVariation(bm));

  // Determine number of bars (aggregate into bins)
  const numBars = Math.min(40, N);
  const binSize = Math.ceil(N / numBars);
  const barData = [];

  // Compute binned increments for first path
  const bm0 = paths[0];
  let cumQV = 0;
  for (let b = 0; b < numBars; b++) {
    const iStart = b * binSize;
    const iEnd = Math.min((b + 1) * binSize, N);
    let binQV = 0;
    for (let i = iStart + 1; i <= iEnd; i++) {
      const dB = bm0[i].dB;
      binQV += dB * dB;
    }
    cumQV += binQV;
    barData.push({
      tStart: iStart * dt,
      tEnd: iEnd * dt,
      increment: binQV,
      cumulative: cumQV
    });
  }

  const yMaxCum = Math.max(d3.max(qvAll[0]) || 1, state.T) * 1.15;
  const xScale = d3.scaleLinear().domain([0, state.T]).range([0, iw]);
  const yScale = d3.scaleLinear().domain([0, yMaxCum]).range([ih, 0]);

  // Axes
  g.append('g').attr('class', 'axis')
    .attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(xScale).ticks(6));
  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(5));

  g.append('text').attr('class', 'axis-label')
    .attr('x', iw / 2).attr('y', ih + 36)
    .attr('text-anchor', 'middle').text('t');
  g.append('text').attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -ih / 2).attr('y', -40)
    .attr('text-anchor', 'middle').text('[B]_t');

  // Reference line y = t
  g.append('line')
    .attr('x1', xScale(0)).attr('x2', xScale(state.T))
    .attr('y1', yScale(0)).attr('y2', yScale(state.T))
    .attr('stroke', 'var(--color-secondary)')
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '6 3');

  // Bars (cumulative as stacked)
  g.selectAll('.qv-bar')
    .data(barData)
    .join('rect')
    .attr('class', 'qv-bar')
    .attr('x', d => xScale(d.tStart) + 1)
    .attr('width', d => Math.max(1, xScale(d.tEnd) - xScale(d.tStart) - 2))
    .attr('y', d => yScale(d.cumulative))
    .attr('height', d => ih - yScale(d.cumulative))
    .attr('fill', 'var(--color-primary)')
    .attr('opacity', 0.5);

  // Cumulative QV lines for all paths
  qvAll.forEach((qv, pi) => {
    const lineData = qv.map((v, i) => ({ t: i * dt, v }));
    const line = d3.line().x(d => xScale(d.t)).y(d => yScale(d.v));
    g.append('path')
      .datum(lineData)
      .attr('fill', 'none')
      .attr('stroke', VIZ_COLORS[pi % VIZ_COLORS.length])
      .attr('stroke-width', 1.5)
      .attr('d', line);
  });

  // Legend
  const legendG = g.append('g')
    .attr('transform', `translate(${iw - 140}, 4)`);
  legendG.append('line')
    .attr('x1', 0).attr('x2', 20)
    .attr('y1', 0).attr('y2', 0)
    .attr('stroke', VIZ_COLORS[0]).attr('stroke-width', 1.5);
  legendG.append('text')
    .attr('x', 24).attr('y', 4)
    .attr('font-size', '10px').attr('fill', 'var(--color-text-secondary)')
    .text('[B]_t cumulative');

  legendG.append('line')
    .attr('x1', 0).attr('x2', 20)
    .attr('y1', 16).attr('y2', 16)
    .attr('stroke', 'var(--color-secondary)').attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '6 3');
  legendG.append('text')
    .attr('x', 24).attr('y', 20)
    .attr('font-size', '10px').attr('fill', 'var(--color-text-secondary)')
    .text('y = t (theory)');

  return qvAll;
}

/* ================================================================
   RENDER: ITO'S FORMULA PANEL
   ================================================================ */

function renderItoFormulaPanel() {
  const container = document.getElementById('ito-formula-plot');
  container.innerHTML = '';

  if (!state.bmPaths || state.bmPaths.length === 0) return;

  const bm = state.bmPaths[0]; // Use first path
  const gFns = ITO_FUNCTIONS[state.itoFunction];
  const decomp = computeItoDecomposition(bm, gFns);

  // Update subtitle with formula
  const subtitleEl = document.querySelector('#ito-formula-chart .viz-subtitle');
  if (subtitleEl) {
    try {
      katex.render(gFns.tex, subtitleEl, { throwOnError: false, displayMode: false });
    } catch {
      subtitleEl.textContent = gFns.tex;
    }
  }

  const dims = chartDims(container);
  const { width, height, iw, ih } = dims;

  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  const N = state.numSteps;
  const dt = state.T / N;

  // Y-range
  let yMin = Infinity, yMax = -Infinity;
  for (let i = 0; i <= N; i++) {
    const vals = [decomp.total[i], decomp.martingale[i], decomp.drift[i],
      decomp.g0 + decomp.martingale[i] + decomp.drift[i]];
    for (const v of vals) {
      if (isFinite(v)) {
        if (v < yMin) yMin = v;
        if (v > yMax) yMax = v;
      }
    }
  }
  if (!isFinite(yMin)) { yMin = -1; yMax = 1; }
  const yPad = (yMax - yMin) * 0.1 || 1;

  const xScale = d3.scaleLinear().domain([0, state.T]).range([0, iw]);
  const yScale = d3.scaleLinear().domain([yMin - yPad, yMax + yPad]).range([ih, 0]);

  // Axes
  g.append('g').attr('class', 'axis')
    .attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(xScale).ticks(8));
  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(6));

  g.append('text').attr('class', 'axis-label')
    .attr('x', iw / 2).attr('y', ih + 36)
    .attr('text-anchor', 'middle').text('t');
  g.append('text').attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -ih / 2).attr('y', -40)
    .attr('text-anchor', 'middle').text('Value');

  // Zero line
  g.append('line')
    .attr('x1', 0).attr('x2', iw)
    .attr('y1', yScale(0)).attr('y2', yScale(0))
    .attr('stroke', '#cbd5e1').attr('stroke-dasharray', '4 4');

  const makeLine = accessor => {
    return d3.line()
      .x((_, i) => xScale(i * dt))
      .y(d => yScale(d))
      .defined(d => isFinite(d));
  };

  // Martingale part: integral g' dB
  g.append('path')
    .datum(decomp.martingale)
    .attr('class', 'martingale-part')
    .attr('d', makeLine()());

  // Drift part: 0.5 integral g'' ds
  g.append('path')
    .datum(decomp.drift)
    .attr('class', 'drift-part')
    .attr('d', makeLine()());

  // Actual g(Bt) = total
  g.append('path')
    .datum(decomp.total)
    .attr('class', 'total-part')
    .attr('d', makeLine()());

  // Reconstructed: g(B0) + martingale + drift
  const reconstructed = decomp.total.map((_, i) =>
    decomp.g0 + decomp.martingale[i] + decomp.drift[i]
  );
  g.append('path')
    .datum(reconstructed)
    .attr('fill', 'none')
    .attr('stroke', '#7c3aed')
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '4 2')
    .attr('d', makeLine()());

  // Shade drift correction area
  const driftAreaData = decomp.drift.map((v, i) => ({ t: i * dt, v }));
  const driftArea = d3.area()
    .x(d => xScale(d.t))
    .y0(yScale(0))
    .y1(d => yScale(d.v));
  g.append('path')
    .datum(driftAreaData)
    .attr('class', 'correction-area')
    .attr('d', driftArea)
    .attr('fill', 'var(--color-secondary)');

  // Legend
  const legendG = g.append('g')
    .attr('transform', `translate(${iw - 180}, 4)`);
  const legendItems = [
    { label: "g(Bt) actual", cls: 'total-part', color: 'var(--color-accent)', dash: '' },
    { label: "Martingale \u222Bg'dB", cls: 'martingale-part', color: 'var(--color-primary)', dash: '' },
    { label: "Drift \u00BDg''dt", cls: 'drift-part', color: 'var(--color-secondary)', dash: '' },
    { label: 'Reconstructed', cls: '', color: '#7c3aed', dash: '4 2' }
  ];
  legendItems.forEach((item, i) => {
    const ly = i * 15;
    legendG.append('line')
      .attr('x1', 0).attr('x2', 18)
      .attr('y1', ly).attr('y2', ly)
      .attr('stroke', item.color).attr('stroke-width', 2)
      .attr('stroke-dasharray', item.dash || null);
    legendG.append('text')
      .attr('x', 22).attr('y', ly + 4)
      .attr('font-size', '9px').attr('fill', 'var(--color-text-secondary)')
      .text(item.label);
  });

  return decomp;
}

/* ================================================================
   RENDER: STATS PANEL
   ================================================================ */

function renderStats(integralResults, qvAll, decomp) {
  const statsEl = document.getElementById('stats');
  statsEl.innerHTML = '';

  const integrandFn = INTEGRANDS[state.integrand].fn;
  const N = state.numSteps;
  const dt = state.T / N;

  // E[integral f dB] and Var[integral f dB] across paths
  if (integralResults && integralResults.length > 0) {
    const finalIto = integralResults.map(r => r.itoVals[N]);
    const finalStrat = integralResults.map(r => r.stratVals[N]);
    const meanIto = d3.mean(finalIto) || 0;
    const varIto = d3.variance(finalIto) || 0;
    const meanStrat = d3.mean(finalStrat) || 0;

    addStatCard(statsEl, meanIto.toFixed(4), 'E[\u222Bf dB] (Ito)');
    addStatCard(statsEl, varIto.toFixed(4), 'Var[\u222Bf dB]');

    if (state.interpretation === 'both' || state.interpretation === 'strat') {
      const correction = meanStrat - meanIto;
      addStatCard(statsEl, correction.toFixed(4), 'Strat - Ito correction');
    }
  }

  // Quadratic variation final value
  if (qvAll && qvAll.length > 0) {
    const qvFinals = qvAll.map(qv => qv[qv.length - 1]);
    const meanQV = d3.mean(qvFinals) || 0;
    addStatCard(statsEl, meanQV.toFixed(4), '[B]_T (expect ' + state.T.toFixed(1) + ')');
  }

  // Ito correction term
  if (decomp) {
    const finalDrift = decomp.drift[N];
    addStatCard(statsEl, finalDrift.toFixed(4), 'Ito drift correction');

    // Reconstruction error
    const reconError = Math.abs(
      decomp.total[N] - (decomp.g0 + decomp.martingale[N] + decomp.drift[N])
    );
    addStatCard(statsEl, reconError.toExponential(2), 'Reconstruction error');
  }
}

function addStatCard(container, value, label) {
  const card = document.createElement('div');
  card.className = 'stat-card';
  card.innerHTML =
    '<div class="stat-value">' + value + '</div>' +
    '<div class="stat-label">' + label + '</div>';
  container.appendChild(card);
}

/* ================================================================
   RENDER: INFO PANEL
   ================================================================ */

function renderInfoPanel() {
  const info = d3.select('#info');
  info.html('');

  info.append('h2').text('Key Formulas');

  // Ito integral definition
  const d1 = info.append('details').attr('open', '');
  d1.append('summary').text('Ito Integral');
  const b1 = d1.append('div').attr('class', 'detail-body');
  const m1 = b1.append('div').attr('class', 'math-block');
  renderKatexSafe(m1,
    '\\int_0^T f(t, B_t)\\,dB_t = \\lim_{n\\to\\infty} \\sum_{i=0}^{n-1} f(t_i, B_{t_i})\\,(B_{t_{i+1}} - B_{t_i})'
  );
  b1.append('p').text(
    'The Ito integral evaluates the integrand at the left endpoint of each partition interval. ' +
    'This makes it a martingale (mean zero), but requires the Ito correction term when applying the chain rule.'
  );

  // Stratonovich
  const d2 = info.append('details');
  d2.append('summary').text('Stratonovich Integral');
  const b2 = d2.append('div').attr('class', 'detail-body');
  const m2 = b2.append('div').attr('class', 'math-block');
  renderKatexSafe(m2,
    '\\int_0^T f(t, B_t)\\circ dB_t = \\lim_{n\\to\\infty} \\sum_{i=0}^{n-1} f\\!\\left(\\tfrac{t_i+t_{i+1}}{2}, \\tfrac{B_{t_i}+B_{t_{i+1}}}{2}\\right)(B_{t_{i+1}} - B_{t_i})'
  );
  b2.append('p').text(
    'The Stratonovich integral uses midpoint evaluation, preserving the classical chain rule. ' +
    'It is not a martingale, and relates to the Ito integral via: ' +
    '\u222Bf \u2218 dB = \u222Bf dB + correction term.'
  );

  // Ito's formula
  const d3el = info.append('details').attr('open', '');
  d3el.append('summary').text("Ito's Formula (Chain Rule)");
  const b3 = d3el.append('div').attr('class', 'detail-body');
  const m3 = b3.append('div').attr('class', 'math-block');
  renderKatexSafe(m3,
    'g(B_t) = g(B_0) + \\int_0^t g\'(B_s)\\,dB_s + \\frac{1}{2}\\int_0^t g\'\'(B_s)\\,ds'
  );
  b3.append('p').text(
    "Ito's formula is the stochastic chain rule. The extra drift term (1/2)g''dt arises because " +
    'Brownian motion has nonzero quadratic variation. For g(x)=x^2, this gives B_t^2 = 2\u222BB dB + t.'
  );

  // Quadratic variation
  const d4 = info.append('details');
  d4.append('summary').text('Quadratic Variation');
  const b4 = d4.append('div').attr('class', 'detail-body');
  const m4 = b4.append('div').attr('class', 'math-block');
  renderKatexSafe(m4,
    '[B]_t = \\lim_{|\\Pi|\\to 0} \\sum_{i=0}^{n-1} (B_{t_{i+1}} - B_{t_i})^2 = t \\quad \\text{a.s.}'
  );
  b4.append('p').text(
    'The quadratic variation of Brownian motion equals t almost surely. This is the key fact underlying ' +
    "Ito's formula: it explains why (dB)^2 = dt in stochastic calculus."
  );

  // Ito isometry
  const d5 = info.append('details');
  d5.append('summary').text('Ito Isometry');
  const b5 = d5.append('div').attr('class', 'detail-body');
  const m5 = b5.append('div').attr('class', 'math-block');
  renderKatexSafe(m5,
    'E\\!\\left[\\left(\\int_0^T f(t, B_t)\\,dB_t\\right)^{\\!2}\\right] = E\\!\\left[\\int_0^T f(t, B_t)^2\\,dt\\right]'
  );
  b5.append('p').text(
    'The Ito isometry relates the variance of the stochastic integral to the expected integral of the squared integrand. ' +
    'For f=Bt, the right-hand side equals E[\u222BB_t^2 dt] = \u222Bt dt = T^2/2.'
  );
}

function renderKatexSafe(selection, tex) {
  try {
    selection.html(katex.renderToString(tex, { throwOnError: false, displayMode: true }));
  } catch {
    selection.text(tex);
  }
}

/* ================================================================
   MAIN RENDER ORCHESTRATOR
   ================================================================ */

function renderAll() {
  if (state.dirty || !state.bmPaths) {
    generateAllPaths();
  }

  renderIntegrandPanel();
  const integralResults = renderIntegralPanel();
  const qvAll = renderQuadVarPanel();
  const decomp = renderItoFormulaPanel();
  renderStats(integralResults, qvAll, decomp);

  // Update seed display
  const seedDisplay = document.querySelector('.seed-display');
  if (seedDisplay) seedDisplay.textContent = 'seed: ' + state.seed;
}

function regenerateAndRender() {
  generateAllPaths();
  renderAll();
}

/* ================================================================
   RESIZE HANDLER
   ================================================================ */

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => renderAll(), 150);
});

/* ================================================================
   INITIALIZE
   ================================================================ */

function init() {
  buildControls();
  renderInfoPanel();
  renderAll();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
