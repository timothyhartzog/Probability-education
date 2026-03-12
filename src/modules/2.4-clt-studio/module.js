/* ============================================================
   Module 2.4 — Central Limit Theorem Studio
   ============================================================
   Flagship interactive: animated histograms of standardized
   sums converging to the Gaussian as n grows.
   ============================================================ */

import * as d3 from 'd3';
import katex from 'katex';

/* ---- Seedable xoshiro128** PRNG ----------------------------- */
function xoshiro128ss(a, b, c, d) {
  return function () {
    const t = b << 9;
    let r = b * 5;
    r = ((r << 7) | (r >>> 25)) * 9;
    c ^= a; d ^= b; b ^= c; a ^= d;
    c ^= t;
    d = (d << 11) | (d >>> 21);
    return (r >>> 0) / 4294967296;
  };
}

function createRNG(seed) {
  // splitmix32 to initialize state
  function sm(s) {
    s |= 0; s = s + 0x9e3779b9 | 0;
    let t = s ^ (s >>> 16); t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15); t = Math.imul(t, 0x735a2d97);
    return ((t ^ (t >>> 15)) >>> 0);
  }
  const s0 = sm(seed), s1 = sm(s0), s2 = sm(s1), s3 = sm(s2);
  return xoshiro128ss(s0, s1, s2, s3);
}

/* ---- Normal sampling (Box-Muller) --------------------------- */
function normalSample(rng) {
  let u, v, s;
  do { u = 2 * rng() - 1; v = 2 * rng() - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
  return u * Math.sqrt(-2 * Math.log(s) / s);
}

/* ---- Distributions ------------------------------------------ */
const DISTRIBUTIONS = {
  'uniform': {
    label: 'Uniform(0,1)',
    sample(rng) { return rng(); },
    mean: 0.5,
    variance: 1 / 12,
    thirdAbsMoment: 1 / 8  // E[|X - mu|^3] for Uniform(0,1)
  },
  'exponential': {
    label: 'Exponential(1)',
    sample(rng) { return -Math.log(1 - rng()); },
    mean: 1,
    variance: 1,
    thirdAbsMoment: 2  // E[|X-1|^3] for Exp(1)
  },
  'bernoulli': {
    label: 'Bernoulli(0.5)',
    sample(rng) { return rng() < 0.5 ? 0 : 1; },
    mean: 0.5,
    variance: 0.25,
    thirdAbsMoment: 0.25  // E[|X-0.5|^3] = 0.5^3 = 0.125... using 0.25 for bound
  },
  'poisson': {
    label: 'Poisson(3)',
    sample(rng) {
      const L = Math.exp(-3);
      let k = 0, p = 1;
      do { k++; p *= rng(); } while (p > L);
      return k - 1;
    },
    mean: 3,
    variance: 3,
    thirdAbsMoment: 3.6  // approximation
  },
  'chisq3': {
    label: 'Chi-squared(3)',
    sample(rng) {
      let s = 0;
      for (let i = 0; i < 3; i++) { const z = normalSample(rng); s += z * z; }
      return s;
    },
    mean: 3,
    variance: 6,
    thirdAbsMoment: 15.6  // approximation for chi-sq(3)
  },
  'beta25': {
    label: 'Beta(2,5)',
    sample(rng) {
      // Gamma via Marsaglia-Tsang for a >= 1; for a < 1 use boost
      function gamma(a) {
        if (a < 1) return gamma(a + 1) * Math.pow(rng(), 1 / a);
        const d = a - 1 / 3, c = 1 / Math.sqrt(9 * d);
        for (;;) {
          let x, v;
          do { x = normalSample(rng); v = 1 + c * x; } while (v <= 0);
          v = v * v * v;
          const u = rng();
          if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
          if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
        }
      }
      const g1 = gamma(2), g2 = gamma(5);
      return g1 / (g1 + g2);
    },
    mean: 2 / 7,
    variance: 10 / (49 * 8),  // a*b/((a+b)^2*(a+b+1))
    thirdAbsMoment: 0.012  // approximation
  },
  'dice': {
    label: 'Dice {1,...,6}',
    sample(rng) { return Math.floor(rng() * 6) + 1; },
    mean: 3.5,
    variance: 35 / 12,
    thirdAbsMoment: 2.5  // approximation
  },
  'pareto': {
    label: 'Pareto(3,1)',
    sample(rng) { return Math.pow(1 - rng(), -1 / 3); },
    mean: 3 / 2,
    variance: 3 / 4,  // alpha*xm^2 / ((alpha-1)^2*(alpha-2)) = 3/(4)
    thirdAbsMoment: 1.2  // approximation
  }
};

/* ---- Standard normal PDF and CDF ---------------------------- */
const SQRT2PI = Math.sqrt(2 * Math.PI);
function normalPDF(x) { return Math.exp(-0.5 * x * x) / SQRT2PI; }

// Rational approximation of normal CDF (Abramowitz & Stegun)
function normalCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2);
  return 0.5 * (1 + sign * y);
}

