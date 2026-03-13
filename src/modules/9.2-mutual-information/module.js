/* ============================================================
   Module 9.2 — Mutual Information & Channel Capacity
   Full D3 v7 interactive visualization
   ============================================================ */

import * as d3 from 'd3';
import katex from 'katex';

// ─── Seeded PRNG (mulberry32) ───────────────────────────────

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20260312);

// ─── Constants & Colors ─────────────────────────────────────

const COLORS = {
  primary: '#2563eb',
  secondary: '#e97319',
  accent: '#7c3aed',
  success: '#059669',
  muted: '#94a3b8',
  hx: '#2563eb',
  hy: '#e97319',
  mutual: '#7c3aed',
};

const heatColor = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, 1]);

// ─── Information-Theoretic Computations ─────────────────────

/** Binary entropy H(p) in bits */
function hBinary(p) {
  if (p <= 0 || p >= 1) return 0;
  return -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
}

/** Safe p*log2(p) term */
function plog2p(p) {
  return p > 1e-15 ? p * Math.log2(p) : 0;
}

/** Entropy of a distribution array */
function entropy(dist) {
  let h = 0;
  for (let i = 0; i < dist.length; i++) {
    h -= plog2p(dist[i]);
  }
  return h;
}

/** Joint entropy from a joint distribution matrix */
function jointEntropy(joint) {
  let h = 0;
  for (let i = 0; i < joint.length; i++) {
    for (let j = 0; j < joint[i].length; j++) {
      h -= plog2p(joint[i][j]);
    }
  }
  return h;
}

/** Compute marginals from joint */
function marginals(joint) {
  const nX = joint.length;
  const nY = joint[0].length;
  const pX = new Array(nX).fill(0);
  const pY = new Array(nY).fill(0);
  for (let i = 0; i < nX; i++) {
    for (let j = 0; j < nY; j++) {
      pX[i] += joint[i][j];
      pY[j] += joint[i][j];
    }
  }
  return { pX, pY };
}

/** Compute joint distribution from P(X) and transition matrix P(Y|X) */
function computeJoint(pX, transition) {
  const nX = pX.length;
  const nY = transition[0].length;
  const joint = Array.from({ length: nX }, () => new Array(nY).fill(0));
  for (let i = 0; i < nX; i++) {
    for (let j = 0; j < nY; j++) {
      joint[i][j] = pX[i] * transition[i][j];
    }
  }
  return joint;
}

/** Compute all information measures from joint distribution */
function computeInfoMeasures(joint) {
  const { pX, pY } = marginals(joint);
  const hX = entropy(pX);
  const hY = entropy(pY);
  const hXY = jointEntropy(joint);
  const hXgivenY = hXY - hY;
  const hYgivenX = hXY - hX;
  const iXY = hX + hY - hXY;
  return { pX, pY, hX, hY, hXY, hXgivenY, hYgivenX, iXY };
}

// ─── Channel Presets ────────────────────────────────────────

function bscTransition(eps) {
  return [
    [1 - eps, eps],
    [eps, 1 - eps],
  ];
}

function becTransition(eps) {
  // 3 output symbols: 0, e, 1
  return [
    [1 - eps, eps, 0],
    [0, eps, 1 - eps],
  ];
}

function zChannelTransition(eps) {
  return [
    [1, 0],
    [eps, 1 - eps],
  ];
}

function customTransition(n) {
  // Uniform random transition matrix
  const T = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    let sum = 0;
    for (let j = 0; j < n; j++) {
      const v = rng() + 0.1;
      row.push(v);
      sum += v;
    }
    T.push(row.map((v) => v / sum));
  }
  return T;
}

/** Analytical capacity for BSC */
function bscCapacity(eps) {
  return 1 - hBinary(eps);
}

/** Analytical capacity for BEC */
function becCapacity(eps) {
  return 1 - eps;
}

/** Capacity for Z-channel (closed-form) */
function zChannelCapacity(eps) {
  if (eps <= 1e-12) return 1;
  if (eps >= 1 - 1e-12) return 0;
  const h = hBinary(eps);
  // C = log2(1 + (1-eps) * 2^{H(eps)/(1-eps)}) - H(eps)/(1-eps)  ... approximate via optimization
  return optimizeCapacity(zChannelTransition(eps), 2);
}

