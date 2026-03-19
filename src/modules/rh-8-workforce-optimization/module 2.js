// ============================================================
//  Module RH-8 — Workforce Optimization
//  Chapter 8 of the Rural Healthcare Nexus textbook.
// ============================================================

import * as d3 from 'd3';
import katex from 'katex';
import { ParameterPanel } from '@shared/components';

const state = {
  permanentCount: 8,
  locumCount: 2,
  crossTrainingMult: 1.2, // Generalist factor
  permDailyCost: 450,
  locumDailyCost: 850,
  turnoverRate: 0.02, // Prob of staff leaving per week
  history: [],
};

function step() {
  const totalCost = state.permanentCount * state.permDailyCost + state.locumCount * state.locumDailyCost;
  const efficacy = ((state.permanentCount + state.locumCount) * state.crossTrainingMult / 12 * 100).toFixed(1);
  
  state.history.push({ 
    time: state.history.length, 
    cost: totalCost, 
    staff: state.permanentCount + state.locumCount,
    efficacy, 
  });
  
  if (state.history.length > 30) state.history.shift();

  // Stochastic turnover
  if (Math.random() < state.turnoverRate && state.permanentCount > 4) {
    state.permanentCount--;
  }
}

// ============================================================
//  Visualization
// ============================================================

let svg;
const margin = { top: 20, right: 30, bottom: 40, left: 60 };

function initViz() {
  const container = d3.select('#staffing-chart');
  const width = container.node().clientWidth;
  const height = container.node().clientHeight;

  svg = container.append('svg').attr('viewBox', `0 0 ${width} ${height}`).append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);
  
  katex.render(
    String.raw`C_{\text{Total}} = N_p \cdot c_p + N_l \cdot c_l \text{, where } c_l \gg c_p`,
    document.getElementById('math-workforce'),
    { displayMode: true }
  );
}

function updateViz() {
  step();
  const width = d3.select('#staffing-chart').node().clientWidth - margin.left - margin.right;
  const height = 350 - margin.top - margin.bottom;

  const x = d3.scaleLinear().domain([0, 30]).range([0, width]);
  const y = d3.scaleLinear().domain([0, d3.max(state.history, d => d.cost) * 1.2 || 10000]).range([height, 0]);

  svg.selectAll('.line-cost')
    .data([state.history])
    .join('path')
    .attr('class', 'line-cost')
    .transition().duration(200)
    .attr('fill', 'none')
    .attr('stroke', '#ef4444')
    .attr('stroke-width', 3)
    .attr('d', d3.line().x(d => x(d.time - state.history[0].time)).y(d => y(d.cost)).curve(d3.curveMonotoneX));

  svg.selectAll('.axis-x').data([0]).join('g').attr('class', 'axis-x').attr('transform', `translate(0, ${height})`).call(d3.axisBottom(x).ticks(5));
  svg.selectAll('.axis-y').data([0]).join('g').attr('class', 'axis-y').call(d3.axisLeft(y).ticks(5).tickFormat(d => `$${d}`));

  d3.select('#staff-n').text(state.permanentCount + state.locumCount);
  d3.select('#total-cost').text(`$${(state.permanentCount * state.permDailyCost + state.locumCount * state.locumDailyCost).toLocaleString()}`);
  d3.select('#effic-val').text(state.history[state.history.length-1].efficacy + '%');
}

function initControls() {
  const container = d3.select('#work-inputs');
  ParameterPanel.createSlider(container, {
    label: 'Permanent Staff',
    min: 4, max: 20, step: 1, value: state.permanentCount,
    onChange: (v) => { state.permanentCount = v; }
  });
  ParameterPanel.createSlider(container, {
    label: 'Generalist Index (Cross-Training)',
    min: 1.0, max: 2.0, step: 0.1, value: state.crossTrainingMult,
    onChange: (v) => { state.crossTrainingMult = v; }
  });
  
  document.getElementById('add-locum').onclick = () => {
    state.locumCount++;
    updateViz();
  };
}

document.addEventListener('DOMContentLoaded', () => {
  initViz();
  initControls();
  d3.interval(updateViz, 1000);
});
