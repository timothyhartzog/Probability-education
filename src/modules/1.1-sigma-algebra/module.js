// ============================================================
//  Module 1.1 — Sigma-Algebra Explorer
//  Interactive exploration of sigma-algebras on finite sets.
// ============================================================

import * as d3 from 'd3';
import katex from 'katex';
import '../../lib/copy-code.js';
import '../../lib/param-tooltips.js';

// ============================================================
//  Utility: subset representation
//  Subsets of {1,...,n} are encoded as bitmasks (integers).
// ============================================================

/** Return array of elements in the bitmask subset, 1-indexed. */
function subsetElements(mask, n) {
  const elems = [];
  for (let i = 0; i < n; i++) {
    if (mask & (1 << i)) elems.push(i + 1);
  }
  return elems;
}

/** Format a subset bitmask as set notation string. */
function formatSubset(mask, n) {
  if (mask === 0) return '\u2205';                    // empty set
  if (mask === (1 << n) - 1) return '\u03A9';         // Omega
  const elems = subsetElements(mask, n);
  return '{' + elems.join(',') + '}';
}

/** Complement of mask in {1,...,n}. */
function complement(mask, n) {
  return ((1 << n) - 1) ^ mask;
}

/** Power set of {1,...,n} as array of bitmasks. */
function powerSet(n) {
  const result = [];
  for (let m = 0; m < (1 << n); m++) result.push(m);
  return result;
}

/** Number of bits set. */
function popcount(x) {
  let c = 0;
  while (x) { c += x & 1; x >>= 1; }
  return c;
}

// ============================================================
//  Sigma-algebra closure
// ============================================================

/**
 * Given a set of generator bitmasks and |Omega|=n,
 * compute the smallest sigma-algebra containing them.
 * Returns { sets: Set<mask>, steps: [{type, inputs, output}] }
 */
function closeSigmaAlgebra(generators, n) {
  const omega = (1 << n) - 1;
  const sets = new Set([0, omega]);  // always contain empty set and Omega
  const steps = [];

  // Add generators
  for (const g of generators) {
    sets.add(g);
  }

  // Iteratively close under complement, union, and intersection
  let changed = true;
  while (changed) {
    changed = false;
    const current = [...sets];

    // Complements
    for (const s of current) {
      const c = complement(s, n);
      if (!sets.has(c)) {
        sets.add(c);
        steps.push({ type: 'complement', inputs: [s], output: c });
        changed = true;
      }
    }

    // Pairwise unions
    for (let i = 0; i < current.length; i++) {
      for (let j = i + 1; j < current.length; j++) {
        const u = current[i] | current[j];
        if (!sets.has(u)) {
          sets.add(u);
          steps.push({ type: 'union', inputs: [current[i], current[j]], output: u });
          changed = true;
        }
      }
    }

    // Pairwise intersections
    const current2 = [...sets];
    for (let i = 0; i < current2.length; i++) {
      for (let j = i + 1; j < current2.length; j++) {
        const inter = current2[i] & current2[j];
        if (!sets.has(inter)) {
          sets.add(inter);
          steps.push({ type: 'intersection', inputs: [current2[i], current2[j]], output: inter });
          changed = true;
        }
      }
    }
  }

  return { sets, steps };
}

/**
 * Compute atoms (minimal non-empty sets) of a sigma-algebra.
 */
function computeAtoms(sigmaAlgebra, n) {
  const atoms = [];
  for (const s of sigmaAlgebra) {
    if (s === 0) continue;
    let isAtom = true;
    for (const t of sigmaAlgebra) {
      if (t === 0 || t === s) continue;
      if ((t & s) === t) { // t is a strict subset of s
        isAtom = false;
        break;
      }
    }
    if (isAtom) atoms.push(s);
  }
  return atoms;
}

// ============================================================
//  Enumerate ALL sigma-algebras on {1,...,n}
//  A sigma-algebra on a finite set <=> a partition of Omega
//  into blocks (atoms), then the sigma-algebra is all unions
//  of blocks. So enumerate all partitions.
// ============================================================

/**
 * Enumerate all set partitions of {0,1,...,n-1}.
 * Returns array of partitions, each partition is array of blocks (bitmasks).
 */
