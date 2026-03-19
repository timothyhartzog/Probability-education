/* ============================================================
   Module 8.1 — Prior-to-Posterior Machine
   ============================================================
   Interactive Bayesian conjugate updating across four families:
   Beta-Binomial, Normal-Normal, Gamma-Poisson, Dirichlet-Multinomial.
   Shows prior/likelihood/posterior overlay, sequential updating
   with ghost curves, credible intervals, and animated data panel.
   ============================================================ */

import * as d3 from 'd3';
import katex from 'katex';
import '../../lib/copy-code.js';

/* ---- Seeded PRNG (mulberry32) ------------------------------- */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rng = mulberry32(42);

function randUniform() { return rng(); }

function randNormal(mu, sigma) {
  const u1 = randUniform(), u2 = randUniform();
  return mu + sigma * Math.sqrt(-2 * Math.log(u1 + 1e-15)) * Math.cos(2 * Math.PI * u2);
}

function randPoisson(lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= randUniform(); } while (p > L);
  return k - 1;
}

function randBinomial(p) {
  return randUniform() < p ? 1 : 0;
}

function randCategorical(probs) {
  const u = randUniform();
  let cum = 0;
  for (let i = 0; i < probs.length; i++) {
    cum += probs[i];
    if (u < cum) return i;
  }
  return probs.length - 1;
}

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

function betaFn(a, b) {
  return Math.exp(lnGamma(a) + lnGamma(b) - lnGamma(a + b));
}

function betaPDF(x, a, b) {
  if (x <= 0 || x >= 1) return 0;
  return Math.pow(x, a - 1) * Math.pow(1 - x, b - 1) / betaFn(a, b);
}

function normalPDF(x, mu, sigma) {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

function gammaPDF(x, alpha, beta) {
  if (x <= 0) return 0;
  return Math.pow(beta, alpha) * Math.pow(x, alpha - 1) * Math.exp(-beta * x) / Math.exp(lnGamma(alpha));
}

/** Regularized incomplete beta function via Lentz continued fraction. */
function betaIncomplete(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  // Use symmetry to keep x in the region where the CF converges faster
  if (x > (a + 1) / (a + b + 2)) return 1 - betaIncomplete(1 - x, b, a);
  const lnPre = a * Math.log(x) + b * Math.log(1 - x) - Math.log(a) - lnGamma(a) - lnGamma(b) + lnGamma(a + b);
  // Lentz's method: accumulate the continued fraction product
  const tiny = 1e-30;
  let f = tiny;
  let C = f, D = 0;
  for (let m = 0; m <= 200; m++) {
    // Even step (d_{2m})
    let d = m === 0 ? 1
      : m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
    D = 1 + d * D; if (Math.abs(D) < tiny) D = tiny; D = 1 / D;
    C = 1 + d / C; if (Math.abs(C) < tiny) C = tiny;
    f *= C * D;
    // Odd step (d_{2m+1})
    d = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
    D = 1 + d * D; if (Math.abs(D) < tiny) D = tiny; D = 1 / D;
    C = 1 + d / C; if (Math.abs(C) < tiny) C = tiny;
    const delta = C * D;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-10) break;
  }
  return Math.exp(lnPre) * f;
}

function betaCDFNumeric(x, a, b) {
  const n = 500;
  let sum = 0;
  const dx = x / n;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * dx;
    sum += betaPDF(t, a, b) * dx;
  }
  return Math.min(1, Math.max(0, sum));
}

function betaQuantile(p, a, b) {
  // Bisection method
  let lo = 0, hi = 1;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (betaCDFNumeric(mid, a, b) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function normalCDF(x, mu, sigma) {
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)));
}

function erf(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function normalQuantile(p, mu, sigma) {
  // Rational approximation (Abramowitz & Stegun 26.2.23)
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = p < 0.5 ? p : 1 - p;
  const t = Math.sqrt(-2 * Math.log(a));
  const c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
  const d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
  let z = t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
  if (p < 0.5) z = -z;
  return mu + sigma * z;
}

function gammaCDFNumeric(x, alpha, beta) {
  if (x <= 0) return 0;
  const n = 600;
  const dx = x / n;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * dx;
    sum += gammaPDF(t, alpha, beta) * dx;
  }
  return Math.min(1, Math.max(0, sum));
}