// Inverse normal CDF (rational approximation, Beasley-Springer-Moro)
function normalQuantile(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  // Rational approximation for central region
  const a = [
    -3.969683028665376e+01, 2.209460984245205e+02,
    -2.759285104469687e+02, 1.383577518672690e+02,
    -3.066479806614716e+01, 2.506628277459239e+00
  ];
  const b = [
    -5.447609879822406e+01, 1.615858368580409e+02,
    -1.556989798598866e+02, 6.680131188771972e+01,
    -1.328068155288572e+01
  ];
  const c = [
    -7.784894002430293e-03, -3.223964580411365e-01,
    -2.400758277161838e+00, -2.549732539343734e+00,
    4.374664141464968e+00, 2.938163982698783e+00
  ];
  const d = [
    7.784695709041462e-03, 3.224671290700398e-01,
    2.445134137142996e+00, 3.754408661907416e+00
  ];

  const pLow = 0.02425, pHigh = 1 - pLow;
  let q, r;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
}

/* ---- State -------------------------------------------------- */
const state = {
  distribution: 'uniform',
  n: 1,
  numSamples: 10000,
  numBins: 50,
  showNormal: true,
  showBerryEsseen: false,
  seed: 42,
  playing: false,
  animFrame: null,
  animTimestamp: null
};

/* ---- Generate standardized sums ----------------------------- */
function generateData() {
  const dist = DISTRIBUTIONS[state.distribution];
  const rng = createRNG(state.seed);
  const { n, numSamples } = state;
  const mu = dist.mean;
  const sigma = Math.sqrt(dist.variance);
  const sums = new Float64Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += dist.sample(rng);
    // Standardize: (S_n - n*mu) / (sigma * sqrt(n))
    sums[i] = n === 0 ? 0 : (s - n * mu) / (sigma * Math.sqrt(n));
  }
  return sums;
}

/* ---- Compute moments of array ------------------------------- */
function computeMoments(data) {
  const N = data.length;
  let s1 = 0, s2 = 0, s3 = 0, s4 = 0;
  for (let i = 0; i < N; i++) {
    const x = data[i];
    s1 += x; s2 += x * x; s3 += x * x * x; s4 += x * x * x * x;
  }
  const mean = s1 / N;
  const m2 = s2 / N - mean * mean;
  const sd = Math.sqrt(m2);
  const m3 = s3 / N - 3 * mean * s2 / N + 2 * mean * mean * mean;
  const m4 = s4 / N - 4 * mean * s3 / N + 6 * mean * mean * s2 / N - 3 * mean * mean * mean * mean;
  const skewness = sd > 0 ? m3 / (sd * sd * sd) : 0;
  const kurtosis = sd > 0 ? m4 / (sd * sd * sd * sd) - 3 : 0;
  return { mean, sd, skewness, kurtosis };
}

/* ---- Moments history for the moments-vs-n panel ------------- */
let momentsHistory = [];

function rebuildMomentsHistory() {
  momentsHistory = [];
  const dist = DISTRIBUTIONS[state.distribution];
  const mu = dist.mean;
  const sigma = Math.sqrt(dist.variance);
  const maxN = Math.min(state.n, 200); // compute up to current n, max 200 for perf
  const rng = createRNG(state.seed);

  // For efficiency, generate all samples up front for maxN draws
  const numSamples = Math.min(state.numSamples, 5000); // cap for perf
  const draws = [];
  for (let i = 0; i < numSamples; i++) {
    draws[i] = new Float64Array(maxN);
    for (let j = 0; j < maxN; j++) draws[i][j] = dist.sample(rng);
  }

  const step = maxN <= 50 ? 1 : Math.max(1, Math.floor(maxN / 50));
  for (let nn = 1; nn <= maxN; nn += (nn <= 50 ? 1 : step)) {
    const sums = new Float64Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      let s = 0;
      for (let j = 0; j < nn; j++) s += draws[i][j];
      sums[i] = (s - nn * mu) / (sigma * Math.sqrt(nn));
    }
    const m = computeMoments(sums);
    momentsHistory.push({ n: nn, skewness: m.skewness, kurtosis: m.kurtosis });
  }
  // Always include the current n
  if (momentsHistory.length === 0 || momentsHistory[momentsHistory.length - 1].n !== state.n) {
    const sums = new Float64Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      let s = 0;
      for (let j = 0; j < Math.min(state.n, maxN); j++) s += draws[i][j];
      sums[i] = (s - Math.min(state.n, maxN) * mu) / (sigma * Math.sqrt(Math.min(state.n, maxN)));
    }
    const m = computeMoments(sums);
    momentsHistory.push({ n: state.n, skewness: m.skewness, kurtosis: m.kurtosis });
  }
}