/** Brute-force capacity optimization over input distributions */
function optimizeCapacity(transition, nX, steps = 200) {
  const nY = transition[0].length;
  let bestMI = 0;
  let bestPX = null;

  if (nX === 2) {
    // 1D search
    for (let k = 0; k <= steps; k++) {
      const p = k / steps;
      const pX = [p, 1 - p];
      const joint = computeJoint(pX, transition);
      const { iXY } = computeInfoMeasures(joint);
      if (iXY > bestMI) {
        bestMI = iXY;
        bestPX = pX.slice();
      }
    }
  } else {
    // Blahut-Arimoto style iteration
    let pX = new Array(nX).fill(1 / nX);
    for (let iter = 0; iter < 100; iter++) {
      // Compute q(j) = sum_i p(x_i) * T(j|i)
      const qY = new Array(nY).fill(0);
      for (let i = 0; i < nX; i++) {
        for (let j = 0; j < nY; j++) {
          qY[j] += pX[i] * transition[i][j];
        }
      }
      // Compute c_i = exp(sum_j T(j|i) * log(T(j|i)/q(j)))
      const c = new Array(nX).fill(0);
      for (let i = 0; i < nX; i++) {
        let sum = 0;
        for (let j = 0; j < nY; j++) {
          if (transition[i][j] > 1e-15 && qY[j] > 1e-15) {
            sum += transition[i][j] * Math.log2(transition[i][j] / qY[j]);
          }
        }
        c[i] = Math.pow(2, sum);
      }
      // Update p(x_i) proportional to p(x_i) * c_i
      let total = 0;
      const newPX = new Array(nX);
      for (let i = 0; i < nX; i++) {
        newPX[i] = pX[i] * c[i];
        total += newPX[i];
      }
      for (let i = 0; i < nX; i++) newPX[i] /= total;
      pX = newPX;
    }
    bestPX = pX;
    const joint = computeJoint(pX, transition);
    bestMI = computeInfoMeasures(joint).iXY;
  }

  return bestMI;
}

/** Find capacity-achieving input distribution */
function findCapacityDist(transition, nX) {
  const nY = transition[0].length;
  let pX = new Array(nX).fill(1 / nX);

  for (let iter = 0; iter < 200; iter++) {
    const qY = new Array(nY).fill(0);
    for (let i = 0; i < nX; i++) {
      for (let j = 0; j < nY; j++) {
        qY[j] += pX[i] * transition[i][j];
      }
    }
    const c = new Array(nX).fill(0);
    for (let i = 0; i < nX; i++) {
      let sum = 0;
      for (let j = 0; j < nY; j++) {
        if (transition[i][j] > 1e-15 && qY[j] > 1e-15) {
          sum += transition[i][j] * Math.log2(transition[i][j] / qY[j]);
        }
      }
      c[i] = Math.pow(2, sum);
    }
    let total = 0;
    const newPX = new Array(nX);
    for (let i = 0; i < nX; i++) {
      newPX[i] = pX[i] * c[i];
      total += newPX[i];
    }
    for (let i = 0; i < nX; i++) newPX[i] /= total;
    pX = newPX;
  }
  return pX;
}

// ─── State ──────────────────────────────────────────────────

const state = {
  channelType: 'bsc',
  epsilon: 0.1,
  alphabetSize: 2,
  inputDist: [0.5, 0.5],
  customTransition: null,
  capacity: 0,
};

function getTransition() {
  switch (state.channelType) {
    case 'bsc':
      return bscTransition(state.epsilon);
    case 'bec':
      return becTransition(state.epsilon);
    case 'z-channel':
      return zChannelTransition(state.epsilon);
    case 'custom':
      if (!state.customTransition) {
        state.customTransition = customTransition(state.alphabetSize);
      }
      return state.customTransition;
    default:
      return bscTransition(state.epsilon);
  }
}

function getInputAlphabetSize() {
  return state.channelType === 'custom' ? state.alphabetSize : 2;
}

function getOutputAlphabetSize() {
  const T = getTransition();
  return T[0].length;
}

function getInputLabels() {
  const n = getInputAlphabetSize();
  return Array.from({ length: n }, (_, i) => String(i));
}

function getOutputLabels() {
  const T = getTransition();
  const nY = T[0].length;
  if (state.channelType === 'bec') return ['0', 'e', '1'];
  return Array.from({ length: nY }, (_, j) => String(j));
}

function normalizeInputDist() {
  const n = getInputAlphabetSize();
  if (state.inputDist.length !== n) {
    state.inputDist = new Array(n).fill(1 / n);
  }
  const s = state.inputDist.reduce((a, b) => a + b, 0);
  if (Math.abs(s - 1) > 1e-10) {
    state.inputDist = state.inputDist.map((v) => v / s);
  }
}

function computeAll() {
  normalizeInputDist();
  const transition = getTransition();
  const joint = computeJoint(state.inputDist, transition);
  const measures = computeInfoMeasures(joint);
  return { joint, transition, ...measures };
}

// ─── Tooltip ────────────────────────────────────────────────

let tooltip;
function ensureTooltip() {
  if (!tooltip) {
    tooltip = d3.select('body').append('div').attr('class', 'viz-tooltip');
  }
  return tooltip;
}

function showTooltip(event, html) {
  const tt = ensureTooltip();
  tt.html(html)
    .classed('visible', true)
    .style('left', event.pageX + 14 + 'px')
    .style('top', event.pageY - 20 + 'px');
}

function hideTooltip() {
  ensureTooltip().classed('visible', false);
}

// ─── Format Helpers ─────────────────────────────────────────

function fmtBits(v) {
  if (!isFinite(v) || isNaN(v)) return '0.000';
  return v.toFixed(3);
}

function fmtProb(v) {
  if (v < 0.001) return v.toExponential(1);
  return v.toFixed(3);
}

// ─── 1. Joint Distribution Heatmap ─────────────────────────