function gammaQuantile(p, alpha, beta) {
  // Bisection
  let lo = 0, hi = alpha / beta + 10 * Math.sqrt(alpha) / beta;
  if (hi < 1) hi = 10;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (gammaCDFNumeric(mid, alpha, beta) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/* ---- Conjugate families ------------------------------------- */
const FAMILIES = {
  'beta-binomial': {
    label: 'Beta-Binomial',
    priorName: 'Beta',
    likelihoodName: 'Binomial',
    paramLabels: ['\u03B1 (prior successes)', '\u03B2 (prior failures)'],
    paramRanges: [[0.1, 30, 2, 0.1], [0.1, 30, 2, 0.1]],
    dataLabel: 'True p (hidden)',
    dataRange: [0.01, 0.99, 0.5, 0.01],
    domain: () => [0.001, 0.999],
    priorPDF: (x, p) => betaPDF(x, p[0], p[1]),
    posterior: (p, data) => [p[0] + data.successes, p[1] + data.failures],
    likelihoodFn: (x, data) => {
      const n = data.successes + data.failures;
      if (n === 0) return 1;
      const s = data.successes;
      return Math.pow(x, s) * Math.pow(1 - x, n - s);
    },
    posteriorMean: (p) => p[0] / (p[0] + p[1]),
    posteriorVar: (p) => (p[0] * p[1]) / ((p[0] + p[1]) ** 2 * (p[0] + p[1] + 1)),
    posteriorMode: (p) => (p[0] > 1 && p[1] > 1) ? (p[0] - 1) / (p[0] + p[1] - 2) : p[0] / (p[0] + p[1]),
    credible: (p, level) => {
      const lo = (1 - level) / 2;
      return [betaQuantile(lo, p[0], p[1]), betaQuantile(1 - lo, p[0], p[1])];
    },
    mle: (data) => {
      const n = data.successes + data.failures;
      return n > 0 ? data.successes / n : 0.5;
    },
    generateObs: (trueParam) => randBinomial(trueParam) === 1 ? 'success' : 'failure',
    addObs: (data, obs) => {
      if (obs === 'success') data.successes++;
      else data.failures++;
    },
    initData: () => ({ successes: 0, failures: 0, observations: [] }),
    nObs: (data) => data.successes + data.failures,
    paramTeX: (p) => `\\text{Beta}(${p[0].toFixed(1)},\\,${p[1].toFixed(1)})`,
    formulaTeX: String.raw`\text{Prior: } \text{Beta}(\alpha,\beta) \quad\longrightarrow\quad \text{Posterior: } \text{Beta}(\alpha + s,\; \beta + f)`,
    interpretTeX: String.raw`\alpha \text{ = pseudo-successes}, \quad \beta \text{ = pseudo-failures}. \quad \text{Mean} = \frac{\alpha}{\alpha+\beta}`,
  },
  'normal-normal': {
    label: 'Normal-Normal',
    priorName: 'Normal',
    likelihoodName: 'Normal',
    paramLabels: ['\u03BC\u2080 (prior mean)', '\u03C3\u2080 (prior std dev)'],
    paramRanges: [[-10, 10, 0, 0.1], [0.1, 10, 3, 0.1]],
    dataLabel: 'True \u03BC (hidden)',
    dataRange: [-10, 10, 2, 0.1],
    domain: () => [-15, 15],
    priorPDF: (x, p) => normalPDF(x, p[0], p[1]),
    posterior: (p, data) => {
      const sigma = 2; // known observation noise
      const n = data.values.length;
      if (n === 0) return [...p];
      const priorPrec = 1 / (p[1] * p[1]);
      const likPrec = n / (sigma * sigma);
      const postPrec = priorPrec + likPrec;
      const postMean = (priorPrec * p[0] + likPrec * (data.sum / n)) / postPrec;
      const postStd = 1 / Math.sqrt(postPrec);
      return [postMean, postStd];
    },
    likelihoodFn: (x, data) => {
      const sigma = 2;
      const n = data.values.length;
      if (n === 0) return 1;
      const xbar = data.sum / n;
      return normalPDF(x, xbar, sigma / Math.sqrt(n));
    },
    posteriorMean: (p) => p[0],
    posteriorVar: (p) => p[1] * p[1],
    posteriorMode: (p) => p[0],
    credible: (p, level) => {
      const lo = (1 - level) / 2;
      return [normalQuantile(lo, p[0], p[1]), normalQuantile(1 - lo, p[0], p[1])];
    },
    mle: (data) => data.values.length > 0 ? data.sum / data.values.length : 0,
    generateObs: (trueParam) => randNormal(trueParam, 2),
    addObs: (data, obs) => { data.values.push(obs); data.sum += obs; },
    initData: () => ({ values: [], sum: 0, observations: [] }),
    nObs: (data) => data.values.length,
    paramTeX: (p) => `\\mathcal{N}(${p[0].toFixed(2)},\\,${(p[1]).toFixed(2)}^2)`,
    formulaTeX: String.raw`\text{Prior: } \mathcal{N}(\mu_0, \sigma_0^2), \;\; \text{Likelihood: } \mathcal{N}(\mu, \sigma^2) \;\;\longrightarrow\;\; \text{Posterior: } \mathcal{N}\!\left(\frac{\frac{\mu_0}{\sigma_0^2}+\frac{n\bar{x}}{\sigma^2}}{\frac{1}{\sigma_0^2}+\frac{n}{\sigma^2}},\;\; \frac{1}{\frac{1}{\sigma_0^2}+\frac{n}{\sigma^2}}\right)`,
    interpretTeX: String.raw`\text{Precision-weighted mean: prior and data precisions add.} \quad \sigma^2_{\text{known}} = 4`,
  },
  'gamma-poisson': {
    label: 'Gamma-Poisson',
    priorName: 'Gamma',
    likelihoodName: 'Poisson',
    paramLabels: ['\u03B1 (shape)', '\u03B2 (rate)'],
    paramRanges: [[0.1, 30, 2, 0.1], [0.1, 15, 1, 0.1]],
    dataLabel: 'True \u03BB (hidden)',
    dataRange: [0.1, 15, 3, 0.1],
    domain: () => [0.001, 20],
    priorPDF: (x, p) => gammaPDF(x, p[0], p[1]),
    posterior: (p, data) => [p[0] + data.sumCounts, p[1] + data.nObs],
    likelihoodFn: (x, data) => {
      if (data.nObs === 0) return 1;
      // Likelihood proportional to lambda^(sum x_i) * exp(-n*lambda)
      return Math.pow(x, data.sumCounts) * Math.exp(-data.nObs * x);
    },
    posteriorMean: (p) => p[0] / p[1],
    posteriorVar: (p) => p[0] / (p[1] * p[1]),
    posteriorMode: (p) => p[0] > 1 ? (p[0] - 1) / p[1] : p[0] / p[1],
    credible: (p, level) => {
      const lo = (1 - level) / 2;
      return [gammaQuantile(lo, p[0], p[1]), gammaQuantile(1 - lo, p[0], p[1])];
    },
    mle: (data) => data.nObs > 0 ? data.sumCounts / data.nObs : 1,
    generateObs: (trueParam) => randPoisson(trueParam),
    addObs: (data, obs) => { data.counts.push(obs); data.sumCounts += obs; data.nObs++; },
    initData: () => ({ counts: [], sumCounts: 0, nObs: 0, observations: [] }),
    nObs: (data) => data.nObs,
    paramTeX: (p) => `\\text{Gamma}(${p[0].toFixed(1)},\\,${p[1].toFixed(1)})`,
    formulaTeX: String.raw`\text{Prior: } \text{Gamma}(\alpha,\beta) \quad\longrightarrow\quad \text{Posterior: } \text{Gamma}(\alpha + \textstyle\sum x_i,\; \beta + n)`,
    interpretTeX: String.raw`\alpha \text{ = pseudo-total count}, \quad \beta \text{ = pseudo-observations}. \quad \text{Mean} = \frac{\alpha}{\beta}`,
  },
  'dirichlet-multinomial': {
    label: 'Dirichlet-Multinomial',
    priorName: 'Dirichlet',
    likelihoodName: 'Multinomial',
    paramLabels: ['\u03B1 (concentration per category)', 'K (categories)'],
    paramRanges: [[0.1, 10, 1, 0.1], [3, 6, 4, 1]],
    dataLabel: 'Skew towards cat 1',
    dataRange: [0, 1, 0.4, 0.05],
    domain: () => [0.001, 0.999],
    priorPDF: (x, p) => {
      // Marginal Beta distribution for category 1
      const k = Math.round(p[1]);
      return betaPDF(x, p[0], p[0] * (k - 1));
    },
    posterior: (p, data) => {
      const k = Math.round(p[1]);
      const n1 = data.categoryCounts[0] || 0;
      const nRest = data.totalObs - n1;
      // Marginal for category 1 is Beta(alpha1 + n1, sum_rest alpha_j + n_rest)
      return [p[0] + n1, p[1], data.categoryCounts];
    },
    likelihoodFn: (x, data) => {
      // Marginal likelihood for theta_1
      if (data.totalObs === 0) return 1;
      const n1 = data.categoryCounts[0] || 0;
      const nRest = data.totalObs - n1;
      return Math.pow(x, n1) * Math.pow(1 - x, nRest);
    },
    posteriorMean: (p) => {
      const k = Math.round(p[1]);
      const a1 = p[0];
      const aSum = p[0] * k;
      return a1 / aSum;
    },
    posteriorVar: (p) => {
      const k = Math.round(p[1]);
      const a1 = p[0];
      const aSum = p[0] * k;
      return (a1 * (aSum - a1)) / (aSum * aSum * (aSum + 1));
    },
    posteriorMode: (p) => {
      const k = Math.round(p[1]);
      const a1 = p[0];
      const aSum = p[0] * k;
      return a1 > 1 ? (a1 - 1) / (aSum - k) : a1 / aSum;
    },
    credible: (p, level) => {
      const k = Math.round(p[1]);
      const a1 = p[0];
      const aRest = p[0] * (k - 1);
      const lo = (1 - level) / 2;
      return [betaQuantile(lo, a1, aRest), betaQuantile(1 - lo, a1, aRest)];
    },
    mle: (data) => data.totalObs > 0 ? (data.categoryCounts[0] || 0) / data.totalObs : 0.25,
    generateObs: (trueParam, priorParams) => {
      const k = Math.round(priorParams[1]);
      // Build true probabilities: skew towards category 0
      const probs = [];
      const base = (1 - trueParam) / (k - 1);
      for (let i = 0; i < k; i++) probs.push(i === 0 ? trueParam : base);
      return randCategorical(probs);
    },
    addObs: (data, obs) => {
      data.categoryCounts[obs] = (data.categoryCounts[obs] || 0) + 1;
      data.totalObs++;
    },
    initData: () => ({ categoryCounts: {}, totalObs: 0, observations: [] }),
    nObs: (data) => data.totalObs,
    paramTeX: (p) => {
      const k = Math.round(p[1]);
      return `\\text{Dir}(${Array(k).fill(p[0].toFixed(1)).join(',\\,')})`;
    },
    formulaTeX: String.raw`\text{Prior: } \text{Dir}(\alpha_1,\ldots,\alpha_K) \;\;\longrightarrow\;\; \text{Posterior: } \text{Dir}(\alpha_1 + n_1,\ldots,\alpha_K + n_K)`,
    interpretTeX: String.raw`\alpha_i \text{ = pseudo-counts per category. Shown: marginal for category 1 (Beta).}`,
  },
};

/* ---- Dirichlet overrides for posterior PDF using marginal Beta ---- */
function getDirichletMarginalParams(priorParams, data) {
  const k = Math.round(priorParams[1]);
  const alpha0 = priorParams[0];
  const n1 = (data.categoryCounts && data.categoryCounts[0]) || 0;
  const nRest = data.totalObs - n1;
  const a = alpha0 + n1;
  const b = alpha0 * (k - 1) + nRest;
  return [a, b];
}

/* ---- State -------------------------------------------------- */
const state = {
  family: 'beta-binomial',
  priorParams: [2, 2],
  trueParam: 0.5,
  data: null,
  history: [],        // array of { posteriorParams, nObs }
  sampleSize: 1,
};

function getFamily() { return FAMILIES[state.family]; }

function initData() {
  state.data = getFamily().initData();
  state.history = [];
}

function getPosteriorParams() {
  const fam = getFamily();
  if (state.family === 'dirichlet-multinomial') {
    const marg = getDirichletMarginalParams(state.priorParams, state.data);
    return marg; // returns [a, b] for marginal Beta
  }
  return fam.posterior(state.priorParams, state.data);
}

function getPriorPDFForPlot(x) {
  const fam = getFamily();
  if (state.family === 'dirichlet-multinomial') {
    const k = Math.round(state.priorParams[1]);
    return betaPDF(x, state.priorParams[0], state.priorParams[0] * (k - 1));
  }
  return fam.priorPDF(x, state.priorParams);
}

function getPosteriorPDFForPlot(x) {
  const pp = getPosteriorParams();
  const fam = getFamily();
  if (state.family === 'dirichlet-multinomial' || state.family === 'beta-binomial') {
    return betaPDF(x, pp[0], pp[1]);
  }
  if (state.family === 'normal-normal') {
    return normalPDF(x, pp[0], pp[1]);
  }
  if (state.family === 'gamma-poisson') {
    return gammaPDF(x, pp[0], pp[1]);
  }
  return fam.priorPDF(x, pp);
}

/* ---- Tooltip ------------------------------------------------ */
let tooltip;
function ensureTooltip() {
  if (!tooltip) {
    tooltip = d3.select('body').append('div')
      .attr('class', 'diag-tooltip')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('background', 'rgba(30,41,59,0.92)')
      .style('color', '#fff')
      .style('padding', '6px 10px')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('opacity', 0);
  }
  return tooltip;
}

function showTooltip(event, html) {
  const tt = ensureTooltip();
  tt.html(html).style('opacity', 1)
    .style('left', (event.pageX + 14) + 'px')
    .style('top', (event.pageY - 20) + 'px');
}

function hideTooltip() { ensureTooltip().style('opacity', 0); }

/* ---- Format helpers ----------------------------------------- */
function fmt(v, d = 3) { return v.toFixed(d); }
function fmtShort(v) {
  if (Math.abs(v) >= 100) return v.toFixed(1);
  if (Math.abs(v) >= 10) return v.toFixed(2);
  return v.toFixed(3);
}

/* ============================================================
   1. DISTRIBUTION PANEL — Prior / Likelihood / Posterior
   ============================================================ */
function drawDistributionPanel() {
  const container = d3.select('#distribution-plot');
  container.selectAll('*').remove();

  const fam = getFamily();
  const W = 680, H = 340;
  const margin = { top: 20, right: 25, bottom: 45, left: 50 };
  const iw = W - margin.left - margin.right;
  const ih = H - margin.top - margin.bottom;

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Determine domain
  let [xMin, xMax] = fam.domain();
  if (state.family === 'normal-normal') {
    const pp = getPosteriorParams();
    const spread = Math.max(state.priorParams[1], pp[1]) * 4;
    xMin = Math.min(state.priorParams[0], pp[0]) - spread;
    xMax = Math.max(state.priorParams[0], pp[0]) + spread;
  }
  if (state.family === 'gamma-poisson') {
    const pp = getPosteriorParams();
    xMax = Math.max(pp[0] / pp[1] + 5 * Math.sqrt(pp[0]) / pp[1], state.priorParams[0] / state.priorParams[1] + 5 * Math.sqrt(state.priorParams[0]) / state.priorParams[1], 5);
    xMin = 0.001;
  }

  const nPts = 300;
  const xs = d3.range(nPts).map(i => xMin + (i / (nPts - 1)) * (xMax - xMin));

  // Compute curves
  const priorVals = xs.map(x => getPriorPDFForPlot(x));
  const postVals = xs.map(x => getPosteriorPDFForPlot(x));
  const likVals = xs.map(x => fam.likelihoodFn(x, state.data));

  // Scale likelihood to match posterior peak for visual comparison
  const postMax = d3.max(postVals);
  const likMax = d3.max(likVals);
  const likScale = likMax > 0 ? (postMax / likMax) * 0.85 : 1;
  const scaledLikVals = likVals.map(v => v * likScale);

  const yMax = Math.max(d3.max(priorVals), d3.max(postVals), d3.max(scaledLikVals), 0.1) * 1.1;

  const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, iw]);
  const yScale = d3.scaleLinear().domain([0, yMax]).range([ih, 0]);

  // Axes
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(xScale).ticks(8));
  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(5));

  g.append('text').attr('class', 'axis-label')
    .attr('x', iw / 2).attr('y', ih + 38)
    .attr('text-anchor', 'middle').attr('font-size', 12).attr('fill', '#555')
    .text(state.family === 'beta-binomial' || state.family === 'dirichlet-multinomial' ? '\u03B8' : state.family === 'normal-normal' ? '\u03BC' : '\u03BB');

  g.append('text').attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -ih / 2).attr('y', -38)
    .attr('text-anchor', 'middle').attr('font-size', 12).attr('fill', '#555')
    .text('Density');

  const line = d3.line().x((_, i) => xScale(xs[i])).curve(d3.curveMonotoneX);
  const area = d3.area().x((_, i) => xScale(xs[i])).y0(ih).curve(d3.curveMonotoneX);

  // Prior fill
  g.append('path').datum(priorVals)
    .attr('class', 'prior-fill')
    .attr('d', area.y1(d => yScale(d)));

  // Posterior fill
  g.append('path').datum(postVals)
    .attr('class', 'posterior-fill')
    .attr('d', area.y1(d => yScale(d)));

  // Prior curve
  g.append('path').datum(priorVals)
    .attr('class', 'prior-curve')
    .attr('d', line.y(d => yScale(d)));

  // Likelihood curve (scaled, dashed)
  if (fam.nObs(state.data) > 0) {
    g.append('path').datum(scaledLikVals)
      .attr('class', 'likelihood-curve')
      .attr('d', line.y(d => yScale(d)));
  }

  // Posterior curve
  g.append('path').datum(postVals)
    .attr('class', 'posterior-curve')
    .attr('d', line.y(d => yScale(d)));

  // Legend
  const legend = g.append('g').attr('transform', `translate(${iw - 160}, 8)`);
  const items = [
    { label: 'Prior', color: 'var(--color-primary)', dash: '' },
    { label: 'Likelihood (scaled)', color: 'var(--color-secondary)', dash: '6 3' },
    { label: 'Posterior', color: 'var(--color-accent)', dash: '' },
  ];
  items.forEach((item, i) => {
    const ly = i * 18;
    legend.append('line').attr('x1', 0).attr('x2', 20).attr('y1', ly).attr('y2', ly)
      .attr('stroke', item.color).attr('stroke-width', 2.5)
      .attr('stroke-dasharray', item.dash);
    legend.append('text').attr('x', 26).attr('y', ly + 4)
      .attr('font-size', 11).attr('fill', '#555').text(item.label);
  });

  // Update subtitle
  d3.select('#conjugate-subtitle').text(`${fam.label} conjugate family`);
}

