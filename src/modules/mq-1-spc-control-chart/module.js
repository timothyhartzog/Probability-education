/* ============================================================
   Module MQ-1 — SPC Control Chart for Hospital Quality Metrics
   ============================================================
   Interactive D3 visualization of Statistical Process Control
   charts with Western Electric rules, multiple chart types,
   and zone band analysis.
   ============================================================ */

import * as d3 from 'd3';
import '../../lib/copy-code.js';
import '../../lib/param-tooltips.js';

/* ---- Seedable xoshiro128** PRNG ----------------------------- */
function xoshiro128ss(a, b, c, d) {
  return function () {
    const t = b << 9;
    let r = b * 5;
    r = ((r << 7) | (r >>> 25)) * 9;
    c ^= a; d ^= b; b ^= c; a ^= d;
    c ^= t;
    d = (d << 11) | (d >>> 21);
    return (r >>> 0) / 4294967296;
  };
}

function createRNG(seed) {
  function sm(s) {
    s |= 0; s = s + 0x9e3779b9 | 0;
    let t = s ^ (s >>> 16); t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15); t = Math.imul(t, 0x735a2d97);
    return ((t ^ (t >>> 15)) >>> 0);
  }
  const s0 = sm(seed), s1 = sm(s0), s2 = sm(s1), s3 = sm(s2);
  return xoshiro128ss(s0, s1, s2, s3);
}

