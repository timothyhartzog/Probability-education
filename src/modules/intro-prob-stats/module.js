/**
 * Applied Probability & Statistical Inference — Interactive Module
 * ES module; imports D3 and platform libs.
 */

import * as d3 from 'd3';
import '../../lib/param-tooltips.js';
import '../../lib/copy-code.js';

/* ============================================================
   MATH UTILITIES — t-distribution, distributions
   ============================================================ */

function logGamma(x) {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function tPDF(t, df) {
  const logCoeff =
    logGamma((df + 1) / 2) -
    0.5 * Math.log(df * Math.PI) -
    logGamma(df / 2);
  return Math.exp(logCoeff - ((df + 1) / 2) * Math.log(1 + (t * t) / df));
}

function betaCF(x, a, b) {
  const MAXIT = 200, EPS = 3e-7;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function incompleteBeta(x, a, b) {
  if (x < 0 || x > 1) return NaN;
  if (x === 0) return 0;
  if (x === 1) return 1;
  const lbeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a;
  // Use symmetry relation for numerical stability
  if (x < (a + 1) / (a + b + 2)) {
    return front * betaCF(x, a, b);
  } else {
    const lbeta2 = logGamma(b) + logGamma(a) - logGamma(a + b);
    const front2 = Math.exp(Math.log(1 - x) * b + Math.log(x) * a - lbeta2) / b;
    return 1 - front2 * betaCF(1 - x, b, a);
  }
}

function tCDF(t, df) {
  const x = df / (df + t * t);
  const p = 0.5 * incompleteBeta(x, df / 2, 0.5);
  return t >= 0 ? 1 - p : p;
}

function tPValue2(t, df) {
  return 2 * (1 - tCDF(Math.abs(t), df));
}

function tInverse(p, df) {
  // Bisection: find t > 0 s.t. P(T <= t) = p  (p > 0.5)
  let lo = 0, hi = 100;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (tCDF(mid, df) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// Normal distribution helpers
const SQRT2PI = Math.sqrt(2 * Math.PI);

function normalPDF(x, mu, sigma) {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * SQRT2PI);
}

function normalCDF(x, mu = 0, sigma = 1) {
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)));
}

function erf(x) {
  // Approximation accurate to ~1e-7
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const poly =
    t * (0.254829592 +
      t * (-0.284496736 +
        t * (1.421413741 +
          t * (-1.453152027 + t * 1.061405429))));
  const result = 1 - poly * Math.exp(-x * x);
  return x >= 0 ? result : -result;
}

function factorialLog(n) {
  return logGamma(n + 1);
}

function poissonPMF(k, lambda) {
  return Math.exp(k * Math.log(lambda) - lambda - factorialLog(k));
}

function binomialPMF(k, n, p) {
  if (p <= 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;
  const logC = factorialLog(n) - factorialLog(k) - factorialLog(n - k);
  return Math.exp(logC + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

/* ============================================================
   TAB SWITCHING
   ============================================================ */

function initTabs() {
  const btns = document.querySelectorAll('.tab-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(tc => {
        tc.classList.toggle('active', tc.id === `tab-${tabId}`);
      });
      // Trigger lazy renders
      if (tabId === 'rvexpect') renderRV();
      if (tabId === 'limits') renderCLT();
      if (tabId === 'inference') renderInference();
      if (tabId === 'ttest') renderTTest();
    });
  });
}

/* ============================================================
   KATEX EQUATIONS
   ============================================================ */

function renderEquations() {
  const render = (id, tex, display = true) => {
    const el = document.getElementById(id);
    if (!el) return;
    try {
      katex.render(tex, el, { displayMode: display, throwOnError: false });
    } catch (e) { /* ignore */ }
  };

  // Tab 1
  render('eq-axioms',
    '\\text{(1) } P(A) \\geq 0 \\quad \\text{(2) } P(\\Omega) = 1 \\quad \\text{(3) } P\\!\\left(\\bigcup_{i=1}^{\\infty} A_i\\right) = \\sum_{i=1}^{\\infty} P(A_i)');
  render('eq-cond',
    'P(A \\mid B) = \\frac{P(A \\cap B)}{P(B)}, \\quad P(B) > 0');
  render('eq-bayes',
    'P(A \\mid B) = \\frac{P(B \\mid A)\\, P(A)}{P(B)} = \\frac{P(B \\mid A)\\, P(A)}{P(B \\mid A)P(A) + P(B \\mid A^c)P(A^c)}');

  // Tab 2
  render('eq-ev',
    'E[X] = \\sum_k k\\, p(k) \\quad \\text{or} \\quad E[X] = \\int_{-\\infty}^{\\infty} x\\, f(x)\\, dx');
  render('eq-var',
    '\\operatorname{Var}(X) = E\\!\\left[(X - E[X])^2\\right] = E[X^2] - (E[X])^2');

  // Tab 3
  render('eq-normal-pdf',
    'f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} \\exp\\!\\left(-\\frac{(x-\\mu)^2}{2\\sigma^2}\\right)');
  render('eq-clt',
    'Z_n = \\frac{S_n - n\\mu}{\\sigma\\sqrt{n}} \\xrightarrow{\\,d\\,} N(0,1) \\quad \\text{as } n \\to \\infty');
  render('eq-be',
    '\\sup_x \\left| F_{Z_n}(x) - \\Phi(x) \\right| \\leq \\frac{C\\, \\rho}{\\sqrt{n}}, \\quad \\rho = \\frac{E[|X-\\mu|^3]}{\\sigma^3}');

  // Tab 4 (no explicit equations, just text)
}

/* ============================================================
   TAB 1 — AXIOMATIC FOUNDATIONS
   ============================================================ */

function getVennState() {
  return {
    pA: +document.getElementById('venn-pa').value,
    pB: +document.getElementById('venn-pb').value,
    pAB: +document.getElementById('venn-pab').value,
    view: document.getElementById('venn-view').value,
  };
}

function getBayesState() {
  return {
    prior: +document.getElementById('bayes-prior').value,
    sens: +document.getElementById('bayes-sens').value,
    spec: +document.getElementById('bayes-spec').value,
  };
}

function initVenn() {
  const container = document.getElementById('venn-chart');

  const updateOutputs = () => {
    const { pA, pB, pAB } = getVennState();
    document.getElementById('venn-pa-val').value = pA.toFixed(2);
    document.getElementById('venn-pb-val').value = pB.toFixed(2);
    // Clamp pAB to valid range
    const maxPAB = Math.min(pA, pB);
    const pabSlider = document.getElementById('venn-pab');
    pabSlider.max = maxPAB.toFixed(2);
    if (+pabSlider.value > maxPAB) pabSlider.value = maxPAB.toFixed(2);
    document.getElementById('venn-pab-val').value = (+pabSlider.value).toFixed(2);
    renderVenn();
    renderBayes();
  };

  ['venn-pa', 'venn-pb', 'venn-pab', 'venn-view'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateOutputs);
  });

  renderVenn();
}

