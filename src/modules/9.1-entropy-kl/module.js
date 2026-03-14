// ============================================================
//  Module 9.1 — Shannon Entropy, Cross-Entropy & KL Divergence
//  Interactive D3.js visualization of information-theoretic
//  quantities with draggable probability distributions.
// ============================================================

import * as d3 from 'd3';
import katex from 'katex';
import '../../lib/copy-code.js';

// ============================================================
//  Seeded PRNG — mulberry32
// ============================================================

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rng = mulberry32(42);

// ============================================================
//  Information-theoretic computations
// ============================================================

const LOG2 = Math.log(2);
const EPS = 1e-12;

function log2safe(x) {
  return x > EPS ? Math.log(x) / LOG2 : 0;
}

/** Shannon entropy H(P) = -sum p_i log2(p_i) */
function shannonEntropy(P) {
  let h = 0;
  for (const p of P) {
    if (p > EPS) h -= p * log2safe(p);
  }
  return h;
}

/** Cross-entropy H(P,Q) = -sum p_i log2(q_i) */
function crossEntropy(P, Q) {
  let h = 0;
  for (let i = 0; i < P.length; i++) {
    if (P[i] > EPS) h -= P[i] * log2safe(Q[i]);
  }
  return h;
}

/** KL divergence D_KL(P||Q) = sum p_i log2(p_i / q_i) */
function klDivergence(P, Q) {
  let d = 0;
  for (let i = 0; i < P.length; i++) {
    if (P[i] > EPS) {
      d += P[i] * log2safe(P[i] / Math.max(Q[i], EPS));
    }
  }
  return d;
}

/** Per-symbol KL contribution p_i * log2(p_i / q_i) */
function klPerSymbol(P, Q) {
  return P.map((p, i) => {
    if (p > EPS) return p * log2safe(p / Math.max(Q[i], EPS));
    return 0;
  });
}

/** Per-symbol information content -log2(p_i) */
function infoContent(P) {
  return P.map(p => (p > EPS ? -log2safe(p) : 0));
}

/** Jensen-Shannon divergence JSD(P||Q) = 0.5*D_KL(P||M) + 0.5*D_KL(Q||M), M=(P+Q)/2 */
function jsDivergence(P, Q) {
  const M = P.map((p, i) => (p + Q[i]) / 2);
  return 0.5 * klDivergence(P, M) + 0.5 * klDivergence(Q, M);
}

// ============================================================
//  Presets
// ============================================================

const PRESETS = {
  uniform: {
    label: 'Uniform',
    build(n) {
      const p = Array(n).fill(1 / n);
      return { P: p, Q: p.slice() };
    },
  },
  'fair-vs-biased': {
    label: 'Fair coin vs Biased',
    build(n) {
      const P = Array(n).fill(1 / n);
      const Q = Array(n).fill(0);
      Q[0] = 0.7;
      const rest = 0.3 / Math.max(1, n - 1);
      for (let i = 1; i < n; i++) Q[i] = rest;
      return { P, Q };
    },
  },
  english: {
    label: 'English letter frequencies',
    build(n) {
      const freqs = [0.127, 0.091, 0.082, 0.075, 0.070, 0.063, 0.061, 0.060];
      const P = freqs.slice(0, n);
      const sum = P.reduce((a, b) => a + b, 0);
      const Pn = P.map(p => p / sum);
      const Q = Array(n).fill(1 / n);
      return { P: Pn, Q };
    },
  },
  zipf: {
    label: "Zipf's law",
    build(n) {
      const raw = Array.from({ length: n }, (_, i) => 1 / (i + 1));
      const sum = raw.reduce((a, b) => a + b, 0);
      const P = raw.map(r => r / sum);
      const Q = Array(n).fill(1 / n);
      return { P, Q };
    },
  },
  custom: {
    label: 'Custom',
    build(n) {
      const P = Array(n).fill(1 / n);
      const Q = Array(n).fill(1 / n);
      return { P, Q };
    },
  },
};

// ============================================================
//  State
// ============================================================

const state = {
  n: 4,
  P: [],
  Q: [],
  preset: 'uniform',
  labels: [],
};

function symbolLabels(n) {
  return Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
}

function initState() {
  const preset = PRESETS[state.preset];
  const { P, Q } = preset.build(state.n);
  state.P = P;
  state.Q = Q;
  state.labels = symbolLabels(state.n);
}