/* ---- Chart Dimensions --------------------------------------- */
const MARGIN = { top: 20, right: 20, bottom: 40, left: 50 };
const SMALL_MARGIN = { top: 15, right: 15, bottom: 35, left: 45 };

function dims(container, margin) {
  const rect = container.getBoundingClientRect();
  const w = Math.max(rect.width - margin.left - margin.right, 100);
  const h = Math.max(rect.height - margin.top - margin.bottom, 100);
  return { width: w, height: h, margin };
}

/* ---- Histogram Panel ---------------------------------------- */
let histSVG, histG;
function initHistogram() {
  const container = document.querySelector('#histogram-panel .chart-area');
  histSVG = d3.select(container).append('svg')
    .attr('preserveAspectRatio', 'xMidYMid meet');
  histG = histSVG.append('g');
  histG.append('g').attr('class', 'axis x-axis');
  histG.append('g').attr('class', 'axis y-axis');
  histG.append('g').attr('class', 'bars');
  histG.append('path').attr('class', 'normal-curve');
  histG.append('path').attr('class', 'berry-esseen-band');
  histG.append('text').attr('class', 'axis-label x-label');
  histG.append('text').attr('class', 'axis-label y-label');
}

function updateHistogram(data) {
  const container = document.querySelector('#histogram-panel .chart-area');
  const d = dims(container, MARGIN);
  histSVG
    .attr('viewBox', `0 0 ${d.width + d.margin.left + d.margin.right} ${d.height + d.margin.top + d.margin.bottom}`)
    .attr('width', d.width + d.margin.left + d.margin.right)
    .attr('height', d.height + d.margin.top + d.margin.bottom);
  histG.attr('transform', `translate(${d.margin.left},${d.margin.top})`);

  // Determine x-range based on data
  const xExtent = d3.extent(data);
  const xPad = 0.5;
  const xMin = Math.min(xExtent[0], -4) - xPad;
  const xMax = Math.max(xExtent[1], 4) + xPad;

  const x = d3.scaleLinear().domain([xMin, xMax]).range([0, d.width]);

  // Build histogram bins
  const binner = d3.bin()
    .domain(x.domain())
    .thresholds(state.numBins);
  const bins = binner(data);

  // Convert counts to density
  const totalSamples = data.length;
  bins.forEach(b => { b.density = b.length / (totalSamples * (b.x1 - b.x0)); });

  const yMax = Math.max(d3.max(bins, b => b.density) || 0, normalPDF(0) * 1.05);
  const y = d3.scaleLinear().domain([0, yMax]).nice().range([d.height, 0]);

  // Axes
  histG.select('.x-axis')
    .attr('transform', `translate(0,${d.height})`)
    .transition().duration(300)
    .call(d3.axisBottom(x).ticks(8));
  histG.select('.y-axis')
    .transition().duration(300)
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.3f')));

  // Axis labels
  histG.select('.x-label')
    .attr('x', d.width / 2).attr('y', d.height + 35)
    .attr('text-anchor', 'middle')
    .text('Standardized sum z');
  histG.select('.y-label')
    .attr('transform', `rotate(-90)`)
    .attr('x', -d.height / 2).attr('y', -38)
    .attr('text-anchor', 'middle')
    .text('Density');

  // Bars
  const bars = histG.select('.bars').selectAll('.hist-bar').data(bins);
  bars.enter().append('rect').attr('class', 'hist-bar')
    .attr('fill', 'var(--viz-1)')
    .attr('opacity', 0.65)
    .merge(bars)
    .transition().duration(350)
    .attr('x', b => x(b.x0) + 0.5)
    .attr('y', b => y(b.density))
    .attr('width', b => Math.max(0, x(b.x1) - x(b.x0) - 1))
    .attr('height', b => Math.max(0, d.height - y(b.density)));
  bars.exit().remove();

  // Normal curve
  if (state.showNormal) {
    const nPoints = 200;
    const curveData = d3.range(nPoints).map(i => {
      const xv = xMin + (xMax - xMin) * i / (nPoints - 1);
      return { x: xv, y: normalPDF(xv) };
    });
    const line = d3.line().x(p => x(p.x)).y(p => y(p.y)).curve(d3.curveBasis);
    histG.select('.normal-curve')
      .datum(curveData)
      .transition().duration(300)
      .attr('d', line)
      .attr('opacity', 0.85);
  } else {
    histG.select('.normal-curve').attr('opacity', 0);
  }

  // Berry-Esseen band
  if (state.showBerryEsseen && state.n >= 1) {
    const dist = DISTRIBUTIONS[state.distribution];
    const rho = dist.thirdAbsMoment;
    const sigma3 = Math.pow(Math.sqrt(dist.variance), 3);
    const C = 0.4748;
    const bound = C * rho / (sigma3 * Math.sqrt(state.n));
    const clampedBound = Math.min(bound, 0.5); // cap at 0.5 for display

    const nPts = 200;
    const bandPoints = [];
    for (let i = 0; i < nPts; i++) {
      const xv = xMin + (xMax - xMin) * i / (nPts - 1);
      const cdfVal = normalCDF(xv);
      const pdfVal = normalPDF(xv);
      // The band in density space: approximate as pdf +/- bound * scaling
      // Berry-Esseen is about CDF, but we visualize as band around PDF
      // Use: d/dx [Phi(x) +/- eps] = phi(x), so the band is around the curve
      // We'll shade the area showing the CDF bound translated to density
      bandPoints.push({ x: xv, yLow: Math.max(0, pdfVal - clampedBound * 2), yHigh: pdfVal + clampedBound * 2 });
    }

    const area = d3.area()
      .x(p => x(p.x))
      .y0(p => y(p.yLow))
      .y1(p => y(p.yHigh))
      .curve(d3.curveBasis);

    histG.select('.berry-esseen-band')
      .datum(bandPoints)
      .transition().duration(300)
      .attr('d', area)
      .attr('opacity', 0.08);
  } else {
    histG.select('.berry-esseen-band').attr('opacity', 0);
  }
}

