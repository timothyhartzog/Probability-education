/* ============================================================
   Module 3.1 — Characteristic Function Gallery
   ============================================================
   Visualizes φ_X(t) = E[e^{itX}] in the complex plane, with
   real/imaginary decomposition and the underlying density/PMF.
   ============================================================ */

import * as d3 from 'd3';
import katex from 'katex';
import '../../lib/copy-code.js';
import '../../lib/param-tooltips.js';

/* ---- Constants ---------------------------------------------- */
const COMPLEX_W = 960, COMPLEX_H = 500;
const SMALL_W = 460, SMALL_H = 300;
const MARGIN = { top: 30, right: 30, bottom: 45, left: 55 };

/* ---- Distribution Registry ---------------------------------- */
const DISTRIBUTIONS = {
  normal: {
    label: 'Normal(μ, σ²)',
    param1: { name: 'μ', min: -3, max: 3, step: 0.1, default: 0 },
    param2: { name: 'σ', min: 0.1, max: 5, step: 0.1, default: 1 },
    continuous: true,
    cf(t, mu, sigma) {
      // φ(t) = exp(iμt - σ²t²/2)
      const phase = mu * t;
      const decay = Math.exp(-sigma * sigma * t * t / 2);
      return [decay * Math.cos(phase), decay * Math.sin(phase)];
    },
    pdf(x, mu, sigma) {
      const z = (x - mu) / sigma;
      return Math.exp(-z * z / 2) / (sigma * Math.sqrt(2 * Math.PI));
    },
    pdfRange(mu, sigma) { return [mu - 4 * sigma, mu + 4 * sigma]; },
    mean(mu) { return mu; },
    variance(_, sigma) { return sigma * sigma; }
  },

  uniform: {
    label: 'Uniform(a, b)',
    param1: { name: 'a', min: -3, max: 3, step: 0.1, default: -1 },
    param2: { name: 'b', min: -2.9, max: 6, step: 0.1, default: 1 },
    continuous: true,
    cf(t, a, b) {
      if (Math.abs(t) < 1e-12) return [1, 0];
      const denom = t * (b - a);
      // (e^{itb} - e^{ita}) / (it(b-a))
      const rNum = Math.cos(t * b) - Math.cos(t * a);
      const iNum = Math.sin(t * b) - Math.sin(t * a);
      // divide (rNum + i*iNum) by (i * denom) = divide by i*denom
      // (a+bi)/(ci) = (a+bi)*(-ci)/(c²) = (b/c) + (-a/c)i ... wait let me be careful
      // (rNum + i*iNum) / (i*denom) = (rNum + i*iNum)*(-i) / denom = (iNum - i*rNum) / denom
      return [iNum / denom, -rNum / denom];
    },
    pdf(x, a, b) {
      return (x >= a && x <= b) ? 1 / (b - a) : 0;
    },
    pdfRange(a, b) { return [a - 0.5, b + 0.5]; },
    mean(a, b) { return (a + b) / 2; },
    variance(a, b) { return (b - a) * (b - a) / 12; }
  },

  exponential: {
    label: 'Exponential(λ)',
    param1: { name: 'λ', min: 0.1, max: 5, step: 0.1, default: 1 },
    param2: null,
    continuous: true,
    cf(t, lam) {
      // φ(t) = λ/(λ - it) = λ(λ + it)/(λ² + t²)
      const d = lam * lam + t * t;
      return [lam * lam / d, lam * t / d];
    },
    pdf(x, lam) {
      return x >= 0 ? lam * Math.exp(-lam * x) : 0;
    },
    pdfRange(lam) { return [-0.5, 5 / lam + 1]; },
    mean(lam) { return 1 / lam; },
    variance(lam) { return 1 / (lam * lam); }
  },

  poisson: {
    label: 'Poisson(λ)',
    param1: { name: 'λ', min: 0.1, max: 20, step: 0.1, default: 3 },
    param2: null,
    continuous: false,
    cf(t, lam) {
      // φ(t) = exp(λ(e^{it} - 1))
      const rInner = lam * (Math.cos(t) - 1);
      const iInner = lam * Math.sin(t);
      const mag = Math.exp(rInner);
      return [mag * Math.cos(iInner), mag * Math.sin(iInner)];
    },
    pmf(k, lam) {
      // e^{-λ} λ^k / k!
      if (k < 0 || k !== Math.floor(k)) return 0;
      let logP = -lam + k * Math.log(lam) - lnFactorial(k);
      return Math.exp(logP);
    },
    pmfRange(lam) { return [0, Math.max(Math.ceil(lam + 4 * Math.sqrt(lam)), 10)]; },
    mean(lam) { return lam; },
    variance(lam) { return lam; }
  },

  cauchy: {
    label: 'Cauchy',
    param1: null,
    param2: null,
    continuous: true,
    cf(t) {
      // φ(t) = exp(-|t|)
      return [Math.exp(-Math.abs(t)), 0];
    },
    pdf(x) {
      return 1 / (Math.PI * (1 + x * x));
    },
    pdfRange() { return [-10, 10]; },
    mean() { return undefined; },
    variance() { return undefined; }
  },

  laplace: {
    label: 'Laplace(μ, b)',
    param1: { name: 'μ', min: -3, max: 3, step: 0.1, default: 0 },
    param2: { name: 'b', min: 0.1, max: 5, step: 0.1, default: 1 },
    continuous: true,
    cf(t, mu, b) {
      // φ(t) = e^{iμt} / (1 + b²t²)
      const denom = 1 + b * b * t * t;
      const re = Math.cos(mu * t) / denom;
      const im = Math.sin(mu * t) / denom;
      return [re, im];
    },
    pdf(x, mu, b) {
      return Math.exp(-Math.abs(x - mu) / b) / (2 * b);
    },
    pdfRange(mu, b) { return [mu - 6 * b, mu + 6 * b]; },
    mean(mu) { return mu; },
    variance(_, b) { return 2 * b * b; }
  },

  'chi-squared': {
    label: 'Chi-Squared(k)',
    param1: { name: 'k', min: 1, max: 20, step: 1, default: 3 },
    param2: null,
    continuous: true,
    cf(t, k) {
      // φ(t) = (1 - 2it)^{-k/2}
      // = (1 + 4t²)^{-k/4} * exp(i * (k/2) * atan2(2t, 1))
      const mag = Math.pow(1 + 4 * t * t, -k / 4);
      const arg = (k / 2) * Math.atan2(2 * t, 1);
      return [mag * Math.cos(arg), mag * Math.sin(arg)];
    },
    pdf(x, k) {
      if (x <= 0) return 0;
      // f(x) = x^{k/2-1} e^{-x/2} / (2^{k/2} Γ(k/2))
      const halfK = k / 2;
      const logP = (halfK - 1) * Math.log(x) - x / 2 - halfK * Math.log(2) - lnGamma(halfK);
      return Math.exp(logP);
    },
    pdfRange(k) { return [-0.5, Math.max(k + 4 * Math.sqrt(2 * k), 10)]; },
    mean(k) { return k; },
    variance(k) { return 2 * k; }
  },

  bernoulli: {
    label: 'Bernoulli(p)',
    param1: { name: 'p', min: 0, max: 1, step: 0.01, default: 0.5 },
    param2: null,
    continuous: false,
    cf(t, p) {
      // φ(t) = (1-p) + p·e^{it}
      return [1 - p + p * Math.cos(t), p * Math.sin(t)];
    },
    pmf(k, p) {
      if (k === 0) return 1 - p;
      if (k === 1) return p;
      return 0;
    },
    pmfRange() { return [0, 1]; },
    mean(p) { return p; },
    variance(p) { return p * (1 - p); }
  }
};