function renderVenn() {
  const { pA, pB, pAB, view } = getVennState();
  const pAB_clamped = Math.min(pAB, Math.min(pA, pB));

  const container = document.getElementById('venn-chart');
  container.innerHTML = '';

  const W = container.clientWidth || 600;
  const H = 320;
  const margin = { top: 30, right: 20, bottom: 40, left: 20 };
  const iW = W - margin.left - margin.right;
  const iH = H - margin.top - margin.bottom;

  const svg = d3.select(container).append('svg')
    .attr('width', W).attr('height', H)
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Background sample space Ω
  g.append('rect')
    .attr('x', 0).attr('y', 0).attr('width', iW).attr('height', iH)
    .attr('fill', '#f8fafc').attr('stroke', '#94a3b8').attr('stroke-width', 2)
    .attr('rx', 8);

  g.append('text')
    .attr('x', 8).attr('y', 18)
    .text('Ω').attr('font-family', 'serif').attr('font-size', 16)
    .attr('fill', '#64748b');

  // Compute circle radii proportional to probabilities
  const maxR = Math.min(iW, iH) * 0.35;
  const rA = maxR * Math.sqrt(pA);
  const rB = maxR * Math.sqrt(pB);

  // Position circles: overlap determined by P(A∩B)
  // d = distance between centers
  // The intersection area formula: A_int = r²cos⁻¹((d²+r²−R²)/(2dr)) + R²cos⁻¹((d²+R²−r²)/(2dR)) − ½√(...)
  // We'll use a simplified layout: adjust center distance to visually represent overlap

  const centerY = iH / 2;
  const overlapFrac = pAB_clamped / Math.min(pA, pB); // 0=no overlap, 1=full overlap
  const separation = (1 - overlapFrac) * (rA + rB) * 0.9 + overlapFrac * Math.abs(rA - rB) * 0.5;
  const cxA = iW / 2 - separation / 2 - 10;
  const cxB = iW / 2 + separation / 2 + 10;

  // Define clip paths for shading
  const defs = svg.append('defs');

  // Clip for A only (A minus B)
  defs.append('clipPath').attr('id', 'clip-a-only')
    .append('circle').attr('cx', margin.left + cxA).attr('cy', margin.top + centerY)
    .attr('r', rA);

  defs.append('clipPath').attr('id', 'clip-b-only')
    .append('circle').attr('cx', margin.left + cxB).attr('cy', margin.top + centerY)
    .attr('r', rB);

  const BLUE = '#2563eb';
  const ORANGE = '#e97319';
  const GREEN = '#059669';
  const ALPHA = 0.25;

  // Shading based on view
  if (view === 'union') {
    // Shade A
    g.append('circle')
      .attr('cx', cxA).attr('cy', centerY).attr('r', rA)
      .attr('fill', BLUE).attr('fill-opacity', ALPHA).attr('stroke', 'none');
    // Shade B
    g.append('circle')
      .attr('cx', cxB).attr('cy', centerY).attr('r', rB)
      .attr('fill', ORANGE).attr('fill-opacity', ALPHA).attr('stroke', 'none');

    const pUnion = pA + pB - pAB_clamped;
    g.append('text')
      .attr('x', iW / 2).attr('y', iH - 8)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'var(--font-heading)').attr('font-size', 13)
      .attr('fill', '#1e40af')
      .text(`P(A ∪ B) = P(A) + P(B) − P(A ∩ B) = ${pUnion.toFixed(3)}`);

  } else if (view === 'intersection') {
    // Shade intersection: draw B clipped to A
    g.append('circle')
      .attr('cx', cxB).attr('cy', centerY).attr('r', rB)
      .attr('clip-path', 'url(#clip-a-only)')
      .attr('fill', GREEN).attr('fill-opacity', 0.5).attr('stroke', 'none');

    g.append('text')
      .attr('x', iW / 2).attr('y', iH - 8)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'var(--font-heading)').attr('font-size', 13)
      .attr('fill', '#065f46')
      .text(`P(A ∩ B) = ${pAB_clamped.toFixed(3)}`);

  } else {
    // conditional: shade A given B — highlight A ∩ B relative to B
    g.append('circle')
      .attr('cx', cxB).attr('cy', centerY).attr('r', rB)
      .attr('fill', ORANGE).attr('fill-opacity', 0.15).attr('stroke', 'none');

    g.append('circle')
      .attr('cx', cxB).attr('cy', centerY).attr('r', rB)
      .attr('clip-path', 'url(#clip-a-only)')
      .attr('fill', BLUE).attr('fill-opacity', 0.55).attr('stroke', 'none');

    const pAgivenB = pB > 0 ? pAB_clamped / pB : 0;
    g.append('text')
      .attr('x', iW / 2).attr('y', iH - 8)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'var(--font-heading)').attr('font-size', 13)
      .attr('fill', '#1e40af')
      .text(`P(A | B) = P(A ∩ B) / P(B) = ${pAgivenB.toFixed(3)}`);
  }

  // Draw circles
  g.append('circle')
    .attr('cx', cxA).attr('cy', centerY).attr('r', rA)
    .attr('fill', 'none').attr('stroke', BLUE).attr('stroke-width', 2.5);

  g.append('circle')
    .attr('cx', cxB).attr('cy', centerY).attr('r', rB)
    .attr('fill', 'none').attr('stroke', ORANGE).attr('stroke-width', 2.5);

  // Labels
  g.append('text')
    .attr('x', cxA - rA * 0.5).attr('y', centerY - rA * 0.6)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'var(--font-heading)').attr('font-size', 14).attr('font-weight', 600)
    .attr('fill', BLUE).text('A');

  g.append('text')
    .attr('x', cxB + rB * 0.5).attr('y', centerY - rB * 0.6)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'var(--font-heading)').attr('font-size', 14).attr('font-weight', 600)
    .attr('fill', ORANGE).text('B');

  g.append('text')
    .attr('x', cxA - 4).attr('y', centerY + 5)
    .attr('text-anchor', 'end')
    .attr('font-family', 'var(--font-mono)').attr('font-size', 11).attr('fill', BLUE)
    .text(pA.toFixed(2));

  g.append('text')
    .attr('x', cxB + 4).attr('y', centerY + 5)
    .attr('text-anchor', 'start')
    .attr('font-family', 'var(--font-mono)').attr('font-size', 11).attr('fill', ORANGE)
    .text(pB.toFixed(2));

  // Legend
  const legend = g.append('g').attr('transform', `translate(${iW - 200}, 10)`);
  const legendData = [
    { label: `P(A) = ${pA.toFixed(2)}`, color: BLUE },
    { label: `P(B) = ${pB.toFixed(2)}`, color: ORANGE },
    { label: `P(A ∩ B) = ${pAB_clamped.toFixed(2)}`, color: GREEN },
  ];
  legendData.forEach((d, i) => {
    legend.append('rect').attr('x', 0).attr('y', i * 18)
      .attr('width', 10).attr('height', 10).attr('fill', d.color).attr('rx', 2);
    legend.append('text').attr('x', 14).attr('y', i * 18 + 9)
      .attr('font-family', 'var(--font-heading)').attr('font-size', 11).attr('fill', '#334155')
      .text(d.label);
  });
}