/* ---- Normal sampling (Box-Muller) --------------------------- */
function normalSample(rng) {
  let u, v, s;
  do { u = 2 * rng() - 1; v = 2 * rng() - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
  return u * Math.sqrt(-2 * Math.log(s) / s);
}

/* ---- Poisson sampling --------------------------------------- */
function poissonSample(rng, lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

/* ---- Binomial sampling -------------------------------------- */
function binomialSample(rng, n, p) {
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (rng() < p) count++;
  }
  return count;
}

/* ---- Dataset Configurations --------------------------------- */
const DATASETS = {
  hai: {
    label: 'Hospital-Acquired Infections',
    baseline: 0.025,
    denomRange: [200, 400],
    type: 'proportion',
    unit: '%',
    shiftMultiplier: 1.8,
    format: v => (v * 100).toFixed(2) + '%',
    yLabel: 'Infection Rate (%)'
  },
  readmission: {
    label: '30-Day Readmission Rate',
    baseline: 0.15,
    denomRange: [300, 500],
    type: 'proportion',
    unit: '%',
    shiftMultiplier: 1.4,
    format: v => (v * 100).toFixed(2) + '%',
    yLabel: 'Readmission Rate (%)'
  },
  ssi: {
    label: 'Surgical Site Infections',
    baseline: 0.015,
    denomRange: [100, 300],
    type: 'proportion',
    unit: '%',
    shiftMultiplier: 2.0,
    format: v => (v * 100).toFixed(3) + '%',
    yLabel: 'SSI Rate (%)'
  },
  clabsi: {
    label: 'CLABSI Rate',
    baseline: 0.8,
    denomRange: [800, 1200],
    type: 'rate',
    unit: 'per 1000 line-days',
    shiftMultiplier: 2.0,
    format: v => v.toFixed(3),
    yLabel: 'Rate per 1000 Line-Days'
  },
  falls: {
    label: 'Falls per 1000 Patient-Days',
    baseline: 3.5,
    denomRange: [2000, 4000],
    type: 'rate',
    unit: 'per 1000 pt-days',
    shiftMultiplier: 1.6,
    format: v => v.toFixed(3),
    yLabel: 'Rate per 1000 Patient-Days'
  },
  mortality: {
    label: 'Risk-Adjusted Mortality',
    baseline: 0.02,
    denomRange: [400, 800],
    type: 'proportion',
    unit: '%',
    shiftMultiplier: 1.8,
    format: v => (v * 100).toFixed(3) + '%',
    yLabel: 'Mortality Rate (%)'
  }
};

/* ---- State -------------------------------------------------- */
let state = {
  seed: 42,
  dataset: 'hai',
  chartType: 'p-chart',
  numPeriods: 36,
  sigmaLevel: 3.0,
  westernElectric: true,
  showZones: false,
  injectShift: false,
  data: [],
  controlLimits: null,
  violations: []
};

/* ---- Generate data ------------------------------------------ */
function generateData() {
  const rng = createRNG(state.seed);
  const cfg = DATASETS[state.dataset];
  const n = state.numPeriods;
  const shiftStart = Math.floor(n * 2 / 3);
  const data = [];

  for (let i = 0; i < n; i++) {
    const denomMin = cfg.denomRange[0];
    const denomMax = cfg.denomRange[1];
    const denominator = Math.round(denomMin + rng() * (denomMax - denomMin));

    let baseline = cfg.baseline;
    if (state.injectShift && i >= shiftStart) {
      baseline *= cfg.shiftMultiplier;
    }

    let numerator, value;
    if (cfg.type === 'proportion') {
      numerator = binomialSample(rng, denominator, baseline);
      value = numerator / denominator;
    } else {
      // rate per unit (e.g., per 1000)
      const expected = baseline * denominator / 1000;
      numerator = poissonSample(rng, expected);
      value = (numerator / denominator) * 1000;
    }

    const monthDate = new Date(2024, i, 1);
    data.push({
      period: i + 1,
      date: monthDate,
      label: monthDate.toLocaleDateString('en-US', { year: '2-digit', month: 'short' }),
      numerator,
      denominator,
      value,
      violation: false,
      violationRules: []
    });
  }

  return data;
}

/* ---- Calculate control limits ------------------------------- */
function calculateControlLimits(data) {
  const chartType = state.chartType;
  const sigma = state.sigmaLevel;
  const cfg = DATASETS[state.dataset];

  let cl, sigmaEst;
  const limits = [];

  if (chartType === 'p-chart') {
    // p-bar = total events / total denominator
    const totalNum = d3.sum(data, d => d.numerator);
    const totalDen = d3.sum(data, d => d.denominator);
    cl = totalNum / totalDen;

    data.forEach(d => {
      const se = Math.sqrt(cl * (1 - cl) / d.denominator);
      limits.push({
        cl,
        ucl: cl + sigma * se,
        lcl: Math.max(0, cl - sigma * se),
        sigma1: se,
        se
      });
    });

    // For display, recalculate values as proportions (already are)
    sigmaEst = Math.sqrt(cl * (1 - cl) / d3.mean(data, d => d.denominator));
  } else if (chartType === 'u-chart') {
    // u-bar = total events / total exposure
    const totalNum = d3.sum(data, d => d.numerator);
    const totalDen = d3.sum(data, d => d.denominator);

    if (cfg.type === 'rate') {
      cl = (totalNum / totalDen) * 1000;
      data.forEach(d => {
        const se = Math.sqrt(cl / (d.denominator / 1000));
        limits.push({
          cl,
          ucl: cl + sigma * se,
          lcl: Math.max(0, cl - sigma * se),
          sigma1: se,
          se
        });
      });
      sigmaEst = Math.sqrt(cl / d3.mean(data, d => d.denominator / 1000));
    } else {
      cl = totalNum / totalDen;
      data.forEach(d => {
        const se = Math.sqrt(cl / d.denominator);
        limits.push({
          cl,
          ucl: cl + sigma * se,
          lcl: Math.max(0, cl - sigma * se),
          sigma1: se,
          se
        });
      });
      sigmaEst = Math.sqrt(cl / d3.mean(data, d => d.denominator));
    }
  } else if (chartType === 'xbar') {
    // X-bar chart: treat each point as a subgroup mean
    cl = d3.mean(data, d => d.value);
    // Use average moving range for sigma estimate
    const values = data.map(d => d.value);
    const mr = [];
    for (let i = 1; i < values.length; i++) {
      mr.push(Math.abs(values[i] - values[i - 1]));
    }
    const mrBar = d3.mean(mr);
    sigmaEst = mrBar / 1.128; // d2 for n=2

    data.forEach(d => {
      const se = sigmaEst / Math.sqrt(d.denominator > 1 ? Math.min(d.denominator / 50, 5) : 1);
      limits.push({
        cl,
        ucl: cl + sigma * se,
        lcl: cl - sigma * se,
        sigma1: se,
        se
      });
    });
  } else {
    // Individuals chart
    cl = d3.mean(data, d => d.value);
    const values = data.map(d => d.value);
    const mr = [];
    for (let i = 1; i < values.length; i++) {
      mr.push(Math.abs(values[i] - values[i - 1]));
    }
    const mrBar = d3.mean(mr);
    sigmaEst = mrBar / 1.128;

    data.forEach(() => {
      limits.push({
        cl,
        ucl: cl + sigma * sigmaEst,
        lcl: cl - sigma * sigmaEst,
        sigma1: sigmaEst,
        se: sigmaEst
      });
    });
  }

  return { cl, sigmaEst, limits };
}

/* ---- Western Electric Rules --------------------------------- */
function detectViolations(data, controlLimits) {
  const violations = [];
  const limits = controlLimits.limits;
  const cl = controlLimits.cl;

  // Reset violations
  data.forEach(d => { d.violation = false; d.violationRules = []; });

  if (!state.westernElectric) return violations;

  const n = data.length;

  for (let i = 0; i < n; i++) {
    const v = data[i].value;
    const lim = limits[i];
    const se = lim.se;

    // Rule 1: Point beyond 3 sigma
    if (v > lim.cl + 3 * se || v < lim.cl - 3 * se) {
      data[i].violation = true;
      data[i].violationRules.push('R1');
      violations.push({
        period: data[i].period,
        label: data[i].label,
        rule: 'R1',
        desc: `Point beyond 3\u03C3 (value: ${DATASETS[state.dataset].format(v)})`
      });
    }

    // Rule 2: 2 of 3 consecutive beyond 2 sigma (same side)
    if (i >= 2) {
      for (const side of ['upper', 'lower']) {
        let count = 0;
        for (let j = i - 2; j <= i; j++) {
          const val = data[j].value;
          const lj = limits[j];
          if (side === 'upper' && val > lj.cl + 2 * lj.se) count++;
          if (side === 'lower' && val < lj.cl - 2 * lj.se) count++;
        }
        if (count >= 2 && !data[i].violationRules.includes('R2')) {
          data[i].violation = true;
          data[i].violationRules.push('R2');
          violations.push({
            period: data[i].period,
            label: data[i].label,
            rule: 'R2',
            desc: `2 of 3 points beyond 2\u03C3 (${side})`
          });
        }
      }
    }

    // Rule 3: 4 of 5 consecutive beyond 1 sigma (same side)
    if (i >= 4) {
      for (const side of ['upper', 'lower']) {
        let count = 0;
        for (let j = i - 4; j <= i; j++) {
          const val = data[j].value;
          const lj = limits[j];
          if (side === 'upper' && val > lj.cl + lj.se) count++;
          if (side === 'lower' && val < lj.cl - lj.se) count++;
        }
        if (count >= 4 && !data[i].violationRules.includes('R3')) {
          data[i].violation = true;
          data[i].violationRules.push('R3');
          violations.push({
            period: data[i].period,
            label: data[i].label,
            rule: 'R3',
            desc: `4 of 5 points beyond 1\u03C3 (${side})`
          });
        }
      }
    }

    // Rule 4: 8 consecutive points on same side of center line
    if (i >= 7) {
      let aboveCount = 0, belowCount = 0;
      for (let j = i - 7; j <= i; j++) {
        if (data[j].value > limits[j].cl) aboveCount++;
        else belowCount++;
      }
      if ((aboveCount === 8 || belowCount === 8) && !data[i].violationRules.includes('R4')) {
        data[i].violation = true;
        data[i].violationRules.push('R4');
        violations.push({
          period: data[i].period,
          label: data[i].label,
          rule: 'R4',
          desc: `8 consecutive points ${aboveCount === 8 ? 'above' : 'below'} center line`
        });
      }
    }
  }

  return violations;
}

/* ---- Tooltip setup ------------------------------------------ */
let tooltip;
function ensureTooltip() {
  if (!tooltip) {
    tooltip = d3.select('body').append('div')
      .attr('class', 'spc-tooltip')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('background', 'rgba(15,23,42,0.92)')
      .style('color', '#f8fafc')
      .style('padding', '8px 12px')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('font-family', 'var(--font-heading, system-ui)')
      .style('line-height', '1.5')
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)')
      .style('opacity', 0)
      .style('z-index', 1000);
  }
  return tooltip;
}

