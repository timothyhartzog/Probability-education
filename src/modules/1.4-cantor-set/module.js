// ============================================================
//  Module 1.4 — Cantor Set & Singular Measures
//  Visualizes the Cantor set construction, devil's staircase,
//  and measure convergence to zero.
// ============================================================

import * as d3 from 'd3';
import katex from 'katex';
import '../../lib/copy-code.js';
import '../../lib/param-tooltips.js';

// ---- Global state -------------------------------------------
const state = {
  depth: 5,
  removalFraction: 1 / 3,
  showFunction: true,
  enableZoom: false,
  animating: false,
  animationTimer: null,
};

// ---- DOM references -----------------------------------------
const dom = {};

function cacheDom() {
  dom.depthSlider = document.getElementById('iteration-depth');
  dom.depthVal = document.getElementById('iteration-depth-val');
  dom.fractionSlider = document.getElementById('removal-fraction');
  dom.fractionVal = document.getElementById('removal-fraction-val');
  dom.toggleFunction = document.getElementById('toggle-function');
  dom.toggleZoom = document.getElementById('toggle-zoom');
  dom.animateBtn = document.getElementById('animate-btn');
  dom.resetBtn = document.getElementById('reset-btn');
  dom.stepDisplay = document.getElementById('step-display');
  dom.statIntervals = document.getElementById('stat-intervals');
  dom.statLength = document.getElementById('stat-length');
  dom.statRemoved = document.getElementById('stat-removed');
  dom.statDimension = document.getElementById('stat-dimension');
  dom.constructionChart = document.getElementById('construction-chart');
  dom.functionChart = document.getElementById('function-chart');
  dom.functionPanel = document.getElementById('function-panel');
  dom.measureChart = document.getElementById('measure-chart');
  dom.cantorDef = document.getElementById('info-cantor-def');
}

// ---- Cantor set computation ---------------------------------

/**
 * Compute intervals at each iteration stage.
 * Returns array of arrays: stages[i] = [[a,b], [a,b], ...]
 */
function computeStages(depth, f) {
  const stages = [];
  let intervals = [[0, 1]];
  stages.push(intervals.slice());

  for (let i = 1; i <= depth; i++) {
    const next = [];
    for (const [a, b] of intervals) {
      const len = b - a;
      const keep = (1 - f) / 2;
      next.push([a, a + len * keep]);
      next.push([b - len * keep, b]);
    }
    intervals = next;
    stages.push(intervals.slice());
  }
  return stages;
}

/**
 * Compute removed intervals at a given stage.
 */
function computeRemovedIntervals(intervals, f) {
  const removed = [];
  // intervals are sorted pairs; removed gaps are between consecutive intervals
  // But we also need to include the middle removal from each parent.
  // Actually, the removed intervals at stage k are the gaps between the remaining intervals.
  // Sort intervals by start
  const sorted = intervals.slice().sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < sorted.length - 1; i++) {
    const gapStart = sorted[i][1];
    const gapEnd = sorted[i + 1][0];
    if (gapEnd - gapStart > 1e-15) {
      removed.push([gapStart, gapEnd]);
    }
  }
  return removed;
}

/**
 * Cantor function (generalised devil's staircase).
 * For a point x in [0,1], compute F(x) at a given depth and removal fraction f.
 *
 * Recursive definition:
 * - Let keep = (1-f)/2, so left interval is [0, keep], gap is [keep, 1-keep], right is [1-keep, 1]
 * - If x < keep: F(x) = 0.5 * F(x / keep)
 * - If x > 1-keep: F(x) = 0.5 + 0.5 * F((x - (1-keep)) / keep)
 * - If keep <= x <= 1-keep (in gap): F(x) = 0.5
 *
 * At depth 0: F(x) = x (identity).
 */
function cantorFunction(x, depth, f) {
  if (depth === 0) return x;
  const keep = (1 - f) / 2;
  if (x <= keep) {
    return 0.5 * cantorFunction(x / keep, depth - 1, f);
  } else if (x >= 1 - keep) {
    return 0.5 + 0.5 * cantorFunction((x - (1 - keep)) / keep, depth - 1, f);
  } else {
    return 0.5;
  }
}

