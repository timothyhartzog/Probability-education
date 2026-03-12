/* ============================================================
   Module 5.2 — Brownian Motion Properties Studio
   Full D3.js visualization with four tabs: Path Explorer,
   Self-Similarity, Quadratic Variation, Arcsine Laws.
   ============================================================ */

import * as d3 from 'd3';
import katex from 'katex';

/* ---- Seedable PRNG (xoshiro128**) ------------------------------ */
function makeRng(seed) {
  let s = [
    seed | 0,
    (seed * 1597334677) | 0,
    (seed * 2013368947) | 0,
    (seed * 1013904223) | 0
  ];
  function rotl(x, k) {
    return ((x << k) | (x >>> (32 - k))) >>> 0;
  }
  function next() {
    const result = (rotl((s[1] * 5) >>> 0, 7) * 9) >>> 0;
    const t = (s[1] << 9) >>> 0;
    s[2] ^= s[0];
    s[3] ^= s[1];
    s[1] ^= s[2];
    s[0] ^= s[3];
    s[2] ^= t;
    s[3] = rotl(s[3], 11);
    return result;
  }
  for (let i = 0; i < 20; i++) next();
  return {
    random() {
      return next() / 4294967296;
    },
    normal() {
      const u1 = (next() + 1) / 4294967297;
      const u2 = next() / 4294967296;
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }
  };
}

/* ---- Brownian motion generation -------------------------------- */
function generateBM(rng, T, numPoints) {
  const dt = T / numPoints;
  const sqrtDt = Math.sqrt(dt);
  const path = new Array(numPoints + 1);
  path[0] = { t: 0, value: 0 };
  let val = 0;
  for (let i = 1; i <= numPoints; i++) {
    val += sqrtDt * rng.normal();
    path[i] = { t: i * dt, value: val };
  }
  return path;
}

/* ---- Palette --------------------------------------------------- */
const VIZ_COLORS = ['#2563eb', '#e97319', '#059669', '#7c3aed', '#db2777'];

/* ---- Chart dimensions ------------------------------------------ */
const MARGIN = { top: 20, right: 30, bottom: 45, left: 55 };

function chartDims(container) {
  const w = container.clientWidth || 700;
  const h = Math.min(400, Math.max(280, w * 0.5));
  return {
    width: w,
    height: h,
    innerWidth: w - MARGIN.left - MARGIN.right,
    innerHeight: h - MARGIN.top - MARGIN.bottom
  };
}

/* ---- Linear interpolation of path ------------------------------ */
function interpolatePath(path, t) {
  if (t <= 0) return path[0].value;
  if (t >= path[path.length - 1].t) return path[path.length - 1].value;
  let lo = 0;
  let hi = path.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const frac = (t - path[lo].t) / (path[hi].t - path[lo].t);
  return path[lo].value + frac * (path[hi].value - path[lo].value);
}

/* ---- State ----------------------------------------------------- */
const state = {
  activeTab: 'path-explorer',
  seed: 42,
  peTimeHorizon: 1,
  peNumPoints: 5000,
  peNumPaths: 1,
  ssScalingFactor: 2.0,
  ssSeed: 42,
  qvPartitionPoints: 100,
  qvSeed: 42,
  alNumSims: 5000,
  alSeed: 42,
  pePaths: null,
  ssBasePath: null,
  qvPath: null,
  alFractions: null
};

/* ---- DOM refs -------------------------------------------------- */
const dom = {};

