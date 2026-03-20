// ============================================================
//  Module RH-1 — Geospatial Catchment & Accessibility
//  Chapter 5 of the Rural Healthcare Nexus textbook.
// ============================================================

import * as d3 from 'd3';
import katex from 'katex';
import { ParameterPanel } from '@shared/components';
import '../../lib/param-tooltips.js';

// ============================================================
//  1. State and Generation
// ============================================================

const state = {
  towns: [],
  hospitals: [],
  decay: 1.5,     // Distance decay exponent (β)
  threshold: 60,  // Max travel time considered (mins)
  roadFactor: 1.8, // Road winding factor (mins per pixel-distance)
  regionWidth: 800,
  regionHeight: 600,
};

function generateRegion() {
  const towns = [];
  const hospitals = [];
  
  // Create Towns (Population Centers)
  for (let i = 0; i < 35; i++) {
    towns.push({
      id: i,
      x: 50 + Math.random() * (state.regionWidth - 100),
      y: 50 + Math.random() * (state.regionHeight - 100),
      pop: Math.floor(Math.pow(Math.random(), 2) * 8000 + 400),
      accessibility: 0,
      minTravelTime: Infinity,
    });
  }

  // Create Hospitals
  // 1 Large Urban Hub
  hospitals.push({
    id: 100,
    type: 'hub',
    x: state.regionWidth / 2 + (Math.random() - 0.5) * 50,
    y: state.regionHeight / 2 + (Math.random() - 0.5) * 50,
    capacity: 250,
    quality: 1.0,
  });

  // 4 Critical Access Hospitals (CAHs)
  for (let i = 0; i < 4; i++) {
    hospitals.push({
      id: 200 + i,
      type: 'cah',
      x: 100 + Math.random() * (state.regionWidth - 200),
      y: 100 + Math.random() * (state.regionHeight - 200),
      capacity: 25,
      quality: 0.6,
    });
  }

  state.towns = towns;
  state.hospitals = hospitals;
}

// ============================================================
//  2. 2SFCA & Accessibility Logic
// ============================================================

function calculateAccessibility() {
  const { towns, hospitals, decay, roadFactor, threshold } = state;

  function travelTime(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dist = Math.hypot(dx, dy);
    return dist * roadFactor; // minutes
  }

  // Step 1: Calculate Capacity-to-Demand Ratio (Rj) for each hospital
  hospitals.forEach(h => {
    let demand = 0;
    towns.forEach(t => {
      const time = travelTime(h, t);
      if (time <= threshold) {
        // Power-decay function for demand
        const weight = Math.pow(time + 1, -decay);
        demand += t.pop * weight;
      }
    });
    h.ratio = (h.capacity * h.quality) / (demand || 1);
  });

  // Step 2: Sum Ratios for each town (Ai)
  let totalDesertPop = 0;
  let totalPop = 0;

  towns.forEach(t => {
    let score = 0;
    let minT = Infinity;
    hospitals.forEach(h => {
      const time = travelTime(t, h);
      minT = Math.min(minT, time);
      if (time <= threshold) {
        const weight = Math.pow(time + 1, -decay);
        score += h.ratio * weight;
      }
    });
    t.accessibility = score;
    t.minTravelTime = minT;
    
    totalPop += t.pop;
    if (minT > 60) totalDesertPop += t.pop;
  });

  // Statistics
  const desertPerc = (totalDesertPop / totalPop * 100).toFixed(1);
  const avgAccess = d3.mean(towns, t => t.accessibility).toFixed(4);

  d3.select('#desert-pop').text(`${desertPerc}%`);
  d3.select('#desert-bar').style('width', `${desertPerc}%`);
  d3.select('#access-score').text(avgAccess);
}

// ============================================================
//  3. Visualization (D3)
// ============================================================

let svg, chartArea;

