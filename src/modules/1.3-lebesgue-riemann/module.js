// ============================================================
//  Module 1.3 — Lebesgue vs. Riemann Integration
//  Side-by-side comparison of domain partitioning (Riemann)
//  vs. range partitioning (Lebesgue).
// ============================================================

import * as d3 from 'd3';
import katex from 'katex';
import '../../lib/copy-code.js';

// ---- Constants ------------------------------------------------
const MARGIN = { top: 20, right: 20, bottom: 35, left: 45 };
const W = 460, H = 350;
const CW = 960, CH = 250;
const innerW = W - MARGIN.left - MARGIN.right;
const innerH = H - MARGIN.top - MARGIN.bottom;
const cInnerW = CW - MARGIN.left - MARGIN.right;
const cInnerH = CH - MARGIN.top - MARGIN.bottom;
const N_SAMPLE = 500;   // function sampling resolution
const CONV_MAX = 100;   // max partition for convergence plot

// ---- Function definitions -------------------------------------
const FUNCTIONS = {
  smooth: {
    f: x => Math.sin(2 * Math.PI * x) + 1.5,
    exact: 1.5,
    label: 'sin(2\\pi x)+1.5',
  },
  step: {
    f: x => (x < 0.3 ? 0.5 : x < 0.7 ? 1.5 : 0.8),
    exact: 0.5 * 0.3 + 1.5 * 0.4 + 0.8 * 0.3,  // 0.15 + 0.60 + 0.24 = 0.99
    label: '\\text{Step}',
  },
  quadratic: {
    f: x => x * x,
    exact: 1 / 3,
    label: 'x^2',
  },
  sqrt: {
    f: x => Math.sqrt(x),
    exact: 2 / 3,
    label: '\\sqrt{x}',
  },
  oscillating: {
    f: x => Math.sin(20 * Math.PI * x),
    exact: 0,
    label: '\\sin(20\\pi x)',
  },
  dirichlet: {
    f: (() => {
      // Pre-build a dense set of "rational-like" positions
      const rats = new Set();
      for (let q = 1; q <= 60; q++) {
        for (let p = 0; p <= q; p++) {
          rats.add(Math.round((p / q) * 10000) / 10000);
        }
      }
      return x => {
        const xr = Math.round(x * 10000) / 10000;
        return rats.has(xr) ? 1 : 0;
      };
    })(),
    exact: 0,
    label: '1_{\\mathbb{Q}}(x)\\;(\\text{approx})',
    isDirichlet: true,
  },
};

// ---- Utility: sample function ----------------------------------
function sampleFn(f, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    pts.push({ x, y: f(x) });
  }
  return pts;
}

// ---- Riemann sums on equal partition ---------------------------
function riemannSums(f, n) {
  const dx = 1 / n;
  let upper = 0, lower = 0;
  const rects = [];
  const samplePer = Math.max(4, Math.ceil(200 / n));
  for (let i = 0; i < n; i++) {
    const a = i * dx;
    const b = (i + 1) * dx;
    let sup = -Infinity, inf = Infinity;
    for (let k = 0; k <= samplePer; k++) {
      const x = a + (k / samplePer) * dx;
      const y = f(x);
      if (y > sup) sup = y;
      if (y < inf) inf = y;
    }
    upper += sup * dx;
    lower += inf * dx;
    rects.push({ a, b, sup, inf });
  }
  return { upper, lower, rects };
}

// ---- Lebesgue sum ---------------------------------------------
function lebesgueSum(f, m, fMin, fMax) {
  const dy = (fMax - fMin) / m;
  let sum = 0;
  const slices = [];
  const xSamples = 2000;

  for (let j = 0; j < m; j++) {
    const yLo = fMin + j * dy;
    const yHi = fMin + (j + 1) * dy;
    // Find preimage intervals: set of x where yLo <= f(x) < yHi
    const preimage = [];
    let inRegion = false;
    let regionStart = 0;

    for (let i = 0; i <= xSamples; i++) {
      const x = i / xSamples;
      const y = f(x);
      const inside = y >= yLo && y < yHi;
      if (inside && !inRegion) {
        regionStart = x;
        inRegion = true;
      } else if (!inside && inRegion) {
        preimage.push([regionStart, x]);
        inRegion = false;
      }
    }
    if (inRegion) preimage.push([regionStart, 1]);

    let measure = 0;
    for (const [a, b] of preimage) measure += b - a;

    sum += yLo * measure;
    slices.push({ yLo, yHi, preimage, measure });
  }
  return { sum, slices };
}