// ============================================================
//  Normalization helpers
// ============================================================

function normalize(arr) {
  const sum = arr.reduce((s, v) => s + v, 0);
  if (sum < EPS) return arr.map(() => 1 / arr.length);
  return arr.map(v => v / sum);
}

function redistributeProbs(probs, dragIndex, newVal) {
  newVal = Math.max(0, Math.min(1, newVal));
  const oldOtherSum = probs.reduce((s, p, i) => (i === dragIndex ? s : s + p), 0);
  const remaining = 1 - newVal;

  const result = probs.slice();
  result[dragIndex] = newVal;

  if (oldOtherSum > EPS) {
    const scale = remaining / oldOtherSum;
    for (let i = 0; i < result.length; i++) {
      if (i !== dragIndex) result[i] = Math.max(0, probs[i] * scale);
    }
  } else {
    const share = remaining / Math.max(1, result.length - 1);
    for (let i = 0; i < result.length; i++) {
      if (i !== dragIndex) result[i] = share;
    }
  }

  // Fix floating-point drift
  const sum = result.reduce((s, p) => s + p, 0);
  if (Math.abs(sum - 1) > 1e-10) {
    for (let i = 0; i < result.length; i++) result[i] /= sum;
  }
  return result;
}

function randomDistribution(n) {
  const raw = Array.from({ length: n }, () => -Math.log(rng() + EPS));
  const sum = raw.reduce((s, v) => s + v, 0);
  return raw.map(v => v / sum);
}

// ============================================================
//  Tooltip
// ============================================================

function createTooltip() {
  let tip = d3.select('.entropy-tooltip');
  if (tip.empty()) {
    tip = d3.select('body').append('div')
      .attr('class', 'entropy-tooltip')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('background', 'rgba(255,255,255,0.96)')
      .style('border', '1px solid #cbd5e1')
      .style('border-radius', '6px')
      .style('padding', '6px 10px')
      .style('font-size', '12px')
      .style('font-family', 'var(--font-mono)')
      .style('box-shadow', '0 2px 8px rgba(0,0,0,0.12)')
      .style('opacity', 0);
  }
  return tip;
}

function showTooltip(tip, html, event) {
  tip.html(html)
    .style('left', (event.pageX + 14) + 'px')
    .style('top', (event.pageY - 30) + 'px')
    .style('opacity', 1);
}

function hideTooltip(tip) {
  tip.style('opacity', 0);
}

const tooltip = createTooltip();

// ============================================================
//  1. Distribution Panel — P (blue) and Q (orange)
// ============================================================

