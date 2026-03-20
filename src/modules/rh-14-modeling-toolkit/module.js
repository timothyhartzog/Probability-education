/**
 * RH-14 Modeling Toolkit — Synthesis Engine
 * Ported from rural_hospital_modeling_toolkit.py
 */

import * as d3 from 'd3';
import { SimulationEngine } from '../../shared/SimulationEngine';
import { ErrorBoundary } from '../../shared/ErrorBoundary';
import '../../lib/param-tooltips.js';

// Initialize Global Error Trapping
ErrorBoundary.init();

// ============================================================
//  Global State (The Model)
// ============================================================

const state = {
  // Configurable Parameters (Sidebar)
  config: {
    beds: 25,
    edBeds: 6,
    dailyArrivals: 23,
    los: 3.2,
    rnFTE: 12,
    providers: 1,
    budgetStaff: 400000,
  },
  
  // Derived Data
  distributions: {
    edVolume: [],
    inpatientLOS: [],
  },
  
  queues: {
    arrivalRate: 23 / 24, // pt/hr
    serviceRate: 1 / 1.5, // pt/hr per provider
    waitMinutes: 0,
    utilization: 0,
  },
  
  surveillance: {
    data: [], // Time-series
    anomalies: [],
  },

  isInitialized: false
};

// ============================================================
//  The Engine
// ============================================================

const engine = new SimulationEngine({
  name: 'Nexus Operations Model',
  onUpdate: async () => {
    updateDerivedData();
    renderAll();
    window.SIM_STATE = state; // For Antigravity
  }
});

function updateDerivedData() {
  const cfg = state.config;
  const nDays = 365;

  // 1. Generate Arrivals (Poisson/Negative Binomial Approximation)
  if (!state.isInitialized) {
    state.distributions.edVolume = d3.range(nDays).map(() => 
      d3.randomPoisson(cfg.dailyArrivals)()
    );
    
    // 2. Initial Surveillance Data
    state.surveillance.data = d3.range(60).map((i) => ({
      day: i,
      val: d3.randomPoisson(cfg.dailyArrivals)()
    }));
    
    state.isInitialized = true;
  }

  // 3. Queuing Logic (Erlang-C Approximation)
  const lambda = cfg.dailyArrivals / 24;
  const mu = 1 / 1.5; // Average 1.5hr service
  const c = cfg.providers;
  const rho = lambda / (c * mu);
  
  state.queues.arrivalRate = lambda;
  state.queues.utilization = Math.min(100, rho * 100);
  
  if (rho < 1) {
    // Simplified Erlang-C wait time formula
    // Wq = (P(wait) * serviceTime) / (c * (1 - rho))
    // For c=1, Wq = rho * serviceTime / (1 - rho)
    state.queues.waitMinutes = (rho * 90) / (1 - rho);
  } else {
    state.queues.waitMinutes = 999; // Unstable
  }
}

// ============================================================
//  Visualizations
// ============================================================

function renderAll() {
  renderDistChart();
  renderQueueChart();
  renderABMCascade();
  renderKMCurve();
  renderROIChart();
  renderAnomalyStream();
}