function enumeratePartitions(n) {
  const partitions = [];
  // Use assignment vector: assign[i] = block index for element i
  const assign = new Array(n).fill(0);
  const maxBlock = new Array(n).fill(0);

  function recurse(pos) {
    if (pos === n) {
      // Convert assignment to blocks
      const blockMap = {};
      for (let i = 0; i < n; i++) {
        if (!blockMap[assign[i]]) blockMap[assign[i]] = 0;
        blockMap[assign[i]] |= (1 << i);
      }
      partitions.push(Object.values(blockMap));
      return;
    }
    const limit = (pos === 0) ? 0 : maxBlock[pos - 1];
    for (let b = 0; b <= limit + 1; b++) {
      assign[pos] = b;
      maxBlock[pos] = Math.max(limit, b);
      recurse(pos + 1);
    }
  }
  recurse(0);
  return partitions;
}

/**
 * Given a partition (array of block bitmasks), return the sigma-algebra
 * as a Set of bitmasks (all unions of subsets of blocks).
 */
function sigmaAlgebraFromPartition(blocks) {
  const result = new Set([0]);
  // enumerate all subsets of blocks
  const k = blocks.length;
  for (let mask = 0; mask < (1 << k); mask++) {
    let union = 0;
    for (let i = 0; i < k; i++) {
      if (mask & (1 << i)) union |= blocks[i];
    }
    result.add(union);
  }
  return result;
}

/**
 * Enumerate all sigma-algebras on {1,...,n}.
 * Returns array of { sets: Set<mask>, atoms: number[], partition: number[] }.
 */
function enumerateAllSigmaAlgebras(n) {
  const partitions = enumeratePartitions(n);
  return partitions.map(blocks => {
    const sets = sigmaAlgebraFromPartition(blocks);
    return { sets, atoms: blocks, partition: blocks };
  });
}

/**
 * Encode a sigma-algebra as a canonical key (sorted bitmask list).
 */
function sigmaKey(sets) {
  return [...sets].sort((a, b) => a - b).join(',');
}

// ============================================================
//  Lattice (Hasse diagram) computation
// ============================================================

/**
 * Given all sigma-algebras, compute the Hasse diagram.
 * Nodes: sigma-algebras. Edges: A -> B if A subset B and no C with A subset C subset B.
 */
function computeHasseDiagram(allSAs) {
  const n = allSAs.length;

  // Check containment: SA_i is a subset of SA_j?
  function isSubset(i, j) {
    for (const s of allSAs[i].sets) {
      if (!allSAs[j].sets.has(s)) return false;
    }
    return true;
  }

  // Build adjacency: edges[i] = indices j where i < j in containment and no intermediate
  const edges = [];
  // First, find all containment pairs
  const contains = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && allSAs[i].sets.size < allSAs[j].sets.size && isSubset(i, j)) {
        contains[i].push(j);
      }
    }
  }

  // Filter to immediate successors (Hasse edges)
  for (let i = 0; i < n; i++) {
    for (const j of contains[i]) {
      let isImmediate = true;
      for (const k of contains[i]) {
        if (k !== j && allSAs[k].sets.size < allSAs[j].sets.size && contains[k].includes(j)) {
          isImmediate = false;
          break;
        }
      }
      if (isImmediate) {
        edges.push([i, j]);
      }
    }
  }

  return edges;
}

// ============================================================
//  State
// ============================================================

const state = {
  n: 3,
  generators: new Set(),     // bitmasks of user-selected generator subsets
  allSAs: [],                // all sigma-algebras for current n
  hasseEdges: [],            // edges of Hasse diagram
  currentSA: null,           // { sets, steps }
  animateClosure: true,
  showLattice: true,
};

// ============================================================
//  DOM references
// ============================================================

const omegaSlider = document.getElementById('omega-size');
const omegaVal = document.getElementById('omega-size-val');
const subsetToggles = document.getElementById('subset-toggles');
const animateCheck = document.getElementById('toggle-closure-animate');
const latticeCheck = document.getElementById('toggle-lattice');
const resetBtn = document.getElementById('reset-btn');
const randomBtn = document.getElementById('random-btn');
const statGenerators = document.getElementById('stat-generators');
const statSize = document.getElementById('stat-size');
const statAtoms = document.getElementById('stat-atoms');
const setDiagramChart = document.getElementById('set-diagram-chart');
const latticeChart = document.getElementById('lattice-chart');
const latticePanel = document.getElementById('lattice-panel');
const contentsChart = document.getElementById('contents-chart');
const contentsStats = document.getElementById('contents-stats');
const infoDef = document.getElementById('info-sigma-def');