function cacheDom() {
  dom.tabBar = document.getElementById('tab-bar');
  dom.tabs = dom.tabBar.querySelectorAll('.tab');
  dom.tabContents = document.querySelectorAll('.tab-content');
  dom.tabControls = document.querySelectorAll('.tab-controls');

  dom.peTimeHorizon = document.getElementById('pe-time-horizon');
  dom.peTimeHorizonVal = document.getElementById('pe-time-horizon-val');
  dom.peNumPoints = document.getElementById('pe-num-points');
  dom.peNumPointsVal = document.getElementById('pe-num-points-val');
  dom.peNumPaths = document.getElementById('pe-num-paths');
  dom.peNumPathsVal = document.getElementById('pe-num-paths-val');
  dom.peRegenBtn = document.getElementById('pe-regenerate-btn');

  dom.ssScalingFactor = document.getElementById('ss-scaling-factor');
  dom.ssScalingFactorVal = document.getElementById('ss-scaling-factor-val');
  dom.ssRegenBtn = document.getElementById('ss-regenerate-btn');

  dom.qvPartitionPoints = document.getElementById('qv-partition-points');
  dom.qvPartitionPointsVal = document.getElementById('qv-partition-points-val');
  dom.qvRegenBtn = document.getElementById('qv-regenerate-btn');

  dom.alNumSims = document.getElementById('al-num-sims');
  dom.alNumSimsVal = document.getElementById('al-num-sims-val');
  dom.alRegenBtn = document.getElementById('al-regenerate-btn');

  dom.peChart = document.getElementById('path-explorer-chart');
  dom.ssChart = document.getElementById('self-similarity-chart');
  dom.qvChart = document.getElementById('qv-chart');
  dom.alChart = document.getElementById('arcsine-chart');

  dom.peStats = document.getElementById('path-explorer-stats');
  dom.qvStats = document.getElementById('qv-stats');
  dom.alStats = document.getElementById('arcsine-stats');

  dom.peFormula = document.getElementById('path-explorer-formula');
  dom.ssFormula = document.getElementById('self-similarity-formula');
  dom.qvFormula = document.getElementById('qv-formula');
  dom.alFormula = document.getElementById('arcsine-formula');

  dom.infoBmDef = document.getElementById('info-bm-def');
  dom.infoSsDef = document.getElementById('info-ss-def');
  dom.infoQvDef = document.getElementById('info-qv-def');
  dom.infoArcsineDef = document.getElementById('info-arcsine-def');
}

/* ---- Tab switching --------------------------------------------- */
function switchTab(tabId) {
  state.activeTab = tabId;
  dom.tabs.forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  dom.tabContents.forEach(function (panel) {
    panel.classList.toggle('active', panel.id === 'tab-' + tabId);
  });
  dom.tabControls.forEach(function (ctrl) {
    ctrl.classList.toggle('active', ctrl.id === 'controls-' + tabId);
  });
  renderActiveTab();
}

function renderActiveTab() {
  switch (state.activeTab) {
    case 'path-explorer':
      renderPathExplorer();
      break;
    case 'self-similarity':
      renderSelfSimilarity();
      break;
    case 'quadratic-variation':
      renderQuadraticVariation();
      break;
    case 'arcsine-laws':
      renderArcsine();
      break;
  }
}

/* ================================================================
   TAB 1: PATH EXPLORER
   ================================================================ */

function generatePathExplorerData() {
  var rng = makeRng(state.seed);
  var paths = [];
  for (var i = 0; i < state.peNumPaths; i++) {
    paths.push(generateBM(rng, state.peTimeHorizon, state.peNumPoints));
  }
  state.pePaths = paths;
}

