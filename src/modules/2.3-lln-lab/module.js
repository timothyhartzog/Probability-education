/* ============================================================
   Module 2.3 — Laws of Large Numbers Laboratory
   ============================================================
   Visualizes running averages S_n/n for various distributions
   to explore the weak and strong laws of large numbers.
   ============================================================ */

import * as d3 from 'd3';
import katex from 'katex';
import '../../lib/copy-code.js';
import { makeInfoBtn } from '../../lib/param-tooltips.js';

/* ---- Seedable xoshiro128** PRNG ----------------------------- */
function xoshiro128ss(a, b, c, d) {
  return function () {
    const t = b << 9;
    let r = b * 5;
    r = ((r << 7) | (r >>> 25)) * 9;
    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;
    c ^= t;
    d = (d << 11) | (d >>> 21);
    return (r >>> 0) / 4294967296;
  };
}

function makePRNG(seed) {
  // Splitmix32 to initialize state from a single seed
  function splitmix32(s) {
    return function () {
      s |= 0;
      s = (s + 0x9e3779b9) | 0;
      let t = s ^ (s >>> 16);
      t = Math.imul(t, 0x21f0aaad);
      t ^= t >>> 15;
      t = Math.imul(t, 0x735a2d97);
      t ^= t >>> 15;
      return t >>> 0;
    };
  }
  const sm = splitmix32(seed);
  return xoshiro128ss(sm(), sm(), sm(), sm());
}

/* ---- Distribution definitions ------------------------------- */
const DISTRIBUTIONS = {
  normal: {
    name: 'Normal(0, 1)',
    mu: 0,
    variance: 1,
    hasFiniteMean: true,
    hasFiniteVariance: true,
    sample(rng) {
      // Box-Muller transform
      const u1 = rng();
      const u2 = rng();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    },
  },
  uniform: {
    name: 'Uniform(0, 1)',
    mu: 0.5,
    variance: 1 / 12,
    hasFiniteMean: true,
    hasFiniteVariance: true,
    sample(rng) {
      return rng();
    },
  },
  exponential: {
    name: 'Exponential(1)',
    mu: 1,
    variance: 1,
    hasFiniteMean: true,
    hasFiniteVariance: true,
    sample(rng) {
      // Clamp away from 0 to avoid Math.log(0) = -Infinity
      return -Math.log(Math.max(rng(), Number.EPSILON));
    },
  },
  poisson: {
    name: 'Poisson(3)',
    mu: 3,
    variance: 3,
    hasFiniteMean: true,
    hasFiniteVariance: true,
    sample(rng) {
      // Knuth's algorithm
      const L = Math.exp(-3);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= rng();
      } while (p > L);
      return k - 1;
    },
  },
  pareto: {
    name: 'Pareto(alpha)',
    get mu() {
      return null; // computed dynamically
    },
    get variance() {
      return null;
    },
    hasFiniteMean: null,
    hasFiniteVariance: null,
    sample(rng, alpha) {
      // Inverse CDF: X = xm / U^(1/alpha), xm=1
      return 1 / Math.pow(rng(), 1 / alpha);
    },
  },
  cauchy: {
    name: 'Cauchy(0, 1)',
    mu: null,
    variance: null,
    hasFiniteMean: false,
    hasFiniteVariance: false,
    sample(rng) {
      return Math.tan(Math.PI * (rng() - 0.5));
    },
  },
  bernoulli: {
    name: 'Bernoulli(0.5)',
    mu: 0.5,
    variance: 0.25,
    hasFiniteMean: true,
    hasFiniteVariance: true,
    sample(rng) {
      return rng() < 0.5 ? 1 : 0;
    },
  },
};

function getParetoProps(alpha) {
  const hasFiniteMean = alpha > 1;
  const hasFiniteVariance = alpha > 2;
  const mu = hasFiniteMean ? alpha / (alpha - 1) : Infinity;
  const variance = hasFiniteVariance
    ? alpha / ((alpha - 1) * (alpha - 1) * (alpha - 2))
    : Infinity;
  return { mu, variance, hasFiniteMean, hasFiniteVariance };
}

/* ---- State -------------------------------------------------- */
const state = {
  distribution: 'normal',
  paretoAlpha: 2.0,
  numPaths: 50,
  maxN: 1000,
  fixedN: 100,
  showEnvelope: true,
  seed: 42,
};

