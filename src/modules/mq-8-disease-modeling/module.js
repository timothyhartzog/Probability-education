/* ============================================================
   Module MQ-8 — Infectious Disease Modeling
   ============================================================
   Comprehensive interactive epidemiological simulation platform
   featuring compartmental models (SIR, SEIR, SIS, SEIRS, SIRD),
   agent-based modeling, network epidemics, and intervention
   strategy comparison.

   References:
   - Kermack & McKendrick (1927)
   - Anderson & May (1991)
   - Hethcote (2000) SIAM Review
   - Keeling & Rohani (2008)
   ============================================================ */

import * as d3 from 'd3';
import katex from 'katex';

/* ============================================================
   SECTION 0: Disease Presets & Constants
   ============================================================ */
const DISEASE_PRESETS = {
  custom:         { beta: 0.30, gamma: 0.10, sigma: 0.20, mu: 0.01,  xi: 0.005, label: 'Custom' },
  covid19:        { beta: 0.30, gamma: 0.10, sigma: 0.19, mu: 0.01,  xi: 0.003, label: 'COVID-19 (Original)',    r0Note: '2.5-3.0' },
  'covid-delta':  { beta: 0.60, gamma: 0.10, sigma: 0.22, mu: 0.015, xi: 0.003, label: 'COVID-19 (Delta)',       r0Note: '5-8' },
  'covid-omicron':{ beta: 1.00, gamma: 0.17, sigma: 0.29, mu: 0.003, xi: 0.005, label: 'COVID-19 (Omicron)',     r0Note: '8-15' },
  influenza:      { beta: 0.25, gamma: 0.17, sigma: 0.50, mu: 0.001, xi: 0.003, label: 'Seasonal Influenza',     r0Note: '1.3-1.8' },
  measles:        { beta: 1.80, gamma: 0.13, sigma: 0.08, mu: 0.002, xi: 0.0,   label: 'Measles',                r0Note: '12-18' },
  ebola:          { beta: 0.20, gamma: 0.10, sigma: 0.11, mu: 0.50,  xi: 0.0,   label: 'Ebola',                  r0Note: '1.5-2.5' },
  smallpox:       { beta: 0.42, gamma: 0.07, sigma: 0.08, mu: 0.30,  xi: 0.0,   label: 'Smallpox',               r0Note: '5-7' },
  sars:           { beta: 0.35, gamma: 0.08, sigma: 0.20, mu: 0.10,  xi: 0.0,   label: 'SARS (2003)',            r0Note: '2-5' },
  mers:           { beta: 0.06, gamma: 0.10, sigma: 0.18, mu: 0.35,  xi: 0.0,   label: 'MERS',                   r0Note: '0.3-0.8' },
  h1n1:           { beta: 0.24, gamma: 0.17, sigma: 0.50, mu: 0.0002,xi: 0.003, label: 'H1N1 (2009)',            r0Note: '1.4-1.6' },
};

const COLORS = {
  S: '#60a5fa',
  E: '#fbbf24',
  I: '#ef4444',
  R: '#34d399',
  D: '#6b7280',
  V: '#a78bfa',
};

/* ============================================================
   SECTION 1: Tab Navigation
   ============================================================ */
function initTabs() {
  const btns = document.querySelectorAll('.tab-btn');
  const tabs = document.querySelectorAll('.tab-content');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      tabs.forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });
}

/* ============================================================
   SECTION 2: ODE Solver (4th-order Runge-Kutta)
   ============================================================ */
function rk4(derivs, y0, tSpan, dt) {
  const steps = Math.ceil((tSpan[1] - tSpan[0]) / dt);
  const result = [{ t: tSpan[0], y: [...y0] }];
  let t = tSpan[0];
  let y = [...y0];

  for (let i = 0; i < steps; i++) {
    const k1 = derivs(t, y);
    const k2 = derivs(t + dt / 2, y.map((v, j) => v + (dt / 2) * k1[j]));
    const k3 = derivs(t + dt / 2, y.map((v, j) => v + (dt / 2) * k2[j]));
    const k4 = derivs(t + dt, y.map((v, j) => v + dt * k3[j]));

    y = y.map((v, j) => v + (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    // Clamp to non-negative
    y = y.map(v => Math.max(0, v));
    t += dt;
    result.push({ t, y: [...y] });
  }
  return result;
}

/* ============================================================
   SECTION 3: Compartmental Model Definitions
   ============================================================ */
function getDerivatives(model, params) {
  const { beta, gamma, sigma, mu, xi } = params;

  switch (model) {
    case 'SIR':
      // y = [S, I, R]
      return (t, y) => {
        const [S, I, R] = y;
        const N = S + I + R;
        const dS = -beta * S * I / N;
        const dI = beta * S * I / N - gamma * I;
        const dR = gamma * I;
        return [dS, dI, dR];
      };

    case 'SEIR':
      // y = [S, E, I, R]
      return (t, y) => {
        const [S, E, I, R] = y;
        const N = S + E + I + R;
        const dS = -beta * S * I / N;
        const dE = beta * S * I / N - sigma * E;
        const dI = sigma * E - gamma * I;
        const dR = gamma * I;
        return [dS, dE, dI, dR];
      };

    case 'SIS':
      // y = [S, I]
      return (t, y) => {
        const [S, I] = y;
        const N = S + I;
        const dS = -beta * S * I / N + gamma * I;
        const dI = beta * S * I / N - gamma * I;
        return [dS, dI];
      };

    case 'SEIRS':
      // y = [S, E, I, R]
      return (t, y) => {
        const [S, E, I, R] = y;
        const N = S + E + I + R;
        const dS = -beta * S * I / N + xi * R;
        const dE = beta * S * I / N - sigma * E;
        const dI = sigma * E - gamma * I;
        const dR = gamma * I - xi * R;
        return [dS, dE, dI, dR];
      };

    case 'SIRD':
      // y = [S, I, R, D]
      return (t, y) => {
        const [S, I, R, D] = y;
        const N = S + I + R; // D excluded from mixing
        if (N <= 0) return [0, 0, 0, 0];
        const dS = -beta * S * I / N;
        const dI = beta * S * I / N - gamma * I - mu * I;
        const dR = gamma * I;
        const dD = mu * I;
        return [dS, dI, dR, dD];
      };

    default:
      return getDerivatives('SIR', params);
  }
}

function getInitialConditions(model, N, I0) {
  switch (model) {
    case 'SIR':   return [N - I0, I0, 0];
    case 'SEIR':  return [N - I0, 0, I0, 0];
    case 'SIS':   return [N - I0, I0];
    case 'SEIRS': return [N - I0, 0, I0, 0];
    case 'SIRD':  return [N - I0, I0, 0, 0];
    default:      return [N - I0, I0, 0];
  }
}

function getCompartmentNames(model) {
  switch (model) {
    case 'SIR':   return ['S', 'I', 'R'];
    case 'SEIR':  return ['S', 'E', 'I', 'R'];
    case 'SIS':   return ['S', 'I'];
    case 'SEIRS': return ['S', 'E', 'I', 'R'];
    case 'SIRD':  return ['S', 'I', 'R', 'D'];
    default:      return ['S', 'I', 'R'];
  }
}

/* ============================================================
   SECTION 4: Compartmental Model State & UI
   ============================================================ */
const compState = {
  model: 'SIR',
  beta: 0.30,
  gamma: 0.10,
  sigma: 0.20,
  xi: 0.005,
  mu: 0.01,
  N: 10000,
  I0: 10,
  days: 300,
};

function readCompControls() {
  compState.model = document.getElementById('model-type').value;
  compState.beta = +document.getElementById('beta-slider').value;
  compState.gamma = +document.getElementById('gamma-slider').value;
  compState.sigma = +document.getElementById('sigma-slider').value;
  compState.xi = +document.getElementById('xi-slider').value;
  compState.mu = +document.getElementById('mu-slider').value;
  compState.N = +document.getElementById('pop-slider').value;
  compState.I0 = +document.getElementById('i0-slider').value;
  compState.days = +document.getElementById('days-slider').value;
}

function updateCompDisplays() {
  document.getElementById('beta-display').textContent = compState.beta.toFixed(2);
  document.getElementById('gamma-display').textContent = compState.gamma.toFixed(3);
  document.getElementById('sigma-display').textContent = compState.sigma.toFixed(2);
  document.getElementById('xi-display').textContent = compState.xi.toFixed(3);
  document.getElementById('mu-display').textContent = compState.mu.toFixed(3);
  document.getElementById('pop-display').textContent = compState.N.toLocaleString();
  document.getElementById('i0-display').textContent = compState.I0;
  document.getElementById('days-display').textContent = compState.days;
  document.getElementById('infectious-period').textContent = (1 / compState.gamma).toFixed(1);
  document.getElementById('incubation-period').textContent = (1 / compState.sigma).toFixed(1);
  document.getElementById('immunity-duration').textContent = Math.round(1 / compState.xi);
  document.getElementById('cfr-display').textContent = (compState.mu * 100 / (compState.mu + compState.gamma) * 100 / 100).toFixed(1);
}

function toggleParamVisibility() {
  const model = compState.model;
  document.querySelectorAll('.seir-param').forEach(el => {
    el.classList.toggle('visible', model === 'SEIR' || model === 'SEIRS');
  });
  document.querySelectorAll('.seirs-param').forEach(el => {
    el.classList.toggle('visible', model === 'SEIRS');
  });
  document.querySelectorAll('.sird-param').forEach(el => {
    el.classList.toggle('visible', model === 'SIRD');
  });
}

function applyPreset(presetKey) {
  const p = DISEASE_PRESETS[presetKey];
  if (!p) return;

  compState.beta = p.beta;
  compState.gamma = p.gamma;
  compState.sigma = p.sigma;
  compState.mu = p.mu;
  compState.xi = p.xi;

  document.getElementById('beta-slider').value = p.beta;
  document.getElementById('gamma-slider').value = p.gamma;
  document.getElementById('sigma-slider').value = p.sigma;
  document.getElementById('mu-slider').value = p.mu;
  document.getElementById('xi-slider').value = p.xi;
  updateCompDisplays();
}

/* ============================================================
   SECTION 5: KaTeX Equation Rendering
   ============================================================ */
function renderEquations() {
  const eqEl = document.getElementById('model-equations');
  if (!eqEl) return;

  const eqs = {
    SIR: String.raw`\frac{dS}{dt} = -\frac{\beta S I}{N}, \quad \frac{dI}{dt} = \frac{\beta S I}{N} - \gamma I, \quad \frac{dR}{dt} = \gamma I \qquad R_0 = \frac{\beta}{\gamma}`,
    SEIR: String.raw`\frac{dS}{dt} = -\frac{\beta S I}{N}, \quad \frac{dE}{dt} = \frac{\beta S I}{N} - \sigma E, \quad \frac{dI}{dt} = \sigma E - \gamma I, \quad \frac{dR}{dt} = \gamma I`,
    SIS: String.raw`\frac{dS}{dt} = -\frac{\beta S I}{N} + \gamma I, \quad \frac{dI}{dt} = \frac{\beta S I}{N} - \gamma I \qquad I^* = N\!\left(1 - \frac{1}{R_0}\right)`,
    SEIRS: String.raw`\frac{dS}{dt} = -\frac{\beta S I}{N} + \xi R, \quad \frac{dE}{dt} = \frac{\beta S I}{N} - \sigma E, \quad \frac{dI}{dt} = \sigma E - \gamma I, \quad \frac{dR}{dt} = \gamma I - \xi R`,
    SIRD: String.raw`\frac{dS}{dt} = -\frac{\beta S I}{N}, \quad \frac{dI}{dt} = \frac{\beta S I}{N} - \gamma I - \mu I, \quad \frac{dR}{dt} = \gamma I, \quad \frac{dD}{dt} = \mu I`,
  };

  try {
    katex.render(eqs[compState.model] || eqs.SIR, eqEl, { displayMode: true, throwOnError: false });
  } catch (_) {
    eqEl.textContent = eqs[compState.model] || '';
  }
}

function renderLiteratureEquations() {
  const ids = {
    'lit-sir-equations': String.raw`\frac{dS}{dt} = -\beta \frac{SI}{N}, \quad \frac{dI}{dt} = \beta \frac{SI}{N} - \gamma I, \quad \frac{dR}{dt} = \gamma I \qquad R_0 = \frac{\beta}{\gamma}`,
    'lit-threshold': String.raw`R_0 > 1 \implies \text{epidemic occurs} \qquad \text{Herd immunity threshold} = 1 - \frac{1}{R_0}`,
    'lit-seir-equations': String.raw`\frac{dS}{dt} = -\beta\frac{SI}{N},\quad \frac{dE}{dt} = \beta\frac{SI}{N} - \sigma E,\quad \frac{dI}{dt} = \sigma E - \gamma I,\quad \frac{dR}{dt} = \gamma I`,
    'lit-gillespie-equations': String.raw`\text{Rates: } \lambda_{\text{inf}} = \frac{\beta S I}{N}, \quad \lambda_{\text{rec}} = \gamma I \qquad \Delta t \sim \text{Exp}(\lambda_{\text{inf}} + \lambda_{\text{rec}}) \qquad P(\text{epidemic}) \approx 1 - \left(\frac{1}{R_0}\right)^{I_0}`,
  };

  for (const [id, eq] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) {
      try { katex.render(eq, el, { displayMode: true, throwOnError: false }); } catch (_) { /* ignore */ }
    }
  }
}

/* ============================================================
   SECTION 6: D3 Charting — Epidemic Curve
   ============================================================ */
const margin = { top: 30, right: 120, bottom: 45, left: 65 };

function drawEpidemicCurve(data, compartments, N) {
  const container = document.getElementById('epidemic-curve');
  if (!container) return;
  container.innerHTML = '';

  const width = container.clientWidth || 700;
  const height = 360;

  const svg = d3.select(container).append('svg')
    .attr('width', width).attr('height', height);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const x = d3.scaleLinear().domain([0, d3.max(data, d => d.t)]).range([0, w]);
  const y = d3.scaleLinear().domain([0, N * 1.05]).range([h, 0]);

  // Grid
  g.append('g').attr('class', 'grid')
    .call(d3.axisLeft(y).tickSize(-w).tickFormat('').ticks(6));

  // Axes
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(10))
    .append('text').attr('x', w / 2).attr('y', 38).attr('fill', '#555')
    .attr('text-anchor', 'middle').style('font-size', '0.8rem').text('Days');

  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(6).tickFormat(d3.format('.2s')))
    .append('text').attr('transform', 'rotate(-90)').attr('x', -h / 2).attr('y', -50)
    .attr('fill', '#555').attr('text-anchor', 'middle').style('font-size', '0.8rem').text('Population');

  // Lines
  compartments.forEach((comp, idx) => {
    const line = d3.line()
      .x(d => x(d.t))
      .y(d => y(d.y[idx]))
      .curve(d3.curveBasis);

    g.append('path')
      .datum(data)
      .attr('class', `epidemic-line line-${comp}`)
      .attr('d', line);
  });

  // Legend
  const legend = svg.append('g').attr('transform', `translate(${width - margin.right + 15}, ${margin.top})`);
  const compLabels = { S: 'Susceptible', E: 'Exposed', I: 'Infected', R: 'Recovered', D: 'Dead' };
  compartments.forEach((comp, i) => {
    const row = legend.append('g').attr('transform', `translate(0, ${i * 22})`);
    row.append('rect').attr('width', 14).attr('height', 3).attr('y', 5).attr('rx', 1.5)
      .attr('fill', COLORS[comp]);
    row.append('text').attr('x', 20).attr('y', 10).attr('class', 'chart-legend')
      .attr('fill', '#555').text(compLabels[comp] || comp);
  });

  // Tooltip overlay
  const tooltip = d3.select(container).append('div').attr('class', 'chart-tooltip').style('display', 'none');
  const bisect = d3.bisector(d => d.t).left;

  const overlay = g.append('rect').attr('width', w).attr('height', h).attr('fill', 'none').attr('pointer-events', 'all');
  const vLine = g.append('line').attr('class', 'tooltip-line').attr('y1', 0).attr('y2', h).style('display', 'none');

  overlay.on('mousemove', function(event) {
    const [mx] = d3.pointer(event, this);
    const t0 = x.invert(mx);
    const i = bisect(data, t0, 1);
    const d = data[Math.min(i, data.length - 1)];
    if (!d) return;

    vLine.attr('x1', x(d.t)).attr('x2', x(d.t)).style('display', null);

    let html = `<div class="tt-title">Day ${Math.round(d.t)}</div>`;
    compartments.forEach((comp, idx) => {
      html += `<div class="tt-row"><span><span class="tt-color" style="background:${COLORS[comp]}"></span>${compLabels[comp]}</span> <strong>${Math.round(d.y[idx]).toLocaleString()}</strong></div>`;
    });

    tooltip.html(html).style('display', 'block')
      .style('left', (x(d.t) + margin.left + 15) + 'px')
      .style('top', '40px');
  }).on('mouseleave', () => {
    vLine.style('display', 'none');
    tooltip.style('display', 'none');
  });
}

