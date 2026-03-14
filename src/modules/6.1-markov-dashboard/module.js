/* ============================================================
   Module 6.1 — Markov Chain Dynamics Dashboard
   Full D3 v7 interactive visualization
   ============================================================ */

import * as d3 from 'd3';
import katex from 'katex';
import '../../lib/copy-code.js';

// ─── Preset Chains ──────────────────────────────────────────

const PRESETS = {
  weather: {
    name: 'Weather (3 states)',
    states: ['Sunny', 'Cloudy', 'Rainy'],
    P: [
      [0.7, 0.2, 0.1],
      [0.3, 0.4, 0.3],
      [0.2, 0.3, 0.5],
    ],
  },
  gambler: {
    name: "Gambler's Ruin (5 states)",
    states: ['$0', '$1', '$2', '$3', '$4'],
    P: [
      [1.0, 0.0, 0.0, 0.0, 0.0],
      [0.5, 0.0, 0.5, 0.0, 0.0],
      [0.0, 0.5, 0.0, 0.5, 0.0],
      [0.0, 0.0, 0.5, 0.0, 0.5],
      [0.0, 0.0, 0.0, 0.0, 1.0],
    ],
  },
  periodic: {
    name: 'Periodic Chain (period 2)',
    states: ['A', 'B', 'C', 'D'],
    P: [
      [0.0, 0.5, 0.5, 0.0],
      [0.0, 0.0, 0.0, 1.0],
      [0.0, 0.0, 0.0, 1.0],
      [0.5, 0.5, 0.0, 0.0],
    ],
  },
  doubly: {
    name: 'Doubly Stochastic (4 states)',
    states: ['W', 'X', 'Y', 'Z'],
    P: [
      [0.25, 0.25, 0.25, 0.25],
      [0.25, 0.25, 0.25, 0.25],
      [0.25, 0.25, 0.25, 0.25],
      [0.25, 0.25, 0.25, 0.25],
    ],
  },
  ehrenfest: {
    name: 'Ehrenfest Model (6 states)',
    states: ['0', '1', '2', '3', '4', '5'],
    P: (() => {
      const N = 5;
      const n = N + 1;
      const M = Array.from({ length: n }, () => new Array(n).fill(0));
      for (let k = 0; k < n; k++) {
        if (k < N) M[k][k + 1] = (N - k) / N;
        if (k > 0) M[k][k - 1] = k / N;
      }
      return M;
    })(),
  },
};

// ─── Linear Algebra Helpers ─────────────────────────────────

function matMul(A, B) {
  const n = A.length;
  const m = B[0].length;
  const p = B.length;
  const C = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++)
      for (let k = 0; k < p; k++) C[i][j] += A[i][k] * B[k][j];
  return C;
}

function matPow(M, n) {
  const sz = M.length;
  // identity
  let result = Array.from({ length: sz }, (_, i) => {
    const row = new Array(sz).fill(0);
    row[i] = 1;
    return row;
  });
  let base = M.map((r) => [...r]);
  let exp = n;
  while (exp > 0) {
    if (exp & 1) result = matMul(result, base);
    base = matMul(base, base);
    exp >>= 1;
  }
  return result;
}

function vecMatMul(v, M) {
  const n = M.length;
  const out = new Array(n).fill(0);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) out[j] += v[i] * M[i][j];
  return out;
}

/** Power iteration to find stationary distribution */
function stationaryDist(P, maxIter = 2000, tol = 1e-10) {
  const n = P.length;
  let pi = new Array(n).fill(1 / n);
  for (let iter = 0; iter < maxIter; iter++) {
    const next = vecMatMul(pi, P);
    let diff = 0;
    for (let i = 0; i < n; i++) diff += Math.abs(next[i] - pi[i]);
    pi = next;
    if (diff < tol) break;
  }
  // normalise
  const s = pi.reduce((a, b) => a + b, 0);
  return pi.map((v) => v / s);
}

