/* ============================================================
   Module 8.2 — MCMC Sampling Explorer
   Metropolis-Hastings in action: trace plots, acceptance rates,
   autocorrelation, and convergence diagnostics.
   ============================================================ */

import * as d3 from 'd3';
import katex from 'katex';
import '../../lib/copy-code.js';
import '../../lib/param-tooltips.js';

/* ─── Seeded PRNG (mulberry32) ──────────────────────────────── */

function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ─── Normal sampling (Box-Muller) ──────────────────────────── */

function normalSample(rng, mu = 0, sigma = 1) {
  let u, v, s;
  do {
    u = 2 * rng() - 1;
    v = 2 * rng() - 1;
    s = u * u + v * v;
  } while (s >= 1 || s === 0);
  return mu + sigma * u * Math.sqrt(-2 * Math.log(s) / s);
}

/* ─── Standard normal PDF / CDF ─────────────────────────────── */

const SQRT2PI = Math.sqrt(2 * Math.PI);

function normalPDF(x, mu = 0, sigma = 1) {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (SQRT2PI * sigma);
}

function normalCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2);
  return 0.5 * (1 + sign * y);
}

/* ─── Target Distributions ──────────────────────────────────── */

const TARGETS = {
  normal: {
    label: 'Standard Normal',
    logDensity(x) { return -0.5 * x * x; },
    density(x) { return Math.exp(-0.5 * x * x) / SQRT2PI; },
    support: [-6, 6],
    trueMean: 0,
    trueVar: 1,
    trueCDF(x) { return normalCDF(x); },
  },
  bimodal: {
    label: 'Bimodal Mixture',
    logDensity(x) {
      const c1 = 0.3 * Math.exp(-0.5 * (x + 3) * (x + 3));
      const c2 = 0.7 * Math.exp(-0.5 * (x - 3) * (x - 3));
      return Math.log(c1 + c2);
    },
    density(x) {
      return 0.3 * normalPDF(x, -3, 1) + 0.7 * normalPDF(x, 3, 1);
    },
    support: [-8, 8],
    trueMean: 0.3 * (-3) + 0.7 * 3,
    trueVar: 0.3 * (1 + 9) + 0.7 * (1 + 9) - (0.3 * (-3) + 0.7 * 3) ** 2,
    trueCDF(x) {
      return 0.3 * normalCDF(x + 3) + 0.7 * normalCDF(x - 3);
    },
  },
  cauchy: {
    label: 'Cauchy (Heavy-tailed)',
    logDensity(x) { return -Math.log(1 + x * x); },
    density(x) { return 1 / (Math.PI * (1 + x * x)); },
    support: [-15, 15],
    trueMean: 0,
    trueVar: Infinity,
    trueCDF(x) { return 0.5 + Math.atan(x) / Math.PI; },
  },
  gamma: {
    label: 'Gamma-like (k=3)',
    logDensity(x) {
      if (x <= 0) return -Infinity;
      return 2 * Math.log(x) - x;  // k-1=2, k=3
    },
    density(x) {
      if (x <= 0) return 0;
      // Gamma(3,1) PDF: x^2 * exp(-x) / 2
      return x * x * Math.exp(-x) / 2;
    },
    support: [-0.5, 15],
    trueMean: 3,
    trueVar: 3,
    trueCDF(x) {
      // Gamma(3,1) CDF: 1 - e^(-x)(1 + x + x^2/2)
      if (x <= 0) return 0;
      return 1 - Math.exp(-x) * (1 + x + x * x / 2);
    },
  },
  multimodal: {
    label: 'Custom 3-Component',
    logDensity(x) {
      const c1 = 0.4 * Math.exp(-0.5 * ((x + 4) / 0.8) ** 2);
      const c2 = 0.35 * Math.exp(-0.5 * (x / 1.2) ** 2);
      const c3 = 0.25 * Math.exp(-0.5 * ((x - 5) / 0.6) ** 2);
      return Math.log(c1 + c2 + c3 + 1e-300);
    },
    density(x) {
      return 0.4 * normalPDF(x, -4, 0.8)
           + 0.35 * normalPDF(x, 0, 1.2)
           + 0.25 * normalPDF(x, 5, 0.6);
    },
    support: [-8, 9],
    trueMean: 0.4 * (-4) + 0.35 * 0 + 0.25 * 5,
    trueVar: (function () {
      const m = 0.4 * (-4) + 0.35 * 0 + 0.25 * 5;
      return 0.4 * (0.64 + 16) + 0.35 * (1.44 + 0) + 0.25 * (0.36 + 25) - m * m;
    })(),
    trueCDF(x) {
      return 0.4 * normalCDF((x + 4) / 0.8)
           + 0.35 * normalCDF(x / 1.2)
           + 0.25 * normalCDF((x - 5) / 0.6);
    },
  },
};