function renderDistChart() {
  const container = d3.select('#viz-ed-dist');
  if (!container.node()) return;
  const { w: width, h: height } = getSVGDims('#viz-ed-dist', 380, 300);
  container.selectAll('svg').remove();

  const svg = container.append('svg').attr('width', width).attr('height', height);
  const data = state.distributions.edVolume;
  
  const margin = { top: 20, right: 20, bottom: 40, left: 40 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain([0, d3.max(data) * 1.2])
    .range([0, chartWidth]);

  const bins = d3.bin().domain(x.domain()).thresholds(15)(data);

  const y = d3.scaleLinear()
    .domain([0, d3.max(bins, d => d.length)])
    .range([chartHeight, 0]);

  g.append('g')
    .attr('transform', `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x));

  g.selectAll('.bar')
    .data(bins)
    .join('rect')
    .attr('class', 'bar')
    .attr('x', d => x(d.x0) + 1)
    .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 1))
    .attr('y', d => y(d.length))
    .attr('height', d => chartHeight - y(d.length))
    .attr('fill', 'var(--color-primary-light)')
    .attr('rx', 2);

  d3.select('#stats-dist').html(`
    <div class="flex justify-between font-mono">
      <span>Mean: ${d3.mean(data).toFixed(1)}/day</span>
      <span>Max: ${d3.max(data)}/day</span>
      <span>CV: ${(d3.deviation(data) / d3.mean(data)).toFixed(2)}</span>
    </div>
  `);
}

function renderQueueChart() {
  const container = d3.select('#viz-queue-curve');
  if (!container.node()) return;
  const { w: width, h: height } = getSVGDims('#viz-queue-curve', 380, 300);
  container.selectAll('svg').remove();

  const svg = container.append('svg').attr('width', width).attr('height', height);
  const margin = { top: 30, right: 30, bottom: 40, left: 50 };
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([0.1, 0.98]).range([0, width - margin.left - margin.right]);
  const y = d3.scaleLinear().domain([0, 120]).range([height - margin.top - margin.bottom, 0]);

  // The Curve
  const line = d3.line()
    .x(d => x(d))
    .y(d => y((d * 90) / (1 - d)));

  const domain = d3.range(0.1, 0.95, 0.05);

  g.append('path')
    .datum(domain)
    .attr('fill', 'none')
    .attr('stroke', '#cbd5e1')
    .attr('stroke-width', 2)
    .attr('d', line);

  // Current Point
  const rho = state.queues.utilization / 100;
  if (rho < 0.95) {
    g.append('circle')
      .attr('cx', x(rho))
      .attr('cy', y(state.queues.waitMinutes))
      .attr('r', 6)
      .attr('fill', 'var(--color-error)');
  }

  g.append('g')
    .attr('transform', `translate(0,${height - margin.top - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(5, '%'));
  
  g.append('g').call(d3.axisLeft(y).ticks(5));

  d3.select('#stats-queue').html(`
    <div class="flex flex-col gap-1">
      <div class="flex justify-between"><span>Utilization:</span> <strong>${state.queues.utilization.toFixed(0)}%</strong></div>
      <div class="flex justify-between"><span>Expected Wait:</span> <strong>${state.queues.waitMinutes > 120 ? '>2 hrs' : state.queues.waitMinutes.toFixed(0) + 'm'}</strong></div>
    </div>
  `);
}

function getSVGDims(selector, fallbackW, fallbackH) {
  const node = document.querySelector(selector);
  const w = (node && node.clientWidth > 0) ? node.clientWidth : fallbackW;
  const h = (node && node.clientHeight > 0) ? node.clientHeight : fallbackH;
  return { w, h };
}

// ---- Agent Cascade Simulation (staffing cascade model) ----------
function renderABMCascade() {
  const container = d3.select('#viz-abm-cascade');
  if (!container.node()) return;
  container.selectAll('svg').remove();

  const cfg = state.config;
  const { w, h } = getSVGDims('#viz-abm-cascade', 700, 340);
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const iW = w - margin.left - margin.right;
  const iH = h - margin.top - margin.bottom;

  // Simulate cascade: each departure increases load, above threshold triggers more
  const steps = 60;
  const initStaff = cfg.rnFTE;
  const threshold = initStaff * 0.65; // below 65% triggers cascade
  const cascadeRate = 0.08; // prob additional departure per step if below threshold
  const recoveryRate = 0.04; // prob hire per step

  let staffSeries = [initStaff];
  let loadSeries = [1.0];
  for (let i = 1; i < steps; i++) {
    let s = staffSeries[i - 1];
    const load = Math.min(3.0, initStaff / Math.max(1, s));
    if (s < threshold) {
      // Cascade: high load triggers departures
      if (Math.random() < cascadeRate * load) s = Math.max(1, s - 1);
    }
    // Slow recovery
    if (Math.random() < recoveryRate && s < initStaff) s++;
    staffSeries.push(s);
    loadSeries.push(Math.min(3.0, initStaff / Math.max(1, s)));
  }

  const svg = container.append('svg').attr('width', w).attr('height', h);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([0, steps - 1]).range([0, iW]);
  const yStaff = d3.scaleLinear().domain([0, initStaff * 1.1]).range([iH, 0]);
  const yLoad = d3.scaleLinear().domain([0, 3.5]).range([iH, 0]);

  // Threshold band
  g.append('rect')
    .attr('x', 0).attr('width', iW)
    .attr('y', yStaff(threshold)).attr('height', iH - yStaff(threshold))
    .attr('fill', '#fef2f2').attr('opacity', 0.6);

  g.append('line')
    .attr('x1', 0).attr('x2', iW)
    .attr('y1', yStaff(threshold)).attr('y2', yStaff(threshold))
    .attr('stroke', 'var(--color-error)').attr('stroke-width', 1.5).attr('stroke-dasharray', '5,3');

  g.append('text')
    .attr('x', iW - 4).attr('y', yStaff(threshold) - 4)
    .attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--color-error)')
    .text('Cascade threshold');

  // Staff line
  const staffLine = d3.line().x((_, i) => x(i)).y(d => yStaff(d)).curve(d3.curveMonotoneX);
  g.append('path').datum(staffSeries)
    .attr('fill', 'none').attr('stroke', 'var(--color-primary)').attr('stroke-width', 2.5)
    .attr('d', staffLine);

  g.append('g').attr('transform', `translate(0,${iH})`).call(d3.axisBottom(x).ticks(8).tickFormat(d => `Day ${d}`));
  g.append('g').call(d3.axisLeft(yStaff).ticks(5));

  g.append('text').attr('class', 'axis-label').attr('transform', `translate(-38,${iH / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle').attr('font-size', 11).text('RN FTE');

  d3.select('#stats-abm').html(
    `<span>Final staff: <strong>${staffSeries[steps - 1].toFixed(0)}</strong> FTE</span> &nbsp; ` +
    `<span>Min: <strong>${d3.min(staffSeries).toFixed(0)}</strong></span> &nbsp; ` +
    `<span>Cascaded: <strong>${staffSeries.filter(s => s < threshold).length}</strong> days below threshold</span>`
  );
}

// ---- Kaplan-Meier Nurse Retention Curve -------------------------
function renderKMCurve() {
  const container = d3.select('#viz-km-curve');
  if (!container.node()) return;
  container.selectAll('svg').remove();

  const cfg = state.config;
  const { w, h } = getSVGDims('#viz-km-curve', 380, 300);
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const iW = w - margin.left - margin.right;
  const iH = h - margin.top - margin.bottom;

  // Simulate event times for rural vs urban retention (exponential)
  const nNurses = Math.round(cfg.rnFTE * 3); // 3 years of cohort
  const ruralRate = 0.028; // monthly departure rate (rural ~35% annual turnover)
  const urbanRate = 0.015; // urban ~18% annual turnover
  const maxMonths = 36;

  function kmEstimate(rate, n) {
    // Generate departure months, then compute KM
    const times = d3.range(n).map(() => Math.floor(-Math.log(Math.random()) / rate));
    const sorted = times.slice().sort((a, b) => a - b);
    let atRisk = n, survival = 1;
    const curve = [{ t: 0, s: 1 }];
    for (let t = 1; t <= maxMonths; t++) {
      const events = sorted.filter(x => x === t).length;
      if (events > 0 && atRisk > 0) {
        survival *= (1 - events / atRisk);
      }
      atRisk -= sorted.filter(x => x <= t).length - sorted.filter(x => x < t).length;
      curve.push({ t, s: Math.max(0, survival) });
    }
    return curve;
  }

  const ruralKM = kmEstimate(ruralRate, nNurses);
  const urbanKM = kmEstimate(urbanRate, nNurses);

  const svg = container.append('svg').attr('width', w).attr('height', h);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([0, maxMonths]).range([0, iW]);
  const y = d3.scaleLinear().domain([0, 1]).range([iH, 0]);

  const stepLine = d3.line().x(d => x(d.t)).y(d => y(d.s)).curve(d3.curveStepAfter);

  g.append('path').datum(ruralKM)
    .attr('fill', 'none').attr('stroke', 'var(--color-error)').attr('stroke-width', 2.5)
    .attr('d', stepLine);
  g.append('path').datum(urbanKM)
    .attr('fill', 'none').attr('stroke', 'var(--color-primary)').attr('stroke-width', 2).attr('stroke-dasharray', '6,3')
    .attr('d', stepLine);

  // Legend
  const leg = g.append('g').attr('transform', `translate(${iW - 120}, 10)`);
  leg.append('line').attr('x2', 20).attr('stroke', 'var(--color-error)').attr('stroke-width', 2.5);
  leg.append('text').attr('x', 24).attr('y', 4).attr('font-size', 11).text('Rural');
  leg.append('line').attr('y1', 18).attr('y2', 18).attr('x2', 20).attr('stroke', 'var(--color-primary)').attr('stroke-width', 2).attr('stroke-dasharray', '6,3');
  leg.append('text').attr('x', 24).attr('y', 22).attr('font-size', 11).text('Urban');

  g.append('g').attr('transform', `translate(0,${iH})`).call(d3.axisBottom(x).ticks(6).tickFormat(d => `Mo ${d}`));
  g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.0%')));

  g.append('text').attr('class', 'axis-label').attr('transform', `translate(-38,${iH / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle').attr('font-size', 11).text('P(Still Employed)');

  const rural12 = ruralKM.find(d => d.t === 12)?.s ?? 0;
  const urban12 = urbanKM.find(d => d.t === 12)?.s ?? 0;
  d3.select('#stats-survival').html(
    `<span>1-yr retention — Rural: <strong>${(rural12 * 100).toFixed(0)}%</strong> &nbsp; Urban: <strong>${(urban12 * 100).toFixed(0)}%</strong></span>`
  );
}

// ---- 5-Year Financial ROI Chart ---------------------------------
function renderROIChart() {
  const container = d3.select('#viz-fin-roi');
  if (!container.node()) return;
  container.selectAll('svg').remove();

  const cfg = state.config;
  const { w, h } = getSVGDims('#viz-fin-roi', 380, 300);
  const margin = { top: 20, right: 20, bottom: 40, left: 60 };
  const iW = w - margin.left - margin.right;
  const iH = h - margin.top - margin.bottom;

  // Simple DCF model: staffing intervention cost upfront, then reduced turnover savings
  const discountRate = 0.06;
  const intervention = cfg.budgetStaff * 0.5; // 50% of staffing budget as upfront investment
  const annualTurnoverCost = cfg.rnFTE * 15000; // $15k per RN turnover event
  const retentionImprovement = 0.25; // 25% turnover reduction from intervention
  const annualSavings = annualTurnoverCost * retentionImprovement;

  const years = [0, 1, 2, 3, 4, 5];
  let cumulativeNPV = -intervention;
  const cashFlows = years.map(yr => {
    if (yr === 0) return { yr, cf: -intervention, cumNPV: -intervention };
    const discounted = annualSavings / Math.pow(1 + discountRate, yr);
    cumulativeNPV += discounted;
    return { yr, cf: discounted, cumNPV: cumulativeNPV };
  });

  const svg = container.append('svg').attr('width', w).attr('height', h);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand().domain(years.map(String)).range([0, iW]).padding(0.3);
  const minVal = d3.min(cashFlows, d => d.cumNPV);
  const maxVal = d3.max(cashFlows, d => d.cumNPV);
  const pad = (maxVal - minVal) * 0.15 || 10000;
  const y = d3.scaleLinear().domain([minVal - pad, maxVal + pad]).range([iH, 0]);

  // Zero line
  g.append('line').attr('x1', 0).attr('x2', iW)
    .attr('y1', y(0)).attr('y2', y(0))
    .attr('stroke', '#94a3b8').attr('stroke-width', 1).attr('stroke-dasharray', '4,3');

  // Bars
  g.selectAll('.roi-bar').data(cashFlows).join('rect').attr('class', 'roi-bar')
    .attr('x', d => x(String(d.yr)))
    .attr('width', x.bandwidth())
    .attr('y', d => d.cumNPV >= 0 ? y(d.cumNPV) : y(0))
    .attr('height', d => Math.abs(y(d.cumNPV) - y(0)))
    .attr('fill', d => d.cumNPV >= 0 ? 'var(--color-accent)' : 'var(--color-error)')
    .attr('rx', 3);

  // NPV line
  const line = d3.line().x(d => x(String(d.yr)) + x.bandwidth() / 2).y(d => y(d.cumNPV)).curve(d3.curveMonotoneX);
  g.append('path').datum(cashFlows).attr('fill', 'none').attr('stroke', 'var(--color-primary)').attr('stroke-width', 2).attr('d', line);

  g.append('g').attr('transform', `translate(0,${iH})`).call(d3.axisBottom(x).tickFormat(d => `Yr ${d}`));
  g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d => `$${(d / 1000).toFixed(0)}k`));

  g.append('text').attr('class', 'axis-label').attr('transform', `translate(-50,${iH / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle').attr('font-size', 11).text('Cumulative NPV ($)');

  const finalNPV = cashFlows[cashFlows.length - 1].cumNPV;
  const breakeven = cashFlows.find(d => d.yr > 0 && d.cumNPV >= 0);
  d3.select('#stats-finance').html(
    `<span>5-yr NPV: <strong style="color:${finalNPV >= 0 ? 'var(--color-accent)' : 'var(--color-error)'}">${finalNPV >= 0 ? '+' : ''}$${(finalNPV / 1000).toFixed(0)}k</strong></span> &nbsp; ` +
    `<span>Break-even: <strong>Year ${breakeven ? breakeven.yr : '>5'}</strong></span>`
  );
}

function renderAnomalyStream() {
  const container = d3.select('#viz-anomalies');
  if (!container.node()) return;
  const { w: width, h: height } = getSVGDims('#viz-anomalies', 700, 300);
  container.selectAll('svg').remove();

  const svg = container.append('svg').attr('width', width).attr('height', height);
  const data = state.surveillance.data;
  const margin = { top: 20, right: 40, bottom: 30, left: 40 };

  const x = d3.scaleLinear().domain([0, data.length - 1]).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.val) * 1.5]).range([height - margin.bottom, margin.top]);

  const line = d3.line()
    .x(d => x(d.day))
    .y(d => y(d.val))
    .curve(d3.curveMonotoneX);

  // Control Limits (3-sigma)
  const mu = d3.mean(data, d => d.val);
  const sigma = d3.deviation(data, d => d.val);
  
  svg.append('rect')
    .attr('x', margin.left)
    .attr('y', y(mu + 2 * sigma))
    .attr('width', width - margin.left - margin.right)
    .attr('height', y(Math.max(0, mu - 2 * sigma)) - y(mu + 2 * sigma))
    .attr('fill', '#f1f5f9');

  svg.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', 'var(--color-primary)')
    .attr('stroke-width', 2)
    .attr('d', line);

  svg.selectAll('.dot')
    .data(data)
    .join('circle')
    .attr('cx', d => x(d.day))
    .attr('cy', d => y(d.val))
    .attr('r', d => Math.abs(d.val - mu) > 2.5 * sigma ? 5 : 0)
    .attr('fill', 'var(--color-error)');
}

// ============================================================
//  Init & Events
// ============================================================

function initControls() {
  const controls = [
    { id: 'beds', label: 'Inpatient Beds', min: 10, max: 100, val: 25 },
    { id: 'dailyArrivals', label: 'Avg ED Arrivals', min: 5, max: 80, val: 23 },
    { id: 'providers', label: 'ED Providers', min: 1, max: 5, val: 1 },
    { id: 'rnFTE', label: 'Staffing (FTE)', min: 5, max: 50, val: 12 },
  ];

  const parent = d3.select('#config-controls');
  controls.forEach(c => {
    const group = parent.append('div').attr('class', 'config-slider-group');
    const labelEl = group.append('label').attr('class', 'config-slider-label');
    labelEl.append('span').text(c.label);
    const valSpan = labelEl.append('span').attr('class', 'config-slider-value').text(c.val);
    group.append('input')
      .attr('type', 'range')
      .attr('min', c.min)
      .attr('max', c.max)
      .attr('value', c.val)
      .on('input', function() {
        state.config[c.id] = +this.value;
        valSpan.text(this.value);
        engine.step(state);
      });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initControls();
  
  document.getElementById('btn-reset').addEventListener('click', () => {
    location.reload();
  });

  document.getElementById('btn-inject-anomaly').addEventListener('click', () => {
    state.surveillance.data.push({
      day: state.surveillance.data.length,
      val: state.config.dailyArrivals * 2.5
    });
    if (state.surveillance.data.length > 100) state.surveillance.data.shift();
    engine.step(state);
  });

  // Defer initial render so browser completes layout first (clientWidth/clientHeight > 0)
  requestAnimationFrame(() => engine.step(state));
});
