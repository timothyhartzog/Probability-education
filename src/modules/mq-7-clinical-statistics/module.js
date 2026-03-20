/* ============================================================
   Module MQ-7 — Clinical Trial & Treatment Effect Statistics
   ============================================================
   Interactive visualization of treatment effects, NNT, and
   confidence intervals — the statistical backbone of
   evidence-based medicine.
   ============================================================ */

import * as d3 from 'd3';
import katex from 'katex';
import '../../lib/copy-code.js';
import '../../lib/param-tooltips.js';

/* ---- Mulberry32 seeded PRNG -------------------------------- */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- Normal random via Box-Muller -------------------------- */
function randNormal(rng, mu = 0, sigma = 1) {
  let u, v;
  do { u = rng(); } while (u === 0);
  v = rng();
  return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ---- Z-value from confidence level ------------------------- */
function zFromConf(conf) {
  // Rational approximation (Abramowitz & Stegun 26.2.23)
  const p = 1 - (1 - conf / 100) / 2;
  const a = [0, -3.969683028665376e1, 2.209460984245205e2,
    -2.759285104469687e2, 1.383577518672690e2,
    -3.066479806614716e1, 2.506628277459239e0];
  const b = [0, -5.447609879822406e1, 1.615858368580409e2,
    -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [0, -7.784894002430293e-3, -3.223964580411365e-1,
    -2.400758277161838e0, -2.549732539343734e0,
    4.374664141464968e0, 2.938163982698783e0];
  const d = [0, 7.784695709041462e-3, 3.224671290700398e-1,
    2.445134137142996e0, 3.754408661907416e0];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q, r;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6]) /
           ((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[1]*r+a[2])*r+a[3])*r+a[4])*r+a[5])*r+a[6])*q /
           (((((b[1]*r+b[2])*r+b[3])*r+b[4])*r+b[5])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6]) /
            ((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1);
  }
}

/* ---- Clinical scenarios ------------------------------------ */
const SCENARIOS = {
  'aspirin-mi':        { label: 'Aspirin for MI',                    cer: 8.2,  eer: 6.7,  n: 10000 },
  'statins':           { label: 'Statins Primary Prevention',        cer: 3.0,  eer: 2.2,  n: 5000  },
  'ace-hf':            { label: 'ACE Inhibitors for Heart Failure',  cer: 42,   eer: 35,   n: 1000  },
  'antibiotics-throat':{ label: 'Antibiotics for Sore Throat',       cer: 40,   eer: 20,   n: 200   },
  'cancer-screening':  { label: 'Cancer Screening',                  cer: 0.3,  eer: 0.2,  n: 50000 },
  'custom':            { label: 'Custom',                            cer: 20,   eer: 15,   n: 500   }
};

/* ---- State ------------------------------------------------- */
let state = {
  scenario: 'custom',
  cer: 20,
  eer: 15,
  n: 500,
  confLevel: 95,
  showNNT: true,
  showCISim: true,
  logNNT: false,
  seed: 42
};

