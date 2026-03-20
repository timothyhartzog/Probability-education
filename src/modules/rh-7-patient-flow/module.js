// ============================================================
//  Module RH-7 — Patient Flow & Surge Simulator
//  Chapter 7 of the Rural Healthcare Nexus textbook.
// ============================================================

import * as d3 from 'd3';
import katex from 'katex';
import { ParameterPanel } from '@shared/components';
import { SimulationEngine } from '../../shared/SimulationEngine';
import { ErrorBoundary } from '../../shared/ErrorBoundary';
import '../../lib/param-tooltips.js';

// Initialize Antigravity Error Boundary
ErrorBoundary.init();

// ============================================================
//  State and Simulation Logic
// ============================================================

const state = {
  urban: {
    beds: 500,
    meanArrivals: 85, // Patients per day
    meanService: 3.2, // Days average stay
    currentOccupancy: 0,
    queue: 0,
    waitTimes: [],
    diversionCount: 0,
    patients: [],
  },
  rural: {
    beds: 25,
    meanArrivals: 4,  // Patients per day
    meanService: 3.2, // Days average stay
    currentOccupancy: 0,
    queue: 0,
    waitTimes: [],
    diversionCount: 0,
    patients: [],
  },
  time: 0,
  isRunning: false,
  speed: 1, // Days per tick
};

/** Discrete time step of the hospital system (daily resolution) */
function stepSimulation(hType) {
  const h = state[hType];
  const lambda = h.meanArrivals; // Arrival rate
  const mu = 1 / h.meanService; // Service rate (per day)

  // 1. Discharge patients whose stay is over
  h.patients = h.patients.filter(p => {
    p.remainingStay -= 1;
    return p.remainingStay > 0;
  });

  // 2. Clear queue into available beds
  while (h.queue > 0 && h.patients.length < h.beds) {
    h.queue--;
    const stay = Math.max(1, d3.randomExponential(mu)());
    h.patients.push({ id: Math.random(), remainingStay: stay });
  }

  // 3. New Arrivals (Poisson process)
  const nArrivals = d3.randomPoisson(lambda)();
  for (let i = 0; i < nArrivals; i++) {
    if (h.patients.length < h.beds) {
      const stay = Math.max(1, d3.randomExponential(mu)());
      h.patients.push({ id: Math.random(), remainingStay: stay });
    } else {
      h.queue++;
      if (h.queue > h.beds * 0.1) {
        h.diversionCount++;
      }
    }
  }

  h.currentOccupancy = h.patients.length;
}

function triggerTrauma(hType) {
  const h = state[hType];
  const nTrauma = 6; // Multicasualty event (MCI)
  const logBox = document.getElementById('log-box');
  
  const entry = document.createElement('div');
  entry.className = 'log-entry critical';
  entry.textContent = `[EVENT] DAY ${Math.floor(state.time)}: MASS CASUALTY RESPONSE (${nTrauma} Patients Incoming)...`;
  logBox.prepend(entry);

  for (let i = 0; i < nTrauma; i++) {
    const stay = 4 + Math.random() * 6; // High acuity needs
    if (h.patients.length < h.beds) {
      h.patients.push({ id: Math.random(), remainingStay: stay });
    } else {
      h.queue++;
    }
  }
}

// ============================================================
//  Visualization
// ============================================================

function initViz() {
  const ruralGrid = d3.select('#rural-beds');
  ruralGrid.selectAll('.bed')
    .data(d3.range(25))
    .join('div')
    .attr('class', 'bed')
    .attr('id', (d, i) => `rural-bed-${i}`);

  const mathEl = document.getElementById('math-variance');
  if (mathEl) {
    katex.render(
      String.raw`Var[\bar{X}_n] = \frac{\sigma^2}{n} \implies \text{CV}_{\text{Rural}} \gg \text{CV}_{\text{Urban}}`,
      mathEl,
      { displayMode: true, throwOnError: false }
    );
  }
}

function updateViz() {
  // Update Rural Bed Grid
  const rural = state.rural;
  const urban = state.urban;

  d3.select('#rural-beds').selectAll('.bed')
    .classed('occupied', (d, i) => i < rural.currentOccupancy);

  const rPerc = (rural.currentOccupancy / rural.beds * 100).toFixed(0);
  const uPerc = (urban.currentOccupancy / urban.beds * 100).toFixed(0);

  d3.select('#rural-occupancy').text(`${rPerc}%`);
  d3.select('#urban-occupancy').text(`${uPerc}%`);

  d3.select('#rural-wait').text(rural.queue > 0 ? `${rural.queue} pts` : 'No queue');
  d3.select('#urban-wait').text(urban.queue > 0 ? `${urban.queue} pts` : 'No queue');

  d3.select('#rural-diversion').text(rural.queue > 2 ? 'YES (Saturated)' : 'No')
    .style('color', rural.queue > 2 ? 'var(--color-error)' : 'inherit');
  
  d3.select('#urban-diversion').text(urban.queue > 50 ? 'YES' : 'No')
    .style('color', urban.queue > 50 ? 'var(--color-error)' : 'inherit');
}

const engine = new SimulationEngine({
  name: 'Patient Flow Simulator',
  onUpdate: async () => {
    state.time += 1;
    stepSimulation('urban');
    stepSimulation('rural');
    updateViz();
    // Expose state for Antigravity diagnostics
    window.SIM_STATE = state;
  }
});

function runLoop() {
  if (state.isRunning) engine.start(state);
  else engine.stop();
}

// ============================================================
//  Init
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initViz();
  updateViz();

  document.getElementById('btn-play').addEventListener('click', (e) => {
    state.isRunning = !state.isRunning;
    e.target.textContent = state.isRunning ? 'Pause Simulation' : 'Run Simulation';
    runLoop();
  });


  document.getElementById('btn-trauma').addEventListener('click', () => {
    triggerTrauma('urban');
    triggerTrauma('rural');
    updateViz();
  });
});