/* ---- Draw main SPC chart ------------------------------------ */
function drawSPCChart(data, controlLimits) {
  const container = d3.select('#spc-chart');
  container.selectAll('*').remove();

  const cfg = DATASETS[state.dataset];
  const margin = { top: 20, right: 30, bottom: 50, left: 65 };
  const width = 960;
  const height = 400;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%')
    .style('max-height', '400px');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const limits = controlLimits.limits;

  // Scales
  const xScale = d3.scaleLinear()
    .domain([1, data.length])
    .range([0, innerW]);

  const allValues = data.map(d => d.value)
    .concat(limits.map(l => l.ucl))
    .concat(limits.map(l => l.lcl));
  const yMin = d3.min(allValues);
  const yMax = d3.max(allValues);
  const yPad = (yMax - yMin) * 0.15;
  const yScale = d3.scaleLinear()
    .domain([Math.max(0, yMin - yPad), yMax + yPad])
    .range([innerH, 0]);

  // Zone bands
  if (state.showZones) {
    // Draw zone bands for each sigma level
    for (let i = 0; i < data.length - 1; i++) {
      const x1 = xScale(data[i].period);
      const x2 = xScale(data[i + 1].period);
      const w = x2 - x1;
      const lim = limits[i];
      const limNext = limits[i + 1];

      // Zone C: CL +/- 1 sigma
      const c1Top = (lim.cl + lim.se + limNext.cl + limNext.se) / 2;
      const c1Bot = (lim.cl - lim.se + limNext.cl - limNext.se) / 2;
      g.append('rect')
        .attr('class', 'zone-band zone-c')
        .attr('x', x1).attr('width', w)
        .attr('y', yScale(c1Top))
        .attr('height', Math.max(0, yScale(Math.max(0, c1Bot)) - yScale(c1Top)));

      // Zone B: 1-2 sigma
      const b1Top = (lim.cl + 2 * lim.se + limNext.cl + 2 * limNext.se) / 2;
      const b1Bot = (lim.cl + lim.se + limNext.cl + limNext.se) / 2;
      g.append('rect')
        .attr('class', 'zone-band zone-b')
        .attr('x', x1).attr('width', w)
        .attr('y', yScale(b1Top))
        .attr('height', Math.max(0, yScale(b1Bot) - yScale(b1Top)));

      const b2Top = (lim.cl - lim.se + limNext.cl - limNext.se) / 2;
      const b2Bot = (lim.cl - 2 * lim.se + limNext.cl - 2 * limNext.se) / 2;
      g.append('rect')
        .attr('class', 'zone-band zone-b')
        .attr('x', x1).attr('width', w)
        .attr('y', yScale(b2Top))
        .attr('height', Math.max(0, yScale(Math.max(0, b2Bot)) - yScale(b2Top)));

      // Zone A: 2-3 sigma
      const a1Top = (limits[i].ucl + limNext.ucl) / 2;
      const a1Bot = (lim.cl + 2 * lim.se + limNext.cl + 2 * limNext.se) / 2;
      g.append('rect')
        .attr('class', 'zone-band zone-a')
        .attr('x', x1).attr('width', w)
        .attr('y', yScale(a1Top))
        .attr('height', Math.max(0, yScale(a1Bot) - yScale(a1Top)));

      const a2Top = (lim.cl - 2 * lim.se + limNext.cl - 2 * limNext.se) / 2;
      const a2Bot = (limits[i].lcl + limNext.lcl) / 2;
      g.append('rect')
        .attr('class', 'zone-band zone-a')
        .attr('x', x1).attr('width', w)
        .attr('y', yScale(a2Top))
        .attr('height', Math.max(0, yScale(Math.max(0, a2Bot)) - yScale(a2Top)));
    }
  }

  // Shift region highlight
  if (state.injectShift) {
    const shiftStart = Math.floor(data.length * 2 / 3);
    g.append('rect')
      .attr('class', 'shift-region')
      .attr('x', xScale(shiftStart + 1) - 5)
      .attr('width', innerW - xScale(shiftStart + 1) + 10)
      .attr('y', 0)
      .attr('height', innerH);
  }

  // Control limit lines
  const uclLine = d3.line()
    .x((d, i) => xScale(data[i].period))
    .y((d) => yScale(d.ucl));
  const lclLine = d3.line()
    .x((d, i) => xScale(data[i].period))
    .y((d) => yScale(d.lcl));
  const clLine = d3.line()
    .x((d, i) => xScale(data[i].period))
    .y((d) => yScale(d.cl));

  g.append('path')
    .datum(limits)
    .attr('class', 'control-line ucl-line')
    .attr('fill', 'none')
    .attr('d', uclLine);

  g.append('path')
    .datum(limits)
    .attr('class', 'control-line lcl-line')
    .attr('fill', 'none')
    .attr('d', lclLine);

  g.append('path')
    .datum(limits)
    .attr('class', 'control-line cl-line')
    .attr('fill', 'none')
    .attr('d', clLine);

  // UCL/CL/LCL labels
  const lastLim = limits[limits.length - 1];
  g.append('text')
    .attr('x', innerW + 5).attr('y', yScale(lastLim.ucl))
    .attr('dy', '0.35em').attr('font-size', '10px').attr('fill', '#ef4444')
    .text('UCL');
  g.append('text')
    .attr('x', innerW + 5).attr('y', yScale(lastLim.cl))
    .attr('dy', '0.35em').attr('font-size', '10px').attr('fill', 'var(--color-primary, #3b82f6)')
    .text('CL');
  g.append('text')
    .attr('x', innerW + 5).attr('y', yScale(lastLim.lcl))
    .attr('dy', '0.35em').attr('font-size', '10px').attr('fill', '#ef4444')
    .text('LCL');

  // Data line
  const line = d3.line()
    .x(d => xScale(d.period))
    .y(d => yScale(d.value));

  g.append('path')
    .datum(data)
    .attr('class', 'data-line')
    .attr('d', line);

  // Data points
  const tip = ensureTooltip();
  g.selectAll('.data-point')
    .data(data)
    .enter()
    .append('circle')
    .attr('class', d => `data-point ${d.violation ? 'violation' : 'normal'}`)
    .attr('cx', d => xScale(d.period))
    .attr('cy', d => yScale(d.value))
    .attr('r', d => d.violation ? 5 : 3.5)
    .on('mouseenter', function (event, d) {
      const statusText = d.violation
        ? `Violation (${d.violationRules.join(', ')})`
        : 'In control';
      tip.html(
        `<strong>Period ${d.period}</strong> (${d.label})<br/>` +
        `Value: ${cfg.format(d.value)}<br/>` +
        `Denominator: ${d.denominator.toLocaleString()}<br/>` +
        `Status: ${statusText}`
      )
        .style('opacity', 1)
        .style('left', (event.pageX + 12) + 'px')
        .style('top', (event.pageY - 28) + 'px');
    })
    .on('mousemove', function (event) {
      tip.style('left', (event.pageX + 12) + 'px')
        .style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseleave', function () {
      tip.style('opacity', 0);
    });

  // Axes
  const xAxis = d3.axisBottom(xScale)
    .ticks(Math.min(data.length, 12))
    .tickFormat(i => {
      const idx = Math.round(i) - 1;
      if (idx >= 0 && idx < data.length) return data[idx].label;
      return '';
    });

  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(xAxis)
    .selectAll('text')
    .attr('transform', 'rotate(-40)')
    .style('text-anchor', 'end');

  const yAxis = d3.axisLeft(yScale).ticks(8);
  if (cfg.type === 'proportion') {
    yAxis.tickFormat(d => (d * 100).toFixed(1) + '%');
  } else {
    yAxis.tickFormat(d => d.toFixed(2));
  }

  g.append('g')
    .attr('class', 'axis')
    .call(yAxis);

  // Y-axis label
  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerH / 2)
    .attr('y', -50)
    .attr('text-anchor', 'middle')
    .text(cfg.yLabel);

  // X-axis label
  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', innerW / 2)
    .attr('y', innerH + 45)
    .attr('text-anchor', 'middle')
    .text('Time Period (Month)');

  // Update subtitle
  d3.select('#spc-subtitle').text(
    `${cfg.label} — ${state.chartType} with ${state.sigmaLevel}\u03C3 limits`
  );

  // Legend
  const legend = d3.select('#spc-legend');
  legend.html('');
  const items = [
    { color: 'var(--color-primary, #3b82f6)', label: 'Normal point' },
    { color: 'var(--color-error, #ef4444)', label: 'Violation' },
    { color: 'var(--color-primary, #3b82f6)', label: 'Center Line (CL)', dash: false },
    { color: 'var(--color-error, #ef4444)', label: 'UCL / LCL', dash: true }
  ];
  items.forEach(item => {
    const span = legend.append('span').style('display', 'inline-flex').style('align-items', 'center').style('gap', '4px').style('margin-right', '16px');
    if (item.dash !== undefined) {
      span.append('span')
        .style('width', '20px').style('height', '2px')
        .style('background', item.color)
        .style('display', 'inline-block')
        .style('border-bottom', item.dash ? '2px dashed ' + item.color : 'none');
    } else {
      span.append('span')
        .style('width', '10px').style('height', '10px')
        .style('border-radius', '50%')
        .style('background', item.color)
        .style('display', 'inline-block');
    }
    span.append('span').text(item.label).style('font-size', '12px');
  });
}

