// ============================================================
//  Module 4.1 — Conditional Expectation as Projection
//  Visualize E[X|G] on finite sample spaces.
// ============================================================

import * as d3 from 'd3';
import katex from 'katex';
import '../../lib/copy-code.js';
import '../../lib/param-tooltips.js';

// ============================================================
//  Seeded PRNG (xoshiro128** variant)
// ============================================================

function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rng = mulberry32(42);

// ============================================================
//  State
// ============================================================

const state = {
  n: 6,                       // |Omega|
  xDist: 'uniform',           // distribution type
  X: [],                      // X(omega_i) values
  partition: [],              // array of arrays: partition of {0,...,n-1}
  sigmaType: 'oddeven',       // current sigma-algebra type
  showTower: false,
  showL2: true,
  seed: 42,
  customPartition: null,      // user-editable partition
  selectedAtomIdx: -1,        // for custom merge/split
};

// ============================================================
//  DOM references
// ============================================================

const omegaSlider = document.getElementById('omega-size');
const omegaVal = document.getElementById('omega-size-val');
const xDistSelect = document.getElementById('x-distribution');
const sigmaSelect = document.getElementById('sigma-algebra');
const toggleTower = document.getElementById('toggle-tower');
const toggleL2 = document.getElementById('toggle-l2');
const resetBtn = document.getElementById('reset-btn');
const resampleBtn = document.getElementById('resample-btn');
const customPartitionControls = document.getElementById('custom-partition-controls');
const customAtomButtons = document.getElementById('custom-atom-buttons');

const projectionChart = document.getElementById('projection-chart');
const partitionChart = document.getElementById('partition-chart');
const l2Chart = document.getElementById('l2-chart');

const statEX = document.getElementById('stat-ex');
const statEXG = document.getElementById('stat-exg');
const statL2 = document.getElementById('stat-l2');
const statVarDecomp = document.getElementById('stat-vardecomp');

// ============================================================
//  Generate X values
// ============================================================

function generateX(n, dist) {
  switch (dist) {
    case 'linear':
      return Array.from({ length: n }, (_, i) => i + 1);
    case 'quadratic':
      return Array.from({ length: n }, (_, i) => (i + 1) * (i + 1));
    case 'custom':
      // Keep existing X if length matches, else generate random
      if (state.X.length === n) return state.X.slice();
      // fall through
    case 'uniform':
    default:
      return Array.from({ length: n }, () => Math.round(rng() * 9 * 10) / 10 + 0.5);
  }
}

// ============================================================
//  Build partition from sigma-algebra type
// ============================================================

function buildPartition(n, type) {
  switch (type) {
    case 'trivial':
      // Single atom = entire Omega
      return [Array.from({ length: n }, (_, i) => i)];

    case 'pairs': {
      // Pair up consecutive elements
      const parts = [];
      for (let i = 0; i < n; i += 2) {
        if (i + 1 < n) {
          parts.push([i, i + 1]);
        } else {
          parts.push([i]);
        }
      }
      return parts;
    }

    case 'oddeven': {
      const odd = [];
      const even = [];
      for (let i = 0; i < n; i++) {
        if ((i + 1) % 2 === 1) odd.push(i);
        else even.push(i);
      }
      const parts = [odd];
      if (even.length > 0) parts.push(even);
      return parts;
    }

    case 'full':
      // Each element is its own atom
      return Array.from({ length: n }, (_, i) => [i]);

    case 'custom':
      if (state.customPartition && state.customPartition.flat().length === n) {
        return state.customPartition;
      }
      // Initialize custom as pairs
      return buildPartition(n, 'pairs');

    default:
      return buildPartition(n, 'trivial');
  }
}

// ============================================================
//  Compute conditional expectation
// ============================================================

function condExpectation(X, partition) {
  const n = X.length;
  const EXG = new Array(n).fill(0);
  for (const atom of partition) {
    const mean = atom.reduce((s, i) => s + X[i], 0) / atom.length;
    for (const i of atom) {
      EXG[i] = mean;
    }
  }
  return EXG;
}

// ============================================================
//  Compute statistics
// ============================================================