function totalVariation(mu, pi) {
  let tv = 0;
  for (let i = 0; i < mu.length; i++) tv += Math.abs(mu[i] - pi[i]);
  return tv / 2;
}

// ─── Color Palette ──────────────────────────────────────────

const STATE_COLORS = [
  '#2563eb', '#e97319', '#059669', '#7c3aed',
  '#db2777', '#0891b2', '#ca8a04', '#64748b',
];

const heatColor = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, 1]);
const massColor = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, 1]);

// ─── State ──────────────────────────────────────────────────

let currentPreset = 'weather';
let chain = PRESETS[currentPreset];
let stepN = 0;
let initialStateIdx = 0;
let playing = false;
let playTimer = null;
let showStationary = true;
let showPn = false;
let stationaryPi = stationaryDist(chain.P);

// ─── DOM References ─────────────────────────────────────────

const presetSelect = document.getElementById('preset-chain');
const initialStateSelect = document.getElementById('initial-state');
const stepSlider = document.getElementById('step-n');
const stepValLabel = document.getElementById('step-n-val');
const playBtn = document.getElementById('play-btn');
const resetBtn = document.getElementById('reset-btn');
const toggleStationaryCb = document.getElementById('toggle-stationary');
const togglePnCb = document.getElementById('toggle-pn');
const statStepEl = document.getElementById('stat-step');
const statTvEl = document.getElementById('stat-tv');

// ─── Sizing helpers ─────────────────────────────────────────

function containerWidth(sel) {
  return document.querySelector(sel).clientWidth;
}

// ─── Panel 1: State Diagram ─────────────────────────────────

let diagramSvg, simulation, linkGroup, nodeGroup, dotGroup, labelGroup, loopGroup, arrowDefs;

function initDiagram() {
  const el = document.getElementById('state-diagram-chart');
  el.innerHTML = '';
  const width = el.clientWidth || 600;
  const height = 380;

  diagramSvg = d3.select(el)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // Arrow marker
  const defs = diagramSvg.append('defs');
  defs.append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 28)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('class', 'arrow-marker');

  arrowDefs = defs;
  loopGroup = diagramSvg.append('g').attr('class', 'loops');
  linkGroup = diagramSvg.append('g').attr('class', 'links');
  labelGroup = diagramSvg.append('g').attr('class', 'edge-labels');
  dotGroup = diagramSvg.append('g').attr('class', 'dots');
  nodeGroup = diagramSvg.append('g').attr('class', 'nodes');

  buildDiagram(width, height);
}