// ============================================================
//  Render KaTeX
// ============================================================

function renderKaTeX() {
  if (infoDef) {
    katex.render(
      String.raw`\mathcal{F} \text{ is a } \sigma\text{-algebra on } \Omega \iff \begin{cases} \Omega \in \mathcal{F} \\ A \in \mathcal{F} \Rightarrow A^c \in \mathcal{F} \\ A_1, A_2, \ldots \in \mathcal{F} \Rightarrow \bigcup_{i=1}^{\infty} A_i \in \mathcal{F} \end{cases}`,
      infoDef,
      { displayMode: true, throwOnError: false }
    );
  }
}

// ============================================================
//  Initialize / rebuild for new n
// ============================================================

function rebuild() {
  const n = state.n;
  state.generators.clear();

  // Enumerate all sigma-algebras
  state.allSAs = enumerateAllSigmaAlgebras(n);
  state.hasseEdges = computeHasseDiagram(state.allSAs);

  // Build subset toggle buttons
  buildSubsetToggles();

  // Recompute and render
  recompute();
}

function buildSubsetToggles() {
  const n = state.n;
  const omega = (1 << n) - 1;
  // Remove old buttons (keep the label)
  const label = subsetToggles.querySelector('label');
  subsetToggles.innerHTML = '';
  if (label) subsetToggles.appendChild(label);
  else {
    const lbl = document.createElement('label');
    lbl.textContent = 'Generator Sets';
    subsetToggles.appendChild(lbl);
  }

  const btnContainer = document.createElement('div');
  btnContainer.style.display = 'flex';
  btnContainer.style.flexWrap = 'wrap';
  btnContainer.style.gap = '2px';
  btnContainer.style.marginTop = '4px';

  // All non-trivial subsets
  for (let mask = 1; mask < omega; mask++) {
    const btn = document.createElement('button');
    btn.className = 'subset-toggle-btn';
    btn.textContent = formatSubset(mask, n);
    btn.dataset.mask = mask;
    btn.addEventListener('click', () => {
      const m = parseInt(btn.dataset.mask);
      if (state.generators.has(m)) {
        state.generators.delete(m);
        btn.classList.remove('active');
      } else {
        state.generators.add(m);
        btn.classList.add('active');
      }
      recompute();
    });
    btnContainer.appendChild(btn);
  }
  subsetToggles.appendChild(btnContainer);
}

// ============================================================
//  Recompute sigma-algebra and re-render
// ============================================================

function recompute() {
  const { sets, steps } = closeSigmaAlgebra([...state.generators], state.n);
  state.currentSA = { sets, steps };

  updateStats();
  renderSetDiagram();
  renderContents();
  renderLattice();
}

function updateStats() {
  const n = state.n;
  statGenerators.textContent = state.generators.size;
  statSize.textContent = state.currentSA.sets.size;
  const atoms = computeAtoms(state.currentSA.sets, n);
  statAtoms.textContent = atoms.length;
}

// ============================================================
//  Set Diagram Panel
// ============================================================