/* ---- Utility: subsample for plotting ------------------------ */
function subsampleIndices(maxN, maxPoints) {
  if (maxN <= maxPoints) return d3.range(1, maxN + 1);
  // Use logarithmic spacing for large n
  const indices = new Set();
  // Always include small n values
  for (let i = 1; i <= Math.min(100, maxN); i++) indices.add(i);
  // Log-spaced for the rest
  const logMin = Math.log10(100);
  const logMax = Math.log10(maxN);
  const numLog = maxPoints - Math.min(100, maxN);
  for (let i = 0; i < numLog; i++) {
    const val = Math.round(Math.pow(10, logMin + (logMax - logMin) * i / (numLog - 1)));
    if (val <= maxN) indices.add(val);
  }
  indices.add(maxN);
  return Array.from(indices).sort((a, b) => a - b);
}

/* ---- Generate running average paths ------------------------- */
function generatePaths() {
  const dist = DISTRIBUTIONS[state.distribution];
  const { numPaths, maxN, paretoAlpha } = state;
  const isPareto = state.distribution === 'pareto';
  const isCauchy = state.distribution === 'cauchy';

  let mu, hasFiniteMean, hasFiniteVariance, variance;
  if (isPareto) {
    const props = getParetoProps(paretoAlpha);
    mu = props.mu;
    hasFiniteMean = props.hasFiniteMean;
    hasFiniteVariance = props.hasFiniteVariance;
    variance = props.variance;
  } else {
    mu = dist.mu;
    hasFiniteMean = dist.hasFiniteMean;
    hasFiniteVariance = dist.hasFiniteVariance;
    variance = dist.variance;
  }

  const plotIndices = subsampleIndices(maxN, 800);
  const paths = [];

  for (let p = 0; p < numPaths; p++) {
    const rng = makePRNG(state.seed * 1000 + p * 7 + 1);
    let sum = 0;
    const points = [];
    let idxPtr = 0;

    for (let n = 1; n <= maxN; n++) {
      const x = isPareto ? dist.sample(rng, paretoAlpha) : dist.sample(rng);
      sum += x;
      if (idxPtr < plotIndices.length && plotIndices[idxPtr] === n) {
        points.push({ n, avg: sum / n });
        idxPtr++;
      }
    }
    paths.push(points);
  }

  return { paths, mu, hasFiniteMean, hasFiniteVariance, variance, plotIndices };
}

/* ---- Generate histogram data -------------------------------- */
function generateHistogram() {
  const dist = DISTRIBUTIONS[state.distribution];
  const { fixedN, paretoAlpha } = state;
  const isPareto = state.distribution === 'pareto';
  const numRuns = 5000;
  const averages = [];

  for (let r = 0; r < numRuns; r++) {
    const rng = makePRNG(state.seed * 100000 + r * 13 + 7);
    let sum = 0;
    for (let n = 1; n <= fixedN; n++) {
      sum += isPareto ? dist.sample(rng, paretoAlpha) : dist.sample(rng);
    }
    averages.push(sum / fixedN);
  }

  return averages;
}

/* ---- Generate convergence rate data ------------------------- */
function generateRateData() {
  const dist = DISTRIBUTIONS[state.distribution];
  const { maxN, paretoAlpha } = state;
  const isPareto = state.distribution === 'pareto';

  let mu;
  if (isPareto) {
    const props = getParetoProps(paretoAlpha);
    mu = props.mu;
    if (!props.hasFiniteMean) return null;
  } else if (dist.mu === null) {
    return null;
  } else {
    mu = dist.mu;
  }

  const numTrials = 200;
  const checkPoints = subsampleIndices(maxN, 300);
  const maxDeviation = new Array(checkPoints.length).fill(0);

  for (let t = 0; t < numTrials; t++) {
    const rng = makePRNG(state.seed * 50000 + t * 17 + 3);
    let sum = 0;
    let cpIdx = 0;
    let runMax = 0;

    for (let n = 1; n <= maxN; n++) {
      sum += isPareto ? dist.sample(rng, paretoAlpha) : dist.sample(rng);
      const dev = Math.abs(sum / n - mu);
      if (dev > runMax) runMax = dev;

      if (cpIdx < checkPoints.length && checkPoints[cpIdx] === n) {
        maxDeviation[cpIdx] = Math.max(maxDeviation[cpIdx], runMax);
        cpIdx++;
      }
    }
  }

  return checkPoints.map((n, i) => ({
    n,
    maxDev: maxDeviation[i] || 1e-10,
  }));
}