/* ---- Math helpers ------------------------------------------- */
function lnGamma(z) {
  // Lanczos approximation
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
  ];
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function lnFactorial(n) {
  if (n <= 1) return 0;
  return lnGamma(n + 1);
}

/* ---- DOM references ----------------------------------------- */
const distSelect = d3.select('#dist-select');
const param1Group = d3.select('#param1-group');
const param2Group = d3.select('#param2-group');
const param1Slider = d3.select('#param1');
const param2Slider = d3.select('#param2');
const param1Name = d3.select('#param1-name');
const param2Name = d3.select('#param2-name');
const param1Val = d3.select('#param1-val');
const param2Val = d3.select('#param2-val');
const tRangeSlider = d3.select('#t-range');
const tRangeVal = d3.select('#t-range-val');
const displayMode = d3.select('#display-mode');
const toggleMoments = d3.select('#toggle-moments');
const toggleAnimate = d3.select('#toggle-animate');

/* ---- State -------------------------------------------------- */
let state = {
  dist: 'normal',
  p1: 0,
  p2: 1,
  T: 10,
  mode: 'complex',
  showMoments: false,
  animate: false,
  animProgress: 0,
  animId: null
};

/* ---- SVG setup ---------------------------------------------- */
function createSVG(container, w, h) {
  return d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%')
    .style('height', 'auto');
}