function initViz() {
  const container = d3.select('#accessibility-map');
  svg = container.append('svg')
    .attr('viewBox', `0 0 ${state.regionWidth} ${state.regionHeight}`)
    .style('width', '100%')
    .style('height', '100%');

  chartArea = svg.append('g').attr('class', 'chart-area');
  
  const mathEl = document.getElementById('math-gravity');
  if (mathEl) {
    katex.render(
      String.raw`A_i = \sum_{j \in \{d_{ij} \le d_0\}} \left( \frac{S_j}{\sum_{k \in \{d_{kj} \le d_0\}} P_k f(d_{kj})} \right) f(d_{ij})`,
      mathEl,
      { displayMode: true, throwOnError: false }
    );
  }
}

function updateViz() {
  calculateAccessibility();

  // Draw Catchment Background (Heatmap-ish)
  // For simplicity, we color the towns based on access. 
  // In a full implementation, this could be a contour map.

  // 1. Towns
  const townNode = chartArea.selectAll('g.town')
    .data(state.towns, d => d.id)
    .join('g')
    .attr('class', 'town')
    .attr('transform', d => `translate(${d.x}, ${d.y})`);

  townNode.selectAll('circle')
    .data(d => [d])
    .join('circle')
    .attr('r', d => Math.sqrt(d.pop) / 2)
    .attr('fill', d => {
        if (d.minTravelTime > 60) return '#fecaca'; // Desert Red
        if (d.minTravelTime > 30) return '#fef08a'; // Middle Yellow
        return '#dcfce7'; // Access Green
    })
    .attr('stroke', d => d.minTravelTime > 60 ? '#dc2626' : '#16a34a')
    .attr('stroke-width', 1.5)
    .style('transition', 'fill 0.4s');

  // 2. Hospitals
  const hospitalNode = chartArea.selectAll('g.hospital')
    .data(state.hospitals, d => d.id)
    .join('g')
    .attr('class', 'hospital')
    .attr('transform', d => `translate(${d.x}, ${d.y})`);

  hospitalNode.selectAll('circle.h-base')
    .data(d => [d])
    .join('circle')
    .attr('class', 'h-base')
    .attr('r', d => d.type === 'hub' ? 12 : 8)
    .attr('fill', d => d.type === 'hub' ? '#e11d48' : '#ea580c')
    .attr('stroke', '#fff')
    .attr('stroke-width', 2);

  // Cross icon in hospital
  hospitalNode.selectAll('line.h-cross-h')
    .data(d => [d])
    .join('line')
    .attr('class', 'h-cross-h')
    .attr('x1', -4).attr('x2', 4).attr('y1', 0).attr('y2', 0)
    .attr('stroke', '#fff').attr('stroke-width', 2);
  
  hospitalNode.selectAll('line.h-cross-v')
    .data(d => [d])
    .join('line')
    .attr('class', 'h-cross-v')
    .attr('x1', 0).attr('x2', 0).attr('y1', -4).attr('y2', 4)
    .attr('stroke', '#fff').attr('stroke-width', 2);
}

// ============================================================
//  4. Interactivity
// ============================================================

function initControls() {
  const container = d3.select('#region-controls');

  ParameterPanel.createSlider(container, {
    label: 'Travel Threshold (mins)',
    min: 15, max: 120, step: 5, value: state.threshold,
    onChange: (v) => { state.threshold = v; updateViz(); }
  });

  ParameterPanel.createSlider(container, {
    label: 'Travel Decay (β)',
    min: 0.5, max: 3.0, step: 0.1, value: state.decay,
    onChange: (v) => { state.decay = v; updateViz(); }
  });

  ParameterPanel.createSlider(container, {
    label: 'Road Inefficiency',
    min: 1.0, max: 3.0, step: 0.1, value: state.roadFactor,
    onChange: (v) => { state.roadFactor = v; updateViz(); }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  generateRegion();
  initViz();
  initControls();
  updateViz();

  document.getElementById('re-randomize').addEventListener('click', () => {
    generateRegion();
    updateViz();
  });
});