function renderDistributions() {
  const container = d3.select('#distributions-plot');
  container.selectAll('*').remove();

  const { P, Q, labels, n } = state;

  const width = 700;
  const height = 340;
  const margin = { top: 30, right: 30, bottom: 50, left: 50 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // x scale: group per symbol, two sub-bars
  const x0 = d3.scaleBand()
    .domain(labels)
    .range([0, innerW])
    .padding(0.25);

  const x1 = d3.scaleBand()
    .domain(['P', 'Q'])
    .range([0, x0.bandwidth()])
    .padding(0.08);

  const y = d3.scaleLinear()
    .domain([0, 1])
    .range([innerH, 0]);

  // Axes
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x0).tickSize(0))
    .selectAll('text').attr('font-size', 13);

  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.2f')));

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerH / 2).attr('y', -38)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'var(--font-heading)')
    .attr('font-size', 12).attr('fill', '#555')
    .text('Probability');

  // Uniform reference line
  g.append('line')
    .attr('x1', 0).attr('x2', innerW)
    .attr('y1', y(1 / n)).attr('y2', y(1 / n))
    .attr('stroke', '#cbd5e1').attr('stroke-width', 1)
    .attr('stroke-dasharray', '3,3');

  // Build data for bars
  const barData = [];
  for (let i = 0; i < n; i++) {
    barData.push({ symbol: labels[i], dist: 'P', value: P[i], index: i });
    barData.push({ symbol: labels[i], dist: 'Q', value: Q[i], index: i });
  }

  // Bars
  const bars = g.selectAll('rect.dist-bar')
    .data(barData)
    .join('rect')
    .attr('class', d => d.dist === 'P' ? 'p-bar' : 'q-bar')
    .attr('x', d => x0(d.symbol) + x1(d.dist))
    .attr('y', d => y(d.value))
    .attr('width', x1.bandwidth())
    .attr('height', d => innerH - y(d.value))
    .attr('rx', 2);

  // Value labels
  g.selectAll('text.bar-label')
    .data(barData)
    .join('text')
    .attr('class', 'bar-label')
    .attr('x', d => x0(d.symbol) + x1(d.dist) + x1.bandwidth() / 2)
    .attr('y', d => y(d.value) - 4)
    .text(d => d.value.toFixed(3));

  // Drag behavior
  const drag = d3.drag()
    .on('drag', function (event, d) {
      const mouseY = event.y;
      const newP = Math.max(0, Math.min(1, y.invert(mouseY)));
      if (d.dist === 'P') {
        state.P = redistributeProbs(state.P, d.index, newP);
      } else {
        state.Q = redistributeProbs(state.Q, d.index, newP);
      }
      renderAll();
    });

  bars.call(drag);

  // Tooltips
  bars
    .on('mouseover', (event, d) => {
      const label = d.dist === 'P' ? 'P' : 'Q';
      const ic = d.value > EPS ? -log2safe(d.value) : Infinity;
      showTooltip(tooltip,
        `<b>${label}(${d.symbol})</b> = ${d.value.toFixed(4)}<br/>` +
        `-log<sub>2</sub> = ${ic === Infinity ? '&infin;' : ic.toFixed(3)} bits`,
        event);
    })
    .on('mousemove', (event) => {
      tooltip.style('left', (event.pageX + 14) + 'px').style('top', (event.pageY - 30) + 'px');
    })
    .on('mouseout', () => hideTooltip(tooltip));

  // Legend
  const legend = g.append('g').attr('transform', `translate(${innerW - 110}, 0)`);
  [{ label: 'P', color: 'var(--color-primary)' }, { label: 'Q', color: 'var(--color-secondary)' }].forEach((d, i) => {
    legend.append('rect')
      .attr('x', 0).attr('y', i * 20).attr('width', 14).attr('height', 14)
      .attr('rx', 2).attr('fill', d.color).attr('opacity', 0.7);
    legend.append('text')
      .attr('x', 20).attr('y', i * 20 + 11)
      .attr('font-size', 12).attr('fill', '#555')
      .attr('font-family', 'var(--font-heading)')
      .text(d.label + ' distribution');
  });
}

// ============================================================
//  2. Entropy Decomposition Panel
// ============================================================

