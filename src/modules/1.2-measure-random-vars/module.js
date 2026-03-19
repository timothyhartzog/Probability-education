// ============================================================
//  Module 1.2 — Measure Construction & Random Variables
//  Interactive exploration of probability measures, random
//  variables as measurable functions, and pushforward measures.
// ============================================================

import * as d3 from 'd3';
import katex from 'katex';
import '../../lib/copy-code.js';

// ============================================================
//  Random Variable Definitions
// ============================================================

/**
 * Build a random variable mapping for a given type and sample space size.
 * Returns an array of length n, where rv[i] = X(omega_{i+1}).
 */
function buildRV(type, n) {
  switch (type) {
    case 'indicator':
      // 1_{first half}: first ceil(n/2) outcomes map to 1, rest to 0
      return Array.from({ length: n }, (_, i) => (i < Math.ceil(n / 2) ? 1 : 0));

    case 'two-value':
      // Alternating: even-indexed -> value a, odd-indexed -> value b
      return Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 2 : 5));

    case 'three-value': {
      // Distribute outcomes across three values
      const vals = [1, 3, 7];
      return Array.from({ length: n }, (_, i) => vals[i % 3]);
    }

    case 'identity':
      // X(omega_i) = i+1
      return Array.from({ length: n }, (_, i) => i + 1);

    default:
      return Array.from({ length: n }, (_, i) => i + 1);
  }
}

/**
 * Compute the range (unique values) of a random variable.
 */
function rvRange(rv) {
  return [...new Set(rv)].sort((a, b) => a - b);
}

/**
 * Compute preimage sets: for each value y in range, which indices map to y.
 * Returns a Map: y -> [indices].
 */
function computePreimages(rv) {
  const preimages = new Map();
  rv.forEach((y, i) => {
    if (!preimages.has(y)) preimages.set(y, []);
    preimages.get(y).push(i);
  });
  return preimages;
}

/**
 * Compute pushforward measure: P_X({y}) = sum of P(omega_i) for i in X^{-1}({y}).
 */
function computePushforward(probs, rv) {
  const preimages = computePreimages(rv);
  const result = new Map();
  for (const [y, indices] of preimages) {
    result.set(y, indices.reduce((sum, i) => sum + probs[i], 0));
  }
  return result;
}

/**
 * Compute Shannon entropy H(P) = -sum p_i log2(p_i).
 */
function entropy(probs) {
  let h = 0;
  for (const p of probs) {
    if (p > 1e-12) h -= p * Math.log2(p);
  }
  return h;
}

/**
 * Count atoms of sigma(X): number of distinct preimage sets = |range(X)|.
 */
function sigmaXAtoms(rv) {
  return rvRange(rv).length;
}

// ============================================================
//  Color palette for preimage groups
// ============================================================

const preimageColors = [
  '#2563eb', '#e97319', '#059669', '#7c3aed', '#db2777', '#0891b2'
];

// ============================================================
//  State
// ============================================================

const state = {
  n: 4,
  probs: [],           // probability assigned to each outcome
  rvType: 'indicator',
  rv: [],              // current random variable mapping
  showPreimage: true,
  showPushforwardArrows: true,
};

function initProbs(n) {
  // Uniform distribution
  return Array.from({ length: n }, () => 1 / n);
}

function initState() {
  state.probs = initProbs(state.n);
  state.rv = buildRV(state.rvType, state.n);
}

// ============================================================
//  DOM References
// ============================================================

const omegaSlider = document.getElementById('omega-size');
const omegaVal = document.getElementById('omega-size-val');
const rvTypeSelect = document.getElementById('rv-type');
const preimageCheck = document.getElementById('toggle-preimage');
const pushforwardArrowsCheck = document.getElementById('toggle-pushforward-arrows');
const resetBtn = document.getElementById('reset-btn');
const randomBtn = document.getElementById('random-btn');
const statTotal = document.getElementById('stat-total');
const statEntropy = document.getElementById('stat-entropy');
const statAtomsEl = document.getElementById('stat-atoms');
const measureChart = document.getElementById('measure-chart');
const rvChart = document.getElementById('rv-chart');
const pushforwardChart = document.getElementById('pushforward-chart');