function drawJointHeatmap(data) {
  const el = document.getElementById('joint-plot');
  el.innerHTML = '';

  const { joint, pX, pY } = data;
  const nX = joint.length;
  const nY = joint[0].length;
  const inputLabels = getInputLabels();
  const outputLabels = getOutputLabels();

  const margin = { top: 50, right: 70, bottom: 40, left: 55 };
  const barH = 30;
  const barW = 30;
  const cellSize = Math.min(
    ((el.clientWidth || 500) - margin.left - margin.right - barW - 10) / nY,
    60
  );
  const gridW = cellSize * nY;
  const gridH = cellSize * nX;
  const W = margin.left + gridW + 10 + barW + margin.right;
  const H = margin.top + barH + 10 + gridH + margin.bottom;

  const svg = d3
    .select(el)
    .append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const gx = margin.left;
  const gy = margin.top + barH + 10;

  // Find max for color scaling
  let maxVal = 0;
  for (let i = 0; i < nX; i++) {
    for (let j = 0; j < nY; j++) {
      if (joint[i][j] > maxVal) maxVal = joint[i][j];
    }
  }
  const colorScale = d3
    .scaleSequential(d3.interpolateYlOrRd)
    .domain([0, Math.max(maxVal, 0.01)]);

  // Marginal bars on top: P(Y)
  const barYScale = d3
    .scaleLinear()
    .domain([0, Math.max(...pY, 0.01)])
    .range([barH, 0]);
  for (let j = 0; j < nY; j++) {
    svg
      .append('rect')
      .attr('class', 'marginal-bar-x')
      .attr('x', gx + j * cellSize)
      .attr('y', margin.top + barYScale(pY[j]))
      .attr('width', cellSize - 1)
      .attr('height', barH - barYScale(pY[j]))
      .on('mouseenter', (event) =>
        showTooltip(
          event,
          `<div class="tooltip-label">P(Y=${outputLabels[j]})</div><div class="tooltip-value">${fmtProb(pY[j])}</div>`
        )
      )
      .on('mouseleave', hideTooltip);
  }

  // Marginal bars on right: P(X)
  const barXScale = d3
    .scaleLinear()
    .domain([0, Math.max(...pX, 0.01)])
    .range([0, barW]);
  for (let i = 0; i < nX; i++) {
    svg
      .append('rect')
      .attr('class', 'marginal-bar-y')
      .attr('x', gx + gridW + 10)
      .attr('y', gy + i * cellSize)
      .attr('width', barXScale(pX[i]))
      .attr('height', cellSize - 1)
      .on('mouseenter', (event) =>
        showTooltip(
          event,
          `<div class="tooltip-label">P(X=${inputLabels[i]})</div><div class="tooltip-value">${fmtProb(pX[i])}</div>`
        )
      )
      .on('mouseleave', hideTooltip);
  }

  // Heatmap cells
  for (let i = 0; i < nX; i++) {
    for (let j = 0; j < nY; j++) {
      svg
        .append('rect')
        .attr('class', 'joint-cell')
        .attr('x', gx + j * cellSize)
        .attr('y', gy + i * cellSize)
        .attr('width', cellSize - 1)
        .attr('height', cellSize - 1)
        .attr('rx', 2)
        .attr('fill', colorScale(joint[i][j]))
        .on('mouseenter', (event) =>
          showTooltip(
            event,
            `<div class="tooltip-label">P(X=${inputLabels[i]}, Y=${outputLabels[j]})</div><div class="tooltip-value">${fmtProb(joint[i][j])}</div>`
          )
        )
        .on('mouseleave', hideTooltip);

      // Cell value label
      if (cellSize >= 30) {
        svg
          .append('text')
          .attr('class', 'cell-label')
          .attr('x', gx + j * cellSize + (cellSize - 1) / 2)
          .attr('y', gy + i * cellSize + (cellSize - 1) / 2 + 3)
          .text(joint[i][j] < 0.001 ? '' : joint[i][j].toFixed(2));
      }
    }
  }

  // Row labels (X)
  for (let i = 0; i < nX; i++) {
    svg
      .append('text')
      .attr('class', 'axis text')
      .attr('x', gx - 8)
      .attr('y', gy + i * cellSize + cellSize / 2 + 4)
      .attr('text-anchor', 'end')
      .style('font-size', '12px')
      .style('fill', '#475569')
      .text(`X=${inputLabels[i]}`);
  }

  // Column labels (Y)
  for (let j = 0; j < nY; j++) {
    svg
      .append('text')
      .attr('class', 'axis text')
      .attr('x', gx + j * cellSize + cellSize / 2)
      .attr('y', margin.top - 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#475569')
      .text(`Y=${outputLabels[j]}`);
  }

  // Update subtitle
  const sub = document.getElementById('joint-subtitle');
  if (sub) {
    sub.textContent = `${nX} inputs × ${nY} outputs | Max P = ${fmtProb(maxVal)}`;
  }
}

// ─── 2. Information Venn Diagram ────────────────────────────

function drawVennDiagram(data) {
  const el = document.getElementById('venn-plot');
  el.innerHTML = '';

  const { hX, hY, hXY, hXgivenY, hYgivenX, iXY } = data;

  const W = el.clientWidth || 400;
  const H = 260;

  const svg = d3
    .select(el)
    .append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(W, H) * 0.32;
  const overlap = r * 0.55; // distance between circle centers

  // Clip paths for the overlap region
  const defs = svg.append('defs');
  defs
    .append('clipPath')
    .attr('id', 'clip-left')
    .append('circle')
    .attr('cx', cx - overlap / 2)
    .attr('cy', cy)
    .attr('r', r);
  defs
    .append('clipPath')
    .attr('id', 'clip-right')
    .append('circle')
    .attr('cx', cx + overlap / 2)
    .attr('cy', cy)
    .attr('r', r);

  // H(X) circle
  svg
    .append('circle')
    .attr('class', 'venn-circle venn-hx')
    .attr('cx', cx - overlap / 2)
    .attr('cy', cy)
    .attr('r', r);

  // H(Y) circle
  svg
    .append('circle')
    .attr('class', 'venn-circle venn-hy')
    .attr('cx', cx + overlap / 2)
    .attr('cy', cy)
    .attr('r', r);

  // Overlap region (I(X;Y)) - draw with clip
  svg
    .append('circle')
    .attr('cx', cx + overlap / 2)
    .attr('cy', cy)
    .attr('r', r)
    .attr('clip-path', 'url(#clip-left)')
    .attr('fill', COLORS.mutual)
    .attr('fill-opacity', 0.3)
    .attr('stroke', 'none');

  // Labels
  const labelOffset = r * 0.5;

  // H(X|Y) - left only
  svg
    .append('text')
    .attr('class', 'venn-label')
    .attr('x', cx - overlap / 2 - labelOffset * 0.6)
    .attr('y', cy - 12)
    .text('H(X|Y)');
  svg
    .append('text')
    .attr('class', 'venn-value')
    .attr('x', cx - overlap / 2 - labelOffset * 0.6)
    .attr('y', cy + 12)
    .attr('fill', COLORS.hx)
    .text(fmtBits(hXgivenY));

  // H(Y|X) - right only
  svg
    .append('text')
    .attr('class', 'venn-label')
    .attr('x', cx + overlap / 2 + labelOffset * 0.6)
    .attr('y', cy - 12)
    .text('H(Y|X)');
  svg
    .append('text')
    .attr('class', 'venn-value')
    .attr('x', cx + overlap / 2 + labelOffset * 0.6)
    .attr('y', cy + 12)
    .attr('fill', COLORS.hy)
    .text(fmtBits(hYgivenX));

  // I(X;Y) - overlap
  svg
    .append('text')
    .attr('class', 'venn-label')
    .attr('x', cx)
    .attr('y', cy - 12)
    .text('I(X;Y)');
  svg
    .append('text')
    .attr('class', 'venn-value')
    .attr('x', cx)
    .attr('y', cy + 12)
    .attr('fill', COLORS.mutual)
    .text(fmtBits(iXY));

  // Circle labels at top
  svg
    .append('text')
    .attr('class', 'venn-label')
    .attr('x', cx - overlap / 2)
    .attr('y', cy - r - 10)
    .style('font-weight', '700')
    .attr('fill', COLORS.hx)
    .text(`H(X) = ${fmtBits(hX)}`);

  svg
    .append('text')
    .attr('class', 'venn-label')
    .attr('x', cx + overlap / 2)
    .attr('y', cy - r - 10)
    .style('font-weight', '700')
    .attr('fill', COLORS.hy)
    .text(`H(Y) = ${fmtBits(hY)}`);

  // H(X,Y) at bottom
  svg
    .append('text')
    .attr('class', 'venn-label')
    .attr('x', cx)
    .attr('y', cy + r + 22)
    .style('font-weight', '600')
    .attr('fill', '#475569')
    .text(`H(X,Y) = ${fmtBits(hXY)}`);
}

// ─── 3. Channel Diagram ────────────────────────────────────

function drawChannelDiagram(data) {
  const el = document.getElementById('channel-plot');
  el.innerHTML = '';

  const { transition } = data;
  const nX = transition.length;
  const nY = transition[0].length;
  const inputLabels = getInputLabels();
  const outputLabels = getOutputLabels();

  const W = el.clientWidth || 400;
  const H = Math.max(200, Math.max(nX, nY) * 55 + 40);

  const svg = d3
    .select(el)
    .append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const defs = svg.append('defs');
  defs
    .append('marker')
    .attr('id', 'channel-arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 22)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-4L10,0L0,4')
    .attr('fill', '#94a3b8');

  const leftX = 70;
  const rightX = W - 70;
  const inputSpacing = (H - 40) / Math.max(nX - 1, 1);
  const outputSpacing = (H - 40) / Math.max(nY - 1, 1);
  const inputStartY = nX === 1 ? H / 2 : 20;
  const outputStartY = nY === 1 ? H / 2 : 20;

  const inputPositions = Array.from(
    { length: nX },
    (_, i) => inputStartY + i * inputSpacing
  );
  const outputPositions = Array.from(
    { length: nY },
    (_, j) => outputStartY + j * outputSpacing
  );

  // Draw edges
  for (let i = 0; i < nX; i++) {
    for (let j = 0; j < nY; j++) {
      if (transition[i][j] < 1e-8) continue;
      const thickness = 1 + transition[i][j] * 5;
      const opacity = 0.3 + transition[i][j] * 0.7;

      svg
        .append('line')
        .attr('class', 'channel-edge')
        .attr('x1', leftX + 15)
        .attr('y1', inputPositions[i])
        .attr('x2', rightX - 15)
        .attr('y2', outputPositions[j])
        .attr('stroke-width', thickness)
        .attr('stroke-opacity', opacity)
        .attr('marker-end', 'url(#channel-arrow)')
        .on('mouseenter', (event) =>
          showTooltip(
            event,
            `<div class="tooltip-label">P(Y=${outputLabels[j]}|X=${inputLabels[i]})</div><div class="tooltip-value">${fmtProb(transition[i][j])}</div>`
          )
        )
        .on('mouseleave', hideTooltip);

      // Edge label at midpoint
      if (transition[i][j] > 0.02) {
        const mx = (leftX + 15 + rightX - 15) / 2;
        const my = (inputPositions[i] + outputPositions[j]) / 2;
        // Offset labels to avoid overlap
        const offsetX = (j - (nY - 1) / 2) * 8;
        svg
          .append('text')
          .attr('class', 'channel-edge-label')
          .attr('x', mx + offsetX)
          .attr('y', my - 4)
          .attr('text-anchor', 'middle')
          .text(transition[i][j].toFixed(2));
      }
    }
  }

  // Draw input nodes
  for (let i = 0; i < nX; i++) {
    svg
      .append('circle')
      .attr('class', 'channel-node channel-input')
      .attr('cx', leftX)
      .attr('cy', inputPositions[i])
      .attr('r', 14)
      .attr('fill-opacity', 0.15);

    svg
      .append('text')
      .attr('x', leftX)
      .attr('y', inputPositions[i] + 4)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', '600')
      .style('fill', COLORS.primary)
      .text(inputLabels[i]);

    // Show P(X=i)
    svg
      .append('text')
      .attr('x', leftX - 22)
      .attr('y', inputPositions[i] + 4)
      .attr('text-anchor', 'end')
      .style('font-size', '10px')
      .style('fill', '#64748b')
      .style('font-family', 'var(--font-mono)')
      .text(state.inputDist[i] !== undefined ? state.inputDist[i].toFixed(2) : '');
  }

  // Draw output nodes
  for (let j = 0; j < nY; j++) {
    svg
      .append('circle')
      .attr('class', 'channel-node channel-output')
      .attr('cx', rightX)
      .attr('cy', outputPositions[j])
      .attr('r', 14)
      .attr('fill-opacity', 0.15);

    svg
      .append('text')
      .attr('x', rightX)
      .attr('y', outputPositions[j] + 4)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', '600')
      .style('fill', COLORS.secondary)
      .text(outputLabels[j]);

    // Show P(Y=j)
    svg
      .append('text')
      .attr('x', rightX + 22)
      .attr('y', outputPositions[j] + 4)
      .attr('text-anchor', 'start')
      .style('font-size', '10px')
      .style('fill', '#64748b')
      .style('font-family', 'var(--font-mono)')
      .text(data.pY[j] !== undefined ? data.pY[j].toFixed(2) : '');
  }

  // Labels
  svg
    .append('text')
    .attr('x', leftX)
    .attr('y', 12)
    .attr('text-anchor', 'middle')
    .style('font-size', '11px')
    .style('font-weight', '600')
    .style('fill', COLORS.primary)
    .text('Input X');

  svg
    .append('text')
    .attr('x', rightX)
    .attr('y', 12)
    .attr('text-anchor', 'middle')
    .style('font-size', '11px')
    .style('font-weight', '600')
    .style('fill', COLORS.secondary)
    .text('Output Y');
}

// ─── 4. Capacity vs Noise Curve ────────────────────────────

function drawCapacityCurve() {
  const el = document.getElementById('capacity-plot');
  el.innerHTML = '';

  const W = el.clientWidth || 500;
  const H = 280;
  const margin = { top: 20, right: 20, bottom: 50, left: 55 };
  const iw = W - margin.left - margin.right;
  const ih = H - margin.top - margin.bottom;

  const svg = d3
    .select(el)
    .append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleLinear().domain([0, 0.5]).range([0, iw]);
  const yScale = d3.scaleLinear().domain([0, 1.05]).range([ih, 0]);

  // Generate curve data
  const steps = 200;
  const curves = {};

  // BSC
  curves.bsc = d3.range(0, steps + 1).map((k) => {
    const eps = (k / steps) * 0.5;
    return { eps, cap: Math.max(bscCapacity(eps), 0) };
  });

  // BEC
  curves.bec = d3.range(0, steps + 1).map((k) => {
    const eps = (k / steps) * 0.5;
    return { eps, cap: becCapacity(eps) };
  });

  // Z-channel (sampled, coarser for performance)
  curves['z-channel'] = d3.range(0, 51).map((k) => {
    const eps = (k / 50) * 0.5;
    return { eps, cap: zChannelCapacity(eps) };
  });

  const lineGen = d3
    .line()
    .x((d) => xScale(d.eps))
    .y((d) => yScale(d.cap))
    .curve(d3.curveMonotoneX);

  // Draw reference curves in background
  const channelNames = { bsc: 'BSC', bec: 'BEC', 'z-channel': 'Z-Channel' };
  const channelColors = {
    bsc: '#2563eb',
    bec: '#e97319',
    'z-channel': '#059669',
  };

  Object.keys(curves).forEach((key) => {
    const isActive = state.channelType === key;
    g.append('path')
      .datum(curves[key])
      .attr('class', isActive ? 'capacity-curve' : '')
      .attr('d', lineGen)
      .attr('fill', 'none')
      .attr('stroke', channelColors[key])
      .attr('stroke-width', isActive ? 2.5 : 1.2)
      .attr('stroke-opacity', isActive ? 1 : 0.3)
      .attr('stroke-dasharray', isActive ? 'none' : '4 3');
  });

  // Fill area under active curve
  if (state.channelType !== 'custom' && curves[state.channelType]) {
    const areaGen = d3
      .area()
      .x((d) => xScale(d.eps))
      .y0(ih)
      .y1((d) => yScale(d.cap))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(curves[state.channelType])
      .attr('class', 'capacity-fill')
      .attr('d', areaGen)
      .attr('fill', channelColors[state.channelType])
      .attr('opacity', 0.08);
  }

  // Current operating point
  let currentCap = state.capacity;
  if (state.channelType !== 'custom') {
    // Use the analytical value
    if (state.channelType === 'bsc') currentCap = bscCapacity(state.epsilon);
    else if (state.channelType === 'bec') currentCap = becCapacity(state.epsilon);
    else if (state.channelType === 'z-channel')
      currentCap = zChannelCapacity(state.epsilon);
  }

  // Shannon limit line
  g.append('line')
    .attr('class', 'shannon-limit')
    .attr('x1', xScale(state.epsilon))
    .attr('x2', xScale(state.epsilon))
    .attr('y1', 0)
    .attr('y2', ih);

  // Current marker
  g.append('circle')
    .attr('class', 'current-marker')
    .attr('cx', xScale(state.epsilon))
    .attr('cy', yScale(Math.max(currentCap, 0)))
    .attr('r', 7)
    .on('mouseenter', (event) =>
      showTooltip(
        event,
        `<div class="tooltip-label">Current Operating Point</div><div class="tooltip-value">C = ${fmtBits(currentCap)} bits, ε = ${state.epsilon.toFixed(3)}</div>`
      )
    )
    .on('mouseleave', hideTooltip);

  // Axes
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(xScale).ticks(10).tickFormat(d3.format('.2f')));

  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(6).tickFormat(d3.format('.2f')));

  // Axis labels
  g.append('text')
    .attr('x', iw / 2)
    .attr('y', ih + 40)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('fill', '#475569')
    .text('Noise Parameter ε');

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -ih / 2)
    .attr('y', -42)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('fill', '#475569')
    .text('Channel Capacity (bits)');

  // Legend
  const legendG = g
    .append('g')
    .attr('transform', `translate(${iw - 110}, 5)`);
  let ly = 0;
  Object.keys(channelNames).forEach((key) => {
    legendG
      .append('line')
      .attr('x1', 0)
      .attr('x2', 16)
      .attr('y1', ly)
      .attr('y2', ly)
      .attr('stroke', channelColors[key])
      .attr('stroke-width', state.channelType === key ? 2.5 : 1.2)
      .attr('stroke-dasharray', state.channelType === key ? 'none' : '4 3');
    legendG
      .append('text')
      .attr('x', 20)
      .attr('y', ly + 4)
      .style('font-size', '10px')
      .style('fill', '#475569')
      .text(channelNames[key]);
    ly += 16;
  });
}

