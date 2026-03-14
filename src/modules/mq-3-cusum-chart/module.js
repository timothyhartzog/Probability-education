/* ============================================================
   Module MQ-3 — CUSUM Chart: Sequential Quality Monitoring
   ============================================================
   Detect shifts in surgical outcomes and infection rates using
   cumulative sum monitoring with log-likelihood ratio scoring.
   ============================================================ */

import * as d3 from 'd3';
import katex from 'katex';
import '../../lib/copy-code.js';

/* ---- Seedable xoshiro128** PRNG ----------------------------- */
function xoshiro128ss(a, b, c, d) {
  return function () {
    const t = b << 9;
    let r = b * 5;
    r = ((r << 7) | (r >>> 25)) * 9;
    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;
    c ^= t;
    d = (d << 11) | (d >>> 21);
    return (r >>> 0) / 4294967296;
  };
}

function makePRNG(seed) {
  function splitmix32(s) {
    return function () {
      s |= 0;
      s = (s + 0x9e3779b9) | 0;
      let t = s ^ (s >>> 16);
      t = Math.imul(t, 0x21f0aaad);
      t ^= t >>> 15;
      t = Math.imul(t, 0x735a2d97);
      t ^= t >>> 15;
      return t >>> 0;
    };
  }
  const sm = splitmix32(seed);
  return xoshiro128ss(sm(), sm(), sm(), sm());
}

/* ---- Clinical Scenarios ------------------------------------- */
const SCENARIOS = {
  cardiac:   { name: 'Cardiac Surgery Mortality', p0: 0.03,  p1: 0.06,  n: 500  },
  hip:       { name: 'Hip Replacement Revision',  p0: 0.02,  p1: 0.05,  n: 600  },
  infection: { name: 'Post-Op Infection Rate',     p0: 0.025, p1: 0.05,  n: 500  },
  stroke:    { name: 'Stroke 30-Day Mortality',    p0: 0.08,  p1: 0.15,  n: 400  },
  custom:    { name: 'Custom Parameters',          p0: null,  p1: null,  n: null  },
};

/* ---- DOM references ----------------------------------------- */
const $ = (sel) => document.querySelector(sel);

const els = {
  scenarioSelect:   $('#scenario-select'),
  targetRate:       $('#target-rate'),
  targetRateVal:    $('#target-rate-val'),
  alertRate:        $('#alert-rate'),
  alertRateVal:     $('#alert-rate-val'),
  numCases:         $('#num-cases'),
  numCasesVal:      $('#num-cases-val'),
  trueRate:         $('#true-rate'),
  trueRateVal:      $('#true-rate-val'),
  shiftPoint:       $('#shift-point'),
  shiftPointVal:    $('#shift-point-val'),
  shiftPointLabel:  $('#shift-point-label'),
  toggleBothSides:  $('#toggle-both-sides'),
  regenerateBtn:    $('#regenerate-btn'),
  animateBtn:       $('#animate-btn'),
  statSignal:       $('#stat-signal'),
  statObserved:     $('#stat-observed'),
  statThreshold:    $('#stat-threshold'),
  statMaxCusum:     $('#stat-max-cusum'),
  cusumChart:       $('#cusum-chart'),
  rawDataChart:     $('#raw-data-chart'),
  arlChart:         $('#arl-chart'),
  cusumLegend:      $('#cusum-legend'),
};

/* ---- State -------------------------------------------------- */
let state = {
  p0: 0.03,
  p1: 0.06,
  numCases: 500,
  trueRate: 0.06,
  shiftPoint: 250,
  twoSided: false,
  seed: 42,
  outcomes: [],
  cusumUpper: [],
  cusumLower: [],
  threshold: 4.5,
  signalCase: null,
  animating: false,
  animFrame: null,
  animStep: 0,
};

/* ---- CUSUM computation -------------------------------------- */
function computeWeights(p0, p1) {
  const wFail = Math.log(p1 / p0);
  const wSuccess = Math.log((1 - p1) / (1 - p0));
  return { wFail, wSuccess };
}

