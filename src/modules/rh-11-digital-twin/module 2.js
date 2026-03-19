// ============================================================
//  Module RH-11 — Hospital Digital Twin (DES)
//  Chapter 11 of the Rural Healthcare Nexus textbook.
// ============================================================

import * as d3 from 'd3';
import katex from 'katex';
import { ParameterPanel } from '@shared/components';

const state = {
  numBeds: 25,
  labCapacity: 1,
  xrayCapacity: 1,
  transCapacity: 1,
  patients: [],
  queues: { lab: [], xray: [], trans: [] },
  history: [],
};

function createPatient() {
  return {
    id: Math.random(),
    status: 'triage',
    timeIn: Date.now(),
    path: ['lab', 'xray', 'trans'],
    curTask: null,
    pos: { x: 50, y: 50 },
  };
}

function processDES() {
  const dt = 1;
  state.patients.forEach(p => {
    if (p.status === 'triage') {
      p.status = 'exam'; 
      p.pos = { x: 150, y: 150 };
    }
    
    if (p.status === 'exam' && p.path.length > 0) {
      const nextTask = p.path[0];
      if (state.queues[nextTask].length < state[`${nextTask}Capacity`]) {
        p.status = nextTask;
        p.path.shift();
        state.queues[nextTask].push(p.id);
        p.pos = nextTask === 'lab' ? { x: 300, y: 100 } : nextTask === 'xray' ? { x: 300, y: 200 } : { x: 300, y: 300 };
      }
    }
  });

  // Finish tasks
  ['lab', 'xray', 'trans'].forEach(task => {
    if (Math.random() < 0.1 && state.queues[task].length > 0) {
      const pId = state.queues[task].shift();
      const p = state.patients.find(d => d.id === pId);
      if (p) {
        if (p.path.length === 0) {
           state.patients = state.patients.filter(d => d.id !== pId);
        } else {
           p.status = 'exam';
           p.pos = { x: 150, y: 150 };
        }
      }
    }
  });
}

// ============================================================
//  Visualization
// ============================================================

let svg;

function initViz() {
  const container = d3.select('#twin-canv');
  const width = container.node().clientWidth;
  const height = container.node().clientHeight;

  svg = container.append('svg').attr('viewBox', `0 0 800 500`);
  
  // Triage Station
  svg.append('rect').attr('class', 'room').attr('x', 20).attr('y', 20).attr('width', 100).attr('height', 100);
  svg.append('text').attr('x', 30).attr('y', 40).text('Triage');

  // Exam Area
  svg.append('rect').attr('class', 'room').attr('x', 140).attr('y', 20).attr('width', 120).attr('height', 400);
  svg.append('text').attr('x', 150).attr('y', 40).text('Exam Area');

  // Lab, Xray, Trans
  ['lab', 'xray', 'trans'].forEach((t, i) => {
    svg.append('rect').attr('class', 'room').attr('x', 280).attr('y', 20 + i*130).attr('width', 100).attr('height', 100);
    svg.append('text').attr('x', 290).attr('y', 40+ i*130).text(t.toUpperCase());
  });

  katex.render(
    String.raw`E[T_{\text{Cycle}}] = T_{\text{Triage}} + \sum (T_{\text{Queue},j} + T_{\text{Service},j})`,
    document.getElementById('math-des'),
    { displayMode: true }
  );
}

function updateViz() {
  processDES();
  const pts = svg.selectAll('.pt-node').data(state.patients, d => d.id);
  
  pts.join('circle')
    .attr('class', 'pt-node')
    .attr('r', 6)
    .attr('fill', '#ef4444')
    .transition().duration(200)
    .attr('cx', d => d.pos.x)
    .attr('cy', d => d.pos.y);

  d3.select('#q-lab').text(state.queues.lab.length);
  d3.select('#q-xray').text(state.queues.xray.length);
  d3.select('#q-trans').text(state.queues.trans.length);
  d3.select('#pts-ed').text(state.patients.length);
  d3.select('#total-delay').text((state.queues.trans.length * 15) + ' mins');
}

function initControls() {
  const container = d3.select('#twin-inputs');
  ParameterPanel.createSlider(container, {
    label: 'Lab Capacity (Analyzers)',
    min: 1, max: 3, step: 1, value: state.labCapacity,
    onChange: (v) => { state.labCapacity = v; }
  });
  ParameterPanel.createSlider(container, {
    label: 'X-Ray Machines',
    min: 1, max: 2, step: 1, value: state.xrayCapacity,
    onChange: (v) => { state.xrayCapacity = v; }
  });
  
  document.getElementById('add-pt').onclick = () => {
    state.patients.push(createPatient());
    updateViz();
  };
}

document.addEventListener('DOMContentLoaded', () => {
  initViz();
  initControls();
  d3.interval(updateViz, 500);
});