// ─── Stats Grid ─────────────────────────────────────────────

function updateStats(data) {
  const { hX, hY, hXY, hXgivenY, hYgivenX, iXY } = data;

  const statsEl = document.getElementById('stats');
  statsEl.innerHTML = '';

  const stats = [
    { label: 'H(X)', value: fmtBits(hX), color: COLORS.hx },
    { label: 'H(Y)', value: fmtBits(hY), color: COLORS.hy },
    { label: 'H(X,Y)', value: fmtBits(hXY), color: '#475569' },
    { label: 'H(X|Y)', value: fmtBits(hXgivenY), color: COLORS.hx },
    { label: 'H(Y|X)', value: fmtBits(hYgivenX), color: COLORS.hy },
    { label: 'I(X;Y)', value: fmtBits(iXY), color: COLORS.mutual },
    { label: 'Capacity C', value: fmtBits(state.capacity), color: COLORS.accent },
  ];

  stats.forEach((s) => {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `<div class="stat-value" style="color:${s.color}">${s.value}</div><div class="stat-label">${s.label}</div>`;
    statsEl.appendChild(card);
  });
}

// ─── Controls ───────────────────────────────────────────────

function buildControls() {
  buildChannelSelect();
  buildNoiseSlider();
  buildInputDistSliders();
  buildAlphabetSize();
  wireButtons();
}

