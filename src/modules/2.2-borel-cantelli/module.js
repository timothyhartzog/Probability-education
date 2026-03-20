// ============================================================
//  Module 2.2 — Borel-Cantelli Lemmas
//  Visualize when infinitely many events occur.
// ============================================================

import * as d3 from 'd3';
import katex from 'katex';
import '../../lib/copy-code.js';
import '../../lib/param-tooltips.js';

// ============================================================
//  Seeded PRNG — mulberry32
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

// ============================================================
//  State
// ============================================================

const state = {
  seqType: '1/n',       // dropdown value
  alpha: 1.0,           // custom exponent
  N: 200,               // number of events
  M: 50,                // number of sample paths
  independent: true,
  showAnnotation: true,
  seed: 42,
  // Computed
  probs: [],            // P(A_n) for n = 1..N
  grid: [],             // N x M boolean matrix
  partialSums: [],      // cumulative sum of P(A_n)
  runningCounts: [],    // M arrays of length N (cumulative hit count)
  limsupPaths: [],      // boolean array length M — which paths are "i.o."
  totalSum: 0,
  empiricalP: 0,
  lemmaLabel: '',
};

// ============================================================
//  DOM References
// ============================================================

const seqSelect = document.getElementById('seq-type');
const alphaGroup = document.getElementById('alpha-group');
const alphaSlider = document.getElementById('alpha-slider');
const alphaVal = document.getElementById('alpha-val');
const numEventsSlider = document.getElementById('num-events');
const numEventsVal = document.getElementById('num-events-val');
const numPathsSlider = document.getElementById('num-paths');
const numPathsVal = document.getElementById('num-paths-val');
const independenceToggle = document.getElementById('toggle-independence');
const annotationToggle = document.getElementById('toggle-annotation');
const seedSlider = document.getElementById('seed-input');
const seedVal = document.getElementById('seed-val');
const resampleBtn = document.getElementById('resample-btn');
const resetBtn = document.getElementById('reset-btn');

const statSum = document.getElementById('stat-sum');
const statEmpirical = document.getElementById('stat-empirical');
const statLemma = document.getElementById('stat-lemma');

const gridChart = document.getElementById('event-grid-chart');
const sumChart = document.getElementById('sum-chart');
const freqChart = document.getElementById('freq-chart');

// ============================================================
//  KaTeX Rendering
// ============================================================

function renderKaTeX() {
  const limsupDef = document.getElementById('info-limsup-def');
  if (limsupDef) {
    katex.render(
      String.raw`\limsup_{n \to \infty} A_n = \bigcap_{n=1}^{\infty} \bigcup_{k=n}^{\infty} A_k = \{\omega : \omega \in A_n \text{ for infinitely many } n\}`,
      limsupDef,
      { displayMode: true, throwOnError: false }
    );
  }

  const bc1 = document.getElementById('info-bc1');
  if (bc1) {
    katex.render(
      String.raw`\textbf{BC1:}\quad \sum_{n=1}^{\infty} P(A_n) < \infty \;\Longrightarrow\; P\!\bigl(A_n \text{ i.o.}\bigr) = 0`,
      bc1,
      { displayMode: true, throwOnError: false }
    );
  }

  const bc2 = document.getElementById('info-bc2');
  if (bc2) {
    katex.render(
      String.raw`\textbf{BC2:}\quad \sum_{n=1}^{\infty} P(A_n) = \infty \;\text{ and } A_n \text{ independent} \;\Longrightarrow\; P\!\bigl(A_n \text{ i.o.}\bigr) = 1`,
      bc2,
      { displayMode: true, throwOnError: false }
    );
  }
}

// ============================================================
//  Probability Sequence
// ============================================================