// KaTeX targets
const infoMeasureDef = document.getElementById('info-measure-def');
const infoRvDef = document.getElementById('info-rv-def');
const infoPushforwardDef = document.getElementById('info-pushforward-def');
const infoSigmaXDef = document.getElementById('info-sigma-x-def');

// ============================================================
//  Render KaTeX
// ============================================================

function renderKaTeX() {
  if (infoMeasureDef) {
    katex.render(
      String.raw`P\colon \mathcal{F} \to [0,1], \quad P(\Omega) = 1, \quad P\!\Bigl(\biguplus_{i=1}^{\infty} A_i\Bigr) = \sum_{i=1}^{\infty} P(A_i)`,
      infoMeasureDef,
      { displayMode: true, throwOnError: false }
    );
  }
  if (infoRvDef) {
    katex.render(
      String.raw`X\colon \Omega \to \mathbb{R} \text{ is measurable} \iff \forall\, B \in \mathcal{B}(\mathbb{R}),\; X^{-1}(B) \in \mathcal{F}`,
      infoRvDef,
      { displayMode: true, throwOnError: false }
    );
  }
  if (infoPushforwardDef) {
    katex.render(
      String.raw`P_X(B) = P\bigl(X^{-1}(B)\bigr) = P\bigl(\{\omega \in \Omega : X(\omega) \in B\}\bigr) \quad \forall\, B \in \mathcal{B}(\mathbb{R})`,
      infoPushforwardDef,
      { displayMode: true, throwOnError: false }
    );
  }
  if (infoSigmaXDef) {
    katex.render(
      String.raw`\sigma(X) = \bigl\{X^{-1}(B) : B \in \mathcal{B}(\mathbb{R})\bigr\} = \sigma\!\bigl(\{X^{-1}(\{x\}) : x \in \mathbb{R}\}\bigr)`,
      infoSigmaXDef,
      { displayMode: true, throwOnError: false }
    );
  }
}

// ============================================================
//  Update stats
// ============================================================

function updateStats() {
  const total = state.probs.reduce((s, p) => s + p, 0);
  statTotal.textContent = total.toFixed(4);
  statEntropy.textContent = entropy(state.probs).toFixed(3);
  statAtomsEl.textContent = sigmaXAtoms(state.rv);
}

// ============================================================
//  Normalize probabilities (ensure sum = 1)
// ============================================================

/**
 * After dragging one bar, redistribute the remaining weight proportionally.
 * dragIndex: index of the bar being dragged
 * newVal: new probability value for that bar
 */
function redistributeProbs(dragIndex, newVal) {
  const n = state.n;
  newVal = Math.max(0, Math.min(1, newVal));

  const oldOtherSum = state.probs.reduce((s, p, i) => i === dragIndex ? s : s + p, 0);
  const remaining = 1 - newVal;

  state.probs[dragIndex] = newVal;

  if (oldOtherSum > 1e-12) {
    const scale = remaining / oldOtherSum;
    for (let i = 0; i < n; i++) {
      if (i !== dragIndex) {
        state.probs[i] = Math.max(0, state.probs[i] * scale);
      }
    }
  } else {
    // All others were zero; distribute remaining equally
    const share = remaining / Math.max(1, n - 1);
    for (let i = 0; i < n; i++) {
      if (i !== dragIndex) {
        state.probs[i] = share;
      }
    }
  }

  // Fix floating-point drift
  const sum = state.probs.reduce((s, p) => s + p, 0);
  if (Math.abs(sum - 1) > 1e-10) {
    state.probs = state.probs.map(p => p / sum);
  }
}

// ============================================================
//  Measure Builder (Main Panel)
// ============================================================