/* ---- Derived statistics ------------------------------------ */
function computeStats(cer, eer, n, confLevel) {
  const p_c = cer / 100;
  const p_e = eer / 100;
  const arr = p_c - p_e;
  const rrr = p_c > 0 ? arr / p_c : 0;
  const nnt = arr > 0 ? 1 / arr : Infinity;

  const z = zFromConf(confLevel);

  // SE of ARR (independent proportions)
  const se_arr = Math.sqrt((p_c * (1 - p_c) / n) + (p_e * (1 - p_e) / n));
  const arr_lo = arr - z * se_arr;
  const arr_hi = arr + z * se_arr;

  // NNT CI (reciprocal of ARR CI, only if both bounds > 0)
  const nnt_lo = arr_hi > 0 ? 1 / arr_hi : Infinity;
  const nnt_hi = arr_lo > 0 ? 1 / arr_lo : Infinity;

  // RRR CI via delta method: SE(RRR) ~ SE(ARR)/CER
  const se_rrr = p_c > 0 ? se_arr / p_c : 0;
  const rrr_lo = rrr - z * se_rrr;
  const rrr_hi = rrr + z * se_rrr;

  // Risk Ratio = EER/CER
  const rr = p_c > 0 ? p_e / p_c : 0;
  const se_ln_rr = Math.sqrt(
    (1 - p_e) / (p_e * n + 1e-12) + (1 - p_c) / (p_c * n + 1e-12)
  );
  const rr_lo = Math.exp(Math.log(rr + 1e-12) - z * se_ln_rr);
  const rr_hi = Math.exp(Math.log(rr + 1e-12) + z * se_ln_rr);

  // Odds Ratio
  const odds_e = p_e / (1 - p_e + 1e-12);
  const odds_c = p_c / (1 - p_c + 1e-12);
  const or = odds_e / (odds_c + 1e-12);
  const se_ln_or = Math.sqrt(
    1 / (p_e * n + 1e-12) + 1 / ((1 - p_e) * n + 1e-12) +
    1 / (p_c * n + 1e-12) + 1 / ((1 - p_c) * n + 1e-12)
  );
  const or_lo = Math.exp(Math.log(or + 1e-12) - z * se_ln_or);
  const or_hi = Math.exp(Math.log(or + 1e-12) + z * se_ln_or);

  // Chi-square test (2x2 table)
  const a = Math.round(p_e * n), b = n - a;
  const c = Math.round(p_c * n), d_val = n - c;
  const N = 2 * n;
  const chi2 = chiSquare2x2(a, b, c, d_val, N);
  const pValue = 1 - chi2CDF(chi2, 1);

  return {
    p_c, p_e, arr, rrr, nnt, z, se_arr,
    arr_lo, arr_hi, nnt_lo, nnt_hi,
    rrr_lo, rrr_hi,
    rr, rr_lo, rr_hi,
    or, or_lo, or_hi,
    chi2, pValue
  };
}

function chiSquare2x2(a, b, c, d, N) {
  const num = N * (a * d - b * c) ** 2;
  const denom = (a + b) * (c + d) * (a + c) * (b + d);
  return denom > 0 ? num / denom : 0;
}

function chi2CDF(x, k) {
  // Regularized lower incomplete gamma for k/2, x/2
  if (x <= 0) return 0;
  return gammainc(k / 2, x / 2);
}

function gammainc(a, x) {
  // Series expansion of regularized lower incomplete gamma
  if (x < a + 1) {
    let sum = 1 / a, term = 1 / a;
    for (let n = 1; n < 200; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < 1e-12 * Math.abs(sum)) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
  } else {
    // Continued fraction
    let f = 1e-30, C = 1e-30, D = 0;
    for (let i = 1; i < 200; i++) {
      const an = (i % 2 === 1) ? ((i - 1) / 2 + 1 - a) : (i / 2);
      const real_an = (i === 1) ? 1 : (i % 2 === 1 ? (Math.ceil(i/2) - a) : Math.floor(i / 2));
      D = x + real_an * (D === 0 ? 1e-30 : 1/D);
      D = 1 / D;
      C = x + real_an / C;
      f *= D * C;
    }
    // Fall back to series for safety
    return 1 - cfGamma(a, x);
  }
}

function cfGamma(a, x) {
  // Upper incomplete gamma via Lentz continued fraction
  let f = x + 1 - a, C = 1 / 1e-30, D = 1 / f, result = D;
  for (let i = 1; i < 200; i++) {
    const aterm = -i * (i - a);
    const bterm = x + 2 * i + 1 - a;
    D = bterm + aterm * D;
    if (Math.abs(D) < 1e-30) D = 1e-30;
    C = bterm + aterm / C;
    if (Math.abs(C) < 1e-30) C = 1e-30;
    D = 1 / D;
    const delta = D * C;
    result *= delta;
    if (Math.abs(delta - 1) < 1e-12) break;
  }
  return Math.exp(-x + a * Math.log(x) - lgamma(a)) * result;
}

function lgamma(x) {
  // Lanczos approximation
  const g = 7;
  const coefs = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
  ];
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  }
  x -= 1;
  let a = coefs[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) {
    a += coefs[i] / (x + i);
  }
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/* ---- Formatting helpers ------------------------------------ */
function fmtPct(v, digits = 1) {
  return (v * 100).toFixed(digits) + '%';
}

function fmtNum(v, digits = 1) {
  if (!isFinite(v)) return '\u221e';
  return v.toFixed(digits);
}