function renderBayes() {
  const { prior, sens, spec } = getBayesState();
  document.getElementById('bayes-prior-val').value = prior.toFixed(3);
  document.getElementById('bayes-sens-val').value = sens.toFixed(2);
  document.getElementById('bayes-spec-val').value = spec.toFixed(2);

  const fp_rate = 1 - spec;
  const pPos = sens * prior + fp_rate * (1 - prior);
  const posterior = pPos > 0 ? (sens * prior) / pPos : 0;

  const container = document.getElementById('bayes-chart');
  container.innerHTML = '';

  const bars = [
    { label: 'P(disease) — Prior', value: prior, color: '#2563eb' },
    { label: 'P(+ | disease) — Sensitivity', value: sens, color: '#059669' },
    { label: 'P(+ | no disease) — FP rate', value: fp_rate, color: '#e97319' },
    { label: 'P(disease | +) — Posterior PPV', value: posterior, color: '#7c3aed' },
  ];

  const div = document.createElement('div');
  div.style.padding = '8px 12px';

  bars.forEach(b => {
    const row = document.createElement('div');
    row.className = 'bayes-bar-row';
    row.innerHTML = `
      <div class="bayes-bar-label">${b.label}</div>
      <div class="bayes-bar-track">
        <div class="bayes-bar-fill" style="width:${(b.value * 100).toFixed(1)}%;background:${b.color};"></div>
      </div>
      <div class="bayes-bar-val">${b.value.toFixed(4)}</div>
    `;
    div.appendChild(row);
  });

  // Annotation
  const note = document.createElement('div');
  note.style.cssText = 'margin-top:8px;font-family:var(--font-heading);font-size:0.8rem;color:#555;padding:6px 10px;background:#f8fafc;border-radius:4px;border:1px solid #e2e8f0;';
  note.innerHTML = `With prevalence ${(prior * 100).toFixed(1)}% and sensitivity ${(sens * 100).toFixed(0)}% / specificity ${(spec * 100).toFixed(0)}%, a positive test has only <strong>${(posterior * 100).toFixed(1)}%</strong> chance of truly indicating disease.`;
  div.appendChild(note);

  container.appendChild(div);
}

function initAxioms() {
  initVenn();
  renderBayes();
  ['bayes-prior', 'bayes-sens', 'bayes-spec'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderBayes);
  });
}

/* ============================================================
   TAB 2 — RANDOM VARIABLES & EXPECTATION
   ============================================================ */

const RV_CONFIGS = {
  normal: {
    p1: { label: 'μ (mean)', min: -5, max: 5, value: 0, step: 0.1 },
    p2: { label: 'σ (std dev)', min: 0.1, max: 5, value: 1, step: 0.1 },
    continuous: true,
  },
  exponential: {
    p1: { label: 'λ (rate)', min: 0.1, max: 5, value: 1, step: 0.1 },
    p2: null,
    continuous: true,
  },
  poisson: {
    p1: { label: 'λ (mean rate)', min: 0.5, max: 20, value: 3, step: 0.5 },
    p2: null,
    continuous: false,
  },
  binomial: {
    p1: { label: 'n (trials)', min: 1, max: 50, value: 20, step: 1 },
    p2: { label: 'p (success prob)', min: 0.01, max: 0.99, value: 0.5, step: 0.01 },
    continuous: false,
  },
  uniform: {
    p1: { label: 'a (lower)', min: -10, max: 9, value: 0, step: 0.1 },
    p2: { label: 'b (upper)', min: -9, max: 10, value: 1, step: 0.1 },
    continuous: true,
  },
};

function getRVState() {
  const dist = document.getElementById('rv-dist').value;
  const cfg = RV_CONFIGS[dist];
  const p1 = +document.getElementById('rv-p1').value;
  const p2 = cfg.p2 ? +document.getElementById('rv-p2').value : null;
  return { dist, p1, p2, cfg };
}

function rvStats(dist, p1, p2) {
  switch (dist) {
    case 'normal': return { mean: p1, variance: p2 * p2 };
    case 'exponential': return { mean: 1 / p1, variance: 1 / (p1 * p1) };
    case 'poisson': return { mean: p1, variance: p1 };
    case 'binomial': return { mean: p1 * p2, variance: p1 * p2 * (1 - p2) };
    case 'uniform': return { mean: (p1 + p2) / 2, variance: Math.pow(p2 - p1, 2) / 12 };
    default: return { mean: 0, variance: 1 };
  }
}

function updateRVControls() {
  const dist = document.getElementById('rv-dist').value;
  const cfg = RV_CONFIGS[dist];
  const p1Group = document.getElementById('rv-p1-group');
  const p2Group = document.getElementById('rv-p2-group');
  const p1Slider = document.getElementById('rv-p1');
  const p2Slider = document.getElementById('rv-p2');

  document.getElementById('rv-p1-label').textContent = cfg.p1.label;
  p1Slider.min = cfg.p1.min;
  p1Slider.max = cfg.p1.max;
  p1Slider.step = cfg.p1.step;
  p1Slider.value = cfg.p1.value;
  document.getElementById('rv-p1-val').value = cfg.p1.value;

  if (cfg.p2) {
    p2Group.style.display = '';
    document.getElementById('rv-p2-label').textContent = cfg.p2.label;
    p2Slider.min = cfg.p2.min;
    p2Slider.max = cfg.p2.max;
    p2Slider.step = cfg.p2.step;
    p2Slider.value = cfg.p2.value;
    document.getElementById('rv-p2-val').value = cfg.p2.value;
  } else {
    p2Group.style.display = 'none';
  }
}

function renderRV() {
  const { dist, p1, p2, cfg } = getRVState();
  document.getElementById('rv-p1-val').value = parseFloat(p1).toFixed(cfg.p1.step < 0.1 ? 2 : 1);
  if (cfg.p2) document.getElementById('rv-p2-val').value = parseFloat(p2).toFixed(cfg.p2.step < 0.1 ? 2 : 1);

  const stats = rvStats(dist, p1, p2);
  document.getElementById('rv-ex').textContent = stats.mean.toFixed(3);
  document.getElementById('rv-var').textContent = stats.variance.toFixed(3);
  document.getElementById('rv-sd').textContent = Math.sqrt(stats.variance).toFixed(3);

  const showCDF = document.getElementById('rv-show-cdf').checked;
  document.getElementById('rv-cdf-card').style.display = showCDF ? '' : 'none';

  renderRVPDF(dist, p1, p2, cfg, stats);
  if (showCDF) renderRVCDF(dist, p1, p2, cfg);
}

function rvDomain(dist, p1, p2) {
  switch (dist) {
    case 'normal': return [p1 - 4 * p2, p1 + 4 * p2];
    case 'exponential': return [0, 5 / p1];
    case 'poisson': return [0, Math.max(20, p1 + 4 * Math.sqrt(p1))];
    case 'binomial': return [0, p1];
    case 'uniform': return [p1 - (p2 - p1) * 0.2, p2 + (p2 - p1) * 0.2];
    default: return [-5, 5];
  }
}

function rvPDFValue(dist, x, p1, p2) {
  switch (dist) {
    case 'normal': return normalPDF(x, p1, p2);
    case 'exponential': return x >= 0 ? p1 * Math.exp(-p1 * x) : 0;
    case 'poisson': return x >= 0 && Number.isInteger(x) ? poissonPMF(x, p1) : 0;
    case 'binomial': return x >= 0 && x <= p1 && Number.isInteger(x) ? binomialPMF(x, p1, p2) : 0;
    case 'uniform': return (x >= p1 && x <= p2) ? 1 / (p2 - p1) : 0;
    default: return 0;
  }
}

