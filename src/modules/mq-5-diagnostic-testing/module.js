/* ============================================================
   Module MQ-5 — Diagnostic Test Probability
   ============================================================
   Interactive visualization of Bayes' theorem applied to
   medical diagnostic testing. Demonstrates the base rate
   fallacy and the relationship between prevalence, sensitivity,
   specificity, and predictive values.
   ============================================================ */

import * as d3 from 'd3';
import katex from 'katex';
import '../../lib/copy-code.js';
import '../../lib/param-tooltips.js';

/* ---- Clinical scenario presets ------------------------------ */
const SCENARIOS = {
  custom:               { prevalence: 1,    sensitivity: 95, specificity: 95,   label: 'Custom' },
  mammography:          { prevalence: 0.8,  sensitivity: 87, specificity: 97,   label: 'Mammography Screening' },
  'covid-symptomatic':  { prevalence: 20,   sensitivity: 80, specificity: 99,   label: 'COVID Rapid Antigen (symptomatic)' },
  'covid-asymptomatic': { prevalence: 1,    sensitivity: 80, specificity: 99,   label: 'COVID Rapid Antigen (asymptomatic)' },
  'hiv-elisa':          { prevalence: 0.3,  sensitivity: 99.7, specificity: 98.5, label: 'HIV ELISA Screening' },
  troponin:             { prevalence: 15,   sensitivity: 95, specificity: 90,   label: 'Troponin for MI (ER chest pain)' }
};

/* ---- Prevalence slider mapping (logarithmic) --------------- */
// Slider range 0..500 maps to 0.1%..50% on a log scale
function sliderToPrevalence(v) {
  const minLog = Math.log(0.1);
  const maxLog = Math.log(50);
  return Math.exp(minLog + (v / 500) * (maxLog - minLog));
}

function prevalenceToSlider(p) {
  const minLog = Math.log(0.1);
  const maxLog = Math.log(50);
  return Math.round(((Math.log(p) - minLog) / (maxLog - minLog)) * 500);
}

/* ---- State -------------------------------------------------- */
const state = {
  prevalence: 1,       // percent
  sensitivity: 95,     // percent
  specificity: 95,     // percent
  population: 1000,
  showFrequencies: true,
  scenario: 'custom'
};

/* ---- Derived computations ----------------------------------- */
function compute() {
  const prev = state.prevalence / 100;
  const sens = state.sensitivity / 100;
  const spec = state.specificity / 100;
  const N = state.population;

  const diseased = Math.round(N * prev);
  const healthy = N - diseased;

  const tp = Math.round(diseased * sens);
  const fn = diseased - tp;
  const tn = Math.round(healthy * spec);
  const fp = healthy - tn;

  const testPos = tp + fp;
  const testNeg = fn + tn;

  const ppv = testPos > 0 ? tp / testPos : 0;
  const npv = testNeg > 0 ? tn / testNeg : 0;
  const lrPos = spec < 1 ? sens / (1 - spec) : Infinity;
  const lrNeg = spec > 0 ? (1 - sens) / spec : 0;
  const pretestOdds = prev / (1 - prev);
  const posttestOdds = pretestOdds * lrPos;
  const nnt = ppv > 0 ? 1 / ppv : Infinity;

  return {
    prev, sens, spec, N,
    diseased, healthy,
    tp, fn, tn, fp,
    testPos, testNeg,
    ppv, npv,
    lrPos, lrNeg,
    pretestOdds, posttestOdds,
    nnt
  };
}

/* ---- Format helpers ----------------------------------------- */
function fmtPct(v, decimals = 1) {
  return (v * 100).toFixed(decimals) + '%';
}