function renderPathExplorer() {
  if (!state.pePaths) generatePathExplorerData();
  var paths = state.pePaths;
  var container = dom.peChart;
  container.innerHTML = '';

  var dims = chartDims(container);
  var width = dims.width;
  var height = dims.height;
  var innerWidth = dims.innerWidth;
  var innerHeight = dims.innerHeight;

  var svg = d3.select(container)
    .append('svg')
    .attr('viewBox', '0 0 ' + width + ' ' + height)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  svg.append('defs')
    .append('clipPath')
    .attr('id', 'pe-clip')
    .append('rect')
    .attr('width', innerWidth)
    .attr('height', innerHeight);

  var g = svg.append('g')
    .attr('transform', 'translate(' + MARGIN.left + ',' + MARGIN.top + ')');

  var T = state.peTimeHorizon;
  var allValues = [];
  paths.forEach(function (p) {
    p.forEach(function (d) { allValues.push(d.value); });
  });
  var yMin = d3.min(allValues);
  var yMax = d3.max(allValues);
  var yPad = (yMax - yMin) * 0.1 || 1;

  var xScale = d3.scaleLinear().domain([0, T]).range([0, innerWidth]);
  var yScale = d3.scaleLinear().domain([yMin - yPad, yMax + yPad]).range([innerHeight, 0]);

  var xAxisG = g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', 'translate(0,' + innerHeight + ')')
    .call(d3.axisBottom(xScale).ticks(8));

  var yAxisG = g.append('g')
    .attr('class', 'y-axis')
    .call(d3.axisLeft(yScale).ticks(6));

  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight + 38)
    .attr('text-anchor', 'middle')
    .text('t');

  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerHeight / 2)
    .attr('y', -42)
    .attr('text-anchor', 'middle')
    .text('B(t)');

  g.append('line')
    .attr('class', 'reference-line')
    .attr('x1', 0)
    .attr('x2', innerWidth)
    .attr('y1', yScale(0))
    .attr('y2', yScale(0));

  var plotG = g.append('g').attr('clip-path', 'url(#pe-clip)');

  var line = d3.line()
    .x(function (d) { return xScale(d.t); })
    .y(function (d) { return yScale(d.value); });

  paths.forEach(function (path, i) {
    plotG.append('path')
      .datum(path)
      .attr('class', 'bm-path')
      .attr('d', line)
      .attr('stroke', VIZ_COLORS[i % VIZ_COLORS.length]);
  });

  // Zoom
  var zoom = d3.zoom()
    .scaleExtent([1, 200])
    .translateExtent([[0, 0], [innerWidth, innerHeight]])
    .extent([[0, 0], [innerWidth, innerHeight]])
    .on('zoom', function (event) {
      var newX = event.transform.rescaleX(xScale);
      var newY = event.transform.rescaleY(yScale);
      xAxisG.call(d3.axisBottom(newX).ticks(8));
      yAxisG.call(d3.axisLeft(newY).ticks(6));
      var zoomedLine = d3.line()
        .x(function (d) { return newX(d.t); })
        .y(function (d) { return newY(d.value); });
      plotG.selectAll('.bm-path').attr('d', zoomedLine);
    });

  svg.append('rect')
    .attr('x', MARGIN.left)
    .attr('y', MARGIN.top)
    .attr('width', innerWidth)
    .attr('height', innerHeight)
    .attr('fill', 'none')
    .attr('pointer-events', 'all')
    .call(zoom);

  var hint = document.createElement('div');
  hint.className = 'zoom-hint';
  hint.textContent = 'Scroll to zoom, drag to pan \u2014 the path looks equally rough at every scale';
  container.appendChild(hint);

  // Stats
  var statsHtml = '';
  paths.forEach(function (path, i) {
    var vals = path.map(function (d) { return d.value; });
    var mn = d3.min(vals).toFixed(3);
    var mx = d3.max(vals).toFixed(3);
    var fin = vals[vals.length - 1].toFixed(3);
    var color = VIZ_COLORS[i % VIZ_COLORS.length];
    statsHtml += '<div class="stat-card">' +
      '<div class="stat-value" style="color:' + color + '">Path ' + (i + 1) + '</div>' +
      '<div class="stat-label">min ' + mn + ' / max ' + mx + ' / B(T) = ' + fin + '</div>' +
      '</div>';
  });
  dom.peStats.innerHTML = statsHtml;

  katex.render(
    'B_t = \\sum_{i=1}^{n} \\sqrt{\\Delta t}\\, Z_i, \\quad Z_i \\sim \\mathcal{N}(0,1), \\quad \\Delta t = T/n',
    dom.peFormula,
    { displayMode: true, throwOnError: false }
  );
}

/* ================================================================
   TAB 2: SELF-SIMILARITY
   ================================================================ */

function generateSelfSimilarityData() {
  var rng = makeRng(state.ssSeed);
  var a = state.ssScalingFactor;
  var maxT = Math.max(1, a * a);
  state.ssBasePath = generateBM(rng, maxT, 10000);
}