function rvCDFValue(dist, x, p1, p2) {
  switch (dist) {
    case 'normal': return normalCDF(x, p1, p2);
    case 'exponential': return x >= 0 ? 1 - Math.exp(-p1 * x) : 0;
    case 'poisson': {
      let cdf = 0;
      for (let k = 0; k <= Math.floor(x); k++) cdf += poissonPMF(k, p1);
      return cdf;
    }
    case 'binomial': {
      let cdf = 0;
      for (let k = 0; k <= Math.floor(x); k++) cdf += binomialPMF(k, p1, p2);
      return Math.min(cdf, 1);
    }
    case 'uniform': {
      if (x <= p1) return 0;
      if (x >= p2) return 1;
      return (x - p1) / (p2 - p1);
    }
    default: return 0;
  }
}

function renderRVPDF(dist, p1, p2, cfg, stats) {
  const container = document.getElementById('rv-pdf-chart');
  container.innerHTML = '';

  const W = container.clientWidth || 600;
  const H = 320;
  const margin = { top: 20, right: 20, bottom: 45, left: 55 };
  const iW = W - margin.left - margin.right;
  const iH = H - margin.top - margin.bottom;

  const svg = d3.select(container).append('svg')
    .attr('width', W).attr('height', H)
    .attr('viewBox', `0 0 ${W} ${H}`);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const [xMin, xMax] = rvDomain(dist, p1, p2 ?? 0);

  const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, iW]);

  if (cfg.continuous) {
    const N = 500;
    const pts = d3.range(N + 1).map(i => {
      const x = xMin + (i / N) * (xMax - xMin);
      return { x, y: rvPDFValue(dist, x, p1, p2) };
    });

    const yMax = d3.max(pts, d => d.y) * 1.1;
    const yScale = d3.scaleLinear().domain([0, yMax]).range([iH, 0]);

    // Grid
    g.append('g').attr('class', 'grid')
      .call(d3.axisLeft(yScale).ticks(5).tickSize(-iW).tickFormat(''));

    // Area fill
    const area = d3.area().x(d => xScale(d.x)).y0(iH).y1(d => yScale(d.y)).curve(d3.curveBasis);
    g.append('path').datum(pts).attr('d', area)
      .attr('fill', '#2563eb').attr('fill-opacity', 0.12);

    // Line
    const line = d3.line().x(d => xScale(d.x)).y(d => yScale(d.y)).curve(d3.curveBasis);
    g.append('path').datum(pts).attr('d', line)
      .attr('fill', 'none').attr('stroke', '#2563eb').attr('stroke-width', 2.5);

    // E[X] vertical line
    if (stats.mean >= xMin && stats.mean <= xMax) {
      g.append('line')
        .attr('x1', xScale(stats.mean)).attr('x2', xScale(stats.mean))
        .attr('y1', 0).attr('y2', iH)
        .attr('stroke', '#e97319').attr('stroke-width', 2).attr('stroke-dasharray', '5,3');
      g.append('text')
        .attr('x', xScale(stats.mean) + 4).attr('y', 14)
        .attr('font-family', 'var(--font-heading)').attr('font-size', 11).attr('fill', '#e97319')
        .text(`E[X]=${stats.mean.toFixed(2)}`);
    }

    g.append('g').attr('class', 'axis').attr('transform', `translate(0,${iH})`).call(d3.axisBottom(xScale).ticks(6));
    g.append('g').attr('class', 'axis').call(d3.axisLeft(yScale).ticks(5));
    g.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle')
      .attr('x', iW / 2).attr('y', iH + 38).text('x');
    g.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle')
      .attr('transform', `rotate(-90)`).attr('x', -iH / 2).attr('y', -42).text('f(x)');

  } else {
    // Discrete: vertical bars
    const kMax = Math.floor(xMax);
    const kMin = Math.max(0, Math.floor(xMin));
    const ks = d3.range(kMin, kMax + 1);
    const probs = ks.map(k => ({ k, p: rvPDFValue(dist, k, p1, p2) }));
    const yMax = d3.max(probs, d => d.p) * 1.15;
    const yScale = d3.scaleLinear().domain([0, yMax]).range([iH, 0]);

    g.append('g').attr('class', 'grid')
      .call(d3.axisLeft(yScale).ticks(5).tickSize(-iW).tickFormat(''));

    const barW = Math.max(2, Math.min(30, iW / probs.length * 0.6));

    g.selectAll('.disc-bar').data(probs).enter().append('rect')
      .attr('class', 'disc-bar')
      .attr('x', d => xScale(d.k) - barW / 2)
      .attr('y', d => yScale(d.p))
      .attr('width', barW)
      .attr('height', d => iH - yScale(d.p))
      .attr('fill', '#2563eb').attr('fill-opacity', 0.75)
      .attr('rx', 2);

    // E[X] line
    if (stats.mean >= xMin && stats.mean <= xMax) {
      g.append('line')
        .attr('x1', xScale(stats.mean)).attr('x2', xScale(stats.mean))
        .attr('y1', 0).attr('y2', iH)
        .attr('stroke', '#e97319').attr('stroke-width', 2).attr('stroke-dasharray', '5,3');
      g.append('text')
        .attr('x', xScale(stats.mean) + 4).attr('y', 14)
        .attr('font-family', 'var(--font-heading)').attr('font-size', 11).attr('fill', '#e97319')
        .text(`E[X]=${stats.mean.toFixed(2)}`);
    }

    const xTicks = ks.length > 20 ? ks.filter((_, i) => i % Math.ceil(ks.length / 15) === 0) : ks;
    g.append('g').attr('class', 'axis').attr('transform', `translate(0,${iH})`)
      .call(d3.axisBottom(xScale).tickValues(xTicks));
    g.append('g').attr('class', 'axis').call(d3.axisLeft(yScale).ticks(5));
    g.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle')
      .attr('x', iW / 2).attr('y', iH + 38).text('k');
    g.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle')
      .attr('transform', `rotate(-90)`).attr('x', -iH / 2).attr('y', -42).text('P(X = k)');
  }
}

