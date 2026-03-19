// ============================================================
//  Module MQ-10 — Vaccine Impact Simulator
//  Interactive epidemiological simulator for vaccination strategies.
// ============================================================

import * as d3 from 'd3';
import katex from 'katex';
import { ParameterPanel } from '@shared/components';

// ============================================================
//  State and Simulation Logic
// ============================================================

const state = {
  n: 365,               // Total simulation days
  population: 100000,   // Total population
  r0: 5.0,              // Basic reproduction number
  recoveryPeriod: 10,   // Days to recover
  vaxRate: 0.1,         // Initial vaccination rate (at start)
  vaxPace: 0.0,         // Daily vaccination pace (prop of s, daily)
  vaxEfficacy: 0.95,    // Vaccine efficacy against infection
  initialInfected: 10,  // Initial cases
  isSimulating: true,   // Is the simulation currently being computed
};

/** 
 * Solves the SIRV (Susceptible-Infected-Recovered-Vaccinated) 
 * compartmental model using discrete daily steps. 
 */
function runSimulation() {
  const { n, population, r0, recoveryPeriod, vaxRate, vaxPace, vaxEfficacy, initialInfected } = state;
  const gamma = 1 / recoveryPeriod;  // Recovery rate
  const beta = r0 * gamma;           // Transmission rate

  let s = population * (1 - vaxRate) - initialInfected;
  let i = initialInfected;
  let r = 0;
  let v = population * vaxRate;

  const results = [{ day: 0, s, i, r, v }];

  for (let day = 1; day < n; day++) {
    const ds_vax = s * vaxPace; // Daily vaccination flow from Susceptible
    const effective_beta = beta * i / population;
    
    const ds_inf = s * effective_beta; // Daily infection flow (unvaccinated)
    const dv_inf = v * effective_beta * (1 - vaxEfficacy); // Breakout infections

    const di_rec = i * gamma; // Daily recovery flow from Infected

    // Update compartments
    s -= (ds_vax + ds_inf);
    v += ds_vax - dv_inf;
    i += (ds_inf + dv_inf - di_rec);
    r += di_rec;

    results.push({ 
      day, 
      s: Math.max(0, s), 
      i: Math.max(0, i), 
      r: Math.max(0, r), 
      v: Math.max(0, v) 
    });
  }
  return results;
}

// ============================================================
//  Visualization
// ============================================================

const margin = { top: 20, right: 30, bottom: 40, left: 60 };
let svg, xScale, yScale, lineGenerators;

function initViz() {
  const container = d3.select('#simulation-chart');
  const width = container.node().clientWidth - margin.left - margin.right;
  const height = container.node().clientHeight - margin.top - margin.bottom;

  svg = container.append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  xScale = d3.scaleLinear().domain([0, state.n]).range([0, width]);
  yScale = d3.scaleLinear().domain([0, state.population]).range([height, 0]);

  // Axes
  svg.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale).ticks(10));

  svg.append('g')
    .attr('class', 'y-axis')
    .call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format('.1s')));

  lineGenerators = {
    s: d3.line().x(d => xScale(d.day)).y(d => yScale(d.s)).curve(d3.curveMonotoneX),
    i: d3.line().x(d => xScale(d.day)).y(d => yScale(d.i)).curve(d3.curveMonotoneX),
    r: d3.line().x(d => xScale(d.day)).y(d => yScale(d.r)).curve(d3.curveMonotoneX),
    v: d3.line().x(d => xScale(d.day)).y(d => yScale(d.v)).curve(d3.curveMonotoneX),
  };

  // Paths
  const paths = ['s', 'i', 'r', 'v'];
  const colors = ['#2563eb', '#e97319', '#059669', '#7c3aed'];

  paths.forEach((p, idx) => {
    svg.append('path')
      .attr('class', `line-${p}`)
      .attr('fill', 'none')
      .attr('stroke', colors[idx])
      .attr('stroke-width', 2.5);
  });
}

function updateViz() {
  const data = runSimulation();
  
  // Update paths
  svg.select('.line-s').datum(data).attr('d', lineGenerators.s);
  svg.select('.line-i').datum(data).attr('d', lineGenerators.i);
  svg.select('.line-r').datum(data).attr('d', lineGenerators.r);
  svg.select('.line-v').datum(data).attr('d', lineGenerators.v);

  // Update Stats Cards (at peak infection)
  const peakInfected = d3.max(data, d => d.i);
  const lastState = data[data.length - 1];
  
  d3.select('#stat-s').text(d3.format(',.0f')(lastState.s));
  d3.select('#stat-i').text(d3.format(',.0f')(peakInfected) + ' (Peak)');
  d3.select('#stat-r').text(d3.format(',.0f')(lastState.r));
  d3.select('#stat-v').text(d3.format(',.0f')(lastState.v));
}

// ============================================================
//  UI Controls
// ============================================================

function initControls() {
  const container = d3.select('#controls');

  ParameterPanel.createSlider(container, {
    label: 'Basic Reproduction Number (R0)',
    min: 1.0, max: 15.0, step: 0.1, value: state.r0,
    onChange: (v) => { state.r0 = v; updateViz(); }
  });

  ParameterPanel.createSlider(container, {
    label: 'Recovery Period (Days)',
    min: 1, max: 21, step: 1, value: state.recoveryPeriod,
    onChange: (v) => { state.recoveryPeriod = v; updateViz(); }
  });

  ParameterPanel.createSlider(container, {
    label: 'Initial Vaccination Coverage',
    min: 0.0, max: 0.99, step: 0.01, value: state.vaxRate,
    onChange: (v) => { state.vaxRate = v; updateViz(); }
  });

  ParameterPanel.createSlider(container, {
    label: 'Daily Vaccination Pace',
    min: 0.0, max: 0.02, step: 0.001, value: state.vaxPace,
    onChange: (v) => { state.vaxPace = v; updateViz(); }
  });

  ParameterPanel.createSlider(container, {
    label: 'Vaccine Efficacy',
    min: 0.0, max: 0.99, step: 0.01, value: state.vaxEfficacy,
    onChange: (v) => { state.vaxEfficacy = v; updateViz(); }
  });
}

function initMath() {
  const mathEl = document.getElementById('math-sirv');
  if (mathEl) {
    katex.render(
      String.raw`
      \begin{aligned}
      \frac{dS}{dt} &= -\beta \frac{S I}{N} - \nu S \\
      \frac{dV}{dt} &= \nu S - (1 - \epsilon)\beta \frac{V I}{N} \\
      \frac{dI}{dt} &= \beta \frac{S I}{N} + (1 - \epsilon)\beta \frac{V I}{N} - \gamma I \\
      \frac{dR}{dt} &= \gamma I
      \end{aligned}
      `,
      mathEl,
      { displayMode: true, throwOnError: false }
    );
  }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  initViz();
  initControls();
  initMath();
  updateViz();
  
  // Handle Resize
  window.addEventListener('resize', () => {
    d3.select('#simulation-chart').selectAll('*').remove();
    initViz();
    updateViz();
  });
});