function renderSetDiagram() {
  const n = state.n;
  const omega = (1 << n) - 1;
  const sa = state.currentSA;
  const generators = state.generators;

  setDiagramChart.innerHTML = '';

  const width = 960;
  const height = 400;

  const svg = d3.select(setDiagramChart)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // Defs for arrowhead
  svg.append('defs').append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', 8)
    .attr('refY', 5)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 z')
    .attr('fill', '#e97319');

  // Element positions: arrange in a circle or line
  const cx = width / 2;
  const cy = height / 2;
  const elemRadius = Math.min(80, 60 + n * 5);
  const elemPositions = [];
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    elemPositions.push({
      x: cx + elemRadius * Math.cos(angle),
      y: cy + elemRadius * Math.sin(angle),
      label: String(i + 1),
      index: i,
    });
  }

  // Draw subset regions as rounded rectangles / ellipses
  // For each non-trivial subset in the sigma-algebra, draw a colored region
  const allSubsets = powerSet(n);
  // Sort subsets by size (larger first) for layering
  const subsetsInSA = allSubsets
    .filter(m => sa.sets.has(m) && m !== 0 && m !== omega)
    .sort((a, b) => popcount(b) - popcount(a));

  // Compute bounding box for subset region
  function subsetBBox(mask) {
    const elems = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) elems.push(elemPositions[i]);
    }
    if (elems.length === 0) return null;
    const xs = elems.map(e => e.x);
    const ys = elems.map(e => e.y);
    const pad = 28;
    return {
      x: d3.min(xs) - pad,
      y: d3.min(ys) - pad,
      w: d3.max(xs) - d3.min(xs) + 2 * pad,
      h: d3.max(ys) - d3.min(ys) + 2 * pad,
      cx: d3.mean(xs),
      cy: d3.mean(ys),
    };
  }

  // Color scale for subsets
  const colorGen = '#e97319';  // orange for generators
  const colorDerived = '#059669';  // green for derived
  const colorTrivial = '#2563eb';  // blue for empty/omega

  // Draw Omega boundary
  svg.append('rect')
    .attr('x', cx - 200)
    .attr('y', cy - 160)
    .attr('width', 400)
    .attr('height', 320)
    .attr('rx', 16)
    .attr('fill', sa.sets.has(omega) ? 'rgba(37, 99, 235, 0.04)' : 'none')
    .attr('stroke', '#2563eb')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '6,3');

  // Label Omega
  svg.append('text')
    .attr('x', cx + 195)
    .attr('y', cy - 145)
    .attr('class', 'set-label')
    .attr('text-anchor', 'end')
    .attr('font-size', 14)
    .text('\u03A9');

  // Draw subset regions
  const subsetGroup = svg.append('g').attr('class', 'subset-regions');

  subsetsInSA.forEach((mask, idx) => {
    const bb = subsetBBox(mask);
    if (!bb) return;

    const isGen = generators.has(mask);
    const color = isGen ? colorGen : colorDerived;
    const opacity = 0.08 + 0.04 * idx;

    const g = subsetGroup.append('g')
      .attr('class', 'set-node' + (sa.sets.has(mask) ? ' in-sigma' : ' not-in-sigma'))
      .style('cursor', 'pointer');

    g.append('ellipse')
      .attr('cx', bb.cx)
      .attr('cy', bb.cy)
      .attr('rx', Math.max(bb.w / 2, 30))
      .attr('ry', Math.max(bb.h / 2, 25))
      .attr('fill', color)
      .attr('fill-opacity', opacity)
      .attr('stroke', color)
      .attr('stroke-width', isGen ? 2.5 : 1.5)
      .attr('stroke-opacity', 0.6);

    // Label the subset
    g.append('text')
      .attr('class', 'set-label')
      .attr('x', bb.cx)
      .attr('y', bb.cy - Math.max(bb.h / 2, 25) - 6)
      .attr('fill', color)
      .attr('font-size', 10)
      .text(formatSubset(mask, n));
  });

  // Draw element points
  const elemGroup = svg.append('g').attr('class', 'elements');

  elemGroup.selectAll('circle.element')
    .data(elemPositions)
    .join('circle')
    .attr('class', 'element')
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .attr('r', 10)
    .attr('fill', '#2563eb')
    .attr('fill-opacity', 0.15)
    .attr('stroke', '#2563eb')
    .attr('stroke-width', 2);

  elemGroup.selectAll('text.element-label')
    .data(elemPositions)
    .join('text')
    .attr('class', 'element-label')
    .attr('x', d => d.x)
    .attr('y', d => d.y + 5)
    .text(d => d.label);

  // Closure animation: show steps as arrows/labels
  if (state.animateClosure && state.currentSA.steps.length > 0) {
    renderClosureAnimation(svg, width, height);
  }

  // Legend
  const legendData = [
    { label: 'Generator', color: colorGen },
    { label: 'Derived', color: colorDerived },
    { label: '\u2205 / \u03A9', color: colorTrivial },
  ];

  const legend = svg.append('g')
    .attr('transform', `translate(20, ${height - 30})`);

  legendData.forEach((d, i) => {
    const lg = legend.append('g').attr('transform', `translate(${i * 110}, 0)`);
    lg.append('rect')
      .attr('width', 12).attr('height', 12).attr('rx', 2)
      .attr('fill', d.color).attr('fill-opacity', 0.3)
      .attr('stroke', d.color).attr('stroke-width', 1.5);
    lg.append('text')
      .attr('x', 18).attr('y', 10)
      .attr('class', 'set-label')
      .attr('text-anchor', 'start')
      .attr('font-size', 11)
      .text(d.label);
  });
}