function renderRVCDF(dist, p1, p2, cfg) {
  const container = document.getElementById('rv-cdf-chart');
  container.innerHTML = '';

  const W = container.clientWidth || 600;
  const H = 240;
  const margin = { top: 15, right: 20, bottom: 40, left: 55 };
  const iW = W - margin.left - margin.right;
  const iH = H - margin.top - margin.bottom;
  const [xMin, xMax] = rvDomain(dist, p1, p2 ?? 0);

  const svg = d3.select(container).append('svg')
    .attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, iW]);
  const yScale = d3.scaleLinear().domain([0, 1]).range([iH, 0]);

  g.append('g').attr('class', 'grid')
    .call(d3.axisLeft(yScale).ticks(5).tickSize(-iW).tickFormat(''));

  if (cfg.continuous) {
    const N = 400;
    const pts = d3.range(N + 1).map(i => {
      const x = xMin + (i / N) * (xMax - xMin);
      return { x, y: rvCDFValue(dist, x, p1, p2) };
    });
    const line = d3.line().x(d => xScale(d.x)).y(d => yScale(d.y)).curve(d3.curveBasis);
    g.append('path').datum(pts).attr('d', line)
      .attr('fill', 'none').attr('stroke', '#059669').attr('stroke-width', 2.5);
  } else {
    const kMax = Math.floor(xMax);
    const kMin = Math.max(0, Math.floor(xMin));
    const ks = d3.range(kMin, kMax + 1);
    let cumProb = 0;
    ks.forEach((k, i) => {
      const prevProb = cumProb;
      cumProb += rvPDFValue(dist, k, p1, p2);
      const x0 = i === 0 ? xMin : ks[i - 1];
      g.append('line')
        .attr('x1', xScale(x0)).attr('x2', xScale(k))
        .attr('y1', yScale(prevProb)).attr('y2', yScale(prevProb))
        .attr('stroke', '#059669').attr('stroke-width', 2.5);
      g.append('circle').attr('cx', xScale(k)).attr('cy', yScale(cumProb))
        .attr('r', 3.5).attr('fill', '#059669');
      // Open circle at left
      g.append('circle').attr('cx', xScale(k)).attr('cy', yScale(prevProb))
        .attr('r', 3.5).attr('fill', 'white').attr('stroke', '#059669').attr('stroke-width', 1.5);
    });
    // Last segment
    g.append('line')
      .attr('x1', xScale(ks[ks.length - 1])).attr('x2', xScale(xMax))
      .attr('y1', yScale(1)).attr('y2', yScale(1))
      .attr('stroke', '#059669').attr('stroke-width', 2.5);
  }

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${iH})`).call(d3.axisBottom(xScale).ticks(6));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(yScale).ticks(5));
  g.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle')
    .attr('x', iW / 2).attr('y', iH + 35).text('x');
  g.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle')
    .attr('transform', `rotate(-90)`).attr('x', -iH / 2).attr('y', -42).text('F(x)');
}

function initRV() {
  updateRVControls();

  document.getElementById('rv-dist').addEventListener('change', () => {
    updateRVControls();
    renderRV();
  });
  ['rv-p1', 'rv-p2'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderRV);
  });
  document.getElementById('rv-show-cdf').addEventListener('change', renderRV);
}

/* ============================================================
   TAB 3 — LIMIT THEOREMS (CLT)
   ============================================================ */

function cltDistParams(dist) {
  switch (dist) {
    case 'uniform':     return { mu: 0.5, sigma: Math.sqrt(1 / 12) };
    case 'exponential': return { mu: 1, sigma: 1 };
    case 'bernoulli':   return { mu: 0.3, sigma: Math.sqrt(0.3 * 0.7) };
    case 'poisson':     return { mu: 2, sigma: Math.sqrt(2) };
    default:            return { mu: 0.5, sigma: Math.sqrt(1 / 12) };
  }
}

function sampleCLTDist(dist) {
  const u = Math.random();
  switch (dist) {
    case 'uniform':     return u;
    case 'exponential': return -Math.log(1 - u);
    case 'bernoulli':   return u < 0.3 ? 1 : 0;
    case 'poisson': {
      // Poisson(2) by inverse CDF
      let k = 0, p = Math.exp(-2), cdf = p;
      while (u > cdf) { k++; p *= 2 / k; cdf += p; }
      return k;
    }
    default: return u;
  }
}

let cltAnimId = null;

function generateCLTData(dist, n, nSims) {
  const { mu, sigma } = cltDistParams(dist);
  const data = new Float64Array(nSims);
  for (let s = 0; s < nSims; s++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += sampleCLTDist(dist);
    data[s] = (sum - n * mu) / (sigma * Math.sqrt(n));
  }
  return data;
}

function renderCLT() {
  const dist = document.getElementById('clt-dist').value;
  const n = +document.getElementById('clt-n').value;
  const nSims = +document.getElementById('clt-sims').value;

  document.getElementById('clt-n-val').value = n;
  document.getElementById('clt-sims-val').value = nSims;

  const data = generateCLTData(dist, n, nSims);

  const empMean = d3.mean(data);
  const empSD = d3.deviation(data);
  document.getElementById('clt-emp-mean').textContent = empMean.toFixed(3);
  document.getElementById('clt-emp-sd').textContent = empSD.toFixed(3);

  const container = document.getElementById('clt-chart');
  container.innerHTML = '';

  const W = container.clientWidth || 650;
  const H = 340;
  const margin = { top: 20, right: 20, bottom: 45, left: 55 };
  const iW = W - margin.left - margin.right;
  const iH = H - margin.top - margin.bottom;

  const svg = d3.select(container).append('svg')
    .attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xExtent = [-4.5, 4.5];
  const xScale = d3.scaleLinear().domain(xExtent).range([0, iW]);

  const histogram = d3.bin()
    .domain(xExtent)
    .thresholds(d3.range(xExtent[0], xExtent[1] + 0.01, 0.25))(Array.from(data));

  const yMax = d3.max(histogram, d => d.length / (nSims * (d.x1 - d.x0)));
  const nPDF = normalPDF(0, 0, 1);
  const yDomain = Math.max(yMax, nPDF) * 1.15;
  const yScale = d3.scaleLinear().domain([0, yDomain]).range([iH, 0]);

  // Grid
  g.append('g').attr('class', 'grid')
    .call(d3.axisLeft(yScale).ticks(5).tickSize(-iW).tickFormat(''));

  // Histogram bars
  g.selectAll('.hist-bar').data(histogram).enter().append('rect')
    .attr('class', 'hist-bar')
    .attr('x', d => xScale(d.x0) + 1)
    .attr('y', d => yScale(d.length / (nSims * (d.x1 - d.x0))))
    .attr('width', d => Math.max(0, xScale(d.x1) - xScale(d.x0) - 2))
    .attr('height', d => iH - yScale(d.length / (nSims * (d.x1 - d.x0))))
    .attr('fill', '#2563eb').attr('fill-opacity', 0.55);

  // N(0,1) overlay
  const N = 300;
  const normalPts = d3.range(N + 1).map(i => {
    const x = xExtent[0] + (i / N) * (xExtent[1] - xExtent[0]);
    return { x, y: normalPDF(x, 0, 1) };
  });
  const normalLine = d3.line().x(d => xScale(d.x)).y(d => yScale(d.y)).curve(d3.curveBasis);
  g.append('path').datum(normalPts).attr('d', normalLine)
    .attr('fill', 'none').attr('stroke', '#e97319').attr('stroke-width', 2.5).attr('stroke-dasharray', '6,3');

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${iH})`).call(d3.axisBottom(xScale).ticks(8));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(yScale).ticks(5));
  g.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle')
    .attr('x', iW / 2).attr('y', iH + 38).text('Z_n = (S_n − nμ) / (σ√n)');
  g.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle')
    .attr('transform', `rotate(-90)`).attr('x', -iH / 2).attr('y', -42).text('Density');

  // Legend
  const leg = g.append('g').attr('transform', `translate(${iW - 160}, 5)`);
  leg.append('rect').attr('width', 10).attr('height', 10).attr('fill', '#2563eb').attr('fill-opacity', 0.55).attr('rx', 2);
  leg.append('text').attr('x', 14).attr('y', 9).attr('font-size', 11).attr('font-family', 'var(--font-heading)').attr('fill', '#334155').text('Empirical');
  leg.append('line').attr('x1', 0).attr('x2', 10).attr('y1', 22).attr('y2', 22).attr('stroke', '#e97319').attr('stroke-width', 2).attr('stroke-dasharray', '4,2');
  leg.append('text').attr('x', 14).attr('y', 26).attr('font-size', 11).attr('font-family', 'var(--font-heading)').attr('fill', '#334155').text('N(0,1) limit');

  // Title with n
  g.append('text').attr('x', iW / 2).attr('y', -6)
    .attr('text-anchor', 'middle').attr('font-family', 'var(--font-heading)').attr('font-size', 12).attr('fill', '#334155')
    .text(`n = ${n}  |  ${nSims.toLocaleString()} samples  |  dist: ${dist}`);
}