function mean(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function variance(arr) {
  const m = mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
}

function l2NormSq(a, b) {
  // ||a - b||^2 = (1/n) sum (a_i - b_i)^2  (uniform probability)
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return s / a.length;
}

// ============================================================
//  Build a tower sub-partition (coarser than current)
// ============================================================

function buildTowerPartition(partition) {
  // Merge pairs of atoms to get H subset G
  if (partition.length <= 1) return [partition.flat()];
  const merged = [];
  for (let i = 0; i < partition.length; i += 2) {
    if (i + 1 < partition.length) {
      merged.push([...partition[i], ...partition[i + 1]]);
    } else {
      merged.push([...partition[i]]);
    }
  }
  return merged;
}

// ============================================================
//  Render KaTeX formulas
// ============================================================

function renderKaTeX() {
  const targets = [
    {
      id: 'info-defining-property',
      tex: String.raw`\forall A \in \mathcal{G}: \quad \mathbb{E}[X \cdot \mathbf{1}_A] = \mathbb{E}[\mathbb{E}[X|\mathcal{G}] \cdot \mathbf{1}_A]`,
    },
    {
      id: 'info-tower-law',
      tex: String.raw`\mathcal{H} \subseteq \mathcal{G} \subseteq \mathcal{F} \implies \mathbb{E}\!\bigl[\mathbb{E}[X|\mathcal{G}]\,\big|\,\mathcal{H}\bigr] = \mathbb{E}[X|\mathcal{H}]`,
    },
    {
      id: 'info-l2-optimality',
      tex: String.raw`\mathbb{E}[X|\mathcal{G}] = \arg\min_{Y \text{ is } \mathcal{G}\text{-measurable}} \mathbb{E}\!\bigl[(X - Y)^2\bigr]`,
    },
    {
      id: 'info-var-decomp',
      tex: String.raw`\mathrm{Var}(X) = \mathbb{E}\!\bigl[\mathrm{Var}(X|\mathcal{G})\bigr] + \mathrm{Var}\!\bigl(\mathbb{E}[X|\mathcal{G}]\bigr)`,
    },
  ];

  for (const { id, tex } of targets) {
    const el = document.getElementById(id);
    if (el) {
      katex.render(tex, el, { displayMode: true, throwOnError: false });
    }
  }
}

// ============================================================
//  Color palette for atoms
// ============================================================

const atomColors = [
  '#2563eb', '#e97319', '#059669', '#7c3aed',
  '#db2777', '#0891b2', '#ca8a04', '#64748b',
];

function atomColor(i) {
  return atomColors[i % atomColors.length];
}

// ============================================================
//  Projection Chart (Main Visualization)
// ============================================================

function renderProjectionChart() {
  const { X, partition, n, showTower } = state;
  const EXG = condExpectation(X, partition);

  projectionChart.innerHTML = '';

  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const width = 700;
  const height = 340;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3.select(projectionChart)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Scales
  const xScale = d3.scaleBand()
    .domain(Array.from({ length: n }, (_, i) => i))
    .range([0, innerW])
    .padding(0.15);

  const allVals = [...X, ...EXG];
  const yMax = Math.max(d3.max(allVals) * 1.15, 1);
  const yScale = d3.scaleLinear()
    .domain([0, yMax])
    .range([innerH, 0]);

  // Axes
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).tickFormat(i => `\u03C9${i + 1}`));

  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(5));

  // Atom background shading
  partition.forEach((atom, ai) => {
    const xs = atom.map(i => xScale(i));
    const xMin = d3.min(xs) - xScale.step() * xScale.paddingOuter();
    const xMax = d3.max(xs) + xScale.bandwidth() + xScale.step() * xScale.paddingOuter();
    g.append('rect')
      .attr('x', xMin)
      .attr('y', 0)
      .attr('width', xMax - xMin)
      .attr('height', innerH)
      .attr('fill', atomColor(ai))
      .attr('fill-opacity', 0.06)
      .attr('rx', 4);
  });

  // X bars
  const barWidth = xScale.bandwidth() / 2;

  g.selectAll('.bar-x')
    .data(X)
    .join('rect')
    .attr('class', 'bar-x')
    .attr('x', (_, i) => xScale(i))
    .attr('width', barWidth)
    .attr('y', innerH)
    .attr('height', 0)
    .transition()
    .duration(500)
    .attr('y', d => yScale(d))
    .attr('height', d => innerH - yScale(d));

  // E[X|G] bars
  g.selectAll('.bar-cond-exp')
    .data(EXG)
    .join('rect')
    .attr('class', 'bar-cond-exp')
    .attr('x', (_, i) => xScale(i) + barWidth)
    .attr('width', barWidth)
    .attr('y', innerH)
    .attr('height', 0)
    .transition()
    .duration(500)
    .delay(100)
    .attr('y', d => yScale(d))
    .attr('height', d => innerH - yScale(d));

  // Step function line for E[X|G]
  const stepData = [];
  for (const atom of partition) {
    const sorted = [...atom].sort((a, b) => a - b);
    const val = EXG[sorted[0]];
    const x1 = xScale(sorted[0]);
    const x2 = xScale(sorted[sorted.length - 1]) + xScale.bandwidth();
    stepData.push({ x1, x2, y: yScale(val) });
  }

  g.selectAll('.step-line')
    .data(stepData)
    .join('line')
    .attr('class', 'step-line')
    .attr('x1', d => d.x1)
    .attr('x2', d => d.x2)
    .attr('y1', d => d.y)
    .attr('y2', d => d.y)
    .style('opacity', 0)
    .transition()
    .duration(500)
    .delay(300)
    .style('opacity', 1);

  // Tower property: show E[E[X|G]|H] for H coarser than G
  if (showTower && partition.length > 1) {
    const H = buildTowerPartition(partition);
    const EEXG_H = condExpectation(EXG, H);
    const EX_H = condExpectation(X, H);

    // Draw tower step lines
    for (const atom of H) {
      const sorted = [...atom].sort((a, b) => a - b);
      const val = EEXG_H[sorted[0]];
      const x1 = xScale(sorted[0]);
      const x2 = xScale(sorted[sorted.length - 1]) + xScale.bandwidth();
      g.append('line')
        .attr('class', 'tower-line')
        .attr('x1', x1)
        .attr('x2', x2)
        .attr('y1', yScale(val))
        .attr('y2', yScale(val))
        .style('opacity', 0)
        .transition()
        .duration(500)
        .delay(500)
        .style('opacity', 1);
    }

    // Tower annotation
    g.append('text')
      .attr('x', innerW - 5)
      .attr('y', 15)
      .attr('text-anchor', 'end')
      .attr('font-family', 'var(--font-heading)')
      .attr('font-size', 10)
      .attr('fill', '#7c3aed')
      .text('Purple dashed = E[E[X|G]|H] = E[X|H]');
  }

  // Legend
  const legend = svg.append('g')
    .attr('transform', `translate(${margin.left + 10}, ${height - 12})`);

  const legendItems = [
    { label: 'X(\u03C9)', color: '#2563eb' },
    { label: 'E[X|G]', color: '#e97319' },
  ];
  if (showTower && partition.length > 1) {
    legendItems.push({ label: 'E[X|H]', color: '#7c3aed' });
  }

  legendItems.forEach((d, i) => {
    const lg = legend.append('g').attr('transform', `translate(${i * 100}, 0)`);
    lg.append('rect')
      .attr('width', 12).attr('height', 12).attr('rx', 2)
      .attr('fill', d.color).attr('fill-opacity', 0.7);
    lg.append('text')
      .attr('x', 16).attr('y', 10)
      .attr('font-family', 'var(--font-heading)')
      .attr('font-size', 11)
      .attr('fill', '#555')
      .text(d.label);
  });
}