/* ---- Q-Q Panel ---------------------------------------------- */
let qqSVG, qqG;
function initQQ() {
  const container = document.querySelector('#qq-panel .chart-area');
  qqSVG = d3.select(container).append('svg')
    .attr('preserveAspectRatio', 'xMidYMid meet');
  qqG = qqSVG.append('g');
  qqG.append('g').attr('class', 'axis x-axis');
  qqG.append('g').attr('class', 'axis y-axis');
  qqG.append('line').attr('class', 'qq-diagonal');
  qqG.append('g').attr('class', 'dots');
  qqG.append('text').attr('class', 'axis-label x-label');
  qqG.append('text').attr('class', 'axis-label y-label');
}

function updateQQ(data) {
  const container = document.querySelector('#qq-panel .chart-area');
  const d = dims(container, SMALL_MARGIN);
  qqSVG
    .attr('viewBox', `0 0 ${d.width + d.margin.left + d.margin.right} ${d.height + d.margin.top + d.margin.bottom}`)
    .attr('width', d.width + d.margin.left + d.margin.right)
    .attr('height', d.height + d.margin.top + d.margin.bottom);
  qqG.attr('transform', `translate(${d.margin.left},${d.margin.top})`);

  // Subsample for performance
  const sorted = Float64Array.from(data).sort();
  const maxPoints = 200;
  const step = Math.max(1, Math.floor(sorted.length / maxPoints));
  const points = [];
  for (let i = 0; i < sorted.length; i += step) {
    const p = (i + 0.5) / sorted.length;
    const theoretical = normalQuantile(p);
    points.push({ theoretical, empirical: sorted[i] });
  }

  const extent = Math.max(
    Math.abs(d3.min(points, p => p.theoretical)),
    Math.abs(d3.max(points, p => p.theoretical)),
    Math.abs(d3.min(points, p => p.empirical)),
    Math.abs(d3.max(points, p => p.empirical)),
    3
  );

  const x = d3.scaleLinear().domain([-extent, extent]).range([0, d.width]);
  const y = d3.scaleLinear().domain([-extent, extent]).range([d.height, 0]);

  qqG.select('.x-axis')
    .attr('transform', `translate(0,${d.height})`)
    .transition().duration(300)
    .call(d3.axisBottom(x).ticks(5));
  qqG.select('.y-axis')
    .transition().duration(300)
    .call(d3.axisLeft(y).ticks(5));

  qqG.select('.x-label')
    .attr('x', d.width / 2).attr('y', d.height + 30)
    .attr('text-anchor', 'middle')
    .text('N(0,1) quantiles');
  qqG.select('.y-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -d.height / 2).attr('y', -35)
    .attr('text-anchor', 'middle')
    .text('Sample quantiles');

  // Diagonal line
  qqG.select('.qq-diagonal')
    .attr('x1', x(-extent)).attr('y1', y(-extent))
    .attr('x2', x(extent)).attr('y2', y(extent));

  // Dots
  const dots = qqG.select('.dots').selectAll('.qq-dot').data(points);
  dots.enter().append('circle').attr('class', 'qq-dot')
    .merge(dots)
    .transition().duration(300)
    .attr('cx', p => x(p.theoretical))
    .attr('cy', p => y(p.empirical))
    .attr('r', 2.5);
  dots.exit().remove();
}

/* ---- Moments Panel ------------------------------------------ */
let momSVG, momG;
function initMoments() {
  const container = document.querySelector('#moments-panel .chart-area');
  momSVG = d3.select(container).append('svg')
    .attr('preserveAspectRatio', 'xMidYMid meet');
  momG = momSVG.append('g');
  momG.append('g').attr('class', 'axis x-axis');
  momG.append('g').attr('class', 'axis y-axis');
  momG.append('path').attr('class', 'moment-line skewness');
  momG.append('path').attr('class', 'moment-line kurtosis');
  momG.append('line').attr('class', 'zero-line');
  momG.append('g').attr('class', 'skew-dots');
  momG.append('g').attr('class', 'kurt-dots');
  momG.append('text').attr('class', 'axis-label x-label');
  momG.append('text').attr('class', 'axis-label y-label');

  // Legend
  const legend = d3.select('#moments-panel').append('div').attr('class', 'moments-legend');
  legend.append('div').attr('class', 'legend-item')
    .html('<span class="legend-swatch" style="background:var(--viz-1)"></span> Skewness');
  legend.append('div').attr('class', 'legend-item')
    .html('<span class="legend-swatch" style="background:var(--viz-2)"></span> Excess kurtosis');
}

function updateMoments() {
  const container = document.querySelector('#moments-panel .chart-area');
  const d = dims(container, SMALL_MARGIN);
  momSVG
    .attr('viewBox', `0 0 ${d.width + d.margin.left + d.margin.right} ${d.height + d.margin.top + d.margin.bottom}`)
    .attr('width', d.width + d.margin.left + d.margin.right)
    .attr('height', d.height + d.margin.top + d.margin.bottom);
  momG.attr('transform', `translate(${d.margin.left},${d.margin.top})`);

  const data = momentsHistory;
  if (data.length === 0) return;

  const x = d3.scaleLinear()
    .domain([1, d3.max(data, p => p.n)])
    .range([0, d.width]);

  const yExtent = [
    Math.min(-1, d3.min(data, p => Math.min(p.skewness, p.kurtosis))),
    Math.max(1, d3.max(data, p => Math.max(p.skewness, p.kurtosis)))
  ];
  const y = d3.scaleLinear().domain(yExtent).nice().range([d.height, 0]);

  momG.select('.x-axis')
    .attr('transform', `translate(0,${d.height})`)
    .transition().duration(300)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('d')));
  momG.select('.y-axis')
    .transition().duration(300)
    .call(d3.axisLeft(y).ticks(5));

  momG.select('.x-label')
    .attr('x', d.width / 2).attr('y', d.height + 30)
    .attr('text-anchor', 'middle')
    .text('n (summands)');
  momG.select('.y-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -d.height / 2).attr('y', -35)
    .attr('text-anchor', 'middle')
    .text('Value');

  // Zero line
  momG.select('.zero-line')
    .attr('x1', 0).attr('x2', d.width)
    .attr('y1', y(0)).attr('y2', y(0))
    .attr('stroke', '#cbd5e1')
    .attr('stroke-dasharray', '4 3')
    .attr('stroke-width', 1);

  const line = d3.line().curve(d3.curveMonotoneX);

  // Skewness line
  momG.select('.moment-line.skewness')
    .datum(data)
    .transition().duration(300)
    .attr('d', line.x(p => x(p.n)).y(p => y(p.skewness)));

  // Kurtosis line
  momG.select('.moment-line.kurtosis')
    .datum(data)
    .transition().duration(300)
    .attr('d', line.x(p => x(p.n)).y(p => y(p.kurtosis)));

  // Skewness dots (only last point highlighted)
  const lastSkew = [data[data.length - 1]];
  const sd = momG.select('.skew-dots').selectAll('.moment-dot').data(lastSkew);
  sd.enter().append('circle').attr('class', 'moment-dot')
    .attr('fill', 'var(--viz-1)')
    .merge(sd)
    .transition().duration(300)
    .attr('cx', p => x(p.n)).attr('cy', p => y(p.skewness)).attr('r', 4);
  sd.exit().remove();

  const lastKurt = [data[data.length - 1]];
  const kd = momG.select('.kurt-dots').selectAll('.moment-dot').data(lastKurt);
  kd.enter().append('circle').attr('class', 'moment-dot')
    .attr('fill', 'var(--viz-2)')
    .merge(kd)
    .transition().duration(300)
    .attr('cx', p => x(p.n)).attr('cy', p => y(p.kurtosis)).attr('r', 4);
  kd.exit().remove();
}