function buildDiagram(width, height) {
  const n = chain.states.length;
  const nodes = chain.states.map((name, i) => ({ id: i, name }));

  // Build edges (skip zero-probability)
  const links = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      if (chain.P[i][j] > 1e-8 && i !== j)
        links.push({ source: i, target: j, p: chain.P[i][j] });

  // Self-loops
  const selfLoops = [];
  for (let i = 0; i < n; i++)
    if (chain.P[i][i] > 1e-8)
      selfLoops.push({ id: i, p: chain.P[i][i] });

  // For bidirectional edges, compute curvature
  const edgeSet = new Set();
  links.forEach((l) => edgeSet.add(`${l.source}-${l.target}`));
  links.forEach((l) => {
    const rev = `${l.target}-${l.source}`;
    l.bidir = edgeSet.has(rev);
  });

  // Force simulation
  if (simulation) simulation.stop();
  simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d) => d.id).distance(120))
    .force('charge', d3.forceManyBody().strength(-400))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide(35));

  // ── Edges ──
  const edgeSel = linkGroup.selectAll('.edge-path').data(links, (d) => `${d.source.id ?? d.source}-${d.target.id ?? d.target}`);
  edgeSel.exit().remove();
  const edgeEnter = edgeSel.enter()
    .append('path')
    .attr('class', 'edge-path')
    .attr('marker-end', 'url(#arrowhead)');
  const edgeAll = edgeEnter.merge(edgeSel);
  edgeAll
    .attr('stroke-width', (d) => 1 + d.p * 4);

  // ── Edge Labels ──
  const eLabelSel = labelGroup.selectAll('.edge-label').data(links, (d) => `${d.source.id ?? d.source}-${d.target.id ?? d.target}`);
  eLabelSel.exit().remove();
  const eLabelEnter = eLabelSel.enter()
    .append('text')
    .attr('class', 'edge-label');
  const eLabelAll = eLabelEnter.merge(eLabelSel);
  eLabelAll.text((d) => d.p.toFixed(2));

  // ── Self-loops ──
  const loopSel = loopGroup.selectAll('.self-loop').data(selfLoops, (d) => d.id);
  loopSel.exit().remove();
  const loopEnter = loopSel.enter()
    .append('path')
    .attr('class', 'self-loop');
  const loopAll = loopEnter.merge(loopSel);
  loopAll.attr('stroke-width', (d) => 1 + d.p * 4);

  // ── Self-loop labels ──
  const loopLabelSel = labelGroup.selectAll('.self-loop-label').data(selfLoops, (d) => d.id);
  loopLabelSel.exit().remove();
  const loopLabelEnter = loopLabelSel.enter()
    .append('text')
    .attr('class', 'edge-label self-loop-label');
  const loopLabelAll = loopLabelEnter.merge(loopLabelSel);
  loopLabelAll.text((d) => d.p.toFixed(2));

  // ── Nodes ──
  const nodeSel = nodeGroup.selectAll('.state-node').data(nodes, (d) => d.id);
  nodeSel.exit().remove();
  const nodeEnter = nodeSel.enter()
    .append('g')
    .attr('class', 'state-node')
    .call(d3.drag()
      .on('start', dragStart)
      .on('drag', dragged)
      .on('end', dragEnd));
  nodeEnter.append('circle').attr('r', 22);
  nodeEnter.append('text').text((d) => d.name);
  const nodeAll = nodeEnter.merge(nodeSel);

  // Tick
  simulation.on('tick', () => {
    // clamp to bounds
    nodes.forEach((d) => {
      d.x = Math.max(30, Math.min(width - 30, d.x));
      d.y = Math.max(30, Math.min(height - 30, d.y));
    });

    // edges as quadratic bezier
    edgeAll.attr('d', (d) => {
      const dx = d.target.x - d.source.x;
      const dy = d.target.y - d.source.y;
      const curve = d.bidir ? 30 : 0;
      const mx = (d.source.x + d.target.x) / 2 - dy * curve / Math.hypot(dx, dy || 1);
      const my = (d.source.y + d.target.y) / 2 + dx * curve / Math.hypot(dx, dy || 1);
      return `M${d.source.x},${d.source.y} Q${mx},${my} ${d.target.x},${d.target.y}`;
    });

    // edge labels at midpoint of curve
    eLabelAll
      .attr('x', (d) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dist = Math.hypot(dx, dy) || 1;
        const curve = d.bidir ? 30 : 0;
        return (d.source.x + d.target.x) / 2 - dy * curve / dist;
      })
      .attr('y', (d) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dist = Math.hypot(dx, dy) || 1;
        const curve = d.bidir ? 30 : 0;
        return (d.source.y + d.target.y) / 2 + dx * curve / dist - 6;
      });

    // self-loops
    loopAll.attr('d', (d) => {
      const node = nodes[d.id];
      const cx = node.x;
      const cy = node.y - 22;
      const r = 18;
      return `M${cx - 10},${cy} A${r},${r} 0 1,1 ${cx + 10},${cy}`;
    });

    loopLabelAll
      .attr('x', (d) => nodes[d.id].x)
      .attr('y', (d) => nodes[d.id].y - 52);

    nodeAll.attr('transform', (d) => `translate(${d.x},${d.y})`);
  });

  // drag handlers
  function dragStart(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragEnd(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  // Store for updates
  diagramSvg._nodeAll = nodeAll;
  diagramSvg._edgeAll = edgeAll;
  diagramSvg._loopAll = loopAll;
  diagramSvg._nodes = nodes;
  diagramSvg._links = links;
  diagramSvg._selfLoops = selfLoops;
}

function updateDiagramColors(mu) {
  if (!diagramSvg || !diagramSvg._nodeAll) return;
  const maxMass = Math.max(...mu, 0.01);
  diagramSvg._nodeAll.select('circle')
    .transition().duration(300)
    .attr('fill', (d) => massColor(mu[d.id] / maxMass));
}

function animateProbDots() {
  if (!diagramSvg || !diagramSvg._links) return;
  const links = diagramSvg._links;
  const nodes = diagramSvg._nodes;

  // For each edge with P > threshold, spawn a dot
  links.forEach((l) => {
    if (l.p < 0.05) return;
    if (Math.random() > l.p) return;
    const dot = dotGroup.append('circle')
      .attr('class', 'prob-dot')
      .attr('r', 3)
      .attr('cx', l.source.x)
      .attr('cy', l.source.y);
    dot.transition()
      .duration(600)
      .attr('cx', l.target.x)
      .attr('cy', l.target.y)
      .attr('r', 1)
      .style('opacity', 0)
      .remove();
  });
}

// ─── Panel 2: Heatmap ───────────────────────────────────────

let heatSvg;

function initHeatmap() {
  const el = document.getElementById('heatmap-chart');
  el.innerHTML = '';
  const w = el.clientWidth || 300;
  const n = chain.states.length;
  const margin = { top: 30, right: 10, bottom: 10, left: 40 };
  const cellSize = Math.min((w - margin.left - margin.right) / n, 50);
  const total = cellSize * n;
  const h = total + margin.top + margin.bottom;

  heatSvg = d3.select(el)
    .append('svg')
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = heatSvg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Column labels
  g.selectAll('.col-label')
    .data(chain.states)
    .join('text')
    .attr('class', 'heatmap-axis-label')
    .attr('x', (_, i) => i * cellSize + cellSize / 2)
    .attr('y', -10)
    .text((d) => d);

  // Row labels
  g.selectAll('.row-label')
    .data(chain.states)
    .join('text')
    .attr('class', 'heatmap-axis-label')
    .attr('x', -10)
    .attr('y', (_, i) => i * cellSize + cellSize / 2)
    .attr('text-anchor', 'end')
    .text((d) => d);

  // Store group for updates
  heatSvg._g = g;
  heatSvg._cellSize = cellSize;
  heatSvg._n = n;

  drawHeatmapCells();
}

function drawHeatmapCells() {
  const g = heatSvg._g;
  const cellSize = heatSvg._cellSize;
  const n = heatSvg._n;
  const M = showPn ? matPow(chain.P, stepN) : chain.P;

  // Flatten
  const data = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      data.push({ i, j, v: M[i][j] });

  const cells = g.selectAll('.heatmap-cell').data(data, (d) => `${d.i}-${d.j}`);
  cells.exit().remove();
  const enter = cells.enter()
    .append('rect')
    .attr('class', 'heatmap-cell')
    .attr('x', (d) => d.j * cellSize)
    .attr('y', (d) => d.i * cellSize)
    .attr('width', cellSize)
    .attr('height', cellSize)
    .attr('rx', 2);
  enter.merge(cells)
    .transition().duration(400)
    .attr('fill', (d) => heatColor(d.v));

  // Value labels
  const labels = g.selectAll('.heatmap-label').data(data, (d) => `${d.i}-${d.j}`);
  labels.exit().remove();
  const lEnter = labels.enter()
    .append('text')
    .attr('class', 'heatmap-label')
    .attr('x', (d) => d.j * cellSize + cellSize / 2)
    .attr('y', (d) => d.i * cellSize + cellSize / 2);
  lEnter.merge(labels)
    .transition().duration(400)
    .tween('text', function (d) {
      const self = d3.select(this);
      const prev = parseFloat(self.text()) || 0;
      const interp = d3.interpolateNumber(prev, d.v);
      return (t) => self.text(interp(t).toFixed(2));
    });

  // Update title label
  const titleLabel = document.getElementById('heatmap-title-label');
  titleLabel.textContent = showPn && stepN > 0 ? `P^${stepN}` : 'P';
}

// ─── Panel 3: Distribution Evolution ────────────────────────

let distSvg, distXScale, distYScale;

function initDistribution() {
  const el = document.getElementById('distribution-chart');
  el.innerHTML = '';
  const w = el.clientWidth || 300;
  const h = 240;
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const innerW = w - margin.left - margin.right;
  const innerH = h - margin.top - margin.bottom;

  distSvg = d3.select(el)
    .append('svg')
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = distSvg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  distXScale = d3.scaleBand()
    .domain(chain.states)
    .range([0, innerW])
    .padding(0.25);

  distYScale = d3.scaleLinear()
    .domain([0, 1])
    .range([innerH, 0]);

  // Axes
  g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(distXScale));

  g.append('g')
    .attr('class', 'y-axis')
    .call(d3.axisLeft(distYScale).ticks(5));

  // Y-axis label
  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerH / 2)
    .attr('y', -38)
    .attr('text-anchor', 'middle')
    .text('Probability');

  distSvg._g = g;
  distSvg._innerW = innerW;
  distSvg._innerH = innerH;

  drawDistBars();
}