/* ============================================================
   2. SEQUENTIAL UPDATING PANEL — Ghost curves
   ============================================================ */
function drawUpdatingPanel() {
  const container = d3.select('#updating-plot');
  container.selectAll('*').remove();

  const fam = getFamily();
  const W = 340, H = 250;
  const margin = { top: 15, right: 15, bottom: 40, left: 45 };
  const iw = W - margin.left - margin.right;
  const ih = H - margin.top - margin.bottom;

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  let [xMin, xMax] = fam.domain();
  if (state.family === 'normal-normal') {
    const pp = getPosteriorParams();
    const spread = Math.max(state.priorParams[1], pp[1]) * 4;
    xMin = Math.min(state.priorParams[0], pp[0]) - spread;
    xMax = Math.max(state.priorParams[0], pp[0]) + spread;
  }
  if (state.family === 'gamma-poisson') {
    const pp = getPosteriorParams();
    xMax = Math.max(pp[0] / pp[1] + 5 * Math.sqrt(pp[0]) / pp[1], state.priorParams[0] / state.priorParams[1] + 5 * Math.sqrt(state.priorParams[0]) / state.priorParams[1], 5);
    xMin = 0.001;
  }

  const nPts = 200;
  const xs = d3.range(nPts).map(i => xMin + (i / (nPts - 1)) * (xMax - xMin));

  // Compute all historical curves + prior + current posterior
  const allCurves = [];

  // Prior is the first curve
  const priorVals = xs.map(x => getPriorPDFForPlot(x));
  allCurves.push({ vals: priorVals, label: 'Prior', opacity: 0.2 });

  // History snapshots
  state.history.forEach((snap, i) => {
    const vals = xs.map(x => {
      if (state.family === 'beta-binomial' || state.family === 'dirichlet-multinomial') {
        return betaPDF(x, snap.params[0], snap.params[1]);
      }
      if (state.family === 'normal-normal') return normalPDF(x, snap.params[0], snap.params[1]);
      if (state.family === 'gamma-poisson') return gammaPDF(x, snap.params[0], snap.params[1]);
      return 0;
    });
    const frac = (i + 1) / (state.history.length + 1);
    allCurves.push({ vals, label: `n=${snap.nObs}`, opacity: 0.15 + 0.55 * frac });
  });

  // Current posterior
  const postVals = xs.map(x => getPosteriorPDFForPlot(x));
  allCurves.push({ vals: postVals, label: 'Current', opacity: 1.0 });

  const yMax = Math.max(...allCurves.map(c => d3.max(c.vals)), 0.1) * 1.1;

  const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, iw]);
  const yScale = d3.scaleLinear().domain([0, yMax]).range([ih, 0]);

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(xScale).ticks(5));
  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(4));

  const line = d3.line().x((_, i) => xScale(xs[i])).curve(d3.curveMonotoneX);

  // Draw ghost curves from history
  allCurves.forEach((curve, ci) => {
    const isLast = ci === allCurves.length - 1;
    g.append('path').datum(curve.vals)
      .attr('class', isLast ? 'posterior-curve' : 'ghost-curve')
      .attr('d', line.y(d => yScale(d)))
      .style('opacity', isLast ? 1 : curve.opacity)
      .style('stroke-width', isLast ? 2.5 : 1.2)
      .style('stroke', isLast ? 'var(--color-accent)' : '#64748b');
  });

  // Label for n
  const n = fam.nObs(state.data);
  g.append('text')
    .attr('x', iw - 5).attr('y', 14)
    .attr('text-anchor', 'end').attr('font-size', 11).attr('fill', '#555')
    .text(`n = ${n}`);
}