function initCLT() {
  document.getElementById('clt-dist').addEventListener('change', renderCLT);
  document.getElementById('clt-n').addEventListener('input', () => {
    document.getElementById('clt-n-val').value = document.getElementById('clt-n').value;
    renderCLT();
  });
  document.getElementById('clt-sims').addEventListener('input', () => {
    document.getElementById('clt-sims-val').value = document.getElementById('clt-sims').value;
    renderCLT();
  });
  document.getElementById('clt-resample').addEventListener('click', renderCLT);

  document.getElementById('clt-animate').addEventListener('click', () => {
    if (cltAnimId !== null) {
      cancelAnimationFrame(cltAnimId);
      cltAnimId = null;
      document.getElementById('clt-animate').textContent = 'Animate n';
      return;
    }
    document.getElementById('clt-animate').textContent = 'Stop';
    const slider = document.getElementById('clt-n');
    slider.value = 1;
    let currentN = 1;
    const step = () => {
      slider.value = currentN;
      document.getElementById('clt-n-val').value = currentN;
      renderCLT();
      currentN += currentN < 20 ? 1 : currentN < 50 ? 2 : 5;
      if (currentN > 200) {
        cltAnimId = null;
        document.getElementById('clt-animate').textContent = 'Animate n';
        return;
      }
      cltAnimId = requestAnimationFrame(step);
    };
    cltAnimId = requestAnimationFrame(step);
  });
}

/* ============================================================
   TAB 4 — STATISTICAL INFERENCE
   ============================================================ */

function sampleInfPop(dist, n) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    switch (dist) {
      case 'normal':   arr.push(d3.randomNormal(0, 1)()); break;
      case 'skewed':   arr.push(d3.randomExponential(1)()); break;
      case 'bimodal':  arr.push(Math.random() < 0.5 ? d3.randomNormal(-2, 0.7)() : d3.randomNormal(2, 0.7)()); break;
    }
  }
  return arr;
}

function infPopStats(dist) {
  switch (dist) {
    case 'normal':  return { mu: 0, sigma: 1 };
    case 'skewed':  return { mu: 1, sigma: 1 };
    case 'bimodal': return { mu: 0, sigma: Math.sqrt(4 + 0.49) };
  }
}

function renderInference() {
  const dist = document.getElementById('inf-pop').value;
  const n = +document.getElementById('inf-n').value;
  const nSamp = +document.getElementById('inf-nsamp').value;
  const confLevel = +document.getElementById('inf-conf').value;

  document.getElementById('inf-n-val').value = n;
  document.getElementById('inf-nsamp-val').value = nSamp;

  const { mu, sigma } = infPopStats(dist);
  const zCrit = normalQuantile(1 - (1 - confLevel) / 2);

  // Generate population for display
  const popSample = sampleInfPop(dist, 2000);
  renderInfPop(popSample, dist);

  // Generate sample means
  const means = [];
  for (let s = 0; s < nSamp; s++) {
    const samp = sampleInfPop(dist, n);
    means.push(d3.mean(samp));
  }

  const grandMean = d3.mean(means);
  const moe = zCrit * (sigma / Math.sqrt(n));
  document.getElementById('inf-pe').textContent = grandMean.toFixed(4);
  document.getElementById('inf-moe').textContent = moe.toFixed(4);
  document.getElementById('inf-ci-lo').textContent = (grandMean - moe).toFixed(4);
  document.getElementById('inf-ci-hi').textContent = (grandMean + moe).toFixed(4);

  renderSamplingDist(means, mu, sigma, n, zCrit, confLevel);
}

function normalQuantile(p) {
  // Rational approximation for Φ^{-1}(p) — Abramowitz & Stegun
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [2.515517, 0.802853, 0.010328];
  const b = [1.432788, 0.189269, 0.001308];
  const sign = p < 0.5 ? -1 : 1;
  const t = p < 0.5 ? Math.sqrt(-2 * Math.log(p)) : Math.sqrt(-2 * Math.log(1 - p));
  const num = a[0] + a[1] * t + a[2] * t * t;
  const den = 1 + b[0] * t + b[1] * t * t + b[2] * t * t * t;
  return sign * (t - num / den);
}

function renderInfPop(data, dist) {
  const container = document.getElementById('inf-pop-chart');
  container.innerHTML = '';

  const W = container.clientWidth || 600;
  const H = 220;
  const margin = { top: 15, right: 20, bottom: 40, left: 50 };
  const iW = W - margin.left - margin.right;
  const iH = H - margin.top - margin.bottom;

  const svg = d3.select(container).append('svg')
    .attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const ext = d3.extent(data);
  const xScale = d3.scaleLinear().domain([ext[0], ext[1]]).range([0, iW]);
  const histogram = d3.bin().domain(xScale.domain()).thresholds(40)(data);
  const yMax = d3.max(histogram, d => d.length);
  const yScale = d3.scaleLinear().domain([0, yMax * 1.1]).range([iH, 0]);

  g.selectAll('.hist-bar').data(histogram).enter().append('rect')
    .attr('class', 'hist-bar')
    .attr('x', d => xScale(d.x0) + 1)
    .attr('y', d => yScale(d.length))
    .attr('width', d => Math.max(0, xScale(d.x1) - xScale(d.x0) - 2))
    .attr('height', d => iH - yScale(d.length))
    .attr('fill', '#7c3aed').attr('fill-opacity', 0.55);

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${iH})`).call(d3.axisBottom(xScale).ticks(6));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(yScale).ticks(4));
  g.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle')
    .attr('x', iW / 2).attr('y', iH + 34).text('Population value');
}

function renderSamplingDist(means, mu, sigma, n, zCrit, confLevel) {
  const container = document.getElementById('inf-samp-chart');
  container.innerHTML = '';

  const W = container.clientWidth || 600;
  const H = 280;
  const margin = { top: 20, right: 20, bottom: 45, left: 50 };
  const iW = W - margin.left - margin.right;
  const iH = H - margin.top - margin.bottom;

  const svg = d3.select(container).append('svg')
    .attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xExt = d3.extent(means);
  const xPad = (xExt[1] - xExt[0]) * 0.15;
  const xDomain = [xExt[0] - xPad, xExt[1] + xPad];
  const xScale = d3.scaleLinear().domain(xDomain).range([0, iW]);

  const histogram = d3.bin().domain(xDomain).thresholds(30)(means);
  const yMax = d3.max(histogram, d => d.length / (means.length * (d.x1 - d.x0)));
  const sigmaXbar = sigma / Math.sqrt(n);
  const theoreticalPeak = normalPDF(mu, mu, sigmaXbar);
  const yDomain = Math.max(yMax, theoreticalPeak) * 1.15;
  const yScale = d3.scaleLinear().domain([0, yDomain]).range([iH, 0]);

  g.append('g').attr('class', 'grid')
    .call(d3.axisLeft(yScale).ticks(5).tickSize(-iW).tickFormat(''));

  // CI shading
  const moe = zCrit * sigmaXbar;
  const ciLo = mu - moe;
  const ciHi = mu + moe;
  if (xScale(ciLo) < iW && xScale(ciHi) > 0) {
    g.append('rect')
      .attr('x', Math.max(0, xScale(ciLo)))
      .attr('y', 0)
      .attr('width', Math.min(iW, xScale(ciHi)) - Math.max(0, xScale(ciLo)))
      .attr('height', iH)
      .attr('fill', '#2563eb').attr('fill-opacity', 0.08);
  }

  // Histogram
  g.selectAll('.hist-bar').data(histogram).enter().append('rect')
    .attr('class', 'hist-bar')
    .attr('x', d => xScale(d.x0) + 1)
    .attr('y', d => yScale(d.length / (means.length * (d.x1 - d.x0))))
    .attr('width', d => Math.max(0, xScale(d.x1) - xScale(d.x0) - 2))
    .attr('height', d => iH - yScale(d.length / (means.length * (d.x1 - d.x0))))
    .attr('fill', '#2563eb').attr('fill-opacity', 0.5);

  // Theoretical sampling distribution
  const pts = d3.range(201).map(i => {
    const x = xDomain[0] + (i / 200) * (xDomain[1] - xDomain[0]);
    return { x, y: normalPDF(x, mu, sigmaXbar) };
  });
  const line = d3.line().x(d => xScale(d.x)).y(d => yScale(d.y)).curve(d3.curveBasis);
  g.append('path').datum(pts).attr('d', line)
    .attr('fill', 'none').attr('stroke', '#e97319').attr('stroke-width', 2.5).attr('stroke-dasharray', '6,3');

  // True mean line
  if (xScale(mu) >= 0 && xScale(mu) <= iW) {
    g.append('line')
      .attr('x1', xScale(mu)).attr('x2', xScale(mu))
      .attr('y1', 0).attr('y2', iH)
      .attr('stroke', '#059669').attr('stroke-width', 2).attr('stroke-dasharray', '4,3');
    g.append('text').attr('x', xScale(mu) + 4).attr('y', 14)
      .attr('font-family', 'var(--font-heading)').attr('font-size', 11).attr('fill', '#059669')
      .text(`μ=${mu}`);
  }

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${iH})`).call(d3.axisBottom(xScale).ticks(6));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(yScale).ticks(5));
  g.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle')
    .attr('x', iW / 2).attr('y', iH + 38).text('Sample mean X̄');
  g.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle')
    .attr('transform', `rotate(-90)`).attr('x', -iH / 2).attr('y', -40).text('Density');
}