/* ============================================================
   SECTION 7: Phase Portrait
   ============================================================ */
function drawPhasePortrait(data, compartments) {
  const container = document.getElementById('phase-portrait');
  if (!container) return;
  container.innerHTML = '';

  const sIdx = 0;
  const iIdx = compartments.indexOf('I');
  if (iIdx < 0) return;

  const width = container.clientWidth || 500;
  const height = 300;

  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const x = d3.scaleLinear().domain([0, d3.max(data, d => d.y[sIdx]) * 1.05]).range([0, w]);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.y[iIdx]) * 1.1]).range([h, 0]);

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('.2s')))
    .append('text').attr('x', w / 2).attr('y', 38).attr('fill', '#555')
    .attr('text-anchor', 'middle').style('font-size', '0.8rem').text('Susceptible (S)');

  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(6).tickFormat(d3.format('.2s')))
    .append('text').attr('transform', 'rotate(-90)').attr('x', -h / 2).attr('y', -50)
    .attr('fill', '#555').attr('text-anchor', 'middle').style('font-size', '0.8rem').text('Infected (I)');

  const line = d3.line().x(d => x(d.y[sIdx])).y(d => y(d.y[iIdx])).curve(d3.curveBasis);
  g.append('path').datum(data).attr('class', 'phase-path').attr('d', line);

  // Start/end markers
  const start = data[0];
  const end = data[data.length - 1];
  g.append('circle').attr('cx', x(start.y[sIdx])).attr('cy', y(start.y[iIdx])).attr('r', 5).attr('fill', COLORS.S);
  g.append('circle').attr('cx', x(end.y[sIdx])).attr('cy', y(end.y[iIdx])).attr('r', 5).attr('fill', COLORS.R);
}

/* ============================================================
   SECTION 8: R_eff Chart
   ============================================================ */
function drawReffChart(data, compartments, N) {
  const container = document.getElementById('r-effective-chart');
  if (!container) return;
  container.innerHTML = '';

  const sIdx = 0;
  const r0 = compState.beta / compState.gamma;

  const reffData = data.map(d => ({
    t: d.t,
    reff: r0 * (d.y[sIdx] / N),
  }));

  const width = container.clientWidth || 700;
  const height = 200;
  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const x = d3.scaleLinear().domain([0, d3.max(reffData, d => d.t)]).range([0, w]);
  const yMax = Math.max(d3.max(reffData, d => d.reff), 1.5);
  const y = d3.scaleLinear().domain([0, yMax]).range([h, 0]);

  g.append('g').attr('class', 'grid').call(d3.axisLeft(y).tickSize(-w).tickFormat('').ticks(4));
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).ticks(10));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(4));

  // R_eff = 1 threshold line
  if (y(1) >= 0 && y(1) <= h) {
    g.append('line').attr('class', 'reff-threshold')
      .attr('x1', 0).attr('x2', w).attr('y1', y(1)).attr('y2', y(1));
    g.append('text').attr('x', w - 4).attr('y', y(1) - 6)
      .attr('text-anchor', 'end').attr('fill', '#dc2626')
      .style('font-size', '0.72rem').style('font-family', 'var(--font-heading)')
      .text('R_eff = 1 (epidemic threshold)');
  }

  const line = d3.line().x(d => x(d.t)).y(d => y(d.reff)).curve(d3.curveBasis);
  g.append('path').datum(reffData).attr('class', 'reff-line').attr('d', line);
}

/* ============================================================
   SECTION 9: Metrics Update
   ============================================================ */
function updateMetrics(data, compartments, N) {
  const iIdx = compartments.indexOf('I');
  const r0 = compState.beta / compState.gamma;
  const herd = Math.max(0, (1 - 1 / r0) * 100);

  document.getElementById('metric-r0').textContent = r0.toFixed(2);
  document.getElementById('metric-herd').textContent = herd.toFixed(1) + '%';

  let peakI = 0, peakDay = 0;
  data.forEach(d => {
    if (d.y[iIdx] > peakI) { peakI = d.y[iIdx]; peakDay = d.t; }
  });

  document.getElementById('metric-peak').textContent = Math.round(peakI).toLocaleString();
  document.getElementById('metric-peak-day').textContent = Math.round(peakDay);

  // Total infected (R + D at end, or peak for SIS)
  const last = data[data.length - 1];
  const rIdx = compartments.indexOf('R');
  const dIdx = compartments.indexOf('D');
  let totalInf = 0;
  if (rIdx >= 0) totalInf += last.y[rIdx];
  if (dIdx >= 0) totalInf += last.y[dIdx];
  if (compState.model === 'SIS') totalInf = peakI;
  document.getElementById('metric-total').textContent = Math.round(totalInf).toLocaleString();

  // Deaths
  const deaths = dIdx >= 0 ? Math.round(last.y[dIdx]) : '—';
  document.getElementById('metric-deaths').textContent = typeof deaths === 'number' ? deaths.toLocaleString() : deaths;
}

/* ============================================================
   SECTION 10: Run Compartmental Simulation
   ============================================================ */