const svgComplex = createSVG('#complex-chart', COMPLEX_W, COMPLEX_H);
const svgReIm = createSVG('#reim-chart', SMALL_W, SMALL_H);
const svgDensity = createSVG('#density-chart', SMALL_W, SMALL_H);

/* ---- Gradient definition for complex curve ------------------- */
const defs = svgComplex.append('defs');
const grad = defs.append('linearGradient')
  .attr('id', 'cf-gradient')
  .attr('gradientUnits', 'userSpaceOnUse');

/* ---- KaTeX rendering ---------------------------------------- */
try {
  katex.render(
    '\\varphi_X(t) = E[e^{itX}] = \\int_{-\\infty}^{\\infty} e^{itx}\\, dF_X(x)',
    document.getElementById('info-cf-def'),
    { displayMode: true, throwOnError: false }
  );
} catch (e) { /* graceful fallback */ }

/* ---- Compute CF data ---------------------------------------- */
function computeCFData(numPts) {
  const dist = DISTRIBUTIONS[state.dist];
  const T = state.T;
  const pts = [];
  for (let i = 0; i <= numPts; i++) {
    const t = -T + (2 * T * i) / numPts;
    const [re, im] = dist.cf(t, state.p1, state.p2);
    pts.push({ t, re, im, mod: Math.sqrt(re * re + im * im), arg: Math.atan2(im, re) });
  }
  return pts;
}

/* ============================================================
   Complex Plane Panel
   ============================================================ */
function drawComplexPlane() {
  svgComplex.selectAll('g.complex-content').remove();
  const g = svgComplex.append('g').attr('class', 'complex-content');

  const data = computeCFData(800);
  const mode = state.mode;

  if (mode === 'complex') {
    drawComplexParametric(g, data);
  } else {
    drawModArg(g, data);
  }
}