function renderClosureAnimation(svg, width, height) {
  const steps = state.currentSA.steps;
  if (steps.length === 0) return;

  const stepGroup = svg.append('g')
    .attr('class', 'closure-steps')
    .attr('transform', `translate(${width - 280}, 20)`);

  stepGroup.append('text')
    .attr('x', 0).attr('y', 0)
    .attr('class', 'set-label')
    .attr('font-size', 11)
    .attr('font-weight', 600)
    .text('Closure Steps:');

  const maxShow = Math.min(steps.length, 10);
  steps.slice(0, maxShow).forEach((step, i) => {
    const y = 18 + i * 18;
    let text = '';
    const n = state.n;
    if (step.type === 'complement') {
      text = `${formatSubset(step.inputs[0], n)}\u1D9C = ${formatSubset(step.output, n)}`;
    } else if (step.type === 'union') {
      text = `${formatSubset(step.inputs[0], n)} \u222A ${formatSubset(step.inputs[1], n)} = ${formatSubset(step.output, n)}`;
    } else {
      text = `${formatSubset(step.inputs[0], n)} \u2229 ${formatSubset(step.inputs[1], n)} = ${formatSubset(step.output, n)}`;
    }

    const stepEl = stepGroup.append('text')
      .attr('x', 0).attr('y', y)
      .attr('class', 'set-label')
      .attr('font-size', 10)
      .attr('fill', step.type === 'complement' ? '#7c3aed' : step.type === 'union' ? '#059669' : '#0891b2')
      .text(text)
      .style('opacity', 0);

    stepEl.transition()
      .delay(i * 350)
      .duration(300)
      .style('opacity', 1);
  });

  if (steps.length > maxShow) {
    stepGroup.append('text')
      .attr('x', 0).attr('y', 18 + maxShow * 18)
      .attr('class', 'set-label')
      .attr('font-size', 10)
      .attr('fill', '#555')
      .text(`... and ${steps.length - maxShow} more`);
  }
}

// ============================================================
//  Lattice Panel
// ============================================================