function runCompartmental() {
  readCompControls();
  toggleParamVisibility();
  renderEquations();
  updateCompDisplays();

  const { model, beta, gamma, sigma, xi, mu, N, I0, days } = compState;
  const derivs = getDerivatives(model, { beta, gamma, sigma, xi, mu });
  const y0 = getInitialConditions(model, N, I0);
  const compartments = getCompartmentNames(model);

  const dt = 0.1;
  const raw = rk4(derivs, y0, [0, days], dt);
  // Downsample for rendering
  const step = Math.max(1, Math.floor(raw.length / 2000));
  const data = raw.filter((_, i) => i % step === 0);

  drawEpidemicCurve(data, compartments, N);
  drawPhasePortrait(data, compartments);
  drawReffChart(data, compartments, N);
  updateMetrics(data, compartments, N);
}

/* ============================================================
   SECTION 11: Agent-Based Model
   ============================================================ */
const ABM_STATES = { S: 0, E: 1, I: 2, R: 3, D: 4, V: 5 };
const ABM_COLORS_HEX = ['#60a5fa', '#fbbf24', '#ef4444', '#34d399', '#6b7280', '#a78bfa'];

let abmAgents = [];
let abmRunning = false;
let abmFrameId = null;
let abmTimeSeries = [];
let abmTick = 0;

function createAgents() {
  const canvas = document.getElementById('abm-canvas');
  const W = canvas.width;
  const H = canvas.height;
  const n = +document.getElementById('abm-n-slider').value;
  const vaccineRate = +document.getElementById('abm-vaccine-slider').value / 100;
  const distancingRate = +document.getElementById('abm-distancing-slider').value / 100;
  const isSuperSpreader = document.getElementById('abm-superspreader-toggle').checked;

  abmAgents = [];
  for (let i = 0; i < n; i++) {
    const isStationary = Math.random() < distancingRate;
    const speed = isStationary ? 0 : +document.getElementById('abm-speed-slider').value;
    const angle = Math.random() * Math.PI * 2;
    const superSpreader = isSuperSpreader && Math.random() < 0.05;

    abmAgents.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      state: ABM_STATES.S,
      timer: 0,
      superSpreader,
    });
  }

  // Vaccinate
  const vaccineCount = Math.floor(n * vaccineRate);
  const indices = d3.shuffle(d3.range(n));
  for (let i = 0; i < vaccineCount; i++) {
    abmAgents[indices[i]].state = ABM_STATES.V;
  }

  // Infect patient zero(s)
  let infected = 0;
  for (let i = 0; i < n && infected < 3; i++) {
    if (abmAgents[i].state === ABM_STATES.S) {
      abmAgents[i].state = ABM_STATES.I;
      abmAgents[i].timer = 0;
      infected++;
    }
  }

  abmTick = 0;
  abmTimeSeries = [];
}

function stepABM() {
  const canvas = document.getElementById('abm-canvas');
  const W = canvas.width;
  const H = canvas.height;
  const radius = +document.getElementById('abm-radius-slider').value;
  const tranProb = +document.getElementById('abm-trans-slider').value;
  const recoveryTime = +document.getElementById('abm-recovery-slider').value;
  const incubationTime = +document.getElementById('abm-incubation-slider').value;
  const mortalityRate = +document.getElementById('abm-mortality-slider').value;
  const quarantine = document.getElementById('abm-quarantine-toggle').checked;

  const n = abmAgents.length;

  // Move agents
  for (let i = 0; i < n; i++) {
    const a = abmAgents[i];
    if (a.state === ABM_STATES.D) continue;
    if (quarantine && a.state === ABM_STATES.I && a.timer > incubationTime * 0.5) {
      continue; // quarantined
    }

    a.x += a.vx;
    a.y += a.vy;

    // Bounce off walls
    if (a.x < 0 || a.x > W) { a.vx *= -1; a.x = Math.max(0, Math.min(W, a.x)); }
    if (a.y < 0 || a.y > H) { a.vy *= -1; a.y = Math.max(0, Math.min(H, a.y)); }

    // Random direction change
    if (Math.random() < 0.02) {
      const speed = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
      const angle = Math.random() * Math.PI * 2;
      a.vx = Math.cos(angle) * speed;
      a.vy = Math.sin(angle) * speed;
    }
  }

  // Transmission (spatial grid for performance)
  const cellSize = radius * 2;
  const cols = Math.ceil(W / cellSize);
  const grid = new Map();

  for (let i = 0; i < n; i++) {
    const a = abmAgents[i];
    const cx = Math.floor(a.x / cellSize);
    const cy = Math.floor(a.y / cellSize);
    const key = cx + ',' + cy;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(i);
  }

  for (let i = 0; i < n; i++) {
    const a = abmAgents[i];
    if (a.state !== ABM_STATES.I) continue;

    const effectiveRadius = a.superSpreader ? radius * 3 : radius;
    const cx = Math.floor(a.x / cellSize);
    const cy = Math.floor(a.y / cellSize);
    const searchRadius = Math.ceil(effectiveRadius / cellSize);

    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        const key = (cx + dx) + ',' + (cy + dy);
        const cell = grid.get(key);
        if (!cell) continue;

        for (const j of cell) {
          if (i === j) continue;
          const b = abmAgents[j];
          if (b.state !== ABM_STATES.S) continue;

          const dist = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
          if (dist < effectiveRadius && Math.random() < tranProb) {
            b.state = incubationTime > 0 ? ABM_STATES.E : ABM_STATES.I;
            b.timer = 0;
          }
        }
      }
    }
  }

  // State transitions
  for (let i = 0; i < n; i++) {
    const a = abmAgents[i];
    if (a.state === ABM_STATES.E) {
      a.timer++;
      if (a.timer >= incubationTime) {
        a.state = ABM_STATES.I;
        a.timer = 0;
      }
    } else if (a.state === ABM_STATES.I) {
      a.timer++;
      if (a.timer >= recoveryTime) {
        a.state = Math.random() < mortalityRate ? ABM_STATES.D : ABM_STATES.R;
      }
    }
  }

  abmTick++;

  // Record time series
  const counts = [0, 0, 0, 0, 0, 0];
  for (const a of abmAgents) counts[a.state]++;
  abmTimeSeries.push({ t: abmTick, S: counts[0], E: counts[1], I: counts[2], R: counts[3], D: counts[4], V: counts[5] });

  return counts;
}

function renderABM() {
  const canvas = document.getElementById('abm-canvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, H);

  for (const a of abmAgents) {
    ctx.beginPath();
    const r = a.superSpreader ? 4 : 2.5;
    ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
    ctx.fillStyle = ABM_COLORS_HEX[a.state];
    ctx.fill();

    if (a.superSpreader && a.state === ABM_STATES.I) {
      ctx.beginPath();
      ctx.arc(a.x, a.y, +document.getElementById('abm-radius-slider').value * 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function drawABMCurve() {
  const container = document.getElementById('abm-curve');
  if (!container) return;
  container.innerHTML = '';

  const data = abmTimeSeries;
  if (data.length < 2) return;

  const n = abmAgents.length;
  const width = container.clientWidth || 700;
  const height = 250;

  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const x = d3.scaleLinear().domain([0, d3.max(data, d => d.t)]).range([0, w]);
  const y = d3.scaleLinear().domain([0, n]).range([h, 0]);

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).ticks(8));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(5));

  const keys = ['S', 'E', 'I', 'R', 'D'];
  keys.forEach(key => {
    const line = d3.line().x(d => x(d.t)).y(d => y(d[key])).curve(d3.curveBasis);
    g.append('path').datum(data).attr('class', `epidemic-line line-${key}`).attr('d', line);
  });
}

function updateABMMetrics(counts) {
  document.getElementById('abm-day').textContent = abmTick;
  document.getElementById('abm-susceptible').textContent = counts[0];
  document.getElementById('abm-infected').textContent = counts[2];
  document.getElementById('abm-recovered').textContent = counts[3];
  document.getElementById('abm-dead').textContent = counts[4];

  // Crude R_eff estimate
  if (abmTimeSeries.length > 10) {
    const recent = abmTimeSeries.slice(-10);
    const avgNew = (recent[recent.length - 1].I - recent[0].I + recent[recent.length - 1].R - recent[0].R + recent[recent.length - 1].D - recent[0].D) / 10;
    const avgI = d3.mean(recent, d => d.I);
    const reff = avgI > 0 ? (avgNew / avgI * (+document.getElementById('abm-recovery-slider').value)).toFixed(2) : '—';
    document.getElementById('abm-reff').textContent = reff;
  }
}

function abmLoop() {
  if (!abmRunning) return;
  const counts = stepABM();
  renderABM();
  updateABMMetrics(counts);

  // Update curve every 20 ticks
  if (abmTick % 20 === 0) drawABMCurve();

  // Stop if no more active infection
  if (counts[1] + counts[2] === 0 && abmTick > 10) {
    abmRunning = false;
    drawABMCurve();
    return;
  }

  abmFrameId = requestAnimationFrame(abmLoop);
}

/* ============================================================
   SECTION 12: Intervention Comparison
   ============================================================ */
function runInterventionComparison() {
  const diseaseKey = document.getElementById('intervention-disease').value;
  const preset = DISEASE_PRESETS[diseaseKey] || DISEASE_PRESETS.covid19;
  const vaccineCov = +document.getElementById('iv-vaccine-slider').value / 100;
  const vaccineEff = +document.getElementById('iv-efficacy-slider').value / 100;
  const contactReduction = +document.getElementById('iv-contact-slider').value / 100;
  const distStart = +document.getElementById('iv-start-slider').value;
  const distDuration = +document.getElementById('iv-duration-slider').value;
  const hospitalCapacity = +document.getElementById('iv-capacity-slider').value / 100;
  const N = 100000;
  const I0 = 10;
  const days = 365;
  const dt = 0.2;

  // Baseline scenario
  const baseDerivs = getDerivatives('SEIR', preset);
  const baseData = rk4(baseDerivs, getInitialConditions('SEIR', N, I0), [0, days], dt);

  // Vaccination scenario
  const vaccN = N * (1 - vaccineCov * vaccineEff);
  const vaccDerivs = getDerivatives('SEIR', preset);
  const vaccData = rk4(vaccDerivs, getInitialConditions('SEIR', vaccN, I0), [0, days], dt);

  // Social distancing scenario (time-varying beta)
  function distancingDerivs(t, y) {
    const [S, E, I, R] = y;
    const Nt = S + E + I + R;
    const effectiveBeta = (t >= distStart && t < distStart + distDuration)
      ? preset.beta * (1 - contactReduction)
      : preset.beta;
    const dS = -effectiveBeta * S * I / Nt;
    const dE = effectiveBeta * S * I / Nt - preset.sigma * E;
    const dI = preset.sigma * E - preset.gamma * I;
    const dR = preset.gamma * I;
    return [dS, dE, dI, dR];
  }
  const distData = rk4(distancingDerivs, getInitialConditions('SEIR', N, I0), [0, days], dt);

  // Combined scenario
  function combinedDerivs(t, y) {
    const [S, E, I, R] = y;
    const Nt = S + E + I + R;
    const effectiveBeta = (t >= distStart && t < distStart + distDuration)
      ? preset.beta * (1 - contactReduction)
      : preset.beta;
    const dS = -effectiveBeta * S * I / Nt;
    const dE = effectiveBeta * S * I / Nt - preset.sigma * E;
    const dI = preset.sigma * E - preset.gamma * I;
    const dR = preset.gamma * I;
    return [dS, dE, dI, dR];
  }
  const combData = rk4(combinedDerivs, getInitialConditions('SEIR', vaccN, I0), [0, days], dt);

  // Downsample
  const step = Math.max(1, Math.floor(baseData.length / 1500));
  const ds = arr => arr.filter((_, i) => i % step === 0);

  drawInterventionCurves(ds(baseData), ds(vaccData), ds(distData), ds(combData), N, hospitalCapacity);
  drawOutcomeBar(baseData, vaccData, distData, combData, N);
  drawFlattenCurve(ds(baseData), ds(distData), N, hospitalCapacity);
}

function drawInterventionCurves(base, vacc, dist, comb, N, cap) {
  const container = document.getElementById('intervention-curve');
  if (!container) return;
  container.innerHTML = '';

  const iIdx = 2; // I is index 2 in SEIR
  const width = container.clientWidth || 700;
  const height = 360;

  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const allData = [...base, ...vacc, ...dist, ...comb];
  const x = d3.scaleLinear().domain([0, d3.max(allData, d => d.t)]).range([0, w]);
  const yMax = d3.max(allData, d => d.y[iIdx]) * 1.1;
  const y = d3.scaleLinear().domain([0, yMax]).range([h, 0]);

  g.append('g').attr('class', 'grid').call(d3.axisLeft(y).tickSize(-w).tickFormat('').ticks(6));
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).ticks(10))
    .append('text').attr('x', w / 2).attr('y', 38).attr('fill', '#555').attr('text-anchor', 'middle').style('font-size', '0.8rem').text('Days');
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(6).tickFormat(d3.format('.2s')));

  // Hospital capacity line
  const capY = N * cap;
  if (capY < yMax) {
    g.append('line').attr('class', 'capacity-line').attr('x1', 0).attr('x2', w).attr('y1', y(capY)).attr('y2', y(capY));
    g.append('text').attr('class', 'capacity-label').attr('x', w - 4).attr('y', y(capY) - 6).attr('text-anchor', 'end').text('Hospital Capacity');
  }

  const scenarios = [
    { data: base, cls: 'scenario-baseline', label: 'No Intervention' },
    { data: vacc, cls: 'scenario-vaccine', label: 'Vaccination Only' },
    { data: dist, cls: 'scenario-distancing', label: 'Distancing Only' },
    { data: comb, cls: 'scenario-combined', label: 'Combined' },
  ];

  scenarios.forEach(s => {
    const line = d3.line().x(d => x(d.t)).y(d => y(d.y[iIdx])).curve(d3.curveBasis);
    g.append('path').datum(s.data).attr('class', `intervention-line ${s.cls}`).attr('d', line);
  });

  // Legend
  const legend = svg.append('g').attr('transform', `translate(${width - margin.right + 15}, ${margin.top})`);
  const legendColors = ['#ef4444', '#a78bfa', '#60a5fa', '#34d399'];
  scenarios.forEach((s, i) => {
    const row = legend.append('g').attr('transform', `translate(0, ${i * 22})`);
    row.append('rect').attr('width', 14).attr('height', 3).attr('y', 5).attr('rx', 1.5).attr('fill', legendColors[i]);
    row.append('text').attr('x', 20).attr('y', 10).attr('class', 'chart-legend').attr('fill', '#555').text(s.label);
  });
}

