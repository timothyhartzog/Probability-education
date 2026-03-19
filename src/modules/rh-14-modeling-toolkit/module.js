/**
 * RH-14 Modeling Toolkit — Synthesis Engine
 * Ported from rural_hospital_modeling_toolkit.py
 */

import * as d3 from 'd3';
import { SimulationEngine } from '../../shared/SimulationEngine';
import { ErrorBoundary } from '../../shared/ErrorBoundary';

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
  renderAnomalyStream();
}

function renderDistChart() {
  const container = d3.select('#viz-ed-dist');
  const width = container.node().clientWidth;
  const height = container.node().clientHeight;
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
  const width = container.node().clientWidth;
  const height = container.node().clientHeight;
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

function renderAnomalyStream() {
  const container = d3.select('#viz-anomalies');
  const width = container.node().clientWidth;
  const height = container.node().clientHeight;
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
    const group = parent.append('div').attr('class', 'mb-6');
    group.append('label').attr('class', 'text-xs uppercase font-bold text-slate-500 mb-2 block').text(c.label);
    const slider = group.append('input')
      .attr('type', 'range')
      .attr('min', c.min)
      .attr('max', c.max)
      .attr('value', c.val)
      .attr('class', 'w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600')
      .on('input', function() {
        state.config[c.id] = +this.value;
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

  // Start the engine
  engine.step(state);
});