// ============================================================
//  Partition Chart
// ============================================================

function renderPartitionChart() {
  const { X, partition, n } = state;
  const EXG = condExpectation(X, partition);

  partitionChart.innerHTML = '';

  const width = 420;
  const height = 280;
  const margin = { top: 15, right: 15, bottom: 15, left: 15 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3.select(partitionChart)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Layout atoms as horizontal blocks
  const totalElements = n;
  const gap = 6;
  const totalGaps = (partition.length - 1) * gap;
  const availW = innerW - totalGaps;

  let xOffset = 0;
  partition.forEach((atom, ai) => {
    const atomW = (atom.length / totalElements) * availW;
    const color = atomColor(ai);
    const condVal = EXG[atom[0]];

    // Atom rectangle
    g.append('rect')
      .attr('class', 'atom-rect')
      .attr('x', xOffset)
      .attr('y', 0)
      .attr('width', atomW)
      .attr('height', innerH)
      .attr('fill', color)
      .attr('fill-opacity', 0.15)
      .attr('stroke', color)
      .attr('stroke-width', 2)
      .on('click', () => {
        if (state.sigmaType === 'custom') {
          handleCustomAtomClick(ai);
        }
      });

    // Atom label: elements
    const elemStr = atom.map(i => `\u03C9${i + 1}`).join(', ');
    g.append('text')
      .attr('class', 'atom-label')
      .attr('x', xOffset + atomW / 2)
      .attr('y', 25)
      .attr('fill', color)
      .text(`{${elemStr}}`);

    // Element values inside
    atom.forEach((idx, j) => {
      const ex = xOffset + (j + 0.5) * (atomW / atom.length);
      const ey = innerH / 2 - 8;

      g.append('text')
        .attr('class', 'element-in-atom')
        .attr('x', ex)
        .attr('y', ey)
        .text(`X=${X[idx].toFixed(1)}`);

      g.append('text')
        .attr('class', 'element-in-atom')
        .attr('x', ex)
        .attr('y', ey + 18)
        .attr('font-size', 10)
        .attr('fill', '#e97319')
        .text(`E=${condVal.toFixed(1)}`);
    });

    // Conditional expectation value label at bottom
    g.append('text')
      .attr('class', 'atom-value-label')
      .attr('x', xOffset + atomW / 2)
      .attr('y', innerH - 10)
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .attr('fill', color)
      .text(`E[X|G] = ${condVal.toFixed(2)}`);

    xOffset += atomW + gap;
  });

  // Title annotation about number of atoms
  g.append('text')
    .attr('x', innerW / 2)
    .attr('y', innerH + 12)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'var(--font-heading)')
    .attr('font-size', 10)
    .attr('fill', '#555')
    .text(`${partition.length} atom${partition.length !== 1 ? 's' : ''} \u2014 ${partition.length === 1 ? 'coarsest (just the mean)' : partition.length === n ? 'finest (E[X|G]=X)' : 'intermediate resolution'}`);
}