function drawDistBars() {
  const g = distSvg._g;
  const innerH = distSvg._innerH;
  const mu = getCurrentDist();
  const n = chain.states.length;

  const data = chain.states.map((name, i) => ({ name, mu: mu[i], pi: stationaryPi[i], i }));

  // Bars
  const bars = g.selectAll('.dist-bar').data(data, (d) => d.name);
  bars.exit().remove();
  const enter = bars.enter()
    .append('rect')
    .attr('class', 'dist-bar')
    .attr('x', (d) => distXScale(d.name))
    .attr('width', distXScale.bandwidth())
    .attr('y', innerH)
    .attr('height', 0);
  enter.merge(bars)
    .transition().duration(400)
    .attr('x', (d) => distXScale(d.name))
    .attr('width', distXScale.bandwidth())
    .attr('y', (d) => distYScale(d.mu))
    .attr('height', (d) => innerH - distYScale(d.mu))
    .attr('fill', (d) => STATE_COLORS[d.i % STATE_COLORS.length]);

  // Stationary overlay (dashed lines)
  const markers = g.selectAll('.stationary-marker').data(showStationary ? data : [], (d) => d.name);
  markers.exit().remove();
  const mEnter = markers.enter()
    .append('line')
    .attr('class', 'stationary-marker');
  mEnter.merge(markers)
    .transition().duration(400)
    .attr('x1', (d) => distXScale(d.name) - 4)
    .attr('x2', (d) => distXScale(d.name) + distXScale.bandwidth() + 4)
    .attr('y1', (d) => distYScale(d.pi))
    .attr('y2', (d) => distYScale(d.pi));

  // Stationary value labels
  const sLabels = g.selectAll('.stationary-label').data(showStationary ? data : [], (d) => d.name);
  sLabels.exit().remove();
  const slEnter = sLabels.enter()
    .append('text')
    .attr('class', 'stationary-label');
  slEnter.merge(sLabels)
    .transition().duration(400)
    .attr('x', (d) => distXScale(d.name) + distXScale.bandwidth() / 2)
    .attr('y', (d) => distYScale(d.pi) - 5)
    .attr('text-anchor', 'middle')
    .text((d) => d.pi.toFixed(2));

  // Update legend
  const legend = document.getElementById('distribution-legend');
  legend.innerHTML = '';
  data.forEach((d) => {
    const item = document.createElement('span');
    item.className = 'legend-item';
    item.innerHTML = `<span class="legend-swatch" style="background:${STATE_COLORS[d.i % STATE_COLORS.length]}"></span>${d.name}`;
    legend.appendChild(item);
  });
}