function renderSelfSimilarity() {
  if (!state.ssBasePath) generateSelfSimilarityData();

  var container = dom.ssChart;
  container.innerHTML = '';

  var a = state.ssScalingFactor;
  var basePath = state.ssBasePath;

  // Original path: B_t on [0,1]
  var original = basePath.filter(function (d) { return d.t <= 1.0001; });

  // Rescaled: a * B_{t/a^2} on [0,1]
  var numRescaled = 2000;
  var rescaled = [];
  var dt = 1 / numRescaled;
  for (var i = 0; i <= numRescaled; i++) {
    var t = i * dt;
    var baseT = t / (a * a);
    var val = interpolatePath(basePath, baseT);
    rescaled.push({ t: t, value: a * val });
  }

  var dims = chartDims(container);
  var width = dims.width;
  var height = dims.height;
  var innerWidth = dims.innerWidth;
  var innerHeight = dims.innerHeight;

  var svg = d3.select(container)
    .append('svg')
    .attr('viewBox', '0 0 ' + width + ' ' + height)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  var g = svg.append('g')
    .attr('transform', 'translate(' + MARGIN.left + ',' + MARGIN.top + ')');

  var allVals = original.map(function (d) { return d.value; })
    .concat(rescaled.map(function (d) { return d.value; }));
  var yMin = d3.min(allVals);
  var yMax = d3.max(allVals);
  var yPad = (yMax - yMin) * 0.1 || 1;

  var xScale = d3.scaleLinear().domain([0, 1]).range([0, innerWidth]);
  var yScale = d3.scaleLinear().domain([yMin - yPad, yMax + yPad]).range([innerHeight, 0]);

  g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', 'translate(0,' + innerHeight + ')')
    .call(d3.axisBottom(xScale).ticks(8));

  g.append('g')
    .attr('class', 'y-axis')
    .call(d3.axisLeft(yScale).ticks(6));

  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight + 38)
    .attr('text-anchor', 'middle')
    .text('t');

  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerHeight / 2)
    .attr('y', -42)
    .attr('text-anchor', 'middle')
    .text('Value');

  g.append('line')
    .attr('class', 'reference-line')
    .attr('x1', 0)
    .attr('x2', innerWidth)
    .attr('y1', yScale(0))
    .attr('y2', yScale(0));

  var line = d3.line()
    .x(function (d) { return xScale(d.t); })
    .y(function (d) { return yScale(d.value); });

  g.append('path')
    .datum(original)
    .attr('class', 'bm-path')
    .attr('d', line)
    .attr('stroke', VIZ_COLORS[0]);

  g.append('path')
    .datum(rescaled)
    .attr('class', 'bm-path-rescaled')
    .attr('d', line)
    .attr('stroke', VIZ_COLORS[1]);

  var legendDiv = document.createElement('div');
  legendDiv.className = 'chart-legend';
  legendDiv.innerHTML =
    '<span class="legend-item">' +
      '<span class="legend-line" style="background:' + VIZ_COLORS[0] + '"></span>' +
      'B(t) on [0,1]' +
    '</span>' +
    '<span class="legend-item">' +
      '<span class="legend-line-dashed" style="border-color:' + VIZ_COLORS[1] + '"></span>' +
      'a &middot; B(t/a&sup2;) on [0,1]' +
    '</span>';
  container.appendChild(legendDiv);

  katex.render(
    '\\{B_t\\}_{t \\in [0,1]} \\;\\stackrel{d}{=}\\; \\{a \\cdot B_{t/a^2}\\}_{t \\in [0,1]}, \\quad a = ' + a.toFixed(1),
    dom.ssFormula,
    { displayMode: true, throwOnError: false }
  );
}

/* ================================================================
   TAB 3: QUADRATIC VARIATION
   ================================================================ */

function generateQVData() {
  var rng = makeRng(state.qvSeed);
  state.qvPath = generateBM(rng, 1, 50000);
}

