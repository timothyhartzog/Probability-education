// ============================================================
//  Module RH-9 — Supply Chain Logistics
//  Chapter 9 of the Rural Healthcare Nexus textbook.
// ============================================================

import * as d3 from 'd3';
import katex from 'katex';
import { ParameterPanel } from '@shared/components';

const state = {
  bloodUnits: 12,
  oxyLevel: 98,
  droneSpeed: 1.2, // pixels/tick
  logisticsGap: 45, // mins (visual factor)
  isDroneActive: false,
  dronePos: { x: 50, y: 50 },
  targetPos: { x: 750, y: 400 },
  startPos: { x: 50, y: 50 },
};

function step() {
  if (state.isDroneActive) {
    const dx = state.targetPos.x - state.dronePos.x;
    const dy = state.targetPos.y - state.dronePos.y;
    const dist = Math.hypot(dx, dy);
    
    if (dist < 5) {
      state.isDroneActive = false;
      state.bloodUnits += 10;
      d3.select('#drone-msg').text('Completed').style('color', '#10b981');
    } else {
      state.dronePos.x += (dx / dist) * state.droneSpeed;
      state.dronePos.y += (dy / dist) * state.droneSpeed;
      d3.select('#drone-msg').text('In-Flight').style('color', '#3b82f6');
    }
  }

  // Inventory decay
  if (Math.random() < 0.05) state.bloodUnits = Math.max(0, state.bloodUnits - 1);
  if (Math.random() < 0.1) state.oxyLevel = Math.max(20, state.oxyLevel - 0.5);
}

// ============================================================
//  Visualization
// ============================================================

let svg;

function initViz() {
  const container = d3.select('#logistics-canv');
  const width = container.node().clientWidth;
  const height = container.node().clientHeight;

  svg = container.append('svg').attr('viewBox', `0 0 ${width} 450`);
  
  // Hub
  svg.append('rect').attr('class', 'station').attr('x', 30).attr('y', 30).attr('width', 40).attr('height', 40);
  svg.append('text').attr('x', 35).attr('y', 85).attr('font-size', '10px').text('Central Hub');
  
  // CAH
  svg.append('rect').attr('class', 'station').attr('x', width-70).attr('y', height-70).attr('width', 40).attr('height', 40);
  svg.append('text').attr('x', width-85).attr('y', height-15).attr('font-size', '10px').text('Remote Clinic');

  // Drone
  svg.append('circle').attr('class', 'drone').attr('r', 8).attr('id', 'drone-v');

  katex.render(
    String.raw`T_{\text{Gap}} = \underbrace{\frac{d}{v_d}}_{\text{Flight}} + \underbrace{\tau}_{\text{Mgt}} \implies \text{Availability} \propto \frac{1}{T_{\text{Gap}}}`,
    document.getElementById('math-logistics'),
    { displayMode: true }
  );
}

function updateViz() {
  step();
  d3.select('#drone-v').transition().duration(50).attr('cx', state.dronePos.x).attr('cy', state.dronePos.y);
  d3.select('#blood-inv').text(state.bloodUnits);
  d3.select('#oxy-inv').text(state.oxyLevel.toFixed(1) + '%');
  d3.select('#log-gap').text((state.logisticsGap / state.droneSpeed).toFixed(1) + ' mins');
}

function initControls() {
  const container = d3.select('#supply-inputs');
  ParameterPanel.createSlider(container, {
    label: 'Drone Velocity (v_d)',
    min: 0.5, max: 3.0, step: 0.1, value: state.droneSpeed,
    onChange: (v) => { state.droneSpeed = v; }
  });
  
  document.getElementById('launch-blood').onclick = () => {
    state.isDroneActive = true;
    state.dronePos = { ...state.startPos };
    updateViz();
  };
}

document.addEventListener('DOMContentLoaded', () => {
  initViz();
  initControls();
  d3.interval(updateViz, 50);
});