/* ============================================================
   3. CREDIBLE INTERVALS PANEL
   ============================================================ */
function drawCrediblePanel() {
  const container = d3.select('#credible-plot');
  container.selectAll('*').remove();

  const fam = getFamily();
  const pp = getPosteriorParams();
  const W = 340, H = 250;
  const margin = { top: 15, right: 20, bottom: 40, left: 50 };
  const iw = W - margin.left - margin.right;
  const ih = H - margin.top - margin.bottom;

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Domain
  let [xMin, xMax] = fam.domain();
  if (state.family === 'normal-normal') {
    const spread = Math.max(state.priorParams[1], pp[1]) * 4;
    xMin = Math.min(state.priorParams[0], pp[0]) - spread;
    xMax = Math.max(state.priorParams[0], pp[0]) + spread;
  }
  if (state.family === 'gamma-poisson') {
    xMax = Math.max(pp[0] / pp[1] + 5 * Math.sqrt(pp[0]) / pp[1], state.priorParams[0] / state.priorParams[1] + 5 * Math.sqrt(state.priorParams[0]) / state.priorParams[1], 5);
    xMin = state.family === 'gamma-poisson' ? 0.001 : xMin;
  }

  const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, iw]);

  // Credible intervals
  let ci95, ci50, postMean, postMode, mle;
  if (state.family === 'dirichlet-multinomial') {
    const k = Math.round(state.priorParams[1]);
    const n1 = (state.data.categoryCounts[0] || 0);
    const nRest = state.data.totalObs - n1;
    const a = state.priorParams[0] + n1;
    const b = state.priorParams[0] * (k - 1) + nRest;
    ci95 = [betaQuantile(0.025, a, b), betaQuantile(0.975, a, b)];
    ci50 = [betaQuantile(0.25, a, b), betaQuantile(0.75, a, b)];
    postMean = a / (a + b);
    postMode = (a > 1 && b > 1) ? (a - 1) / (a + b - 2) : a / (a + b);
    mle = fam.mle(state.data);
  } else {
    ci95 = fam.credible(pp, 0.95);
    ci50 = fam.credible(pp, 0.50);
    postMean = fam.posteriorMean(pp);
    postMode = fam.posteriorMode(pp);
    mle = fam.mle(state.data);
  }

  // Rows
  const rows = [
    { label: '95% CI', lo: ci95[0], hi: ci95[1], color: 'var(--color-accent)', opacity: 0.2, height: 24 },
    { label: '50% CI', lo: ci50[0], hi: ci50[1], color: 'var(--color-accent)', opacity: 0.35, height: 16 },
  ];

  const bandY = ih * 0.3;

  // Axis
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(xScale).ticks(6));

  // Draw bands
  rows.forEach((row, i) => {
    const y = bandY - row.height / 2;
    g.append('rect')
      .attr('class', 'credible-band')
      .attr('x', xScale(row.lo))
      .attr('y', y)
      .attr('width', Math.max(1, xScale(row.hi) - xScale(row.lo)))
      .attr('height', row.height)
      .attr('rx', 4)
      .style('opacity', row.opacity);

    // Border lines
    [row.lo, row.hi].forEach(v => {
      g.append('line')
        .attr('class', 'credible-line')
        .attr('x1', xScale(v)).attr('x2', xScale(v))
        .attr('y1', y - 4).attr('y2', y + row.height + 4);
    });

    // Label
    g.append('text')
      .attr('x', xScale((row.lo + row.hi) / 2))
      .attr('y', y - 8)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10).attr('fill', '#555')
      .text(`${row.label}: [${fmtShort(row.lo)}, ${fmtShort(row.hi)}]`);
  });

  // Point estimates
  const estimates = [
    { label: 'Mean', value: postMean, color: 'var(--color-accent)', shape: 'circle' },
    { label: 'MAP', value: postMode, color: 'var(--color-primary)', shape: 'diamond' },
    { label: 'MLE', value: mle, color: 'var(--color-secondary)', shape: 'triangle' },
  ];

  const estY = ih * 0.65;
  estimates.forEach((est, i) => {
    const x = xScale(est.value);
    const y = estY + i * 22;

    if (est.shape === 'circle') {
      g.append('circle')
        .attr('class', 'point-estimate')
        .attr('cx', x).attr('cy', y).attr('r', 5)
        .attr('fill', est.color);
    } else if (est.shape === 'diamond') {
      g.append('path')
        .attr('class', 'point-estimate')
        .attr('d', `M${x},${y - 6} L${x + 5},${y} L${x},${y + 6} L${x - 5},${y} Z`)
        .attr('fill', est.color);
    } else {
      g.append('path')
        .attr('class', 'point-estimate')
        .attr('d', `M${x},${y - 6} L${x + 5},${y + 4} L${x - 5},${y + 4} Z`)
        .attr('fill', est.color);
    }

    // Vertical line to axis
    g.append('line')
      .attr('x1', x).attr('x2', x)
      .attr('y1', y + 8).attr('y2', ih)
      .attr('stroke', est.color).attr('stroke-width', 1)
      .attr('stroke-dasharray', '2 2').attr('opacity', 0.5);

    // Label
    g.append('text')
      .attr('x', x + 8).attr('y', y + 4)
      .attr('font-size', 10).attr('fill', '#555')
      .text(`${est.label} = ${fmtShort(est.value)}`);
  });
}