function renderQuadraticVariation() {
  if (!state.qvPath) generateQVData();

  var container = dom.qvChart;
  container.innerHTML = '';

  var finePath = state.qvPath;
  var numPartition = state.qvPartitionPoints;

  var qvData = [{ t: 0, qv: 0 }];
  var qvSum = 0;
  var maxIncrement = 0;
  var partDt = 1 / numPartition;

  for (var i = 0; i < numPartition; i++) {
    var tPrev = i * partDt;
    var tNext = (i + 1) * partDt;
    var vPrev = interpolatePath(finePath, tPrev);
    var vNext = interpolatePath(finePath, tNext);
    var inc = vNext - vPrev;
    qvSum += inc * inc;
    maxIncrement = Math.max(maxIncrement, Math.abs(inc));
    qvData.push({ t: tNext, qv: qvSum });
  }

  var dims = chartDims(container);
  var width = dims.width;
  var height = dims.height;
  var innerWidth = dims.innerWidth;
  var innerHeight = dims.innerHeight;

  var svg = d3.select(container)
    .append('svg')
    .attr('viewBox', '0 0 ' + width + ' ' + height)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  var g = svg.append('g')
    .attr('transform', 'translate(' + MARGIN.left + ',' + MARGIN.top + ')');

  var yMaxVal = Math.max(d3.max(qvData, function (d) { return d.qv; }), 1.2);
  var xScale = d3.scaleLinear().domain([0, 1]).range([0, innerWidth]);
  var yScale = d3.scaleLinear().domain([0, yMaxVal]).range([innerHeight, 0]);

  g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', 'translate(0,' + innerHeight + ')')
    .call(d3.axisBottom(xScale).ticks(8));

  g.append('g')
    .attr('class', 'y-axis')
    .call(d3.axisLeft(yScale).ticks(6));

  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight + 38)
    .attr('text-anchor', 'middle')
    .text('t');

  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerHeight / 2)
    .attr('y', -42)
    .attr('text-anchor', 'middle')
    .text('[B]_t');

  // Reference line y = t
  g.append('line')
    .attr('class', 'qv-reference')
    .attr('x1', xScale(0))
    .attr('y1', yScale(0))
    .attr('x2', xScale(1))
    .attr('y2', yScale(1));

  var qvLine = d3.line()
    .x(function (d) { return xScale(d.t); })
    .y(function (d) { return yScale(d.qv); });

  g.append('path')
    .datum(qvData)
    .attr('class', 'qv-path')
    .attr('d', qvLine);

  var legendDiv = document.createElement('div');
  legendDiv.className = 'chart-legend';
  legendDiv.innerHTML =
    '<span class="legend-item">' +
      '<span class="legend-line" style="background:' + VIZ_COLORS[0] + '"></span>' +
      '[B]_t (quadratic variation)' +
    '</span>' +
    '<span class="legend-item">' +
      '<span class="legend-line-dashed" style="border-color:#e97319"></span>' +
      'y = t (theoretical limit)' +
    '</span>';
  container.appendChild(legendDiv);

  dom.qvStats.innerHTML =
    '<div class="stat-card">' +
      '<div class="stat-value">' + qvSum.toFixed(4) + '</div>' +
      '<div class="stat-label">[B]_1 (should be ~1)</div>' +
    '</div>' +
    '<div class="stat-card">' +
      '<div class="stat-value">' + maxIncrement.toFixed(4) + '</div>' +
      '<div class="stat-label">Max |increment|</div>' +
    '</div>' +
    '<div class="stat-card">' +
      '<div class="stat-value">' + numPartition + '</div>' +
      '<div class="stat-label">Partition points</div>' +
    '</div>';

  katex.render(
    '[B]_t = \\lim_{|\\Pi| \\to 0} \\sum_{i} (B_{t_{i+1}} - B_{t_i})^2 = t',
    dom.qvFormula,
    { displayMode: true, throwOnError: false }
  );
}

/* ================================================================
   TAB 4: ARCSINE LAWS
   ================================================================ */

function generateArcsineData() {
  var rng = makeRng(state.alSeed);
  var numSims = state.alNumSims;
  var numPoints = 1000;
  var fractions = new Float64Array(numSims);

  for (var s = 0; s < numSims; s++) {
    var dt = 1 / numPoints;
    var sqrtDt = Math.sqrt(dt);
    var val = 0;
    var posCount = 0;
    for (var i = 1; i <= numPoints; i++) {
      val += sqrtDt * rng.normal();
      if (val > 0) posCount++;
    }
    fractions[s] = posCount / numPoints;
  }
  state.alFractions = fractions;
}

