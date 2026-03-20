/* ============================================================
   Module MQ-6 — Meta-Analysis & Evidence Synthesis
   ============================================================
   Interactive forest plots, funnel plots for publication bias,
   and heterogeneity exploration. Implements Mantel-Haenszel
   fixed-effect, inverse-variance fixed-effect, and
   DerSimonian-Laird random-effects pooling.
   ============================================================ */

import * as d3 from 'd3';
import katex from 'katex';
import '../../lib/copy-code.js';
import '../../lib/param-tooltips.js';

/* ================================================================
   1. CLINICAL DATASETS
   ================================================================ */
const DATASETS = {
  'aspirin-mi': {
    label: 'Aspirin for MI Prevention',
    measure: 'OR',
    studies: [
      { name: 'UK-TIA',          year: 1979, n_t: 1632, e_t: 49,  n_c: 1649, e_c: 67 },
      { name: 'CDP-A',           year: 1980, n_t: 758,  e_t: 44,  n_c: 771,  e_c: 64 },
      { name: 'AMIS',            year: 1980, n_t: 2267, e_t: 126, n_c: 2257, e_c: 150 },
      { name: 'German TIA',     year: 1984, n_t: 604,  e_t: 23,  n_c: 309,  e_c: 18 },
      { name: 'PARIS-I',        year: 1980, n_t: 810,  e_t: 56,  n_c: 406,  e_c: 40 },
      { name: 'PARIS-II',       year: 1986, n_t: 1563, e_t: 85,  n_c: 1565, e_c: 102 },
      { name: 'ISIS-2',         year: 1988, n_t: 8587, e_t: 791, n_c: 8600, e_c: 1029 },
      { name: "Physician's HS", year: 1989, n_t: 11037,e_t: 139, n_c: 11034,e_c: 239 },
    ]
  },
  'statins-primary': {
    label: 'Statins for Primary Prevention',
    measure: 'OR',
    studies: [
      { name: 'WOSCOPS',    year: 1995, n_t: 3302, e_t: 174, n_c: 3293, e_c: 248 },
      { name: 'AFCAPS',     year: 1998, n_t: 3304, e_t: 116, n_c: 3301, e_c: 183 },
      { name: 'MEGA',       year: 2006, n_t: 3866, e_t: 66,  n_c: 3966, e_c: 101 },
      { name: 'JUPITER',    year: 2008, n_t: 8901, e_t: 142, n_c: 8901, e_c: 251 },
      { name: 'HOPE-3',     year: 2016, n_t: 6361, e_t: 235, n_c: 6344, e_c: 304 },
      { name: 'ASCOT-LLA',  year: 2003, n_t: 5168, e_t: 100, n_c: 5137, e_c: 154 },
    ]
  },
  'beta-blockers-mi': {
    label: 'Beta-Blockers Post-MI',
    measure: 'OR',
    studies: [
      { name: 'Ahlmark',      year: 1974, n_t: 114,  e_t: 7,   n_c: 116,  e_c: 14 },
      { name: 'Andersen',     year: 1979, n_t: 238,  e_t: 15,  n_c: 242,  e_c: 22 },
      { name: 'Barber',       year: 1976, n_t: 221,  e_t: 14,  n_c: 228,  e_c: 19 },
      { name: 'Baber',        year: 1980, n_t: 355,  e_t: 28,  n_c: 365,  e_c: 41 },
      { name: 'BHAT',         year: 1982, n_t: 1916, e_t: 138, n_c: 1921, e_c: 188 },
      { name: 'EIS',          year: 1984, n_t: 858,  e_t: 69,  n_c: 883,  e_c: 86 },
      { name: 'LIT',          year: 1987, n_t: 1456, e_t: 98,  n_c: 1459, e_c: 126 },
      { name: 'Norwegian',    year: 1981, n_t: 945,  e_t: 56,  n_c: 939,  e_c: 84 },
      { name: 'Taylor',       year: 1982, n_t: 632,  e_t: 48,  n_c: 471,  e_c: 52 },
      { name: 'Julian',       year: 1982, n_t: 873,  e_t: 64,  n_c: 583,  e_c: 52 },
    ]
  },
  'ssris-depression': {
    label: 'SSRIs for Depression',
    measure: 'OR',
    studies: [
      { name: 'Dunner 1992',     year: 1992, n_t: 62,  e_t: 28,  n_c: 60,  e_c: 15 },
      { name: 'Fabre 1995',      year: 1995, n_t: 94,  e_t: 50,  n_c: 95,  e_c: 30 },
      { name: 'Schneider 2003',  year: 2003, n_t: 174, e_t: 82,  n_c: 178, e_c: 62 },
      { name: 'Lydiard 1997',    year: 1997, n_t: 128, e_t: 55,  n_c: 131, e_c: 50 },
      { name: 'Burke 2002',      year: 2002, n_t: 183, e_t: 104, n_c: 179, e_c: 70 },
      { name: 'Detke 2004',      year: 2004, n_t: 188, e_t: 97,  n_c: 93,  e_c: 35 },
      { name: 'Golden 2002',     year: 2002, n_t: 147, e_t: 69,  n_c: 148, e_c: 48 },
      { name: 'Tollefson 1995',  year: 1995, n_t: 221, e_t: 125, n_c: 225, e_c: 92 },
      { name: 'AGiovanni 1999',  year: 1999, n_t: 84,  e_t: 32,  n_c: 87,  e_c: 22 },
      { name: 'Kiev 2004',       year: 2004, n_t: 139, e_t: 80,  n_c: 142, e_c: 57 },
      { name: 'Wade 2002',       year: 2002, n_t: 189, e_t: 95,  n_c: 185, e_c: 62 },
      { name: 'Rapaport 2003',   year: 2003, n_t: 204, e_t: 100, n_c: 98,  e_c: 32 },
    ]
  },
  'hcq-covid': {
    label: 'Hydroxychloroquine for COVID',
    measure: 'OR',
    studies: [
      { name: 'RECOVERY',       year: 2020, n_t: 1561, e_t: 421, n_c: 3155, e_c: 790 },
      { name: 'WHO SOLIDARITY', year: 2020, n_t: 947,  e_t: 104, n_c: 906,  e_c: 84 },
      { name: 'Cavalcanti',     year: 2020, n_t: 221,  e_t: 55,  n_c: 227,  e_c: 50 },
      { name: 'Tang',           year: 2020, n_t: 75,   e_t: 3,   n_c: 75,   e_c: 4 },
      { name: 'Abd-Elsalam',    year: 2020, n_t: 97,   e_t: 6,   n_c: 97,   e_c: 5 },
      { name: 'Skipper',        year: 2020, n_t: 212,  e_t: 4,   n_c: 211,  e_c: 10 },
      { name: 'Boulware',       year: 2020, n_t: 414,  e_t: 49,  n_c: 407,  e_c: 58 },
      { name: 'Horby',          year: 2020, n_t: 1282, e_t: 360, n_c: 2540, e_c: 708 },
    ]
  }
};