/* ---- Draw histogram ----------------------------------------- */
function drawHistogram(data, controlLimits) {
  const container = d3.select('#histogram-chart');
  container.selectAll('*').remove();

  const cfg = DATASETS[state.dataset];
  const margin = { top: 15, right: 20, bottom: 40, left: 55 };
  const width = 460;
  const height = 260;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%')
    .style('max-height', '260px');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const values = data.map(d => d.value);
  const cl = controlLimits.cl;
  const avgUcl = d3.mean(controlLimits.limits, l => l.ucl);
  const avgLcl = d3.mean(controlLimits.limits, l => l.lcl);

  const extent = d3.extent(values);
  const pad = (extent[1] - extent[0]) * 0.1;
  const xMin = Math.min(extent[0] - pad, avgLcl - pad);
  const xMax = Math.max(extent[1] + pad, avgUcl + pad);

  const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, innerW]);

  const bins = d3.bin()
    .domain(xScale.domain())
    .thresholds(xScale.ticks(20))
    (values);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(bins, b => b.length)])
    .nice()
    .range([innerH, 0]);

  // Bars
  g.selectAll('.hist-bar')
    .data(bins)
    .enter()
    .append('rect')
    .attr('class', 'hist-bar')
    .attr('x', d => xScale(d.x0) + 1)
    .attr('width', d => Math.max(0, xScale(d.x1) - xScale(d.x0) - 1))
    .attr('y', d => yScale(d.length))
    .attr('height', d => innerH - yScale(d.length));

  // Vertical lines for CL, UCL, LCL
  const drawVertLine = (val, cls, label) => {
    if (val >= xMin && val <= xMax) {
      g.append('line')
        .attr('x1', xScale(val)).attr('x2', xScale(val))
        .attr('y1', 0).attr('y2', innerH)
        .attr('stroke', cls === 'cl' ? 'var(--color-primary, #3b82f6)' : '#ef4444')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', cls === 'cl' ? '4 2' : '6 3');
      g.append('text')
        .attr('x', xScale(val)).attr('y', -4)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('fill', cls === 'cl' ? 'var(--color-primary, #3b82f6)' : '#ef4444')
        .text(label);
    }
  };

  drawVertLine(cl, 'cl', 'CL');
  drawVertLine(avgUcl, 'ucl', 'UCL');
  drawVertLine(avgLcl, 'lcl', 'LCL');

  // Axes
  const xAxis = d3.axisBottom(xScale).ticks(6);
  if (cfg.type === 'proportion') {
    xAxis.tickFormat(d => (d * 100).toFixed(1) + '%');
  }

  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(xAxis);

  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(5));

  // Labels
  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', innerW / 2).attr('y', innerH + 35)
    .attr('text-anchor', 'middle')
    .text(cfg.yLabel);

  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerH / 2).attr('y', -40)
    .attr('text-anchor', 'middle')
    .text('Frequency');
}