function renderArcsine() {
  if (!state.alFractions) generateArcsineData();

  var container = dom.alChart;
  container.innerHTML = '';

  var fractions = state.alFractions;
  var dims = chartDims(container);
  var width = dims.width;
  var height = dims.height;
  var innerWidth = dims.innerWidth;
  var innerHeight = dims.innerHeight;

  var svg = d3.select(container)
    .append('svg')
    .attr('viewBox', '0 0 ' + width + ' ' + height)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  var g = svg.append('g')
    .attr('transform', 'translate(' + MARGIN.left + ',' + MARGIN.top + ')');

  var bins = d3.bin()
    .domain([0, 1])
    .thresholds(d3.range(0, 1.01, 0.02))(Array.from(fractions));

  var binWidth = bins[0].x1 - bins[0].x0;
  var n = fractions.length;
  var maxDensity = d3.max(bins, function (b) {
    return b.length / (n * binWidth);
  });

  var arcsinePoints = [];
  for (var x = 0.005; x < 1; x += 0.005) {
    var density = 1 / (Math.PI * Math.sqrt(x * (1 - x)));
    arcsinePoints.push({ x: x, density: density });
  }
  var maxArcsine = d3.max(arcsinePoints, function (d) { return d.density; });
  var yMax = Math.max(maxDensity, Math.min(maxArcsine, 8)) * 1.1;

  var xScale = d3.scaleLinear().domain([0, 1]).range([0, innerWidth]);
  var yScale = d3.scaleLinear().domain([0, yMax]).range([innerHeight, 0]);

  g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', 'translate(0,' + innerHeight + ')')
    .call(d3.axisBottom(xScale).ticks(10));

  g.append('g')
    .attr('class', 'y-axis')
    .call(d3.axisLeft(yScale).ticks(6));

  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight + 38)
    .attr('text-anchor', 'middle')
    .text('Fraction of time B(t) > 0');

  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerHeight / 2)
    .attr('y', -42)
    .attr('text-anchor', 'middle')
    .text('Density');

  g.selectAll('.hist-bar')
    .data(bins)
    .join('rect')
    .attr('class', 'hist-bar')
    .attr('x', function (d) { return xScale(d.x0) + 1; })
    .attr('width', function (d) { return Math.max(0, xScale(d.x1) - xScale(d.x0) - 1); })
    .attr('y', function (d) { return yScale(d.length / (n * binWidth)); })
    .attr('height', function (d) { return innerHeight - yScale(d.length / (n * binWidth)); });

  var densityLine = d3.line()
    .x(function (d) { return xScale(d.x); })
    .y(function (d) { return yScale(Math.min(d.density, yMax)); });

  g.append('path')
    .datum(arcsinePoints)
    .attr('class', 'arcsine-density')
    .attr('d', densityLine);

  var legendDiv = document.createElement('div');
  legendDiv.className = 'chart-legend';
  legendDiv.innerHTML =
    '<span class="legend-item">' +
      '<span class="legend-line" style="background:#2563eb; opacity:0.7"></span>' +
      'Simulated histogram' +
    '</span>' +
    '<span class="legend-item">' +
      '<span class="legend-line" style="background:#dc2626"></span>' +
      'Arcsine density f(x) = 1/(&pi;&radic;(x(1-x)))' +
    '</span>';
  container.appendChild(legendDiv);

  var mean = d3.mean(fractions).toFixed(3);
  var sortedArr = Array.from(fractions).sort(function (a, b) { return a - b; });
  var median = d3.median(sortedArr).toFixed(3);
  var std = d3.deviation(fractions).toFixed(3);

  dom.alStats.innerHTML =
    '<div class="stat-card">' +
      '<div class="stat-value">' + mean + '</div>' +
      '<div class="stat-label">Mean fraction</div>' +
    '</div>' +
    '<div class="stat-card">' +
      '<div class="stat-value">' + median + '</div>' +
      '<div class="stat-label">Median fraction</div>' +
    '</div>' +
    '<div class="stat-card">' +
      '<div class="stat-value">' + std + '</div>' +
      '<div class="stat-label">Std dev</div>' +
    '</div>';

  katex.render(
    'f(x) = \\frac{1}{\\pi \\sqrt{x(1-x)}}, \\quad 0 < x < 1',
    dom.alFormula,
    { displayMode: true, throwOnError: false }
  );
}

/* ================================================================
   INFO PANEL FORMULAS
   ================================================================ */