function initInference() {
  ['inf-pop', 'inf-n', 'inf-nsamp', 'inf-conf'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('change', renderInference);
    el.addEventListener('input', renderInference);
  });
  document.getElementById('inf-resample').addEventListener('click', renderInference);
}

/* ============================================================
   TAB 5 — T-TEST (Key Widget)
   ============================================================ */

function getTTestState() {
  return {
    n: +document.getElementById('ttest-n').value,
    xbar: +document.getElementById('ttest-xbar').value,
    s: +document.getElementById('ttest-s').value,
  };
}

function renderTTest() {
  const { n, xbar, s } = getTTestState();

  document.getElementById('ttest-n-val').value = n;
  document.getElementById('ttest-xbar-val').value = xbar.toFixed(1);
  document.getElementById('ttest-s-val').value = s.toFixed(1);

  const df = n - 1;
  const tStat = xbar / (s / Math.sqrt(n));
  const tCrit = tInverse(0.975, df);
  const pVal = tPValue2(tStat, df);
  const reject = Math.abs(tStat) > tCrit;

  document.getElementById('ttest-t-big').textContent = tStat.toFixed(4);
  document.getElementById('ttest-df').textContent = df;
  document.getElementById('ttest-tcrit').textContent = `±${tCrit.toFixed(4)}`;
  document.getElementById('ttest-pval').textContent = pVal < 0.0001 ? '< 0.0001' : pVal.toFixed(4);

  const decBox = document.getElementById('ttest-decision-box');
  if (reject) {
    decBox.textContent = 'Reject H₀';
    decBox.className = 'decision-box reject';
  } else {
    decBox.textContent = 'Fail to reject H₀';
    decBox.className = 'decision-box fail-reject';
  }

  renderTTestChart(df, tStat, tCrit, reject);
  renderTTestCI(xbar, s, n, tCrit);
}