function fmtNum(v) {
  if (!isFinite(v)) return '\u221E';
  if (v >= 100) return v.toFixed(0);
  if (v >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

function fmtOdds(v) {
  if (!isFinite(v)) return '\u221E';
  if (v >= 1) return fmtNum(v) + ':1';
  if (v > 0) return '1:' + fmtNum(1 / v);
  return '0';
}

/* ---- Render Bayes formula with KaTeX ------------------------ */
function renderFormulas() {
  const bayesTeX = String.raw`\text{PPV} = \frac{\text{Sens} \times \text{Prev}}{\text{Sens} \times \text{Prev} + (1 - \text{Spec}) \times (1 - \text{Prev})}`;

  const formulaEl = document.getElementById('bayes-formula');
  if (formulaEl) {
    katex.render(bayesTeX, formulaEl, { displayMode: true, throwOnError: false });
  }

  const infoEl = document.getElementById('info-bayes-formula');
  if (infoEl) {
    katex.render(bayesTeX, infoEl, { displayMode: true, throwOnError: false });
  }
}

/* ---- Tooltip ------------------------------------------------ */
let tooltip;
function ensureTooltip() {
  if (!tooltip) {
    tooltip = d3.select('body').append('div').attr('class', 'diag-tooltip');
  }
  return tooltip;
}

function showTooltip(event, html) {
  const tt = ensureTooltip();
  tt.html(html).classed('visible', true)
    .style('left', (event.pageX + 14) + 'px')
    .style('top', (event.pageY - 20) + 'px');
}

function hideTooltip() {
  ensureTooltip().classed('visible', false);
}

/* ============================================================
   1. NATURAL FREQUENCY ICON ARRAY
   ============================================================ */
function drawIconArray(d) {
  const container = d3.select('#icon-array-chart');
  container.selectAll('*').remove();

  const N = d.N;
  // Grid dimensions
  const cols = N === 10000 ? 100 : 50;
  const rows = N / cols;
  const cellW = N === 10000 ? 9 : 18;
  const cellH = N === 10000 ? 9 : 18;
  const iconR = N === 10000 ? 3 : 6;
  const padL = 20;
  const padT = 10;
  const padB = 40;
  const svgW = cols * cellW + padL * 2;
  const svgH = rows * cellH + padT + padB;

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${svgW} ${svgH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // Build ordered array: TP, FP, FN, TN
  const icons = [];
  for (let i = 0; i < d.tp; i++) icons.push('tp');
  for (let i = 0; i < d.fp; i++) icons.push('fp');
  for (let i = 0; i < d.fn; i++) icons.push('fn');
  for (let i = 0; i < d.tn; i++) icons.push('tn');
  // Pad or trim to exactly N
  while (icons.length < N) icons.push('tn');
  while (icons.length > N) icons.pop();

  const classMap = { tp: 'icon-tp', fp: 'icon-fp', tn: 'icon-tn', fn: 'icon-fn' };
  const labelMap = {
    tp: 'True Positive (disease + test positive)',
    fp: 'False Positive (healthy + test positive)',
    fn: 'False Negative (disease + test negative)',
    tn: 'True Negative (healthy + test negative)'
  };

  // Person icon path (simplified stick figure)
  const personPath = (cx, cy, r) => {
    const headR = r * 0.35;
    const bodyTop = cy - r + headR * 2 + 1;
    const bodyBot = cy + r * 0.3;
    const legBot = cy + r;
    return `M ${cx} ${cy - r + headR}
            m ${-headR} 0
            a ${headR} ${headR} 0 1 1 ${headR * 2} 0
            a ${headR} ${headR} 0 1 1 ${-headR * 2} 0
            M ${cx} ${bodyTop}
            L ${cx} ${bodyBot}
            M ${cx - r * 0.35} ${bodyTop + 2}
            L ${cx} ${bodyTop + r * 0.35}
            L ${cx + r * 0.35} ${bodyTop + 2}
            M ${cx - r * 0.3} ${legBot}
            L ${cx} ${bodyBot}
            L ${cx + r * 0.3} ${legBot}`;
  };

  // Use circles for 10000, person icons for 1000
  if (N === 10000) {
    svg.selectAll('circle.icon')
      .data(icons)
      .join('circle')
      .attr('class', (t) => classMap[t])
      .attr('cx', (_, i) => padL + (i % cols) * cellW + cellW / 2)
      .attr('cy', (_, i) => padT + Math.floor(i / cols) * cellH + cellH / 2)
      .attr('r', iconR)
      .on('mouseenter', (event, t) => showTooltip(event, labelMap[t]))
      .on('mouseleave', hideTooltip);
  } else {
    svg.selectAll('path.icon')
      .data(icons)
      .join('path')
      .attr('class', (t) => classMap[t])
      .attr('d', (_, i) => {
        const cx = padL + (i % cols) * cellW + cellW / 2;
        const cy = padT + Math.floor(i / cols) * cellH + cellH / 2;
        return personPath(cx, cy, iconR);
      })
      .attr('stroke-width', 1.2)
      .attr('stroke', (t) => {
        if (t === 'tp') return '#dc2626';
        if (t === 'fp') return '#f59e0b';
        if (t === 'fn') return '#2563eb';
        return '#cbd5e1';
      })
      .attr('fill', (t) => {
        if (t === 'tp') return '#dc2626';
        if (t === 'fp') return '#f59e0b';
        if (t === 'tn') return '#cbd5e1';
        return 'none'; // fn is outlined
      })
      .on('mouseenter', (event, t) => showTooltip(event, labelMap[t]))
      .on('mouseleave', hideTooltip);
  }

  // Count labels below the grid
  const labelY = padT + rows * cellH + 20;
  const counts = [
    { label: 'TP', count: d.tp, color: '#dc2626' },
    { label: 'FP', count: d.fp, color: '#f59e0b' },
    { label: 'FN', count: d.fn, color: '#2563eb' },
    { label: 'TN', count: d.tn, color: '#cbd5e1' }
  ];
  const segW = svgW / counts.length;
  counts.forEach((c, i) => {
    svg.append('text')
      .attr('class', 'icon-count-label')
      .attr('x', segW * i + segW / 2)
      .attr('y', labelY)
      .attr('fill', c.color === '#cbd5e1' ? '#64748b' : c.color)
      .text(`${c.label}: ${c.count.toLocaleString()}`);
  });

  // Update subtitle
  d3.select('#icon-array-subtitle').text(
    state.showFrequencies
      ? `Each icon = 1 person out of ${N.toLocaleString()} tested | PPV = ${d.tp}/(${d.tp}+${d.fp}) = ${fmtPct(d.ppv)}`
      : `PPV = P(D|+) = ${fmtPct(d.ppv)} | NPV = P(H|\u2212) = ${fmtPct(d.npv)}`
  );

  // Legend
  updateIconLegend();
}

function updateIconLegend() {
  const legend = d3.select('#icon-array-legend');
  legend.selectAll('*').remove();

  const items = [
    { color: '#dc2626', fill: true,  label: 'True Positive (TP)' },
    { color: '#f59e0b', fill: true,  label: 'False Positive (FP)' },
    { color: '#2563eb', fill: false, label: 'False Negative (FN)' },
    { color: '#cbd5e1', fill: true,  label: 'True Negative (TN)' }
  ];

  items.forEach(item => {
    const el = legend.append('span').attr('class', 'icon-legend-item');
    const sw = el.append('span').attr('class', 'icon-legend-swatch');
    if (item.fill) {
      sw.style('background', item.color);
    } else {
      sw.style('background', 'none')
        .style('border', `2px solid ${item.color}`);
    }
    el.append('span').text(item.label);
  });
}

/* ============================================================
   2. CONFUSION MATRIX
   ============================================================ */
function drawMatrix(d) {
  const container = d3.select('#matrix-chart');
  container.selectAll('*').remove();

  const maxCell = Math.max(d.tp, d.fp, d.fn, d.tn, 1);
  const showFreq = state.showFrequencies;

  const table = container.append('table').attr('class', 'confusion-matrix');

  // Header row
  const thead = table.append('thead');
  const hr = thead.append('tr');
  hr.append('th').attr('class', 'corner-cell').attr('colspan', 2).attr('rowspan', 2);
  hr.append('th').attr('colspan', 2).text('Actual Condition');
  hr.append('th').attr('rowspan', 2).text('Total');
  hr.append('th').attr('rowspan', 2).text('Predictive Value');
  const hr2 = thead.append('tr');
  hr2.append('th').text('Disease +');
  hr2.append('th').text('Disease \u2212');

  const tbody = table.append('tbody');

  // Row: Test Positive
  const r1 = tbody.append('tr');
  r1.append('th').attr('rowspan', 2).style('writing-mode', 'vertical-rl').style('text-orientation', 'mixed').text('Test Result');
  r1.append('th').text('Test +');
  const tpCell = r1.append('td').attr('class', 'cell-tp').style('position', 'relative');
  tpCell.append('span').attr('class', 'cell-value').text(showFreq ? d.tp.toLocaleString() : fmtPct(d.sens));
  tpCell.append('span').attr('class', 'cell-pct').text(showFreq ? fmtPct(d.tp / d.N) : 'Sensitivity');
  tpCell.append('div').attr('class', 'cell-bar').style('width', (d.tp / maxCell * 80) + '%').style('background', '#dc2626');

  const fpCell = r1.append('td').attr('class', 'cell-fp').style('position', 'relative');
  fpCell.append('span').attr('class', 'cell-value').text(showFreq ? d.fp.toLocaleString() : fmtPct(1 - d.spec));
  fpCell.append('span').attr('class', 'cell-pct').text(showFreq ? fmtPct(d.fp / d.N) : 'FPR');
  fpCell.append('div').attr('class', 'cell-bar').style('width', (d.fp / maxCell * 80) + '%').style('background', '#f59e0b');

  r1.append('td').attr('class', 'cell-total')
    .append('span').attr('class', 'cell-value').text(d.testPos.toLocaleString());
  r1.append('td').attr('class', 'cell-ppv')
    .html(`<span class="cell-value">${fmtPct(d.ppv)}</span><span class="cell-pct">PPV</span>`);

  // Row: Test Negative
  const r2 = tbody.append('tr');
  r2.append('th').text('Test \u2212');
  const fnCell = r2.append('td').attr('class', 'cell-fn').style('position', 'relative');
  fnCell.append('span').attr('class', 'cell-value').text(showFreq ? d.fn.toLocaleString() : fmtPct(1 - d.sens));
  fnCell.append('span').attr('class', 'cell-pct').text(showFreq ? fmtPct(d.fn / d.N) : 'FNR');
  fnCell.append('div').attr('class', 'cell-bar').style('width', (d.fn / maxCell * 80) + '%').style('background', '#2563eb');

  const tnCell = r2.append('td').attr('class', 'cell-tn').style('position', 'relative');
  tnCell.append('span').attr('class', 'cell-value').text(showFreq ? d.tn.toLocaleString() : fmtPct(d.spec));
  tnCell.append('span').attr('class', 'cell-pct').text(showFreq ? fmtPct(d.tn / d.N) : 'Specificity');
  tnCell.append('div').attr('class', 'cell-bar').style('width', (d.tn / maxCell * 80) + '%').style('background', '#94a3b8');

  r2.append('td').attr('class', 'cell-total')
    .append('span').attr('class', 'cell-value').text(d.testNeg.toLocaleString());
  r2.append('td').attr('class', 'cell-npv')
    .html(`<span class="cell-value">${fmtPct(d.npv)}</span><span class="cell-pct">NPV</span>`);

  // Totals row
  const r3 = tbody.append('tr');
  r3.append('th').attr('colspan', 2).text('Total');
  r3.append('td').attr('class', 'cell-total')
    .append('span').attr('class', 'cell-value').text(d.diseased.toLocaleString());
  r3.append('td').attr('class', 'cell-total')
    .append('span').attr('class', 'cell-value').text(d.healthy.toLocaleString());
  r3.append('td').attr('class', 'cell-total')
    .append('span').attr('class', 'cell-value').text(d.N.toLocaleString());
  r3.append('td');
}

/* ============================================================
   3. BAYESIAN PROBABILITY TREE
   ============================================================ */
function drawTree(d) {
  const container = d3.select('#tree-chart');
  container.selectAll('*').remove();

  const W = 480, H = 380;
  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const showFreq = state.showFrequencies;
  const N = d.N;

  // Node positions (3 levels)
  const root = { x: 40, y: H / 2, label: 'Population', count: N, prob: 1 };
  const disease = { x: 180, y: H * 0.25, label: 'Disease', count: d.diseased, prob: d.prev };
  const healthy = { x: 180, y: H * 0.75, label: 'Healthy', count: d.healthy, prob: 1 - d.prev };

  const tpNode = { x: 380, y: H * 0.10, label: 'Test +', count: d.tp, prob: d.sens, combined: d.prev * d.sens, cls: 'tp' };
  const fnNode = { x: 380, y: H * 0.40, label: 'Test \u2212', count: d.fn, prob: 1 - d.sens, combined: d.prev * (1 - d.sens), cls: 'fn' };
  const fpNode = { x: 380, y: H * 0.60, label: 'Test +', count: d.fp, prob: 1 - d.spec, combined: (1 - d.prev) * (1 - d.spec), cls: 'fp' };
  const tnNode = { x: 380, y: H * 0.90, label: 'Test \u2212', count: d.tn, prob: d.spec, combined: (1 - d.prev) * d.spec, cls: 'tn' };

  const links = [
    { source: root, target: disease, highlight: true },
    { source: root, target: healthy, highlight: false },
    { source: disease, target: tpNode, highlight: true },
    { source: disease, target: fnNode, highlight: false },
    { source: healthy, target: fpNode, highlight: true },
    { source: healthy, target: tnNode, highlight: false }
  ];

  const colorMap = { tp: '#dc2626', fn: '#2563eb', fp: '#f59e0b', tn: '#94a3b8' };

  // Draw links
  links.forEach(link => {
    const sx = link.source.x + 12;
    const sy = link.source.y;
    const tx = link.target.x - 12;
    const ty = link.target.y;
    const mx = (sx + tx) / 2;

    svg.append('path')
      .attr('class', link.highlight ? 'tree-link tree-link-highlight' : 'tree-link')
      .attr('d', `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`)
      .attr('stroke', link.highlight ? '#dc2626' : '#94a3b8');
  });

  // Branch probability labels
  const branchLabels = [
    { sx: root, tx: disease, prob: d.prev, label: `P(D)=${fmtPct(d.prev)}`, above: true },
    { sx: root, tx: healthy, prob: 1 - d.prev, label: `P(H)=${fmtPct(1 - d.prev)}`, above: false },
    { sx: disease, tx: tpNode, prob: d.sens, label: `Sens=${fmtPct(d.sens)}`, above: true },
    { sx: disease, tx: fnNode, prob: 1 - d.sens, label: `FNR=${fmtPct(1 - d.sens)}`, above: false },
    { sx: healthy, tx: fpNode, prob: 1 - d.spec, label: `FPR=${fmtPct(1 - d.spec)}`, above: true },
    { sx: healthy, tx: tnNode, prob: d.spec, label: `Spec=${fmtPct(d.spec)}`, above: false }
  ];

  branchLabels.forEach(bl => {
    const mx = (bl.sx.x + bl.tx.x) / 2 + 10;
    const my = (bl.sx.y + bl.tx.y) / 2 + (bl.above ? -10 : 12);
    svg.append('text')
      .attr('class', 'tree-prob-label')
      .attr('x', mx)
      .attr('y', my)
      .attr('text-anchor', 'middle')
      .text(bl.label);
  });

  // Draw nodes
  const allNodes = [root, disease, healthy, tpNode, fnNode, fpNode, tnNode];
  allNodes.forEach(node => {
    const r = 10;
    let fill = '#f8fafc';
    let stroke = '#94a3b8';
    if (node.cls) {
      fill = colorMap[node.cls];
      stroke = colorMap[node.cls];
    } else if (node === disease) {
      fill = 'rgba(220, 38, 38, 0.15)';
      stroke = '#dc2626';
    } else if (node === healthy) {
      fill = 'rgba(148, 163, 184, 0.15)';
      stroke = '#94a3b8';
    }

    svg.append('circle')
      .attr('class', 'tree-node-circle')
      .attr('cx', node.x)
      .attr('cy', node.y)
      .attr('r', r)
      .attr('fill', fill)
      .attr('stroke', stroke);

    // Label
    const isTerminal = !!node.cls;
    const labelX = isTerminal ? node.x + 16 : node.x;
    const labelY = isTerminal ? node.y - 14 : node.y - 16;
    const anchor = isTerminal ? 'start' : 'middle';

    svg.append('text')
      .attr('class', 'tree-label')
      .attr('x', labelX)
      .attr('y', labelY)
      .attr('text-anchor', anchor)
      .text(node.label);

    // Count / probability below node
    if (node !== root) {
      const valText = showFreq
        ? `${node.count.toLocaleString()}`
        : (node.combined !== undefined ? fmtPct(node.combined, 2) : fmtPct(node.prob));
      svg.append('text')
        .attr('class', 'tree-count-label')
        .attr('x', labelX)
        .attr('y', isTerminal ? node.y + 4 : node.y + 26)
        .attr('text-anchor', anchor)
        .attr('fill', node.cls ? colorMap[node.cls] : '#555')
        .text(valText);
    } else {
      svg.append('text')
        .attr('class', 'tree-count-label')
        .attr('x', node.x)
        .attr('y', node.y + 24)
        .attr('text-anchor', 'middle')
        .attr('fill', '#555')
        .text(`n=${N.toLocaleString()}`);
    }
  });
}

/* ============================================================
   4. PPV vs PREVALENCE CURVE
   ============================================================ */
function drawPPVCurve(d) {
  const container = d3.select('#ppv-curve-chart');
  container.selectAll('*').remove();

  const W = 480, H = 350;
  const margin = { top: 20, right: 20, bottom: 50, left: 55 };
  const iw = W - margin.left - margin.right;
  const ih = H - margin.top - margin.bottom;

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleLinear().domain([0, 50]).range([0, iw]);
  const yScale = d3.scaleLinear().domain([0, 100]).range([ih, 0]);

  // Generate curve data
  const sens = d.sens;
  const spec = d.spec;
  const points = d3.range(0.1, 50.5, 0.2).map(prev => {
    const p = prev / 100;
    const ppv = (sens * p) / (sens * p + (1 - spec) * (1 - p));
    const npv = (spec * (1 - p)) / (spec * (1 - p) + (1 - sens) * p);
    return { prev, ppv: ppv * 100, npv: npv * 100 };
  });

  // PPV line
  const ppvLine = d3.line().x(pt => xScale(pt.prev)).y(pt => yScale(pt.ppv)).curve(d3.curveMonotoneX);
  g.append('path')
    .datum(points)
    .attr('class', 'ppv-line')
    .attr('d', ppvLine)
    .attr('stroke', '#dc2626');

  // NPV line
  const npvLine = d3.line().x(pt => xScale(pt.prev)).y(pt => yScale(pt.npv)).curve(d3.curveMonotoneX);
  g.append('path')
    .datum(points)
    .attr('class', 'npv-line')
    .attr('d', npvLine)
    .attr('stroke', '#059669');

  // Current prevalence marker
  const curPrev = state.prevalence;
  g.append('line')
    .attr('class', 'prevalence-marker')
    .attr('x1', xScale(curPrev))
    .attr('x2', xScale(curPrev))
    .attr('y1', 0)
    .attr('y2', ih)
    .attr('stroke', '#64748b');

  // PPV dot at current prevalence
  g.append('circle')
    .attr('class', 'curve-dot')
    .attr('cx', xScale(curPrev))
    .attr('cy', yScale(d.ppv * 100))
    .attr('r', 6)
    .attr('fill', '#dc2626')
    .on('mouseenter', (event) => showTooltip(event, `PPV: ${fmtPct(d.ppv)}<br>Prevalence: ${curPrev.toFixed(1)}%`))
    .on('mouseleave', hideTooltip);

  // NPV dot at current prevalence
  g.append('circle')
    .attr('class', 'curve-dot')
    .attr('cx', xScale(curPrev))
    .attr('cy', yScale(d.npv * 100))
    .attr('r', 6)
    .attr('fill', '#059669')
    .on('mouseenter', (event) => showTooltip(event, `NPV: ${fmtPct(d.npv)}<br>Prevalence: ${curPrev.toFixed(1)}%`))
    .on('mouseleave', hideTooltip);

  // Axes
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(xScale).ticks(10).tickFormat(v => v + '%'));

  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(10).tickFormat(v => v + '%'));

  // Axis labels
  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', iw / 2)
    .attr('y', ih + 40)
    .attr('text-anchor', 'middle')
    .text('Prevalence');

  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -ih / 2)
    .attr('y', -42)
    .attr('text-anchor', 'middle')
    .text('Predictive Value');

  // Legend in chart
  const legendG = g.append('g').attr('transform', `translate(${iw - 120}, 10)`);
  // PPV
  legendG.append('line').attr('x1', 0).attr('x2', 20).attr('y1', 0).attr('y2', 0)
    .attr('stroke', '#dc2626').attr('stroke-width', 2.5);
  legendG.append('text').attr('x', 25).attr('y', 4)
    .attr('class', 'tree-label').text('PPV');
  // NPV
  legendG.append('line').attr('x1', 0).attr('x2', 20).attr('y1', 18).attr('y2', 18)
    .attr('stroke', '#059669').attr('stroke-width', 2.5).attr('stroke-dasharray', '6 3');
  legendG.append('text').attr('x', 25).attr('y', 22)
    .attr('class', 'tree-label').text('NPV');
}