function fmtPval(p) {
  if (p < 0.0001) return '< 0.0001';
  if (p < 0.001) return p.toExponential(1);
  return p.toFixed(4);
}

/* ---- Dimensions -------------------------------------------- */
const EFFECT = { w: 960, h: 500, mt: 45, mr: 30, mb: 30, ml: 30 };
const RISK   = { w: 480, h: 380, mt: 30, mr: 30, mb: 60, ml: 65 };
const CI     = { w: 480, h: 380, mt: 30, mr: 30, mb: 40, ml: 55 };

/* ---- Tooltip ----------------------------------------------- */
let tooltip;
function ensureTooltip() {
  if (!tooltip) {
    tooltip = d3.select('body').append('div').attr('class', 'module-tooltip');
  }
  return tooltip;
}
function showTooltip(event, html) {
  const tt = ensureTooltip();
  tt.html(html).classed('visible', true)
    .style('left', (event.pageX + 14) + 'px')
    .style('top', (event.pageY - 28) + 'px');
}
function hideTooltip() {
  ensureTooltip().classed('visible', false);
}

/* ============================================================
   PANEL 1 — Treatment Effect Visualizer (Patient Icons)
   ============================================================ */
function drawEffectChart(stats) {
  const container = d3.select('#effect-chart');
  container.selectAll('*').remove();

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${EFFECT.w} ${EFFECT.h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%');

  const g = svg.append('g').attr('transform', `translate(${EFFECT.ml},${EFFECT.mt})`);
  const iw = EFFECT.w - EFFECT.ml - EFFECT.mr;
  const ih = EFFECT.h - EFFECT.mt - EFFECT.mb;

  const groupW = iw * 0.42;
  const gap = iw * 0.16;
  const cols = 10, rows = 10;
  const iconSize = Math.min(groupW / cols, ih / rows) * 0.85;
  const padX = (groupW - cols * iconSize) / (cols - 1);
  const padY = ((ih - 40) - rows * iconSize) / (rows - 1);

  // Control group: events = red
  const controlEvents = Math.round(stats.p_c * 100);
  const treatEvents = Math.round(stats.p_e * 100);
  const extraSaved = controlEvents - treatEvents;
  const nnt = stats.arr > 0 ? Math.round(1 / stats.arr) : Infinity;

  // Draw group function
  function drawGroup(gParent, xOff, eventCount, label, isExperimental) {
    const gg = gParent.append('g').attr('transform', `translate(${xOff}, 35)`);

    // Label
    gParent.append('text')
      .attr('class', 'group-label')
      .attr('x', xOff + groupW / 2)
      .attr('y', 15)
      .text(label);

    // Sublabel
    const evtPct = (eventCount / 100 * 100).toFixed(0);
    gParent.append('text')
      .attr('class', 'group-sublabel')
      .attr('x', xOff + groupW / 2)
      .attr('y', 30)
      .text(`${eventCount}/100 events (${evtPct}%)`);

    for (let i = 0; i < 100; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * (iconSize + padX);
      const y = row * (iconSize + padY);
      const isEvent = i < eventCount;

      // Person icon as rounded rect
      const rect = gg.append('rect')
        .attr('class', `patient-icon ${isEvent ? 'not-recovered' : 'recovered'}`)
        .attr('x', x)
        .attr('y', y)
        .attr('width', iconSize * 0.85)
        .attr('height', iconSize * 0.85)
        .attr('rx', iconSize * 0.15);

      // NNT highlight: in treatment group, mark every NNTth patient among the "saved"
      if (isExperimental && state.showNNT && !isEvent && nnt > 0 && isFinite(nnt)) {
        // Highlight the "extra saved" patients
        const savedIndex = i - treatEvents;
        if (savedIndex >= 0 && savedIndex < extraSaved) {
          rect.classed('nnt-highlight', true);
        }
      }

      rect.on('mouseenter', (event) => {
        const desc = isEvent ? 'Bad outcome' : 'Good outcome';
        let extra = '';
        if (isExperimental && state.showNNT && !isEvent && nnt > 0 && isFinite(nnt)) {
          const savedIndex = i - treatEvents;
          if (savedIndex >= 0 && savedIndex < extraSaved) {
            extra = `<br/><strong>Extra patient saved by treatment</strong>`;
          }
        }
        showTooltip(event, `Patient #${i + 1}: ${desc}${extra}`);
      })
      .on('mouseleave', hideTooltip);
    }
  }

  drawGroup(g, 0, controlEvents, 'Control Group', false);
  drawGroup(g, groupW + gap, treatEvents, 'Treatment Group', true);

  // ARR annotation in the middle
  const midX = groupW + gap / 2;
  if (extraSaved > 0) {
    g.append('text')
      .attr('class', 'arr-label')
      .attr('x', midX)
      .attr('y', ih * 0.45)
      .text(`ARR = ${fmtPct(stats.arr)}`);

    g.append('text')
      .attr('class', 'arr-label')
      .attr('x', midX)
      .attr('y', ih * 0.45 + 20)
      .style('font-size', '11px')
      .text(`${extraSaved} fewer events`);

    if (state.showNNT && isFinite(nnt)) {
      g.append('text')
        .attr('class', 'nnt-label')
        .attr('x', midX)
        .attr('y', ih * 0.45 + 42)
        .text(`NNT = ${nnt}`);

      g.append('text')
        .attr('class', 'nnt-label')
        .attr('x', midX)
        .attr('y', ih * 0.45 + 56)
        .style('font-size', '10px')
        .style('font-weight', '400')
        .text(`(treat ${nnt} to save 1)`);
    }
  }

  // Legend
  updateEffectLegend();
}

function updateEffectLegend() {
  const legend = d3.select('#effect-legend');
  legend.selectAll('*').remove();

  const items = [
    { color: 'var(--color-accent)', label: 'Good outcome (recovered)' },
    { color: 'var(--color-error)', label: 'Bad outcome (event)' }
  ];
  if (state.showNNT) {
    items.push({ color: '#facc15', label: 'Extra patient saved (NNT)', border: true });
  }

  items.forEach(item => {
    const el = legend.append('span').attr('class', 'legend-item');
    const swatch = el.append('span').attr('class', 'legend-swatch')
      .style('background', item.color);
    if (item.border) {
      swatch.style('border', '2px solid #a16207');
    }
    el.append('span').text(item.label);
  });
}

/* ============================================================
   PANEL 2 — Risk Measures Comparison (Grouped Bar Chart)
   ============================================================ */
function drawRiskChart(stats) {
  const container = d3.select('#risk-chart');
  container.selectAll('*').remove();

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${RISK.w} ${RISK.h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%');

  const iw = RISK.w - RISK.ml - RISK.mr;
  const ih = RISK.h - RISK.mt - RISK.mb;
  const g = svg.append('g').attr('transform', `translate(${RISK.ml},${RISK.mt})`);

  // Measures to display — some are proportions, NNT is a count
  // We show two sub-charts side by side: proportions (left) and NNT (right)
  const propMeasures = [
    { key: 'CER', value: stats.p_c, lo: null, hi: null, color: 'var(--viz-1)' },
    { key: 'EER', value: stats.p_e, lo: null, hi: null, color: 'var(--viz-2)' },
    { key: 'ARR', value: stats.arr, lo: stats.arr_lo, hi: stats.arr_hi, color: 'var(--viz-3)' },
    { key: 'RRR', value: stats.rrr, lo: stats.rrr_lo, hi: stats.rrr_hi, color: 'var(--viz-4)' }
  ];

  const nntMeasure = {
    key: 'NNT', value: stats.nnt,
    lo: stats.nnt_lo, hi: Math.min(stats.nnt_hi, 9999),
    color: 'var(--viz-5)'
  };

  // --- Proportion bars (left 70% of width) ---
  const propW = iw * 0.65;
  const nntW = iw * 0.25;
  const gapW = iw * 0.10;

  const xProp = d3.scaleBand()
    .domain(propMeasures.map(d => d.key))
    .range([0, propW])
    .padding(0.3);

  // Y: accommodate possible negative ARR or RRR CIs
  const allVals = propMeasures.flatMap(d => [d.value, d.lo, d.hi].filter(v => v !== null && isFinite(v)));
  const yMin = Math.min(0, d3.min(allVals) * 1.15);
  const yMax = Math.max(0.01, d3.max(allVals) * 1.15);

  const yProp = d3.scaleLinear()
    .domain([yMin, yMax])
    .nice()
    .range([ih, 0]);

  // Zero line
  g.append('line')
    .attr('x1', 0).attr('x2', propW)
    .attr('y1', yProp(0)).attr('y2', yProp(0))
    .attr('stroke', '#94a3b8').attr('stroke-width', 1).attr('stroke-dasharray', '3 2');

  // Bars
  propMeasures.forEach(d => {
    const barX = xProp(d.key);
    const barW = xProp.bandwidth();
    const barY = d.value >= 0 ? yProp(d.value) : yProp(0);
    const barH = Math.abs(yProp(d.value) - yProp(0));

    g.append('rect')
      .attr('class', 'risk-bar')
      .attr('x', barX).attr('y', barY)
      .attr('width', barW).attr('height', Math.max(1, barH))
      .attr('fill', d.color)
      .attr('rx', 2)
      .on('mouseenter', (event) => {
        showTooltip(event, `<strong>${d.key}</strong>: ${fmtPct(d.value, 2)}` +
          (d.lo !== null ? `<br/>CI: [${fmtPct(d.lo, 2)}, ${fmtPct(d.hi, 2)}]` : ''));
      })
      .on('mouseleave', hideTooltip);

    // Value label
    g.append('text')
      .attr('class', 'bar-value-label')
      .attr('x', barX + barW / 2)
      .attr('y', (d.value >= 0 ? barY - 5 : barY + barH + 12))
      .text(fmtPct(d.value, 1));

    // CI whiskers
    if (d.lo !== null && isFinite(d.lo) && isFinite(d.hi)) {
      const cx = barX + barW / 2;
      g.append('line')
        .attr('class', 'ci-whisker')
        .attr('x1', cx).attr('x2', cx)
        .attr('y1', yProp(d.lo)).attr('y2', yProp(d.hi));
      // Caps
      const capW = barW * 0.3;
      [d.lo, d.hi].forEach(v => {
        g.append('line')
          .attr('class', 'ci-cap')
          .attr('x1', cx - capW / 2).attr('x2', cx + capW / 2)
          .attr('y1', yProp(v)).attr('y2', yProp(v));
      });
    }
  });

  // Proportion axis
  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(yProp).ticks(6).tickFormat(d => fmtPct(d, 0)));

  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(xProp));

  // --- NNT bar (right portion) ---
  const nntG = g.append('g').attr('transform', `translate(${propW + gapW}, 0)`);

  if (isFinite(nntMeasure.value) && nntMeasure.value > 0) {
    const maxNNT = Math.min(Math.max(nntMeasure.hi || nntMeasure.value * 2, nntMeasure.value * 1.5), 10000);

    const yNNT = state.logNNT
      ? d3.scaleLog().domain([1, Math.max(10, maxNNT)]).range([ih, 0]).clamp(true)
      : d3.scaleLinear().domain([0, maxNNT]).nice().range([ih, 0]);

    const barW2 = nntW * 0.5;
    const barX2 = (nntW - barW2) / 2;
    const nntVal = Math.min(nntMeasure.value, maxNNT);
    const barY2 = yNNT(nntVal);
    const barH2 = ih - barY2;

    nntG.append('rect')
      .attr('class', 'risk-bar')
      .attr('x', barX2).attr('y', barY2)
      .attr('width', barW2).attr('height', Math.max(1, barH2))
      .attr('fill', nntMeasure.color)
      .attr('rx', 2)
      .on('mouseenter', (event) => {
        showTooltip(event,
          `<strong>NNT</strong>: ${fmtNum(nntMeasure.value, 1)}` +
          `<br/>CI: [${fmtNum(nntMeasure.lo, 1)}, ${fmtNum(nntMeasure.hi, 1)}]`);
      })
      .on('mouseleave', hideTooltip);

    // NNT value label
    nntG.append('text')
      .attr('class', 'bar-value-label')
      .attr('x', barX2 + barW2 / 2)
      .attr('y', barY2 - 5)
      .text(fmtNum(nntMeasure.value, 1));

    // CI whiskers for NNT
    if (isFinite(nntMeasure.lo) && isFinite(nntMeasure.hi)) {
      const cx = barX2 + barW2 / 2;
      const loY = yNNT(Math.max(state.logNNT ? 1 : 0, Math.min(nntMeasure.lo, maxNNT)));
      const hiY = yNNT(Math.min(nntMeasure.hi, maxNNT));
      nntG.append('line')
        .attr('class', 'ci-whisker')
        .attr('x1', cx).attr('x2', cx)
        .attr('y1', loY).attr('y2', hiY);
      const capW = barW2 * 0.4;
      [loY, hiY].forEach(yy => {
        nntG.append('line')
          .attr('class', 'ci-cap')
          .attr('x1', cx - capW / 2).attr('x2', cx + capW / 2)
          .attr('y1', yy).attr('y2', yy);
      });
    }

    // NNT axis
    const nntAxis = state.logNNT
      ? d3.axisLeft(yNNT).ticks(5, '~s')
      : d3.axisLeft(yNNT).ticks(5);

    nntG.append('g')
      .attr('class', 'axis')
      .call(nntAxis);

    nntG.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${ih})`)
      .call(d3.axisBottom(d3.scaleBand().domain(['NNT']).range([0, nntW]).padding(0.3)));
  } else {
    nntG.append('text')
      .attr('class', 'axis-label')
      .attr('x', nntW / 2).attr('y', ih / 2)
      .attr('text-anchor', 'middle')
      .text('NNT: \u221e (no benefit)');
  }
}

/* ============================================================
   PANEL 3 — Confidence Interval & Repeated Sampling
   ============================================================ */
function drawCIChart(stats) {
  const container = d3.select('#ci-chart');
  container.selectAll('*').remove();

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${CI.w} ${CI.h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%');

  const iw = CI.w - CI.ml - CI.mr;
  const ih = CI.h - CI.mt - CI.mb;
  const g = svg.append('g').attr('transform', `translate(${CI.ml},${CI.mt})`);

  const trueEffect = stats.arr;
  const se = stats.se_arr;
  const z = stats.z;

  // --- Top half: Bell curve of sampling distribution ---
  const bellH = state.showCISim ? ih * 0.4 : ih * 0.85;
  const simH = ih - bellH - 15;

  // X scale: center on true effect, show +/- 4 SE
  const xMin = trueEffect - 4 * se;
  const xMax = trueEffect + 4 * se;
  const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, iw]);

  // Bell curve
  const nPoints = 200;
  const bellData = d3.range(nPoints).map(i => {
    const x = xMin + (xMax - xMin) * i / (nPoints - 1);
    const zVal = (x - trueEffect) / (se || 1e-12);
    const y = Math.exp(-0.5 * zVal * zVal) / (Math.sqrt(2 * Math.PI) * (se || 1e-12));
    return { x, y };
  });

  const yBell = d3.scaleLinear()
    .domain([0, d3.max(bellData, d => d.y)])
    .range([bellH, 0]);

  // CI shaded region
  const ciLo = trueEffect - z * se;
  const ciHi = trueEffect + z * se;
  const ciData = bellData.filter(d => d.x >= ciLo && d.x <= ciHi);

  if (ciData.length > 1) {
    const area = d3.area()
      .x(d => xScale(d.x))
      .y0(bellH)
      .y1(d => yBell(d.y));

    g.append('path')
      .datum(ciData)
      .attr('class', 'ci-region')
      .attr('d', area);
  }

  // Bell curve line
  const line = d3.line()
    .x(d => xScale(d.x))
    .y(d => yBell(d.y));

  g.append('path')
    .datum(bellData)
    .attr('class', 'bell-curve')
    .attr('d', line)
    .attr('fill', 'none');

  // Fill under curve
  const areaAll = d3.area()
    .x(d => xScale(d.x))
    .y0(bellH)
    .y1(d => yBell(d.y));

  g.insert('path', ':first-child')
    .datum(bellData)
    .attr('d', areaAll)
    .attr('fill', 'rgba(37, 99, 235, 0.05)');

  // True effect line
  g.append('line')
    .attr('class', 'true-effect-line')
    .attr('x1', xScale(trueEffect)).attr('x2', xScale(trueEffect))
    .attr('y1', 0).attr('y2', state.showCISim ? ih : bellH);

  // Labels
  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', xScale(trueEffect))
    .attr('y', -5)
    .attr('text-anchor', 'middle')
    .style('font-weight', '600')
    .style('fill', 'var(--color-text)')
    .text(`True ARR = ${fmtPct(trueEffect, 2)}`);

  // CI bounds labels
  if (isFinite(ciLo) && isFinite(ciHi)) {
    g.append('text')
      .attr('class', 'axis-label')
      .attr('x', xScale(ciLo))
      .attr('y', bellH + 12)
      .attr('text-anchor', 'middle')
      .style('font-size', '9px')
      .text(fmtPct(ciLo, 2));

    g.append('text')
      .attr('class', 'axis-label')
      .attr('x', xScale(ciHi))
      .attr('y', bellH + 12)
      .attr('text-anchor', 'middle')
      .style('font-size', '9px')
      .text(fmtPct(ciHi, 2));

    // Bracket showing CI width
    g.append('text')
      .attr('class', 'axis-label')
      .attr('x', xScale((ciLo + ciHi) / 2))
      .attr('y', bellH + 24)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', 'var(--color-primary)')
      .text(`${state.confLevel}% CI region`);
  }

  // --- Bottom half: 20 simulated CIs ---
  if (state.showCISim) {
    const simG = g.append('g').attr('transform', `translate(0, ${bellH + 35})`);
    const rng = mulberry32(state.seed);
    const numSim = 20;
    const simData = [];

    for (let i = 0; i < numSim; i++) {
      // Simulate a trial: sample ARR from N(trueEffect, se)
      const sampledARR = randNormal(rng, trueEffect, se);
      // This trial's CI
      const lo = sampledARR - z * se;
      const hi = sampledARR + z * se;
      const contains = trueEffect >= lo && trueEffect <= hi;
      simData.push({ i, sampledARR, lo, hi, contains });
    }

    const ySimScale = d3.scaleBand()
      .domain(d3.range(numSim))
      .range([0, simH])
      .padding(0.25);

    // True effect line in sim area
    simG.append('line')
      .attr('class', 'true-effect-line')
      .attr('x1', xScale(trueEffect)).attr('x2', xScale(trueEffect))
      .attr('y1', 0).attr('y2', simH);

    // CI lines
    simData.forEach(d => {
      const cy = ySimScale(d.i) + ySimScale.bandwidth() / 2;
      simG.append('line')
        .attr('class', `ci-line-sim ${d.contains ? 'contains' : 'misses'}`)
        .attr('x1', xScale(Math.max(xMin, d.lo)))
        .attr('x2', xScale(Math.min(xMax, d.hi)))
        .attr('y1', cy).attr('y2', cy);

      // Center dot
      simG.append('circle')
        .attr('class', `ci-endpoint-dot ${d.contains ? 'contains' : 'misses'}`)
        .attr('cx', xScale(d.sampledARR))
        .attr('cy', cy)
        .attr('r', 2.5)
        .on('mouseenter', (event) => {
          showTooltip(event,
            `Trial ${d.i + 1}<br/>ARR = ${fmtPct(d.sampledARR, 2)}` +
            `<br/>CI: [${fmtPct(d.lo, 2)}, ${fmtPct(d.hi, 2)}]` +
            `<br/>${d.contains ? 'Contains true effect' : 'MISSES true effect'}`);
        })
        .on('mouseleave', hideTooltip);
    });

    // Count
    const nContains = simData.filter(d => d.contains).length;
    simG.append('text')
      .attr('class', 'axis-label')
      .attr('x', iw)
      .attr('y', simH + 12)
      .attr('text-anchor', 'end')
      .style('font-size', '10px')
      .text(`${nContains}/${numSim} contain true effect (${(nContains/numSim*100).toFixed(0)}%)`);
  }

  // X axis
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${bellH})`)
    .call(d3.axisBottom(xScale).ticks(6).tickFormat(d => fmtPct(d, 1)));
}