// ---- Convergence data ------------------------------------------
function convergenceData(f, fMin, fMax, isDirichlet) {
  const upperArr = [], lowerArr = [], lebArr = [];
  for (let n = 2; n <= CONV_MAX; n++) {
    const rs = riemannSums(f, n);
    upperArr.push({ n, value: rs.upper });
    lowerArr.push({ n, value: rs.lower });
    const ls = lebesgueSum(f, n, fMin, fMax);
    lebArr.push({ n, value: ls.sum });
  }
  return { upperArr, lowerArr, lebArr };
}

// ---- Global state ----------------------------------------------
let state = {
  fnKey: 'smooth',
  nPartitions: 8,
  mSlices: 8,
  showUpper: true,
  showLower: true,
  sync: true,
  animating: false,
  animId: null,
};

// ---- DOM refs ---------------------------------------------------
const selFn = document.getElementById('function-select');
const sliderN = document.getElementById('num-partitions');
const sliderM = document.getElementById('range-slices');
const valN = document.getElementById('num-partitions-val');
const valM = document.getElementById('range-slices-val');
const chkUpper = document.getElementById('toggle-upper');
const chkLower = document.getElementById('toggle-lower');
const chkSync = document.getElementById('toggle-sync');
const btnAnimate = document.getElementById('animate-btn');
const statRU = document.getElementById('stat-riemann-upper');
const statRL = document.getElementById('stat-riemann-lower');
const statLeb = document.getElementById('stat-lebesgue');
const statExact = document.getElementById('stat-exact');

