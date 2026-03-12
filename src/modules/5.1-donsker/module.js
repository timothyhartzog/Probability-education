import * as d3 from 'd3';
import katex from 'katex';

/* ============================================================
   Module 5.1 — Donsker's Theorem: Random Walk to Brownian Motion
   Full D3.js visualization of scaled random walk convergence
   ============================================================ */

// ── Seedable PRNG (splitmix32 → xoshiro128**) ───────────────
function splitmix32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x9e3779b9) | 0;
    let t = seed ^ (seed >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    t ^= t >>> 15;
    return t >>> 0;
  };
}

class PRNG {
  constructor(seed = 42) {
    this.reseed(seed);
  }
  reseed(s) {
    const sm = splitmix32(s >>> 0);
    this._s = new Uint32Array([sm(), sm(), sm(), sm()]);
    this._spare = null;
  }
  _next() {
    const s = this._s;
    const r =
      (Math.imul(((s[1] * 5) << 7) | ((s[1] * 5) >>> 25), 9) >>> 0);
    const t = s[1] << 9;
    s[2] ^= s[0];
    s[3] ^= s[1];
    s[1] ^= s[2];
    s[0] ^= s[3];
    s[2] ^= t;
    s[3] = ((s[3] << 11) | (s[3] >>> 21)) >>> 0;
    return r;
  }
  random() {
    return this._next() / 0x100000000;
  }
  randomNormal() {
    if (this._spare !== null) {
      const v = this._spare;
      this._spare = null;
      return v;
    }
    let u, v, s;
    do {
      u = 2 * this.random() - 1;
      v = 2 * this.random() - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const f = Math.sqrt((-2 * Math.log(s)) / s);
    this._spare = v * f;
    return u * f;
  }
}

// ── Global RNG instance ─────────────────────────────────────
const rng = new PRNG(Date.now());

// ── State ───────────────────────────────────────────────────
const state = {
  n: 100,
  dist: 'bernoulli',
  numPaths: 5,
  showBM: false,
  showTheory: true,
  playing: false,
};

const PLOT_POINTS = 500;
const SUP_RUNS = 2000;

// ── Visualization palette (colorblind-safe) ─────────────────
const vizColors = [
  '#2563eb', '#e97319', '#059669', '#7c3aed', '#db2777',
  '#0891b2', '#ca8a04', '#64748b', '#dc2626', '#4f46e5',
  '#0d9488', '#b91c1c', '#a16207', '#6d28d9', '#be185d',
  '#0e7490', '#854d0e', '#475569', '#991b1b', '#4338ca',
];

// ── Step distribution samplers (mean 0, variance 1) ─────────
const dists = {
  bernoulli: () => (rng.random() < 0.5 ? 1 : -1),
  normal: () => rng.randomNormal(),
  uniform: () => (rng.random() * 2 - 1) * Math.sqrt(3),
  exponential: () => -Math.log(1 - rng.random()) - 1,
};

const distLabels = {
  bernoulli: 'Bernoulli(\\pm 1)',
  normal: 'N(0,1)',
  uniform: 'U(-\\sqrt{3},\\sqrt{3})',
  exponential: 'Exp(1)-1',
};

// ── Generate scaled random walk W_n(t) ──────────────────────
// Returns array of {x: t, y: W_n(t)} at evenly spaced t values
function generatePath(n, sampler) {
  const sqrtN = Math.sqrt(n);
  const step = Math.max(1, Math.floor(n / PLOT_POINTS));
  const pts = [{ x: 0, y: 0 }];
  let sum = 0;
  for (let k = 1; k <= n; k++) {
    sum += sampler();
    if (k % step === 0 || k === n) {
      pts.push({ x: k / n, y: sum / sqrtN });
    }
  }
  return pts;
}

// ── Generate Brownian motion reference (fine scale) ─────────
function generateBM(resolution = 100000) {
  const dt = 1 / resolution;
  const sqrtDt = Math.sqrt(dt);
  const step = Math.max(1, Math.floor(resolution / PLOT_POINTS));
  const pts = [{ x: 0, y: 0 }];
  let sum = 0;
  for (let k = 1; k <= resolution; k++) {
    sum += sqrtDt * rng.randomNormal();
    if (k % step === 0 || k === resolution) {
      pts.push({ x: k / resolution, y: sum });
    }
  }
  return pts;
}

// ── Compute supremum of a single walk ───────────────────────
function computeSupremum(n, sampler) {
  const sqrtN = Math.sqrt(n);
  let sum = 0;
  let maxVal = 0;
  for (let k = 1; k <= n; k++) {
    sum += sampler();
    const w = sum / sqrtN;
    if (w > maxVal) maxVal = w;
  }
  return maxVal;
}

// ── Theoretical supremum density: f(x) = 2*phi(x), x >= 0 ──
function supDensity(x) {
  if (x < 0) return 0;
  return (2 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

// ── Layout constants ────────────────────────────────────────
const margin = { top: 25, right: 20, bottom: 40, left: 50 };

// ══════════════════════════════════════════════════════════════
//  PATH CHART
// ══════════════════════════════════════════════════════════════
function buildPathChart() {
  const container = d3.select('#path-chart');
  container.selectAll('*').remove();

  const W = 700;
  const H = 380;
  const w = W - margin.left - margin.right;
  const h = H - margin.top - margin.bottom;

  const svg = container
    .append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%')
    .style('max-height', '380px');

  const g = svg
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleLinear().domain([0, 1]).range([0, w]);
  const yScale = d3.scaleLinear().range([h, 0]);

  // Axes groups
  g.append('g')
    .attr('class', 'axis x-axis')
    .attr('transform', `translate(0,${h})`);
  g.append('g').attr('class', 'axis y-axis');

  // Axis labels
  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', w / 2)
    .attr('y', h + 35)
    .attr('text-anchor', 'middle')
    .text('t');

  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -h / 2)
    .attr('y', -38)
    .attr('text-anchor', 'middle')
    .text('Wn(t)');

  // Zero reference line
  const zeroLine = g
    .append('line')
    .attr('class', 'zero-line')
    .attr('x1', 0)
    .attr('x2', w);

  // Layer order: BM reference behind, walks on top
  const bmGroup = g.append('g').attr('class', 'bm-layer');
  const pathsGroup = g.append('g').attr('class', 'walks-layer');

  const line = d3
    .line()
    .x((d) => xScale(d.x))
    .y((d) => yScale(d.y))
    .curve(d3.curveLinear);

  function update() {
    const sampler = dists[state.dist];
    const paths = [];
    for (let i = 0; i < state.numPaths; i++) {
      paths.push(generatePath(state.n, sampler));
    }

    // Collect all Y values for domain
    let allY = paths.flat().map((d) => d.y);

    let bmPath = null;
    if (state.showBM) {
      bmPath = generateBM();
      allY = allY.concat(bmPath.map((d) => d.y));
    }

    const yExt = d3.extent(allY);
    const yPad = Math.max(0.5, (yExt[1] - yExt[0]) * 0.1);
    yScale.domain([yExt[0] - yPad, yExt[1] + yPad]);

    // Update axes
    g.select('.x-axis')
      .transition()
      .duration(200)
      .call(d3.axisBottom(xScale).ticks(10));
    g.select('.y-axis')
      .transition()
      .duration(200)
      .call(d3.axisLeft(yScale).ticks(8));

    // Update zero line
    zeroLine
      .transition()
      .duration(200)
      .attr('y1', yScale(0))
      .attr('y2', yScale(0));

    // BM reference path
    bmGroup.selectAll('path').remove();
    if (bmPath) {
      bmGroup
        .append('path')
        .datum(bmPath)
        .attr('class', 'bm-reference-path')
        .attr('d', line);
    }

    // Walk paths
    const sel = pathsGroup.selectAll('.walk-path').data(paths);
    sel.exit().remove();
    sel
      .enter()
      .append('path')
      .attr('class', 'walk-path')
      .merge(sel)
      .attr('stroke', (_, i) => vizColors[i % vizColors.length])
      .transition()
      .duration(200)
      .attr('d', line);

    // Update legend
    updateLegend(paths.length, state.showBM);
  }

  return { update };
}

function updateLegend(numPaths, showBM) {
  const legendEl = document.getElementById('path-legend');
  if (!legendEl) return;
  let html = '';
  for (let i = 0; i < numPaths; i++) {
    html += `<span class="legend-item">
      <span class="legend-swatch" style="background:${vizColors[i % vizColors.length]}"></span>
      Path ${i + 1}
    </span>`;
  }
  if (showBM) {
    html += `<span class="legend-item">
      <span class="legend-swatch" style="background:var(--color-error); opacity:0.7; border:1px dashed var(--color-error);"></span>
      BM Reference
    </span>`;
  }
  legendEl.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════
//  SUPREMUM CHART
// ══════════════════════════════════════════════════════════════
function buildSupremumChart() {
  const container = d3.select('#supremum-chart');
  container.selectAll('*').remove();

  const W = 700;
  const H = 300;
  const w = W - margin.left - margin.right;
  const h = H - margin.top - margin.bottom;

  const svg = container
    .append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%')
    .style('max-height', '300px');

  const g = svg
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleLinear().range([0, w]);
  const yScale = d3.scaleLinear().range([h, 0]);

  g.append('g')
    .attr('class', 'axis x-axis')
    .attr('transform', `translate(0,${h})`);
  g.append('g').attr('class', 'axis y-axis');

  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', w / 2)
    .attr('y', h + 35)
    .attr('text-anchor', 'middle')
    .text('sup Wn(t)');

  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -h / 2)
    .attr('y', -38)
    .attr('text-anchor', 'middle')
    .text('Density');

  const barsGroup = g.append('g').attr('class', 'bars-layer');
  const theoryGroup = g.append('g').attr('class', 'theory-layer');

  function update() {
    const sampler = dists[state.dist];

    // Simulate suprema
    const sups = [];
    for (let i = 0; i < SUP_RUNS; i++) {
      sups.push(computeSupremum(state.n, sampler));
    }

    // Set up scales
    const xMax = Math.max(3, d3.max(sups) * 1.1);
    xScale.domain([0, xMax]);

    const bins = d3.bin().domain([0, xMax]).thresholds(40)(sups);

    // Compute density values for each bin
    const densityBins = bins.map((b) => ({
      x0: b.x0,
      x1: b.x1,
      density: b.length / (SUP_RUNS * (b.x1 - b.x0)),
    }));

    const maxDensity = Math.max(
      d3.max(densityBins, (d) => d.density) || 1,
      state.showTheory ? supDensity(0) * 1.05 : 0
    );
    yScale.domain([0, maxDensity * 1.15]);

    // Update axes
    g.select('.x-axis')
      .transition()
      .duration(250)
      .call(d3.axisBottom(xScale).ticks(8));
    g.select('.y-axis')
      .transition()
      .duration(250)
      .call(d3.axisLeft(yScale).ticks(6).tickFormat(d3.format('.2f')));

    // Histogram bars
    const binWidth =
      bins.length > 0 ? xScale(bins[0].x1) - xScale(bins[0].x0) : 1;

    const sel = barsGroup.selectAll('.sup-bar').data(densityBins);
    sel.exit().remove();
    sel
      .enter()
      .append('rect')
      .attr('class', 'sup-bar')
      .merge(sel)
      .transition()
      .duration(300)
      .attr('x', (d) => xScale(d.x0))
      .attr('width', Math.max(1, binWidth - 1))
      .attr('y', (d) => yScale(d.density))
      .attr('height', (d) => h - yScale(d.density))
      .attr('fill', '#2563eb')
      .attr('opacity', 0.55);

    // Theoretical density overlay
    theoryGroup.selectAll('path').remove();
    if (state.showTheory) {
      const pts = [];
      for (let i = 0; i <= 200; i++) {
        const x = (i / 200) * xMax;
        pts.push({ x, y: supDensity(x) });
      }
      const theLine = d3
        .line()
        .x((d) => xScale(d.x))
        .y((d) => yScale(d.y))
        .curve(d3.curveMonotoneX);
      theoryGroup
        .append('path')
        .datum(pts)
        .attr('class', 'theory-curve')
        .attr('d', theLine);
    }

    // Stats readout
    const mean = d3.mean(sups);
    const sd = d3.deviation(sups);
    const theoMean = Math.sqrt(2 / Math.PI); // E[sup_{0<=t<=1} B_t] = E[|N(0,1)|] = sqrt(2/pi)
    const theoSD = Math.sqrt(1 - 2 / Math.PI);

    const statsEl = document.getElementById('supremum-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="stat-item">
          <span class="stat-label">Sample mean</span>
          <span class="stat-val">${mean.toFixed(4)}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Theo. mean</span>
          <span class="stat-val">${theoMean.toFixed(4)}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Sample SD</span>
          <span class="stat-val">${sd.toFixed(4)}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Theo. SD</span>
          <span class="stat-val">${theoSD.toFixed(4)}</span>
        </div>
      `;
    }
  }

  return { update };
}

// ══════════════════════════════════════════════════════════════
//  KaTeX FORMULAS
// ══════════════════════════════════════════════════════════════
function renderFormulas() {
  const formulas = {
    'path-formula':
      `W_n(t) = \\frac{S_{\\lfloor nt \\rfloor}}{\\sqrt{n}},\\quad n = ${state.n.toLocaleString()},\\quad X_i \\sim \\text{${distLabels[state.dist]}}`,
    'info-donsker-def':
      'W_n(t) = \\frac{S_{\\lfloor nt \\rfloor}}{\\sqrt{n}} \\xrightarrow{\\;d\\;} B_t \\quad \\text{in } C[0,1] \\text{ as } n \\to \\infty',
    'info-scaling-def':
      'W_n(t) = \\frac{1}{\\sqrt{n}} \\sum_{i=1}^{\\lfloor nt \\rfloor} X_i, \\quad \\mathbb{E}[X_i] = 0,\\; \\operatorname{Var}(X_i) = 1',
    'info-supremum-def':
      '\\sup_{0 \\le t \\le 1} W_n(t) \\xrightarrow{\\;d\\;} \\sup_{0 \\le t \\le 1} B_t, \\quad \\mathbb{P}\\!\\left(\\sup_{0 \\le t \\le 1} B_t \\le x\\right) = 2\\Phi(x) - 1,\\; x \\ge 0',
  };

  for (const [id, tex] of Object.entries(formulas)) {
    const el = document.getElementById(id);
    if (el) {
      katex.render(tex, el, { displayMode: true, throwOnError: false });
    }
  }
}

// ══════════════════════════════════════════════════════════════
//  ANIMATION (n from 10 → 10000)
// ══════════════════════════════════════════════════════════════
let animFrame = null;

function animateN(pathChart, supChart) {
  const playBtn = document.getElementById('play-btn');
  const slider = document.getElementById('n-slider');

  if (state.playing) {
    // Stop
    state.playing = false;
    if (animFrame) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
    playBtn.classList.remove('playing');
    playBtn.innerHTML = '<span class="play-icon"></span> Animate n';
    return;
  }

  // Start animation
  state.playing = true;
  playBtn.classList.add('playing');
  playBtn.innerHTML = '<span class="play-icon"></span> Stop';

  // Reseed for consistent paths during animation
  rng.reseed(Date.now());

  const startLog = 1; // n = 10
  const endLog = 4; // n = 10000
  const duration = 6000; // ms
  const startTime = performance.now();

  function step(time) {
    if (!state.playing) return;

    const elapsed = time - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease in-out cubic
    const eased =
      progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    const logN = startLog + (endLog - startLog) * eased;
    const n = Math.round(Math.pow(10, logN));

    state.n = n;
    slider.value = logN;
    document.getElementById('n-slider-val').textContent = n.toLocaleString();
    document.getElementById('n-display').textContent = `n = ${n.toLocaleString()}`;

    // Use fixed seed per frame so paths evolve smoothly
    rng.reseed(42 + Math.round(logN * 100));
    pathChart.update();
    supChart.update();
    renderFormulas();

    if (progress < 1) {
      animFrame = requestAnimationFrame(step);
    } else {
      state.playing = false;
      playBtn.classList.remove('playing');
      playBtn.innerHTML = '<span class="play-icon"></span> Animate n';
      animFrame = null;
    }
  }

  animFrame = requestAnimationFrame(step);
}

// ══════════════════════════════════════════════════════════════
//  INITIALIZATION & CONTROL WIRING
// ══════════════════════════════════════════════════════════════
const pathChart = buildPathChart();
const supChart = buildSupremumChart();

function fullUpdate() {
  rng.reseed(Date.now());
  pathChart.update();
  supChart.update();
  renderFormulas();
}

// n slider (log scale: 1..5 → 10..100000)
document.getElementById('n-slider').addEventListener('input', (e) => {
  const logN = parseFloat(e.target.value);
  state.n = Math.round(Math.pow(10, logN));
  document.getElementById('n-slider-val').textContent = state.n.toLocaleString();
  document.getElementById('n-display').textContent = `n = ${state.n.toLocaleString()}`;
  fullUpdate();
});

// Step distribution dropdown
document.getElementById('step-dist').addEventListener('change', (e) => {
  state.dist = e.target.value;
  fullUpdate();
});

// Number of paths slider
document.getElementById('num-paths').addEventListener('input', (e) => {
  state.numPaths = parseInt(e.target.value);
  document.getElementById('num-paths-val').textContent = state.numPaths;
  fullUpdate();
});

// Toggle: show Brownian motion reference
document.getElementById('show-bm').addEventListener('change', (e) => {
  state.showBM = e.target.checked;
  pathChart.update();
  updateLegend(state.numPaths, state.showBM);
});

// Toggle: show theoretical supremum density
document.getElementById('show-theory').addEventListener('change', (e) => {
  state.showTheory = e.target.checked;
  supChart.update();
});

// Regenerate button
document.getElementById('regenerate-btn').addEventListener('click', fullUpdate);

// Play / animate button
document.getElementById('play-btn').addEventListener('click', () => {
  animateN(pathChart, supChart);
});

// Handle window resize
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const pc = buildPathChart();
    const sc = buildSupremumChart();
    // Rebind the chart objects (need closure update)
    Object.assign(pathChart, pc);
    Object.assign(supChart, sc);
    fullUpdate();
  }, 250);
});

// Initial render
fullUpdate();
