// ============================================================
//  Module RH-5 — Hospital Bed Occupancy Calculator
//  Interactive Operations Tool linking λ, W, and Capacity.
// ============================================================

import * as d3 from 'd3';
import katex from 'katex';
import { ParameterPanel } from '@shared/components';
import '../../lib/param-tooltips.js';

// ============================================================
//  1. The Model (State)
// ============================================================

const state = {
  lambda: 5,        // Expected Arrivals per Day
  w: 3.5,           // Mean Length of Stay (Days)
  capacity: 25,     // Total Hospital Beds
  rho: 0,           // Current Utilization (ρ)
  expectedL: 0,     // Total Expected Occupancy (L)
};

// ============================================================
//  2. The View (D3 Rendering)
// ============================================================

const margin = { top: 40, right: 30, bottom: 50, left: 60 };
let svg, xScale, yScale, areaGenerator, lineGenerator;

function initViz() {
  const container = d3.select('#bed-occupancy-chart');
  const width = container.node().clientWidth - margin.left - margin.right;
  const height = container.node().clientHeight - margin.top - margin.bottom;

  svg = container.append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  xScale = d3.scaleLinear().domain([0, 50]).range([0, width]);
  yScale = d3.scaleLinear().domain([0, 1]).range([height, 0]);

  // Axes
  svg.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale).ticks(10));

  svg.append('g')
    .attr('class', 'y-axis')
    .call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format('.0%')));

  // Generators
  areaGenerator = d3.area()
    .x(d => xScale(d.x))
    .y0(height)
    .y1(d => yScale(d.y))
    .curve(d3.curveMonotoneX);

  lineGenerator = d3.line()
    .x(d => xScale(d.x))
    .y(d => yScale(d.y));

  // Plot segments
  svg.append('path').attr('class', 'occupancy-area').attr('fill', '#2563eb15');
  svg.append('path').attr('class', 'occupancy-line').attr('fill', 'none').attr('stroke', '#2563eb').attr('stroke-width', 2);
  
  // Capacity marker
  svg.append('line')
    .attr('class', 'capacity-line')
    .attr('stroke', '#e11d48')
    .attr('stroke-dasharray', '5,5')
    .attr('stroke-width', 2);

  // Labels
  svg.append('text').attr('class', 'axis-label').attr('x', width / 2).attr('y', height + 40).attr('text-anchor', 'middle').text('Bed Occupancy (n)');
  svg.append('text').attr('class', 'axis-label').attr('transform', 'rotate(-90)').attr('x', -height / 2).attr('y', -45).attr('text-anchor', 'middle').text('Probability P(N = n)');
}

/** Compute Poisson Probability Distribution */
function poisson(lambda, k) {
  let res = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) res *= lambda / i;
  return res;
}

function updateViz() {
  const { lambda, w, capacity } = state;
  const L = lambda * w;
  state.expectedL = L;
  state.rho = L / capacity;

  // Generate Data for Chart
  const data = [];
  for (let n = 0; n <= 50; n++) {
    data.push({ x: n, y: poisson(L, n) });
  }

  // Update Visuals
  svg.select('.occupancy-area').datum(data).transition().duration(400).attr('d', areaGenerator);
  svg.select('.occupancy-line').datum(data).transition().duration(400).attr('d', lineGenerator);

  const width = xScale.range()[1];
  const height = yScale.range()[0];
  
  svg.select('.capacity-line')
    .transition().duration(400)
    .attr('x1', xScale(capacity))
    .attr('x2', xScale(capacity))
    .attr('y1', 0)
    .attr('y2', height);

  // Update Metrics
  const lRes = document.getElementById('res-expected-l');
  const uRes = document.getElementById('res-utilization');
  lRes.textContent = L.toFixed(2);
  uRes.textContent = (state.rho * 100).toFixed(1) + '%';
  uRes.style.color = state.rho > 0.9 ? 'var(--color-error)' : state.rho > 0.7 ? 'var(--color-warning)' : 'var(--color-success)';

  const mathEl = document.getElementById('math-littles');
  if (mathEl) {
    katex.render(
      String.raw`L = \lambda \times W \implies P(N = k) = \frac{L^k e^{-L}}{k!}`,
      mathEl,
      { displayMode: true, throwOnError: false }
    );
  }
}

// ============================================================
//  3. The Controller (Interactivity)
// ============================================================

function initControls() {
  const container = d3.select('#controls-inputs');

  ParameterPanel.createSlider(container, {
    label: 'Arrival Rate (λ pacientes/dia)',
    min: 1, max: 20, step: 0.1, value: state.lambda,
    onChange: (v) => { state.lambda = v; updateViz(); }
  });

  ParameterPanel.createSlider(container, {
    label: 'Mean Service Time (W dias)',
    min: 0.5, max: 10, step: 0.1, value: state.w,
    onChange: (v) => { state.w = v; updateViz(); }
  });

  ParameterPanel.createSlider(container, {
    label: 'Resource Capacity (Beds)',
    min: 5, max: 50, step: 1, value: state.capacity,
    onChange: (v) => { state.capacity = v; updateViz(); }
  });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  initViz();
  initControls();
  updateViz();

  window.addEventListener('resize', () => {
    d3.select('#bed-occupancy-chart').selectAll('*').remove();
    initViz();
    updateViz();
  });
});