function renderEntropyDecomposition() {
  const container = d3.select('#entropy-plot');
  container.selectAll('*').remove();

  const { P, Q, labels, n } = state;

  const hp = shannonEntropy(P);
  const hpq = crossEntropy(P, Q);
  const dkl = klDivergence(P, Q);
  const ic = infoContent(P);

  const width = 420;
  const height = 280;
  const margin = { top: 25, right: 20, bottom: 50, left: 50 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Data: per-symbol information content bars + stacked decomposition bar
  const allItems = [...ic, hp, dkl];
  const yMax = Math.max(d3.max(allItems.filter(v => isFinite(v))), hpq, 1) * 1.15;

  const xLabels = [...labels, 'H(P,Q)'];
  const x = d3.scaleBand()
    .domain(xLabels)
    .range([0, innerW])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, yMax])
    .range([innerH, 0]);

  // Axes
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickSize(0))
    .selectAll('text').attr('font-size', 10);

  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.2f')));

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerH / 2).attr('y', -38)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'var(--font-heading)')
    .attr('font-size', 11).attr('fill', '#555')
    .text('bits');

  // Per-symbol information content bars
  for (let i = 0; i < n; i++) {
    const val = isFinite(ic[i]) ? ic[i] : yMax;
    g.append('rect')
      .attr('class', 'entropy-segment info-content')
      .attr('x', x(labels[i]))
      .attr('y', y(val))
      .attr('width', x.bandwidth())
      .attr('height', innerH - y(val))
      .attr('rx', 2)
      .on('mouseover', (event) => {
        showTooltip(tooltip,
          `<b>-log<sub>2</sub> P(${labels[i]})</b> = ${ic[i].toFixed(3)} bits`, event);
      })
      .on('mousemove', (event) => {
        tooltip.style('left', (event.pageX + 14) + 'px').style('top', (event.pageY - 30) + 'px');
      })
      .on('mouseout', () => hideTooltip(tooltip));

    g.append('text')
      .attr('class', 'bar-label')
      .attr('x', x(labels[i]) + x.bandwidth() / 2)
      .attr('y', y(val) - 3)
      .text(isFinite(ic[i]) ? ic[i].toFixed(2) : '\u221E');
  }

  // Stacked bar: H(P) (bottom, blue) + D_KL (top, orange) = H(P,Q)
  const stackX = x('H(P,Q)');
  const stackW = x.bandwidth();

  // H(P) segment
  g.append('rect')
    .attr('class', 'entropy-segment info-content')
    .attr('x', stackX)
    .attr('y', y(hp))
    .attr('width', stackW)
    .attr('height', innerH - y(hp))
    .attr('rx', 2)
    .on('mouseover', (event) => {
      showTooltip(tooltip, `<b>H(P)</b> = ${hp.toFixed(4)} bits`, event);
    })
    .on('mousemove', (event) => {
      tooltip.style('left', (event.pageX + 14) + 'px').style('top', (event.pageY - 30) + 'px');
    })
    .on('mouseout', () => hideTooltip(tooltip));

  // D_KL segment (stacked on top)
  if (dkl > EPS) {
    g.append('rect')
      .attr('class', 'entropy-segment cross-entropy-extra')
      .attr('x', stackX)
      .attr('y', y(hp + dkl))
      .attr('width', stackW)
      .attr('height', y(hp) - y(hp + dkl))
      .attr('rx', 2)
      .on('mouseover', (event) => {
        showTooltip(tooltip,
          `<b>D<sub>KL</sub>(P||Q)</b> = ${dkl.toFixed(4)} bits<br/>` +
          `H(P,Q) = H(P) + D<sub>KL</sub>`, event);
      })
      .on('mousemove', (event) => {
        tooltip.style('left', (event.pageX + 14) + 'px').style('top', (event.pageY - 30) + 'px');
      })
      .on('mouseout', () => hideTooltip(tooltip));
  }

  // H(P,Q) total label
  g.append('text')
    .attr('class', 'bar-label')
    .attr('x', stackX + stackW / 2)
    .attr('y', y(hpq) - 3)
    .text(hpq.toFixed(2));

  // Divider line between H(P) and D_KL
  if (dkl > EPS) {
    g.append('line')
      .attr('class', 'inequality-line')
      .attr('x1', stackX - 3).attr('x2', stackX + stackW + 3)
      .attr('y1', y(hp)).attr('y2', y(hp));
  }

  // Annotations
  const annotX = stackX + stackW + 6;
  g.append('text')
    .attr('class', 'inequality-label')
    .attr('x', annotX).attr('y', y(hp / 2) + 4)
    .attr('font-size', 9).text('H(P)');

  if (dkl > 0.02) {
    g.append('text')
      .attr('class', 'inequality-label')
      .attr('x', annotX).attr('y', y(hp + dkl / 2) + 4)
      .attr('font-size', 9).attr('fill', 'var(--color-secondary)')
      .text('D_KL');
  }
}

// ============================================================
//  3. KL Divergence Panel — per-symbol contributions
// ============================================================