// ============================================================
//  L2 Distance Chart
// ============================================================

function renderL2Chart() {
  const { X, partition, n, showL2 } = state;

  l2Chart.innerHTML = '';

  if (!showL2) {
    document.getElementById('l2-panel').style.display = 'none';
    return;
  }
  document.getElementById('l2-panel').style.display = '';

  const EXG = condExpectation(X, partition);
  const optimalL2 = l2NormSq(X, EXG);

  const width = 420;
  const height = 280;
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3.select(l2Chart)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Generate sample G-measurable functions Y by perturbing E[X|G]
  // Y must be constant on each atom of partition
  const samples = [];
  const sampleRng = mulberry32(state.seed + 7);

  // Add the optimal point
  samples.push({ Y: EXG.slice(), l2: optimalL2, label: 'E[X|G]', optimal: true });

  // Generate random G-measurable functions
  for (let s = 0; s < 60; s++) {
    const Y = new Array(n).fill(0);
    for (const atom of partition) {
      const val = EXG[atom[0]] + (sampleRng() - 0.5) * d3.max(X) * 1.5;
      for (const i of atom) Y[i] = val;
    }
    const l2 = l2NormSq(X, Y);
    samples.push({ Y, l2, label: '', optimal: false });
  }

  // For scatter plot: x = "perturbation magnitude" (distance from E[X|G]),
  // y = L2 distance from X
  for (const s of samples) {
    s.perturbation = l2NormSq(s.Y, EXG);
  }

  // Scales
  const xMax = d3.max(samples, d => d.perturbation) * 1.1 || 1;
  const yMax = d3.max(samples, d => d.l2) * 1.1 || 1;

  const xScale = d3.scaleLinear().domain([0, xMax]).range([0, innerW]);
  const yScale = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]);

  // Axes
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(5));

  g.append('text')
    .attr('x', innerW / 2)
    .attr('y', innerH + 35)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'var(--font-heading)')
    .attr('font-size', 10)
    .attr('fill', '#555')
    .text('\u2016Y \u2212 E[X|G]\u2016\u00B2');

  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(5));

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerH / 2)
    .attr('y', -38)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'var(--font-heading)')
    .attr('font-size', 10)
    .attr('fill', '#555')
    .text('\u2016X \u2212 Y\u2016\u00B2');

  // Theoretical curve: ||X - Y||^2 = ||X - E[X|G]||^2 + ||Y - E[X|G]||^2
  // by Pythagorean theorem (orthogonality)
  const curveData = d3.range(0, xMax, xMax / 100).map(p => ({
    x: p,
    y: optimalL2 + p, // Pythagorean theorem
  }));

  g.append('path')
    .datum(curveData)
    .attr('fill', 'none')
    .attr('stroke', '#059669')
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '4 3')
    .attr('d', d3.line()
      .x(d => xScale(d.x))
      .y(d => yScale(d.y))
    );

  // Orthogonality annotation
  g.append('text')
    .attr('x', innerW - 5)
    .attr('y', 12)
    .attr('text-anchor', 'end')
    .attr('font-family', 'var(--font-heading)')
    .attr('font-size', 9)
    .attr('fill', '#059669')
    .text('Pythagorean: \u2016X\u2212Y\u2016\u00B2 = \u2016X\u2212E[X|G]\u2016\u00B2 + \u2016Y\u2212E[X|G]\u2016\u00B2');

  // Scatter dots
  g.selectAll('.l2-dot')
    .data(samples)
    .join('circle')
    .attr('class', d => 'l2-dot' + (d.optimal ? ' optimal' : ''))
    .attr('cx', d => xScale(d.perturbation))
    .attr('cy', d => yScale(d.l2))
    .attr('r', d => d.optimal ? 6 : 3);

  // Label the optimal point
  const optPt = samples[0];
  g.append('text')
    .attr('x', xScale(optPt.perturbation) + 10)
    .attr('y', yScale(optPt.l2) - 8)
    .attr('font-family', 'var(--font-heading)')
    .attr('font-size', 11)
    .attr('font-weight', 600)
    .attr('fill', '#e97319')
    .text(`E[X|G]  \u2016\u00B7\u2016\u00B2 = ${optimalL2.toFixed(3)}`);
}