function buildChannelSelect() {
  const el = document.getElementById('channel-select');
  el.innerHTML = '';

  const label = document.createElement('label');
  label.className = 'control-section-title';
  label.textContent = 'Channel Type';
  label.setAttribute('for', 'channel-type');
  el.appendChild(label);

  const select = document.createElement('select');
  select.id = 'channel-type';
  select.className = 'form-select';
  select.style.cssText = 'width:100%;padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;margin-top:4px;';

  const options = [
    { value: 'bsc', text: 'Binary Symmetric Channel' },
    { value: 'bec', text: 'Binary Erasure Channel' },
    { value: 'z-channel', text: 'Z-Channel' },
    { value: 'custom', text: 'Custom NxN' },
  ];

  options.forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.text;
    if (o.value === state.channelType) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => {
    state.channelType = select.value;
    state.customTransition = null;
    if (state.channelType !== 'custom') {
      state.inputDist = [0.5, 0.5];
    } else {
      const n = state.alphabetSize;
      state.customTransition = customTransition(n);
      state.inputDist = new Array(n).fill(1 / n);
    }
    computeCapacity();
    buildNoiseSlider();
    buildInputDistSliders();
    buildAlphabetSize();
    updateAll();
  });

  el.appendChild(select);
}

function buildNoiseSlider() {
  const el = document.getElementById('noise-slider');
  el.innerHTML = '';

  if (state.channelType === 'custom') {
    el.style.display = 'none';
    return;
  }
  el.style.display = '';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'margin-top:8px;';

  const labelRow = document.createElement('div');
  labelRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;';

  const label = document.createElement('span');
  label.className = 'control-section-title';
  label.textContent = 'Noise ε';

  const valSpan = document.createElement('span');
  valSpan.id = 'noise-val';
  valSpan.style.cssText = 'font-family:var(--font-mono);font-size:14px;color:var(--color-primary);font-weight:600;';
  valSpan.textContent = state.epsilon.toFixed(3);

  labelRow.appendChild(label);
  labelRow.appendChild(valSpan);
  wrapper.appendChild(labelRow);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.id = 'epsilon-slider';
  slider.min = '0';
  slider.max = '500';
  slider.value = String(Math.round(state.epsilon * 1000));
  slider.style.cssText = 'width:100%;';

  slider.addEventListener('input', () => {
    state.epsilon = parseInt(slider.value, 10) / 1000;
    valSpan.textContent = state.epsilon.toFixed(3);
    computeCapacity();
    updateAll();
  });

  wrapper.appendChild(slider);
  el.appendChild(wrapper);
}