function renderKLPanel() {
  const container = d3.select('#kl-plot');
  container.selectAll('*').remove();

  const { P, Q, labels, n } = state;

  const klPS = klPerSymbol(P, Q);
  const klQP = klPerSymbol(Q, P);
  const dklPQ = klDivergence(P, Q);
  const dklQP = klDivergence(Q, P);

  const width = 420;
  const height = 280;
  const margin = { top: 25, right: 20, bottom: 50, left: 50 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Grouped bars: P||Q and Q||P per symbol
  const x0 = d3.scaleBand()
    .domain(labels)
    .range([0, innerW])
    .padding(0.2);

  const x1 = d3.scaleBand()
    .domain(['PQ', 'QP'])
    .range([0, x0.bandwidth()])
    .padding(0.08);

  const allVals = [...klPS, ...klQP].filter(v => isFinite(v));
  const yMax = Math.max(d3.max(allVals) || 0, 0.1) * 1.2;

  const y = d3.scaleLinear()
    .domain([0, yMax])
    .range([innerH, 0]);

  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x0).tickSize(0))
    .selectAll('text').attr('font-size', 10);

  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.3f')));

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerH / 2).attr('y', -38)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'var(--font-heading)')
    .attr('font-size', 11).attr('fill', '#555')
    .text('bits');

  // P||Q bars
  for (let i = 0; i < n; i++) {
    const val = isFinite(klPS[i]) ? Math.max(0, klPS[i]) : 0;
    g.append('rect')
      .attr('class', 'kl-bar')
      .attr('x', x0(labels[i]) + x1('PQ'))
      .attr('y', y(val))
      .attr('width', x1.bandwidth())
      .attr('height', innerH - y(val))
      .attr('rx', 2)
      .style('fill', 'var(--color-secondary)')
      .on('mouseover', (event) => {
        showTooltip(tooltip,
          `<b>D<sub>KL</sub>(P||Q) for ${labels[i]}</b><br/>` +
          `p<sub>i</sub> log<sub>2</sub>(p<sub>i</sub>/q<sub>i</sub>) = ${klPS[i].toFixed(4)}`, event);
      })
      .on('mousemove', (event) => {
        tooltip.style('left', (event.pageX + 14) + 'px').style('top', (event.pageY - 30) + 'px');
      })
      .on('mouseout', () => hideTooltip(tooltip));
  }

  // Q||P bars
  for (let i = 0; i < n; i++) {
    const val = isFinite(klQP[i]) ? Math.max(0, klQP[i]) : 0;
    g.append('rect')
      .attr('class', 'kl-bar')
      .attr('x', x0(labels[i]) + x1('QP'))
      .attr('y', y(val))
      .attr('width', x1.bandwidth())
      .attr('height', innerH - y(val))
      .attr('rx', 2)
      .style('fill', 'var(--color-primary)')
      .style('opacity', 0.5)
      .on('mouseover', (event) => {
        showTooltip(tooltip,
          `<b>D<sub>KL</sub>(Q||P) for ${labels[i]}</b><br/>` +
          `q<sub>i</sub> log<sub>2</sub>(q<sub>i</sub>/p<sub>i</sub>) = ${klQP[i].toFixed(4)}`, event);
      })
      .on('mousemove', (event) => {
        tooltip.style('left', (event.pageX + 14) + 'px').style('top', (event.pageY - 30) + 'px');
      })
      .on('mouseout', () => hideTooltip(tooltip));
  }

  // Value labels for P||Q bars
  for (let i = 0; i < n; i++) {
    const val = isFinite(klPS[i]) ? Math.max(0, klPS[i]) : 0;
    if (val > 0.005) {
      g.append('text')
        .attr('class', 'bar-label')
        .attr('x', x0(labels[i]) + x1('PQ') + x1.bandwidth() / 2)
        .attr('y', y(val) - 3)
        .text(klPS[i].toFixed(3));
    }
  }

  // Legend
  const legend = g.append('g').attr('transform', `translate(${innerW - 120}, 0)`);
  [
    { label: `D_KL(P||Q) = ${dklPQ.toFixed(3)}`, color: 'var(--color-secondary)', opacity: 1 },
    { label: `D_KL(Q||P) = ${dklQP.toFixed(3)}`, color: 'var(--color-primary)', opacity: 0.5 },
  ].forEach((d, i) => {
    legend.append('rect')
      .attr('x', 0).attr('y', i * 18).attr('width', 12).attr('height', 12)
      .attr('rx', 2).attr('fill', d.color).attr('opacity', d.opacity);
    legend.append('text')
      .attr('x', 16).attr('y', i * 18 + 10)
      .attr('font-size', 9).attr('fill', '#555')
      .attr('font-family', 'var(--font-mono)')
      .text(d.label);
  });
}

// ============================================================
//  4. Coding Interpretation Panel
// ============================================================