/* ============================================================
   4. DATA PANEL — Visual representation of observations
   ============================================================ */
const DATA_COLORS = ['#2563eb', '#e97319', '#059669', '#7c3aed', '#db2777', '#0891b2'];

function drawDataPanel() {
  const container = d3.select('#data-viz');
  container.selectAll('*').remove();

  const fam = getFamily();
  const data = state.data;
  const nObs = fam.nObs(data);

  if (nObs === 0) {
    container.append('div')
      .style('text-align', 'center').style('color', '#94a3b8').style('padding', '20px')
      .text('No observations yet. Click "Add Observation" to generate data.');
    return;
  }

  const W = 680, H = 80;
  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const maxShow = 80;
  const obs = data.observations.slice(-maxShow);
  const cellW = Math.min(24, (W - 20) / obs.length);

  if (state.family === 'beta-binomial') {
    // Coin icons: success = green circle, failure = orange circle
    obs.forEach((o, i) => {
      const cx = 10 + i * cellW + cellW / 2;
      const cy = H / 2;
      const isNew = i === obs.length - 1;
      svg.append('circle')
        .attr('class', `data-icon ${o === 'success' ? 'success' : 'failure'} ${isNew ? 'new' : ''}`)
        .attr('cx', cx).attr('cy', cy)
        .attr('r', Math.min(10, cellW * 0.4))
        .on('mouseenter', (event) => showTooltip(event, `#${data.observations.length - obs.length + i + 1}: ${o}`))
        .on('mouseleave', hideTooltip);

      // H or T label
      svg.append('text')
        .attr('x', cx).attr('y', cy + 3.5)
        .attr('text-anchor', 'middle').attr('font-size', Math.min(10, cellW * 0.35))
        .attr('fill', '#fff').attr('pointer-events', 'none')
        .text(o === 'success' ? 'H' : 'T');
    });
  } else if (state.family === 'normal-normal') {
    // Dot plot
    const vals = data.values.slice(-maxShow);
    const xMin = d3.min(vals) - 1, xMax = d3.max(vals) + 1;
    const xScale = d3.scaleLinear().domain([xMin, xMax]).range([30, W - 10]);
    svg.append('line')
      .attr('x1', 30).attr('x2', W - 10)
      .attr('y1', H * 0.7).attr('y2', H * 0.7)
      .attr('stroke', '#cbd5e1').attr('stroke-width', 1);
    vals.forEach((v, i) => {
      const isNew = i === vals.length - 1;
      svg.append('circle')
        .attr('class', `data-icon ${isNew ? 'new' : ''}`)
        .attr('cx', xScale(v))
        .attr('cy', H * 0.7 - 4 - Math.floor(i / Math.max(1, Math.ceil(vals.length / 3))) * 8)
        .attr('r', 4)
        .attr('fill', 'var(--color-primary)')
        .attr('opacity', 0.7)
        .on('mouseenter', (event) => showTooltip(event, `#${i + 1}: ${v.toFixed(2)}`))
        .on('mouseleave', hideTooltip);
    });
  } else if (state.family === 'gamma-poisson') {
    // Count blocks: each observation is a stacked bar
    const counts = data.counts.slice(-maxShow);
    const maxC = Math.max(d3.max(counts) || 1, 1);
    const barW = Math.min(20, (W - 20) / counts.length);
    counts.forEach((c, i) => {
      const isNew = i === counts.length - 1;
      for (let j = 0; j < c; j++) {
        svg.append('rect')
          .attr('class', `data-icon ${isNew ? 'new' : ''}`)
          .attr('x', 10 + i * barW + 1)
          .attr('y', H - 10 - (j + 1) * Math.min(8, (H - 20) / maxC))
          .attr('width', barW - 2)
          .attr('height', Math.min(7, (H - 20) / maxC - 1))
          .attr('rx', 2)
          .attr('fill', 'var(--color-primary)')
          .attr('opacity', 0.6 + 0.4 * (j / maxC));
      }
      // Count label
      svg.append('text')
        .attr('x', 10 + i * barW + barW / 2)
        .attr('y', H - 2)
        .attr('text-anchor', 'middle').attr('font-size', 8).attr('fill', '#94a3b8')
        .text(c);
    });
  } else if (state.family === 'dirichlet-multinomial') {
    // Colored segments
    const k = Math.round(state.priorParams[1]);
    obs.forEach((cat, i) => {
      const cx = 10 + i * cellW + cellW / 2;
      const cy = H / 2;
      const isNew = i === obs.length - 1;
      svg.append('rect')
        .attr('class', `data-icon ${isNew ? 'new' : ''}`)
        .attr('x', cx - cellW * 0.4)
        .attr('y', cy - 10)
        .attr('width', cellW * 0.8)
        .attr('height', 20)
        .attr('rx', 3)
        .attr('fill', DATA_COLORS[cat % DATA_COLORS.length])
        .attr('opacity', 0.8)
        .on('mouseenter', (event) => showTooltip(event, `#${i + 1}: Category ${cat + 1}`))
        .on('mouseleave', hideTooltip);

      svg.append('text')
        .attr('x', cx).attr('y', cy + 4)
        .attr('text-anchor', 'middle').attr('font-size', Math.min(10, cellW * 0.4))
        .attr('fill', '#fff').attr('pointer-events', 'none')
        .text(cat + 1);
    });

    // Summary bar at right
    if (nObs > 0) {
      const barX = W - 100, barW = 90, barH = 16;
      let cumX = barX;
      for (let c = 0; c < k; c++) {
        const n = data.categoryCounts[c] || 0;
        const w = (n / nObs) * barW;
        svg.append('rect')
          .attr('x', cumX).attr('y', 8)
          .attr('width', w).attr('height', barH)
          .attr('fill', DATA_COLORS[c % DATA_COLORS.length])
          .attr('opacity', 0.7);
        cumX += w;
      }
      svg.append('text')
        .attr('x', barX + barW / 2).attr('y', 6)
        .attr('text-anchor', 'middle').attr('font-size', 9).attr('fill', '#555')
        .text('Category proportions');
    }
  }
}