/* ============================================================
   STATS GRID
   ============================================================ */
function updateStats(d) {
  d3.select('#stat-ppv').text(fmtPct(d.ppv));
  d3.select('#stat-npv').text(fmtPct(d.npv));
  d3.select('#stat-lr-pos').text(fmtNum(d.lrPos));
  d3.select('#stat-lr-neg').text(fmtNum(d.lrNeg));
  d3.select('#stat-pretest-odds').text(fmtOdds(d.pretestOdds));
  d3.select('#stat-posttest-odds').text(fmtOdds(d.posttestOdds));
  d3.select('#stat-nnt').text(fmtNum(d.nnt));

  // Color PPV based on value
  const ppvEl = document.getElementById('stat-ppv');
  if (ppvEl) {
    if (d.ppv < 0.1) ppvEl.style.color = '#dc2626';
    else if (d.ppv < 0.5) ppvEl.style.color = '#f59e0b';
    else ppvEl.style.color = '#059669';
  }
}

/* ============================================================
   BUILD ALL
   ============================================================ */
function buildAll() {
  const d = compute();
  drawIconArray(d);
  drawMatrix(d);
  drawTree(d);
  drawPPVCurve(d);
  updateStats(d);
}

/* ============================================================
   CONTROLS
   ============================================================ */