function renderTTestChart(df, tStat, tCrit, reject) {
  const container = document.getElementById('ttest-chart');
  container.innerHTML = '';

  const W = container.clientWidth || 650;
  const H = 360;
  const margin = { top: 30, right: 30, bottom: 50, left: 55 };
  const iW = W - margin.left - margin.right;
  const iH = H - margin.top - margin.bottom;

  const svg = d3.select(container).append('svg')
    .attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xDomain = [-5, 5];
  const xScale = d3.scaleLinear().domain(xDomain).range([0, iW]);

  // Generate PDF points
  const N = 600;
  const pts = d3.range(N + 1).map(i => {
    const x = xDomain[0] + (i / N) * (xDomain[1] - xDomain[0]);
    return { x, y: tPDF(x, df) };
  });

  const yMax = d3.max(pts, d => d.y);
  const yScale = d3.scaleLinear().domain([0, yMax * 1.18]).range([iH, 0]);

  // Grid
  g.append('g').attr('class', 'grid')
    .call(d3.axisLeft(yScale).ticks(5).tickSize(-iW).tickFormat(''));

  // Defs for clip paths for rejection tails
  const defs = svg.append('defs');

  // Left tail clip
  defs.append('clipPath').attr('id', 'left-tail-clip')
    .append('rect')
    .attr('x', margin.left)
    .attr('y', margin.top)
    .attr('width', xScale(-tCrit))
    .attr('height', iH);

  // Right tail clip
  defs.append('clipPath').attr('id', 'right-tail-clip')
    .append('rect')
    .attr('x', margin.left + xScale(tCrit))
    .attr('y', margin.top)
    .attr('width', iW - xScale(tCrit))
    .attr('height', iH);

  // Left rejection area (filled)
  const leftTailPts = pts.filter(d => d.x <= -tCrit + 0.01);
  if (leftTailPts.length > 0) {
    leftTailPts.push({ x: -tCrit, y: 0 });
    leftTailPts.unshift({ x: xDomain[0], y: 0 });
    const area = d3.area().x(d => xScale(d.x)).y0(iH).y1(d => yScale(d.y));
    g.append('path').datum(leftTailPts).attr('d', area)
      .attr('fill', '#dc2626').attr('fill-opacity', 0.25);
  }

  // Right rejection area (filled)
  const rightTailPts = pts.filter(d => d.x >= tCrit - 0.01);
  if (rightTailPts.length > 0) {
    rightTailPts.unshift({ x: tCrit, y: 0 });
    rightTailPts.push({ x: xDomain[1], y: 0 });
    const area2 = d3.area().x(d => xScale(d.x)).y0(iH).y1(d => yScale(d.y));
    g.append('path').datum(rightTailPts).attr('d', area2)
      .attr('fill', '#dc2626').attr('fill-opacity', 0.25);
  }

  // Main PDF curve
  const line = d3.line().x(d => xScale(d.x)).y(d => yScale(d.y)).curve(d3.curveBasis);
  g.append('path').datum(pts).attr('d', line)
    .attr('fill', 'none').attr('stroke', '#334155').attr('stroke-width', 2.5);

  // Critical value lines
  [-tCrit, tCrit].forEach(tc => {
    g.append('line')
      .attr('x1', xScale(tc)).attr('x2', xScale(tc))
      .attr('y1', 0).attr('y2', iH)
      .attr('stroke', '#dc2626').attr('stroke-width', 1.5).attr('stroke-dasharray', '5,3');
  });

  // Annotations for critical values
  const tcLabel = tCrit.toFixed(3);
  g.append('text')
    .attr('x', xScale(-tCrit) - 4).attr('y', yScale(tPDF(-tCrit, df)) - 6)
    .attr('text-anchor', 'end')
    .attr('font-family', 'var(--font-heading)').attr('font-size', 10).attr('fill', '#dc2626')
    .text(`−t_crit = −${tcLabel}`);
  g.append('text')
    .attr('x', xScale(tCrit) + 4).attr('y', yScale(tPDF(tCrit, df)) - 6)
    .attr('text-anchor', 'start')
    .attr('font-family', 'var(--font-heading)').attr('font-size', 10).attr('fill', '#dc2626')
    .text(`t_crit = ${tcLabel}`);

  // t-statistic line (blue)
  const tX = Math.max(xDomain[0], Math.min(xDomain[1], tStat));
  g.append('line')
    .attr('x1', xScale(tX)).attr('x2', xScale(tX))
    .attr('y1', 0).attr('y2', iH)
    .attr('stroke', '#2563eb').attr('stroke-width', 2.5);

  // Arrow / triangle at top
  g.append('polygon')
    .attr('points', `${xScale(tX)},${-5} ${xScale(tX) - 7},${10} ${xScale(tX) + 7},${10}`)
    .attr('fill', '#2563eb');

  // t-stat label
  const tLabelX = tX > 3.5 ? xScale(tX) - 4 : xScale(tX) + 4;
  const tLabelAnchor = tX > 3.5 ? 'end' : 'start';
  g.append('text')
    .attr('x', tLabelX).attr('y', 24)
    .attr('text-anchor', tLabelAnchor)
    .attr('font-family', 'var(--font-heading)').attr('font-size', 11).attr('font-weight', 600)
    .attr('fill', '#2563eb')
    .text(`t = ${tStat.toFixed(3)}`);

  // "Reject" annotation if applicable
  if (reject) {
    g.append('text')
      .attr('x', iW / 2).attr('y', -12)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'var(--font-heading)').attr('font-size', 13).attr('font-weight', 700)
      .attr('fill', '#dc2626')
      .text('Reject H₀ — t falls in rejection region');
  }

  // Axes
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${iH})`)
    .call(d3.axisBottom(xScale).ticks(10));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(yScale).ticks(5));

  g.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle')
    .attr('x', iW / 2).attr('y', iH + 40).text(`t-statistic  (df = ${df})`);
  g.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle')
    .attr('transform', `rotate(-90)`).attr('x', -iH / 2).attr('y', -44).text('Density');

  // α/2 labels inside shaded tails
  g.append('text')
    .attr('x', xScale(xDomain[0]) + 6).attr('y', yScale(tPDF(-tCrit, df) * 0.3))
    .attr('font-family', 'var(--font-heading)').attr('font-size', 10).attr('fill', '#dc2626')
    .text('α/2');
  g.append('text')
    .attr('x', xScale(xDomain[1]) - 6).attr('y', yScale(tPDF(tCrit, df) * 0.3))
    .attr('text-anchor', 'end')
    .attr('font-family', 'var(--font-heading)').attr('font-size', 10).attr('fill', '#dc2626')
    .text('α/2');
}

function renderTTestCI(xbar, s, n, tCrit) {
  const container = document.getElementById('ttest-ci-chart');
  container.innerHTML = '';

  const W = container.clientWidth || 650;
  const H = 120;
  const margin = { top: 20, right: 30, bottom: 35, left: 30 };
  const iW = W - margin.left - margin.right;
  const iH = H - margin.top - margin.bottom;

  const svg = d3.select(container).append('svg')
    .attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const se = s / Math.sqrt(n);
  const ciLo = xbar - tCrit * se;
  const ciHi = xbar + tCrit * se;
  const mu0 = 0;

  const domainPad = Math.max(Math.abs(ciLo), Math.abs(ciHi), Math.abs(xbar)) + 0.5;
  const xDomain = [-domainPad, domainPad];
  const xScale = d3.scaleLinear().domain(xDomain).range([0, iW]);
  const cy = iH / 2;

  // Null hypothesis line
  g.append('line')
    .attr('x1', xScale(mu0)).attr('x2', xScale(mu0))
    .attr('y1', 0).attr('y2', iH)
    .attr('stroke', '#64748b').attr('stroke-width', 1.5).attr('stroke-dasharray', '4,3');

  g.append('text')
    .attr('x', xScale(mu0)).attr('y', -6)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'var(--font-heading)').attr('font-size', 10).attr('fill', '#64748b')
    .text('μ₀ = 0');

  // CI line
  const ciColor = (mu0 >= ciLo && mu0 <= ciHi) ? '#059669' : '#dc2626';
  g.append('line')
    .attr('x1', xScale(ciLo)).attr('x2', xScale(ciHi))
    .attr('y1', cy).attr('y2', cy)
    .attr('stroke', ciColor).attr('stroke-width', 4)
    .attr('stroke-linecap', 'round');

  // CI end caps
  [ciLo, ciHi].forEach(x => {
    g.append('line')
      .attr('x1', xScale(x)).attr('x2', xScale(x))
      .attr('y1', cy - 8).attr('y2', cy + 8)
      .attr('stroke', ciColor).attr('stroke-width', 2.5);
  });

  // x-bar dot
  g.append('circle')
    .attr('cx', xScale(xbar)).attr('cy', cy).attr('r', 6)
    .attr('fill', '#2563eb');

  // Labels
  g.append('text')
    .attr('x', xScale(xbar)).attr('y', cy - 12)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'var(--font-heading)').attr('font-size', 10).attr('fill', '#2563eb')
    .text(`x̄ = ${xbar.toFixed(2)}`);

  g.append('text')
    .attr('x', xScale(ciLo)).attr('y', cy + 18)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'var(--font-mono)').attr('font-size', 9).attr('fill', ciColor)
    .text(ciLo.toFixed(3));

  g.append('text')
    .attr('x', xScale(ciHi)).attr('y', cy + 18)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'var(--font-mono)').attr('font-size', 9).attr('fill', ciColor)
    .text(ciHi.toFixed(3));

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${iH})`)
    .call(d3.axisBottom(xScale).ticks(6));
}

function initTTest() {
  ['ttest-n', 'ttest-xbar', 'ttest-s'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderTTest);
  });
}

/* ============================================================
   BOOTSTRAP — wire everything up
   ============================================================ */

function init() {
  initTabs();
  renderEquations();
  initAxioms();
  initRV();
  initCLT();
  initInference();
  initTTest();

  // Render active tab (tab 1 is active by default)
  renderVenn();
  renderBayes();

  // Render t-test on load so stats panel is populated
  setTimeout(() => {
    renderTTest();
  }, 50);
}

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