function computeThreshold(p0, p1) {
  // h = -ln(alpha), with alpha = 0.05 as default
  // Adjusted: for small odds ratios, use a minimum of ~4
  const h = -Math.log(0.05);
  return Math.max(h, 4.0);
}

function generateOutcomes(p0, trueRate, shiftPoint, numCases, rng) {
  const outcomes = [];
  for (let i = 0; i < numCases; i++) {
    const p = i < shiftPoint ? p0 : trueRate;
    outcomes.push(rng() < p ? 1 : 0);
  }
  return outcomes;
}

function computeCUSUM(outcomes, p0, p1, threshold) {
  const { wFail, wSuccess } = computeWeights(p0, p1);
  const upper = [];
  const lower = [];
  let cUp = 0;
  let cLow = 0;
  let signalCase = null;

  for (let i = 0; i < outcomes.length; i++) {
    const xi = outcomes[i];
    const score = xi * wFail + (1 - xi) * wSuccess;
    cUp = Math.max(0, cUp + score);
    cLow = Math.min(0, cLow + score);
    upper.push(cUp);
    lower.push(cLow);
    if (signalCase === null && cUp >= threshold) {
      signalCase = i;
    }
  }

  return { upper, lower, signalCase };
}

/* ---- ARL approximation -------------------------------------- */
function estimateARL(p0, p1, threshold, trueP, rng, nSims) {
  const { wFail, wSuccess } = computeWeights(p0, p1);
  let totalRL = 0;
  const maxRL = 5000;

  for (let sim = 0; sim < nSims; sim++) {
    let c = 0;
    let rl = 0;
    while (rl < maxRL) {
      rl++;
      const xi = rng() < trueP ? 1 : 0;
      const score = xi * wFail + (1 - xi) * wSuccess;
      c = Math.max(0, c + score);
      if (c >= threshold) break;
    }
    totalRL += rl;
  }
  return totalRL / nSims;
}

function computeARLCurve(p0, p1, threshold) {
  const rng = makePRNG(12345);
  const nSims = 150;
  const nPoints = 20;
  const rMin = p0;
  const rMax = 2 * p1;
  const step = (rMax - rMin) / (nPoints - 1);
  const points = [];

  for (let i = 0; i < nPoints; i++) {
    const trueP = rMin + i * step;
    const arl = estimateARL(p0, p1, threshold, trueP, rng, nSims);
    points.push({ rate: trueP, arl });
  }
  return points;
}

/* ---- SVG setup helpers -------------------------------------- */
function createSVG(container, viewBox) {
  container.innerHTML = '';
  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', viewBox)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%')
    .style('height', 'auto');
  return svg;
}

/* ---- CUSUM Chart -------------------------------------------- */
const cusumMargin = { top: 20, right: 30, bottom: 40, left: 55 };
const cusumW = 960 - cusumMargin.left - cusumMargin.right;
const cusumH = 400 - cusumMargin.top - cusumMargin.bottom;

