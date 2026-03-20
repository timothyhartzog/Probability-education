// ============================================================
//  Module RH-13 — Future Tech (RPM)
//  Chapter 13 of the Rural Healthcare Nexus textbook.
// ============================================================

import * as d3 from 'd3';
import katex from 'katex';
import { ParameterPanel } from '@shared/components';
import '../../lib/param-tooltips.js';

const state = {
  sensitivity: 0.8,
  enrollmentRate: 0.4,
  patients: [],
  avoidedCount: 0,
};

function createPatient() {
  const signal = d3.range(20).map(() => 50 + (Math.random()-0.5)*10);
  return {
    id: Math.random(),
    signal,
    alert: false,
    timer: 0,
  };
}

function processRPM() {
  state.patients.forEach(p => {
    // Update signal sparkline
    p.signal.shift();
    const last = p.signal[p.signal.length - 1];
    const nextVal = Math.max(10, Math.min(90, last + (Math.random()-0.5)*15));
    p.signal.push(nextVal);

    if (nextVal > 80 || nextVal < 20) {
      if (!p.alert && Math.random() < state.sensitivity) {
         p.alert = true;
         p.timer = 15; // Duration of alert resolution
      }
    }

    if (p.alert) {
      p.timer--;
      if (p.timer <= 0) {
         p.alert = false;
         state.avoidedCount++;
      }
    }
  });
}

// ============================================================
//  Visualization
// ============================================================

function initViz() {
  for (let i = 0; i < 12; i++) state.patients.push(createPatient());

  katex.render(
    String.raw`N_{\text{SynthBeds}} = \underbrace{N_{\text{RPM}} \cdot \text{eff}_{\text{avoid}}}_{\text{Prevention}} \implies \text{Cap}_{\text{Eff}} = \text{Cap}_{\text{Phys}} + N_{\text{SynthBeds}}`,
    document.getElementById('math-rpm'),
    { displayMode: true }
  );
}

function updateViz() {
  processRPM();
  const container = d3.select('#iot-grid');
  
  const monitors = container.selectAll('.patient-monitor').data(state.patients, d => d.id);
  
  const enter = monitors.enter().append('div').attr('class', 'patient-monitor');
  enter.append('div').attr('class', 'status-dot');
  enter.append('div').attr('class', 'm-label').style('font-size', '8px').text((d, i) => `RP-${i+100}`);
  enter.append('div').attr('class', 'telemetry').append('svg').style('width', '100%').style('height', '100%').append('path').attr('class', 'sparkline');

  monitors.select('.status-dot').classed('alert', d => d.alert);
  
  monitors.select('.sparkline').attr('d', d => {
     const x = d3.scaleLinear().domain([0, 19]).range([0, 70]);
     const y = d3.scaleLinear().domain([0, 100]).range([30, 0]);
     return d3.line().x((_, i) => x(i)).y(v => y(v))(d.signal);
  });

  d3.select('#adm-avoid').text(state.avoidedCount);
  d3.select('#active-alert').text(state.patients.filter(d => d.alert).length);
  d3.select('#reach-perc').text((state.patients.length / 50 * 100).toFixed(0) + '%');
  d3.select('#future-margin').text((2.4 + state.avoidedCount/10).toFixed(1) + '%');
}

function initControls() {
  const container = d3.select('#future-inputs');
  ParameterPanel.createSlider(container, {
    label: 'Monitoring Sensitivity',
    min: 0.1, max: 0.95, step: 0.05, value: state.sensitivity,
    onChange: (v) => { state.sensitivity = v; }
  });
  
  document.getElementById('add-monitor').onclick = () => {
    state.patients.push(createPatient());
    updateViz();
  };
}

document.addEventListener('DOMContentLoaded', () => {
  initViz();
  initControls();
  d3.interval(updateViz, 500);
});