/* ---- Controls Panel ----------------------------------------- */
function buildControls() {
  const panel = d3.select('#controls');
  panel.html('');

  panel.append('h2').text('Parameters');

  // Distribution dropdown
  const distGroup = panel.append('div').attr('class', 'control-group dropdown-control');
  distGroup.append('label').text('Distribution');
  const select = distGroup.append('select').attr('id', 'dist-select');
  for (const [key, dist] of Object.entries(DISTRIBUTIONS)) {
    select.append('option').attr('value', key).text(dist.label);
  }
  select.property('value', state.distribution);
  select.on('change', function () {
    state.distribution = this.value;
    state.seed = Math.floor(Math.random() * 100000);
    fullUpdate();
  });

  // n slider
  const nGroup = panel.append('div').attr('class', 'control-group slider-control');
  const nLabel = nGroup.append('label');
  nLabel.append('span').text('n (summands) ');
  nLabel.append('span').attr('class', 'value-display').attr('id', 'n-display').text(state.n);
  const nSlider = nGroup.append('input').attr('type', 'range')
    .attr('min', 1).attr('max', 500).attr('step', 1)
    .attr('value', state.n).attr('id', 'n-slider');
  nSlider.on('input', function () {
    state.n = +this.value;
    d3.select('#n-display').text(state.n);
    quickUpdate();
  });

  // Samples slider
  const sampGroup = panel.append('div').attr('class', 'control-group slider-control');
  const sampLabel = sampGroup.append('label');
  sampLabel.append('span').text('Samples ');
  sampLabel.append('span').attr('class', 'value-display').attr('id', 'samp-display')
    .text(d3.format(',')(state.numSamples));
  const sampSlider = sampGroup.append('input').attr('type', 'range')
    .attr('min', 1000).attr('max', 50000).attr('step', 1000)
    .attr('value', state.numSamples);
  sampSlider.on('input', function () {
    state.numSamples = +this.value;
    d3.select('#samp-display').text(d3.format(',')(state.numSamples));
    fullUpdate();
  });

  // Bins slider
  const binGroup = panel.append('div').attr('class', 'control-group slider-control');
  const binLabel = binGroup.append('label');
  binLabel.append('span').text('Bins ');
  binLabel.append('span').attr('class', 'value-display').attr('id', 'bin-display').text(state.numBins);
  const binSlider = binGroup.append('input').attr('type', 'range')
    .attr('min', 20).attr('max', 100).attr('step', 1)
    .attr('value', state.numBins);
  binSlider.on('input', function () {
    state.numBins = +this.value;
    d3.select('#bin-display').text(state.numBins);
    quickUpdate();
  });

  panel.append('hr').attr('class', 'control-divider');

  // Show N(0,1) toggle
  const normalToggle = panel.append('label').attr('class', 'toggle-control');
  const normalCheck = normalToggle.append('input').attr('type', 'checkbox')
    .property('checked', state.showNormal);
  normalToggle.append('span').attr('class', 'toggle-track');
  normalToggle.append('span').attr('class', 'toggle-label').text('N(0,1) overlay');
  normalCheck.on('change', function () {
    state.showNormal = this.checked;
    quickUpdate();
  });

  // Berry-Esseen toggle
  const beToggle = panel.append('label').attr('class', 'toggle-control');
  const beCheck = beToggle.append('input').attr('type', 'checkbox')
    .property('checked', state.showBerryEsseen);
  beToggle.append('span').attr('class', 'toggle-track');
  beToggle.append('span').attr('class', 'toggle-label').text('Berry-Esseen band');
  beCheck.on('change', function () {
    state.showBerryEsseen = this.checked;
    quickUpdate();
  });

  panel.append('hr').attr('class', 'control-divider');

  // Play/Pause button
  const playBtn = panel.append('button').attr('class', 'play-btn').attr('id', 'play-btn');
  playBtn.append('span').attr('class', 'play-icon');
  playBtn.append('span').attr('class', 'play-text').text('Animate n');
  playBtn.on('click', togglePlay);

  // Regenerate button
  panel.append('button').attr('class', 'btn btn-secondary')
    .style('width', '100%').style('margin-top', 'var(--space-sm)')
    .text('Regenerate')
    .on('click', () => {
      state.seed = Math.floor(Math.random() * 100000);
      fullUpdate();
    });

  panel.append('hr').attr('class', 'control-divider');

  // Stats readout
  panel.append('div').attr('class', 'stats-readout').attr('id', 'stats-readout');

  // Formula display
  panel.append('div').attr('class', 'formula-display').attr('id', 'formula');
}