function computeProbs() {
  const N = state.N;
  const probs = new Array(N);
  let alpha;

  switch (state.seqType) {
    case '1/n^2':
      alpha = 2;
      break;
    case '1/n':
      alpha = 1;
      break;
    case '1/sqrt(n)':
      alpha = 0.5;
      break;
    case 'custom':
      alpha = state.alpha;
      break;
    default:
      alpha = 1;
  }

  for (let n = 0; n < N; n++) {
    // P(A_{n+1}) = 1 / (n+1)^alpha, clamped to [0, 1]
    probs[n] = Math.min(1, 1 / Math.pow(n + 1, alpha));
  }

  state.probs = probs;

  // Partial sums
  const sums = new Array(N);
  sums[0] = probs[0];
  for (let n = 1; n < N; n++) {
    sums[n] = sums[n - 1] + probs[n];
  }
  state.partialSums = sums;
  state.totalSum = sums[N - 1];

  // Determine applicable lemma
  // alpha > 1 => summable => BC1
  // alpha <= 1 => divergent
  if (alpha > 1) {
    state.lemmaLabel = 'BC1';
  } else if (state.independent) {
    state.lemmaLabel = 'BC2';
  } else {
    state.lemmaLabel = 'BC2 (needs indep.)';
  }
}

// ============================================================
//  Simulate Grid
// ============================================================

function simulateGrid() {
  const { N, M, probs, independent } = state;
  const rng = mulberry32(state.seed);

  // grid[n][m] = true if event A_{n+1} occurred in path m
  const grid = Array.from({ length: N }, () => new Array(M).fill(false));

  if (independent) {
    // Independent: each cell drawn independently
    for (let n = 0; n < N; n++) {
      for (let m = 0; m < M; m++) {
        grid[n][m] = rng() < probs[n];
      }
    }
  } else {
    // Dependent construction: for each event n, either ALL paths fire or NONE fire.
    // This means A_n are all the same random variable repeated — maximally dependent.
    // Sum P(A_n) still diverges (same probs), but P(limsup) < 1 in general.
    // We use: A_n fires for ALL paths with probability P(A_n), else for none.
    for (let n = 0; n < N; n++) {
      const fire = rng() < probs[n];
      for (let m = 0; m < M; m++) {
        grid[n][m] = fire;
      }
    }
  }

  state.grid = grid;

  // Running counts: for each path m, count of hits up to event n
  const counts = Array.from({ length: M }, () => new Array(N).fill(0));
  for (let m = 0; m < M; m++) {
    counts[m][0] = grid[0][m] ? 1 : 0;
    for (let n = 1; n < N; n++) {
      counts[m][n] = counts[m][n - 1] + (grid[n][m] ? 1 : 0);
    }
  }
  state.runningCounts = counts;

  // Limsup determination: a path is in limsup if it has "many" hits in the tail.
  // For finite simulation, we check: did events fire in the last quarter?
  // More precisely: path m is in limsup if it has at least 1 hit in A_{3N/4}..A_N
  const tailStart = Math.floor(3 * N / 4);
  const limsup = new Array(M).fill(false);
  for (let m = 0; m < M; m++) {
    let tailHits = 0;
    for (let n = tailStart; n < N; n++) {
      if (grid[n][m]) tailHits++;
    }
    // Heuristic: at least 2 hits in tail quarter, or total hits > N/4
    limsup[m] = tailHits >= 2;
  }
  state.limsupPaths = limsup;

  // Empirical P(limsup)
  state.empiricalP = limsup.filter(Boolean).length / M;
}

// ============================================================
//  Render: Event Grid (heatmap)
// ============================================================