function drawComplexParametric(g, data) {
  const m = { top: 30, right: 30, bottom: 45, left: 55 };
  const w = COMPLEX_W - m.left - m.right;
  const h = COMPLEX_H - m.top - m.bottom;
  const inner = g.append('g').attr('transform', `translate(${m.left},${m.top})`);

  // Determine extent
  let reExt = d3.extent(data, d => d.re);
  let imExt = d3.extent(data, d => d.im);
  // Ensure unit circle is visible and some padding
  reExt = [Math.min(reExt[0], -1.2), Math.max(reExt[1], 1.2)];
  imExt = [Math.min(imExt[0], -1.2), Math.max(imExt[1], 1.2)];
  // Make symmetric if close
  const pad = 0.15;
  reExt[0] -= pad; reExt[1] += pad;
  imExt[0] -= pad; imExt[1] += pad;

  const xScale = d3.scaleLinear().domain(reExt).range([0, w]);
  const yScale = d3.scaleLinear().domain(imExt).range([h, 0]);

  // Axes
  inner.append('g').attr('class', 'axis')
    .attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(xScale).ticks(8));
  inner.append('g').attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(8));

  // Axis labels
  inner.append('text').attr('class', 'axis-label')
    .attr('x', w / 2).attr('y', h + 38).attr('text-anchor', 'middle').text('Re(φ)');
  inner.append('text').attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -h / 2).attr('y', -42).attr('text-anchor', 'middle').text('Im(φ)');

  // Reference lines through origin
  inner.append('line').attr('class', 'axis-ref')
    .attr('x1', xScale(reExt[0])).attr('x2', xScale(reExt[1]))
    .attr('y1', yScale(0)).attr('y2', yScale(0));
  inner.append('line').attr('class', 'axis-ref')
    .attr('x1', xScale(0)).attr('x2', xScale(0))
    .attr('y1', yScale(imExt[0])).attr('y2', yScale(imExt[1]));

  // Unit circle
  const cx = xScale(0), cy = yScale(0);
  const rx = Math.abs(xScale(1) - xScale(0));
  const ry = Math.abs(yScale(1) - yScale(0));
  inner.append('ellipse').attr('class', 'unit-circle')
    .attr('cx', cx).attr('cy', cy).attr('rx', rx).attr('ry', ry);

  // Build the parametric path with color gradient
  const lineData = state.animate
    ? data.slice(0, Math.floor(data.length * state.animProgress))
    : data;

  if (lineData.length < 2) {
    // If animating and not enough points yet, just draw the marker
  } else {
    // Draw segments with color
    const colorScale = d3.scaleSequential(d3.interpolateCool)
      .domain([-state.T, state.T]);

    // Draw as many small line segments
    const segGroup = inner.append('g');
    for (let i = 1; i < lineData.length; i++) {
      const prev = lineData[i - 1];
      const cur = lineData[i];
      segGroup.append('line')
        .attr('x1', xScale(prev.re)).attr('y1', yScale(prev.im))
        .attr('x2', xScale(cur.re)).attr('y2', yScale(cur.im))
        .attr('stroke', colorScale(cur.t))
        .attr('stroke-width', 2.5)
        .attr('stroke-linecap', 'round');
    }
  }

  // φ(0) = 1 marker
  inner.append('circle').attr('class', 'phi0-marker')
    .attr('cx', xScale(1)).attr('cy', yScale(0));

  // Origin marker
  inner.append('circle').attr('class', 'origin-marker')
    .attr('cx', xScale(0)).attr('cy', yScale(0));

  // Cursor at current animation point
  if (state.animate && lineData.length > 0) {
    const last = lineData[lineData.length - 1];
    inner.append('circle').attr('class', 'cf-cursor')
      .attr('cx', xScale(last.re)).attr('cy', yScale(last.im))
      .attr('fill', d3.interpolateCool(0.5 + 0.5 * state.animProgress));
  }

  // Moment markers
  if (state.showMoments) {
    drawMomentMarkers(inner, xScale, yScale);
  }
}

function drawModArg(g, data) {
  const m = { top: 30, right: 30, bottom: 45, left: 55 };
  const w = COMPLEX_W - m.left - m.right;
  const halfH = (COMPLEX_H - m.top - m.bottom - 30) / 2;

  // Top chart: |φ(t)|
  const gTop = g.append('g').attr('transform', `translate(${m.left},${m.top})`);
  const xScale = d3.scaleLinear().domain([-state.T, state.T]).range([0, w]);
  const yMod = d3.scaleLinear().domain([0, d3.max(data, d => d.mod) * 1.1 || 1]).range([halfH, 0]);

  gTop.append('g').attr('class', 'axis').attr('transform', `translate(0,${halfH})`)
    .call(d3.axisBottom(xScale).ticks(8));
  gTop.append('g').attr('class', 'axis').call(d3.axisLeft(yMod).ticks(5));
  gTop.append('text').attr('class', 'axis-label')
    .attr('x', w / 2).attr('y', halfH + 35).attr('text-anchor', 'middle').text('t');
  gTop.append('text').attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -halfH / 2).attr('y', -42).attr('text-anchor', 'middle').text('|φ(t)|');

  const modLine = d3.line().x(d => xScale(d.t)).y(d => yMod(d.mod)).curve(d3.curveLinear);
  gTop.append('path').attr('class', 'modulus-line')
    .attr('d', modLine(data)).style('stroke', 'var(--viz-4)').style('stroke-dasharray', 'none');

  // Bottom chart: arg(φ(t))
  const gBot = g.append('g').attr('transform', `translate(${m.left},${m.top + halfH + 30})`);
  const argExt = d3.extent(data, d => d.arg);
  const argPad = 0.3;
  const yArg = d3.scaleLinear()
    .domain([Math.min(argExt[0] - argPad, -Math.PI), Math.max(argExt[1] + argPad, Math.PI)])
    .range([halfH, 0]);

  gBot.append('g').attr('class', 'axis').attr('transform', `translate(0,${halfH})`)
    .call(d3.axisBottom(xScale).ticks(8));
  gBot.append('g').attr('class', 'axis').call(d3.axisLeft(yArg).ticks(5));
  gBot.append('text').attr('class', 'axis-label')
    .attr('x', w / 2).attr('y', halfH + 35).attr('text-anchor', 'middle').text('t');
  gBot.append('text').attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -halfH / 2).attr('y', -42).attr('text-anchor', 'middle').text('arg(φ(t))');

  const argLine = d3.line().x(d => xScale(d.t)).y(d => yArg(d.arg)).curve(d3.curveLinear);
  gBot.append('path')
    .attr('fill', 'none').attr('stroke', 'var(--viz-5)').attr('stroke-width', 2)
    .attr('d', argLine(data));
}