function renderMeasureChart() {
  measureChart.innerHTML = '';

  const n = state.n;
  const probs = state.probs;
  const rv = state.rv;
  const preimages = computePreimages(rv);
  const rangeVals = rvRange(rv);

  const width = 700;
  const height = 360;
  const margin = { top: 30, right: 30, bottom: 50, left: 50 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3.select(measureChart)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // Defs for arrow markers
  svg.append('defs').append('marker')
    .attr('id', 'measure-arrow')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', 8).attr('refY', 5)
    .attr('markerWidth', 6).attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 z')
    .attr('fill', '#e97319');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Scales
  const x = d3.scaleBand()
    .domain(d3.range(n).map(i => `\u03C9${subscript(i + 1)}`))
    .range([0, innerW])
    .padding(0.25);

  const y = d3.scaleLinear()
    .domain([0, 1])
    .range([innerH, 0]);

  // Axes
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickSize(0))
    .selectAll('text')
    .attr('font-size', 13);

  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.2f')));

  // Y-axis label
  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerH / 2)
    .attr('y', -38)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'var(--font-heading)')
    .attr('font-size', 12)
    .attr('fill', '#555')
    .text('P({ω})');

  // Color-code bars by preimage group
  const colorMap = new Map();
  rangeVals.forEach((val, ci) => {
    const indices = preimages.get(val);
    indices.forEach(i => colorMap.set(i, preimageColors[ci % preimageColors.length]));
  });

  // Preimage group backgrounds (if toggle on)
  if (state.showPreimage) {
    rangeVals.forEach((val, ci) => {
      const indices = preimages.get(val);
      if (indices.length <= 0) return;

      const xPositions = indices.map(i => x(`\u03C9${subscript(i + 1)}`));
      const xMin = d3.min(xPositions) - x.bandwidth() * 0.15;
      const xMax = d3.max(xPositions) + x.bandwidth() * 1.15;
      const color = preimageColors[ci % preimageColors.length];

      g.append('rect')
        .attr('class', 'preimage-group')
        .attr('x', xMin)
        .attr('y', -10)
        .attr('width', xMax - xMin)
        .attr('height', innerH + 20)
        .attr('rx', 6)
        .attr('ry', 6)
        .attr('fill', color)
        .attr('fill-opacity', 0.06)
        .attr('stroke', color)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,3');

      // Preimage label
      g.append('text')
        .attr('x', (xMin + xMax) / 2)
        .attr('y', innerH + 38)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'var(--font-mono)')
        .attr('font-size', 10)
        .attr('fill', color)
        .text(`X⁻¹({${val}})`);
    });
  }

  // Reference line at P = 1/n (uniform)
  g.append('line')
    .attr('x1', 0).attr('x2', innerW)
    .attr('y1', y(1 / n)).attr('y2', y(1 / n))
    .attr('stroke', '#cbd5e1')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '3,3');

  // Bars
  const bars = g.selectAll('rect.measure-bar')
    .data(probs.map((p, i) => ({ p, i })))
    .join('rect')
    .attr('class', 'measure-bar')
    .attr('x', d => x(`\u03C9${subscript(d.i + 1)}`))
    .attr('y', d => y(d.p))
    .attr('width', x.bandwidth())
    .attr('height', d => innerH - y(d.p))
    .attr('fill', d => colorMap.get(d.i) || '#2563eb')
    .attr('fill-opacity', 0.7)
    .attr('stroke', d => colorMap.get(d.i) || '#2563eb')
    .attr('stroke-width', 1.5)
    .attr('rx', 3);

  // Value labels on bars
  g.selectAll('text.bar-value')
    .data(probs.map((p, i) => ({ p, i })))
    .join('text')
    .attr('class', 'bar-value')
    .attr('x', d => x(`\u03C9${subscript(d.i + 1)}`) + x.bandwidth() / 2)
    .attr('y', d => y(d.p) - 6)
    .text(d => d.p.toFixed(3));

  // Drag behavior
  const drag = d3.drag()
    .on('start', function (event, d) {
      d3.select(this).classed('dragging', true);
    })
    .on('drag', function (event, d) {
      const mouseY = event.y;
      const newP = Math.max(0, Math.min(1, y.invert(mouseY)));
      redistributeProbs(d.i, newP);
      renderAll();
    })
    .on('end', function () {
      d3.select(this).classed('dragging', false);
    });

  bars.call(drag);

  // Sum indicator line
  const total = probs.reduce((s, p) => s + p, 0);
  g.append('line')
    .attr('class', 'sum-line')
    .attr('x1', 0).attr('x2', innerW)
    .attr('y1', y(total)).attr('y2', y(total));

  g.append('text')
    .attr('class', 'sum-label')
    .attr('x', innerW + 4)
    .attr('y', y(total) + 4)
    .text(`\u2211 = ${total.toFixed(4)}`);
}