/* ---- Chart dimensions --------------------------------------- */
function getDims(container, aspectRatio = 0.5) {
  const width = container.clientWidth;
  const height = Math.max(200, width * aspectRatio);
  const margin = { top: 20, right: 30, bottom: 40, left: 55 };
  return {
    width,
    height,
    margin,
    innerW: width - margin.left - margin.right,
    innerH: height - margin.top - margin.bottom,
  };
}

/* ---- Color scale for paths ---------------------------------- */
const pathColorScale = d3.scaleOrdinal()
  .range([
    '#2563eb', '#059669', '#7c3aed', '#e97319', '#db2777',
    '#0891b2', '#ca8a04', '#64748b',
  ]);

/* ---- Draw main chart ---------------------------------------- */
function drawMainChart(data) {
  const container = document.querySelector('#main-chart .chart-area');
  container.innerHTML = '';

  const dims = getDims(container, 0.45);
  const { paths, mu, hasFiniteMean, hasFiniteVariance, variance, plotIndices } = data;

  const svg = d3.select(container)
    .append('svg')
    .attr('width', dims.width)
    .attr('height', dims.height);

  const g = svg.append('g')
    .attr('transform', `translate(${dims.margin.left},${dims.margin.top})`);

  // Compute y range from data
  let yMin = Infinity, yMax = -Infinity;
  for (const path of paths) {
    for (const pt of path) {
      if (isFinite(pt.avg)) {
        if (pt.avg < yMin) yMin = pt.avg;
        if (pt.avg > yMax) yMax = pt.avg;
      }
    }
  }

  // Clamp for divergent cases
  const yRange = yMax - yMin;
  if (!isFinite(yRange) || yRange === 0) {
    yMin = -10;
    yMax = 10;
  } else {
    const pad = yRange * 0.1;
    yMin -= pad;
    yMax += pad;
  }

  // X scale
  const useLogX = state.maxN > 500;
  const xScale = useLogX
    ? d3.scaleLog().domain([1, state.maxN]).range([0, dims.innerW])
    : d3.scaleLinear().domain([1, state.maxN]).range([0, dims.innerW]);

  const yScale = d3.scaleLinear()
    .domain([yMin, yMax])
    .range([dims.innerH, 0]);

  // Axes
  const xAxis = useLogX
    ? d3.axisBottom(xScale).ticks(6, '~s')
    : d3.axisBottom(xScale).ticks(8);
  const yAxis = d3.axisLeft(yScale).ticks(6);

  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${dims.innerH})`)
    .call(xAxis);

  g.append('g')
    .attr('class', 'axis')
    .call(yAxis);

  // Axis labels
  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', dims.innerW / 2)
    .attr('y', dims.innerH + 35)
    .attr('text-anchor', 'middle')
    .text('n');

  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -dims.innerH / 2)
    .attr('y', -42)
    .attr('text-anchor', 'middle')
    .text('Sn / n');

  // Clip path
  g.append('defs').append('clipPath')
    .attr('id', 'main-clip')
    .append('rect')
    .attr('width', dims.innerW)
    .attr('height', dims.innerH);

  const plotArea = g.append('g').attr('clip-path', 'url(#main-clip)');

  // Mean line
  if (hasFiniteMean && isFinite(mu)) {
    plotArea.append('line')
      .attr('class', 'mean-line')
      .attr('x1', 0)
      .attr('x2', dims.innerW)
      .attr('y1', yScale(mu))
      .attr('y2', yScale(mu))
      .attr('stroke', '#dc2626')
      .attr('stroke-dasharray', '8,4')
      .attr('stroke-width', 2)
      .attr('opacity', 0.8);

    // Label
    g.append('text')
      .attr('x', dims.innerW + 4)
      .attr('y', yScale(mu) + 4)
      .attr('font-size', '11px')
      .attr('font-family', 'var(--font-mono)')
      .attr('fill', '#dc2626')
      .text(`mu = ${mu === Math.round(mu) ? mu : mu.toFixed(3)}`);
  }

  // Envelope: mu +/- C / sqrt(n)
  if (state.showEnvelope && hasFiniteMean && hasFiniteVariance && isFinite(variance)) {
    const C = 2 * Math.sqrt(variance);
    const envLine = d3.line()
      .x(d => xScale(d.n))
      .y(d => yScale(d.v))
      .defined(d => isFinite(d.v) && d.v >= yMin && d.v <= yMax);

    const envPoints = plotIndices
      .filter(n => n >= 1)
      .map(n => ({ n, offset: C / Math.sqrt(n) }));

    // Upper envelope
    plotArea.append('path')
      .datum(envPoints.map(d => ({ n: d.n, v: mu + d.offset })))
      .attr('class', 'envelope-line')
      .attr('d', envLine)
      .attr('fill', 'none')
      .attr('stroke', '#94a3b8')
      .attr('stroke-dasharray', '4,3')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.6);

    // Lower envelope
    plotArea.append('path')
      .datum(envPoints.map(d => ({ n: d.n, v: mu - d.offset })))
      .attr('class', 'envelope-line')
      .attr('d', envLine)
      .attr('fill', 'none')
      .attr('stroke', '#94a3b8')
      .attr('stroke-dasharray', '4,3')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.6);
  }

  // Sample paths
  const line = d3.line()
    .x(d => xScale(d.n))
    .y(d => yScale(Math.max(yMin, Math.min(yMax, d.avg))))
    .defined(d => isFinite(d.avg));

  plotArea.selectAll('.sample-path')
    .data(paths)
    .enter()
    .append('path')
    .attr('class', 'sample-path')
    .attr('d', d => line(d))
    .attr('stroke', (_, i) => pathColorScale(i % 8))
    .attr('fill', 'none')
    .attr('stroke-width', 1)
    .attr('opacity', Math.min(0.5, 8 / state.numPaths));
}

/* ---- Draw histogram ----------------------------------------- */
function drawHistogram(averages) {
  const container = document.querySelector('#histogram-panel .chart-area');
  container.innerHTML = '';

  const dims = getDims(container, 0.65);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', dims.width)
    .attr('height', dims.height);

  const g = svg.append('g')
    .attr('transform', `translate(${dims.margin.left},${dims.margin.top})`);

  // Filter out extreme outliers for better visualization
  const sorted = averages.slice().sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.02)];
  const q99 = sorted[Math.floor(sorted.length * 0.98)];
  const iqr = q99 - q1;
  const lo = q1 - iqr * 0.5;
  const hi = q99 + iqr * 0.5;

  const filtered = averages.filter(v => v >= lo && v <= hi && isFinite(v));
  if (filtered.length < 10) {
    g.append('text')
      .attr('x', dims.innerW / 2)
      .attr('y', dims.innerH / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#94a3b8')
      .text('Distribution too spread to display histogram');
    return;
  }

  const xScale = d3.scaleLinear()
    .domain([lo, hi])
    .range([0, dims.innerW]);

  const histogram = d3.bin()
    .domain(xScale.domain())
    .thresholds(xScale.ticks(40))
    .value(d => d);

  const bins = histogram(filtered);
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(bins, d => d.length)])
    .range([dims.innerH, 0]);

  // Axes
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${dims.innerH})`)
    .call(d3.axisBottom(xScale).ticks(6));

  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(5));

  // Bars
  g.selectAll('.hist-bar')
    .data(bins)
    .enter()
    .append('rect')
    .attr('class', 'hist-bar')
    .attr('x', d => xScale(d.x0) + 1)
    .attr('width', d => Math.max(0, xScale(d.x1) - xScale(d.x0) - 1))
    .attr('y', d => yScale(d.length))
    .attr('height', d => dims.innerH - yScale(d.length));

  // Mean line if applicable
  const dist = DISTRIBUTIONS[state.distribution];
  let mu;
  if (state.distribution === 'pareto') {
    const props = getParetoProps(state.paretoAlpha);
    mu = props.hasFiniteMean ? props.mu : null;
  } else {
    mu = dist.mu;
  }

  if (mu !== null && isFinite(mu) && mu >= lo && mu <= hi) {
    g.append('line')
      .attr('x1', xScale(mu))
      .attr('x2', xScale(mu))
      .attr('y1', 0)
      .attr('y2', dims.innerH)
      .attr('stroke', '#dc2626')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '6,3');
  }

  // Labels
  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', dims.innerW / 2)
    .attr('y', dims.innerH + 35)
    .attr('text-anchor', 'middle')
    .text(`Sn/n  (n = ${state.fixedN})`);

  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -dims.innerH / 2)
    .attr('y', -40)
    .attr('text-anchor', 'middle')
    .text('Count');
}