/* ============================================================
   STATS GRID UPDATE
   ============================================================ */
function updateStatsGrid(stats) {
  const conf = state.confLevel;

  d3.select('#stat-arr').text(
    `${fmtPct(stats.arr, 2)} [${fmtPct(stats.arr_lo, 2)}, ${fmtPct(stats.arr_hi, 2)}]`
  );
  d3.select('#stat-rrr').text(
    `${fmtPct(stats.rrr, 1)} [${fmtPct(stats.rrr_lo, 1)}, ${fmtPct(stats.rrr_hi, 1)}]`
  );
  d3.select('#stat-nnt').text(
    `${fmtNum(stats.nnt, 1)} [${fmtNum(stats.nnt_lo, 1)}, ${fmtNum(stats.nnt_hi, 1)}]`
  );
  d3.select('#stat-or').text(
    `${fmtNum(stats.or, 3)} [${fmtNum(stats.or_lo, 3)}, ${fmtNum(stats.or_hi, 3)}]`
  );
  d3.select('#stat-rr').text(
    `${fmtNum(stats.rr, 3)} [${fmtNum(stats.rr_lo, 3)}, ${fmtNum(stats.rr_hi, 3)}]`
  );
  d3.select('#stat-pval').text(fmtPval(stats.pValue));
}