function renderInfoFormulas() {
  if (dom.infoBmDef) {
    katex.render(
      'B_0 = 0, \\quad B_t - B_s \\sim \\mathcal{N}(0, t-s) \\text{ for } 0 \\le s < t, \\quad \\text{independent increments}',
      dom.infoBmDef,
      { displayMode: true, throwOnError: false }
    );
  }
  if (dom.infoSsDef) {
    katex.render(
      '\\{B_{at}\\}_{t \\ge 0} \\;\\stackrel{d}{=}\\; \\{\\sqrt{a}\\, B_t\\}_{t \\ge 0} \\quad \\forall\\, a > 0',
      dom.infoSsDef,
      { displayMode: true, throwOnError: false }
    );
  }
  if (dom.infoQvDef) {
    katex.render(
      '[B]_t = \\lim_{|\\Pi| \\to 0} \\sum_{i=0}^{n-1} (B_{t_{i+1}} - B_{t_i})^2 = t \\quad \\text{a.s.}',
      dom.infoQvDef,
      { displayMode: true, throwOnError: false }
    );
  }
  if (dom.infoArcsineDef) {
    katex.render(
      '\\mathbb{P}\\!\\left(\\frac{1}{T}\\int_0^T \\mathbf{1}_{B_s > 0}\\, ds \\le x\\right) = \\frac{2}{\\pi}\\arcsin\\!\\left(\\sqrt{x}\\right), \\quad 0 \\le x \\le 1',
      dom.infoArcsineDef,
      { displayMode: true, throwOnError: false }
    );
  }
}

/* ================================================================
   SEED ADVANCE HELPER
   ================================================================ */

function advanceSeed(s) {
  return (s * 1103515245 + 12345) & 0x7fffffff;
}

/* ================================================================
   EVENT LISTENERS
   ================================================================ */

function bindEvents() {
  dom.tabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchTab(btn.dataset.tab);
    });
  });

  // Tab 1
  dom.peTimeHorizon.addEventListener('input', function () {
    state.peTimeHorizon = +dom.peTimeHorizon.value;
    dom.peTimeHorizonVal.textContent = state.peTimeHorizon;
  });
  dom.peNumPoints.addEventListener('input', function () {
    state.peNumPoints = Math.round(Math.pow(10, +dom.peNumPoints.value));
    dom.peNumPointsVal.textContent = state.peNumPoints.toLocaleString();
  });
  dom.peNumPaths.addEventListener('input', function () {
    state.peNumPaths = +dom.peNumPaths.value;
    dom.peNumPathsVal.textContent = state.peNumPaths;
  });
  dom.peRegenBtn.addEventListener('click', function () {
    state.seed = advanceSeed(state.seed);
    state.pePaths = null;
    renderPathExplorer();
  });

  // Tab 2
  dom.ssScalingFactor.addEventListener('input', function () {
    state.ssScalingFactor = +parseFloat(dom.ssScalingFactor.value).toFixed(1);
    dom.ssScalingFactorVal.textContent = state.ssScalingFactor.toFixed(1);
    renderSelfSimilarity();
  });
  dom.ssRegenBtn.addEventListener('click', function () {
    state.ssSeed = advanceSeed(state.ssSeed);
    state.ssBasePath = null;
    renderSelfSimilarity();
  });

  // Tab 3
  dom.qvPartitionPoints.addEventListener('input', function () {
    state.qvPartitionPoints = Math.round(Math.pow(10, +dom.qvPartitionPoints.value));
    dom.qvPartitionPointsVal.textContent = state.qvPartitionPoints.toLocaleString();
    renderQuadraticVariation();
  });
  dom.qvRegenBtn.addEventListener('click', function () {
    state.qvSeed = advanceSeed(state.qvSeed);
    state.qvPath = null;
    renderQuadraticVariation();
  });

  // Tab 4
  dom.alNumSims.addEventListener('input', function () {
    state.alNumSims = +dom.alNumSims.value;
    dom.alNumSimsVal.textContent = state.alNumSims.toLocaleString();
  });
  dom.alRegenBtn.addEventListener('click', function () {
    state.alSeed = advanceSeed(state.alSeed);
    state.alFractions = null;
    renderArcsine();
  });
}

/* ================================================================
   INIT
   ================================================================ */

function init() {
  cacheDom();
  bindEvents();

  dom.peNumPointsVal.textContent =
    Math.round(Math.pow(10, +dom.peNumPoints.value)).toLocaleString();
  dom.qvPartitionPointsVal.textContent =
    Math.round(Math.pow(10, +dom.qvPartitionPoints.value)).toLocaleString();

  renderInfoFormulas();
  renderPathExplorer();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