/**
 * Sample the Cantor function at many points for plotting.
 * Returns array of {x, y, flat} objects.
 */
function sampleCantorFunction(depth, f, numPoints = 2500) {
  const points = [];
  const keep = (1 - f) / 2;

  for (let i = 0; i <= numPoints; i++) {
    const x = i / numPoints;
    const y = cantorFunction(x, depth, f);
    points.push({ x, y });
  }

  // Mark flat segments (points where function is locally constant)
  // A segment is flat if its y-values are identical within tolerance
  for (let i = 0; i < points.length; i++) {
    const prev = i > 0 ? points[i - 1].y : -1;
    const next = i < points.length - 1 ? points[i + 1].y : -1;
    points[i].flat = Math.abs(points[i].y - prev) < 1e-10 &&
                     Math.abs(points[i].y - next) < 1e-10;
  }

  return points;
}

// ---- SVG setup ----------------------------------------------

let constructionSvg, functionSvg, measureSvg;
let functionZoom;

const constructionMargin = { top: 10, right: 30, bottom: 20, left: 60 };
const constructionWidth = 960;
const constructionHeight = 400;
const cInnerW = constructionWidth - constructionMargin.left - constructionMargin.right;
const cInnerH = constructionHeight - constructionMargin.top - constructionMargin.bottom;

const functionMargin = { top: 20, right: 20, bottom: 40, left: 45 };
const functionWidth = 460;
const functionHeight = 350;
const fInnerW = functionWidth - functionMargin.left - functionMargin.right;
const fInnerH = functionHeight - functionMargin.top - functionMargin.bottom;

const measureMargin = { top: 15, right: 20, bottom: 35, left: 45 };
const measureWidth = 460;
const measureHeight = 250;
const mInnerW = measureWidth - measureMargin.left - measureMargin.right;
const mInnerH = measureHeight - measureMargin.top - measureMargin.bottom;