function drawMomentMarkers(inner, xScale, yScale) {
  const dist = DISTRIBUTIONS[state.dist];
  const m = dist.mean(state.p1, state.p2);
  const v = dist.variance(state.p1, state.p2);

  if (m === undefined) return; // e.g. Cauchy

  // Numerical derivative at t=0: φ'(0)/i = mean
  // Mark the mean on the complex plane as a tangent direction indicator
  // φ'(0) = i·mean, so the tangent at φ(0)=1 points in direction (0, mean)
  const markerG = inner.append('g').attr('class', 'moment-markers');

  // Mean marker: show a small arrow from (1,0) in direction of φ'(0)
  const arrowLen = 0.3;
  if (m !== undefined && isFinite(m)) {
    const dir = Math.min(Math.max(m, -3), 3); // clamp for display
    const normFactor = Math.abs(dir) > 0.01 ? arrowLen / Math.abs(dir) : 0;
    // φ'(0) = i*mean => tangent direction at t=0 is (0, mean)
    const dx = 0;
    const dy = dir * normFactor;

    markerG.append('line').attr('class', 'moment-line')
      .attr('x1', xScale(1)).attr('y1', yScale(0))
      .attr('x2', xScale(1 + dx)).attr('y2', yScale(0 + dy))
      .attr('stroke', 'var(--color-accent)');
    markerG.append('circle').attr('class', 'moment-marker')
      .attr('cx', xScale(1 + dx)).attr('cy', yScale(0 + dy))
      .attr('fill', 'var(--color-accent)').attr('stroke', '#fff');

    // Label
    markerG.append('text')
      .attr('x', xScale(1 + dx) + 10).attr('y', yScale(0 + dy) - 6)
      .attr('font-size', 11).attr('fill', 'var(--color-accent)')
      .attr('font-family', 'var(--font-heading)')
      .text(`mean=${m.toFixed(2)}`);
  }

  if (v !== undefined && isFinite(v)) {
    // Variance marker: show near φ(0) as text
    markerG.append('text')
      .attr('x', xScale(1) + 10).attr('y', yScale(0) + 18)
      .attr('font-size', 11).attr('fill', 'var(--viz-4)')
      .attr('font-family', 'var(--font-heading)')
      .text(`var=${v.toFixed(2)}`);
  }
}

/* ============================================================
   Re/Im Panel
   ============================================================ */
function drawReIm() {
  svgReIm.selectAll('g.reim-content').remove();
  const g = svgReIm.append('g').attr('class', 'reim-content');
  const m = MARGIN;
  const w = SMALL_W - m.left - m.right;
  const h = SMALL_H - m.top - m.bottom;
  const inner = g.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const data = computeCFData(400);

  const xScale = d3.scaleLinear().domain([-state.T, state.T]).range([0, w]);
  const reExt = d3.extent(data, d => d.re);
  const imExt = d3.extent(data, d => d.im);
  const yMin = Math.min(reExt[0], imExt[0], -0.1) - 0.1;
  const yMax = Math.max(reExt[1], imExt[1], 0.1) + 0.1;
  const yScale = d3.scaleLinear().domain([yMin, yMax]).range([h, 0]);

  // Axes
  inner.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(xScale).ticks(6));
  inner.append('g').attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(6));

  inner.append('text').attr('class', 'axis-label')
    .attr('x', w / 2).attr('y', h + 38).attr('text-anchor', 'middle').text('t');
  inner.append('text').attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -h / 2).attr('y', -42).attr('text-anchor', 'middle').text('Value');

  // Zero line
  inner.append('line').attr('class', 'axis-ref')
    .attr('x1', 0).attr('x2', w)
    .attr('y1', yScale(0)).attr('y2', yScale(0));

  const reLine = d3.line().x(d => xScale(d.t)).y(d => yScale(d.re)).curve(d3.curveLinear);
  const imLine = d3.line().x(d => xScale(d.t)).y(d => yScale(d.im)).curve(d3.curveLinear);

  inner.append('path').attr('class', 're-line').attr('d', reLine(data));
  inner.append('path').attr('class', 'im-line').attr('d', imLine(data));

  // Legend
  const legend = d3.select('#reim-legend');
  legend.html('');
  legend.append('span').style('color', 'var(--color-primary)').text('— Re(φ)');
  legend.append('span').style('margin-left', '16px').style('color', 'var(--color-secondary)').text('— Im(φ)');
}