function syncSlidersToState() {
  const prevSlider = document.getElementById('prevalence-slider');
  const sensSlider = document.getElementById('sensitivity-slider');
  const specSlider = document.getElementById('specificity-slider');

  prevSlider.value = prevalenceToSlider(state.prevalence);
  sensSlider.value = state.sensitivity;
  specSlider.value = state.specificity;

  d3.select('#prevalence-val').text(
    state.prevalence < 1 ? state.prevalence.toFixed(2) + '%'
    : state.prevalence < 10 ? state.prevalence.toFixed(1) + '%'
    : state.prevalence.toFixed(0) + '%'
  );
  d3.select('#sensitivity-val').text(state.sensitivity + '%');
  d3.select('#specificity-val').text(state.specificity + '%');
}

function wireControls() {
  // Scenario dropdown
  d3.select('#scenario-select').on('change', function () {
    const key = this.value;
    state.scenario = key;
    if (key !== 'custom') {
      const s = SCENARIOS[key];
      state.prevalence = s.prevalence;
      state.sensitivity = s.sensitivity;
      state.specificity = s.specificity;
      syncSlidersToState();
      buildAll();
    }
  });

  // Prevalence slider (logarithmic mapping)
  d3.select('#prevalence-slider').on('input', function () {
    state.prevalence = sliderToPrevalence(+this.value);
    state.scenario = 'custom';
    document.getElementById('scenario-select').value = 'custom';
    d3.select('#prevalence-val').text(
      state.prevalence < 1 ? state.prevalence.toFixed(2) + '%'
      : state.prevalence < 10 ? state.prevalence.toFixed(1) + '%'
      : state.prevalence.toFixed(0) + '%'
    );
    buildAll();
  });

  // Sensitivity slider
  d3.select('#sensitivity-slider').on('input', function () {
    state.sensitivity = +this.value;
    state.scenario = 'custom';
    document.getElementById('scenario-select').value = 'custom';
    d3.select('#sensitivity-val').text(this.value + '%');
    buildAll();
  });

  // Specificity slider
  d3.select('#specificity-slider').on('input', function () {
    state.specificity = +this.value;
    state.scenario = 'custom';
    document.getElementById('scenario-select').value = 'custom';
    d3.select('#specificity-val').text(this.value + '%');
    buildAll();
  });

  // Frequency toggle
  d3.select('#toggle-frequencies').on('change', function () {
    state.showFrequencies = this.checked;
    buildAll();
  });

  // Population size
  d3.select('#population-select').on('change', function () {
    state.population = +this.value;
    buildAll();
  });
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  renderFormulas();
  syncSlidersToState();
  wireControls();
  buildAll();
}

init();