function drawCUSUMChart(maxIdx) {
  const { outcomes, cusumUpper, cusumLower, threshold, signalCase, p0, shiftPoint, twoSided } = state;
  const n = maxIdx != null ? maxIdx : outcomes.length;

  const svg = createSVG(els.cusumChart, '0 0 960 400');
  const g = svg.append('g').attr('transform', `translate(${cusumMargin.left},${cusumMargin.top})`);

  const upperSlice = cusumUpper.slice(0, n);
  const lowerSlice = cusumLower.slice(0, n);

  const xScale = d3.scaleLinear().domain([0, outcomes.length]).range([0, cusumW]);

  let yMin = twoSided ? d3.min(lowerSlice) : 0;
  let yMax = Math.max(d3.max(upperSlice), threshold * 1.2);
  if (twoSided) {
    yMin = Math.min(yMin, -threshold * 1.2);
  }
  const yScale = d3.scaleLinear().domain([yMin, yMax]).nice().range([cusumH, 0]);

  // Axes
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${cusumH})`)
    .call(d3.axisBottom(xScale).ticks(10));
  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(8));

  // Axis labels
  g.append('text').attr('class', 'axis-label')
    .attr('x', cusumW / 2).attr('y', cusumH + 35).attr('text-anchor', 'middle')
    .text('Case Number');
  g.append('text').attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -cusumH / 2).attr('y', -42).attr('text-anchor', 'middle')
    .text('CUSUM Value');

  // Shift region shading
  if (shiftPoint < outcomes.length) {
    g.append('rect')
      .attr('class', 'shift-region')
      .attr('x', xScale(shiftPoint))
      .attr('y', 0)
      .attr('width', xScale(outcomes.length) - xScale(shiftPoint))
      .attr('height', cusumH);

    // Shift line
    g.append('line')
      .attr('class', 'shift-line')
      .attr('x1', xScale(shiftPoint)).attr('x2', xScale(shiftPoint))
      .attr('y1', 0).attr('y2', cusumH);
  }

  // Threshold line(s)
  g.append('line')
    .attr('class', 'threshold-line threshold-upper')
    .attr('x1', 0).attr('x2', cusumW)
    .attr('y1', yScale(threshold)).attr('y2', yScale(threshold));
  g.append('text')
    .attr('class', 'threshold-label')
    .attr('x', cusumW - 5).attr('y', yScale(threshold) - 5)
    .attr('text-anchor', 'end')
    .attr('fill', 'var(--color-error)')
    .text(`h = ${threshold.toFixed(2)}`);

  if (twoSided) {
    g.append('line')
      .attr('class', 'threshold-line threshold-lower')
      .attr('x1', 0).attr('x2', cusumW)
      .attr('y1', yScale(-threshold)).attr('y2', yScale(-threshold));
    g.append('text')
      .attr('class', 'threshold-label')
      .attr('x', cusumW - 5).attr('y', yScale(-threshold) + 15)
      .attr('text-anchor', 'end')
      .attr('fill', 'var(--color-accent)')
      .text(`-h = ${(-threshold).toFixed(2)}`);
  }

  // Zero line
  g.append('line')
    .attr('x1', 0).attr('x2', cusumW)
    .attr('y1', yScale(0)).attr('y2', yScale(0))
    .attr('stroke', '#94a3b8').attr('stroke-width', 0.5);

  // Upper CUSUM line
  const upperLine = d3.line()
    .x((d, i) => xScale(i))
    .y(d => yScale(d));

  g.append('path')
    .datum(upperSlice)
    .attr('class', 'cusum-line cusum-upper')
    .attr('d', upperLine);

  // Lower CUSUM line (two-sided)
  if (twoSided) {
    const lowerLine = d3.line()
      .x((d, i) => xScale(i))
      .y(d => yScale(d));

    g.append('path')
      .datum(lowerSlice)
      .attr('class', 'cusum-line cusum-lower')
      .attr('d', lowerLine);
  }

  // Signal marker
  if (signalCase !== null && signalCase < n) {
    g.append('circle')
      .attr('class', 'signal-marker')
      .attr('cx', xScale(signalCase))
      .attr('cy', yScale(cusumUpper[signalCase]))
      .attr('r', 7);

    g.append('line')
      .attr('class', 'signal-line')
      .attr('x1', xScale(signalCase)).attr('x2', xScale(signalCase))
      .attr('y1', 0).attr('y2', cusumH);
  }
}

/* ---- Raw Data Chart ----------------------------------------- */
const rawMargin = { top: 15, right: 20, bottom: 35, left: 45 };
const rawW = 460 - rawMargin.left - rawMargin.right;
const rawH = 260 - rawMargin.top - rawMargin.bottom;

function drawRawDataChart(maxIdx) {
  const { outcomes, p0 } = state;
  const n = maxIdx != null ? maxIdx : outcomes.length;
  const slice = outcomes.slice(0, n);

  const svg = createSVG(els.rawDataChart, '0 0 460 260');
  const g = svg.append('g').attr('transform', `translate(${rawMargin.left},${rawMargin.top})`);

  const xScale = d3.scaleLinear().domain([0, outcomes.length]).range([0, rawW]);
  const yScale = d3.scaleLinear().domain([-0.15, 1.15]).range([rawH, 0]);

  // Axes
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${rawH})`)
    .call(d3.axisBottom(xScale).ticks(6));
  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(yScale).tickValues([0, 1]).tickFormat(d => d === 0 ? 'Success' : 'Failure'));

  // Axis label
  g.append('text').attr('class', 'axis-label')
    .attr('x', rawW / 2).attr('y', rawH + 30).attr('text-anchor', 'middle')
    .text('Case Number');

  // Target rate line
  g.append('line')
    .attr('class', 'target-line')
    .attr('x1', 0).attr('x2', rawW)
    .attr('y1', yScale(p0)).attr('y2', yScale(p0));

  // Jitter PRNG for consistent jitter
  const jitterRng = makePRNG(9999);

  // Outcome dots — use a subset if too many for performance
  const step = slice.length > 800 ? Math.ceil(slice.length / 800) : 1;
  for (let i = 0; i < slice.length; i += step) {
    const jitter = (jitterRng() - 0.5) * 0.08;
    g.append('circle')
      .attr('class', slice[i] === 0 ? 'outcome-success' : 'outcome-failure')
      .attr('cx', xScale(i))
      .attr('cy', yScale(slice[i] + jitter))
      .attr('r', slice.length > 400 ? 2 : 3);
  }

  // Running average line
  const runAvg = [];
  let cumSum = 0;
  for (let i = 0; i < slice.length; i++) {
    cumSum += slice[i];
    runAvg.push({ x: i, y: cumSum / (i + 1) });
  }

  const avgLine = d3.line()
    .x(d => xScale(d.x))
    .y(d => yScale(d.y));

  g.append('path')
    .datum(runAvg)
    .attr('class', 'running-rate-line')
    .attr('d', avgLine);
}