/* ============================================================
   STATS PANEL
   ============================================================ */
function updateStats() {
  const statsEl = d3.select('#stats');
  statsEl.selectAll('*').remove();

  const fam = getFamily();
  const pp = getPosteriorParams();
  const nObs = fam.nObs(state.data);

  let postMean, postVar, ci95;
  if (state.family === 'dirichlet-multinomial') {
    const k = Math.round(state.priorParams[1]);
    const n1 = (state.data.categoryCounts[0] || 0);
    const nRest = state.data.totalObs - n1;
    const a = state.priorParams[0] + n1;
    const b = state.priorParams[0] * (k - 1) + nRest;
    postMean = a / (a + b);
    postVar = (a * b) / ((a + b) ** 2 * (a + b + 1));
    ci95 = [betaQuantile(0.025, a, b), betaQuantile(0.975, a, b)];
  } else {
    postMean = fam.posteriorMean(pp);
    postVar = fam.posteriorVar(pp);
    ci95 = fam.credible(pp, 0.95);
  }

  const items = [
    { label: 'Observations', value: nObs },
    { label: 'Posterior params', value: state.family === 'dirichlet-multinomial'
        ? `(${pp[0].toFixed(1)}, ${(state.priorParams[0] * (Math.round(state.priorParams[1]) - 1) + state.data.totalObs - (state.data.categoryCounts[0] || 0)).toFixed(1)})`
        : `(${pp.map(v => fmtShort(v)).join(', ')})` },
    { label: 'Post. mean', value: fmtShort(postMean) },
    { label: 'Post. variance', value: fmtShort(postVar) },
    { label: '95% CI', value: `[${fmtShort(ci95[0])}, ${fmtShort(ci95[1])}]` },
    { label: 'True param', value: fmtShort(state.trueParam) },
  ];

  items.forEach(item => {
    const row = statsEl.append('div').style('display', 'flex').style('justify-content', 'space-between')
      .style('padding', '4px 0').style('border-bottom', '1px solid #e2e8f0')
      .style('font-size', '13px');
    row.append('span').style('color', '#64748b').text(item.label);
    row.append('span').style('font-family', 'var(--font-mono)').style('font-weight', '600')
      .text(item.value);
  });
}

