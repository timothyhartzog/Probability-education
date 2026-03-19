// ============================================================
//  Module RH-12 — Disaster Resilience
//  Chapter 12 of the Rural Healthcare Nexus textbook.
// ============================================================

import * as d3 from 'd3';
import katex from 'katex';
import { ParameterPanel } from '@shared/components';

const state = {
  ambuCount: 2,
  triageRate: 0.1, // Patients/tick
  transferRate: 0.05,
  patients: [],
  stabilized: 0,
};

function createMCI() {
  const n = 15 + Math.floor(Math.random() * 10);
  const pts = d3.range(n).map(i => ({
    id: i,
    triage: Math.random() < 0.2 ? 'red' : Math.random() < 0.4 ? 'yellow' : 'green',
    status: 'incident',
    x: 50 + Math.random() * 200,
    y: 50 + Math.random() * 300,
  }));
  state.patients = pts;
}

function processMCI() {
  state.patients.forEach(p => {
    if (p.status === 'incident') {
      if (Math.random() < state.triageRate) {
        p.status = 'triage';
        p.x = 400; p.y = 150 + (Math.random()-0.5)*100;
      }
    }
  });

  // Transfer red and yellow
  state.patients.forEach(p => {
    if (p.status === 'triage') {
       if (Math.random() < state.transferRate * state.ambuCount) {
          p.status = 'transferred';
          state.stabilized++;
       }
    }
  });

  state.patients = state.patients.filter(d => d.status !== 'transferred');
}

// ============================================================
//  Visualization
// ============================================================

let svg;

function initViz() {
  const container = d3.select('#mci-canv');
  const width = container.node().clientWidth;
  const height = container.node().clientHeight;

  svg = container.append('svg').attr('viewBox', `0 0 800 400`);
  
  // Incident Site
  svg.append('rect').attr('fill', '#ef444433').attr('x', 20).attr('y', 20).attr('width', 260).attr('height', 360).attr('rx', 10);
  svg.append('text').attr('fill', '#fff').attr('x', 40).attr('y', 50).text('INCIDENT SITE');

  // Rural CAH
  svg.append('rect').attr('fill', '#3b82f633').attr('x', 320).attr('y', 20).attr('width', 200).attr('height', 360).attr('rx', 10);
  svg.append('text').attr('fill', '#fff').attr('x', 340).attr('y', 50).text('RURAL FACILITY');

  // Transfer Desk
  svg.append('rect').attr('fill', '#10b98133').attr('x', 560).attr('y', 20).attr('width', 220).attr('height', 360).attr('rx', 10);
  svg.append('text').attr('fill', '#fff').attr('x', 580).attr('y', 50).text('TRANSFER (Egress)');

  katex.render(
    String.raw`S_{\text{Resilience}} = \int_0^T \frac{C_{\text{Out}}(t)}{C_{\text{In}}(t)} dt \text{, where } C_{\text{Out}} \propto N_{\text{Ambulance}}`,
    document.getElementById('math-disaster'),
    { displayMode: true }
  );
}

function updateViz() {
  processMCI();
  const pts = svg.selectAll('.pt-mci').data(state.patients, d => d.id);
  
  pts.join('circle')
    .attr('class', 'pt-mci')
    .attr('r', 6)
    .attr('fill', d => d.triage === 'red' ? '#ef4444' : d.triage === 'yellow' ? '#f59e0b' : '#10b981')
    .attr('stroke', '#fff')
    .transition().duration(400)
    .attr('cx', d => d.status === 'incident' ? d.x : d.status === 'triage' ? d.x : 700)
    .attr('cy', d => d.y);

  d3.select('#stat-red').text(state.patients.filter(d => d.triage === 'red').length);
  d3.select('#stat-yellow').text(state.patients.filter(d => d.triage === 'yellow').length);
  d3.select('#stat-green').text(state.patients.filter(d => d.triage === 'green').length);
  d3.select('#stat-trans').text(state.stabilized);
  
  const total = state.patients.length + state.stabilized;
  d3.select('#sat-perc').text(Math.min(100, (state.patients.length / 15 * 100)).toFixed(0) + '%');
}

function initControls() {
  const container = d3.select('#mci-inputs');
  ParameterPanel.createSlider(container, {
    label: 'Available Ambulances',
    min: 1, max: 5, step: 1, value: state.ambuCount,
    onChange: (v) => { state.ambuCount = v; }
  });
  
  document.getElementById('trigger-mci').onclick = () => {
    createMCI();
    state.stabilized = 0;
    updateViz();
  };
}

document.addEventListener('DOMContentLoaded', () => {
  initViz();
  initControls();
  d3.interval(updateViz, 500);
});