// ─── Distribution Computation ───────────────────────────────

function getInitialDist() {
  const n = chain.states.length;
  const mu = new Array(n).fill(0);
  mu[initialStateIdx] = 1;
  return mu;
}

function getCurrentDist() {
  const mu0 = getInitialDist();
  if (stepN === 0) return mu0;
  const Pn = matPow(chain.P, stepN);
  return vecMatMul(mu0, Pn);
}

// ─── Master Update ──────────────────────────────────────────

function updateAll() {
  const mu = getCurrentDist();

  // Stats
  statStepEl.textContent = stepN;
  const tv = totalVariation(mu, stationaryPi);
  statTvEl.textContent = tv.toFixed(4);

  // Panels
  updateDiagramColors(mu);
  drawHeatmapCells();
  drawDistBars();
}

// ─── Controls ───────────────────────────────────────────────

function populateInitialStates() {
  initialStateSelect.innerHTML = '';
  chain.states.forEach((name, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = name;
    initialStateSelect.appendChild(opt);
  });
  initialStateSelect.value = 0;
  initialStateIdx = 0;
}

function loadPreset(key) {
  currentPreset = key;
  chain = PRESETS[key];
  stationaryPi = stationaryDist(chain.P);
  stepN = 0;
  stepSlider.value = 0;
  stepValLabel.textContent = '0';
  stopPlay();
  populateInitialStates();

  initDiagram();
  initHeatmap();
  initDistribution();
  updateAll();
}