function renderCodingPanel() {
  const container = d3.select('#coding-plot');
  container.selectAll('*').remove();

  const { P, Q, labels, n } = state;

  // Optimal code lengths for P and Q
  const codeLenP = P.map(p => (p > EPS ? -log2safe(p) : 0));
  const codeLenQ = Q.map(q => (q > EPS ? -log2safe(q) : 0));

  // Expected message lengths
  const expectedOptimal = P.reduce((s, p, i) => s + p * codeLenP[i], 0); // = H(P)
  const expectedSuboptimal = P.reduce((s, p, i) => s + p * codeLenQ[i], 0); // = H(P,Q)

  const width = 700;
  const height = 280;
  const margin = { top: 25, right: 30, bottom: 55, left: 50 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Layout: two rows of blocks per symbol, row 1 = P-optimal, row 2 = Q-based
  const rowHeight = (innerH - 40) / 2;
  const symbolWidth = innerW / n;
  const maxCodeLen = Math.max(d3.max(codeLenP), d3.max(codeLenQ), 1);

  // Row labels
  g.append('text')
    .attr('x', -8).attr('y', rowHeight / 2 + 4)
    .attr('text-anchor', 'end')
    .attr('font-size', 10).attr('fill', '#555')
    .attr('font-family', 'var(--font-heading)')
    .text('P-code');

  g.append('text')
    .attr('x', -8).attr('y', rowHeight + 24 + rowHeight / 2 + 4)
    .attr('text-anchor', 'end')
    .attr('font-size', 10).attr('fill', '#555')
    .attr('font-family', 'var(--font-heading)')
    .text('Q-code');

  for (let i = 0; i < n; i++) {
    const cx = i * symbolWidth;
    const bw = symbolWidth * 0.8;

    // P-optimal code block (height proportional to code length)
    const hP = (codeLenP[i] / maxCodeLen) * rowHeight;
    g.append('rect')
      .attr('class', 'code-block optimal-code')
      .attr('x', cx + symbolWidth * 0.1)
      .attr('y', rowHeight - hP)
      .attr('width', bw)
      .attr('height', hP)
      .attr('rx', 3)
      .on('mouseover', (event) => {
        showTooltip(tooltip,
          `<b>${labels[i]} — P-optimal code</b><br/>` +
          `Length: ${codeLenP[i].toFixed(2)} bits<br/>` +
          `P(${labels[i]}) = ${P[i].toFixed(4)}`, event);
      })
      .on('mousemove', (event) => {
        tooltip.style('left', (event.pageX + 14) + 'px').style('top', (event.pageY - 30) + 'px');
      })
      .on('mouseout', () => hideTooltip(tooltip));

    // Label on P block
    g.append('text')
      .attr('class', 'code-label')
      .attr('x', cx + symbolWidth / 2)
      .attr('y', rowHeight - hP - 4)
      .text(codeLenP[i].toFixed(1) + 'b');

    // Q-based code block
    const hQ = (codeLenQ[i] / maxCodeLen) * rowHeight;
    const row2Top = rowHeight + 24;
    g.append('rect')
      .attr('class', 'code-block suboptimal-code')
      .attr('x', cx + symbolWidth * 0.1)
      .attr('y', row2Top + rowHeight - hQ)
      .attr('width', bw)
      .attr('height', hQ)
      .attr('rx', 3)
      .on('mouseover', (event) => {
        showTooltip(tooltip,
          `<b>${labels[i]} — Q-based code</b><br/>` +
          `Length: ${codeLenQ[i].toFixed(2)} bits<br/>` +
          `Q(${labels[i]}) = ${Q[i].toFixed(4)}`, event);
      })
      .on('mousemove', (event) => {
        tooltip.style('left', (event.pageX + 14) + 'px').style('top', (event.pageY - 30) + 'px');
      })
      .on('mouseout', () => hideTooltip(tooltip));

    // Label on Q block
    g.append('text')
      .attr('class', 'code-label')
      .attr('x', cx + symbolWidth / 2)
      .attr('y', row2Top + rowHeight - hQ - 4)
      .text(codeLenQ[i].toFixed(1) + 'b');

    // Symbol label at bottom
    g.append('text')
      .attr('x', cx + symbolWidth / 2)
      .attr('y', innerH + 4)
      .attr('text-anchor', 'middle')
      .attr('font-size', 12).attr('fill', '#555')
      .attr('font-family', 'var(--font-heading)')
      .text(labels[i]);
  }

  // Expected length annotations
  const annotY = innerH + 20;
  g.append('text')
    .attr('x', 0).attr('y', annotY)
    .attr('font-size', 10).attr('fill', 'var(--color-primary)')
    .attr('font-family', 'var(--font-mono)')
    .text(`E[len|P-code] = H(P) = ${expectedOptimal.toFixed(3)} bits`);

  g.append('text')
    .attr('x', innerW / 2).attr('y', annotY)
    .attr('font-size', 10).attr('fill', 'var(--color-secondary)')
    .attr('font-family', 'var(--font-mono)')
    .text(`E[len|Q-code] = H(P,Q) = ${expectedSuboptimal.toFixed(3)} bits`);

  // Waste annotation
  const waste = expectedSuboptimal - expectedOptimal;
  if (waste > 0.001) {
    g.append('text')
      .attr('x', innerW / 2).attr('y', annotY + 14)
      .attr('font-size', 10).attr('fill', '#e11d48')
      .attr('font-family', 'var(--font-mono)')
      .text(`Extra cost: D_KL(P||Q) = ${waste.toFixed(3)} bits/symbol`);
  }
}

// ============================================================
//  Stats Panel
// ============================================================

function renderStats() {
  const el = document.getElementById('stats');
  if (!el) return;

  const { P, Q } = state;

  const hp = shannonEntropy(P);
  const hq = shannonEntropy(Q);
  const hpq = crossEntropy(P, Q);
  const hqp = crossEntropy(Q, P);
  const dklPQ = klDivergence(P, Q);
  const dklQP = klDivergence(Q, P);
  const jsd = jsDivergence(P, Q);

  const stats = [
    { label: 'H(P)', value: hp.toFixed(4), unit: 'bits' },
    { label: 'H(Q)', value: hq.toFixed(4), unit: 'bits' },
    { label: 'H(P,Q)', value: hpq.toFixed(4), unit: 'bits' },
    { label: 'H(Q,P)', value: hqp.toFixed(4), unit: 'bits' },
    { label: 'D_KL(P||Q)', value: dklPQ.toFixed(4), unit: 'bits' },
    { label: 'D_KL(Q||P)', value: dklQP.toFixed(4), unit: 'bits' },
    { label: 'JSD(P,Q)', value: jsd.toFixed(4), unit: 'bits' },
  ];

  el.innerHTML = stats.map(s =>
    `<div class="stat-card">
      <div class="stat-label">${s.label}</div>
      <div class="stat-value">${s.value}</div>
      <div class="stat-unit">${s.unit}</div>
    </div>`
  ).join('');
}

// ============================================================
//  Controls
// ============================================================

function buildControls() {
  // Preset select
  const presetDiv = document.getElementById('preset-select');
  if (presetDiv) {
    presetDiv.innerHTML = `
      <label class="control-label">Preset</label>
      <select id="preset-dropdown" class="control-select">
        ${Object.entries(PRESETS).map(([k, v]) =>
          `<option value="${k}" ${k === state.preset ? 'selected' : ''}>${v.label}</option>`
        ).join('')}
      </select>`;
  }

  // Number of symbols
  const numDiv = document.getElementById('num-symbols');
  if (numDiv) {
    numDiv.innerHTML = `
      <label class="control-label">Symbols (n)</label>
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="range" id="n-slider" min="2" max="8" value="${state.n}" style="flex:1;">
        <span id="n-val" class="control-value">${state.n}</span>
      </div>`;
  }

  // Distribution mode (informational)
  const modeDiv = document.getElementById('distribution-mode');
  if (modeDiv) {
    modeDiv.innerHTML = `
      <label class="control-label">Mode</label>
      <div class="control-value" style="font-size:12px;">Discrete bars (drag to adjust)</div>`;
  }

  wireControls();
}

function wireControls() {
  // Preset dropdown
  const presetDropdown = document.getElementById('preset-dropdown');
  if (presetDropdown) {
    presetDropdown.addEventListener('change', () => {
      state.preset = presetDropdown.value;
      initState();
      renderAll();
    });
  }

  // n slider
  const nSlider = document.getElementById('n-slider');
  const nVal = document.getElementById('n-val');
  if (nSlider) {
    nSlider.addEventListener('input', () => {
      state.n = parseInt(nSlider.value);
      if (nVal) nVal.textContent = state.n;
      initState();
      renderAll();
    });
  }

  // Randomize Q button
  const randomizeBtn = document.getElementById('randomize-btn');
  if (randomizeBtn) {
    randomizeBtn.addEventListener('click', () => {
      rng = mulberry32(Date.now() % 100000);
      state.Q = randomDistribution(state.n);
      renderAll();
    });
  }

  // Set Q=P button
  const matchBtn = document.getElementById('match-btn');
  if (matchBtn) {
    matchBtn.addEventListener('click', () => {
      state.Q = state.P.slice();
      renderAll();
    });
  }
}

// ============================================================
//  Info Panel — KaTeX formulas
// ============================================================

function renderInfoPanel() {
  const el = document.getElementById('info');
  if (!el) return;

  // Build formula containers
  el.innerHTML = `
    <h3>Key Formulas</h3>
    <div class="info-formula" id="formula-entropy"></div>
    <div class="info-formula" id="formula-cross-entropy"></div>
    <div class="info-formula" id="formula-kl"></div>
    <div class="info-formula" id="formula-decomposition"></div>
    <div class="info-formula" id="formula-gibbs"></div>
    <div class="info-formula" id="formula-jsd"></div>
    <div class="info-formula" id="formula-dpi"></div>
  `;

  const formulas = [
    {
      id: 'formula-entropy',
      tex: String.raw`H(P) = -\sum_{i=1}^{n} p_i \log_2 p_i`,
      caption: 'Shannon Entropy',
    },
    {
      id: 'formula-cross-entropy',
      tex: String.raw`H(P, Q) = -\sum_{i=1}^{n} p_i \log_2 q_i`,
      caption: 'Cross-Entropy',
    },
    {
      id: 'formula-kl',
      tex: String.raw`D_{\mathrm{KL}}(P \| Q) = \sum_{i=1}^{n} p_i \log_2 \frac{p_i}{q_i}`,
      caption: 'KL Divergence',
    },
    {
      id: 'formula-decomposition',
      tex: String.raw`H(P, Q) = H(P) + D_{\mathrm{KL}}(P \| Q)`,
      caption: 'Cross-Entropy Decomposition',
    },
    {
      id: 'formula-gibbs',
      tex: String.raw`H(P, Q) \geq H(P) \quad \text{(Gibbs' inequality, equality iff } P = Q\text{)}`,
      caption: "Gibbs' Inequality",
    },
    {
      id: 'formula-jsd',
      tex: String.raw`\mathrm{JSD}(P \| Q) = \tfrac{1}{2} D_{\mathrm{KL}}(P \| M) + \tfrac{1}{2} D_{\mathrm{KL}}(Q \| M), \quad M = \tfrac{1}{2}(P + Q)`,
      caption: 'Jensen-Shannon Divergence',
    },
    {
      id: 'formula-dpi',
      tex: String.raw`X \to Y \to Z \implies D_{\mathrm{KL}}\bigl(P_Z \| Q_Z\bigr) \leq D_{\mathrm{KL}}\bigl(P_X \| Q_X\bigr)`,
      caption: 'Data Processing Inequality',
    },
  ];

  for (const f of formulas) {
    const target = document.getElementById(f.id);
    if (!target) continue;

    const captionEl = document.createElement('div');
    captionEl.style.cssText = 'font-size:11px;color:#888;margin-bottom:4px;font-family:var(--font-heading);';
    captionEl.textContent = f.caption;
    target.prepend(captionEl);

    const mathEl = document.createElement('div');
    target.appendChild(mathEl);

    katex.render(f.tex, mathEl, { displayMode: true, throwOnError: false });
  }
}

// ============================================================
//  Subtitle update
// ============================================================

function updateSubtitle() {
  const el = document.getElementById('dist-subtitle');
  if (!el) return;
  const hp = shannonEntropy(state.P);
  const dkl = klDivergence(state.P, state.Q);
  el.textContent = `Drag bars to adjust | H(P) = ${hp.toFixed(3)} bits | D_KL(P||Q) = ${dkl.toFixed(3)} bits`;
}

// ============================================================
//  Render all
// ============================================================

function renderAll() {
  renderDistributions();
  renderEntropyDecomposition();
  renderKLPanel();
  renderCodingPanel();
  renderStats();
  updateSubtitle();
}

// ============================================================
//  Initialize
// ============================================================

function init() {
  initState();
  buildControls();
  renderInfoPanel();
  renderAll();
}

init();