function initSVGs() {
  // Construction chart
  constructionSvg = d3.select(dom.constructionChart)
    .append('svg')
    .attr('viewBox', `0 0 ${constructionWidth} ${constructionHeight}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .append('g')
    .attr('transform', `translate(${constructionMargin.left},${constructionMargin.top})`);

  // Function chart
  const fnSvgRoot = d3.select(dom.functionChart)
    .append('svg')
    .attr('viewBox', `0 0 ${functionWidth} ${functionHeight}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // Clip path for zoom
  fnSvgRoot.append('defs')
    .append('clipPath')
    .attr('id', 'fn-clip')
    .append('rect')
    .attr('width', fInnerW)
    .attr('height', fInnerH);

  functionSvg = fnSvgRoot.append('g')
    .attr('transform', `translate(${functionMargin.left},${functionMargin.top})`);

  // Zoom behaviour
  functionZoom = d3.zoom()
    .scaleExtent([1, 50])
    .translateExtent([[0, 0], [fInnerW, fInnerH]])
    .extent([[0, 0], [fInnerW, fInnerH]])
    .on('zoom', onFunctionZoom);

  fnSvgRoot.call(functionZoom).on('.zoom', null); // disabled by default

  // Measure chart
  measureSvg = d3.select(dom.measureChart)
    .append('svg')
    .attr('viewBox', `0 0 ${measureWidth} ${measureHeight}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .append('g')
    .attr('transform', `translate(${measureMargin.left},${measureMargin.top})`);
}

// ---- Construction chart rendering ---------------------------

function drawConstruction() {
  const { depth, removalFraction: f } = state;
  const stages = computeStages(depth, f);

  // Scales
  const xScale = d3.scaleLinear().domain([0, 1]).range([0, cInnerW]);
  const rowHeight = Math.min(28, cInnerH / Math.max(stages.length, 1));
  const barHeight = rowHeight * 0.65;

  // Clear
  constructionSvg.selectAll('*').remove();

  // Draw each stage
  stages.forEach((intervals, stageIdx) => {
    const y = stageIdx * rowHeight;
    const removed = computeRemovedIntervals(intervals, f);

    // Draw removed intervals (faded red)
    constructionSvg.selectAll(null)
      .data(removed)
      .enter()
      .append('rect')
      .attr('class', 'cantor-removed')
      .attr('x', d => xScale(d[0]))
      .attr('y', y + (rowHeight - barHeight) / 2)
      .attr('width', d => Math.max(0.5, xScale(d[1]) - xScale(d[0])))
      .attr('height', barHeight)
      .attr('rx', 1);

    // Draw remaining intervals (blue)
    constructionSvg.selectAll(null)
      .data(intervals)
      .enter()
      .append('rect')
      .attr('class', 'cantor-interval')
      .attr('x', d => xScale(d[0]))
      .attr('y', y + (rowHeight - barHeight) / 2)
      .attr('width', d => Math.max(0.5, xScale(d[1]) - xScale(d[0])))
      .attr('height', barHeight)
      .attr('rx', 1)
      .attr('opacity', 0)
      .transition()
      .duration(300)
      .attr('opacity', 1);

    // Iteration label
    constructionSvg.append('text')
      .attr('class', 'iteration-label')
      .attr('x', -8)
      .attr('y', y + rowHeight / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'central')
      .text(`n=${stageIdx}`);
  });
}

// ---- Function chart rendering -------------------------------

// Persistent scales for zoom
let fnXScale = d3.scaleLinear().domain([0, 1]).range([0, fInnerW]);
let fnYScale = d3.scaleLinear().domain([0, 1]).range([fInnerH, 0]);
let currentFnXScale = fnXScale.copy();
let currentFnYScale = fnYScale.copy();
let fnData = [];

function drawFunction() {
  functionSvg.selectAll('*').remove();

  if (!state.showFunction) {
    dom.functionPanel.style.display = 'none';
    return;
  }
  dom.functionPanel.style.display = '';

  const { depth, removalFraction: f } = state;
  fnData = sampleCantorFunction(depth, f);

  // Reset zoom scales
  fnXScale = d3.scaleLinear().domain([0, 1]).range([0, fInnerW]);
  fnYScale = d3.scaleLinear().domain([0, 1]).range([fInnerH, 0]);
  currentFnXScale = fnXScale.copy();
  currentFnYScale = fnYScale.copy();

  // Reset zoom transform
  const svgRoot = d3.select(dom.functionChart).select('svg');
  svgRoot.call(functionZoom.transform, d3.zoomIdentity);

  renderFunctionContent();
}

function renderFunctionContent() {
  functionSvg.selectAll('*').remove();

  const xS = currentFnXScale;
  const yS = currentFnYScale;

  // Axes
  const xAxis = d3.axisBottom(xS).ticks(6);
  const yAxis = d3.axisLeft(yS).ticks(6);

  functionSvg.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${fInnerH})`)
    .call(xAxis);

  functionSvg.append('g')
    .attr('class', 'axis')
    .call(yAxis);

  // Axis labels
  functionSvg.append('text')
    .attr('class', 'axis-label')
    .attr('x', fInnerW / 2)
    .attr('y', fInnerH + 35)
    .attr('text-anchor', 'middle')
    .text('x');

  functionSvg.append('text')
    .attr('class', 'axis-label')
    .attr('x', -fInnerH / 2)
    .attr('y', -35)
    .attr('text-anchor', 'middle')
    .attr('transform', 'rotate(-90)')
    .text('F(x)');

  // Clip group
  const plotArea = functionSvg.append('g')
    .attr('clip-path', 'url(#fn-clip)');

  // Split into flat and non-flat segments for coloring
  const line = d3.line()
    .x(d => xS(d.x))
    .y(d => yS(d.y));

  // Draw flat segments in secondary color
  let segStart = 0;
  for (let i = 1; i <= fnData.length; i++) {
    const wasFlat = fnData[i - 1].flat;
    const isFlat = i < fnData.length ? fnData[i].flat : false;

    if (wasFlat && !isFlat) {
      // End of a flat segment
      const seg = fnData.slice(segStart, i);
      if (seg.length > 1) {
        plotArea.append('path')
          .datum(seg)
          .attr('class', 'cantor-flat-segment')
          .attr('fill', 'none')
          .attr('d', line);
      }
    }
    if (!wasFlat && isFlat) {
      segStart = i - 1;
    }
    if (i === 0 && isFlat) {
      segStart = 0;
    }
  }

  // Draw full curve on top
  plotArea.append('path')
    .datum(fnData)
    .attr('class', 'cantor-function-line')
    .attr('d', line);
}

function onFunctionZoom(event) {
  if (!state.enableZoom) return;
  currentFnXScale = event.transform.rescaleX(fnXScale);
  currentFnYScale = event.transform.rescaleY(fnYScale);
  renderFunctionContent();
}

function updateZoomBehaviour() {
  const svgRoot = d3.select(dom.functionChart).select('svg');
  if (state.enableZoom) {
    svgRoot.call(functionZoom);
  } else {
    svgRoot.on('.zoom', null);
    svgRoot.call(functionZoom.transform, d3.zoomIdentity);
    currentFnXScale = fnXScale.copy();
    currentFnYScale = fnYScale.copy();
    renderFunctionContent();
  }
}

// ---- Measure chart rendering --------------------------------

function drawMeasure() {
  measureSvg.selectAll('*').remove();

  const { depth, removalFraction: f } = state;
  const maxStages = depth + 1;

  // Data: for each stage i, remaining = (1-f)^i, removed = 1 - (1-f)^i
  const data = [];
  for (let i = 0; i < maxStages; i++) {
    const remaining = Math.pow(1 - f, i);
    data.push({
      stage: i,
      remaining,
      removed: 1 - remaining,
    });
  }

  // Scales
  const xScale = d3.scaleBand()
    .domain(data.map(d => d.stage))
    .range([0, mInnerW])
    .padding(0.2);

  const yScale = d3.scaleLinear()
    .domain([0, 1])
    .range([mInnerH, 0]);

  // Axes
  const xAxis = d3.axisBottom(xScale).tickFormat(d => `${d}`);
  const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d3.format('.2f'));

  measureSvg.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${mInnerH})`)
    .call(xAxis);

  measureSvg.append('g')
    .attr('class', 'axis')
    .call(yAxis);

  // Axis labels
  measureSvg.append('text')
    .attr('class', 'axis-label')
    .attr('x', mInnerW / 2)
    .attr('y', mInnerH + 30)
    .attr('text-anchor', 'middle')
    .text('Iteration');

  measureSvg.append('text')
    .attr('class', 'axis-label')
    .attr('x', -mInnerH / 2)
    .attr('y', -35)
    .attr('text-anchor', 'middle')
    .attr('transform', 'rotate(-90)')
    .text('Measure');

  // Stacked bars: remaining (bottom, blue) + removed (top, red)
  measureSvg.selectAll('.remaining-bar')
    .data(data)
    .enter()
    .append('rect')
    .attr('class', 'remaining-bar length-bar')
    .attr('x', d => xScale(d.stage))
    .attr('y', d => yScale(d.remaining))
    .attr('width', xScale.bandwidth())
    .attr('height', d => mInnerH - yScale(d.remaining))
    .attr('rx', 2);

  measureSvg.selectAll('.removed-bar')
    .data(data)
    .enter()
    .append('rect')
    .attr('class', 'removed-bar length-bar')
    .attr('x', d => xScale(d.stage))
    .attr('y', d => yScale(1))
    .attr('width', xScale.bandwidth())
    .attr('height', d => yScale(d.remaining) - yScale(1))
    .attr('rx', 2);
}

// ---- Stats update -------------------------------------------

function updateStats() {
  const { depth, removalFraction: f } = state;
  const numIntervals = Math.pow(2, depth);
  const totalLength = Math.pow(1 - f, depth);
  const removed = 1 - totalLength;
  const keep = (1 - f) / 2;
  const hausdorff = depth > 0 ? Math.log(2) / Math.log(1 / keep) : NaN;

  dom.statIntervals.textContent = numIntervals.toLocaleString();
  dom.statLength.textContent = totalLength.toFixed(6);
  dom.statRemoved.textContent = removed.toFixed(6);
  dom.statDimension.textContent = isFinite(hausdorff) ? hausdorff.toFixed(4) : '--';
  dom.stepDisplay.textContent = depth;
}

// ---- KaTeX rendering ----------------------------------------

function renderKaTeX() {
  try {
    katex.render(
      String.raw`C = \bigcap_{n=0}^{\infty} C_n, \quad C_0 = [0,1], \quad C_{n+1} = \frac{C_n}{3} \cup \left(\frac{2}{3} + \frac{C_n}{3}\right)`,
      dom.cantorDef,
      { displayMode: true, throwOnError: false }
    );
  } catch (e) {
    // KaTeX not available — leave blank
  }
}

// ---- Format removal fraction display ------------------------

function formatFraction(val) {
  // Show as 1/3 if close
  if (Math.abs(val - 1 / 3) < 0.01) return '1/3';
  if (Math.abs(val - 0.5) < 0.01) return '1/2';
  if (Math.abs(val - 0.25) < 0.01) return '1/4';
  if (Math.abs(val - 0.2) < 0.01) return '1/5';
  return val.toFixed(2);
}

// ---- Full redraw --------------------------------------------

function redraw() {
  drawConstruction();
  drawFunction();
  drawMeasure();
  updateStats();
}

// ---- Animation ----------------------------------------------

function startAnimation() {
  if (state.animating) return;
  state.animating = true;
  dom.animateBtn.textContent = 'Animating...';
  dom.animateBtn.disabled = true;

  const targetDepth = state.depth;
  let currentStep = 0;

  // Set depth to 0 and start
  state.depth = 0;
  dom.depthSlider.value = 0;
  redraw();

  state.animationTimer = setInterval(() => {
    currentStep++;
    if (currentStep > targetDepth) {
      clearInterval(state.animationTimer);
      state.animating = false;
      dom.animateBtn.textContent = 'Animate Construction';
      dom.animateBtn.disabled = false;
      return;
    }
    state.depth = currentStep;
    dom.depthSlider.value = currentStep;
    dom.depthVal.textContent = currentStep;
    redraw();
  }, 500);
}

function stopAnimation() {
  if (state.animationTimer) {
    clearInterval(state.animationTimer);
    state.animationTimer = null;
  }
  state.animating = false;
  dom.animateBtn.textContent = 'Animate Construction';
  dom.animateBtn.disabled = false;
}

// ---- Reset --------------------------------------------------

function resetAll() {
  stopAnimation();
  state.depth = 5;
  state.removalFraction = 1 / 3;
  state.showFunction = true;
  state.enableZoom = false;

  dom.depthSlider.value = 5;
  dom.depthVal.textContent = '5';
  dom.fractionSlider.value = '0.333';
  dom.fractionVal.textContent = '1/3';
  dom.toggleFunction.checked = true;
  dom.toggleZoom.checked = false;

  updateZoomBehaviour();
  redraw();
}

// ---- Wire controls ------------------------------------------

function wireControls() {
  dom.depthSlider.addEventListener('input', () => {
    stopAnimation();
    state.depth = parseInt(dom.depthSlider.value, 10);
    dom.depthVal.textContent = state.depth;
    redraw();
  });

  dom.fractionSlider.addEventListener('input', () => {
    stopAnimation();
    state.removalFraction = parseFloat(dom.fractionSlider.value);
    dom.fractionVal.textContent = formatFraction(state.removalFraction);
    redraw();
  });

  dom.toggleFunction.addEventListener('change', () => {
    state.showFunction = dom.toggleFunction.checked;
    drawFunction();
  });

  dom.toggleZoom.addEventListener('change', () => {
    state.enableZoom = dom.toggleZoom.checked;
    updateZoomBehaviour();
  });

  dom.animateBtn.addEventListener('click', startAnimation);
  dom.resetBtn.addEventListener('click', resetAll);
}

// ---- Initialise ---------------------------------------------

function init() {
  cacheDom();
  initSVGs();
  wireControls();
  renderKaTeX();
  redraw();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