presetSelect.addEventListener('change', () => loadPreset(presetSelect.value));

initialStateSelect.addEventListener('change', () => {
  initialStateIdx = parseInt(initialStateSelect.value, 10);
  updateAll();
});

stepSlider.addEventListener('input', () => {
  stepN = parseInt(stepSlider.value, 10);
  stepValLabel.textContent = stepN;
  updateAll();
  if (playing) animateProbDots();
});

// Play / Pause
function startPlay() {
  playing = true;
  playBtn.textContent = 'Pause';
  playBtn.classList.remove('btn-primary');
  playBtn.classList.add('btn-secondary');
  playTimer = setInterval(() => {
    if (stepN >= 200) {
      stopPlay();
      return;
    }
    stepN++;
    stepSlider.value = stepN;
    stepValLabel.textContent = stepN;
    updateAll();
    animateProbDots();
  }, 120);
}

function stopPlay() {
  playing = false;
  playBtn.textContent = 'Play';
  playBtn.classList.add('btn-primary');
  playBtn.classList.remove('btn-secondary');
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
  }
}

playBtn.addEventListener('click', () => {
  if (playing) stopPlay();
  else startPlay();
});

resetBtn.addEventListener('click', () => {
  stopPlay();
  stepN = 0;
  stepSlider.value = 0;
  stepValLabel.textContent = '0';
  updateAll();
});

toggleStationaryCb.addEventListener('change', () => {
  showStationary = toggleStationaryCb.checked;
  updateAll();
});

togglePnCb.addEventListener('change', () => {
  showPn = togglePnCb.checked;
  updateAll();
});

// ─── KaTeX Rendering ────────────────────────────────────────

function renderMath() {
  const defEl = document.getElementById('info-markov-def');
  if (defEl) {
    katex.render(
      String.raw`P(X_{n+1} = j \mid X_n = i, X_{n-1}, \ldots, X_0) = P(X_{n+1} = j \mid X_n = i) = P_{ij}`,
      defEl,
      { displayMode: true, throwOnError: false }
    );
  }

  const statEl = document.getElementById('info-stationary-def');
  if (statEl) {
    katex.render(
      String.raw`\pi P = \pi, \quad \sum_i \pi_i = 1, \quad \pi_i \geq 0`,
      statEl,
      { displayMode: true, throwOnError: false }
    );
  }
}

// ─── Initialise ─────────────────────────────────────────────

loadPreset(currentPreset);
renderMath();
