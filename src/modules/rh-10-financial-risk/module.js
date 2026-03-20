// ============================================================
//  Module RH-10 — Financial Risk Modeling
//  Chapter 10 of the Rural Healthcare Nexus textbook.
// ============================================================

import * as d3 from 'd3';
import katex from 'katex';
import { ParameterPanel } from '@shared/components';
import '../../lib/param-tooltips.js';

const state = {
  medicareMix: 0.65,
  agVolatility: 0.2, // Sinusoidal scale
  selfPayRate: 0.12,
  fixedCost: 450000, // Monthly
  revenue_history: [],
};

function step() {
  const month = state.revenue_history.length;
  const sinVal = Math.sin(month / 6 * Math.PI) * state.agVolatility;
  
  const rawRev = 500000 * (1 + sinVal + (Math.random() - 0.5) * 0.1);
  const netRev = rawRev * (1 - state.selfPayRate - (state.medicareMix * 0.15));
  const margin = (netRev - state.fixedCost) / state.fixedCost * 100;
  
  state.revenue_history.push({ month, revenue: netRev, margin });
  if (state.revenue_history.length > 24) state.revenue_history.shift();
}

// ============================================================
//  Visualization
// ============================================================

let svg;
const margin = { top: 20, right: 30, bottom: 40, left: 60 };

function initViz() {
  const container = d3.select('#finance-chart');
  const width = container.node().clientWidth;
  const height = container.node().clientHeight;

  svg = container.append('svg').attr('viewBox', `0 0 ${width} ${height}`).append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);
  
  katex.render(
    String.raw`R_{\text{Net}} = \sum \underbrace{\phi_i R_i}_{\text{Payer}} - C_{\text{Fixed}} \text{, where } \phi_i \in \{ \text{MCR, MCD, PVT} \}`,
    document.getElementById('math-finance'),
    { displayMode: true }
  );
}

function updateViz() {
  step();
  const width = d3.select('#finance-chart').node().clientWidth - margin.left - margin.right;
  const height = 350 - margin.top - margin.bottom;

  const data = state.revenue_history;
  const x = d3.scaleLinear().domain([state.revenue_history[0].month, state.revenue_history[state.revenue_history.length-1].month]).range([0, width]);
  const y = d3.scaleLinear().domain([300000, 600000]).range([height, 0]);

  svg.selectAll('.rev-line')
    .data([data])
    .join('path')
    .attr('class', 'rev-line')
    .transition().duration(200)
    .attr('fill', 'none')
    .attr('stroke', '#1e293b')
    .attr('stroke-width', 3)
    .attr('d', d3.line().x(d => x(d.month)).y(d => y(d.revenue)));

  svg.selectAll('.axis-x').data([0]).join('g').attr('class', 'axis-x').attr('transform', `translate(0, ${height})`).call(d3.axisBottom(x).ticks(6));
  svg.selectAll('.axis-y').data([0]).join('g').attr('class', 'axis-y').call(d3.axisLeft(y).ticks(5).tickFormat(d => `$${d/1000}k`));

  const curMargin = data[data.length-1].margin;
  d3.select('#margin-val').text(curMargin.toFixed(1) + '%');
  d3.select('#payer-eff').text((100 - state.selfPayRate * 100).toFixed(0) + '%');

  // Risk Gauge logic (-90 to 90 deg)
  const risk = ((-curMargin) * 5) + (state.agVolatility * 100);
  const ang = Math.max(-90, Math.min(90, risk - 30));
  d3.select('#risk-arrow').style('transform', `rotate(${ang}deg)`);
}

function initControls() {
  const container = d3.select('#finance-inputs');
  ParameterPanel.createSlider(container, {
    label: 'Medicare/Medicaid Payer Mix',
    min: 0.1, max: 0.9, step: 0.05, value: state.medicareMix,
    onChange: (v) => { state.medicareMix = v; }
  });
  ParameterPanel.createSlider(container, {
    label: 'Agricultural Volatility (Market)',
    min: 0.0, max: 0.5, step: 0.05, value: state.agVolatility,
    onChange: (v) => { state.agVolatility = v; }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initViz();
  initControls();
  d3.interval(updateViz, 1000);
});