/* ============================================================
   INFO PANEL — KaTeX formulas
   ============================================================ */
function renderInfo() {
  const infoEl = document.getElementById('info');
  if (!infoEl) return;
  infoEl.innerHTML = '';

  const fam = getFamily();
  const wrapper = d3.select(infoEl);

  // Bayes' theorem
  const bayesDiv = wrapper.append('div').style('margin-bottom', '16px');
  bayesDiv.append('h3').text("Bayes' Theorem");
  const bayesFormula = bayesDiv.append('div');
  katex.render(
    String.raw`p(\theta \mid \mathbf{x}) = \frac{p(\mathbf{x} \mid \theta)\, p(\theta)}{p(\mathbf{x})} \;\propto\; \text{likelihood} \times \text{prior}`,
    bayesFormula.node(), { displayMode: true, throwOnError: false }
  );

  // Conjugate family formula
  const conjDiv = wrapper.append('div').style('margin-bottom', '16px');
  conjDiv.append('h3').text(`${fam.label} Conjugate Update`);
  const conjFormula = conjDiv.append('div');
  katex.render(fam.formulaTeX, conjFormula.node(), { displayMode: true, throwOnError: false });

  // Current posterior
  const pp = getPosteriorParams();
  let posteriorTeX;
  if (state.family === 'dirichlet-multinomial') {
    const k = Math.round(state.priorParams[1]);
    const n1 = (state.data.categoryCounts[0] || 0);
    const nRest = state.data.totalObs - n1;
    const a = state.priorParams[0] + n1;
    const b = state.priorParams[0] * (k - 1) + nRest;
    posteriorTeX = `\\text{Marginal: } \\text{Beta}(${a.toFixed(1)},\\,${b.toFixed(1)})`;
  } else if (state.family === 'beta-binomial') {
    posteriorTeX = `\\text{Posterior: } ${fam.paramTeX(pp)}`;
  } else if (state.family === 'normal-normal') {
    posteriorTeX = `\\text{Posterior: } ${fam.paramTeX(pp)}`;
  } else {
    posteriorTeX = `\\text{Posterior: } ${fam.paramTeX(pp)}`;
  }

  const curDiv = wrapper.append('div').style('margin-bottom', '16px');
  curDiv.append('h3').text('Current Posterior');
  const curFormula = curDiv.append('div');
  katex.render(posteriorTeX, curFormula.node(), { displayMode: true, throwOnError: false });

  // Interpretation
  const interpDiv = wrapper.append('div');
  interpDiv.append('h3').text('Interpretation');
  const interpFormula = interpDiv.append('div');
  katex.render(fam.interpretTeX, interpFormula.node(), { displayMode: true, throwOnError: false });
}