// ============================================================
//  Random Variable Mapping (Secondary Left)
// ============================================================

function renderRVChart() {
  rvChart.innerHTML = '';

  const n = state.n;
  const rv = state.rv;
  const preimages = computePreimages(rv);
  const rangeVals = rvRange(rv);

  const width = 420;
  const height = Math.max(280, n * 50 + 60);
  const margin = { top: 40, right: 40, bottom: 30, left: 40 };

  const svg = d3.select(rvChart)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // Arrow marker
  svg.append('defs').append('marker')
    .attr('id', 'rv-arrowhead')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', 9).attr('refY', 5)
    .attr('markerWidth', 6).attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 z')
    .attr('fill', '#94a3b8');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const leftX = 40;
  const rightX = innerW - 40;

  // Column labels
  g.append('text')
    .attr('class', 'rv-column-label')
    .attr('x', leftX).attr('y', -15)
    .text('\u03A9');

  g.append('text')
    .attr('class', 'rv-column-label')
    .attr('x', rightX).attr('y', -15)
    .text('\u211D');

  // Left column: sample space points
  const leftSpacing = innerH / (n + 1);
  const leftNodes = d3.range(n).map(i => ({
    x: leftX,
    y: leftSpacing * (i + 1),
    label: `\u03C9${subscript(i + 1)}`,
    index: i,
  }));

  // Right column: range values
  const rightSpacing = innerH / (rangeVals.length + 1);
  const rightNodes = rangeVals.map((v, i) => ({
    x: rightX,
    y: rightSpacing * (i + 1),
    label: String(v),
    value: v,
  }));

  // Build a map from value -> right node position
  const rightPosMap = new Map();
  rightNodes.forEach(rn => rightPosMap.set(rn.value, rn));

  // Preimage brackets (if toggle on)
  if (state.showPreimage) {
    rangeVals.forEach((val, ci) => {
      const indices = preimages.get(val);
      if (indices.length <= 0) return;

      const color = preimageColors[ci % preimageColors.length];
      const yPositions = indices.map(i => leftNodes[i].y);
      const yMin = d3.min(yPositions) - 14;
      const yMax = d3.max(yPositions) + 14;
      const bracketX = leftX - 28;

      // Bracket line
      g.append('path')
        .attr('class', 'preimage-bracket')
        .attr('d', `M ${bracketX + 8} ${yMin} L ${bracketX} ${yMin} L ${bracketX} ${yMax} L ${bracketX + 8} ${yMax}`)
        .attr('stroke', color);

      // Background highlight
      g.append('rect')
        .attr('x', bracketX + 2)
        .attr('y', yMin)
        .attr('width', leftX - bracketX + 18)
        .attr('height', yMax - yMin)
        .attr('rx', 4)
        .attr('fill', color)
        .attr('fill-opacity', 0.06);

      // Label
      g.append('text')
        .attr('class', 'preimage-label')
        .attr('x', bracketX - 2)
        .attr('y', (yMin + yMax) / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'central')
        .attr('font-size', 9)
        .attr('fill', color)
        .text(`X⁻¹(${val})`);
    });
  }

  // Arrows from left to right
  leftNodes.forEach((ln, i) => {
    const targetVal = rv[i];
    const rn = rightPosMap.get(targetVal);
    const ci = rangeVals.indexOf(targetVal);
    const color = preimageColors[ci % preimageColors.length];

    g.append('line')
      .attr('class', 'rv-arrow')
      .attr('x1', ln.x + 14)
      .attr('y1', ln.y)
      .attr('x2', rn.x - 14)
      .attr('y2', rn.y)
      .attr('stroke', color)
      .attr('stroke-opacity', 0.5);
  });

  // Left nodes
  g.selectAll('circle.rv-node-left')
    .data(leftNodes)
    .join('circle')
    .attr('class', 'rv-node')
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .attr('r', 10)
    .attr('fill', d => {
      const ci = rangeVals.indexOf(rv[d.index]);
      return preimageColors[ci % preimageColors.length];
    })
    .attr('fill-opacity', 0.15)
    .attr('stroke', d => {
      const ci = rangeVals.indexOf(rv[d.index]);
      return preimageColors[ci % preimageColors.length];
    })
    .attr('stroke-width', 2);

  g.selectAll('text.rv-left-label')
    .data(leftNodes)
    .join('text')
    .attr('class', 'rv-node-label')
    .attr('x', d => d.x)
    .attr('y', d => d.y)
    .text(d => d.label);

  // Right nodes
  g.selectAll('circle.rv-node-right')
    .data(rightNodes)
    .join('circle')
    .attr('class', 'rv-node')
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .attr('r', 10)
    .attr('fill', (d, i) => preimageColors[i % preimageColors.length])
    .attr('fill-opacity', 0.15)
    .attr('stroke', (d, i) => preimageColors[i % preimageColors.length])
    .attr('stroke-width', 2);

  g.selectAll('text.rv-right-label')
    .data(rightNodes)
    .join('text')
    .attr('class', 'rv-node-label')
    .attr('x', d => d.x)
    .attr('y', d => d.y)
    .text(d => d.label);

  // Show probability next to each left node
  g.selectAll('text.rv-prob-label')
    .data(leftNodes)
    .join('text')
    .attr('x', d => d.x + 18)
    .attr('y', d => d.y)
    .attr('dominant-baseline', 'central')
    .attr('font-family', 'var(--font-mono)')
    .attr('font-size', 10)
    .attr('fill', '#555')
    .text(d => state.probs[d.index].toFixed(3));
}