/* ============================================================
   Density / PMF Panel
   ============================================================ */
function drawDensity() {
  svgDensity.selectAll('g.density-content').remove();
  const g = svgDensity.append('g').attr('class', 'density-content');
  const m = MARGIN;
  const w = SMALL_W - m.left - m.right;
  const h = SMALL_H - m.top - m.bottom;
  const inner = g.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const dist = DISTRIBUTIONS[state.dist];

  if (dist.continuous) {
    drawContinuousDensity(inner, dist, w, h);
  } else {
    drawDiscretePMF(inner, dist, w, h);
  }
}

function drawContinuousDensity(inner, dist, w, h) {
  const range = dist.pdfRange(state.p1, state.p2);
  const numPts = 300;
  const data = [];
  for (let i = 0; i <= numPts; i++) {
    const x = range[0] + (range[1] - range[0]) * i / numPts;
    data.push({ x, y: dist.pdf(x, state.p1, state.p2) });
  }

  const xScale = d3.scaleLinear().domain(range).range([0, w]);
  const yMax = d3.max(data, d => d.y) * 1.15 || 1;
  const yScale = d3.scaleLinear().domain([0, yMax]).range([h, 0]);

  inner.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(xScale).ticks(6));
  inner.append('g').attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(5));

  inner.append('text').attr('class', 'axis-label')
    .attr('x', w / 2).attr('y', h + 38).attr('text-anchor', 'middle').text('x');
  inner.append('text').attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -h / 2).attr('y', -42).attr('text-anchor', 'middle').text('f(x)');

  // Area
  const area = d3.area()
    .x(d => xScale(d.x)).y0(h).y1(d => yScale(d.y))
    .curve(d3.curveLinear);
  inner.append('path').attr('class', 'density-area')
    .attr('d', area(data)).attr('fill', 'var(--color-primary)');

  // Line
  const line = d3.line().x(d => xScale(d.x)).y(d => yScale(d.y)).curve(d3.curveLinear);
  inner.append('path').attr('class', 'density-line')
    .attr('d', line(data)).attr('stroke', 'var(--color-primary)');
}

function drawDiscretePMF(inner, dist, w, h) {
  const range = dist.pmfRange(state.p1, state.p2);
  const kMin = Math.floor(range[0]);
  const kMax = Math.ceil(range[1]);
  const data = [];
  for (let k = kMin; k <= kMax; k++) {
    const p = dist.pmf(k, state.p1, state.p2);
    if (p > 1e-10) data.push({ k, p });
  }

  const xScale = d3.scaleBand()
    .domain(data.map(d => d.k))
    .range([0, w])
    .padding(0.3);
  const yMax = d3.max(data, d => d.p) * 1.15 || 1;
  const yScale = d3.scaleLinear().domain([0, yMax]).range([h, 0]);

  inner.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(xScale).tickValues(
      data.filter((_, i) => data.length <= 20 || i % Math.ceil(data.length / 15) === 0).map(d => d.k)
    ));
  inner.append('g').attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(5));

  inner.append('text').attr('class', 'axis-label')
    .attr('x', w / 2).attr('y', h + 38).attr('text-anchor', 'middle').text('k');
  inner.append('text').attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -h / 2).attr('y', -42).attr('text-anchor', 'middle').text('P(X=k)');

  inner.selectAll('.pmf-bar')
    .data(data).enter()
    .append('rect').attr('class', 'pmf-bar')
    .attr('x', d => xScale(d.k))
    .attr('y', d => yScale(d.p))
    .attr('width', xScale.bandwidth())
    .attr('height', d => h - yScale(d.p))
    .attr('fill', 'var(--color-primary)');
}