function updateStats(moments) {
  const readout = d3.select('#stats-readout');
  readout.html('');
  const items = [
    { label: 'Mean', val: moments.mean.toFixed(4) },
    { label: 'Std Dev', val: moments.sd.toFixed(4) },
    { label: 'Skewness', val: moments.skewness.toFixed(4) },
    { label: 'Ex. Kurt.', val: moments.kurtosis.toFixed(4) }
  ];
  items.forEach(item => {
    const div = readout.append('div').attr('class', 'stat-item');
    div.append('span').attr('class', 'stat-label').text(item.label);
    div.append('span').attr('class', 'stat-val').text(item.val);
  });

  // Berry-Esseen bound
  const dist = DISTRIBUTIONS[state.distribution];
  const rho = dist.thirdAbsMoment;
  const sigma3 = Math.pow(Math.sqrt(dist.variance), 3);
  const beBound = 0.4748 * rho / (sigma3 * Math.sqrt(state.n));
  const beDiv = readout.append('div').attr('class', 'stat-item');
  beDiv.append('span').attr('class', 'stat-label').text('BE bound');
  beDiv.append('span').attr('class', 'stat-val').text(beBound.toFixed(4));
}

function updateFormula() {
  const el = document.getElementById('formula');
  if (!el) return;
  try {
    katex.render(
      String.raw`Z_n = \frac{S_n - n\mu}{\sigma\sqrt{n}} \xrightarrow{d} \mathcal{N}(0,1)`,
      el, { displayMode: true, throwOnError: false }
    );
  } catch (e) {
    el.textContent = 'Z_n = (S_n - n*mu) / (sigma * sqrt(n)) -> N(0,1)';
  }
}