/* ---- Draw violations panel ---------------------------------- */
function drawViolations(violations) {
  const container = d3.select('#violations-chart');
  container.selectAll('*').remove();

  if (violations.length === 0) {
    container.append('div')
      .attr('class', 'no-violations')
      .html('\u2714 Process In Control<br><span style="font-size:0.85em;font-weight:400;color:var(--color-text-secondary)">No rule violations detected</span>');
    return;
  }

  const list = container.append('div')
    .style('max-height', '220px')
    .style('overflow-y', 'auto')
    .style('padding', '4px');

  // Deduplicate: show unique violations
  const seen = new Set();
  violations.forEach(v => {
    const key = `${v.period}-${v.rule}`;
    if (seen.has(key)) return;
    seen.add(key);

    const item = list.append('div').attr('class', 'violation-item');
    item.append('span').attr('class', 'rule-badge').text(v.rule);
    item.append('span').text(`Period ${v.period} (${v.label}): ${v.desc}`);
  });

  d3.select('#violations-subtitle').text(
    `${violations.length} violation${violations.length !== 1 ? 's' : ''} detected`
  );
}

/* ---- Update stat cards -------------------------------------- */
function updateStats(data, controlLimits, violations) {
  const cfg = DATASETS[state.dataset];
  const cl = controlLimits.cl;
  const avgUcl = d3.mean(controlLimits.limits, l => l.ucl);

  d3.select('#stat-mean').text(cfg.format(cl));
  d3.select('#stat-ucl').text(cfg.format(avgUcl));
  d3.select('#stat-violations').text(violations.length);

  // Cpk: process capability
  const avgLcl = d3.mean(controlLimits.limits, l => l.lcl);
  const sigmaEst = controlLimits.sigmaEst;
  if (sigmaEst > 0) {
    const cpkUpper = (avgUcl - cl) / (3 * sigmaEst);
    const cpkLower = (cl - avgLcl) / (3 * sigmaEst);
    const cpk = Math.min(cpkUpper, cpkLower);
    d3.select('#stat-capability').text(cpk.toFixed(2));
  } else {
    d3.select('#stat-capability').text('--');
  }
}