/* ============================================================
   CONTROLS
   ============================================================ */
function buildControls() {
  const fam = getFamily();

  // Family dropdown
  const familyDiv = d3.select('#family-select');
  familyDiv.selectAll('*').remove();
  const familyLabel = familyDiv.append('label').text('Conjugate Family');
  const familySelect = familyDiv.append('select').attr('class', 'control-select')
    .style('width', '100%').style('padding', '6px').style('margin-top', '4px')
    .style('border-radius', '6px').style('border', '1px solid #cbd5e1');
  Object.entries(FAMILIES).forEach(([key, f]) => {
    familySelect.append('option').attr('value', key).text(f.label)
      .property('selected', key === state.family);
  });
  familySelect.on('change', function () {
    state.family = this.value;
    const newFam = getFamily();
    state.priorParams = [newFam.paramRanges[0][2], newFam.paramRanges[1][2]];
    state.trueParam = newFam.dataRange[2];
    initData();
    rng = mulberry32(42);
    buildControls();
    renderAll();
  });

  // Prior parameter sliders
  buildSlider('#prior-param-1', fam.paramLabels[0], fam.paramRanges[0], state.priorParams[0], (v) => {
    state.priorParams[0] = v;
    // For Dirichlet, changing K requires re-init
    initData();
    rng = mulberry32(42);
    renderAll();
  });

  buildSlider('#prior-param-2', fam.paramLabels[1], fam.paramRanges[1], state.priorParams[1], (v) => {
    state.priorParams[1] = v;
    initData();
    rng = mulberry32(42);
    renderAll();
  });

  // True parameter / data generation parameter
  buildSlider('#data-param', fam.dataLabel, fam.dataRange, state.trueParam, (v) => {
    state.trueParam = v;
  });

  // Sample size slider
  buildSlider('#sample-size-slider', 'Obs per click', [1, 20, 1, 1], state.sampleSize, (v) => {
    state.sampleSize = Math.round(v);
  });
}

function buildSlider(selector, label, range, currentVal, onChange) {
  const div = d3.select(selector);
  div.selectAll('*').remove();

  const [min, max, defaultVal, step] = range;

  const labelRow = div.append('div').style('display', 'flex').style('justify-content', 'space-between')
    .style('margin-bottom', '4px').style('font-size', '13px');
  labelRow.append('span').text(label);
  const valSpan = labelRow.append('span').style('font-family', 'var(--font-mono)').style('font-weight', '600')
    .text(currentVal.toFixed(step < 1 ? 2 : 0));

  div.append('input')
    .attr('type', 'range')
    .attr('min', min).attr('max', max).attr('step', step)
    .attr('value', currentVal)
    .style('width', '100%')
    .on('input', function () {
      const v = +this.value;
      valSpan.text(v.toFixed(step < 1 ? 2 : 0));
      onChange(v);
    });
}

/* ============================================================
   ADD OBSERVATION / RESET
   ============================================================ */
function addObservation() {
  const fam = getFamily();
  const nToAdd = state.sampleSize;

  for (let i = 0; i < nToAdd; i++) {
    let obs;
    if (state.family === 'dirichlet-multinomial') {
      obs = fam.generateObs(state.trueParam, state.priorParams);
    } else {
      obs = fam.generateObs(state.trueParam);
    }
    fam.addObs(state.data, obs);
    state.data.observations.push(obs);
  }

  // Save snapshot for history (used for ghost curves)
  const pp = getPosteriorParams();
  state.history.push({ params: [...pp], nObs: fam.nObs(state.data) });

  // Keep history manageable
  if (state.history.length > 30) {
    // Thin: keep every other early one
    const thinned = [];
    for (let i = 0; i < state.history.length; i++) {
      if (i < state.history.length - 15 && i % 3 !== 0) continue;
      thinned.push(state.history[i]);
    }
    state.history = thinned;
  }

  renderAll();
}

function resetData() {
  initData();
  rng = mulberry32(42);
  renderAll();
}

/* ============================================================
   RENDER ALL
   ============================================================ */
function renderAll() {
  drawDistributionPanel();
  drawUpdatingPanel();
  drawCrediblePanel();
  drawDataPanel();
  updateStats();
  renderInfo();
}

/* ============================================================
   WIRE BUTTONS
   ============================================================ */
function wireButtons() {
  d3.select('#add-data-btn').on('click', addObservation);
  d3.select('#reset-btn').on('click', resetData);
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  state.priorParams = [FAMILIES['beta-binomial'].paramRanges[0][2], FAMILIES['beta-binomial'].paramRanges[1][2]];
  state.trueParam = FAMILIES['beta-binomial'].dataRange[2];
  initData();
  buildControls();
  wireButtons();
  renderAll();
}

init();