function renderLattice() {
  latticeChart.innerHTML = '';

  if (!state.showLattice) {
    latticePanel.style.display = 'none';
    return;
  }
  latticePanel.style.display = '';

  const allSAs = state.allSAs;
  const edges = state.hasseEdges;
  const n = state.n;

  // If n=5, the lattice is very large (52 sigma-algebras) - show a message
  if (n === 5) {
    latticeChart.innerHTML = '<div style="padding:20px;text-align:center;color:#555;font-family:var(--font-heading);font-size:0.9rem;">' +
      `Lattice has ${allSAs.length} sigma-algebras &mdash; too large to display clearly.<br/>` +
      'Select |&Omega;| &le; 4 for the lattice view.</div>';
    return;
  }

  const currentKey = sigmaKey(state.currentSA.sets);

  // Layout: group by size of sigma-algebra (number of sets)
  // Bottom layer: smallest (trivial {empty, Omega} with size 2)
  // Top layer: power set (size 2^n)
  const sizeLevels = {};
  allSAs.forEach((sa, i) => {
    const sz = sa.sets.size;
    if (!sizeLevels[sz]) sizeLevels[sz] = [];
    sizeLevels[sz].push(i);
  });

  const levels = Object.keys(sizeLevels).map(Number).sort((a, b) => a - b);
  const levelMap = {};  // saIndex -> {level, posInLevel}
  levels.forEach((sz, lvl) => {
    sizeLevels[sz].forEach((saIdx, pos) => {
      levelMap[saIdx] = { level: lvl, posInLevel: pos, totalInLevel: sizeLevels[sz].length };
    });
  });

  const width = 500;
  const levelCount = levels.length;
  const height = Math.max(200, levelCount * 70 + 60);

  const svg = d3.select(latticeChart)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // Compute positions
  const nodePositions = allSAs.map((sa, i) => {
    const info = levelMap[i];
    const y = height - 40 - info.level * ((height - 60) / Math.max(levelCount - 1, 1));
    const spacing = width / (info.totalInLevel + 1);
    const x = spacing * (info.posInLevel + 1);
    return { x, y, index: i, sa };
  });

  // Draw edges
  svg.selectAll('line.lattice-edge')
    .data(edges)
    .join('line')
    .attr('class', 'lattice-edge')
    .attr('x1', d => nodePositions[d[0]].x)
    .attr('y1', d => nodePositions[d[0]].y)
    .attr('x2', d => nodePositions[d[1]].x)
    .attr('y2', d => nodePositions[d[1]].y);

  // Check which is current and which are ancestors
  const currentIdx = allSAs.findIndex(sa => sigmaKey(sa.sets) === currentKey);
  const ancestorSet = new Set();
  if (currentIdx >= 0) {
    // find all subsets of the current sigma-algebra
    for (let i = 0; i < allSAs.length; i++) {
      if (i === currentIdx) continue;
      let isSub = true;
      for (const s of allSAs[i].sets) {
        if (!state.currentSA.sets.has(s)) { isSub = false; break; }
      }
      if (isSub) ancestorSet.add(i);
    }
  }

  // Draw nodes
  const nodeGroup = svg.selectAll('g.lattice-node-group')
    .data(nodePositions)
    .join('g')
    .attr('class', 'lattice-node-group')
    .attr('transform', d => `translate(${d.x}, ${d.y})`)
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      // Select this sigma-algebra: set generators to its atoms
      selectSigmaAlgebra(d.index);
    });

  nodeGroup.append('circle')
    .attr('class', d => {
      const key = sigmaKey(d.sa.sets);
      if (key === currentKey) return 'lattice-node current';
      if (ancestorSet.has(d.index)) return 'lattice-node ancestor';
      return 'lattice-node';
    })
    .attr('r', d => sigmaKey(d.sa.sets) === currentKey ? 8 : 5)
    .attr('fill', d => {
      const key = sigmaKey(d.sa.sets);
      if (key === currentKey) return '#2563eb';
      if (ancestorSet.has(d.index)) return '#93c5fd';
      return '#cbd5e1';
    })
    .attr('stroke', d => {
      const key = sigmaKey(d.sa.sets);
      if (key === currentKey) return '#1d4ed8';
      return '#94a3b8';
    })
    .attr('stroke-width', d => sigmaKey(d.sa.sets) === currentKey ? 2 : 1);

  // Labels: show size
  nodeGroup.append('text')
    .attr('class', 'lattice-label')
    .attr('y', -10)
    .text(d => `|F|=${d.sa.sets.size}`);

  // Tooltip on hover showing contents
  const tooltip = d3.select(latticePanel)
    .append('div')
    .attr('class', 'viz-tooltip')
    .style('position', 'absolute')
    .style('pointer-events', 'none');

  nodeGroup
    .on('mouseenter', (event, d) => {
      const setsList = [...d.sa.sets].sort((a, b) => a - b).map(m => formatSubset(m, state.n));
      tooltip.html(
        `<div class="tooltip-label">|F| = ${d.sa.sets.size}</div>` +
        `<div class="tooltip-value">${setsList.join(', ')}</div>`
      )
        .classed('visible', true)
        .style('left', `${event.offsetX + 12}px`)
        .style('top', `${event.offsetY - 10}px`);
    })
    .on('mouseleave', () => {
      tooltip.classed('visible', false);
    });
}

/**
 * Select a sigma-algebra from the lattice by index.
 * We find generators that produce it: use its atoms as generators.
 */