/* ---- ARL Chart ---------------------------------------------- */
const arlMargin = { top: 15, right: 20, bottom: 35, left: 50 };
const arlW = 460 - arlMargin.left - arlMargin.right;
const arlH = 260 - arlMargin.top - arlMargin.bottom;

function drawARLChart() {
  const { p0, p1, threshold } = state;
  const arlData = computeARLCurve(p0, p1, threshold);

  const svg = createSVG(els.arlChart, '0 0 460 260');
  const g = svg.append('g').attr('transform', `translate(${arlMargin.left},${arlMargin.top})`);

  const xScale = d3.scaleLinear()
    .domain([d3.min(arlData, d => d.rate), d3.max(arlData, d => d.rate)])
    .range([0, arlW]);
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(arlData, d => d.arl) * 1.1])
    .nice()
    .range([arlH, 0]);

  // Axes
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${arlH})`)
    .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.format('.3f')));
  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(6));

  // Axis labels
  g.append('text').attr('class', 'axis-label')
    .attr('x', arlW / 2).attr('y', arlH + 30).attr('text-anchor', 'middle')
    .text('True Failure Rate');
  g.append('text').attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -arlH / 2).attr('y', -38).attr('text-anchor', 'middle')
    .text('Avg. Run Length');

  // ARL area
  const area = d3.area()
    .x(d => xScale(d.rate))
    .y0(arlH)
    .y1(d => yScale(d.arl));

  g.append('path')
    .datum(arlData)
    .attr('class', 'arl-area')
    .attr('d', area);

  // ARL line
  const line = d3.line()
    .x(d => xScale(d.rate))
    .y(d => yScale(d.arl));

  g.append('path')
    .datum(arlData)
    .attr('class', 'arl-line')
    .attr('d', line);

  // Marker at p1
  const p1Point = arlData.reduce((best, d) =>
    Math.abs(d.rate - p1) < Math.abs(best.rate - p1) ? d : best
  );
  g.append('circle')
    .attr('class', 'arl-marker')
    .attr('cx', xScale(p1Point.rate))
    .attr('cy', yScale(p1Point.arl));

  g.append('text')
    .attr('x', xScale(p1Point.rate) + 8)
    .attr('y', yScale(p1Point.arl) - 8)
    .attr('font-size', '11px')
    .attr('fill', 'var(--color-text-secondary)')
    .text(`p\u2081 ARL \u2248 ${Math.round(p1Point.arl)}`);
}

/* ---- Legend -------------------------------------------------- */
function updateLegend() {
  const legend = els.cusumLegend;
  const items = [
    { color: 'var(--color-error)', label: 'Upper CUSUM' },
  ];
  if (state.twoSided) {
    items.push({ color: 'var(--color-accent)', label: 'Lower CUSUM' });
  }
  items.push({ color: '#94a3b8', label: 'Threshold h', dashed: true });
  items.push({ color: 'rgba(220,38,38,0.3)', label: 'Shift region', rect: true });

  legend.innerHTML = items.map(item => {
    if (item.rect) {
      return `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:12px;">
        <span style="width:14px;height:10px;background:${item.color};border-radius:2px;display:inline-block;"></span>
        <span style="font-size:12px;color:var(--color-text-secondary);">${item.label}</span></span>`;
    }
    const dash = item.dashed ? 'stroke-dasharray:4 3;' : '';
    return `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:12px;">
      <svg width="18" height="10"><line x1="0" y1="5" x2="18" y2="5" stroke="${item.color}" stroke-width="2" style="${dash}"/></svg>
      <span style="font-size:12px;color:var(--color-text-secondary);">${item.label}</span></span>`;
  }).join('');
}

/* ---- Stats -------------------------------------------------- */
function updateStats() {
  const { signalCase, cusumUpper, threshold, outcomes } = state;
  const observed = outcomes.length > 0
    ? (outcomes.reduce((a, b) => a + b, 0) / outcomes.length)
    : 0;

  els.statSignal.textContent = signalCase !== null ? `Case ${signalCase + 1}` : 'None';
  els.statObserved.textContent = observed.toFixed(4);
  els.statThreshold.textContent = threshold.toFixed(2);
  els.statMaxCusum.textContent = cusumUpper.length > 0
    ? d3.max(cusumUpper).toFixed(2)
    : '--';
}

/* ---- KaTeX formula ------------------------------------------ */
function renderFormula() {
  const el = document.getElementById('info-cusum-formula');
  if (!el) return;
  katex.render(
    String.raw`C_i = \max(0,\; C_{i-1} + w_i), \quad w_i = X_i \log\frac{p_1}{p_0} + (1-X_i)\log\frac{1-p_1}{1-p_0}`,
    el,
    { displayMode: true, throwOnError: false }
  );
}

/* ---- Full update -------------------------------------------- */
function regenerateData() {
  state.seed = Math.floor(Math.random() * 1e8);
  runModel();
}

function runModel() {
  const rng = makePRNG(state.seed);
  state.threshold = computeThreshold(state.p0, state.p1);
  state.outcomes = generateOutcomes(state.p0, state.trueRate, state.shiftPoint, state.numCases, rng);
  const result = computeCUSUM(state.outcomes, state.p0, state.p1, state.threshold);
  state.cusumUpper = result.upper;
  state.cusumLower = result.lower;
  state.signalCase = result.signalCase;
}

function drawAll(maxIdx) {
  drawCUSUMChart(maxIdx);
  drawRawDataChart(maxIdx);
  updateLegend();
  updateStats();
}

function fullUpdate() {
  stopAnimation();
  runModel();
  drawAll();
  drawARLChart();
}

/* ---- Animation ---------------------------------------------- */
function stopAnimation() {
  if (state.animFrame) {
    cancelAnimationFrame(state.animFrame);
    state.animFrame = null;
  }
  state.animating = false;
  els.animateBtn.textContent = 'Animate';
}

function startAnimation() {
  state.animating = true;
  state.animStep = 1;
  els.animateBtn.textContent = 'Stop';

  function tick() {
    if (!state.animating) return;
    if (state.animStep > state.outcomes.length) {
      stopAnimation();
      return;
    }
    drawAll(state.animStep);
    // Speed: show more frames per tick when there are many cases
    const increment = state.numCases > 800 ? 3 : state.numCases > 400 ? 2 : 1;
    state.animStep += increment;
    state.animFrame = requestAnimationFrame(tick);
  }

  tick();
}

/* ---- Control wiring ----------------------------------------- */
function syncSliderDisplay(slider, display, fmt) {
  const val = parseFloat(slider.value);
  display.textContent = fmt ? fmt(val) : val;
  return val;
}

function applyScenario(key) {
  const sc = SCENARIOS[key];
  if (key === 'custom') return;
  state.p0 = sc.p0;
  state.p1 = sc.p1;
  state.numCases = sc.n;
  state.trueRate = sc.p1;
  state.shiftPoint = Math.floor(sc.n / 2);

  els.targetRate.value = sc.p0;
  els.targetRateVal.textContent = sc.p0.toFixed(3);
  els.alertRate.value = sc.p1;
  els.alertRateVal.textContent = sc.p1.toFixed(3);
  els.numCases.value = sc.n;
  els.numCasesVal.textContent = sc.n;
  els.trueRate.value = sc.p1;
  els.trueRateVal.textContent = sc.p1.toFixed(3);
  els.shiftPoint.value = state.shiftPoint;
  els.shiftPointVal.textContent = state.shiftPoint;
  els.shiftPointLabel.textContent = state.shiftPoint;

  // Update shift-point max to be sensible relative to num cases
  els.shiftPoint.max = sc.n - 50;
}

function wireControls() {
  els.scenarioSelect.addEventListener('change', () => {
    applyScenario(els.scenarioSelect.value);
    fullUpdate();
  });

  els.targetRate.addEventListener('input', () => {
    state.p0 = syncSliderDisplay(els.targetRate, els.targetRateVal, v => v.toFixed(3));
    // Ensure p1 > p0
    if (state.p1 <= state.p0) {
      state.p1 = state.p0 + 0.005;
      els.alertRate.value = state.p1;
      els.alertRateVal.textContent = state.p1.toFixed(3);
    }
    els.scenarioSelect.value = 'custom';
    fullUpdate();
  });

  els.alertRate.addEventListener('input', () => {
    state.p1 = syncSliderDisplay(els.alertRate, els.alertRateVal, v => v.toFixed(3));
    if (state.p1 <= state.p0) {
      state.p1 = state.p0 + 0.005;
      els.alertRate.value = state.p1;
      els.alertRateVal.textContent = state.p1.toFixed(3);
    }
    els.scenarioSelect.value = 'custom';
    fullUpdate();
  });

  els.numCases.addEventListener('input', () => {
    state.numCases = syncSliderDisplay(els.numCases, els.numCasesVal, v => Math.round(v));
    els.shiftPoint.max = state.numCases - 50;
    if (state.shiftPoint > state.numCases - 50) {
      state.shiftPoint = state.numCases - 50;
      els.shiftPoint.value = state.shiftPoint;
      els.shiftPointVal.textContent = state.shiftPoint;
      els.shiftPointLabel.textContent = state.shiftPoint;
    }
    els.scenarioSelect.value = 'custom';
    fullUpdate();
  });

  els.trueRate.addEventListener('input', () => {
    state.trueRate = syncSliderDisplay(els.trueRate, els.trueRateVal, v => v.toFixed(3));
    fullUpdate();
  });

  els.shiftPoint.addEventListener('input', () => {
    state.shiftPoint = syncSliderDisplay(els.shiftPoint, els.shiftPointVal, v => Math.round(v));
    els.shiftPointLabel.textContent = state.shiftPoint;
    fullUpdate();
  });

  els.toggleBothSides.addEventListener('change', () => {
    state.twoSided = els.toggleBothSides.checked;
    drawAll();
  });

  els.regenerateBtn.addEventListener('click', () => {
    regenerateData();
    fullUpdate();
  });

  els.animateBtn.addEventListener('click', () => {
    if (state.animating) {
      stopAnimation();
      drawAll(); // Show full chart
    } else {
      runModel();
      startAnimation();
      // ARL chart doesn't animate, draw once
      drawARLChart();
    }
  });
}

/* ---- Init --------------------------------------------------- */
function init() {
  renderFormula();
  applyScenario('cardiac');
  wireControls();
  fullUpdate();
}

init();