/* ============================================================
   Stats
   ============================================================ */
function updateStats() {
  const dist = DISTRIBUTIONS[state.dist];
  d3.select('#stat-phi0').text('1.00');

  const m = dist.mean(state.p1, state.p2);
  const v = dist.variance(state.p1, state.p2);
  d3.select('#stat-mean').text(m !== undefined && isFinite(m) ? m.toFixed(3) : '—');
  d3.select('#stat-var').text(v !== undefined && isFinite(v) ? v.toFixed(3) : '—');
}

/* ============================================================
   Controls wiring
   ============================================================ */
function configureParams() {
  const dist = DISTRIBUTIONS[state.dist];

  if (dist.param1) {
    param1Group.style('display', null);
    const p = dist.param1;
    param1Name.html(p.name);
    param1Slider.attr('min', p.min).attr('max', p.max).attr('step', p.step).property('value', p.default);
    state.p1 = p.default;
    param1Val.text(p.default);
  } else {
    param1Group.style('display', 'none');
    state.p1 = 0;
  }

  if (dist.param2) {
    param2Group.style('display', null);
    const p = dist.param2;
    param2Name.html(p.name);
    param2Slider.attr('min', p.min).attr('max', p.max).attr('step', p.step).property('value', p.default);
    state.p2 = p.default;
    param2Val.text(p.default);
  } else {
    param2Group.style('display', 'none');
    state.p2 = 0;
  }
}

function updateAll() {
  drawComplexPlane();
  drawReIm();
  drawDensity();
  updateStats();
}

// Distribution change
distSelect.on('change', function () {
  state.dist = this.value;
  configureParams();
  stopAnimation();
  updateAll();
});

// Param sliders
param1Slider.on('input', function () {
  state.p1 = +this.value;
  param1Val.text(state.p1);
  // For uniform, enforce b > a
  if (state.dist === 'uniform') {
    const minB = state.p1 + 0.1;
    param2Slider.attr('min', minB);
    if (state.p2 < minB) {
      state.p2 = minB;
      param2Slider.property('value', minB);
      param2Val.text(minB.toFixed(1));
    }
  }
  updateAll();
});

param2Slider.on('input', function () {
  state.p2 = +this.value;
  param2Val.text(state.p2);
  updateAll();
});

// T range
tRangeSlider.on('input', function () {
  state.T = +this.value;
  tRangeVal.text(state.T);
  updateAll();
});

// Display mode
displayMode.on('change', function () {
  state.mode = this.value;
  // Update subtitle
  d3.select('#complex-subtitle').text(
    state.mode === 'complex'
      ? 'Parametric curve (φ(t)) as t varies'
      : '|φ(t)| and arg(φ(t)) vs. t'
  );
  d3.select('#complex-panel .viz-title').text(
    state.mode === 'complex'
      ? 'Characteristic Function in Complex Plane'
      : 'Modulus & Argument'
  );
  updateAll();
});

// Moments toggle
toggleMoments.on('change', function () {
  state.showMoments = this.checked;
  drawComplexPlane();
});

// Animate toggle
toggleAnimate.on('change', function () {
  state.animate = this.checked;
  if (state.animate) {
    startAnimation();
  } else {
    stopAnimation();
    updateAll();
  }
});

/* ============================================================
   Animation
   ============================================================ */
function startAnimation() {
  state.animProgress = 0;
  const duration = 4000; // ms for full sweep
  let startTime = null;

  function step(ts) {
    if (!state.animate) return;
    if (!startTime) startTime = ts;
    const elapsed = ts - startTime;
    state.animProgress = Math.min(elapsed / duration, 1);
    drawComplexPlane();

    if (state.animProgress < 1) {
      state.animId = requestAnimationFrame(step);
    } else {
      // Loop
      startTime = null;
      state.animId = requestAnimationFrame(step);
    }
  }
  state.animId = requestAnimationFrame(step);
}

function stopAnimation() {
  state.animate = false;
  toggleAnimate.property('checked', false);
  if (state.animId) {
    cancelAnimationFrame(state.animId);
    state.animId = null;
  }
  state.animProgress = 0;
}

/* ============================================================
   Initialization
   ============================================================ */
configureParams();
updateAll();