// ============================================================
//  Custom partition interaction
// ============================================================

function handleCustomAtomClick(atomIdx) {
  if (state.selectedAtomIdx === -1) {
    // First click: select this atom
    state.selectedAtomIdx = atomIdx;
    renderCustomAtomButtons();
  } else if (state.selectedAtomIdx === atomIdx) {
    // Click same atom: try to split it
    const atom = state.customPartition[atomIdx];
    if (atom.length > 1) {
      const mid = Math.ceil(atom.length / 2);
      const a1 = atom.slice(0, mid);
      const a2 = atom.slice(mid);
      state.customPartition.splice(atomIdx, 1, a1, a2);
    }
    state.selectedAtomIdx = -1;
    state.partition = state.customPartition;
    update();
  } else {
    // Click different atom: merge the two
    const merged = [...state.customPartition[state.selectedAtomIdx], ...state.customPartition[atomIdx]];
    merged.sort((a, b) => a - b);
    // Remove both, insert merged
    const minIdx = Math.min(state.selectedAtomIdx, atomIdx);
    const maxIdx = Math.max(state.selectedAtomIdx, atomIdx);
    state.customPartition.splice(maxIdx, 1);
    state.customPartition.splice(minIdx, 1, merged);
    state.selectedAtomIdx = -1;
    state.partition = state.customPartition;
    update();
  }
}

function renderCustomAtomButtons() {
  customAtomButtons.innerHTML = '';
  if (!state.customPartition) return;

  state.customPartition.forEach((atom, ai) => {
    const btn = document.createElement('button');
    btn.className = 'atom-btn' + (ai === state.selectedAtomIdx ? ' selected' : '');
    btn.textContent = '{' + atom.map(i => `\u03C9${i + 1}`).join(',') + '}';
    btn.style.borderColor = atomColor(ai);
    btn.addEventListener('click', () => handleCustomAtomClick(ai));
    customAtomButtons.appendChild(btn);
  });
}