// ============================================================
//  Pushforward Distribution (Secondary Right)
// ============================================================

function renderPushforwardChart() {
  pushforwardChart.innerHTML = '';

  const rv = state.rv;
  const probs = state.probs;
  const pushforward = computePushforward(probs, rv);
  const rangeVals = rvRange(rv);

  const width = 420;
  const height = 280;
  const margin = { top: 30, right: 30, bottom: 50, left: 55 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3.select(pushforwardChart)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Scales
  const x = d3.scaleBand()
    .domain(rangeVals.map(String))
    .range([0, innerW])
    .padding(0.3);

  const maxP = Math.max(0.1, d3.max(rangeVals, v => pushforward.get(v) || 0));

  const y = d3.scaleLinear()
    .domain([0, Math.min(1, maxP * 1.2)])
    .range([innerH, 0]);

  // Axes
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickSize(0))
    .selectAll('text')
    .attr('font-size', 12);

  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.2f')));

  // X-axis label
  g.append('text')
    .attr('x', innerW / 2)
    .attr('y', innerH + 38)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'var(--font-heading)')
    .attr('font-size', 12)
    .attr('fill', '#555')
    .text('x');

  // Y-axis label
  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerH / 2)
    .attr('y', -42)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'var(--font-heading)')
    .attr('font-size', 12)
    .attr('fill', '#555')
    .text('Pₓ({x})');

  // Bars
  const barData = rangeVals.map((v, i) => ({
    value: v,
    prob: pushforward.get(v) || 0,
    colorIndex: i,
  }));

  g.selectAll('rect.pushforward-bar')
    .data(barData)
    .join('rect')
    .attr('class', 'pushforward-bar')
    .attr('x', d => x(String(d.value)))
    .attr('y', d => y(d.prob))
    .attr('width', x.bandwidth())
    .attr('height', d => innerH - y(d.prob))
    .attr('fill', d => preimageColors[d.colorIndex % preimageColors.length])
    .attr('fill-opacity', 0.7)
    .attr('stroke', d => preimageColors[d.colorIndex % preimageColors.length])
    .attr('stroke-width', 1.5)
    .attr('rx', 3);

  // Value labels
  g.selectAll('text.pushforward-value')
    .data(barData)
    .join('text')
    .attr('class', 'pushforward-value')
    .attr('x', d => x(String(d.value)) + x.bandwidth() / 2)
    .attr('y', d => y(d.prob) - 6)
    .text(d => d.prob.toFixed(3));

  // Pushforward arrows animation: curved arrows from measure chart conceptually
  if (state.showPushforwardArrows) {
    const preimages = computePreimages(rv);

    rangeVals.forEach((val, ci) => {
      const indices = preimages.get(val);
      const totalP = pushforward.get(val) || 0;
      const color = preimageColors[ci % preimageColors.length];
      const barCenterX = x(String(val)) + x.bandwidth() / 2;
      const barTopY = y(totalP);

      // Animated dots flowing into the bar
      indices.forEach((idx, j) => {
        const startX = barCenterX - x.bandwidth() / 2 + (j + 0.5) * (x.bandwidth() / indices.length);
        const startY = -10;

        const dot = g.append('circle')
          .attr('cx', startX)
          .attr('cy', startY)
          .attr('r', 3)
          .attr('fill', color)
          .attr('fill-opacity', 0);

        dot.transition()
          .delay(ci * 300 + j * 150)
          .duration(600)
          .attr('fill-opacity', 0.6)
          .attr('cy', barTopY + 10)
          .transition()
          .duration(300)
          .attr('fill-opacity', 0);
      });
    });
  }
}