function renderGrid() {
  gridChart.innerHTML = '';

  const { N, M, grid, limsupPaths } = state;
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const width = 900;
  const height = 400;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3.select(gridChart)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const cellW = innerW / M;
  const cellH = innerH / N;

  // Column highlights for limsup paths
  limsupPaths.forEach((isLimsup, m) => {
    if (isLimsup) {
      g.append('rect')
        .attr('class', 'limsup-highlight')
        .attr('x', m * cellW)
        .attr('y', 0)
        .attr('width', cellW)
        .attr('height', innerH);
    }
  });

  // Draw cells — use a canvas-like approach with small rects
  // For performance with large grids, batch by row
  const colorHit = '#2563eb';
  const colorMiss = '#f1f5f9';
  const colorHitLimsup = '#e97319';

  for (let n = 0; n < N; n++) {
    for (let m = 0; m < M; m++) {
      if (grid[n][m]) {
        g.append('rect')
          .attr('class', 'grid-cell')
          .attr('x', m * cellW)
          .attr('y', n * cellH)
          .attr('width', Math.max(cellW - 0.5, 0.5))
          .attr('height', Math.max(cellH - 0.3, 0.3))
          .attr('fill', limsupPaths[m] ? colorHitLimsup : colorHit)
          .attr('rx', 0.5);
      }
    }
  }

  // If grid is small enough, draw grid lines
  if (N <= 100 && M <= 50) {
    // Subtle grid border
    g.append('rect')
      .attr('x', 0).attr('y', 0)
      .attr('width', innerW).attr('height', innerH)
      .attr('fill', 'none')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 1);
  }

  // Y-axis label
  svg.append('text')
    .attr('class', 'axis-label')
    .attr('transform', `translate(14, ${margin.top + innerH / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .text('Event index n');

  // X-axis label
  svg.append('text')
    .attr('class', 'axis-label')
    .attr('x', margin.left + innerW / 2)
    .attr('y', height - 4)
    .attr('text-anchor', 'middle')
    .text('Sample path \u03C9');

  // Limsup markers at bottom
  limsupPaths.forEach((isLimsup, m) => {
    if (isLimsup) {
      g.append('text')
        .attr('class', 'limsup-indicator')
        .attr('x', m * cellW + cellW / 2)
        .attr('y', innerH + 14)
        .text('i.o.');
    }
  });

  // Y-axis ticks (a few labels)
  const yTicks = [0, Math.floor(N / 4), Math.floor(N / 2), Math.floor(3 * N / 4), N - 1];
  yTicks.forEach(n => {
    g.append('text')
      .attr('class', 'axis text')
      .attr('x', -6)
      .attr('y', n * cellH + cellH / 2 + 4)
      .attr('text-anchor', 'end')
      .attr('font-family', 'var(--font-heading)')
      .attr('font-size', 10)
      .attr('fill', '#94a3b8')
      .text(n + 1);
  });

  // Legend
  const legendContainer = document.createElement('div');
  legendContainer.className = 'grid-legend';
  legendContainer.innerHTML = `
    <div class="legend-item"><div class="legend-swatch" style="background:${colorHit}"></div>Event fired</div>
    <div class="legend-item"><div class="legend-swatch" style="background:${colorHitLimsup}"></div>Fired (limsup path)</div>
    <div class="legend-item"><div class="legend-swatch" style="background:rgba(233,115,25,0.12)"></div>limsup column</div>
  `;
  gridChart.appendChild(legendContainer);
}

// ============================================================
//  Render: Partial Sum Chart
// ============================================================

function renderSumChart() {
  sumChart.innerHTML = '';

  const { N, partialSums, totalSum, showAnnotation, lemmaLabel } = state;
  const margin = { top: 20, right: 20, bottom: 40, left: 55 };
  const width = 450;
  const height = 260;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3.select(sumChart)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([1, N]).range([0, innerW]);
  const yMax = partialSums[N - 1] * 1.1;
  const y = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]);

  // Area under curve
  const area = d3.area()
    .x((_, i) => x(i + 1))
    .y0(innerH)
    .y1((d) => y(d));

  g.append('path')
    .datum(partialSums)
    .attr('class', 'sum-area')
    .attr('d', area);

  // Line
  const line = d3.line()
    .x((_, i) => x(i + 1))
    .y(d => y(d));

  g.append('path')
    .datum(partialSums)
    .attr('class', 'sum-line')
    .attr('d', line);

  // Axes
  const xAxis = d3.axisBottom(x).ticks(5).tickFormat(d3.format('d'));
  const yAxis = d3.axisLeft(y).ticks(5);

  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(xAxis);

  g.append('g')
    .attr('class', 'axis')
    .call(yAxis);

  // Axis labels
  svg.append('text')
    .attr('class', 'axis-label')
    .attr('x', margin.left + innerW / 2)
    .attr('y', height - 4)
    .attr('text-anchor', 'middle')
    .text('n');

  svg.append('text')
    .attr('class', 'axis-label')
    .attr('transform', `translate(14, ${margin.top + innerH / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .text('\u03A3 P(A\u2099)');

  // Annotation
  if (showAnnotation) {
    const isSummable = lemmaLabel === 'BC1';
    const annotText = isSummable
      ? `\u03A3 = ${totalSum.toFixed(2)} (converges)`
      : `\u03A3 \u2265 ${totalSum.toFixed(1)} (diverges)`;
    const annotColor = isSummable ? '#059669' : '#dc2626';

    g.append('text')
      .attr('class', 'convergence-annotation')
      .attr('x', innerW - 5)
      .attr('y', 16)
      .attr('text-anchor', 'end')
      .attr('fill', annotColor)
      .text(annotText);

    // If convergent, draw horizontal dashed line at the limit
    if (isSummable) {
      // Approximate limit from partial sums
      const limit = totalSum;
      g.append('line')
        .attr('class', 'convergence-line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', y(limit))
        .attr('y2', y(limit))
        .attr('stroke', '#059669');

      g.append('text')
        .attr('x', innerW + 3)
        .attr('y', y(limit) + 4)
        .attr('font-family', 'var(--font-heading)')
        .attr('font-size', 10)
        .attr('fill', '#059669')
        .text(limit.toFixed(2));
    }
  }
}

// ============================================================
//  Render: Frequency Tracker
// ============================================================

function renderFreqChart() {
  freqChart.innerHTML = '';

  const { N, M, runningCounts, limsupPaths } = state;
  const margin = { top: 20, right: 20, bottom: 40, left: 55 };
  const width = 450;
  const height = 260;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3.select(freqChart)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([1, N]).range([0, innerW]);

  // Find max count across all paths
  let maxCount = 0;
  for (let m = 0; m < M; m++) {
    if (runningCounts[m][N - 1] > maxCount) {
      maxCount = runningCounts[m][N - 1];
    }
  }
  const y = d3.scaleLinear().domain([0, Math.max(maxCount * 1.1, 1)]).range([innerH, 0]);

  // Subsample points for performance if N is large
  const step = N > 200 ? Math.ceil(N / 200) : 1;
  const indices = [];
  for (let n = 0; n < N; n += step) indices.push(n);
  if (indices[indices.length - 1] !== N - 1) indices.push(N - 1);

  const line = d3.line()
    .x(n => x(n + 1))
    .y(n => 0); // placeholder

  // Color palette for paths
  const colorNormal = '#93c5fd';
  const colorLimsup = '#e97319';

  // Draw each path
  for (let m = 0; m < M; m++) {
    const pathLine = d3.line()
      .x(n => x(n + 1))
      .y(n => y(runningCounts[m][n]));

    g.append('path')
      .datum(indices)
      .attr('class', limsupPaths[m] ? 'freq-line-highlight' : 'freq-line')
      .attr('d', pathLine)
      .attr('stroke', limsupPaths[m] ? colorLimsup : colorNormal);
  }

  // Axes
  const xAxis = d3.axisBottom(x).ticks(5).tickFormat(d3.format('d'));
  const yAxis = d3.axisLeft(y).ticks(5);

  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(xAxis);

  g.append('g')
    .attr('class', 'axis')
    .call(yAxis);

  // Axis labels
  svg.append('text')
    .attr('class', 'axis-label')
    .attr('x', margin.left + innerW / 2)
    .attr('y', height - 4)
    .attr('text-anchor', 'middle')
    .text('n');

  svg.append('text')
    .attr('class', 'axis-label')
    .attr('transform', `translate(14, ${margin.top + innerH / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .text('Cumulative hits');

  // Legend
  const legendG = g.append('g')
    .attr('transform', `translate(10, 5)`);

  [
    { label: 'limsup path', color: colorLimsup },
    { label: 'other path', color: colorNormal },
  ].forEach((d, i) => {
    const lg = legendG.append('g').attr('transform', `translate(0, ${i * 16})`);
    lg.append('line')
      .attr('x1', 0).attr('x2', 16)
      .attr('y1', 0).attr('y2', 0)
      .attr('stroke', d.color)
      .attr('stroke-width', 2);
    lg.append('text')
      .attr('x', 20).attr('y', 4)
      .attr('font-family', 'var(--font-heading)')
      .attr('font-size', 10)
      .attr('fill', '#555')
      .text(d.label);
  });
}

// ============================================================
//  Stats Update
// ============================================================

function updateStats() {
  const isSummable = state.lemmaLabel === 'BC1';

  if (isSummable) {
    statSum.textContent = state.totalSum.toFixed(3);
  } else {
    statSum.textContent = '\u2265 ' + state.totalSum.toFixed(1);
  }

  statEmpirical.textContent = state.empiricalP.toFixed(2);
  statLemma.textContent = state.lemmaLabel;

  // Color the lemma stat
  statLemma.style.color = isSummable ? '#059669' : '#e97319';
  statLemma.style.fontSize = '0.9rem';
}

// ============================================================
//  Full Update Pipeline
// ============================================================

function fullUpdate() {
  computeProbs();
  simulateGrid();
  renderGrid();
  renderSumChart();
  renderFreqChart();
  updateStats();
}

// ============================================================
//  Event Listeners
// ============================================================

seqSelect.addEventListener('change', () => {
  state.seqType = seqSelect.value;
  alphaGroup.style.display = state.seqType === 'custom' ? '' : 'none';
  fullUpdate();
});

alphaSlider.addEventListener('input', () => {
  state.alpha = parseFloat(alphaSlider.value);
  alphaVal.textContent = state.alpha.toFixed(1);
  fullUpdate();
});

numEventsSlider.addEventListener('input', () => {
  state.N = parseInt(numEventsSlider.value);
  numEventsVal.textContent = state.N;
  fullUpdate();
});

numPathsSlider.addEventListener('input', () => {
  state.M = parseInt(numPathsSlider.value);
  numPathsVal.textContent = state.M;
  fullUpdate();
});

independenceToggle.addEventListener('change', () => {
  state.independent = independenceToggle.checked;
  fullUpdate();
});

annotationToggle.addEventListener('change', () => {
  state.showAnnotation = annotationToggle.checked;
  renderSumChart();
});

seedSlider.addEventListener('input', () => {
  state.seed = parseInt(seedSlider.value);
  seedVal.textContent = state.seed;
  fullUpdate();
});

resampleBtn.addEventListener('click', () => {
  // Increment seed and resample
  state.seed = (state.seed + 1) % 1000;
  if (state.seed === 0) state.seed = 1;
  seedSlider.value = state.seed;
  seedVal.textContent = state.seed;
  fullUpdate();
});

resetBtn.addEventListener('click', () => {
  // Reset to defaults
  state.seqType = '1/n';
  state.alpha = 1.0;
  state.N = 200;
  state.M = 50;
  state.independent = true;
  state.showAnnotation = true;
  state.seed = 42;

  seqSelect.value = '1/n';
  alphaSlider.value = 1.0;
  alphaVal.textContent = '1.0';
  alphaGroup.style.display = 'none';
  numEventsSlider.value = 200;
  numEventsVal.textContent = '200';
  numPathsSlider.value = 50;
  numPathsVal.textContent = '50';
  independenceToggle.checked = true;
  annotationToggle.checked = true;
  seedSlider.value = 42;
  seedVal.textContent = '42';

  fullUpdate();
});

// ============================================================
//  Initialize
// ============================================================

renderKaTeX();
fullUpdate();