function buildInputDistSliders() {
  const el = document.getElementById('input-dist');
  el.innerHTML = '';

  const nX = getInputAlphabetSize();
  normalizeInputDist();

  const title = document.createElement('div');
  title.className = 'control-section-title';
  title.textContent = 'Input Distribution P(X)';
  title.style.marginTop = '8px';
  el.appendChild(title);

  const sliders = [];
  for (let i = 0; i < nX; i++) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:4px;';

    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:12px;min-width:30px;font-family:var(--font-mono);';
    lbl.textContent = `P(${i})`;
    row.appendChild(lbl);

    const sl = document.createElement('input');
    sl.type = 'range';
    sl.min = '0';
    sl.max = '1000';
    sl.value = String(Math.round(state.inputDist[i] * 1000));
    sl.style.cssText = 'flex:1;';
    sl.dataset.idx = String(i);
    row.appendChild(sl);

    const val = document.createElement('span');
    val.style.cssText = 'font-size:12px;min-width:40px;text-align:right;font-family:var(--font-mono);';
    val.textContent = state.inputDist[i].toFixed(3);
    row.appendChild(val);

    el.appendChild(row);
    sliders.push({ sl, val, idx: i });
  }

  // Wire up linked sliders: adjusting one rescales the others
  sliders.forEach((item) => {
    item.sl.addEventListener('input', () => {
      const idx = item.idx;
      const newVal = parseInt(item.sl.value, 10) / 1000;

      // Set this value, then normalize remaining ones
      state.inputDist[idx] = newVal;
      const remaining = 1 - newVal;
      const othersSum = state.inputDist.reduce(
        (s, v, j) => (j === idx ? s : s + v),
        0
      );

      if (othersSum > 1e-10) {
        const scale = remaining / othersSum;
        for (let j = 0; j < nX; j++) {
          if (j !== idx) state.inputDist[j] *= scale;
        }
      } else {
        // Distribute equally among others
        for (let j = 0; j < nX; j++) {
          if (j !== idx) state.inputDist[j] = remaining / (nX - 1);
        }
      }

      // Clamp
      for (let j = 0; j < nX; j++) {
        state.inputDist[j] = Math.max(0, Math.min(1, state.inputDist[j]));
      }

      // Normalize
      const s = state.inputDist.reduce((a, b) => a + b, 0);
      for (let j = 0; j < nX; j++) state.inputDist[j] /= s;

      // Update UI
      sliders.forEach((si) => {
        si.sl.value = String(Math.round(state.inputDist[si.idx] * 1000));
        si.val.textContent = state.inputDist[si.idx].toFixed(3);
      });

      updateAll();
    });
  });
}