/* ============================================================
   KATEX FORMULAS
   ============================================================ */
function renderFormulas() {
  const arrEl = document.getElementById('formula-arr');
  if (arrEl) {
    katex.render(
      String.raw`\text{ARR} = \text{CER} - \text{EER}, \quad \text{RRR} = \frac{\text{ARR}}{\text{CER}}, \quad \text{NNT} = \frac{1}{\text{ARR}}`,
      arrEl,
      { displayMode: true, throwOnError: false }
    );
  }

  const nntEl = document.getElementById('formula-nnt');
  if (nntEl) {
    katex.render(
      String.raw`\text{NNT} = \frac{1}{\text{CER} - \text{EER}} = \frac{1}{\text{ARR}}`,
      nntEl,
      { displayMode: true, throwOnError: false }
    );
  }
}

/* ============================================================
   BUILD ALL
   ============================================================ */
function buildAll() {
  const stats = computeStats(state.cer, state.eer, state.n, state.confLevel);
  drawEffectChart(stats);
  drawRiskChart(stats);
  drawCIChart(stats);
  updateStatsGrid(stats);
}

/* ============================================================
   WIRE CONTROLS
   ============================================================ */
function wireControls() {
  // Scenario dropdown
  d3.select('#scenario-select').on('change', function () {
    state.scenario = this.value;
    const sc = SCENARIOS[this.value];
    state.cer = sc.cer;
    state.eer = sc.eer;
    state.n = sc.n;

    // Update sliders
    d3.select('#cer-slider').property('value', sc.cer);
    d3.select('#eer-slider').property('value', sc.eer);
    d3.select('#n-slider').property('value', sc.n);
    d3.select('#cer-val').text(sc.cer + '%');
    d3.select('#eer-val').text(sc.eer + '%');
    d3.select('#n-val').text(sc.n);

    state.seed = Math.floor(Math.random() * 100000);
    buildAll();
  });

  // CER slider
  d3.select('#cer-slider').on('input', function () {
    state.cer = +this.value;
    d3.select('#cer-val').text(this.value + '%');
    d3.select('#scenario-select').property('value', 'custom');
    state.scenario = 'custom';
    buildAll();
  });

  // EER slider
  d3.select('#eer-slider').on('input', function () {
    state.eer = +this.value;
    d3.select('#eer-val').text(this.value + '%');
    d3.select('#scenario-select').property('value', 'custom');
    state.scenario = 'custom';
    buildAll();
  });

  // Sample size slider
  d3.select('#n-slider').on('input', function () {
    state.n = +this.value;
    d3.select('#n-val').text(this.value);
    buildAll();
  });

  // Confidence level slider
  d3.select('#conf-slider').on('input', function () {
    state.confLevel = +this.value;
    d3.select('#conf-val').text(this.value + '%');
    buildAll();
  });

  // Toggle: Show NNT
  d3.select('#toggle-nnt').on('change', function () {
    state.showNNT = this.checked;
    buildAll();
  });

  // Toggle: Show CI simulation
  d3.select('#toggle-ci-sim').on('change', function () {
    state.showCISim = this.checked;
    buildAll();
  });

  // Toggle: Log scale for NNT
  d3.select('#toggle-log-nnt').on('change', function () {
    state.logNNT = this.checked;
    buildAll();
  });

  // Resample button
  d3.select('#resample-btn').on('click', function () {
    state.seed = Math.floor(Math.random() * 100000);
    buildAll();
  });
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  wireControls();
  renderFormulas();
  buildAll();
}

init();