function drawOutcomeBar(base, vacc, dist, comb, N) {
  const container = document.getElementById('intervention-bar');
  if (!container) return;
  container.innerHTML = '';

  const iIdx = 2;
  const rIdx = 3;

  function getOutcomes(data) {
    const last = data[data.length - 1];
    const peakI = d3.max(data, d => d.y[iIdx]);
    const totalInf = last.y[rIdx];
    return { peakI, totalInf };
  }

  const scenarios = [
    { label: 'No Intervention', ...getOutcomes(base), color: '#ef4444' },
    { label: 'Vaccination', ...getOutcomes(vacc), color: '#a78bfa' },
    { label: 'Distancing', ...getOutcomes(dist), color: '#60a5fa' },
    { label: 'Combined', ...getOutcomes(comb), color: '#34d399' },
  ];

  const width = container.clientWidth || 700;
  const height = 260;
  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${margin.left + 20},${margin.top})`);
  const w = width - margin.left - margin.right - 20;
  const h = height - margin.top - margin.bottom;

  const x0 = d3.scaleBand().domain(scenarios.map(s => s.label)).range([0, w]).padding(0.3);
  const x1 = d3.scaleBand().domain(['peakI', 'totalInf']).range([0, x0.bandwidth()]).padding(0.1);
  const yMax = d3.max(scenarios, s => Math.max(s.peakI, s.totalInf));
  const y = d3.scaleLinear().domain([0, yMax]).range([h, 0]);

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x0));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.2s')));

  scenarios.forEach(s => {
    const sg = g.append('g').attr('transform', `translate(${x0(s.label)},0)`);

    sg.append('rect').attr('x', x1('peakI')).attr('y', y(s.peakI)).attr('width', x1.bandwidth())
      .attr('height', h - y(s.peakI)).attr('fill', s.color).attr('opacity', 0.7);

    sg.append('rect').attr('x', x1('totalInf')).attr('y', y(s.totalInf)).attr('width', x1.bandwidth())
      .attr('height', h - y(s.totalInf)).attr('fill', s.color).attr('opacity', 1);
  });

  // Bar legend
  const bl = svg.append('g').attr('transform', `translate(${width - margin.right + 10}, ${margin.top})`);
  bl.append('rect').attr('width', 12).attr('height', 12).attr('fill', '#999').attr('opacity', 0.7);
  bl.append('text').attr('x', 18).attr('y', 10).style('font-size', '0.72rem').attr('fill', '#555').text('Peak Infected');
  bl.append('rect').attr('y', 20).attr('width', 12).attr('height', 12).attr('fill', '#999');
  bl.append('text').attr('x', 18).attr('y', 30).style('font-size', '0.72rem').attr('fill', '#555').text('Total Infected');
}

function drawFlattenCurve(base, dist, N, cap) {
  const container = document.getElementById('flatten-curve');
  if (!container) return;
  container.innerHTML = '';

  const iIdx = 2;
  const width = container.clientWidth || 700;
  const height = 300;
  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const allPts = [...base, ...dist];
  const x = d3.scaleLinear().domain([0, d3.max(allPts, d => d.t)]).range([0, w]);
  const yMax = d3.max(allPts, d => d.y[iIdx]) * 1.1;
  const y = d3.scaleLinear().domain([0, yMax]).range([h, 0]);

  g.append('g').attr('class', 'grid').call(d3.axisLeft(y).tickSize(-w).tickFormat('').ticks(6));
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).ticks(10));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(6).tickFormat(d3.format('.2s')));

  // Capacity area
  const capY = N * cap;
  if (capY < yMax) {
    g.append('rect').attr('class', 'capacity-area').attr('x', 0).attr('y', 0).attr('width', w).attr('height', y(capY));
    g.append('line').attr('class', 'capacity-line').attr('x1', 0).attr('x2', w).attr('y1', y(capY)).attr('y2', y(capY));
    g.append('text').attr('class', 'capacity-label').attr('x', 8).attr('y', y(capY) + 14).text('Hospital Capacity');
  }

  // Baseline area (filled)
  const area = d3.area().x(d => x(d.t)).y0(h).y1(d => y(d.y[iIdx])).curve(d3.curveBasis);
  g.append('path').datum(base).attr('d', area).attr('fill', '#ef4444').attr('opacity', 0.15);
  g.append('path').datum(dist).attr('d', area).attr('fill', '#60a5fa').attr('opacity', 0.15);

  // Lines
  const line = d3.line().x(d => x(d.t)).y(d => y(d.y[iIdx])).curve(d3.curveBasis);
  g.append('path').datum(base).attr('d', line).attr('fill', 'none').attr('stroke', '#ef4444').attr('stroke-width', 2.5);
  g.append('path').datum(dist).attr('d', line).attr('fill', 'none').attr('stroke', '#60a5fa').attr('stroke-width', 2.5);

  // Annotations
  const basePeak = d3.max(base, d => d.y[iIdx]);
  const distPeak = d3.max(dist, d => d.y[iIdx]);
  const basePeakT = base.find(d => d.y[iIdx] === basePeak)?.t || 0;
  const distPeakT = dist.find(d => d.y[iIdx] === distPeak)?.t || 0;

  g.append('text').attr('x', x(basePeakT)).attr('y', y(basePeak) - 10)
    .attr('text-anchor', 'middle').style('font-size', '0.75rem').attr('fill', '#ef4444')
    .style('font-family', 'var(--font-heading)').style('font-weight', '600').text('Without Interventions');

  g.append('text').attr('x', x(distPeakT)).attr('y', y(distPeak) - 10)
    .attr('text-anchor', 'middle').style('font-size', '0.75rem').attr('fill', '#60a5fa')
    .style('font-family', 'var(--font-heading)').style('font-weight', '600').text('With Social Distancing');
}

/* ============================================================
   SECTION 13: Network Epidemic Model
   ============================================================ */
let netNodes = [];
let netLinks = [];
let netSimulation = null;
let netRunning = false;
let netTimeSeries = [];
let netStep = 0;
let netAnimId = null;

function generateNetwork() {
  const type = document.getElementById('network-type').value;
  const nNodes = +document.getElementById('net-nodes-slider').value;
  const avgK = +document.getElementById('net-edges-slider').value;
  const rewire = +document.getElementById('net-rewire-slider').value;

  netNodes = d3.range(nNodes).map(i => ({ id: i, state: 'S' }));
  netLinks = [];

  switch (type) {
    case 'random': {
      const p = avgK / (nNodes - 1);
      for (let i = 0; i < nNodes; i++) {
        for (let j = i + 1; j < nNodes; j++) {
          if (Math.random() < p) netLinks.push({ source: i, target: j });
        }
      }
      break;
    }

    case 'small-world': {
      const k = Math.floor(avgK / 2);
      for (let i = 0; i < nNodes; i++) {
        for (let j = 1; j <= k; j++) {
          netLinks.push({ source: i, target: (i + j) % nNodes });
        }
      }
      // Rewire
      for (let i = netLinks.length - 1; i >= 0; i--) {
        if (Math.random() < rewire) {
          const newTarget = Math.floor(Math.random() * nNodes);
          if (newTarget !== netLinks[i].source) {
            netLinks[i].target = newTarget;
          }
        }
      }
      break;
    }

    case 'scale-free': {
      // Barabasi-Albert
      const m = Math.max(1, Math.floor(avgK / 2));
      const degree = new Array(nNodes).fill(0);
      // Start with complete graph of m+1 nodes
      for (let i = 0; i <= m && i < nNodes; i++) {
        for (let j = i + 1; j <= m && j < nNodes; j++) {
          netLinks.push({ source: i, target: j });
          degree[i]++;
          degree[j]++;
        }
      }
      // Add remaining nodes with preferential attachment
      for (let i = m + 1; i < nNodes; i++) {
        const targets = new Set();
        const totalDeg = degree.reduce((a, b) => a + b, 0) || 1;
        while (targets.size < m) {
          let r = Math.random() * totalDeg;
          for (let j = 0; j < i; j++) {
            r -= (degree[j] || 0) + 1;
            if (r <= 0) { targets.add(j); break; }
          }
        }
        for (const t of targets) {
          netLinks.push({ source: i, target: t });
          degree[i]++;
          degree[t]++;
        }
      }
      break;
    }

    case 'lattice': {
      const side = Math.ceil(Math.sqrt(nNodes));
      for (let i = 0; i < nNodes; i++) {
        const row = Math.floor(i / side);
        const col = i % side;
        if (col < side - 1 && i + 1 < nNodes) netLinks.push({ source: i, target: i + 1 });
        if (row < side - 1 && i + side < nNodes) netLinks.push({ source: i, target: i + side });
      }
      break;
    }
  }

  // Vaccinate
  const vaccRate = +document.getElementById('net-vaccine-slider').value / 100;
  const targeted = document.getElementById('net-targeted-toggle').checked;

  if (vaccRate > 0) {
    const vaccCount = Math.floor(nNodes * vaccRate);
    let order;
    if (targeted) {
      // Sort by degree (highest first)
      const deg = new Array(nNodes).fill(0);
      for (const l of netLinks) {
        deg[typeof l.source === 'object' ? l.source.id : l.source]++;
        deg[typeof l.target === 'object' ? l.target.id : l.target]++;
      }
      order = d3.range(nNodes).sort((a, b) => deg[b] - deg[a]);
    } else {
      order = d3.shuffle(d3.range(nNodes));
    }
    for (let i = 0; i < vaccCount; i++) {
      netNodes[order[i]].state = 'V';
    }
  }

  // Patient zero
  const susceptible = netNodes.filter(n => n.state === 'S');
  if (susceptible.length > 0) {
    susceptible[Math.floor(Math.random() * susceptible.length)].state = 'I';
  }

  netStep = 0;
  netTimeSeries = [];
  recordNetCounts();
}

function recordNetCounts() {
  const counts = { S: 0, E: 0, I: 0, R: 0, V: 0 };
  for (const n of netNodes) counts[n.state] = (counts[n.state] || 0) + 1;
  netTimeSeries.push({ t: netStep, ...counts });
  return counts;
}

function stepNetwork() {
  const tranProb = +document.getElementById('net-trans-slider').value;
  const recProb = +document.getElementById('net-recovery-slider').value;

  // Build adjacency
  const adj = new Map();
  for (const n of netNodes) adj.set(n.id, []);
  for (const l of netLinks) {
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    adj.get(s).push(t);
    adj.get(t).push(s);
  }

  // Transmission
  const toInfect = [];
  for (const node of netNodes) {
    if (node.state !== 'I') continue;
    for (const nbr of adj.get(node.id)) {
      if (netNodes[nbr].state === 'S' && Math.random() < tranProb) {
        toInfect.push(nbr);
      }
    }
  }
  for (const i of toInfect) netNodes[i].state = 'I';

  // Recovery
  for (const node of netNodes) {
    if (node.state === 'I' && Math.random() < recProb) {
      node.state = 'R';
    }
  }

  netStep++;
  return recordNetCounts();
}

function drawNetworkGraph() {
  const container = document.getElementById('network-graph');
  if (!container) return;
  container.innerHTML = '';

  const width = container.clientWidth || 700;
  const height = 450;

  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);

  const stateColor = { S: '#60a5fa', E: '#fbbf24', I: '#ef4444', R: '#34d399', V: '#a78bfa' };

  // Compute degree for sizing
  const deg = new Map();
  netNodes.forEach(n => deg.set(n.id, 0));
  netLinks.forEach(l => {
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    deg.set(s, (deg.get(s) || 0) + 1);
    deg.set(t, (deg.get(t) || 0) + 1);
  });
  const maxDeg = Math.max(1, d3.max([...deg.values()]));

  if (netSimulation) netSimulation.stop();

  netSimulation = d3.forceSimulation(netNodes)
    .force('link', d3.forceLink(netLinks).id(d => d.id).distance(30))
    .force('charge', d3.forceManyBody().strength(-40))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide(8));

  const link = svg.append('g').selectAll('line')
    .data(netLinks).enter().append('line').attr('class', 'network-link');

  const node = svg.append('g').selectAll('circle')
    .data(netNodes).enter().append('circle')
    .attr('class', d => `network-node node-${d.state.toLowerCase()}`)
    .attr('r', d => 3 + (deg.get(d.id) / maxDeg) * 8);

  // Drag behavior
  node.call(d3.drag()
    .on('start', (event, d) => { if (!event.active) netSimulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
    .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
    .on('end', (event, d) => { if (!event.active) netSimulation.alphaTarget(0); d.fx = null; d.fy = null; })
  );

  netSimulation.on('tick', () => {
    link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    node.attr('cx', d => d.x).attr('cy', d => d.y);
  });

  // Store references for update
  container._nodeSelection = node;
  container._stateColor = stateColor;
}

function updateNetworkColors() {
  const container = document.getElementById('network-graph');
  if (!container || !container._nodeSelection) return;
  const stateColor = container._stateColor;
  container._nodeSelection.attr('fill', d => stateColor[d.state] || '#999');
}

function drawNetworkCurve() {
  const container = document.getElementById('network-curve');
  if (!container) return;
  container.innerHTML = '';

  const data = netTimeSeries;
  if (data.length < 2) return;

  const n = netNodes.length;
  const width = container.clientWidth || 700;
  const height = 250;

  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const x = d3.scaleLinear().domain([0, d3.max(data, d => d.t) || 1]).range([0, w]);
  const y = d3.scaleLinear().domain([0, n]).range([h, 0]);

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).ticks(8));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(5));

  ['S', 'I', 'R', 'V'].forEach(key => {
    const color = COLORS[key];
    const line = d3.line().x(d => x(d.t)).y(d => y(d[key] || 0)).curve(d3.curveBasis);
    g.append('path').datum(data).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2).attr('d', line);
  });
}

function drawDegreeDistribution() {
  const container = document.getElementById('degree-distribution');
  if (!container) return;
  container.innerHTML = '';

  const deg = new Map();
  netNodes.forEach(n => deg.set(n.id, 0));
  netLinks.forEach(l => {
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    deg.set(s, (deg.get(s) || 0) + 1);
    deg.set(t, (deg.get(t) || 0) + 1);
  });

  const degValues = [...deg.values()];
  const maxD = d3.max(degValues) || 1;
  const bins = d3.range(0, maxD + 2).map(d => ({ degree: d, count: degValues.filter(v => v === d).length }));

  const width = container.clientWidth || 700;
  const height = 200;

  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const x = d3.scaleBand().domain(bins.map(b => b.degree)).range([0, w]).padding(0.2);
  const y = d3.scaleLinear().domain([0, d3.max(bins, b => b.count)]).range([h, 0]);

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).tickValues(x.domain().filter((_, i) => i % Math.max(1, Math.floor(bins.length / 15)) === 0)));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(4));

  g.selectAll('.bar').data(bins).enter().append('rect')
    .attr('x', d => x(d.degree)).attr('y', d => y(d.count))
    .attr('width', x.bandwidth()).attr('height', d => h - y(d.count))
    .attr('fill', COLORS.S).attr('opacity', 0.7).attr('rx', 2);
}

/* ============================================================
   SECTION 14: Stochastic Simulation (Gillespie Algorithm)
   ============================================================ */

/**
 * Gillespie SSA for SIR model.
 * Events: infection (S->I at rate beta*S*I/N), recovery (I->R at rate gamma*I)
 * Returns array of { t, S, I, R } snapshots.
 */
function gillespieSIR(beta, gamma, N, I0, maxTime) {
  let S = N - I0, I = I0, R = 0;
  let t = 0;
  const trajectory = [{ t, S, I, R }];

  while (I > 0 && t < maxTime) {
    const rateInfect = beta * S * I / N;
    const rateRecover = gamma * I;
    const totalRate = rateInfect + rateRecover;

    if (totalRate <= 0) break;

    // Time to next event (exponential)
    const dt = -Math.log(Math.random()) / totalRate;
    t += dt;
    if (t > maxTime) break;

    // Which event?
    if (Math.random() < rateInfect / totalRate) {
      S--; I++;
    } else {
      I--; R++;
    }

    trajectory.push({ t, S, I, R });
  }

  return trajectory;
}

/**
 * Run Monte Carlo stochastic simulations and render results.
 */
function runStochasticSimulation() {
  const diseaseKey = document.getElementById('stoch-disease').value;
  const preset = DISEASE_PRESETS[diseaseKey];
  const beta = preset && diseaseKey !== 'custom'
    ? preset.beta : +document.getElementById('stoch-beta-slider').value;
  const gamma = preset && diseaseKey !== 'custom'
    ? preset.gamma : +document.getElementById('stoch-gamma-slider').value;
  const N = +document.getElementById('stoch-pop-slider').value;
  const I0 = +document.getElementById('stoch-i0-slider').value;
  const nRuns = +document.getElementById('stoch-runs-slider').value;
  const nShow = +document.getElementById('stoch-show-slider').value;
  const r0 = beta / gamma;
  const maxTime = Math.max(200, Math.round(300 / Math.max(0.1, gamma)));

  // Update sliders if preset selected
  if (preset && diseaseKey !== 'custom') {
    document.getElementById('stoch-beta-slider').value = beta;
    document.getElementById('stoch-gamma-slider').value = gamma;
    document.getElementById('stoch-beta-display').textContent = beta.toFixed(2);
    document.getElementById('stoch-gamma-display').textContent = gamma.toFixed(3);
  }

  // Run simulations
  const allRuns = [];
  const finalSizes = [];
  let epidemicCount = 0;
  const epidemicThreshold = N * 0.05; // >5% infected = major epidemic

  for (let i = 0; i < nRuns; i++) {
    const traj = gillespieSIR(beta, gamma, N, I0, maxTime);
    allRuns.push(traj);
    const finalR = traj[traj.length - 1].R;
    finalSizes.push(finalR);
    if (finalR > epidemicThreshold) epidemicCount++;
  }

  // Deterministic solution for comparison
  const detDerivs = getDerivatives('SIR', { beta, gamma, sigma: 0.2, mu: 0, xi: 0 });
  const detData = rk4(detDerivs, [N - I0, I0, 0], [0, maxTime], 0.2);
  const detStep = Math.max(1, Math.floor(detData.length / 1000));
  const detSampled = detData.filter((_, i) => i % detStep === 0);

  // Draw all visualizations
  drawStochTrajectories(allRuns, detSampled, N, nShow, maxTime);
  drawFinalSizeDistribution(finalSizes, N);
  drawEpidemicProbability(gamma, N, I0);

  // Update metrics
  const epiProb = epidemicCount / nRuns;
  const sortedSizes = [...finalSizes].sort((a, b) => a - b);
  const median = sortedSizes[Math.floor(sortedSizes.length / 2)];
  const mean = d3.mean(finalSizes);

  document.getElementById('stoch-r0').textContent = r0.toFixed(2);
  document.getElementById('stoch-epi-prob').textContent = (epiProb * 100).toFixed(1) + '%';
  document.getElementById('stoch-median-size').textContent = Math.round(median).toLocaleString();
  document.getElementById('stoch-mean-size').textContent = Math.round(mean).toLocaleString();
  document.getElementById('stoch-fadeout').textContent = ((1 - epiProb) * 100).toFixed(1) + '%';
  document.getElementById('stoch-runs').textContent = nRuns;
}

function drawStochTrajectories(allRuns, detData, N, nShow, maxTime) {
  const container = document.getElementById('stoch-trajectories');
  if (!container) return;
  container.innerHTML = '';

  const width = container.clientWidth || 700;
  const height = 380;
  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const x = d3.scaleLinear().domain([0, maxTime]).range([0, w]);
  const y = d3.scaleLinear().domain([0, N * 0.6]).range([h, 0]);

  // Grid + axes
  g.append('g').attr('class', 'grid')
    .call(d3.axisLeft(y).tickSize(-w).tickFormat('').ticks(6));
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(8))
    .append('text').attr('x', w / 2).attr('y', 38).attr('fill', '#555')
    .attr('text-anchor', 'middle').style('font-size', '0.8rem').text('Time (days)');
  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(6).tickFormat(d3.format('.0f')))
    .append('text').attr('transform', 'rotate(-90)').attr('x', -h / 2).attr('y', -50)
    .attr('fill', '#555').attr('text-anchor', 'middle').style('font-size', '0.8rem').text('Infected (I)');

  // Draw stochastic trajectories (thin, semi-transparent)
  const showRuns = allRuns.slice(0, nShow);
  const line = d3.line().x(d => x(d.t)).y(d => y(d.I));

  showRuns.forEach(traj => {
    // Downsample long trajectories
    const step = Math.max(1, Math.floor(traj.length / 300));
    const sampled = traj.filter((_, i) => i % step === 0 || i === traj.length - 1);
    g.append('path').datum(sampled)
      .attr('fill', 'none')
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.15)
      .attr('d', line);
  });

  // Draw deterministic solution (thick)
  const detLine = d3.line().x(d => x(d.t)).y(d => y(d.y[1])).curve(d3.curveBasis);
  g.append('path').datum(detData)
    .attr('fill', 'none')
    .attr('stroke', '#1e40af')
    .attr('stroke-width', 3)
    .attr('stroke-dasharray', '8,4')
    .attr('d', detLine);

  // Compute and draw median + IQR envelope from stochastic runs
  const timeBins = 100;
  const binWidth = maxTime / timeBins;
  const envelopeData = [];

  for (let b = 0; b <= timeBins; b++) {
    const tTarget = b * binWidth;
    const values = [];

    for (const traj of allRuns) {
      // Find nearest point in trajectory
      let best = traj[0];
      for (const pt of traj) {
        if (Math.abs(pt.t - tTarget) < Math.abs(best.t - tTarget)) best = pt;
      }
      values.push(best.I);
    }

    values.sort((a, c) => a - c);
    envelopeData.push({
      t: tTarget,
      q25: values[Math.floor(values.length * 0.25)],
      q50: values[Math.floor(values.length * 0.50)],
      q75: values[Math.floor(values.length * 0.75)],
    });
  }

  // IQR shaded area
  const area = d3.area()
    .x(d => x(d.t))
    .y0(d => y(d.q25))
    .y1(d => y(d.q75))
    .curve(d3.curveBasis);
  g.append('path').datum(envelopeData)
    .attr('fill', '#ef4444').attr('opacity', 0.12).attr('d', area);

  // Median line
  const medLine = d3.line().x(d => x(d.t)).y(d => y(d.q50)).curve(d3.curveBasis);
  g.append('path').datum(envelopeData)
    .attr('fill', 'none').attr('stroke', '#ef4444').attr('stroke-width', 2.5)
    .attr('d', medLine);

  // Legend
  const legend = svg.append('g').attr('transform', `translate(${width - margin.right + 10}, ${margin.top})`);
  const items = [
    { color: '#ef4444', dash: '', label: 'Stochastic median', width: 2.5 },
    { color: '#ef4444', dash: '', label: 'IQR envelope', width: 0, fill: true },
    { color: '#1e40af', dash: '8,4', label: 'Deterministic', width: 3 },
    { color: '#ef4444', dash: '', label: 'Individual runs', width: 1, opacity: 0.3 },
  ];
  items.forEach((item, i) => {
    const row = legend.append('g').attr('transform', `translate(0, ${i * 20})`);
    if (item.fill) {
      row.append('rect').attr('width', 14).attr('height', 8).attr('y', 2).attr('rx', 2)
        .attr('fill', item.color).attr('opacity', 0.2);
    } else {
      row.append('line').attr('x1', 0).attr('x2', 14).attr('y1', 6).attr('y2', 6)
        .attr('stroke', item.color).attr('stroke-width', item.width)
        .attr('stroke-dasharray', item.dash).attr('stroke-opacity', item.opacity || 1);
    }
    row.append('text').attr('x', 20).attr('y', 10).attr('class', 'chart-legend')
      .attr('fill', '#555').text(item.label);
  });
}

function drawFinalSizeDistribution(finalSizes, N) {
  const container = document.getElementById('stoch-finalsize');
  if (!container) return;
  container.innerHTML = '';

  const width = container.clientWidth || 700;
  const height = 280;
  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  // Create histogram bins
  const nBins = 30;
  const histogram = d3.histogram()
    .domain([0, N])
    .thresholds(nBins);
  const bins = histogram(finalSizes);

  const x = d3.scaleLinear().domain([0, N]).range([0, w]);
  const yMax = d3.max(bins, b => b.length);
  const y = d3.scaleLinear().domain([0, yMax]).range([h, 0]);

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format('.0f')))
    .append('text').attr('x', w / 2).attr('y', 38).attr('fill', '#555')
    .attr('text-anchor', 'middle').style('font-size', '0.8rem').text('Total Recovered (Final Epidemic Size)');
  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5))
    .append('text').attr('transform', 'rotate(-90)').attr('x', -h / 2).attr('y', -45)
    .attr('fill', '#555').attr('text-anchor', 'middle').style('font-size', '0.8rem').text('Frequency');

  // Bars
  g.selectAll('.hist-bar').data(bins).enter().append('rect')
    .attr('class', 'hist-bar')
    .attr('x', d => x(d.x0) + 1)
    .attr('y', d => y(d.length))
    .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 2))
    .attr('height', d => h - y(d.length))
    .attr('fill', d => {
      const midpoint = (d.x0 + d.x1) / 2;
      return midpoint < N * 0.05 ? '#60a5fa' : '#ef4444';
    })
    .attr('opacity', 0.7)
    .attr('rx', 2);

  // Annotations
  const fadeCount = finalSizes.filter(s => s < N * 0.05).length;
  const epiCount = finalSizes.length - fadeCount;
  if (fadeCount > 0 && epiCount > 0) {
    g.append('text').attr('x', x(N * 0.025)).attr('y', 15)
      .attr('text-anchor', 'middle').style('font-size', '0.75rem').attr('fill', '#2563eb')
      .style('font-family', 'var(--font-heading)').style('font-weight', '600')
      .text(`Fade-outs (${fadeCount})`);
    const epiSizes = finalSizes.filter(s => s >= N * 0.05);
    const epiMean = d3.mean(epiSizes);
    if (epiMean) {
      g.append('text').attr('x', x(epiMean)).attr('y', 15)
        .attr('text-anchor', 'middle').style('font-size', '0.75rem').attr('fill', '#dc2626')
        .style('font-family', 'var(--font-heading)').style('font-weight', '600')
        .text(`Major epidemics (${epiCount})`);
    }
  }
}

function drawEpidemicProbability(gamma, N, I0) {
  const container = document.getElementById('stoch-probability');
  if (!container) return;
  container.innerHTML = '';

  const width = container.clientWidth || 700;
  const height = 260;
  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  // Theoretical probability of epidemic vs R0
  // P(epidemic) ≈ 1 - (1/R0)^I0 for R0 > 1
  const r0Values = [];
  for (let r = 0.2; r <= 6; r += 0.05) {
    const pEpi = r > 1 ? 1 - Math.pow(1 / r, I0) : 0;
    r0Values.push({ r0: r, prob: pEpi });
  }

  // Also run quick Monte Carlo at a few R0 points for empirical comparison
  const mcPoints = [];
  const mcR0s = [0.5, 0.8, 1.0, 1.2, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0];
  const mcRuns = 100;
  const threshold = N * 0.05;

  for (const r0 of mcR0s) {
    const beta = r0 * gamma;
    let epiCount = 0;
    for (let i = 0; i < mcRuns; i++) {
      const traj = gillespieSIR(beta, gamma, N, I0, 500);
      if (traj[traj.length - 1].R > threshold) epiCount++;
    }
    mcPoints.push({ r0, prob: epiCount / mcRuns });
  }

  const x = d3.scaleLinear().domain([0, 6]).range([0, w]);
  const y = d3.scaleLinear().domain([0, 1]).range([h, 0]);

  g.append('g').attr('class', 'grid').call(d3.axisLeft(y).tickSize(-w).tickFormat('').ticks(5));
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(8))
    .append('text').attr('x', w / 2).attr('y', 38).attr('fill', '#555')
    .attr('text-anchor', 'middle').style('font-size', '0.8rem').text('R₀');
  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.0%')))
    .append('text').attr('transform', 'rotate(-90)').attr('x', -h / 2).attr('y', -45)
    .attr('fill', '#555').attr('text-anchor', 'middle').style('font-size', '0.8rem').text('P(major epidemic)');

  // R0 = 1 threshold
  g.append('line')
    .attr('x1', x(1)).attr('x2', x(1)).attr('y1', 0).attr('y2', h)
    .attr('stroke', '#dc2626').attr('stroke-width', 1.5).attr('stroke-dasharray', '6,4');
  g.append('text').attr('x', x(1) + 5).attr('y', 15)
    .style('font-size', '0.72rem').attr('fill', '#dc2626')
    .style('font-family', 'var(--font-heading)').text('R₀ = 1');

  // Theoretical curve
  const thLine = d3.line().x(d => x(d.r0)).y(d => y(d.prob)).curve(d3.curveBasis);
  g.append('path').datum(r0Values)
    .attr('fill', 'none').attr('stroke', '#2563eb').attr('stroke-width', 2.5)
    .attr('d', thLine);

  // Monte Carlo points
  g.selectAll('.mc-dot').data(mcPoints).enter().append('circle')
    .attr('cx', d => x(d.r0)).attr('cy', d => y(d.prob))
    .attr('r', 5).attr('fill', '#e97319').attr('stroke', '#fff').attr('stroke-width', 1.5);

  // Legend
  const legend = svg.append('g').attr('transform', `translate(${width - margin.right + 10}, ${margin.top})`);
  const row1 = legend.append('g');
  row1.append('line').attr('x1', 0).attr('x2', 14).attr('y1', 6).attr('y2', 6)
    .attr('stroke', '#2563eb').attr('stroke-width', 2.5);
  row1.append('text').attr('x', 20).attr('y', 10).attr('class', 'chart-legend')
    .attr('fill', '#555').text('Theory');
  const row2 = legend.append('g').attr('transform', 'translate(0, 22)');
  row2.append('circle').attr('cx', 7).attr('cy', 6).attr('r', 4)
    .attr('fill', '#e97319').attr('stroke', '#fff').attr('stroke-width', 1);
  row2.append('text').attr('x', 20).attr('y', 10).attr('class', 'chart-legend')
    .attr('fill', '#555').text('Monte Carlo');
}

/* ============================================================
   SECTION 15: Sensitivity Analysis
   ============================================================ */

function runSensitivityAnalysis() {
  const diseaseKey = document.getElementById('sens-disease').value;
  const preset = DISEASE_PRESETS[diseaseKey] || DISEASE_PRESETS.covid19;
  const model = document.getElementById('sens-model').value;
  const metric = document.getElementById('sens-metric').value;
  const N = +document.getElementById('sens-pop-slider').value;
  const range = +document.getElementById('sens-range-slider').value / 100;
  const nPoints = +document.getElementById('sens-points-slider').value;
  const I0 = 10;
  const days = 365;
  const dt = 0.5;

  // Parameters to analyze
  const paramDefs = [
    { key: 'beta',  label: 'Transmission (β)', base: preset.beta },
    { key: 'gamma', label: 'Recovery (γ)',      base: preset.gamma },
  ];
  if (model === 'SEIR') {
    paramDefs.push({ key: 'sigma', label: 'Incubation (σ)', base: preset.sigma });
  }
  if (model === 'SIRD') {
    paramDefs.push({ key: 'mu', label: 'Mortality (μ)', base: preset.mu });
  }

  // Helper: run simulation and extract metric
  function runAndMeasure(params) {
    const derivs = getDerivatives(model, { ...params, xi: preset.xi || 0 });
    const y0 = getInitialConditions(model, N, I0);
    const data = rk4(derivs, y0, [0, days], dt);
    const compartments = getCompartmentNames(model);
    const iIdx = compartments.indexOf('I');
    const rIdx = compartments.indexOf('R');
    const dIdx = compartments.indexOf('D');

    let peakI = 0, peakDay = 0;
    data.forEach(d => { if (d.y[iIdx] > peakI) { peakI = d.y[iIdx]; peakDay = d.t; } });

    const last = data[data.length - 1];
    let totalInf = 0;
    if (rIdx >= 0) totalInf += last.y[rIdx];
    if (dIdx >= 0) totalInf += last.y[dIdx];

    switch (metric) {
      case 'peakI': return peakI;
      case 'totalInf': return totalInf;
      case 'peakDay': return peakDay;
      default: return peakI;
    }
  }

  // Baseline
  const baseParams = { beta: preset.beta, gamma: preset.gamma, sigma: preset.sigma, mu: preset.mu };
  const baselineValue = runAndMeasure(baseParams);

  // OAT tornado data
  const tornadoData = paramDefs.map(pDef => {
    const lowParams = { ...baseParams, [pDef.key]: pDef.base * (1 - range) };
    const highParams = { ...baseParams, [pDef.key]: pDef.base * (1 + range) };
    const lowVal = runAndMeasure(lowParams);
    const highVal = runAndMeasure(highParams);
    return {
      label: pDef.label,
      low: Math.min(lowVal, highVal),
      high: Math.max(lowVal, highVal),
      baseline: baselineValue,
      spread: Math.abs(highVal - lowVal),
    };
  });

  // Sort by spread (most sensitive first)
  tornadoData.sort((a, b) => b.spread - a.spread);

  // Spider plot data: sweep each parameter
  const spiderData = paramDefs.map(pDef => {
    const points = [];
    for (let i = 0; i <= nPoints; i++) {
      const frac = (1 - range) + (2 * range * i / nPoints);
      const params = { ...baseParams, [pDef.key]: pDef.base * frac };
      const val = runAndMeasure(params);
      points.push({ fraction: frac, value: val });
    }
    return { label: pDef.label, key: pDef.key, points };
  });

  // R0 heatmap
  const heatmapXKey = document.getElementById('heatmap-x').value;
  const heatmapYKey = document.getElementById('heatmap-y').value;
  const heatmapRes = 30;

  const xBase = baseParams[heatmapXKey];
  const yBase = baseParams[heatmapYKey];
  const heatmapData = [];

  for (let i = 0; i < heatmapRes; i++) {
    for (let j = 0; j < heatmapRes; j++) {
      const xVal = xBase * (0.3 + 2.0 * i / (heatmapRes - 1));
      const yVal = yBase * (0.3 + 2.0 * j / (heatmapRes - 1));
      const params = { ...baseParams, [heatmapXKey]: xVal, [heatmapYKey]: yVal };
      const r0 = params.beta / params.gamma;
      heatmapData.push({ xi: i, yi: j, xVal, yVal, r0 });
    }
  }

  drawTornadoDiagram(tornadoData, baselineValue, metric);
  drawSpiderPlot(spiderData, baselineValue, metric);
  drawR0Heatmap(heatmapData, heatmapRes, heatmapXKey, heatmapYKey, xBase, yBase);

  // Update metrics
  document.getElementById('sens-most').textContent = tornadoData[0]?.label || '—';
  document.getElementById('sens-baseline-peak').textContent = Math.round(baselineValue).toLocaleString();
  const totalRange = tornadoData.reduce((sum, d) => sum + d.spread, 0);
  document.getElementById('sens-range').textContent = Math.round(totalRange).toLocaleString();
  document.getElementById('sens-r0').textContent = (preset.beta / preset.gamma).toFixed(2);
}

function drawTornadoDiagram(data, baseline, metricLabel) {
  const container = document.getElementById('tornado-chart');
  if (!container) return;
  container.innerHTML = '';

  const width = container.clientWidth || 700;
  const height = Math.max(200, data.length * 50 + 80);
  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const mLeft = 140;
  const g = svg.append('g').attr('transform', `translate(${mLeft},${margin.top})`);
  const w = width - mLeft - margin.right;
  const h = height - margin.top - margin.bottom;

  const allVals = data.flatMap(d => [d.low, d.high, d.baseline]);
  const xMin = d3.min(allVals) * 0.9;
  const xMax = d3.max(allVals) * 1.1;
  const x = d3.scaleLinear().domain([xMin, xMax]).range([0, w]);
  const y = d3.scaleBand().domain(data.map(d => d.label)).range([0, h]).padding(0.35);

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('.2s')));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y));

  // Baseline reference line
  g.append('line')
    .attr('x1', x(baseline)).attr('x2', x(baseline))
    .attr('y1', 0).attr('y2', h)
    .attr('stroke', '#1e293b').attr('stroke-width', 2).attr('stroke-dasharray', '4,3');

  // Tornado bars
  const barColors = ['#2563eb', '#e97319', '#059669', '#dc2626', '#a78bfa'];
  data.forEach((d, i) => {
    const barY = y(d.label);
    const barH = y.bandwidth();
    g.append('rect')
      .attr('x', x(d.low))
      .attr('y', barY)
      .attr('width', x(d.high) - x(d.low))
      .attr('height', barH)
      .attr('fill', barColors[i % barColors.length])
      .attr('opacity', 0.75)
      .attr('rx', 3);

    // Value labels
    g.append('text').attr('x', x(d.low) - 4).attr('y', barY + barH / 2 + 4)
      .attr('text-anchor', 'end').style('font-size', '0.7rem').attr('fill', '#555')
      .text(d3.format('.2s')(d.low));
    g.append('text').attr('x', x(d.high) + 4).attr('y', barY + barH / 2 + 4)
      .attr('text-anchor', 'start').style('font-size', '0.7rem').attr('fill', '#555')
      .text(d3.format('.2s')(d.high));
  });
}

function drawSpiderPlot(data, baseline, metricLabel) {
  const container = document.getElementById('spider-chart');
  if (!container) return;
  container.innerHTML = '';

  const width = container.clientWidth || 700;
  const height = 320;
  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const allFracs = data.flatMap(d => d.points.map(p => p.fraction));
  const allVals = data.flatMap(d => d.points.map(p => p.value));

  const x = d3.scaleLinear().domain([d3.min(allFracs), d3.max(allFracs)]).range([0, w]);
  const y = d3.scaleLinear().domain([0, d3.max(allVals) * 1.1]).range([h, 0]);

  g.append('g').attr('class', 'grid').call(d3.axisLeft(y).tickSize(-w).tickFormat('').ticks(6));
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d => d3.format('.0%')(d)))
    .append('text').attr('x', w / 2).attr('y', 38).attr('fill', '#555')
    .attr('text-anchor', 'middle').style('font-size', '0.8rem').text('Parameter multiplier (% of baseline)');
  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(6).tickFormat(d3.format('.2s')));

  // Baseline cross
  g.append('line')
    .attr('x1', x(1)).attr('x2', x(1)).attr('y1', 0).attr('y2', h)
    .attr('stroke', '#94a3b8').attr('stroke-width', 1).attr('stroke-dasharray', '4,4');

  const spiderColors = ['#2563eb', '#e97319', '#059669', '#dc2626', '#a78bfa'];

  data.forEach((series, i) => {
    const line = d3.line().x(d => x(d.fraction)).y(d => y(d.value)).curve(d3.curveBasis);
    g.append('path').datum(series.points)
      .attr('fill', 'none')
      .attr('stroke', spiderColors[i % spiderColors.length])
      .attr('stroke-width', 2.5)
      .attr('d', line);
  });

  // Legend
  const legend = svg.append('g').attr('transform', `translate(${width - margin.right + 10}, ${margin.top})`);
  data.forEach((series, i) => {
    const row = legend.append('g').attr('transform', `translate(0, ${i * 20})`);
    row.append('line').attr('x1', 0).attr('x2', 14).attr('y1', 6).attr('y2', 6)
      .attr('stroke', spiderColors[i % spiderColors.length]).attr('stroke-width', 2.5);
    row.append('text').attr('x', 20).attr('y', 10).attr('class', 'chart-legend')
      .attr('fill', '#555').text(series.label);
  });
}

function drawR0Heatmap(data, res, xKey, yKey, xBase, yBase) {
  const container = document.getElementById('r0-heatmap');
  if (!container) return;
  container.innerHTML = '';

  const width = container.clientWidth || 700;
  const height = 360;
  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const mLeft = 80;
  const g = svg.append('g').attr('transform', `translate(${mLeft},${margin.top})`);
  const w = width - mLeft - margin.right - 60; // leave room for color legend
  const h = height - margin.top - margin.bottom;

  const cellW = w / res;
  const cellH = h / res;

  const xExtent = [d3.min(data, d => d.xVal), d3.max(data, d => d.xVal)];
  const yExtent = [d3.min(data, d => d.yVal), d3.max(data, d => d.yVal)];

  const x = d3.scaleLinear().domain(xExtent).range([0, w]);
  const y = d3.scaleLinear().domain(yExtent).range([h, 0]);

  const r0Max = d3.max(data, d => d.r0);
  const colorScale = d3.scaleSequential(d3.interpolateRdYlBu).domain([r0Max, 0]);

  // Draw cells
  data.forEach(d => {
    g.append('rect')
      .attr('x', d.xi * cellW)
      .attr('y', (res - 1 - d.yi) * cellH)
      .attr('width', cellW + 0.5)
      .attr('height', cellH + 0.5)
      .attr('fill', colorScale(d.r0));
  });

  // R0 = 1 contour line (approximate)
  const contourPts = [];
  for (let i = 0; i < res; i++) {
    for (let j = 0; j < res - 1; j++) {
      const idx1 = i * res + j;
      const idx2 = i * res + j + 1;
      if ((data[idx1].r0 - 1) * (data[idx2].r0 - 1) < 0) {
        const frac = (1 - data[idx1].r0) / (data[idx2].r0 - data[idx1].r0);
        contourPts.push({
          px: i * cellW + cellW / 2,
          py: (res - 1 - (j + frac)) * cellH,
        });
      }
    }
  }
  if (contourPts.length > 1) {
    contourPts.sort((a, b) => a.px - b.px);
    const contourLine = d3.line().x(d => d.px).y(d => d.py).curve(d3.curveBasis);
    g.append('path').datum(contourPts)
      .attr('fill', 'none').attr('stroke', '#fff').attr('stroke-width', 2.5)
      .attr('stroke-dasharray', '6,3').attr('d', contourLine);
    g.append('text')
      .attr('x', contourPts[Math.floor(contourPts.length / 2)].px + 5)
      .attr('y', contourPts[Math.floor(contourPts.length / 2)].py - 8)
      .style('font-size', '0.75rem').attr('fill', '#fff')
      .style('font-family', 'var(--font-heading)').style('font-weight', '700')
      .text('R₀ = 1');
  }

  // Axes
  const paramLabels = {
    beta: 'Transmission Rate (β)',
    gamma: 'Recovery Rate (γ)',
    sigma: 'Incubation Rate (σ)',
    mu: 'Mortality Rate (μ)',
  };

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('.2f')))
    .append('text').attr('x', w / 2).attr('y', 38).attr('fill', '#555')
    .attr('text-anchor', 'middle').style('font-size', '0.8rem').text(paramLabels[xKey] || xKey);

  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(6).tickFormat(d3.format('.2f')))
    .append('text').attr('transform', 'rotate(-90)').attr('x', -h / 2).attr('y', -60)
    .attr('fill', '#555').attr('text-anchor', 'middle').style('font-size', '0.8rem').text(paramLabels[yKey] || yKey);

  // Color bar
  const cbW = 16;
  const cbH = h;
  const cbG = svg.append('g').attr('transform', `translate(${width - margin.right - 40}, ${margin.top})`);

  const cbScale = d3.scaleLinear().domain([0, r0Max]).range([cbH, 0]);
  const nStops = 50;
  for (let i = 0; i < nStops; i++) {
    const v = (r0Max * i) / nStops;
    cbG.append('rect')
      .attr('x', 0).attr('y', cbScale(v + r0Max / nStops))
      .attr('width', cbW).attr('height', cbH / nStops + 1)
      .attr('fill', colorScale(v));
  }
  cbG.append('g').attr('class', 'axis').attr('transform', `translate(${cbW}, 0)`)
    .call(d3.axisRight(cbScale).ticks(5).tickFormat(d3.format('.1f')));
  cbG.append('text').attr('x', cbW / 2).attr('y', -8)
    .attr('text-anchor', 'middle').style('font-size', '0.72rem').attr('fill', '#555')
    .style('font-family', 'var(--font-heading)').text('R₀');
}

/* ============================================================
   SECTION 16: Event Binding & Initialization
   ============================================================ */
function bindSliderDisplay(sliderId, displayId, formatter) {
  const slider = document.getElementById(sliderId);
  const display = document.getElementById(displayId);
  if (!slider || !display) return;
  slider.addEventListener('input', () => {
    display.textContent = formatter ? formatter(+slider.value) : slider.value;
  });
}

function initControls() {
  // Compartmental controls
  const sliders = ['beta', 'gamma', 'sigma', 'xi', 'mu', 'pop', 'i0', 'days'];
  sliders.forEach(id => {
    const el = document.getElementById(id + '-slider');
    if (el) el.addEventListener('input', () => { readCompControls(); updateCompDisplays(); });
  });

  document.getElementById('model-type')?.addEventListener('change', () => {
    readCompControls();
    toggleParamVisibility();
    renderEquations();
    runCompartmental();
  });

  document.getElementById('disease-preset')?.addEventListener('change', (e) => {
    applyPreset(e.target.value);
    runCompartmental();
  });

  document.getElementById('run-compartmental')?.addEventListener('click', runCompartmental);
  document.getElementById('reset-compartmental')?.addEventListener('click', () => {
    applyPreset('custom');
    document.getElementById('disease-preset').value = 'custom';
    runCompartmental();
  });

  // ABM controls
  const abmSliders = [
    ['abm-n-slider', 'abm-n-display'],
    ['abm-radius-slider', 'abm-radius-display'],
    ['abm-trans-slider', 'abm-trans-display'],
    ['abm-recovery-slider', 'abm-recovery-display'],
    ['abm-incubation-slider', 'abm-incubation-display'],
    ['abm-mortality-slider', 'abm-mortality-display'],
    ['abm-speed-slider', 'abm-speed-display'],
    ['abm-distancing-slider', 'abm-distancing-display'],
    ['abm-vaccine-slider', 'abm-vaccine-display'],
  ];
  abmSliders.forEach(([sid, did]) => bindSliderDisplay(sid, did));

  document.getElementById('abm-start')?.addEventListener('click', () => {
    if (!abmRunning) {
      if (abmAgents.length === 0) createAgents();
      abmRunning = true;
      abmLoop();
    }
  });

  document.getElementById('abm-pause')?.addEventListener('click', () => {
    abmRunning = false;
    if (abmFrameId) cancelAnimationFrame(abmFrameId);
  });

  document.getElementById('abm-reset')?.addEventListener('click', () => {
    abmRunning = false;
    if (abmFrameId) cancelAnimationFrame(abmFrameId);
    createAgents();
    renderABM();
    drawABMCurve();
    updateABMMetrics([...new Array(6).fill(0)]);
  });

  // Intervention controls
  const ivSliders = [
    ['iv-vaccine-slider', 'iv-vaccine-display'],
    ['iv-efficacy-slider', 'iv-efficacy-display'],
    ['iv-contact-slider', 'iv-contact-display'],
    ['iv-start-slider', 'iv-start-display'],
    ['iv-duration-slider', 'iv-duration-display'],
    ['iv-capacity-slider', 'iv-capacity-display'],
  ];
  ivSliders.forEach(([sid, did]) => bindSliderDisplay(sid, did));

  document.getElementById('run-intervention')?.addEventListener('click', runInterventionComparison);

  // Network controls
  const netSliders = [
    ['net-nodes-slider', 'net-nodes-display'],
    ['net-edges-slider', 'net-edges-display'],
    ['net-rewire-slider', 'net-rewire-display'],
    ['net-trans-slider', 'net-trans-display'],
    ['net-recovery-slider', 'net-recovery-display'],
    ['net-vaccine-slider', 'net-vaccine-display'],
  ];
  netSliders.forEach(([sid, did]) => bindSliderDisplay(sid, did));

  document.getElementById('network-type')?.addEventListener('change', () => {
    const type = document.getElementById('network-type').value;
    document.getElementById('rewire-group').style.display = type === 'small-world' ? '' : 'none';
  });

  document.getElementById('run-network')?.addEventListener('click', () => {
    if (netRunning) {
      netRunning = false;
      if (netAnimId) clearInterval(netAnimId);
      return;
    }
    generateNetwork();
    drawNetworkGraph();
    drawDegreeDistribution();
    drawNetworkCurve();

    netRunning = true;
    netAnimId = setInterval(() => {
      const counts = stepNetwork();
      updateNetworkColors();
      drawNetworkCurve();
      if (counts.I === 0) {
        netRunning = false;
        clearInterval(netAnimId);
      }
    }, 300);
  });

  document.getElementById('step-network')?.addEventListener('click', () => {
    if (netNodes.length === 0) {
      generateNetwork();
      drawNetworkGraph();
      drawDegreeDistribution();
    }
    stepNetwork();
    updateNetworkColors();
    drawNetworkCurve();
  });

  document.getElementById('reset-network')?.addEventListener('click', () => {
    netRunning = false;
    if (netAnimId) clearInterval(netAnimId);
    generateNetwork();
    drawNetworkGraph();
    drawDegreeDistribution();
    drawNetworkCurve();
  });

  // Stochastic controls
  const stochSliders = [
    ['stoch-beta-slider', 'stoch-beta-display'],
    ['stoch-gamma-slider', 'stoch-gamma-display'],
    ['stoch-pop-slider', 'stoch-pop-display'],
    ['stoch-i0-slider', 'stoch-i0-display'],
    ['stoch-runs-slider', 'stoch-runs-display'],
    ['stoch-show-slider', 'stoch-show-display'],
  ];
  stochSliders.forEach(([sid, did]) => bindSliderDisplay(sid, did));

  document.getElementById('stoch-disease')?.addEventListener('change', (e) => {
    const key = e.target.value;
    const p = DISEASE_PRESETS[key];
    if (p && key !== 'custom') {
      document.getElementById('stoch-beta-slider').value = p.beta;
      document.getElementById('stoch-gamma-slider').value = p.gamma;
      document.getElementById('stoch-beta-display').textContent = p.beta.toFixed(2);
      document.getElementById('stoch-gamma-display').textContent = p.gamma.toFixed(3);
    }
  });

  document.getElementById('run-stochastic')?.addEventListener('click', runStochasticSimulation);
  document.getElementById('reset-stochastic')?.addEventListener('click', () => {
    ['stoch-trajectories', 'stoch-finalsize', 'stoch-probability'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
    ['stoch-r0', 'stoch-epi-prob', 'stoch-median-size', 'stoch-mean-size', 'stoch-fadeout', 'stoch-runs']
      .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '—'; });
  });

  // Sensitivity controls
  const sensSliders = [
    ['sens-pop-slider', 'sens-pop-display'],
    ['sens-range-slider', 'sens-range-display'],
    ['sens-points-slider', 'sens-points-display'],
  ];
  sensSliders.forEach(([sid, did]) => bindSliderDisplay(sid, did));

  document.getElementById('run-sensitivity')?.addEventListener('click', runSensitivityAnalysis);
}

/* ============================================================
   SECTION 17: Bootstrap
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initControls();
  toggleParamVisibility();
  renderEquations();
  renderLiteratureEquations();
  updateCompDisplays();

  // Run initial compartmental simulation
  runCompartmental();

  // Initialize ABM canvas
  createAgents();
  renderABM();
});