function buildAlphabetSize() {
  const el = document.getElementById('alphabet-size');
  el.innerHTML = '';

  if (state.channelType !== 'custom') {
    el.style.display = 'none';
    return;
  }
  el.style.display = '';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'margin-top:8px;';

  const labelRow = document.createElement('div');
  labelRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;';

  const label = document.createElement('span');
  label.className = 'control-section-title';
  label.textContent = 'Alphabet Size';

  const valSpan = document.createElement('span');
  valSpan.style.cssText = 'font-family:var(--font-mono);font-size:14px;color:var(--color-primary);font-weight:600;';
  valSpan.textContent = String(state.alphabetSize);

  labelRow.appendChild(label);
  labelRow.appendChild(valSpan);
  wrapper.appendChild(labelRow);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '2';
  slider.max = '4';
  slider.value = String(state.alphabetSize);
  slider.style.cssText = 'width:100%;';

  slider.addEventListener('input', () => {
    state.alphabetSize = parseInt(slider.value, 10);
    valSpan.textContent = String(state.alphabetSize);
    state.customTransition = customTransition(state.alphabetSize);
    state.inputDist = new Array(state.alphabetSize).fill(1 / state.alphabetSize);
    computeCapacity();
    buildInputDistSliders();
    updateAll();
  });

  wrapper.appendChild(slider);
  el.appendChild(wrapper);
}