/* ---- Info Panel --------------------------------------------- */
function buildInfo() {
  const panel = d3.select('#info');
  panel.html('');

  // Wrap in max-width container matching module layout
  const wrapper = panel.append('div').style('max-width', '1400px').style('margin', '0 auto')
    .style('padding', '0 var(--space-xl)');

  wrapper.append('h2').text('Central Limit Theorem');

  const cltStatement = wrapper.append('div').attr('class', 'math-block').attr('id', 'clt-formula');
  try {
    katex.render(
      String.raw`\text{If } X_1, X_2, \ldots \text{ are i.i.d. with } E[X_i] = \mu, \; \text{Var}(X_i) = \sigma^2 < \infty, \text{ then } \frac{\sum_{i=1}^n X_i - n\mu}{\sigma\sqrt{n}} \xrightarrow{d} \mathcal{N}(0,1)`,
      cltStatement.node(), { displayMode: true, throwOnError: false }
    );
  } catch (e) {
    cltStatement.text('If X1, X2, ... are i.i.d. with mean mu and finite variance sigma^2, then (sum - n*mu)/(sigma*sqrt(n)) converges in distribution to N(0,1).');
  }

  wrapper.append('p')
    .text('The Central Limit Theorem is one of the most remarkable results in probability. Regardless of the shape of the parent distribution (as long as it has finite variance), the standardized sum converges to a Gaussian. Use this studio to see the convergence in action for different distributions.');

  // Berry-Esseen section
  const details = wrapper.append('details');
  details.append('summary').text('Berry-Esseen Theorem');
  const body = details.append('div').attr('class', 'detail-body');

  const beFormula = body.append('div').attr('class', 'math-block').attr('id', 'be-formula');
  try {
    katex.render(
      String.raw`\sup_{x \in \mathbb{R}} \left| F_n(x) - \Phi(x) \right| \leq \frac{C \cdot \rho}{\sigma^3 \sqrt{n}}, \quad C \leq 0.4748, \; \rho = E\!\left[|X - \mu|^3\right]`,
      beFormula.node(), { displayMode: true, throwOnError: false }
    );
  } catch (e) {
    beFormula.text('sup|F_n(x) - Phi(x)| <= C * rho / (sigma^3 * sqrt(n)), C <= 0.4748');
  }

  body.append('p')
    .text('The Berry-Esseen theorem gives a quantitative rate of convergence in the CLT. The bound depends on the third absolute moment of the distribution. Toggle the Berry-Esseen band to visualize this bound around the normal curve.');

  // Interpretation section
  const details2 = wrapper.append('details');
  details2.append('summary').text('Reading the Panels');
  const body2 = details2.append('div').attr('class', 'detail-body');

  const ul = body2.append('ul');
  ul.append('li').html('<strong>Histogram:</strong> Shows the empirical density of the standardized sums. As n grows, this should converge to the N(0,1) bell curve (red dashed line).');
  ul.append('li').html('<strong>Q-Q Plot:</strong> Quantile-quantile plot against N(0,1). Points on the diagonal indicate perfect Gaussian behavior. Deviations in the tails reveal slower convergence there.');
  ul.append('li').html('<strong>Moments:</strong> Skewness and excess kurtosis vs n. Both should converge to 0 as n increases, confirming the Gaussian limit. Heavy-tailed distributions (Pareto) converge more slowly.');

  // Distribution notes
  const details3 = wrapper.append('details');
  details3.append('summary').text('Distribution Notes');
  const body3 = details3.append('div').attr('class', 'detail-body');

  const ul2 = body3.append('ul');
  ul2.append('li').html('<strong>Uniform(0,1):</strong> Symmetric, converges very fast. Even n=3 looks nearly Gaussian (Irwin-Hall distribution).');
  ul2.append('li').html('<strong>Exponential(1):</strong> Right-skewed. Needs n ~ 30 for good convergence.');
  ul2.append('li').html('<strong>Bernoulli(0.5):</strong> Discrete and symmetric. The standardized sum is a shifted, scaled Binomial.');
  ul2.append('li').html('<strong>Poisson(3):</strong> Discrete and mildly skewed. Converges at moderate pace.');
  ul2.append('li').html('<strong>Chi-squared(3):</strong> Sum of 3 squared normals. Right-skewed; needs moderate n.');
  ul2.append('li').html('<strong>Beta(2,5):</strong> Asymmetric, bounded support. Converges steadily.');
  ul2.append('li').html('<strong>Dice {1,...,6}:</strong> Discrete uniform. Classic example; convergence is swift.');
  ul2.append('li').html('<strong>Pareto(3,1):</strong> Heavy-tailed with finite variance. Visible skewness persists at small n, converges slowly.');
}

