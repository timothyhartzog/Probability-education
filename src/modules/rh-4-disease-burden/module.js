// ============================================================
//  Module RH-4 — Disease Burden Mapping
//  Chapter 4 of the Rural Healthcare Nexus textbook.
// ============================================================

import * as d3 from 'd3';
import katex from 'katex';
import { ParameterPanel } from '@shared/components';
import '../../lib/param-tooltips.js';

// ============================================================
//  Model & State
// ============================================================

const state = {
  r0: 2.5,
  recoveryDays: 7,
  chronicPrev: 0.12,
  nodes: [],
  links: [],
  isRunning: true,
  time: 0,
};

function initNetwork() {
  const n = 60;
  const nodes = d3.range(n).map(i => ({
    id: i,
    status: 'S', // S, I, R
    infectionDay: -1,
    isChronic: Math.random() < state.chronicPrev,
    x: 50 + Math.random() * 700,
    y: 50 + Math.random() * 300,
  }));

  // Create regional "town" clusters
  const links = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
      if (dist < 80 && Math.random() < 0.6) {
        links.push({ source: i, target: j });
      }
    }
  }
  
  // Seed one infection
  nodes[0].status = 'I';
  nodes[0].infectionDay = 0;

  state.nodes = nodes;
  state.links = links;
}

function step() {
  if (!state.isRunning) return;
  state.time++;

  const newInfections = [];
  const transmissionProb = state.r0 / (state.recoveryDays * 4); // Scaled prob

  state.nodes.forEach(node => {
    if (node.status === 'I') {
      // Infect neighbors
      state.links.forEach(l => {
        let neighbor = null;
        if (l.source.id === node.id) neighbor = l.target;
        else if (l.target.id === node.id) neighbor = l.source;
        
        if (neighbor && neighbor.status === 'S') {
          // Rural multiplier: Chronic patients more likely to catch/spread
          const prob = transmissionProb * (neighbor.isChronic ? 1.5 : 1.0);
          if (Math.random() < prob) {
            newInfections.push(neighbor.id);
          }
        }
      });

      // Recover
      if (state.time - node.infectionDay > state.recoveryDays * 5) {
        node.status = 'R';
      }
    }
  });

  newInfections.forEach(id => {
    const n = state.nodes.find(d => d.id === id);
    if (n.status === 'S') {
      n.status = 'I';
      n.infectionDay = state.time;
    }
  });
}

// ============================================================
//  Visualization
// ============================================================

let svg, sim;

function initViz() {
  const container = d3.select('#disease-canv');
  const width = container.node().clientWidth;
  const height = container.node().clientHeight;

  svg = container.append('svg').attr('viewBox', `0 0 ${width} 400`);
  
  sim = d3.forceSimulation(state.nodes)
    .force('link', d3.forceLink(state.links).id(d => d.id).distance(50))
    .force('charge', d3.forceManyBody().strength(-30))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .on('tick', () => {
      svg.selectAll('.link').attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      svg.selectAll('.node').attr('cx', d => d.x).attr('cy', d => d.y);
    });

  svg.selectAll('.link').data(state.links).join('line').attr('class', 'link');
  svg.selectAll('.node').data(state.nodes).join('circle').attr('class', 'node').attr('r', 6);

  katex.render(
    String.raw`R_0 = \beta \cdot D \cdot c(\text{Rural Connectivity})`,
    document.getElementById('math-epidemic'),
    { displayMode: true }
  );
}

function updateViz() {
  step();
  svg.selectAll('.node')
    .attr('fill', d => d.status === 'I' ? '#ef4444' : d.status === 'R' ? '#64748b' : '#10b981')
    .attr('stroke', d => d.isChronic ? '#f59e0b' : '#fff')
    .attr('stroke-width', d => d.isChronic ? 3 : 1.5);

  const nInfected = state.nodes.filter(d => d.status === 'I').length;
  d3.select('#perc-inf').text((nInfected / state.nodes.length * 100).toFixed(1) + '%');
  d3.select('#val-re').text((state.r0 * (1 - nInfected / state.nodes.length)).toFixed(2));
}

function initControls() {
  const container = d3.select('#disease-inputs');
  ParameterPanel.createSlider(container, {
    label: 'Basic Reproduction No (R0)',
    min: 0.5, max: 5.0, step: 0.1, value: state.r0,
    onChange: (v) => { state.r0 = v; }
  });
  ParameterPanel.createSlider(container, {
    label: 'Recovery Period (Days)',
    min: 3, max: 15, step: 1, value: state.recoveryDays,
    onChange: (v) => { state.recoveryDays = v; }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initNetwork();
  initViz();
  initControls();
  
  d3.interval(updateViz, 100);
  document.getElementById('btn-reset').onclick = () => {
    initNetwork();
    state.time = 0;
    sim.nodes(state.nodes);
    sim.force('link').links(state.links);
    sim.alpha(1).restart();
  };
});