// ============================================================
//  Unicode subscript helper
// ============================================================

function subscript(num) {
  const subs = '\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089';
  return String(num).split('').map(d => subs[parseInt(d)]).join('');
}

// ============================================================
//  CDF Chart — F_X(t) = P(X ≤ t)
// ============================================================

function renderCDFChart() {
  const container = document.getElementById('cdf-chart');
  if (!container) return;
  container.innerHTML = '';

  const rv = state.rv;
  const probs = state.probs;
  const pushforward = computePushforward(probs, rv);
  const rangeVals = rvRange(rv);

  // Build CDF points: include -inf lead-in and +inf tail
  const padding = 0.8;
  const xMin = rangeVals[0] - padding;
  const xMax = rangeVals[rangeVals.length - 1] + padding;

  // Sorted (value, cumProb) pairs
  let cumulative = 0;
  const steps = [];
  for (const val of rangeVals) {
    const left = cumulative;
    cumulative += pushforward.get(val) || 0;
    steps.push({ val, left, right: cumulative });
  }

  const w = container.clientWidth || 360;
  const h = 200;
  const margin = { top: 20, right: 20, bottom: 36, left: 46 };
  const iW = w - margin.left - margin.right;
  const iH = h - margin.top - margin.bottom;

  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, iW]);
  const yScale = d3.scaleLinear().domain([0, 1]).range([iH, 0]);

  // Axes
  g.append('g').attr('transform', `translate(0,${iH})`).call(d3.axisBottom(xScale).ticks(rangeVals.length + 2));
  g.append('g').call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format('.1f')));

  // Axis labels
  g.append('text').attr('class', 'axis-label')
    .attr('text-anchor', 'middle')
    .attr('x', iW / 2).attr('y', iH + 32)
    .text('t');
  g.append('text').attr('class', 'axis-label')
    .attr('text-anchor', 'middle')
    .attr('transform', `translate(-36,${iH / 2}) rotate(-90)`)
    .text('F\u2093(t)');

  // Horizontal segments
  // Lead-in: from xMin to first value
  g.append('line')
    .attr('x1', xScale(xMin)).attr('x2', xScale(rangeVals[0]))
    .attr('y1', yScale(0)).attr('y2', yScale(0))
    .attr('stroke', 'var(--color-primary)').attr('stroke-width', 2.5);

  steps.forEach(({ val, left, right }, i) => {
    // Flat segment from val to next val (or xMax)
    const nextX = i + 1 < rangeVals.length ? rangeVals[i + 1] : xMax;
    g.append('line')
      .attr('x1', xScale(val)).attr('x2', xScale(nextX))
      .attr('y1', yScale(right)).attr('y2', yScale(right))
      .attr('stroke', 'var(--color-primary)').attr('stroke-width', 2.5);

    // Vertical jump at val (open circle at bottom, filled at top)
    g.append('line')
      .attr('x1', xScale(val)).attr('x2', xScale(val))
      .attr('y1', yScale(left)).attr('y2', yScale(right))
      .attr('stroke', 'var(--color-primary)').attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '3,2');

    // Open circle (limit from left) at (val, left)
    g.append('circle')
      .attr('cx', xScale(val)).attr('cy', yScale(left))
      .attr('r', 4)
      .attr('fill', 'white')
      .attr('stroke', 'var(--color-primary)').attr('stroke-width', 2);

    // Filled circle (right-continuous value) at (val, right)
    g.append('circle')
      .attr('cx', xScale(val)).attr('cy', yScale(right))
      .attr('r', 4)
      .attr('fill', 'var(--color-primary)').attr('stroke', 'none');

    // Label jump magnitude
    g.append('text')
      .attr('x', xScale(val) + 6)
      .attr('y', yScale((left + right) / 2) + 4)
      .attr('font-size', '11px')
      .attr('fill', 'var(--color-text-secondary)')
      .text((right - left).toFixed(3));
  });

  // y=1 dashed reference
  g.append('line')
    .attr('x1', 0).attr('x2', iW)
    .attr('y1', yScale(1)).attr('y2', yScale(1))
    .attr('stroke', 'var(--color-text-secondary)')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,3');
}