// ============================================================
//  Update stats
// ============================================================

function updateStats() {
  const { X, partition, n } = state;
  const EXG = condExpectation(X, partition);
  const ex = mean(X);
  const l2 = l2NormSq(X, EXG);
  const varX = variance(X);

  // Variance decomposition
  // E[Var(X|G)] = average within-atom variance
  let eVarXG = 0;
  for (const atom of partition) {
    const atomVals = atom.map(i => X[i]);
    eVarXG += (atom.length / n) * variance(atomVals);
  }
  // Var(E[X|G])
  const varEXG = variance(EXG);

  statEX.textContent = ex.toFixed(2);

  // Show unique E[X|G] values
  const uniqueVals = [...new Set(EXG.map(v => v.toFixed(2)))];
  statEXG.textContent = uniqueVals.join(', ');
  statEXG.style.fontSize = uniqueVals.length > 4 ? '0.7rem' : '';

  statL2.textContent = l2.toFixed(3);

  // Variance decomposition: show check
  statVarDecomp.innerHTML =
    `<span style="font-size:0.7rem">${eVarXG.toFixed(2)} + ${varEXG.toFixed(2)} = ${(eVarXG + varEXG).toFixed(2)}</span>` +
    `<br><span style="font-size:0.65rem;color:#555">Var(X) = ${varX.toFixed(2)}</span>`;
}

// ============================================================
//  Master update
// ============================================================

function update() {
  renderProjectionChart();
  renderPartitionChart();
  renderL2Chart();
  updateStats();

  if (state.sigmaType === 'custom') {
    customPartitionControls.style.display = '';
    renderCustomAtomButtons();
  } else {
    customPartitionControls.style.display = 'none';
  }
}

function rebuild() {
  const n = state.n;
  rng = mulberry32(state.seed);
  state.X = generateX(n, state.xDist);
  state.partition = buildPartition(n, state.sigmaType);
  if (state.sigmaType === 'custom') {
    state.customPartition = state.partition.map(a => [...a]);
  }
  state.selectedAtomIdx = -1;
  update();
}

// ============================================================
//  Event Listeners
// ============================================================

omegaSlider.addEventListener('input', () => {
  state.n = parseInt(omegaSlider.value);
  omegaVal.textContent = state.n;
  state.customPartition = null;
  rebuild();
});

xDistSelect.addEventListener('change', () => {
  state.xDist = xDistSelect.value;
  rng = mulberry32(state.seed);
  state.X = generateX(state.n, state.xDist);
  update();
});

sigmaSelect.addEventListener('change', () => {
  state.sigmaType = sigmaSelect.value;
  state.partition = buildPartition(state.n, state.sigmaType);
  if (state.sigmaType === 'custom') {
    state.customPartition = state.partition.map(a => [...a]);
  }
  state.selectedAtomIdx = -1;
  update();
});

toggleTower.addEventListener('change', () => {
  state.showTower = toggleTower.checked;
  update();
});

toggleL2.addEventListener('change', () => {
  state.showL2 = toggleL2.checked;
  update();
});

resetBtn.addEventListener('click', () => {
  state.seed = 42;
  state.n = 6;
  state.xDist = 'uniform';
  state.sigmaType = 'oddeven';
  state.showTower = false;
  state.showL2 = true;
  state.customPartition = null;
  state.selectedAtomIdx = -1;

  omegaSlider.value = 6;
  omegaVal.textContent = '6';
  xDistSelect.value = 'uniform';
  sigmaSelect.value = 'oddeven';
  toggleTower.checked = false;
  toggleL2.checked = true;

  rebuild();
});

resampleBtn.addEventListener('click', () => {
  state.seed = Math.floor(Math.random() * 100000);
  rng = mulberry32(state.seed);
  state.X = generateX(state.n, state.xDist === 'custom' ? 'uniform' : state.xDist);
  update();
});

// ============================================================
//  Initialize
// ============================================================

renderKaTeX();
rebuild();