/* ─── State ─────────────────────────────────────────────────── */

const state = {
  targetKey: 'normal',
  proposalSd: 1.0,
  numSamples: 2000,
  burnIn: 200,
  thinning: 1,
  seed: 42,
  // MCMC chain results
  chain: [],
  accepted: [],
  runningAcceptRate: [],
};

function getTarget() { return TARGETS[state.targetKey]; }

/* ─── Metropolis-Hastings Sampler ───────────────────────────── */

function runMH(numSteps, startX) {
  const rng = mulberry32(state.seed);
  const target = getTarget();
  const chain = [startX !== undefined ? startX : 0];
  const accepted = [true];

  for (let i = 1; i < numSteps; i++) {
    const current = chain[i - 1];
    const proposal = normalSample(rng, current, state.proposalSd);
    const logAlpha = target.logDensity(proposal) - target.logDensity(current);
    const u = rng();

    if (Math.log(u) < logAlpha) {
      chain.push(proposal);
      accepted.push(true);
    } else {
      chain.push(current);
      accepted.push(false);
    }
  }

  return { chain, accepted };
}

function computeRunningAcceptRate(accepted) {
  const rates = [];
  let count = 0;
  for (let i = 0; i < accepted.length; i++) {
    if (accepted[i]) count++;
    rates.push(count / (i + 1));
  }
  return rates;
}

function runSampler() {
  const target = getTarget();
  const startX = (target.support[0] + target.support[1]) / 2;
  const result = runMH(state.numSamples, startX);
  state.chain = result.chain;
  state.accepted = result.accepted;
  state.runningAcceptRate = computeRunningAcceptRate(result.accepted);
}

function stepForward() {
  if (state.chain.length === 0) {
    const target = getTarget();
    const startX = (target.support[0] + target.support[1]) / 2;
    state.chain = [startX];
    state.accepted = [true];
    state.runningAcceptRate = [1];
    return;
  }

  const rng = mulberry32(state.seed + state.chain.length * 7919);
  const target = getTarget();
  const current = state.chain[state.chain.length - 1];
  const proposal = normalSample(rng, current, state.proposalSd);
  const logAlpha = target.logDensity(proposal) - target.logDensity(current);
  const u = rng();

  if (Math.log(u) < logAlpha) {
    state.chain.push(proposal);
    state.accepted.push(true);
  } else {
    state.chain.push(current);
    state.accepted.push(false);
  }

  state.runningAcceptRate = computeRunningAcceptRate(state.accepted);
}

/* ─── Post-processing helpers ───────────────────────────────── */

function getPostBurnIn() {
  const burn = Math.min(state.burnIn, state.chain.length);
  const raw = state.chain.slice(burn);
  if (state.thinning <= 1) return raw;
  const thinned = [];
  for (let i = 0; i < raw.length; i += state.thinning) {
    thinned.push(raw[i]);
  }
  return thinned;
}

function computeACF(samples, maxLag) {
  const n = samples.length;
  if (n < 2) return [];
  let mean = 0;
  for (let i = 0; i < n; i++) mean += samples[i];
  mean /= n;

  let c0 = 0;
  for (let i = 0; i < n; i++) c0 += (samples[i] - mean) ** 2;
  c0 /= n;
  if (c0 === 0) return new Array(maxLag).fill(0);

  const acf = [];
  for (let lag = 1; lag <= maxLag; lag++) {
    let ck = 0;
    for (let i = 0; i < n - lag; i++) {
      ck += (samples[i] - mean) * (samples[i + lag] - mean);
    }
    ck /= n;
    acf.push(ck / c0);
  }
  return acf;
}

function computeESS(samples) {
  const n = samples.length;
  if (n < 2) return n;
  const acf = computeACF(samples, Math.min(200, Math.floor(n / 2)));
  let tauSum = 0;
  for (let i = 0; i < acf.length; i++) {
    if (acf[i] < 0.05) break;
    tauSum += acf[i];
  }
  const ess = n / (1 + 2 * tauSum);
  return Math.max(1, Math.min(n, ess));
}