/* ================================================================
   2. SEEDED PRNG (Mulberry32)
   ================================================================ */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(42);

/* ================================================================
   3. STATISTICAL FUNCTIONS
   ================================================================ */

/* Normal CDF (Abramowitz & Stegun approximation) */
function normalCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
    a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/* Normal quantile (Beasley-Springer-Moro) */
function normalQuantile(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;
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
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
}

/* Chi-squared CDF (regularized lower incomplete gamma via series) */
function chiSquaredCDF(x, k) {
  if (x <= 0) return 0;
  const half_k = k / 2;
  const half_x = x / 2;
  // series for lower incomplete gamma
  let sum = 0, term = 1 / half_k;
  sum = term;
  for (let n = 1; n < 200; n++) {
    term *= half_x / (half_k + n);
    sum += term;
    if (Math.abs(term) < 1e-12 * Math.abs(sum)) break;
  }
  const logGamma = lnGamma(half_k);
  return sum * Math.exp(-half_x + half_k * Math.log(half_x) - logGamma);
}

function lnGamma(z) {
  // Lanczos approximation
  const g = 7;
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }
  z -= 1;
  let x = coef[0];
  for (let i = 1; i < g + 2; i++) x += coef[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/* Log OR and SE from 2×2 table with 0.5 continuity correction */
function logOR(e_t, n_t, e_c, n_c) {
  let a = e_t, b = n_t - e_t, c = e_c, d = n_c - e_c;
  // continuity correction if any cell is zero
  if (a === 0 || b === 0 || c === 0 || d === 0) {
    a += 0.5; b += 0.5; c += 0.5; d += 0.5;
  }
  const lnor = Math.log(a * d / (b * c));
  const se = Math.sqrt(1 / a + 1 / b + 1 / c + 1 / d);
  return { lnor, se };
}

/* Log RR and SE */
function logRR(e_t, n_t, e_c, n_c) {
  let a = e_t, c = e_c;
  if (a === 0) a = 0.5;
  if (c === 0) c = 0.5;
  const nt = a === e_t ? n_t : n_t + 0.5;
  const nc = c === e_c ? n_c : n_c + 0.5;
  const lnrr = Math.log((a / nt) / (c / nc));
  const se = Math.sqrt(1 / a - 1 / nt + 1 / c - 1 / nc);
  return { lnor: lnrr, se };
}

/* Risk Difference and SE */
function riskDiff(e_t, n_t, e_c, n_c) {
  const p_t = e_t / n_t, p_c = e_c / n_c;
  const rd = p_t - p_c;
  const se = Math.sqrt(p_t * (1 - p_t) / n_t + p_c * (1 - p_c) / n_c);
  return { lnor: rd, se };
}

/* ================================================================
   4. META-ANALYSIS COMPUTATIONS
   ================================================================ */

function computeStudyEffects(studies, measure) {
  const fn = measure === 'RR' ? logRR : measure === 'RD' ? riskDiff : logOR;
  return studies.map(s => {
    const { lnor, se } = fn(s.e_t, s.n_t, s.e_c, s.n_c);
    return { ...s, yi: lnor, sei: se, vi: se * se };
  });
}

/* Mantel-Haenszel fixed-effect for OR */
function mantelHaenszel(effects, studies) {
  let sumR = 0, sumS = 0, sumPR = 0, sumPS_QR = 0, sumQS = 0;
  studies.forEach((s, i) => {
    let a = s.e_t, b = s.n_t - s.e_t, c = s.e_c, d = s.n_c - s.e_c;
    if (a === 0 || b === 0 || c === 0 || d === 0) {
      a += 0.5; b += 0.5; c += 0.5; d += 0.5;
    }
    const N = a + b + c + d;
    const R = a * d / N;
    const S = b * c / N;
    const P = (a + d) / N;
    const Q = (b + c) / N;
    sumR += R;
    sumS += S;
    sumPR += P * R;
    sumPS_QR += P * S + Q * R;
    sumQS += Q * S;
  });
  const orMH = sumR / sumS;
  const lnMH = Math.log(orMH);
  const seMH = Math.sqrt(
    sumPR / (2 * sumR * sumR) +
    sumPS_QR / (2 * sumR * sumS) +
    sumQS / (2 * sumS * sumS)
  );
  return { pooled: lnMH, se: seMH };
}

/* Inverse-variance fixed-effect */
function inverseVariance(effects) {
  let sumWY = 0, sumW = 0;
  effects.forEach(e => {
    const w = 1 / e.vi;
    sumWY += w * e.yi;
    sumW += w;
  });
  return { pooled: sumWY / sumW, se: Math.sqrt(1 / sumW) };
}

/* Cochran's Q */
function cochranQ(effects, pooled) {
  let Q = 0;
  effects.forEach(e => {
    const w = 1 / e.vi;
    Q += w * (e.yi - pooled) * (e.yi - pooled);
  });
  return Q;
}

/* DerSimonian-Laird random-effects */
function derSimonianLaird(effects) {
  const iv = inverseVariance(effects);
  const Q = cochranQ(effects, iv.pooled);
  const k = effects.length;
  const df = k - 1;

  let sumW = 0, sumW2 = 0;
  effects.forEach(e => {
    const w = 1 / e.vi;
    sumW += w;
    sumW2 += w * w;
  });
  const C = sumW - sumW2 / sumW;
  const tau2 = Math.max(0, (Q - df) / C);

  let sumWstar = 0, sumWstarY = 0;
  effects.forEach(e => {
    const wstar = 1 / (e.vi + tau2);
    sumWstar += wstar;
    sumWstarY += wstar * e.yi;
  });
  const pooled = sumWstarY / sumWstar;
  const se = Math.sqrt(1 / sumWstar);
  return { pooled, se, tau2 };
}

/* Full meta-analysis computation */
function runMetaAnalysis(studies, measure, model, ciLevel) {
  const effects = computeStudyEffects(studies, measure);
  const k = effects.length;
  const z = normalQuantile(1 - (1 - ciLevel) / 2);
  const isRatio = measure !== 'RD';

  // Fixed-effect
  let fixed;
  if (model === 'MH' && measure === 'OR') {
    fixed = mantelHaenszel(effects, studies);
  } else {
    fixed = inverseVariance(effects);
  }

  // Q and I²
  const Q = cochranQ(effects, fixed.pooled);
  const df = k - 1;
  const I2 = Math.max(0, (Q - df) / Q * 100);
  const pQ = 1 - chiSquaredCDF(Q, df);

  // Random effects
  const re = derSimonianLaird(effects);
  const tau2 = re.tau2;

  // Select pooled estimate based on model
  let pooled, sePo;
  if (model === 'DL') {
    pooled = re.pooled;
    sePo = re.se;
  } else {
    pooled = fixed.pooled;
    sePo = fixed.se;
  }

  // Weights
  const weights = effects.map(e => {
    if (model === 'DL') {
      return 1 / (e.vi + tau2);
    } else {
      return 1 / e.vi;
    }
  });
  const totalW = d3.sum(weights);
  const relWeights = weights.map(w => w / totalW * 100);

  // CIs for individual studies
  const studyResults = effects.map((e, i) => {
    const lo = e.yi - z * e.sei;
    const hi = e.yi + z * e.sei;
    const significant = isRatio ? (lo > 0 || hi < 0) : (lo > 0 || hi < 0);
    return {
      ...e,
      ci_lo: lo, ci_hi: hi,
      weight: relWeights[i],
      significant,
      // display values
      est: isRatio ? Math.exp(e.yi) : e.yi,
      ci_lo_disp: isRatio ? Math.exp(lo) : lo,
      ci_hi_disp: isRatio ? Math.exp(hi) : hi,
    };
  });

  // Pooled CI
  const pooledLo = pooled - z * sePo;
  const pooledHi = pooled + z * sePo;

  // Prediction interval
  const predSE = Math.sqrt(sePo * sePo + tau2);
  const predLo = pooled - z * predSE;
  const predHi = pooled + z * predSE;

  // Fixed-effect CI for dual diamond
  const fixedLo = fixed.pooled - z * fixed.se;
  const fixedHi = fixed.pooled + z * fixed.se;

  return {
    studies: studyResults,
    pooled,
    sePo,
    pooledLo, pooledHi,
    pooledDisp: isRatio ? Math.exp(pooled) : pooled,
    pooledLoDisp: isRatio ? Math.exp(pooledLo) : pooledLo,
    pooledHiDisp: isRatio ? Math.exp(pooledHi) : pooledHi,
    predLo, predHi,
    predLoDisp: isRatio ? Math.exp(predLo) : predLo,
    predHiDisp: isRatio ? Math.exp(predHi) : predHi,
    fixed: {
      pooled: fixed.pooled,
      se: fixed.se,
      lo: fixedLo, hi: fixedHi,
      disp: isRatio ? Math.exp(fixed.pooled) : fixed.pooled,
      loDisp: isRatio ? Math.exp(fixedLo) : fixedLo,
      hiDisp: isRatio ? Math.exp(fixedHi) : fixedHi,
    },
    Q, df, pQ, I2, tau2,
    k,
    isRatio,
    z,
    totalParticipants: studies.reduce((s, st) => s + st.n_t + st.n_c, 0),
  };
}

/* ================================================================
   5. STATE
   ================================================================ */
const CI_LEVELS = [0.90, 0.95, 0.99];
const CI_LABELS = ['90%', '95%', '99%'];

const state = {
  dataset: 'aspirin-mi',
  measure: 'OR',
  model: 'DL',
  ciIndex: 1,
  showPrediction: false,
  showRandomDiamond: true,
  showFunnel: true,
  showTrimFill: false,
  sortBy: 'year',
};

let currentStudies = [];
let results = null;

/* ================================================================
   6. TOOLTIP
   ================================================================ */
let tooltip;
function initTooltip() {
  tooltip = d3.select('body').append('div').attr('class', 'meta-tooltip');
}
function showTooltip(html, event) {
  tooltip.html(html).classed('visible', true);
  const tt = tooltip.node();
  const ttW = tt.offsetWidth, ttH = tt.offsetHeight;
  let left = event.pageX + 12;
  let top = event.pageY - ttH - 8;
  if (left + ttW > window.innerWidth - 8) left = event.pageX - ttW - 12;
  if (top < 4) top = event.pageY + 18;
  tooltip.style('left', left + 'px').style('top', top + 'px');
}
function hideTooltip() {
  tooltip.classed('visible', false);
}

/* ================================================================
   7. FORMAT HELPERS
   ================================================================ */
const fmt2 = d3.format('.2f');
const fmt3 = d3.format('.3f');
const fmt1 = d3.format('.1f');
const fmt0 = d3.format('.0f');
const fmtPct = d3.format('.1f');
const fmtComma = d3.format(',');

function fmtP(p) {
  if (p < 0.001) return '< 0.001';
  if (p < 0.01) return p.toFixed(3);
  return p.toFixed(2);
}

function fmtEst(v, isRatio) {
  return isRatio ? fmt2(v) : fmt3(v);
}

/* ================================================================
   8. FOREST PLOT
   ================================================================ */
function drawForest() {
  const container = d3.select('#forest-chart');
  container.selectAll('*').remove();

  if (!results) return;

  const r = results;
  const studies = sortStudies(r.studies);
  const k = studies.length;
  const isRatio = r.isRatio;
  const noEffect = 0; // log scale: ln(1) = 0 for ratio; 0 for RD

  // Layout
  const margin = { top: 32, right: 200, bottom: 50, left: 200 };
  const rowH = 26;
  const plotH = margin.top + (k + 3) * rowH + margin.bottom; // +3 for header, pooled, space
  const containerW = container.node().getBoundingClientRect().width || 800;
  const plotW = containerW;
  const innerW = plotW - margin.left - margin.right;

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${plotW} ${plotH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%')
    .style('max-height', `${plotH}px`);

  const g = svg.append('g');

  // X scale: determine range from data
  const allVals = [];
  studies.forEach(s => {
    allVals.push(s.ci_lo, s.ci_hi);
  });
  allVals.push(r.pooledLo, r.pooledHi);
  if (state.showPrediction) {
    allVals.push(r.predLo, r.predHi);
  }
  allVals.push(noEffect);

  const xMin = d3.min(allVals) * 1.15;
  const xMax = d3.max(allVals) * 1.15;
  const xPad = (xMax - xMin) * 0.05;
  const x = d3.scaleLinear()
    .domain([xMin - xPad, xMax + xPad])
    .range([margin.left, plotW - margin.right]);

  // Y positions
  const yStart = margin.top + rowH; // after header
  const yStudy = i => yStart + i * rowH + rowH / 2;
  const yPooled = yStart + k * rowH + rowH;

  // Background alternating rows
  studies.forEach((s, i) => {
    if (i % 2 === 0) {
      g.append('rect')
        .attr('x', 0).attr('width', plotW)
        .attr('y', yStudy(i) - rowH / 2)
        .attr('height', rowH)
        .attr('class', 'forest-row-bg')
        .attr('fill', '#f8fafc');
    }
  });

  // Header
  g.append('text').attr('class', 'forest-header-label')
    .attr('x', 8).attr('y', margin.top + 4).text('Study');
  g.append('text').attr('class', 'forest-header-label')
    .attr('x', x(noEffect)).attr('y', margin.top + 4)
    .attr('text-anchor', 'middle')
    .text(isRatio ? `${state.measure} (log scale)` : 'Risk Difference');
  g.append('text').attr('class', 'forest-header-label')
    .attr('x', plotW - margin.right + 10).attr('y', margin.top + 4)
    .text(`${state.measure} [${CI_LABELS[state.ciIndex]} CI]`);
  g.append('text').attr('class', 'forest-header-label')
    .attr('x', plotW - 35).attr('y', margin.top + 4)
    .attr('text-anchor', 'end').text('W%');

  // Line of no effect
  g.append('line').attr('class', 'no-effect-line')
    .attr('x1', x(noEffect)).attr('x2', x(noEffect))
    .attr('y1', margin.top + rowH - 8).attr('y2', yPooled + rowH);

  // Pooled estimate dashed line
  g.append('line').attr('class', 'pooled-line')
    .attr('x1', x(r.pooled)).attr('x2', x(r.pooled))
    .attr('y1', margin.top + rowH - 8).attr('y2', yPooled + rowH);

  // Prediction interval
  if (state.showPrediction && r.tau2 > 0) {
    g.append('line').attr('class', 'prediction-interval-line')
      .attr('x1', x(r.predLo)).attr('x2', x(r.predHi))
      .attr('y1', yPooled).attr('y2', yPooled);
    // PI ticks
    [r.predLo, r.predHi].forEach(v => {
      g.append('line')
        .attr('x1', x(v)).attr('x2', x(v))
        .attr('y1', yPooled - 6).attr('y2', yPooled + 6)
        .attr('stroke', 'var(--color-secondary)')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '8 4')
        .attr('opacity', 0.6);
    });
  }

  // Weight scale for squares
  const maxW = d3.max(studies, d => d.weight);
  const sqScale = d3.scaleSqrt().domain([0, maxW]).range([3, 12]);

  // Study rows
  studies.forEach((s, i) => {
    const cy = yStudy(i);
    const sigClass = s.significant ? 'study-significant' : 'study-nonsignificant';
    const grp = g.append('g').attr('class', sigClass);

    // Clip CI line to visible range
    const ciX1 = Math.max(x.range()[0], x(s.ci_lo));
    const ciX2 = Math.min(x.range()[1], x(s.ci_hi));

    // CI line
    grp.append('line').attr('class', 'forest-ci-line')
      .attr('x1', ciX1).attr('x2', ciX2)
      .attr('y1', cy).attr('y2', cy);

    // Arrows if CI extends beyond plot
    if (x(s.ci_lo) < x.range()[0]) {
      grp.append('polygon')
        .attr('points', `${x.range()[0]},${cy} ${x.range()[0] + 6},${cy - 4} ${x.range()[0] + 6},${cy + 4}`)
        .attr('fill', s.significant ? 'var(--color-primary)' : '#94a3b8');
    }
    if (x(s.ci_hi) > x.range()[1]) {
      grp.append('polygon')
        .attr('points', `${x.range()[1]},${cy} ${x.range()[1] - 6},${cy - 4} ${x.range()[1] - 6},${cy + 4}`)
        .attr('fill', s.significant ? 'var(--color-primary)' : '#94a3b8');
    }

    // Square
    const sqSize = sqScale(s.weight);
    grp.append('rect').attr('class', 'forest-square')
      .attr('x', x(s.yi) - sqSize).attr('y', cy - sqSize)
      .attr('width', sqSize * 2).attr('height', sqSize * 2)
      .on('mouseover', (event) => {
        showTooltip(
          `<div class="tt-name">${s.name} (${s.year})</div>
           <div class="tt-detail">
             Tx: ${s.e_t}/${s.n_t} &nbsp; Ctrl: ${s.e_c}/${s.n_c}<br>
             ${state.measure}: ${fmtEst(s.est, isRatio)} [${fmtEst(s.ci_lo_disp, isRatio)}, ${fmtEst(s.ci_hi_disp, isRatio)}]<br>
             Weight: ${fmt1(s.weight)}%
           </div>`, event);
      })
      .on('mousemove', (event) => showTooltip(tooltip.html(), event))
      .on('mouseout', hideTooltip);

    // Study label (left)
    grp.append('text').attr('class', 'forest-study-label')
      .attr('x', 8).attr('y', cy + 4)
      .text(`${s.name} (${s.year})`);

    // Numeric values (right)
    grp.append('text').attr('class', 'forest-value-label')
      .attr('x', plotW - margin.right + 10).attr('y', cy + 4)
      .text(`${fmtEst(s.est, isRatio)} [${fmtEst(s.ci_lo_disp, isRatio)}, ${fmtEst(s.ci_hi_disp, isRatio)}]`);

    // Weight
    grp.append('text').attr('class', 'forest-weight-label')
      .attr('x', plotW - 35).attr('y', cy + 4)
      .attr('text-anchor', 'end')
      .text(fmt1(s.weight));
  });

  // Pooled diamond
  const dh = 8; // half height
  const diamondPoints = (pooledVal, lo, hi, cy) => {
    const cx = x(pooledVal);
    const x1 = x(lo);
    const x2 = x(hi);
    return `${x1},${cy} ${cx},${cy - dh} ${x2},${cy} ${cx},${cy + dh}`;
  };

  // Main pooled diamond
  g.append('polygon').attr('class', 'forest-diamond')
    .attr('points', diamondPoints(r.pooled, r.pooledLo, r.pooledHi, yPooled))
    .attr('fill', 'var(--color-primary)')
    .attr('opacity', 0.85);

  // Fixed-effect diamond (if showing random + toggle)
  if (state.model === 'DL' && state.showRandomDiamond) {
    g.append('polygon').attr('class', 'forest-diamond')
      .attr('points', diamondPoints(r.fixed.pooled, r.fixed.lo, r.fixed.hi, yPooled + rowH * 0.8))
      .attr('fill', '#94a3b8')
      .attr('opacity', 0.5);
    g.append('text').attr('class', 'forest-pooled-label')
      .attr('x', 8).attr('y', yPooled + rowH * 0.8 + 4)
      .text('Fixed-effect')
      .attr('fill', '#94a3b8');
  }

  // Pooled label
  g.append('text').attr('class', 'forest-pooled-label')
    .attr('x', 8).attr('y', yPooled + 4)
    .text(state.model === 'DL' ? 'Random-effects' : 'Fixed-effect');

  g.append('text').attr('class', 'forest-value-label')
    .attr('x', plotW - margin.right + 10).attr('y', yPooled + 4)
    .style('font-weight', '700')
    .text(`${fmtEst(r.pooledDisp, isRatio)} [${fmtEst(r.pooledLoDisp, isRatio)}, ${fmtEst(r.pooledHiDisp, isRatio)}]`);

  // X axis
  let tickVals;
  if (isRatio) {
    tickVals = [0.1, 0.2, 0.5, 1, 2, 5, 10].filter(v => {
      const lv = Math.log(v);
      return lv >= x.domain()[0] && lv <= x.domain()[1];
    });
    const xAxis = d3.axisBottom(x)
      .tickValues(tickVals.map(Math.log))
      .tickFormat(d => fmt2(Math.exp(d)));
    g.append('g').attr('class', 'axis')
      .attr('transform', `translate(0, ${yPooled + rowH + 10})`)
      .call(xAxis);
  } else {
    const xAxis = d3.axisBottom(x).ticks(7).tickFormat(fmt3);
    g.append('g').attr('class', 'axis')
      .attr('transform', `translate(0, ${yPooled + rowH + 10})`)
      .call(xAxis);
  }

  // Axis labels
  g.append('text').attr('class', 'axis-label')
    .attr('x', x(noEffect) - innerW * 0.25).attr('y', plotH - 6)
    .attr('text-anchor', 'middle')
    .text(isRatio ? 'Favours Treatment' : 'Favours Treatment');
  g.append('text').attr('class', 'axis-label')
    .attr('x', x(noEffect) + innerW * 0.25).attr('y', plotH - 6)
    .attr('text-anchor', 'middle')
    .text(isRatio ? 'Favours Control' : 'Favours Control');

  // Heterogeneity annotation
  const hetText = `Heterogeneity: I² = ${fmtPct(r.I2)}%, τ² = ${fmt3(r.tau2)}, Q = ${fmt2(r.Q)} (df = ${r.df}, p = ${fmtP(r.pQ)})`;
  g.append('text').attr('class', 'heterogeneity-annotation')
    .attr('x', 8).attr('y', yPooled + rowH * (state.model === 'DL' && state.showRandomDiamond ? 2.0 : 1.4))
    .text(hetText);
}

/* ================================================================
   9. FUNNEL PLOT
   ================================================================ */
function drawFunnel() {
  const container = d3.select('#bias-funnel-chart');
  container.selectAll('*').remove();

  if (!results) return;

  const r = results;
  const studies = r.studies;

  const margin = { top: 10, right: 20, bottom: 40, left: 50 };
  const containerW = container.node().getBoundingClientRect().width || 400;
  const containerH = 280;
  const w = containerW - margin.left - margin.right;
  const h = containerH - margin.top - margin.bottom;

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${containerW} ${containerH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Scales: x = effect size, y = SE (inverted: 0 at top, max at bottom)
  const maxSE = d3.max(studies, d => d.sei) * 1.3;
  const allEffects = studies.map(d => d.yi);
  const effectRange = d3.extent(allEffects);
  const pad = (effectRange[1] - effectRange[0]) * 0.5 || 0.5;

  const x = d3.scaleLinear()
    .domain([Math.min(effectRange[0] - pad, r.pooled - r.z * maxSE),
             Math.max(effectRange[1] + pad, r.pooled + r.z * maxSE)])
    .range([0, w]);
  const y = d3.scaleLinear()
    .domain([0, maxSE])
    .range([0, h]);

  // Funnel shape (pseudo-CI region)
  const funnelPts = [];
  const nPts = 50;
  for (let i = 0; i <= nPts; i++) {
    const se = maxSE * i / nPts;
    funnelPts.push({ se, lo: r.pooled - r.z * se, hi: r.pooled + r.z * se });
  }

  // Funnel polygon
  const funnelPath = d3.line().x(d => x(d[0])).y(d => y(d[1]));
  const leftEdge = funnelPts.map(p => [p.lo, p.se]);
  const rightEdge = funnelPts.map(p => [p.hi, p.se]).reverse();
  g.append('path')
    .attr('class', 'funnel-boundary')
    .attr('d', funnelPath([...leftEdge, ...rightEdge]) + 'Z');

  // Center line
  g.append('line').attr('class', 'funnel-center-line')
    .attr('x1', x(r.pooled)).attr('x2', x(r.pooled))
    .attr('y1', y(0)).attr('y2', y(maxSE));

  // Trim-and-fill imputed studies
  if (state.showTrimFill) {
    const imputed = trimAndFill(studies, r);
    imputed.forEach(imp => {
      g.append('circle')
        .attr('class', 'funnel-dot-imputed')
        .attr('cx', x(imp.yi)).attr('cy', y(imp.sei));
    });
  }

  // Study dots
  studies.forEach(s => {
    g.append('circle')
      .attr('class', 'funnel-dot')
      .attr('cx', x(s.yi)).attr('cy', y(s.sei))
      .on('mouseover', (event) => {
        showTooltip(
          `<div class="tt-name">${s.name} (${s.year})</div>
           <div class="tt-detail">Effect: ${fmt3(s.yi)}<br>SE: ${fmt3(s.sei)}</div>`, event);
      })
      .on('mousemove', (event) => showTooltip(tooltip.html(), event))
      .on('mouseout', hideTooltip);
  });

  // Axes
  g.append('g').attr('class', 'axis')
    .attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(fmt2));

  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(fmt3));

  // Labels
  g.append('text').attr('class', 'axis-label')
    .attr('x', w / 2).attr('y', h + 34).attr('text-anchor', 'middle')
    .text(r.isRatio ? `ln(${state.measure})` : state.measure);

  g.append('text').attr('class', 'axis-label')
    .attr('transform', `translate(-36,${h / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .text('Standard Error');
}

/* Simple trim-and-fill: mirror studies about pooled estimate */
function trimAndFill(studies, r) {
  const imputed = [];
  studies.forEach(s => {
    const mirror = 2 * r.pooled - s.yi;
    // Check if study is on the "heavy" side (larger effects) and there is no mirror
    const dist = s.yi - r.pooled;
    if (dist > 0.05) { // study is to the right of pooled
      const hasMatch = studies.some(other => {
        return Math.abs(other.yi - mirror) < 0.1 && Math.abs(other.sei - s.sei) < s.sei * 0.3;
      });
      if (!hasMatch) {
        imputed.push({ yi: mirror, sei: s.sei, name: `Imputed (${s.name})` });
      }
    }
  });
  return imputed;
}

/* ================================================================
   10. HETEROGENEITY EXPLORER
   ================================================================ */
function drawHeterogeneity() {
  const container = d3.select('#heterogeneity-chart');
  container.selectAll('*').remove();

  if (!results) return;

  const r = results;
  const studies = r.studies;

  const margin = { top: 10, right: 20, bottom: 40, left: 50 };
  const containerW = container.node().getBoundingClientRect().width || 400;
  const containerH = 280;
  const w = containerW - margin.left - margin.right;
  const h = containerH - margin.top - margin.bottom;

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${containerW} ${containerH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Effect values
  const effects = studies.map(d => d.yi);
  const allVals = [...effects, r.pooled];
  if (state.showPrediction) {
    allVals.push(r.predLo, r.predHi);
  }
  const extent = d3.extent(allVals);
  const pad = (extent[1] - extent[0]) * 0.3 || 0.3;
  const xDom = [extent[0] - pad, extent[1] + pad];

  const x = d3.scaleLinear().domain(xDom).range([0, w]);

  // Histogram
  const bins = d3.bin().domain(xDom).thresholds(
    d3.thresholdSturges(effects)
  )(effects);

  const yMax = d3.max(bins, b => b.length);
  const y = d3.scaleLinear().domain([0, yMax * 1.3]).range([h, 0]);

  // Bars
  bins.forEach(b => {
    if (b.length === 0) return;
    g.append('rect').attr('class', 'het-bar')
      .attr('x', x(b.x0) + 1)
      .attr('width', Math.max(0, x(b.x1) - x(b.x0) - 2))
      .attr('y', y(b.length))
      .attr('height', h - y(b.length));
  });

  // Pooled estimate band (CI)
  g.append('rect').attr('class', 'het-pooled-band')
    .attr('x', x(r.pooledLo)).attr('width', x(r.pooledHi) - x(r.pooledLo))
    .attr('y', 0).attr('height', h);

  // Pooled line
  g.append('line').attr('class', 'het-pooled-line')
    .attr('x1', x(r.pooled)).attr('x2', x(r.pooled))
    .attr('y1', 0).attr('y2', h);

  // Prediction interval band
  if (state.showPrediction && r.tau2 > 0) {
    g.append('rect').attr('class', 'het-prediction-band')
      .attr('x', x(r.predLo)).attr('width', x(r.predHi) - x(r.predLo))
      .attr('y', 0).attr('height', h);

    [r.predLo, r.predHi].forEach(v => {
      g.append('line').attr('class', 'het-prediction-line')
        .attr('x1', x(v)).attr('x2', x(v))
        .attr('y1', 0).attr('y2', h);
    });
  }

  // Normal density overlay of pooled distribution
  const nPts = 100;
  const pooledSE = r.tau2 > 0 ? Math.sqrt(r.sePo * r.sePo + r.tau2) : r.sePo;
  const densityPts = [];
  for (let i = 0; i <= nPts; i++) {
    const xv = xDom[0] + (xDom[1] - xDom[0]) * i / nPts;
    const zv = (xv - r.pooled) / pooledSE;
    const dens = Math.exp(-0.5 * zv * zv) / (pooledSE * Math.sqrt(2 * Math.PI));
    densityPts.push({ x: xv, y: dens });
  }
  const maxDens = d3.max(densityPts, d => d.y);
  const densScale = (yMax * 0.8) / maxDens;

  const densLine = d3.line()
    .x(d => x(d.x))
    .y(d => y(d.y * densScale))
    .curve(d3.curveBasis);

  g.append('path').attr('class', 'het-density-line')
    .attr('d', densLine(densityPts));

  // Study tick marks at bottom
  studies.forEach(s => {
    g.append('line').attr('class', 'het-study-tick')
      .attr('x1', x(s.yi)).attr('x2', x(s.yi))
      .attr('y1', h - 5).attr('y2', h + 5);
  });

  // Axes
  g.append('g').attr('class', 'axis')
    .attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(fmt3));

  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('d')));

  // Labels
  g.append('text').attr('class', 'axis-label')
    .attr('x', w / 2).attr('y', h + 34).attr('text-anchor', 'middle')
    .text(r.isRatio ? `ln(${state.measure})` : state.measure);

  g.append('text').attr('class', 'axis-label')
    .attr('transform', `translate(-36,${h / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .text('Frequency');
}

/* ================================================================
   11. STATS GRID
   ================================================================ */
function updateStats() {
  if (!results) return;
  const r = results;
  const isRatio = r.isRatio;

  document.getElementById('stat-pooled').textContent =
    `${fmtEst(r.pooledDisp, isRatio)} [${fmtEst(r.pooledLoDisp, isRatio)}, ${fmtEst(r.pooledHiDisp, isRatio)}]`;

  const i2Label = r.I2 < 25 ? 'Low' : r.I2 < 75 ? 'Moderate' : 'High';
  document.getElementById('stat-i2').textContent = `${fmtPct(r.I2)}% (${i2Label})`;

  document.getElementById('stat-tau2').textContent = fmt3(r.tau2);

  document.getElementById('stat-q').textContent = `${fmt2(r.Q)} (p = ${fmtP(r.pQ)})`;

  document.getElementById('stat-studies').textContent =
    `${r.k} / ${fmtComma(r.totalParticipants)}`;
}

/* ================================================================
   12. SORTING
   ================================================================ */
function sortStudies(studies) {
  const sorted = [...studies];
  switch (state.sortBy) {
    case 'year':
      sorted.sort((a, b) => a.year - b.year);
      break;
    case 'weight':
      sorted.sort((a, b) => b.weight - a.weight);
      break;
    case 'effect':
      sorted.sort((a, b) => a.yi - b.yi);
      break;
  }
  return sorted;
}

/* ================================================================
   13. RENDER ALL
   ================================================================ */
function renderAll() {
  // Get current dataset studies
  if (state.dataset === 'custom') {
    // parse from textarea
    const text = document.getElementById('custom-textarea').value;
    currentStudies = parseCustomStudies(text);
  } else {
    const ds = DATASETS[state.dataset];
    currentStudies = ds.studies;
  }

  if (currentStudies.length === 0) {
    results = null;
    return;
  }

  // Run analysis
  results = runMetaAnalysis(currentStudies, state.measure, state.model, CI_LEVELS[state.ciIndex]);

  // Draw all
  drawForest();
  drawFunnel();
  drawHeterogeneity();
  updateStats();
  updateFormulaDisplay();
}

function parseCustomStudies(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  return lines.map(line => {
    const parts = line.split(',').map(s => s.trim());
    if (parts.length < 6) return null;
    return {
      name: parts[0],
      year: parseInt(parts[1]) || 2000,
      n_t: parseInt(parts[2]) || 0,
      e_t: parseInt(parts[3]) || 0,
      n_c: parseInt(parts[4]) || 0,
      e_c: parseInt(parts[5]) || 0,
    };
  }).filter(Boolean);
}

/* ================================================================
   14. FORMULA DISPLAY (KaTeX)
   ================================================================ */
function updateFormulaDisplay() {
  const legend = document.getElementById('forest-legend');
  if (!legend || !results) return;

  const r = results;
  let tex = '';

  if (state.model === 'DL') {
    tex = `\\hat{\\theta}_{RE} = \\frac{\\sum w_i^* \\, y_i}{\\sum w_i^*}, \\quad w_i^* = \\frac{1}{v_i + \\hat{\\tau}^2}, \\quad \\hat{\\tau}^2 = ${fmt3(r.tau2)}`;
  } else if (state.model === 'MH' && state.measure === 'OR') {
    tex = `OR_{MH} = \\frac{\\sum a_i d_i / N_i}{\\sum b_i c_i / N_i}`;
  } else {
    tex = `\\hat{\\theta}_{FE} = \\frac{\\sum w_i \\, y_i}{\\sum w_i}, \\quad w_i = \\frac{1}{v_i}`;
  }

  try {
    katex.render(tex, legend, { displayMode: true, throwOnError: false });
  } catch (e) {
    legend.textContent = '';
  }
}

/* ================================================================
   15. EVENT BINDING
   ================================================================ */
function initControls() {
  // Dataset select
  const datasetSel = document.getElementById('dataset-select');
  datasetSel.addEventListener('change', () => {
    state.dataset = datasetSel.value;
    const customEditor = document.getElementById('custom-editor');
    customEditor.style.display = state.dataset === 'custom' ? '' : 'none';

    // Update measure based on dataset
    if (state.dataset !== 'custom' && DATASETS[state.dataset]) {
      const ds = DATASETS[state.dataset];
      if (ds.measure) {
        state.measure = ds.measure;
        document.getElementById('measure-select').value = ds.measure;
      }
    }
    renderAll();
  });

  // Measure select
  document.getElementById('measure-select').addEventListener('change', (e) => {
    state.measure = e.target.value;
    renderAll();
  });

  // Model select
  document.getElementById('model-select').addEventListener('change', (e) => {
    state.model = e.target.value;
    renderAll();
  });

  // Toggles
  document.getElementById('toggle-random-diamond').addEventListener('change', (e) => {
    state.showRandomDiamond = e.target.checked;
    renderAll();
  });

  document.getElementById('toggle-prediction').addEventListener('change', (e) => {
    state.showPrediction = e.target.checked;
    renderAll();
  });

  document.getElementById('toggle-funnel').addEventListener('change', (e) => {
    state.showFunnel = e.target.checked;
    document.getElementById('bias-panel').style.display = e.target.checked ? '' : 'none';
    renderAll();
  });

  document.getElementById('toggle-trimfill').addEventListener('change', (e) => {
    state.showTrimFill = e.target.checked;
    renderAll();
  });

  // CI slider
  const ciSlider = document.getElementById('ci-slider');
  const ciVal = document.getElementById('ci-val');
  ciSlider.addEventListener('input', () => {
    state.ciIndex = parseInt(ciSlider.value);
    ciVal.textContent = CI_LABELS[state.ciIndex];
    renderAll();
  });

  // Sort
  document.getElementById('sort-select').addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderAll();
  });

  // Custom editor apply
  document.getElementById('apply-custom-btn').addEventListener('click', () => {
    state.dataset = 'custom';
    renderAll();
  });
}

/* ================================================================
   16. INIT
   ================================================================ */
function init() {
  initTooltip();
  initControls();

  // Set default model
  document.getElementById('model-select').value = state.model;

  // Initial render
  renderAll();

  // Resize handler
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderAll, 200);
  });
}

document.addEventListener('DOMContentLoaded', init);