function wireButtons() {
  const optimizeBtn = document.getElementById('optimize-btn');
  const resetBtn = document.getElementById('reset-btn');

  optimizeBtn.addEventListener('click', () => {
    const transition = getTransition();
    const nX = getInputAlphabetSize();
    const optDist = findCapacityDist(transition, nX);
    state.inputDist = optDist;
    computeCapacity();
    buildInputDistSliders();
    updateAll();
  });

  resetBtn.addEventListener('click', () => {
    state.channelType = 'bsc';
    state.epsilon = 0.1;
    state.alphabetSize = 2;
    state.inputDist = [0.5, 0.5];
    state.customTransition = null;
    computeCapacity();
    buildControls();
    updateAll();
  });
}

// ─── Capacity Computation ───────────────────────────────────

function computeCapacity() {
  const transition = getTransition();
  const nX = getInputAlphabetSize();

  if (state.channelType === 'bsc') {
    state.capacity = Math.max(bscCapacity(state.epsilon), 0);
  } else if (state.channelType === 'bec') {
    state.capacity = becCapacity(state.epsilon);
  } else {
    state.capacity = optimizeCapacity(transition, nX);
  }
}

// ─── Info Panel with KaTeX ──────────────────────────────────

function renderInfoPanel() {
  const el = document.getElementById('info');
  el.innerHTML = '';

  const sections = [
    {
      title: 'Mutual Information',
      formula: String.raw`I(X;Y) = H(X) + H(Y) - H(X,Y) = \sum_{x,y} p(x,y) \log_2 \frac{p(x,y)}{p(x)\,p(y)}`,
      text: 'Mutual information measures how much knowing Y reduces uncertainty about X (and vice versa). It is symmetric: I(X;Y) = I(Y;X).',
    },
    {
      title: 'Channel Capacity Theorem',
      formula: String.raw`C = \max_{p(x)} I(X;Y)`,
      text: 'Channel capacity is the maximum mutual information over all possible input distributions. Shannon proved that reliable communication is possible at any rate R < C.',
    },
    {
      title: 'Data Processing Inequality',
      formula: String.raw`X \to Y \to Z \implies I(X;Z) \leq I(X;Y)`,
      text: 'Processing data cannot increase information. If X, Y, Z form a Markov chain, then mutual information can only decrease along the chain.',
    },
    {
      title: "Fano's Inequality",
      formula: String.raw`H(X|Y) \leq H(P_e) + P_e \log_2(|\mathcal{X}| - 1)`,
      text: "Fano's inequality relates the probability of error in estimating X from Y to the conditional entropy H(X|Y). It provides a lower bound on error probability.",
    },
  ];

  sections.forEach((s) => {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = s.title;
    details.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'detail-body';

    const formulaDiv = document.createElement('div');
    formulaDiv.style.cssText = 'margin:8px 0;overflow-x:auto;';
    try {
      katex.render(s.formula, formulaDiv, {
        displayMode: true,
        throwOnError: false,
      });
    } catch (_) {
      formulaDiv.textContent = s.formula;
    }
    body.appendChild(formulaDiv);

    const textP = document.createElement('p');
    textP.style.cssText = 'font-size:14px;color:#475569;line-height:1.6;margin:0;';
    textP.textContent = s.text;
    body.appendChild(textP);

    details.appendChild(body);
    el.appendChild(details);
  });

  // Open first section by default
  if (el.querySelector('details')) {
    el.querySelector('details').setAttribute('open', '');
  }
}

// ─── Master Update ──────────────────────────────────────────

function updateAll() {
  const data = computeAll();
  drawJointHeatmap(data);
  drawVennDiagram(data);
  drawChannelDiagram(data);
  drawCapacityCurve();
  updateStats(data);
}

// ─── Initialization ─────────────────────────────────────────

function init() {
  computeCapacity();
  buildControls();
  renderInfoPanel();
  updateAll();
}

init();