/* ---- Draw rate panel ---------------------------------------- */
function drawRatePanel(rateData) {
  const container = document.querySelector('#rate-panel .chart-area');
  container.innerHTML = '';

  const dims = getDims(container, 0.65);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', dims.width)
    .attr('height', dims.height);

  const g = svg.append('g')
    .attr('transform', `translate(${dims.margin.left},${dims.margin.top})`);

  if (!rateData) {
    g.append('text')
      .attr('x', dims.innerW / 2)
      .attr('y', dims.innerH / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#94a3b8')
      .attr('font-family', 'var(--font-heading)')
      .attr('font-size', '13px')
      .text('No finite mean — convergence rate undefined');
    return;
  }

  const filtered = rateData.filter(d => d.n >= 2 && d.maxDev > 0);
  if (filtered.length < 2) return;

  const xScale = d3.scaleLog()
    .domain([d3.min(filtered, d => d.n), d3.max(filtered, d => d.n)])
    .range([0, dims.innerW]);

  const yScale = d3.scaleLog()
    .domain([
      Math.max(1e-6, d3.min(filtered, d => d.maxDev) * 0.5),
      d3.max(filtered, d => d.maxDev) * 2,
    ])
    .range([dims.innerH, 0]);

  // Axes
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${dims.innerH})`)
    .call(d3.axisBottom(xScale).ticks(5, '~s'));

  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(5, '~s'));

  // Rate data path
  const line = d3.line()
    .x(d => xScale(d.n))
    .y(d => yScale(d.maxDev))
    .defined(d => isFinite(d.maxDev) && d.maxDev > 0);

  g.append('path')
    .datum(filtered)
    .attr('class', 'rate-path')
    .attr('d', line)
    .attr('stroke', 'var(--viz-1)')
    .attr('fill', 'none')
    .attr('stroke-width', 2);

  // Reference line: 1/sqrt(n)
  const refData = filtered.map(d => ({
    n: d.n,
    val: 3 / Math.sqrt(d.n),
  })).filter(d => d.val >= yScale.domain()[0] && d.val <= yScale.domain()[1]);

  if (refData.length > 1) {
    const refLine = d3.line()
      .x(d => xScale(d.n))
      .y(d => yScale(d.val));

    g.append('path')
      .datum(refData)
      .attr('d', refLine)
      .attr('stroke', '#94a3b8')
      .attr('stroke-dasharray', '6,4')
      .attr('stroke-width', 1.5)
      .attr('fill', 'none')
      .attr('opacity', 0.7);

    // Label for reference line
    const lastRef = refData[refData.length - 1];
    g.append('text')
      .attr('x', xScale(lastRef.n) + 4)
      .attr('y', yScale(lastRef.val))
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-mono)')
      .attr('fill', '#94a3b8')
      .text('~ 1/sqrt(n)');
  }

  // Axis labels
  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', dims.innerW / 2)
    .attr('y', dims.innerH + 35)
    .attr('text-anchor', 'middle')
    .text('n (log scale)');

  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -dims.innerH / 2)
    .attr('y', -42)
    .attr('text-anchor', 'middle')
    .text('max |Sk/k - mu|');
}

/* ---- Build controls ----------------------------------------- */
function buildControls() {
  const panel = document.getElementById('controls');
  panel.innerHTML = '';

  // Title
  const h2 = document.createElement('h2');
  h2.textContent = 'Controls';
  panel.appendChild(h2);

  // Distribution selector
  const distGroup = makeDropdown('Distribution', 'dist-select', [
    { value: 'normal', label: 'Normal(0, 1)' },
    { value: 'uniform', label: 'Uniform(0, 1)' },
    { value: 'exponential', label: 'Exponential(1)' },
    { value: 'poisson', label: 'Poisson(3)' },
    { value: 'pareto', label: 'Pareto(alpha, xm=1)' },
    { value: 'cauchy', label: 'Cauchy(0, 1) — no mean' },
    { value: 'bernoulli', label: 'Bernoulli(0.5)' },
  ], state.distribution, {
    param: 'Parent Distribution',
    tip: 'The distribution each Xᵢ is drawn from. The LLN holds for any distribution with a finite mean (E[|X|] < ∞). Cauchy has no finite mean — the running average never converges. Pareto with α ≤ 1 also fails; at α ≤ 2 variance is infinite so convergence is very slow.',
    default: 'Normal(0,1)',
  });
  panel.appendChild(distGroup);

  distGroup.querySelector('select').addEventListener('change', (e) => {
    state.distribution = e.target.value;
    toggleParetoControl();
    update();
  });

  // Pareto alpha slider
  const paretoDiv = document.createElement('div');
  paretoDiv.className = 'pareto-control' + (state.distribution === 'pareto' ? '' : ' hidden');
  paretoDiv.id = 'pareto-alpha-control';

  const alphaSlider = makeSlider('Pareto alpha', 'alpha-slider', 0.5, 3.0, 0.1, state.paretoAlpha, (v) => {
    state.paretoAlpha = v;
    updateAlphaAnnotation();
    update();
  }, undefined, {
    param: 'Pareto Tail Index (α)',
    tip: 'Controls the tail heaviness. α > 2: finite mean and variance, LLN works well. 1 < α ≤ 2: finite mean but infinite variance — convergence is very slow and erratic. α ≤ 1: infinite mean — LLN fails entirely and the running average diverges.',
    default: '1.5', range: '0.5–3.0',
  });
  paretoDiv.appendChild(alphaSlider);

  // Alpha annotation
  const alphaNote = document.createElement('div');
  alphaNote.id = 'alpha-annotation';
  alphaNote.style.cssText = 'font-size: 0.75rem; color: var(--color-text-secondary); margin-top: 4px; font-family: var(--font-heading);';
  paretoDiv.appendChild(alphaNote);
  panel.appendChild(paretoDiv);
  updateAlphaAnnotation();

  panel.appendChild(makeDivider());

  // Number of paths
  panel.appendChild(makeSlider('Number of paths', 'paths-slider', 10, 200, 10, state.numPaths, (v) => {
    state.numPaths = v;
    update();
  }, undefined, {
    param: 'Number of Sample Paths',
    tip: 'How many independent sequences X₁, X₂, … are simulated simultaneously. More paths shows how the running average Sₙ/n fans out and then concentrates near μ. Higher values slow rendering.',
    default: '50', range: '10–200', unit: 'paths',
  }));

  // Max n (log scale steps)
  const nSteps = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
  const nIdx = nSteps.indexOf(state.maxN) !== -1 ? nSteps.indexOf(state.maxN) : 3;
  const maxNSlider = makeSlider('Max n', 'maxn-slider', 0, nSteps.length - 1, 1, nIdx, (v) => {
    state.maxN = nSteps[v];
    // Adjust fixedN if needed
    if (state.fixedN > state.maxN) {
      state.fixedN = state.maxN;
      const fnSlider = document.getElementById('fixedn-slider');
      if (fnSlider) {
        fnSlider.value = state.fixedN;
        fnSlider.previousElementSibling.querySelector('.value-display').textContent = state.fixedN;
      }
    }
    update();
  }, (v) => nSteps[v].toLocaleString(), {
    param: 'Maximum n',
    tip: 'The largest sample size n to display. Use larger values to see the asymptotic behavior of the LLN and the 1/√n convergence rate on the log-log chart. Steps are logarithmically spaced.',
    default: '1,000', range: '100–100,000',
  });
  panel.appendChild(maxNSlider);

  // Fixed n for histogram
  panel.appendChild(makeSlider('Fixed n (histogram)', 'fixedn-slider', 10, state.maxN, 10, state.fixedN, (v) => {
    state.fixedN = Math.min(v, state.maxN);
    update();
  }, undefined, {
    param: 'Fixed n (Histogram)',
    tip: 'The specific sample size n used for the distribution histogram (bottom-left panel). Shows how the distribution of the running average Sₙ/n concentrates around μ as n increases.',
    default: '500', range: '10–max n',
  }));

  panel.appendChild(makeDivider());

  // Envelope toggle
  panel.appendChild(makeToggle('Show +/-1/sqrt(n) envelope', state.showEnvelope, (v) => {
    state.showEnvelope = v;
    update();
  }));

  panel.appendChild(makeDivider());

  // Regenerate button
  const btn = document.createElement('button');
  btn.className = 'btn btn-primary btn-lg';
  btn.textContent = 'Regenerate';
  btn.style.width = '100%';
  btn.addEventListener('click', () => {
    state.seed = Math.floor(Math.random() * 100000);
    update();
  });
  panel.appendChild(btn);
}

/* ---- Control helpers ---------------------------------------- */
function makeDropdown(label, id, options, selected, tooltip) {
  const group = document.createElement('div');
  group.className = 'control-group dropdown-control';
  const lbl = document.createElement('label');
  lbl.setAttribute('for', id);
  lbl.innerHTML = label;
  if (tooltip) lbl.appendChild(makeInfoBtn(tooltip));
  group.appendChild(lbl);
  const sel = document.createElement('select');
  sel.id = id;
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    if (opt.value === selected) o.selected = true;
    sel.appendChild(o);
  }
  group.appendChild(sel);
  return group;
}

function makeSlider(label, id, min, max, step, value, onChange, formatFn, tooltip) {
  const group = document.createElement('div');
  group.className = 'control-group slider-control';
  const lbl = document.createElement('label');
  lbl.setAttribute('for', id);
  const displayVal = formatFn ? formatFn(value) : value;
  lbl.innerHTML = `${label} <span class="value-display">${displayVal}</span>`;
  if (tooltip) lbl.appendChild(makeInfoBtn(tooltip));
  group.appendChild(lbl);

  const input = document.createElement('input');
  input.type = 'range';
  input.id = id;
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = value;
  group.appendChild(input);

  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    lbl.querySelector('.value-display').textContent = formatFn ? formatFn(v) : v;
    onChange(v);
  });

  return group;
}

function makeToggle(label, checked, onChange) {
  const group = document.createElement('label');
  group.className = 'toggle-control';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  const track = document.createElement('span');
  track.className = 'toggle-track';
  const lbl = document.createElement('span');
  lbl.className = 'toggle-label';
  lbl.textContent = label;
  group.appendChild(input);
  group.appendChild(track);
  group.appendChild(lbl);
  input.addEventListener('change', () => onChange(input.checked));
  return group;
}

function makeDivider() {
  const hr = document.createElement('hr');
  hr.className = 'control-divider';
  return hr;
}

function toggleParetoControl() {
  const el = document.getElementById('pareto-alpha-control');
  if (el) {
    el.classList.toggle('hidden', state.distribution !== 'pareto');
  }
}

function updateAlphaAnnotation() {
  const el = document.getElementById('alpha-annotation');
  if (!el) return;
  const a = state.paretoAlpha;
  if (a <= 1) {
    el.textContent = 'alpha <= 1: infinite mean — LLN fails, averages diverge';
    el.style.color = 'var(--color-error)';
  } else if (a <= 2) {
    el.textContent = 'alpha in (1, 2]: finite mean, infinite variance — slow convergence';
    el.style.color = 'var(--color-secondary)';
  } else {
    el.textContent = 'alpha > 2: finite mean & variance — clean sqrt(n) convergence';
    el.style.color = 'var(--color-accent)';
  }
}

/* ---- Info panel with KaTeX ---------------------------------- */
function buildInfoPanel() {
  const panel = document.getElementById('info');
  panel.innerHTML = '';

  const sections = [
    {
      title: 'Weak Law of Large Numbers (WLLN)',
      content: `
        <p>If <span class="math-inline" id="wlln-cond"></span> are i.i.d. with finite mean
        <span class="math-inline" id="wlln-mu"></span>, then for every
        <span class="math-inline" id="wlln-eps"></span>:</p>
        <div class="math-block" id="wlln-formula"></div>
        <p>The WLLN requires only a finite first moment. Convergence is <em>in probability</em>:
        for any tolerance, the chance of a large deviation shrinks to zero, but on any given
        realization the running average may occasionally wander.</p>
      `,
    },
    {
      title: 'Strong Law of Large Numbers (SLLN)',
      content: `
        <p>Under the same conditions, the SLLN gives the stronger guarantee of
        <em>almost sure</em> convergence:</p>
        <div class="math-block" id="slln-formula"></div>
        <p>This means that with probability 1, the running average eventually stays permanently
        near the mean — not just with high probability at each fixed time. In the visualization
        above, every sample path converges to the dashed line when the mean exists.</p>
      `,
    },
    {
      title: 'Role of Tail Behavior',
      content: `
        <p>The Pareto distribution is key for understanding how tail heaviness affects convergence:</p>
        <ul>
          <li><strong><span class="math-inline" id="tail-a1"></span>:</strong> Infinite mean.
          The LLN does not apply at all — running averages grow without bound.</li>
          <li><strong><span class="math-inline" id="tail-a12"></span>:</strong> Finite mean but
          infinite variance. The WLLN and SLLN still hold, but convergence is much slower and
          more erratic. No CLT-based envelope applies.</li>
          <li><strong><span class="math-inline" id="tail-a2"></span>:</strong> Finite mean and
          variance. Clean convergence with rate
          <span class="math-inline" id="tail-rate"></span>.</li>
        </ul>
        <p>The Cauchy distribution has no mean at all, so the running averages never settle down —
        they keep making large jumps at every scale.</p>
      `,
    },
    {
      title: 'Convergence Rate',
      content: `
        <p>When the variance <span class="math-inline" id="rate-sigma"></span> is finite, Chebyshev's inequality gives:</p>
        <div class="math-block" id="rate-formula"></div>
        <p>The log-log plot (bottom right) shows the empirical maximum deviation
        <span class="math-inline" id="rate-maxdev"></span>
        compared to the theoretical <span class="math-inline" id="rate-ref"></span> reference line.
        A slope of -1/2 on the log-log plot corresponds to the
        <span class="math-inline" id="rate-sqrt"></span> rate.</p>
      `,
    },
  ];

  for (const sec of sections) {
    const details = document.createElement('details');
    details.open = true;
    const summary = document.createElement('summary');
    summary.textContent = sec.title;
    details.appendChild(summary);
    const body = document.createElement('div');
    body.className = 'detail-body';
    body.innerHTML = sec.content;
    details.appendChild(body);
    panel.appendChild(details);
  }

  // Render KaTeX expressions
  const katexPairs = [
    ['wlln-cond', 'X_1, X_2, \\ldots', false],
    ['wlln-mu', '\\mu = E[X_1]', false],
    ['wlln-eps', '\\varepsilon > 0', false],
    ['wlln-formula', 'P\\!\\left(\\left|\\frac{S_n}{n} - \\mu\\right| > \\varepsilon\\right) \\xrightarrow{n \\to \\infty} 0', true],
    ['slln-formula', 'P\\!\\left(\\lim_{n \\to \\infty} \\frac{S_n}{n} = \\mu\\right) = 1', true],
    ['tail-a1', '\\alpha \\leq 1', false],
    ['tail-a12', '1 < \\alpha \\leq 2', false],
    ['tail-a2', '\\alpha > 2', false],
    ['tail-rate', 'O(1/\\sqrt{n})', false],
    ['rate-sigma', '\\sigma^2', false],
    ['rate-formula', 'P\\!\\left(\\left|\\frac{S_n}{n} - \\mu\\right| > \\varepsilon\\right) \\leq \\frac{\\sigma^2}{n\\,\\varepsilon^2}', true],
    ['rate-maxdev', '\\max_{k \\leq n} |S_k/k - \\mu|', false],
    ['rate-ref', '1/\\sqrt{n}', false],
    ['rate-sqrt', '1/\\sqrt{n}', false],
  ];

  for (const [id, tex, displayMode] of katexPairs) {
    const el = document.getElementById(id);
    if (el) {
      katex.render(tex, el, { displayMode, throwOnError: false });
    }
  }
}

/* ---- Main update -------------------------------------------- */
let updateTimer = null;

function update() {
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(() => {
    const data = generatePaths();
    drawMainChart(data);

    const histData = generateHistogram();
    drawHistogram(histData);

    const rateData = generateRateData();
    drawRatePanel(rateData);
  }, 50);
}

/* ---- Init --------------------------------------------------- */
function init() {
  buildControls();
  buildInfoPanel();
  update();

  // Resize handler
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(update, 200);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