// ---- Build SVGs -------------------------------------------------
function makeSVG(container, vbW, vbH) {
  return d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${vbW} ${vbH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .attr('width', '100%');
}

const svgR = makeSVG('#riemann-chart', W, H);
const gR = svgR.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

const svgL = makeSVG('#lebesgue-chart', W, H);
const gL = svgL.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

const svgC = makeSVG('#convergence-chart', CW, CH);
const gC = svgC.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

// ---- Riemann groups (order matters for layering) ----------------
const gRUpperRects = gR.append('g').attr('class', 'upper-rects');
const gRLowerRects = gR.append('g').attr('class', 'lower-rects');
const gRPartitions = gR.append('g').attr('class', 'partition-lines');
const gRCurve = gR.append('g');
const gRAxisX = gR.append('g').attr('class', 'axis').attr('transform', `translate(0,${innerH})`);
const gRAxisY = gR.append('g').attr('class', 'axis');

// ---- Lebesgue groups --------------------------------------------
const gLSlices = gL.append('g').attr('class', 'slice-group');
const gLPreimages = gL.append('g').attr('class', 'preimage-group');
const gLHLines = gL.append('g').attr('class', 'hline-group');
const gLCurve = gL.append('g');
const gLAxisX = gL.append('g').attr('class', 'axis').attr('transform', `translate(0,${innerH})`);
const gLAxisY = gL.append('g').attr('class', 'axis');

// ---- Convergence groups -----------------------------------------
const gCLines = gC.append('g');
const gCAxisX = gC.append('g').attr('class', 'axis').attr('transform', `translate(0,${cInnerH})`);
const gCAxisY = gC.append('g').attr('class', 'axis');

// ---- Scales (will be updated) -----------------------------------
let xScale = d3.scaleLinear().domain([0, 1]).range([0, innerW]);
let yScaleR = d3.scaleLinear().range([innerH, 0]);
let yScaleL = d3.scaleLinear().range([innerH, 0]);
let cxScale = d3.scaleLinear().domain([2, CONV_MAX]).range([0, cInnerW]);
let cyScale = d3.scaleLinear().range([cInnerH, 0]);

// ---- Line generator for function curve --------------------------
const lineGen = d3.line()
  .x(d => xScale(d.x))
  .y(d => yScaleR(d.y))
  .curve(d3.curveLinear);

const lineGenL = d3.line()
  .x(d => xScale(d.x))
  .y(d => yScaleL(d.y))
  .curve(d3.curveLinear);

// ---- Convergence line generators --------------------------------
const convLine = d3.line().x(d => cxScale(d.n)).y(d => cyScale(d.value)).curve(d3.curveMonotoneX);

// ---- KaTeX rendering --------------------------------------------
function renderKaTeX() {
  const el = document.getElementById('info-comparison-def');
  if (!el) return;
  katex.render(
    String.raw`\underbrace{\sum_{i=1}^{n} \inf_{x \in [x_{i-1}, x_i]} f(x)\,\Delta x_i}_{\text{Riemann lower}} \;\leq\; \int_a^b f\,d\mu \;\leq\; \underbrace{\sum_{i=1}^{n} \sup_{x \in [x_{i-1}, x_i]} f(x)\,\Delta x_i}_{\text{Riemann upper}}`,
    el,
    { displayMode: true, throwOnError: false }
  );
}

// ---- Compute f range -------------------------------------------
function getFRange(f) {
  let fMin = Infinity, fMax = -Infinity;
  for (let i = 0; i <= N_SAMPLE; i++) {
    const y = f(i / N_SAMPLE);
    if (y < fMin) fMin = y;
    if (y > fMax) fMax = y;
  }
  // Pad slightly
  const pad = (fMax - fMin) * 0.05 || 0.1;
  return { fMin: fMin - pad, fMax: fMax + pad, rawMin: fMin, rawMax: fMax };
}

// ---- Main draw --------------------------------------------------
function draw(transition = true) {
  const fnDef = FUNCTIONS[state.fnKey];
  const f = fnDef.f;
  const n = state.nPartitions;
  const m = state.sync ? n : state.mSlices;

  // Sample curve
  const curvePts = sampleFn(f, N_SAMPLE);
  const { fMin, fMax, rawMin, rawMax } = getFRange(f);

  // Update scales
  yScaleR.domain([fMin, fMax]);
  yScaleL.domain([fMin, fMax]);

  // ---- Riemann Panel ------------------------------------------
  const rs = riemannSums(f, n);

  // Axes
  gRAxisX.call(d3.axisBottom(xScale).ticks(5));
  gRAxisY.call(d3.axisLeft(yScaleR).ticks(6));

  // Upper rects
  const upperData = state.showUpper ? rs.rects : [];
  const upperSel = gRUpperRects.selectAll('rect').data(upperData, (_, i) => i);
  upperSel.exit().remove();
  const upperEnter = upperSel.enter().append('rect').attr('class', 'riemann-upper');
  upperEnter.merge(upperSel)
    .attr('x', d => xScale(d.a))
    .attr('width', d => xScale(d.b) - xScale(d.a))
    .attr('y', d => yScaleR(d.sup))
    .attr('height', d => yScaleR(fMin) - yScaleR(d.sup));

  // Lower rects
  const lowerData = state.showLower ? rs.rects : [];
  const lowerSel = gRLowerRects.selectAll('rect').data(lowerData, (_, i) => i);
  lowerSel.exit().remove();
  const lowerEnter = lowerSel.enter().append('rect').attr('class', 'riemann-lower');
  lowerEnter.merge(lowerSel)
    .attr('x', d => xScale(d.a))
    .attr('width', d => xScale(d.b) - xScale(d.a))
    .attr('y', d => yScaleR(d.inf))
    .attr('height', d => yScaleR(fMin) - yScaleR(d.inf));

  // Partition lines
  const partData = [];
  for (let i = 1; i < n; i++) partData.push(i / n);
  const partSel = gRPartitions.selectAll('line').data(partData, (_, i) => i);
  partSel.exit().remove();
  partSel.enter().append('line').attr('class', 'partition-line')
    .merge(partSel)
    .attr('x1', d => xScale(d)).attr('x2', d => xScale(d))
    .attr('y1', 0).attr('y2', innerH);

  // Curve
  const curveSel = gRCurve.selectAll('path.function-curve').data([curvePts]);
  curveSel.enter().append('path').attr('class', 'function-curve')
    .merge(curveSel)
    .attr('d', lineGen);

  // ---- Lebesgue Panel -----------------------------------------
  const ls = lebesgueSum(f, m, rawMin, rawMax);

  gLAxisX.call(d3.axisBottom(xScale).ticks(5));
  gLAxisY.call(d3.axisLeft(yScaleL).ticks(6));

  // Color scale
  const colorScale = d3.scaleSequential(d3.interpolateViridis).domain([0, m - 1]);

  // Preimage shading on x-axis
  const allPreimages = [];
  ls.slices.forEach((sl, j) => {
    sl.preimage.forEach(([a, b]) => {
      allPreimages.push({ a, b, j, yLo: sl.yLo, yHi: sl.yHi });
    });
  });

  const preSel = gLPreimages.selectAll('rect').data(allPreimages, (d, i) => `${d.j}-${i}`);
  preSel.exit().remove();
  preSel.enter().append('rect').attr('class', 'lebesgue-preimage')
    .merge(preSel)
    .attr('x', d => xScale(d.a))
    .attr('width', d => Math.max(0.5, xScale(d.b) - xScale(d.a)))
    .attr('y', d => yScaleL(d.yHi))
    .attr('height', d => Math.max(0.5, yScaleL(d.yLo) - yScaleL(d.yHi)))
    .attr('fill', d => colorScale(d.j))
    .attr('opacity', 0.4);

  // Horizontal slice lines
  const hLineData = [];
  for (let j = 0; j <= m; j++) {
    hLineData.push(rawMin + j * ((rawMax - rawMin) / m));
  }
  const hSel = gLHLines.selectAll('line').data(hLineData, (_, i) => i);
  hSel.exit().remove();
  hSel.enter().append('line').attr('class', 'partition-line')
    .merge(hSel)
    .attr('x1', 0).attr('x2', innerW)
    .attr('y1', d => yScaleL(d)).attr('y2', d => yScaleL(d));

  // Curve on Lebesgue panel
  const curveLSel = gLCurve.selectAll('path.function-curve').data([curvePts]);
  curveLSel.enter().append('path').attr('class', 'function-curve')
    .merge(curveLSel)
    .attr('d', lineGenL);

  // ---- Convergence Panel --------------------------------------
  drawConvergence(f, rawMin, rawMax, fnDef);

  // ---- Stats ---------------------------------------------------
  statRU.textContent = rs.upper.toFixed(6);
  statRL.textContent = rs.lower.toFixed(6);
  statLeb.textContent = ls.sum.toFixed(6);
  statExact.textContent = fnDef.exact.toFixed(6);
}

// ---- Convergence chart (cached per function) -------------------
let cachedConvKey = null;
let cachedConv = null;

function drawConvergence(f, fMin, fMax, fnDef) {
  const key = state.fnKey;
  if (cachedConvKey !== key) {
    cachedConv = convergenceData(f, fMin, fMax, fnDef.isDirichlet);
    cachedConvKey = key;
  }
  const { upperArr, lowerArr, lebArr } = cachedConv;

  // Y domain: include exact + all values
  const allVals = [...upperArr.map(d => d.value), ...lowerArr.map(d => d.value), ...lebArr.map(d => d.value), fnDef.exact];
  const yMin = d3.min(allVals), yMax = d3.max(allVals);
  const pad = (yMax - yMin) * 0.1 || 0.1;
  cyScale.domain([yMin - pad, yMax + pad]);

  gCAxisX.call(d3.axisBottom(cxScale).ticks(10));
  gCAxisY.call(d3.axisLeft(cyScale).ticks(6));

  // Lines
  const lines = [
    { data: upperArr, cls: 'upper-line', id: 'conv-upper' },
    { data: lowerArr, cls: 'lower-line', id: 'conv-lower' },
    { data: lebArr, cls: 'lebesgue-conv-line', id: 'conv-leb' },
  ];

  lines.forEach(({ data, cls, id }) => {
    let sel = gCLines.selectAll(`path.${cls}`).data([data]);
    sel.enter().append('path').attr('class', cls)
      .attr('fill', 'none')
      .merge(sel)
      .attr('d', convLine);
  });

  // Exact line
  let exactSel = gCLines.selectAll('line.exact-line').data([fnDef.exact]);
  exactSel.enter().append('line').attr('class', 'exact-line')
    .merge(exactSel)
    .attr('x1', 0).attr('x2', cInnerW)
    .attr('y1', d => cyScale(d)).attr('y2', d => cyScale(d));

  // Axis labels
  let xLabel = gC.selectAll('text.x-axis-label').data(['Partition size']);
  xLabel.enter().append('text').attr('class', 'x-axis-label axis-label')
    .attr('text-anchor', 'middle')
    .attr('x', cInnerW / 2).attr('y', cInnerH + 32)
    .merge(xLabel).text('Partition size');

  let yLabel = gC.selectAll('text.y-axis-label').data(['Sum value']);
  yLabel.enter().append('text').attr('class', 'y-axis-label axis-label')
    .attr('text-anchor', 'middle')
    .attr('transform', `translate(-32,${cInnerH / 2}) rotate(-90)`)
    .merge(yLabel).text('Sum value');

  // Marker for current partition
  const nCur = state.nPartitions;
  const mCur = state.sync ? nCur : state.mSlices;

  const markers = [
    { n: nCur, arr: upperArr, cls: 'marker-upper', fill: 'var(--color-primary)' },
    { n: nCur, arr: lowerArr, cls: 'marker-lower', fill: 'var(--color-secondary)' },
    { n: mCur, arr: lebArr, cls: 'marker-leb', fill: 'var(--viz-4)' },
  ];

  markers.forEach(({ n, arr, cls, fill }) => {
    const pt = arr.find(d => d.n === n);
    const data = pt ? [pt] : [];
    const sel = gCLines.selectAll(`circle.${cls}`).data(data);
    sel.exit().remove();
    sel.enter().append('circle').attr('class', cls).attr('r', 4).attr('fill', fill)
      .merge(sel)
      .attr('cx', d => cxScale(d.n))
      .attr('cy', d => cyScale(d.value));
  });
}

// ---- Wire controls ----------------------------------------------
selFn.addEventListener('change', () => {
  state.fnKey = selFn.value;
  cachedConvKey = null; // bust convergence cache
  draw();
});

sliderN.addEventListener('input', () => {
  state.nPartitions = +sliderN.value;
  valN.textContent = state.nPartitions;
  if (state.sync) {
    state.mSlices = state.nPartitions;
    sliderM.value = state.nPartitions;
    valM.textContent = state.nPartitions;
  }
  draw();
});

sliderM.addEventListener('input', () => {
  state.mSlices = +sliderM.value;
  valM.textContent = state.mSlices;
  draw();
});

chkUpper.addEventListener('change', () => { state.showUpper = chkUpper.checked; draw(); });
chkLower.addEventListener('change', () => { state.showLower = chkLower.checked; draw(); });

chkSync.addEventListener('change', () => {
  state.sync = chkSync.checked;
  if (state.sync) {
    state.mSlices = state.nPartitions;
    sliderM.value = state.nPartitions;
    valM.textContent = state.nPartitions;
    sliderM.disabled = true;
  } else {
    sliderM.disabled = false;
  }
  draw();
});

// Disable range slider initially when sync is on
sliderM.disabled = state.sync;

// ---- Animate refinement -----------------------------------------
btnAnimate.addEventListener('click', () => {
  if (state.animating) {
    cancelAnimationFrame(state.animId);
    state.animating = false;
    btnAnimate.textContent = 'Animate Refinement';
    return;
  }

  state.animating = true;
  btnAnimate.textContent = 'Stop';
  let current = 2;
  const speed = 40; // ms per step
  let lastTime = 0;

  function step(timestamp) {
    if (!state.animating) return;
    if (timestamp - lastTime < speed) {
      state.animId = requestAnimationFrame(step);
      return;
    }
    lastTime = timestamp;

    state.nPartitions = current;
    sliderN.value = current;
    valN.textContent = current;
    if (state.sync) {
      state.mSlices = current;
      sliderM.value = current;
      valM.textContent = current;
    }

    draw();
    current++;

    if (current > CONV_MAX) {
      state.animating = false;
      btnAnimate.textContent = 'Animate Refinement';
      return;
    }
    state.animId = requestAnimationFrame(step);
  }

  state.animId = requestAnimationFrame(step);
});

// ---- Initial draw ------------------------------------------------
renderKaTeX();
draw();