function computeKS(samples) {
  const target = getTarget();
  if (!target.trueCDF) return NaN;
  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return NaN;
  let maxD = 0;
  for (let i = 0; i < n; i++) {
    const Fn = (i + 1) / n;
    const FnMinus = i / n;
    const Fx = target.trueCDF(sorted[i]);
    maxD = Math.max(maxD, Math.abs(Fn - Fx), Math.abs(FnMinus - Fx));
  }
  return maxD;
}

/* ─── Chart Dimensions Helper ───────────────────────────────── */

const MARGIN = { top: 20, right: 20, bottom: 35, left: 50 };
const SMALL_MARGIN = { top: 15, right: 15, bottom: 30, left: 45 };

function dims(el, margin) {
  const w = el.clientWidth || 500;
  const h = el.clientHeight || 300;
  return {
    width: Math.max(w - margin.left - margin.right, 60),
    height: Math.max(h - margin.top - margin.bottom, 60),
    fullW: w,
    fullH: h,
    margin,
  };
}

/* ─── Panel 1: Target Distribution + Samples ────────────────── */

let targetSvg, targetG;

function initTargetPlot() {
  const el = document.getElementById('target-plot');
  el.innerHTML = '';
  const d = dims(el, MARGIN);

  targetSvg = d3.select(el).append('svg')
    .attr('viewBox', `0 0 ${d.fullW} ${d.fullH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  targetG = targetSvg.append('g')
    .attr('transform', `translate(${d.margin.left},${d.margin.top})`);

  targetG.append('g').attr('class', 'axis x-axis');
  targetG.append('g').attr('class', 'axis y-axis');
  targetG.append('g').attr('class', 'sample-bars-group');
  targetG.append('path').attr('class', 'target-curve');
  targetG.append('circle').attr('class', 'mcmc-current');
}

function updateTargetPlot() {
  const el = document.getElementById('target-plot');
  const d = dims(el, MARGIN);
  const target = getTarget();

  targetSvg.attr('viewBox', `0 0 ${d.fullW} ${d.fullH}`);
  targetG.attr('transform', `translate(${d.margin.left},${d.margin.top})`);

  const [xLo, xHi] = target.support;
  const x = d3.scaleLinear().domain([xLo, xHi]).range([0, d.width]);

  // Compute target curve
  const nPts = 300;
  const curveData = [];
  let yMaxCurve = 0;
  for (let i = 0; i <= nPts; i++) {
    const xv = xLo + (xHi - xLo) * i / nPts;
    const yv = target.density(xv);
    curveData.push({ x: xv, y: yv });
    if (yv > yMaxCurve) yMaxCurve = yv;
  }

  // Histogram of post burn-in samples
  const postSamples = getPostBurnIn();
  const binner = d3.bin().domain([xLo, xHi]).thresholds(50);
  const bins = binner(postSamples);
  const totalN = postSamples.length;
  bins.forEach(b => {
    b.density = totalN > 0 ? b.length / (totalN * Math.max(b.x1 - b.x0, 1e-6)) : 0;
  });

  const yMaxHist = d3.max(bins, b => b.density) || 0;
  const yMax = Math.max(yMaxCurve * 1.1, yMaxHist * 1.05, 0.1);
  const y = d3.scaleLinear().domain([0, yMax]).nice().range([d.height, 0]);

  // Axes
  targetG.select('.x-axis')
    .attr('transform', `translate(0,${d.height})`)
    .transition().duration(200)
    .call(d3.axisBottom(x).ticks(8));

  targetG.select('.y-axis')
    .transition().duration(200)
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.2f')));

  // Sample histogram bars
  const barSel = targetG.select('.sample-bars-group')
    .selectAll('.sample-bar').data(bins);
  barSel.exit().remove();
  barSel.enter().append('rect').attr('class', 'sample-bar')
    .merge(barSel)
    .transition().duration(200)
    .attr('x', b => x(b.x0) + 0.5)
    .attr('y', b => y(b.density))
    .attr('width', b => Math.max(0, x(b.x1) - x(b.x0) - 1))
    .attr('height', b => Math.max(0, d.height - y(b.density)));

  // Target density curve
  const line = d3.line()
    .x(p => x(p.x))
    .y(p => y(p.y))
    .curve(d3.curveBasis);

  targetG.select('.target-curve')
    .datum(curveData)
    .transition().duration(200)
    .attr('d', line);

  // Current position marker
  if (state.chain.length > 0) {
    const currentX = state.chain[state.chain.length - 1];
    const currentY = target.density(currentX);
    targetG.select('.mcmc-current')
      .attr('cx', x(Math.max(xLo, Math.min(xHi, currentX))))
      .attr('cy', y(Math.min(currentY, yMax)))
      .attr('r', 5)
      .attr('opacity', 1);
  } else {
    targetG.select('.mcmc-current').attr('opacity', 0);
  }

  // Subtitle update
  document.getElementById('target-subtitle').textContent =
    `${target.label} with ${postSamples.length} post-burn-in samples`;
}

/* ─── Panel 2: Trace Plot ───────────────────────────────────── */

let traceSvg, traceG;

function initTracePlot() {
  const el = document.getElementById('trace-plot');
  el.innerHTML = '';
  const d = dims(el, SMALL_MARGIN);

  traceSvg = d3.select(el).append('svg')
    .attr('viewBox', `0 0 ${d.fullW} ${d.fullH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  traceG = traceSvg.append('g')
    .attr('transform', `translate(${d.margin.left},${d.margin.top})`);

  traceG.append('rect').attr('class', 'burnin-zone');
  traceG.append('text').attr('class', 'burnin-label');
  traceG.append('g').attr('class', 'axis x-axis');
  traceG.append('g').attr('class', 'axis y-axis');
  traceG.append('path').attr('class', 'trace-line');
}

function updateTracePlot() {
  const el = document.getElementById('trace-plot');
  const d = dims(el, SMALL_MARGIN);
  const chain = state.chain;
  if (chain.length === 0) return;

  traceSvg.attr('viewBox', `0 0 ${d.fullW} ${d.fullH}`);
  traceG.attr('transform', `translate(${d.margin.left},${d.margin.top})`);

  const n = chain.length;
  const x = d3.scaleLinear().domain([0, n - 1]).range([0, d.width]);
  const yExt = d3.extent(chain);
  const yPad = (yExt[1] - yExt[0]) * 0.05 || 1;
  const y = d3.scaleLinear()
    .domain([yExt[0] - yPad, yExt[1] + yPad])
    .range([d.height, 0]);

  // Burn-in zone
  const burnWidth = x(Math.min(state.burnIn, n - 1));
  traceG.select('.burnin-zone')
    .attr('x', 0).attr('y', 0)
    .attr('width', Math.max(0, burnWidth))
    .attr('height', d.height);

  traceG.select('.burnin-label')
    .attr('x', Math.min(burnWidth / 2, d.width * 0.15))
    .attr('y', 12)
    .attr('text-anchor', 'middle')
    .text(state.burnIn > 0 ? 'burn-in' : '');

  // Axes
  traceG.select('.x-axis')
    .attr('transform', `translate(0,${d.height})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')));

  traceG.select('.y-axis')
    .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('.1f')));

  // Subsample for performance when chain is very long
  const maxPts = 2000;
  const step = Math.max(1, Math.floor(n / maxPts));
  const lineData = [];
  for (let i = 0; i < n; i += step) {
    lineData.push({ i, val: chain[i] });
  }
  if (lineData[lineData.length - 1].i !== n - 1) {
    lineData.push({ i: n - 1, val: chain[n - 1] });
  }

  const line = d3.line()
    .x(p => x(p.i))
    .y(p => y(p.val))
    .curve(d3.curveLinear);

  traceG.select('.trace-line')
    .datum(lineData)
    .attr('d', line);
}

/* ─── Panel 3: Autocorrelation ──────────────────────────────── */

let acfSvg, acfG;

function initACFPlot() {
  const el = document.getElementById('acf-plot');
  el.innerHTML = '';
  const d = dims(el, SMALL_MARGIN);

  acfSvg = d3.select(el).append('svg')
    .attr('viewBox', `0 0 ${d.fullW} ${d.fullH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  acfG = acfSvg.append('g')
    .attr('transform', `translate(${d.margin.left},${d.margin.top})`);

  acfG.append('g').attr('class', 'axis x-axis');
  acfG.append('g').attr('class', 'axis y-axis');
  acfG.append('line').attr('class', 'acf-ci acf-ci-upper');
  acfG.append('line').attr('class', 'acf-ci acf-ci-lower');
  acfG.append('g').attr('class', 'acf-bars-group');
}

function updateACFPlot() {
  const el = document.getElementById('acf-plot');
  const d = dims(el, SMALL_MARGIN);
  const postSamples = getPostBurnIn();
  const maxLag = 40;
  const acf = computeACF(postSamples, maxLag);

  acfSvg.attr('viewBox', `0 0 ${d.fullW} ${d.fullH}`);
  acfG.attr('transform', `translate(${d.margin.left},${d.margin.top})`);

  const x = d3.scaleBand()
    .domain(d3.range(1, maxLag + 1))
    .range([0, d.width])
    .padding(0.15);

  const yMin = Math.min(-0.3, d3.min(acf) || 0);
  const yMax = Math.max(1.0, d3.max(acf) || 0);
  const y = d3.scaleLinear().domain([yMin, yMax]).nice().range([d.height, 0]);

  // Axes
  acfG.select('.x-axis')
    .attr('transform', `translate(0,${d.height})`)
    .call(d3.axisBottom(x).tickValues([1, 5, 10, 15, 20, 25, 30, 35, 40]));

  acfG.select('.y-axis')
    .call(d3.axisLeft(y).ticks(5));

  // 95% CI lines
  const ci = 1.96 / Math.sqrt(Math.max(postSamples.length, 1));
  acfG.select('.acf-ci-upper')
    .attr('x1', 0).attr('x2', d.width)
    .attr('y1', y(ci)).attr('y2', y(ci));
  acfG.select('.acf-ci-lower')
    .attr('x1', 0).attr('x2', d.width)
    .attr('y1', y(-ci)).attr('y2', y(-ci));

  // Bars
  const data = acf.map((v, i) => ({ lag: i + 1, value: v }));
  const bars = acfG.select('.acf-bars-group')
    .selectAll('.acf-bar').data(data, d => d.lag);
  bars.exit().remove();
  bars.enter().append('rect')
    .attr('class', d => `acf-bar${d.value < 0 ? ' negative' : ''}`)
    .merge(bars)
    .attr('class', d => `acf-bar${d.value < 0 ? ' negative' : ''}`)
    .transition().duration(150)
    .attr('x', d => x(d.lag))
    .attr('width', x.bandwidth())
    .attr('y', d => d.value >= 0 ? y(d.value) : y(0))
    .attr('height', d => Math.abs(y(0) - y(d.value)));
}

/* ─── Panel 4: Marginal Histogram ───────────────────────────── */

let histSvg, histG;

function initHistogramPlot() {
  const el = document.getElementById('histogram-plot');
  el.innerHTML = '';
  const d = dims(el, SMALL_MARGIN);

  histSvg = d3.select(el).append('svg')
    .attr('viewBox', `0 0 ${d.fullW} ${d.fullH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  histG = histSvg.append('g')
    .attr('transform', `translate(${d.margin.left},${d.margin.top})`);

  histG.append('g').attr('class', 'axis x-axis');
  histG.append('g').attr('class', 'axis y-axis');
  histG.append('g').attr('class', 'hist-bars-group');
  histG.append('path').attr('class', 'target-curve');
}

function updateHistogramPlot() {
  const el = document.getElementById('histogram-plot');
  const d = dims(el, SMALL_MARGIN);
  const target = getTarget();
  const postSamples = getPostBurnIn();

  histSvg.attr('viewBox', `0 0 ${d.fullW} ${d.fullH}`);
  histG.attr('transform', `translate(${d.margin.left},${d.margin.top})`);

  const [xLo, xHi] = target.support;
  const x = d3.scaleLinear().domain([xLo, xHi]).range([0, d.width]);

  // Histogram
  const binner = d3.bin().domain([xLo, xHi]).thresholds(40);
  const bins = binner(postSamples);
  const totalN = postSamples.length;
  bins.forEach(b => {
    b.density = totalN > 0 ? b.length / (totalN * Math.max(b.x1 - b.x0, 1e-6)) : 0;
  });

  // True density curve
  const nPts = 200;
  const curveData = [];
  let yMaxCurve = 0;
  for (let i = 0; i <= nPts; i++) {
    const xv = xLo + (xHi - xLo) * i / nPts;
    const yv = target.density(xv);
    curveData.push({ x: xv, y: yv });
    if (yv > yMaxCurve) yMaxCurve = yv;
  }

  const yMaxHist = d3.max(bins, b => b.density) || 0;
  const yMax = Math.max(yMaxCurve * 1.1, yMaxHist * 1.05, 0.1);
  const y = d3.scaleLinear().domain([0, yMax]).nice().range([d.height, 0]);

  // Axes
  histG.select('.x-axis')
    .attr('transform', `translate(0,${d.height})`)
    .call(d3.axisBottom(x).ticks(6));

  histG.select('.y-axis')
    .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('.2f')));

  // Bars
  const barSel = histG.select('.hist-bars-group')
    .selectAll('.sample-bar').data(bins);
  barSel.exit().remove();
  barSel.enter().append('rect').attr('class', 'sample-bar')
    .merge(barSel)
    .transition().duration(150)
    .attr('x', b => x(b.x0) + 0.5)
    .attr('y', b => y(b.density))
    .attr('width', b => Math.max(0, x(b.x1) - x(b.x0) - 1))
    .attr('height', b => Math.max(0, d.height - y(b.density)));

  // True density curve
  const line = d3.line()
    .x(p => x(p.x))
    .y(p => y(p.y))
    .curve(d3.curveBasis);

  histG.select('.target-curve')
    .datum(curveData)
    .attr('d', line);
}

/* ─── Panel 5: Running Acceptance Rate ──────────────────────── */

let accSvg, accG;

function initAcceptancePlot() {
  const el = document.getElementById('acceptance-plot');
  el.innerHTML = '';
  const d = dims(el, SMALL_MARGIN);

  accSvg = d3.select(el).append('svg')
    .attr('viewBox', `0 0 ${d.fullW} ${d.fullH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  accG = accSvg.append('g')
    .attr('transform', `translate(${d.margin.left},${d.margin.top})`);

  accG.append('g').attr('class', 'axis x-axis');
  accG.append('g').attr('class', 'axis y-axis');
  accG.append('line').attr('class', 'optimal-line');
  accG.append('text').attr('class', 'burnin-label optimal-label');
  accG.append('path').attr('class', 'acceptance-line');
}

function updateAcceptancePlot() {
  const el = document.getElementById('acceptance-plot');
  const d = dims(el, SMALL_MARGIN);
  const rates = state.runningAcceptRate;
  if (rates.length === 0) return;

  accSvg.attr('viewBox', `0 0 ${d.fullW} ${d.fullH}`);
  accG.attr('transform', `translate(${d.margin.left},${d.margin.top})`);

  const n = rates.length;
  const x = d3.scaleLinear().domain([0, n - 1]).range([0, d.width]);
  const y = d3.scaleLinear().domain([0, 1]).range([d.height, 0]);

  // Axes
  accG.select('.x-axis')
    .attr('transform', `translate(0,${d.height})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')));

  accG.select('.y-axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.0%')));

  // Optimal line at 0.234
  accG.select('.optimal-line')
    .attr('x1', 0).attr('x2', d.width)
    .attr('y1', y(0.234)).attr('y2', y(0.234));

  accG.select('.optimal-label')
    .attr('x', d.width - 4)
    .attr('y', y(0.234) - 4)
    .attr('text-anchor', 'end')
    .text('optimal ~0.234');

  // Subsample for performance
  const maxPts = 1500;
  const step = Math.max(1, Math.floor(n / maxPts));
  const lineData = [];
  for (let i = 0; i < n; i += step) {
    lineData.push({ i, rate: rates[i] });
  }
  if (lineData[lineData.length - 1].i !== n - 1) {
    lineData.push({ i: n - 1, rate: rates[n - 1] });
  }

  const line = d3.line()
    .x(p => x(p.i))
    .y(p => y(p.rate))
    .curve(d3.curveLinear);

  accG.select('.acceptance-line')
    .datum(lineData)
    .attr('d', line);
}

/* ─── Controls ──────────────────────────────────────────────── */

function buildControls() {
  const controls = document.getElementById('controls');

  // Target distribution dropdown
  const targetDiv = document.getElementById('target-select');
  targetDiv.innerHTML = '';
  const tLabel = document.createElement('label');
  tLabel.textContent = 'Target Distribution';
  targetDiv.appendChild(tLabel);
  const tSelect = document.createElement('select');
  tSelect.id = 'target-dropdown';
  for (const [key, t] of Object.entries(TARGETS)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = t.label;
    if (key === state.targetKey) opt.selected = true;
    tSelect.appendChild(opt);
  }
  targetDiv.appendChild(tSelect);
  tSelect.addEventListener('change', () => {
    state.targetKey = tSelect.value;
    state.chain = [];
    state.accepted = [];
    state.runningAcceptRate = [];
    updateAll();
  });

  // Algorithm label (just informational)
  const algoDiv = document.getElementById('algorithm-select');
  algoDiv.innerHTML = '<label>Algorithm</label><div style="font-size:13px;color:var(--color-text-secondary);padding:4px 0;">Metropolis-Hastings</div>';

  // Proposal SD slider
  buildSlider('proposal-sd', 'Proposal \u03C3', state.proposalSd, 0.01, 10, 0.01, (v) => {
    state.proposalSd = v;
  });

  // Num samples slider
  buildSlider('num-samples', 'Num Samples', state.numSamples, 100, 10000, 100, (v) => {
    state.numSamples = v;
  }, d3.format(','));

  // Burn-in slider
  buildSlider('burnin-slider', 'Burn-in', state.burnIn, 0, 5000, 10, (v) => {
    state.burnIn = v;
    updateAll();
  }, d3.format(','));

  // Thinning slider
  buildSlider('thin-slider', 'Thinning', state.thinning, 1, 50, 1, (v) => {
    state.thinning = v;
    updateAll();
  });

  // Run button
  document.getElementById('run-btn').addEventListener('click', () => {
    runSampler();
    updateAll();
  });

  // Step button
  document.getElementById('step-btn').addEventListener('click', () => {
    stepForward();
    updateAll();
  });
}

function buildSlider(containerId, label, initial, min, max, step, onChange, fmt) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  container.classList.add('control-group', 'slider-control');

  const lbl = document.createElement('label');
  const spanLabel = document.createElement('span');
  spanLabel.textContent = label + ' ';
  lbl.appendChild(spanLabel);
  const spanVal = document.createElement('span');
  spanVal.className = 'value-display';
  spanVal.textContent = fmt ? fmt(initial) : (Number.isInteger(initial) ? initial : initial.toFixed(2));
  lbl.appendChild(spanVal);
  container.appendChild(lbl);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = initial;
  container.appendChild(input);

  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    spanVal.textContent = fmt ? fmt(v) : (Number.isInteger(v) && step >= 1 ? v : v.toFixed(2));
    onChange(v);
  });
}

/* ─── Stats Panel ───────────────────────────────────────────── */

function updateStats() {
  const statsEl = document.getElementById('stats');
  statsEl.innerHTML = '';

  const postSamples = getPostBurnIn();
  const n = postSamples.length;

  // Acceptance rate
  const totalAccepted = state.accepted.filter(Boolean).length;
  const acceptRate = state.accepted.length > 0 ? totalAccepted / state.accepted.length : 0;

  // Mean and variance
  let mean = 0, m2 = 0;
  for (let i = 0; i < n; i++) mean += postSamples[i];
  mean = n > 0 ? mean / n : 0;
  for (let i = 0; i < n; i++) m2 += (postSamples[i] - mean) ** 2;
  const variance = n > 1 ? m2 / (n - 1) : 0;

  // ESS
  const ess = computeESS(postSamples);

  // KS stat
  const ks = computeKS(postSamples);

  const items = [
    { label: 'Chain Length', val: d3.format(',')(state.chain.length) },
    { label: 'Accept Rate', val: (acceptRate * 100).toFixed(1) + '%' },
    { label: 'ESS', val: ess.toFixed(0) },
    { label: 'Post-Burn N', val: d3.format(',')(n) },
    { label: 'Mean', val: mean.toFixed(4) },
    { label: 'Variance', val: variance.toFixed(4) },
    { label: 'KS Stat', val: isNaN(ks) ? 'N/A' : ks.toFixed(4) },
  ];

  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'stat-item';
    const sl = document.createElement('span');
    sl.className = 'stat-label';
    sl.textContent = item.label;
    const sv = document.createElement('span');
    sv.className = 'stat-val';
    sv.textContent = item.val;
    div.appendChild(sl);
    div.appendChild(sv);
    statsEl.appendChild(div);
  });
}

/* ─── Info Panel ────────────────────────────────────────────── */

function buildInfoPanel() {
  const info = document.getElementById('info');
  info.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.style.maxWidth = '1400px';
  wrapper.style.margin = '0 auto';
  wrapper.style.padding = '0 var(--space-xl)';
  info.appendChild(wrapper);

  // Title
  const h2 = document.createElement('h2');
  h2.textContent = 'Metropolis-Hastings Algorithm';
  wrapper.appendChild(h2);

  // MH algorithm formula
  const mhBlock = document.createElement('div');
  mhBlock.className = 'math-block';
  wrapper.appendChild(mhBlock);
  try {
    katex.render(
      String.raw`\alpha(x' | x) = \min\!\left(1,\; \frac{\pi(x')\, q(x|x')}{\pi(x)\, q(x'|x)}\right)`,
      mhBlock,
      { displayMode: true, throwOnError: false }
    );
  } catch (e) {
    mhBlock.textContent = 'alpha(x\'|x) = min(1, pi(x\')q(x|x\') / pi(x)q(x\'|x))';
  }

  const p1 = document.createElement('p');
  p1.textContent = 'For a symmetric proposal distribution q(x\'|x) = q(x|x\'), the acceptance ratio simplifies to:';
  wrapper.appendChild(p1);

  const symBlock = document.createElement('div');
  symBlock.className = 'math-block';
  wrapper.appendChild(symBlock);
  try {
    katex.render(
      String.raw`\alpha(x' | x) = \min\!\left(1,\; \frac{\pi(x')}{\pi(x)}\right)`,
      symBlock,
      { displayMode: true, throwOnError: false }
    );
  } catch (e) {
    symBlock.textContent = 'alpha(x\'|x) = min(1, pi(x\') / pi(x))';
  }

  // Detailed balance
  const dbTitle = document.createElement('h3');
  dbTitle.textContent = 'Detailed Balance';
  wrapper.appendChild(dbTitle);

  const dbBlock = document.createElement('div');
  dbBlock.className = 'math-block';
  wrapper.appendChild(dbBlock);
  try {
    katex.render(
      String.raw`\pi(x)\, T(x' | x) = \pi(x')\, T(x | x')`,
      dbBlock,
      { displayMode: true, throwOnError: false }
    );
  } catch (e) {
    dbBlock.textContent = 'pi(x) T(x\'|x) = pi(x\') T(x|x\')';
  }

  const p2 = document.createElement('p');
  p2.textContent = 'The MH transition kernel satisfies detailed balance with respect to the target distribution, ensuring the chain has the correct stationary distribution.';
  wrapper.appendChild(p2);

  // Mixing diagnostics section
  const details = document.createElement('details');
  wrapper.appendChild(details);
  const summary = document.createElement('summary');
  summary.textContent = 'Mixing Diagnostics';
  details.appendChild(summary);

  const body = document.createElement('div');
  body.className = 'detail-body';
  details.appendChild(body);

  const ul = document.createElement('ul');
  body.appendChild(ul);

  const tips = [
    '<strong>Trace plot:</strong> A well-mixing chain looks like a "hairy caterpillar" with rapid oscillations. Trends or long flat periods indicate poor mixing.',
    '<strong>Autocorrelation:</strong> ACF should decay quickly to zero. Slow decay means high correlation between successive samples and low effective sample size.',
    '<strong>Acceptance rate:</strong> For 1D targets, the optimal acceptance rate is approximately 0.44. For higher dimensions, the Roberts-Gelman-Gilks result gives ~0.234.',
    '<strong>Effective Sample Size (ESS):</strong> Estimates the number of independent samples. ESS << N indicates high autocorrelation; try increasing proposal variance or using thinning.',
    '<strong>Proposal tuning:</strong> Too small sigma leads to high acceptance but tiny steps (poor exploration). Too large sigma leads to frequent rejection (chain gets stuck).',
  ];
  tips.forEach(t => {
    const li = document.createElement('li');
    li.innerHTML = t;
    ul.appendChild(li);
  });

  // ESS formula
  const essTitle = document.createElement('h3');
  essTitle.textContent = 'Effective Sample Size';
  body.appendChild(essTitle);

  const essBlock = document.createElement('div');
  essBlock.className = 'math-block';
  body.appendChild(essBlock);
  try {
    katex.render(
      String.raw`\text{ESS} = \frac{N}{1 + 2\sum_{k=1}^{\infty} \rho_k}`,
      essBlock,
      { displayMode: true, throwOnError: false }
    );
  } catch (e) {
    essBlock.textContent = 'ESS = N / (1 + 2 * sum(rho_k))';
  }

  const p3 = document.createElement('p');
  p3.innerHTML = 'where <em>&rho;<sub>k</sub></em> is the autocorrelation at lag <em>k</em>. The sum is truncated when autocorrelation drops below 0.05.';
  body.appendChild(p3);
}

/* ─── Master Update ─────────────────────────────────────────── */

function updateAll() {
  updateTargetPlot();
  updateTracePlot();
  updateACFPlot();
  updateHistogramPlot();
  updateAcceptancePlot();
  updateStats();
}

/* ─── Resize Handler ────────────────────────────────────────── */

let resizeTimer;
function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    initTargetPlot();
    initTracePlot();
    initACFPlot();
    initHistogramPlot();
    initAcceptancePlot();
    updateAll();
  }, 200);
}

/* ─── Initialize ────────────────────────────────────────────── */

function init() {
  initTargetPlot();
  initTracePlot();
  initACFPlot();
  initHistogramPlot();
  initAcceptancePlot();
  buildControls();
  buildInfoPanel();

  // Run initial sampler
  runSampler();
  updateAll();

  window.addEventListener('resize', onResize);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
