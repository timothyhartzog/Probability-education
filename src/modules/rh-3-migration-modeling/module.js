// ============================================================
//  Module RH-3 — Migration Modeling
//  Chapter 3 of the Rural Healthcare Nexus textbook.
// ============================================================

import * as d3 from 'd3';
import katex from 'katex';
import { ParameterPanel } from '@shared/components';

// ============================================================
//  Model & State
// ============================================================

const state = {
  youthMigration: -0.15, // Net annual 18-25 migration
  retireeMigration: 0.05, // Net annual 65+ migration
  birthRate: 0.012,
  deathRateVal: 0.015,
  projectionYears: 20,
  population: [], // Current population by age cohort (5-year steps)
  projection: [], // History of totals and dependency ratios
};

function initPopulation() {
  // Simple rural baseline
  const cohorts = d3.range(0, 101, 5);
  state.population = cohorts.map(age => {
    let count = 1000 * Math.exp(-age / 40);
    if (age >= 18 && age <= 25) count *= 0.8; // Baseline youth drain
    if (age >= 65) count *= 1.1; // Baseline retirees
    return { age, count };
  });
}

function runProjection() {
  initPopulation();
  const years = state.projectionYears;
  state.projection = [];

  for (let yr = 0; yr <= years; yr++) {
    const total = d3.sum(state.population, d => d.count);
    const retired = d3.sum(state.population.filter(d => d.age >= 65), d => d.count);
    const working = d3.sum(state.population.filter(d => d.age >= 15 && d.age < 65), d => d.count);
    
    state.projection.push({ 
      year: yr, 
      total, 
      ratio: retired / (working || 1),
      pyramid: JSON.parse(JSON.stringify(state.population))
    });

    // Simple aging and migration step
    const nextPop = state.population.map(d => ({ ...d, count: d.count * (1 - state.deathRateVal) }));
    
    // Shift cohorts (aging) every 5 virtual steps
    // For this simple sim, we apply migration directly to cohorts each yr
    nextPop.forEach(d => {
      if (d.age >= 18 && d.age <= 25) d.count *= (1 + state.youthMigration);
      if (d.age >= 65) d.count *= (1 + state.retireeMigration);
    });
    
    // Births at age 0
    nextPop[0].count += total * state.birthRate;
    state.population = nextPop;
  }
}

// ============================================================
//  Visualization
// ============================================================

let pyramidSvg, projectionSvg;
const margin = { top: 20, right: 30, bottom: 40, left: 50 };

function initViz() {
  const pContainer = d3.select('#pyramid-viz');
  const width = pContainer.node().clientWidth;
  const height = pContainer.node().clientHeight;

  pyramidSvg = pContainer.append('svg').attr('viewBox', `0 0 ${width} ${height}`).append('g').attr('transform', `translate(${width/2}, ${margin.top})`);
  
  const prContainer = d3.select('#projection-viz');
  projectionSvg = prContainer.append('svg').attr('viewBox', `0 0 ${width} 250`).append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

  katex.render(
    String.raw`D_r = \frac{\text{Pop}_{65+}}{\text{Pop}_{15-64}}`, 
    document.getElementById('math-dependency'), 
    { displayMode: true }
  );
}

function updateViz() {
  const data = state.projection[state.projection.length - 1]; // Latest year
  const pyramid = data.pyramid;

  const width = d3.select('#pyramid-viz').node().clientWidth;
  const pHeight = 400 - margin.top - margin.bottom;

  const y = d3.scaleBand().domain(pyramid.map(d => d.age)).range([pHeight, 0]).padding(0.1);
  const x = d3.scaleLinear().domain([0, d3.max(state.projection[0].pyramid, d => d.count) * 1.5]).range([0, width / 2 - 40]);

  pyramidSvg.selectAll('.bar')
    .data(pyramid)
    .join('rect')
    .attr('class', 'bar')
    .transition().duration(400)
    .attr('x', d => -x(d.count))
    .attr('y', d => y(d.age))
    .attr('width', d => x(d.count))
    .attr('height', y.bandwidth())
    .attr('fill', d => d.age >= 65 ? 'var(--color-category-medical)' : 'var(--color-primary)');

  // Duplicate for mirror symmetry (M/F ignored for simplicity)
  pyramidSvg.selectAll('.bar-mirror')
    .data(pyramid)
    .join('rect')
    .attr('class', 'bar-mirror')
    .transition().duration(400)
    .attr('x', 0)
    .attr('y', d => y(d.age))
    .attr('width', d => x(d.count))
    .attr('height', y.bandwidth())
    .attr('fill', d => d.age >= 65 ? 'var(--color-category-medical)' : 'var(--color-primary)');

  d3.select('#dep-ratio').text(data.ratio.toFixed(2));

  // Projection Line
  const prWidth = width - margin.left - margin.right;
  const prHeight = 250 - margin.top - margin.bottom;
  const xPr = d3.scaleLinear().domain([0, state.projectionYears]).range([0, prWidth]);
  const yPr = d3.scaleLinear().domain([0, d3.max(state.projection, d => d.ratio) * 1.2]).range([prHeight, 0]);

  projectionSvg.selectAll('path.line')
    .data([state.projection])
    .join('path')
    .attr('class', 'line')
    .transition().duration(400)
    .attr('fill', 'none')
    .attr('stroke', 'var(--color-category-medical)')
    .attr('stroke-width', 3)
    .attr('d', d3.line().x(d => xPr(d.year)).y(d => yPr(d.ratio)));

  projectionSvg.selectAll('.axis-x').data([0]).join('g').attr('class', 'axis-x').attr('transform', `translate(0, ${prHeight})`).call(d3.axisBottom(xPr));
  projectionSvg.selectAll('.axis-y').data([0]).join('g').attr('class', 'axis-y').call(d3.axisLeft(yPr).ticks(5));
}

function initControls() {
  const container = d3.select('#migration-inputs');
  ParameterPanel.createSlider(container, {
    label: 'Youth Out-Migration (18-25)',
    min: -0.3, max: 0.05, step: 0.01, value: state.youthMigration,
    onChange: (v) => { state.youthMigration = v; runProjection(); updateViz(); }
  });
  ParameterPanel.createSlider(container, {
    label: 'Retiree In-Migration (65+)',
    min: -0.05, max: 0.2, step: 0.01, value: state.retireeMigration,
    onChange: (v) => { state.retireeMigration = v; runProjection(); updateViz(); }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initViz();
  initControls();
  runProjection();
  updateViz();
});