function selectSigmaAlgebra(index) {
  const sa = state.allSAs[index];
  const n = state.n;
  const omega = (1 << n) - 1;

  // Use atoms as generators (minus trivial singletons equivalent)
  const atoms = sa.atoms || computeAtoms(sa.sets, n);

  state.generators.clear();
  // Add each atom as a generator (skip if it's omega or trivial generates nothing)
  for (const atom of atoms) {
    if (atom !== 0 && atom !== omega) {
      state.generators.add(atom);
    }
  }

  // Update toggle buttons
  const buttons = subsetToggles.querySelectorAll('.subset-toggle-btn');
  buttons.forEach(btn => {
    const m = parseInt(btn.dataset.mask);
    if (state.generators.has(m)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  recompute();
}

// ============================================================
//  Contents Panel
// ============================================================

function renderContents() {
  contentsChart.innerHTML = '';

  const n = state.n;
  const omega = (1 << n) - 1;
  const sa = state.currentSA;
  const generators = state.generators;
  const sortedSets = [...sa.sets].sort((a, b) => {
    // Sort: empty first, then by popcount, then by value, omega last
    if (a === 0) return -1;
    if (b === 0) return 1;
    if (a === omega) return 1;
    if (b === omega) return -1;
    const pa = popcount(a), pb = popcount(b);
    if (pa !== pb) return pa - pb;
    return a - b;
  });

  // Create chips container
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexWrap = 'wrap';
  container.style.gap = '4px';
  container.style.marginBottom = '12px';

  sortedSets.forEach(mask => {
    const chip = document.createElement('span');
    const isTrivial = (mask === 0 || mask === omega);
    const isGen = generators.has(mask);
    chip.className = 'subset-chip' + (isGen ? ' generator' : isTrivial ? '' : ' derived');
    chip.textContent = formatSubset(mask, n);
    container.appendChild(chip);
  });

  contentsChart.appendChild(container);

  // Show atoms / partition
  const atoms = computeAtoms(sa.sets, n);
  const atomDiv = document.createElement('div');
  atomDiv.style.fontFamily = 'var(--font-heading)';
  atomDiv.style.fontSize = '0.85rem';
  atomDiv.style.color = 'var(--color-text-secondary)';
  atomDiv.style.marginTop = '8px';

  if (atoms.length > 0) {
    const atomStrs = atoms.map(a => formatSubset(a, n));
    atomDiv.innerHTML = '<strong>Atoms (partition):</strong> ' + atomStrs.join(' | ');
  } else {
    atomDiv.innerHTML = '<strong>Atoms:</strong> trivial (no non-empty sets)';
  }
  contentsChart.appendChild(atomDiv);

  // Update contents stats
  if (contentsStats) {
    contentsStats.innerHTML = '';
    const items = [
      { label: 'Sets in F', value: sa.sets.size },
      { label: 'Closure steps', value: sa.steps.length },
      { label: 'Atoms', value: atoms.length },
    ];
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'stat-card';
      card.innerHTML = `<div class="stat-value">${item.value}</div><div class="stat-label">${item.label}</div>`;
      contentsStats.appendChild(card);
    });
  }
}

// ============================================================
//  Event Listeners
// ============================================================

omegaSlider.addEventListener('input', () => {
  state.n = parseInt(omegaSlider.value);
  omegaVal.textContent = state.n;
  rebuild();
});

animateCheck.addEventListener('change', () => {
  state.animateClosure = animateCheck.checked;
  recompute();
});

latticeCheck.addEventListener('change', () => {
  state.showLattice = latticeCheck.checked;
  renderLattice();
});

resetBtn.addEventListener('click', () => {
  state.generators.clear();
  const buttons = subsetToggles.querySelectorAll('.subset-toggle-btn');
  buttons.forEach(btn => btn.classList.remove('active'));
  recompute();
});

randomBtn.addEventListener('click', () => {
  const n = state.n;
  const omega = (1 << n) - 1;
  state.generators.clear();

  // Pick a random number of generators (1 to n)
  const count = 1 + Math.floor(Math.random() * n);
  const candidates = [];
  for (let m = 1; m < omega; m++) candidates.push(m);

  // Shuffle and pick
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  for (let i = 0; i < Math.min(count, candidates.length); i++) {
    state.generators.add(candidates[i]);
  }

  // Update buttons
  const buttons = subsetToggles.querySelectorAll('.subset-toggle-btn');
  buttons.forEach(btn => {
    const m = parseInt(btn.dataset.mask);
    if (state.generators.has(m)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  recompute();
});

// ============================================================
//  Initialize
// ============================================================

renderKaTeX();
rebuild();