// ============================================================
//  Render all
// ============================================================

function renderAll() {
  updateStats();
  renderMeasureChart();
  renderRVChart();
  renderPushforwardChart();
  renderCDFChart();
}

// ============================================================
//  Event Listeners
// ============================================================

omegaSlider.addEventListener('input', () => {
  state.n = parseInt(omegaSlider.value);
  omegaVal.textContent = state.n;
  initState();
  renderAll();
});

rvTypeSelect.addEventListener('change', () => {
  state.rvType = rvTypeSelect.value;
  state.rv = buildRV(state.rvType, state.n);
  renderAll();
});

preimageCheck.addEventListener('change', () => {
  state.showPreimage = preimageCheck.checked;
  renderAll();
});

pushforwardArrowsCheck.addEventListener('change', () => {
  state.showPushforwardArrows = pushforwardArrowsCheck.checked;
  renderAll();
});

resetBtn.addEventListener('click', () => {
  state.probs = initProbs(state.n);
  state.rv = buildRV(state.rvType, state.n);
  renderAll();
});

randomBtn.addEventListener('click', () => {
  // Generate random probabilities via Dirichlet(1,...,1) — exponential trick
  const n = state.n;
  const raw = Array.from({ length: n }, () => -Math.log(Math.random() + 1e-15));
  const sum = raw.reduce((s, v) => s + v, 0);
  state.probs = raw.map(v => v / sum);
  renderAll();
});

// ============================================================
//  Initialize
// ============================================================

renderKaTeX();
initState();
renderAll();