/* ---- Play Animation ----------------------------------------- */
function togglePlay() {
  if (state.playing) {
    stopPlay();
  } else {
    startPlay();
  }
}

function startPlay() {
  state.playing = true;
  state.n = 1;
  d3.select('#n-slider').property('value', 1);
  d3.select('#n-display').text(1);
  updatePlayButton();

  const maxN = +d3.select('#n-slider').attr('max');
  const msPerStep = 60; // ms per increment of n
  let lastTime = null;
  let accumulator = 0;

  function step(timestamp) {
    if (!state.playing) return;
    if (lastTime === null) lastTime = timestamp;
    accumulator += timestamp - lastTime;
    lastTime = timestamp;

    let stepped = false;
    while (accumulator >= msPerStep && state.n < maxN) {
      // Adaptive stepping: increase step size for large n
      const inc = state.n < 20 ? 1 : state.n < 100 ? 2 : 5;
      state.n = Math.min(state.n + inc, maxN);
      accumulator -= msPerStep;
      stepped = true;
    }

    if (stepped) {
      d3.select('#n-slider').property('value', state.n);
      d3.select('#n-display').text(state.n);
      quickUpdate();
    }

    if (state.n >= maxN) {
      stopPlay();
      return;
    }

    state.animFrame = requestAnimationFrame(step);
  }

  state.animFrame = requestAnimationFrame(step);
}

function stopPlay() {
  state.playing = false;
  if (state.animFrame) {
    cancelAnimationFrame(state.animFrame);
    state.animFrame = null;
  }
  updatePlayButton();
}

function updatePlayButton() {
  const btn = d3.select('#play-btn');
  btn.classed('playing', state.playing);
  btn.select('.play-text').text(state.playing ? 'Pause' : 'Animate n');
}

/* ---- Update Functions --------------------------------------- */
function quickUpdate() {
  // Fast update: just regenerate data for current n and update charts
  const data = generateData();
  const moments = computeMoments(data);
  updateHistogram(data);
  updateQQ(data);
  updateStats(moments);

  // Don't rebuild full moments history on every quick update during animation
  if (!state.playing) {
    rebuildMomentsHistory();
    updateMoments();
  }
}

function fullUpdate() {
  const data = generateData();
  const moments = computeMoments(data);
  updateHistogram(data);
  updateQQ(data);
  updateStats(moments);
  rebuildMomentsHistory();
  updateMoments();
  updateFormula();
}

/* ---- Resize Handler ----------------------------------------- */
let resizeTimer;
function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    quickUpdate();
    rebuildMomentsHistory();
    updateMoments();
  }, 150);
}

/* ---- Initialize --------------------------------------------- */
function init() {
  initHistogram();
  initQQ();
  initMoments();
  buildControls();
  buildInfo();
  fullUpdate();
  window.addEventListener('resize', onResize);
}

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