/* ---- Main update -------------------------------------------- */
function update() {
  const data = generateData();
  state.data = data;

  const controlLimits = calculateControlLimits(data);
  state.controlLimits = controlLimits;

  const violations = detectViolations(data, controlLimits);
  state.violations = violations;

  drawSPCChart(data, controlLimits);
  drawHistogram(data, controlLimits);
  drawViolations(violations);
  updateStats(data, controlLimits, violations);
}

/* ---- Wire controls ------------------------------------------ */
function wireControls() {
  // Dataset
  d3.select('#dataset-select').on('change', function () {
    state.dataset = this.value;
    // Auto-select appropriate chart type
    const cfg = DATASETS[state.dataset];
    if (cfg.type === 'proportion') {
      state.chartType = 'p-chart';
      d3.select('#chart-type').property('value', 'p-chart');
    } else if (cfg.type === 'rate') {
      state.chartType = 'u-chart';
      d3.select('#chart-type').property('value', 'u-chart');
    }
    update();
  });

  // Chart type
  d3.select('#chart-type').on('change', function () {
    state.chartType = this.value;
    update();
  });

  // Time periods
  d3.select('#num-periods').on('input', function () {
    state.numPeriods = +this.value;
    d3.select('#num-periods-val').text(this.value);
    update();
  });

  // Sigma level
  d3.select('#sigma-level').on('input', function () {
    state.sigmaLevel = +this.value;
    d3.select('#sigma-level-val').text(parseFloat(this.value).toFixed(1));
    update();
  });

  // Western Electric toggle
  d3.select('#toggle-western-electric').on('change', function () {
    state.westernElectric = this.checked;
    update();
  });

  // Zone bands toggle
  d3.select('#toggle-zones').on('change', function () {
    state.showZones = this.checked;
    update();
  });

  // Inject shift toggle
  d3.select('#toggle-shift').on('change', function () {
    state.injectShift = this.checked;
    update();
  });

  // Regenerate
  d3.select('#regenerate-btn').on('click', function () {
    state.seed = Math.floor(Math.random() * 100000);
    update();
  });
}

/* ---- Init --------------------------------------------------- */
wireControls();
update();
