/* ============================================================
   Module MQ-9 — Vaccine-Preventable Disease Outbreak Simulator
   ============================================================
   Comprehensive interactive simulation of all US vaccine-preventable
   diseases with SEIRD compartmental modeling, vaccination coverage
   analysis, and historical impact visualization.

   Data sources: CDC Pink Book, Anderson & May (1991), Roush & Murphy (2007)
   ============================================================ */

import * as d3 from 'd3';
import katex from 'katex';

/* ============================================================
   SECTION 0: Disease Database
   ============================================================
   Comprehensive epidemiological parameters for all 17 US
   vaccine-preventable diseases. Values from CDC surveillance,
   systematic reviews, and peer-reviewed literature.
   ============================================================ */
const DISEASES = {
  measles: {
    label: 'Measles', r0: 15, r0Range: [12, 18],
    incubationDays: 10, infectiousDays: 8,
    cfrPreVaccine: 0.002, cfrCurrent: 0.002,
    vaccineEfficacy: 0.97, usVaxRate: 0.92,
    preVaxAnnualCases: 3500000, preVaxAnnualDeaths: 500,
    currentAnnualCases: 200, vaccineYear: 1963,
    serialInterval: 12, herdImmunity: 0.93,
    description: 'Highly contagious airborne virus. Pre-vaccine, virtually every child was infected by age 15. Two doses of MMR provide ~97% protection.',
    communicable: true,
  },
  pertussis: {
    label: 'Pertussis (Whooping Cough)', r0: 15, r0Range: [12, 17],
    incubationDays: 8, infectiousDays: 21,
    cfrPreVaccine: 0.02, cfrCurrent: 0.001,
    vaccineEfficacy: 0.85, usVaxRate: 0.94,
    preVaxAnnualCases: 200000, preVaxAnnualDeaths: 4000,
    currentAnnualCases: 15000, vaccineYear: 1914,
    serialInterval: 22, herdImmunity: 0.93,
    description: 'Caused by Bordetella pertussis. Immunity wanes over time, allowing periodic resurgence even in vaccinated populations. Most dangerous for infants.',
    communicable: true,
  },
  polio: {
    label: 'Polio (Poliomyelitis)', r0: 6, r0Range: [5, 7],
    incubationDays: 10, infectiousDays: 14,
    cfrPreVaccine: 0.02, cfrCurrent: 0.02,
    vaccineEfficacy: 0.99, usVaxRate: 0.93,
    preVaxAnnualCases: 20000, preVaxAnnualDeaths: 1800,
    currentAnnualCases: 0, vaccineYear: 1955,
    serialInterval: 17, herdImmunity: 0.83,
    description: 'Enterovirus causing paralysis in ~1% of infections. Salk (inactivated) vaccine in 1955 and Sabin (oral) vaccine in 1961 led to elimination in the US by 1979.',
    communicable: true,
  },
  smallpox: {
    label: 'Smallpox (Variola)', r0: 6, r0Range: [5, 7],
    incubationDays: 12, infectiousDays: 17,
    cfrPreVaccine: 0.30, cfrCurrent: 0.30,
    vaccineEfficacy: 0.95, usVaxRate: 0,
    preVaxAnnualCases: 48000, preVaxAnnualDeaths: 15000,
    currentAnnualCases: 0, vaccineYear: 1796,
    serialInterval: 20, herdImmunity: 0.83,
    description: 'First disease eradicated by vaccination (1980). Jennerian vaccination began in 1796. CFR ~30% for variola major. Routine vaccination ended in 1972.',
    communicable: true,
  },
  diphtheria: {
    label: 'Diphtheria', r0: 7, r0Range: [6, 8],
    incubationDays: 3, infectiousDays: 14,
    cfrPreVaccine: 0.10, cfrCurrent: 0.05,
    vaccineEfficacy: 0.97, usVaxRate: 0.94,
    preVaxAnnualCases: 175000, preVaxAnnualDeaths: 15500,
    currentAnnualCases: 0, vaccineYear: 1923,
    serialInterval: 10, herdImmunity: 0.86,
    description: 'Bacterial infection producing a toxin that damages heart and nervous system. Was a leading cause of childhood death before the DPT vaccine.',
    communicable: true,
  },
  mumps: {
    label: 'Mumps', r0: 10, r0Range: [7, 14],
    incubationDays: 17, infectiousDays: 8,
    cfrPreVaccine: 0.0001, cfrCurrent: 0.0001,
    vaccineEfficacy: 0.88, usVaxRate: 0.92,
    preVaxAnnualCases: 186000, preVaxAnnualDeaths: 50,
    currentAnnualCases: 2000, vaccineYear: 1967,
    serialInterval: 19, herdImmunity: 0.90,
    description: 'Paramyxovirus causing parotid gland swelling. Low CFR but causes orchitis in post-pubertal males (~25%) and can lead to deafness.',
    communicable: true,
  },
  rubella: {
    label: 'Rubella (German Measles)', r0: 7, r0Range: [6, 8],
    incubationDays: 15, infectiousDays: 7,
    cfrPreVaccine: 0.0001, cfrCurrent: 0.0001,
    vaccineEfficacy: 0.97, usVaxRate: 0.92,
    preVaxAnnualCases: 47745, preVaxAnnualDeaths: 17,
    currentAnnualCases: 5, vaccineYear: 1969,
    serialInterval: 18, herdImmunity: 0.86,
    description: 'Mild disease in children but devastating if contracted during pregnancy: congenital rubella syndrome causes deafness, heart defects, and intellectual disability.',
    communicable: true,
  },
  varicella: {
    label: 'Varicella (Chickenpox)', r0: 10, r0Range: [8, 12],
    incubationDays: 14, infectiousDays: 7,
    cfrPreVaccine: 0.00003, cfrCurrent: 0.00001,
    vaccineEfficacy: 0.92, usVaxRate: 0.91,
    preVaxAnnualCases: 4000000, preVaxAnnualDeaths: 100,
    currentAnnualCases: 9000, vaccineYear: 1995,
    serialInterval: 16, herdImmunity: 0.90,
    description: 'Varicella-zoster virus. Nearly universal childhood infection pre-vaccine. Can reactivate decades later as shingles (herpes zoster).',
    communicable: true,
  },
  hepatitisA: {
    label: 'Hepatitis A', r0: 2.5, r0Range: [1.5, 3.5],
    incubationDays: 28, infectiousDays: 14,
    cfrPreVaccine: 0.003, cfrCurrent: 0.003,
    vaccineEfficacy: 0.95, usVaxRate: 0.77,
    preVaxAnnualCases: 117000, preVaxAnnualDeaths: 300,
    currentAnnualCases: 12500, vaccineYear: 1995,
    serialInterval: 30, herdImmunity: 0.60,
    description: 'Fecal-oral transmission. Causes acute liver inflammation. More severe in adults than children. Outbreaks linked to contaminated food and water.',
    communicable: true,
  },
  hepatitisB: {
    label: 'Hepatitis B', r0: 3, r0Range: [2, 5],
    incubationDays: 90, infectiousDays: 42,
    cfrPreVaccine: 0.01, cfrCurrent: 0.01,
    vaccineEfficacy: 0.95, usVaxRate: 0.91,
    preVaxAnnualCases: 66000, preVaxAnnualDeaths: 237,
    currentAnnualCases: 3200, vaccineYear: 1981,
    serialInterval: 100, herdImmunity: 0.67,
    description: 'Blood-borne and sexually transmitted. Chronic infection in 5-10% of adults (90% of perinatally infected infants), leading to cirrhosis and liver cancer.',
    communicable: true,
  },
  rotavirus: {
    label: 'Rotavirus', r0: 15, r0Range: [10, 20],
    incubationDays: 2, infectiousDays: 8,
    cfrPreVaccine: 0.0001, cfrCurrent: 0.00001,
    vaccineEfficacy: 0.90, usVaxRate: 0.73,
    preVaxAnnualCases: 2700000, preVaxAnnualDeaths: 60,
    currentAnnualCases: 400000, vaccineYear: 2006,
    serialInterval: 6, herdImmunity: 0.93,
    description: 'Leading cause of severe diarrhea in infants and young children worldwide. Nearly every child infected by age 5 before vaccine introduction.',
    communicable: true,
  },
  hib: {
    label: 'Haemophilus influenzae type b', r0: 3, r0Range: [2, 4],
    incubationDays: 3, infectiousDays: 10,
    cfrPreVaccine: 0.05, cfrCurrent: 0.03,
    vaccineEfficacy: 0.95, usVaxRate: 0.93,
    preVaxAnnualCases: 20000, preVaxAnnualDeaths: 1000,
    currentAnnualCases: 30, vaccineYear: 1987,
    serialInterval: 8, herdImmunity: 0.67,
    description: 'Bacterial cause of meningitis, pneumonia, and epiglottitis in children under 5. >99% reduction since vaccine introduction.',
    communicable: true,
  },
  pneumococcal: {
    label: 'Pneumococcal Disease', r0: 3, r0Range: [2, 4],
    incubationDays: 2, infectiousDays: 7,
    cfrPreVaccine: 0.05, cfrCurrent: 0.05,
    vaccineEfficacy: 0.75, usVaxRate: 0.84,
    preVaxAnnualCases: 63000, preVaxAnnualDeaths: 6500,
    currentAnnualCases: 31000, vaccineYear: 2000,
    serialInterval: 5, herdImmunity: 0.67,
    description: 'Streptococcus pneumoniae causes meningitis, bacteremia, and pneumonia. PCV13 targets 13 serotypes; indirect protection through reduced carriage.',
    communicable: true,
  },
  meningococcal: {
    label: 'Meningococcal Disease', r0: 3, r0Range: [1.5, 4],
    incubationDays: 4, infectiousDays: 7,
    cfrPreVaccine: 0.10, cfrCurrent: 0.10,
    vaccineEfficacy: 0.90, usVaxRate: 0.88,
    preVaxAnnualCases: 3000, preVaxAnnualDeaths: 300,
    currentAnnualCases: 350, vaccineYear: 2005,
    serialInterval: 6, herdImmunity: 0.67,
    description: 'Neisseria meningitidis causes bacterial meningitis and septicemia. Rapidly fatal without treatment. College dormitories are a risk setting.',
    communicable: true,
  },
  tetanus: {
    label: 'Tetanus', r0: 0, r0Range: [0, 0],
    incubationDays: 10, infectiousDays: 0,
    cfrPreVaccine: 0.30, cfrCurrent: 0.13,
    vaccineEfficacy: 1.0, usVaxRate: 0.94,
    preVaxAnnualCases: 500, preVaxAnnualDeaths: 150,
    currentAnnualCases: 30, vaccineYear: 1938,
    serialInterval: 0, herdImmunity: 0,
    description: 'Clostridium tetani spores in soil enter wounds. NOT communicable between people. Toxin causes severe muscle spasms. Vaccine prevents disease in the individual only.',
    communicable: false,
  },
  influenza: {
    label: 'Seasonal Influenza', r0: 1.5, r0Range: [1.2, 1.8],
    incubationDays: 2, infectiousDays: 7,
    cfrPreVaccine: 0.001, cfrCurrent: 0.001,
    vaccineEfficacy: 0.50, usVaxRate: 0.52,
    preVaxAnnualCases: 25000000, preVaxAnnualDeaths: 36000,
    currentAnnualCases: 25000000, vaccineYear: 1945,
    serialInterval: 3, herdImmunity: 0.33,
    description: 'Antigenic drift requires annual reformulation. Low individual efficacy but population-level impact through reduced transmission. Herd immunity difficult to achieve.',
    communicable: true,
  },
  hpv: {
    label: 'HPV (Human Papillomavirus)', r0: 4, r0Range: [2, 6],
    incubationDays: 180, infectiousDays: 365,
    cfrPreVaccine: 0.007, cfrCurrent: 0.007,
    vaccineEfficacy: 0.90, usVaxRate: 0.62,
    preVaxAnnualCases: 14000, preVaxAnnualDeaths: 4000,
    currentAnnualCases: 12000, vaccineYear: 2006,
    serialInterval: 300, herdImmunity: 0.75,
    description: 'Sexually transmitted. HPV types 16/18 cause ~70% of cervical cancers. 9-valent vaccine prevents ~90% of HPV-related cancers. Incubation years-decades for cancer.',
    communicable: true,
  },
};

const COLORS = {
  S: '#60a5fa', E: '#fbbf24', I: '#ef4444', R: '#34d399', D: '#6b7280', V: '#a78bfa',
};

const COMPARISON_COLORS = [
  '#2563eb', '#e97319', '#059669', '#dc2626', '#a78bfa',
  '#0891b2', '#d946ef', '#ca8a04', '#64748b', '#be123c',
  '#16a34a', '#7c3aed', '#ea580c', '#0284c7', '#4f46e5',
  '#db2777', '#65a30d',
];

const margin = { top: 30, right: 120, bottom: 45, left: 65 };

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
    y = y.map(v => Math.max(0, v));
    t += dt;
    result.push({ t, y: [...y] });
  }
  return result;
}

/* ============================================================
   SECTION 3: SEIRD Model with Vaccination
   ============================================================ */
function computeParams(disease, overrides) {
  const d = DISEASES[disease];
  const gamma = 1 / (overrides.infectiousDays || d.infectiousDays);
  const sigma = 1 / (overrides.incubationDays || d.incubationDays);
  const r0 = overrides.r0 || d.r0;
  const beta = r0 * gamma;
  const cfr = overrides.cfr !== undefined ? overrides.cfr : d.cfrPreVaccine;
  const mu = cfr * gamma / (1 - cfr + 1e-12);
  return { beta, gamma, sigma, mu, r0 };
}

function seirdDerivs(params) {
  const { beta, gamma, sigma, mu } = params;
  return (t, y) => {
    const [S, E, I, R, D] = y;
    const N = S + E + I + R;
    if (N <= 0) return [0, 0, 0, 0, 0];
    const dS = -beta * S * I / N;
    const dE = beta * S * I / N - sigma * E;
    const dI = sigma * E - gamma * I - mu * I;
    const dR = gamma * I;
    const dD = mu * I;
    return [dS, dE, dI, dR, dD];
  };
}

function runSEIRD(disease, N, I0, days, vaxCoverage, vaxEfficacy, overrides = {}) {
  const params = computeParams(disease, overrides);
  const effectiveS = N * (1 - vaxCoverage * vaxEfficacy);
  const S0 = Math.max(0, effectiveS - I0);
  const y0 = [S0, 0, I0, N - effectiveS, 0]; // S, E, I, R(vaccinated), D
  const dt = 0.2;
  const raw = rk4(seirdDerivs(params), y0, [0, days], dt);
  const step = Math.max(1, Math.floor(raw.length / 2000));
  return { data: raw.filter((_, i) => i % step === 0), params };
}

/* ============================================================
   SECTION 4: Tab 1 — Outbreak Simulator
   ============================================================ */
function runOutbreak() {
  const diseaseKey = document.getElementById('vpd-disease').value;
  const d = DISEASES[diseaseKey];
  const N = +document.getElementById('vpd-pop-slider').value;
  const I0 = +document.getElementById('vpd-i0-slider').value;
  const days = +document.getElementById('vpd-days-slider').value;
  const vaxCov = +document.getElementById('vpd-vax-slider').value / 100;
  const vaxEff = +document.getElementById('vpd-eff-slider').value / 100;

  const override = document.getElementById('vpd-override-toggle').checked;
  const overrides = override ? {
    r0: +document.getElementById('vpd-r0-slider').value,
    incubationDays: +document.getElementById('vpd-incub-slider').value,
    infectiousDays: +document.getElementById('vpd-infect-slider').value,
    cfr: +document.getElementById('vpd-cfr-slider').value / 100,
  } : {};

  // Special case: tetanus is not communicable
  if (!d.communicable) {
    drawNonCommunicableMessage(d);
    return;
  }

  // Run with vaccination
  const withVax = runSEIRD(diseaseKey, N, I0, days, vaxCov, vaxEff, overrides);
  // Run without vaccination
  const noVax = runSEIRD(diseaseKey, N, I0, days, 0, 0, overrides);

  drawOutbreakCurve(withVax.data, N);
  drawComparisonCurve(noVax.data, withVax.data, N, days);
  updateOutbreakMetrics(withVax, noVax, d, N, vaxCov, vaxEff, overrides);
  updateDiseaseInfo(diseaseKey);
  renderEquations();

  document.getElementById('curve-disease-label').textContent = d.label;
  document.getElementById('info-disease-label').textContent = d.label;
}

function drawNonCommunicableMessage(d) {
  const container = document.getElementById('vpd-curve');
  if (container) {
    container.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--color-text-secondary); font-family: var(--font-heading);">
      <h3 style="color: var(--color-primary);">${d.label} is NOT communicable</h3>
      <p>Tetanus is caused by Clostridium tetani spores in soil entering wounds. It cannot spread person-to-person, so compartmental epidemic models do not apply.</p>
      <p>Pre-vaccine: ~${d.preVaxAnnualCases} cases/year, ${d.preVaxAnnualDeaths} deaths/year (CFR: ${(d.cfrPreVaccine * 100).toFixed(0)}%)</p>
      <p>Current: ~${d.currentAnnualCases} cases/year (vaccine provides individual protection only)</p>
    </div>`;
  }
  ['vpd-compare', 'vpd-r0', 'vpd-reff', 'vpd-peak', 'vpd-total', 'vpd-deaths', 'vpd-herd', 'vpd-saved'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = id === 'vpd-compare' ? '' : 'N/A';
    if (id === 'vpd-compare' && el) el.innerHTML = '';
  });
}

function drawOutbreakCurve(data, N) {
  const container = document.getElementById('vpd-curve');
  if (!container) return;
  container.innerHTML = '';

  const width = container.clientWidth || 700;
  const height = 360;
  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const x = d3.scaleLinear().domain([0, d3.max(data, d => d.t)]).range([0, w]);
  const y = d3.scaleLinear().domain([0, N * 1.05]).range([h, 0]);

  g.append('g').attr('class', 'grid').call(d3.axisLeft(y).tickSize(-w).tickFormat('').ticks(6));
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(10))
    .append('text').attr('x', w / 2).attr('y', 38).attr('fill', '#555')
    .attr('text-anchor', 'middle').style('font-size', '0.8rem').text('Days');
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(6).tickFormat(d3.format('.2s')));

  const compartments = ['S', 'E', 'I', 'R', 'D'];
  const compLabels = { S: 'Susceptible', E: 'Exposed', I: 'Infected', R: 'Recovered', D: 'Dead' };

  compartments.forEach((comp, idx) => {
    const line = d3.line().x(d => x(d.t)).y(d => y(d.y[idx])).curve(d3.curveBasis);
    g.append('path').datum(data).attr('class', `epidemic-line line-${comp}`).attr('d', line);
  });

  // Legend
  const legend = svg.append('g').attr('transform', `translate(${width - margin.right + 15}, ${margin.top})`);
  compartments.forEach((comp, i) => {
    const row = legend.append('g').attr('transform', `translate(0, ${i * 22})`);
    row.append('rect').attr('width', 14).attr('height', 3).attr('y', 5).attr('rx', 1.5).attr('fill', COLORS[comp]);
    row.append('text').attr('x', 20).attr('y', 10).attr('class', 'chart-legend').attr('fill', '#555').text(compLabels[comp]);
  });

  // Tooltip
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
      .style('left', (x(d.t) + margin.left + 15) + 'px').style('top', '40px');
  }).on('mouseleave', () => {
    vLine.style('display', 'none');
    tooltip.style('display', 'none');
  });
}

function drawComparisonCurve(noVaxData, vaxData, N, days) {
  const container = document.getElementById('vpd-compare');
  if (!container) return;
  container.innerHTML = '';

  const iIdx = 2; // Infected index
  const width = container.clientWidth || 700;
  const height = 300;
  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const allPts = [...noVaxData, ...vaxData];
  const x = d3.scaleLinear().domain([0, d3.max(allPts, d => d.t)]).range([0, w]);
  const yMax = d3.max(allPts, d => d.y[iIdx]) * 1.1;
  const y = d3.scaleLinear().domain([0, yMax]).range([h, 0]);

  g.append('g').attr('class', 'grid').call(d3.axisLeft(y).tickSize(-w).tickFormat('').ticks(6));
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).ticks(10))
    .append('text').attr('x', w / 2).attr('y', 38).attr('fill', '#555').attr('text-anchor', 'middle').style('font-size', '0.8rem').text('Days');
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(6).tickFormat(d3.format('.2s')));

  // Fill areas
  const area = d3.area().x(d => x(d.t)).y0(h).y1(d => y(d.y[iIdx])).curve(d3.curveBasis);
  g.append('path').datum(noVaxData).attr('d', area).attr('fill', '#ef4444').attr('opacity', 0.12);
  g.append('path').datum(vaxData).attr('d', area).attr('fill', '#34d399').attr('opacity', 0.12);

  // Lines
  const line = d3.line().x(d => x(d.t)).y(d => y(d.y[iIdx])).curve(d3.curveBasis);
  g.append('path').datum(noVaxData).attr('class', 'compare-novax').attr('d', line);
  g.append('path').datum(vaxData).attr('class', 'compare-vax').attr('d', line);

  // Annotations
  const noVaxPeak = d3.max(noVaxData, d => d.y[iIdx]);
  const vaxPeak = d3.max(vaxData, d => d.y[iIdx]);
  const noVaxPeakT = noVaxData.find(d => d.y[iIdx] === noVaxPeak)?.t || 0;
  const vaxPeakT = vaxData.find(d => d.y[iIdx] === vaxPeak)?.t || 0;

  if (noVaxPeak > 0) {
    g.append('text').attr('x', x(noVaxPeakT)).attr('y', y(noVaxPeak) - 10)
      .attr('text-anchor', 'middle').style('font-size', '0.75rem').attr('fill', '#ef4444')
      .style('font-family', 'var(--font-heading)').style('font-weight', '600').text('No Vaccination');
  }
  if (vaxPeak > N * 0.001) {
    g.append('text').attr('x', x(vaxPeakT)).attr('y', y(vaxPeak) - 10)
      .attr('text-anchor', 'middle').style('font-size', '0.75rem').attr('fill', '#059669')
      .style('font-family', 'var(--font-heading)').style('font-weight', '600').text('With Vaccination');
  }

  // Legend
  const legend = svg.append('g').attr('transform', `translate(${width - margin.right + 15}, ${margin.top})`);
  [{ color: '#ef4444', label: 'No Vaccine' }, { color: '#34d399', label: 'With Vaccine' }].forEach((item, i) => {
    const row = legend.append('g').attr('transform', `translate(0, ${i * 22})`);
    row.append('rect').attr('width', 14).attr('height', 3).attr('y', 5).attr('rx', 1.5).attr('fill', item.color);
    row.append('text').attr('x', 20).attr('y', 10).attr('class', 'chart-legend').attr('fill', '#555').text(item.label);
  });
}

function updateOutbreakMetrics(withVax, noVax, d, N, vaxCov, vaxEff, overrides) {
  const r0 = overrides.r0 || d.r0;
  const reff = r0 * (1 - vaxCov * vaxEff);
  const herd = Math.max(0, (1 - 1 / r0) * 100);

  document.getElementById('vpd-r0').textContent = r0.toFixed(1);
  document.getElementById('vpd-reff').textContent = reff.toFixed(2);
  document.getElementById('vpd-herd').textContent = herd.toFixed(0) + '%';

  const iIdx = 2, rIdx = 3, dIdx = 4;
  const vaxLast = withVax.data[withVax.data.length - 1];
  const noVaxLast = noVax.data[noVax.data.length - 1];

  const vaxPeak = d3.max(withVax.data, d => d.y[iIdx]);
  const vaxTotal = vaxLast.y[rIdx] + vaxLast.y[dIdx];
  const vaxDeaths = vaxLast.y[dIdx];

  const noVaxTotal = noVaxLast.y[rIdx] + noVaxLast.y[dIdx];
  const noVaxDeaths = noVaxLast.y[dIdx];

  document.getElementById('vpd-peak').textContent = Math.round(vaxPeak).toLocaleString();
  document.getElementById('vpd-total').textContent = Math.round(vaxTotal).toLocaleString();
  document.getElementById('vpd-deaths').textContent = Math.round(vaxDeaths).toLocaleString();
  document.getElementById('vpd-saved').textContent = Math.round(noVaxDeaths - vaxDeaths).toLocaleString();
}

function updateDiseaseInfo(diseaseKey) {
  const d = DISEASES[diseaseKey];
  const container = document.getElementById('disease-info-content');
  if (!container) return;

  container.innerHTML = `
    <div class="info-desc">${d.description}</div>
    <div><span class="info-label">R₀:</span></div><div><span class="info-value">${d.r0} (${d.r0Range[0]}-${d.r0Range[1]})</span></div>
    <div><span class="info-label">Incubation:</span></div><div><span class="info-value">${d.incubationDays} days</span></div>
    <div><span class="info-label">Infectious:</span></div><div><span class="info-value">${d.infectiousDays} days</span></div>
    <div><span class="info-label">CFR (pre-vax):</span></div><div><span class="info-value">${(d.cfrPreVaccine * 100).toFixed(2)}%</span></div>
    <div><span class="info-label">Vaccine Efficacy:</span></div><div><span class="info-value">${(d.vaccineEfficacy * 100).toFixed(0)}%</span></div>
    <div><span class="info-label">US Vax Rate:</span></div><div><span class="info-value">${(d.usVaxRate * 100).toFixed(0)}%</span></div>
    <div><span class="info-label">Pre-vax Cases/yr:</span></div><div><span class="info-value">${d.preVaxAnnualCases.toLocaleString()}</span></div>
    <div><span class="info-label">Current Cases/yr:</span></div><div><span class="info-value">${d.currentAnnualCases.toLocaleString()}</span></div>
    <div><span class="info-label">Vaccine Year:</span></div><div><span class="info-value">${d.vaccineYear}</span></div>
    <div><span class="info-label">Herd Immunity:</span></div><div><span class="info-value">${d.r0 > 0 ? (d.herdImmunity * 100).toFixed(0) + '%' : 'N/A'}</span></div>
    <div><span class="info-label">Communicable:</span></div><div><span class="info-value">${d.communicable ? 'Yes' : 'No (environmental)'}</span></div>
  `;
}

/* ============================================================
   SECTION 5: Tab 2 — Disease Comparison Dashboard
   ============================================================ */
function runComparison() {
  const sortBy = document.getElementById('comp-sort').value;
  const bubbleY = document.getElementById('comp-bubble-y').value;

  const entries = Object.entries(DISEASES)
    .filter(([, d]) => d.communicable)
    .map(([key, d]) => ({ key, ...d }));

  // Sort
  switch (sortBy) {
    case 'r0': entries.sort((a, b) => b.r0 - a.r0); break;
    case 'cfr': entries.sort((a, b) => b.cfrPreVaccine - a.cfrPreVaccine); break;
    case 'cases': entries.sort((a, b) => b.preVaxAnnualCases - a.preVaxAnnualCases); break;
    case 'alpha': entries.sort((a, b) => a.label.localeCompare(b.label)); break;
  }

  drawR0BarChart(entries);
  drawCFRBarChart(entries);
  drawBubbleChart(entries, bubbleY);
  drawHerdBarChart(entries);
  populateRefTable();
}

function drawR0BarChart(entries) {
  const container = document.getElementById('r0-bar-chart');
  if (!container) return;
  container.innerHTML = '';

  const width = container.clientWidth || 700;
  const barH = 24;
  const height = entries.length * (barH + 6) + margin.top + margin.bottom;
  const mLeft = 200;

  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${mLeft},${margin.top})`);
  const w = width - mLeft - margin.right;

  const x = d3.scaleLinear().domain([0, d3.max(entries, d => d.r0) * 1.1]).range([0, w]);
  const y = d3.scaleBand().domain(entries.map(d => d.label)).range([0, entries.length * (barH + 6)]).padding(0.15);

  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).tickSize(0)).select('.domain').remove();
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${entries.length * (barH + 6)})`).call(d3.axisBottom(x).ticks(6));

  const colorScale = d3.scaleSequential(d3.interpolateOrRd).domain([0, d3.max(entries, d => d.r0)]);

  g.selectAll('.r0-bar').data(entries).enter().append('rect')
    .attr('x', 0).attr('y', d => y(d.label))
    .attr('width', d => x(d.r0)).attr('height', y.bandwidth())
    .attr('fill', d => colorScale(d.r0)).attr('rx', 3).attr('opacity', 0.85);

  // R0 range whiskers
  g.selectAll('.r0-range').data(entries).enter().append('line')
    .attr('x1', d => x(d.r0Range[0])).attr('x2', d => x(d.r0Range[1]))
    .attr('y1', d => y(d.label) + y.bandwidth() / 2)
    .attr('y2', d => y(d.label) + y.bandwidth() / 2)
    .attr('stroke', '#1e293b').attr('stroke-width', 1.5);

  // Value labels
  g.selectAll('.r0-val').data(entries).enter().append('text')
    .attr('x', d => x(d.r0) + 5).attr('y', d => y(d.label) + y.bandwidth() / 2 + 4)
    .attr('class', 'bar-value').text(d => d.r0.toFixed(1));
}

function drawCFRBarChart(entries) {
  const container = document.getElementById('cfr-bar-chart');
  if (!container) return;
  container.innerHTML = '';

  const sorted = [...entries].sort((a, b) => b.cfrPreVaccine - a.cfrPreVaccine);
  const width = container.clientWidth || 700;
  const barH = 24;
  const height = sorted.length * (barH + 6) + margin.top + margin.bottom;
  const mLeft = 200;

  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${mLeft},${margin.top})`);
  const w = width - mLeft - margin.right;

  const x = d3.scaleLinear().domain([0, d3.max(sorted, d => d.cfrPreVaccine) * 100 * 1.1]).range([0, w]);
  const y = d3.scaleBand().domain(sorted.map(d => d.label)).range([0, sorted.length * (barH + 6)]).padding(0.15);

  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).tickSize(0)).select('.domain').remove();
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${sorted.length * (barH + 6)})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d => d + '%'));

  const colorScale = d3.scaleSequential(d3.interpolateReds).domain([0, d3.max(sorted, d => d.cfrPreVaccine) * 100]);

  g.selectAll('.cfr-bar').data(sorted).enter().append('rect')
    .attr('x', 0).attr('y', d => y(d.label))
    .attr('width', d => Math.max(2, x(d.cfrPreVaccine * 100))).attr('height', y.bandwidth())
    .attr('fill', d => colorScale(d.cfrPreVaccine * 100)).attr('rx', 3).attr('opacity', 0.85);

  g.selectAll('.cfr-val').data(sorted).enter().append('text')
    .attr('x', d => x(d.cfrPreVaccine * 100) + 5).attr('y', d => y(d.label) + y.bandwidth() / 2 + 4)
    .attr('class', 'bar-value').text(d => (d.cfrPreVaccine * 100).toFixed(2) + '%');
}

function drawBubbleChart(entries, yParam) {
  const container = document.getElementById('bubble-chart');
  if (!container) return;
  container.innerHTML = '';

  const width = container.clientWidth || 700;
  const height = 400;
  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${margin.left + 20},${margin.top})`);
  const w = width - margin.left - margin.right - 20;
  const h = height - margin.top - margin.bottom;

  const getY = d => {
    switch (yParam) {
      case 'cfr': return d.cfrPreVaccine * 100;
      case 'incubation': return d.incubationDays;
      case 'infectious': return d.infectiousDays;
      default: return d.cfrPreVaccine * 100;
    }
  };
  const yLabel = { cfr: 'Case Fatality Rate (%)', incubation: 'Incubation Period (days)', infectious: 'Infectious Period (days)' }[yParam];

  const x = d3.scaleLog().domain([1, d3.max(entries, d => d.r0) * 1.3]).range([0, w]).clamp(true);
  const yScale = d3.scaleLog().domain([Math.max(0.001, d3.min(entries, d => getY(d)) * 0.5), d3.max(entries, d => getY(d)) * 2]).range([h, 0]).clamp(true);
  const rScale = d3.scaleSqrt().domain([0, d3.max(entries, d => d.preVaxAnnualCases)]).range([4, 40]);

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).ticks(8).tickFormat(d3.format('.1f')))
    .append('text').attr('x', w / 2).attr('y', 38).attr('fill', '#555').attr('text-anchor', 'middle').style('font-size', '0.8rem').text('R₀');
  g.append('g').attr('class', 'axis').call(d3.axisLeft(yScale).ticks(6))
    .append('text').attr('transform', 'rotate(-90)').attr('x', -h / 2).attr('y', -55).attr('fill', '#555')
    .attr('text-anchor', 'middle').style('font-size', '0.8rem').text(yLabel);

  // Bubbles
  const tooltip = d3.select(container).append('div').attr('class', 'chart-tooltip').style('display', 'none');

  g.selectAll('.bubble-node').data(entries).enter().append('circle')
    .attr('class', 'bubble-node')
    .attr('cx', d => x(Math.max(1, d.r0)))
    .attr('cy', d => yScale(Math.max(0.001, getY(d))))
    .attr('r', d => rScale(d.preVaxAnnualCases))
    .attr('fill', (d, i) => COMPARISON_COLORS[i % COMPARISON_COLORS.length])
    .attr('opacity', 0.7)
    .on('mouseover', function(event, d) {
      tooltip.html(`<div class="tt-title">${d.label}</div>
        <div class="tt-row">R₀: <strong>${d.r0}</strong></div>
        <div class="tt-row">CFR: <strong>${(d.cfrPreVaccine * 100).toFixed(2)}%</strong></div>
        <div class="tt-row">Pre-vax cases: <strong>${d.preVaxAnnualCases.toLocaleString()}</strong></div>`)
        .style('display', 'block')
        .style('left', (event.offsetX + 15) + 'px')
        .style('top', (event.offsetY - 10) + 'px');
    })
    .on('mouseout', () => tooltip.style('display', 'none'));

  // Labels
  g.selectAll('.bubble-label').data(entries).enter().append('text')
    .attr('class', 'bubble-label')
    .attr('x', d => x(Math.max(1, d.r0)))
    .attr('y', d => yScale(Math.max(0.001, getY(d))) - rScale(d.preVaxAnnualCases) - 4)
    .attr('text-anchor', 'middle')
    .text(d => d.label.length > 15 ? d.label.slice(0, 12) + '...' : d.label);
}

function drawHerdBarChart(entries) {
  const container = document.getElementById('herd-bar-chart');
  if (!container) return;
  container.innerHTML = '';

  const sorted = [...entries].sort((a, b) => b.herdImmunity - a.herdImmunity);
  const width = container.clientWidth || 700;
  const barH = 20;
  const height = sorted.length * (barH + 8) + margin.top + margin.bottom;
  const mLeft = 200;

  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${mLeft},${margin.top})`);
  const w = width - mLeft - margin.right;

  const x = d3.scaleLinear().domain([0, 100]).range([0, w]);
  const y = d3.scaleBand().domain(sorted.map(d => d.label)).range([0, sorted.length * (barH + 8)]).padding(0.2);

  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).tickSize(0)).select('.domain').remove();
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${sorted.length * (barH + 8)})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d => d + '%'));

  // Herd immunity threshold bars (orange)
  g.selectAll('.herd-bar').data(sorted).enter().append('rect')
    .attr('x', 0).attr('y', d => y(d.label))
    .attr('width', d => x(d.herdImmunity * 100)).attr('height', y.bandwidth() / 2)
    .attr('fill', '#e97319').attr('rx', 2).attr('opacity', 0.75);

  // Current vax rate bars (blue)
  g.selectAll('.vax-bar').data(sorted).enter().append('rect')
    .attr('x', 0).attr('y', d => y(d.label) + y.bandwidth() / 2)
    .attr('width', d => x(d.usVaxRate * 100)).attr('height', y.bandwidth() / 2)
    .attr('fill', '#2563eb').attr('rx', 2).attr('opacity', 0.75);

  // Legend
  const legend = svg.append('g').attr('transform', `translate(${width - margin.right + 10}, ${margin.top})`);
  [{ color: '#e97319', label: 'HIT Required' }, { color: '#2563eb', label: 'Current Vax Rate' }].forEach((item, i) => {
    const row = legend.append('g').attr('transform', `translate(0, ${i * 20})`);
    row.append('rect').attr('width', 12).attr('height', 12).attr('rx', 2).attr('fill', item.color).attr('opacity', 0.75);
    row.append('text').attr('x', 18).attr('y', 10).attr('class', 'chart-legend').attr('fill', '#555').text(item.label);
  });
}

function populateRefTable() {
  const container = document.getElementById('ref-table-content');
  if (!container) return;
  let html = '<table><tr><td><strong>Disease</strong></td><td><strong>R₀</strong></td><td><strong>HIT</strong></td></tr>';
  Object.values(DISEASES).filter(d => d.communicable).sort((a, b) => b.r0 - a.r0).forEach(d => {
    html += `<tr><td>${d.label.length > 18 ? d.label.slice(0, 15) + '...' : d.label}</td><td>${d.r0}</td><td>${(d.herdImmunity * 100).toFixed(0)}%</td></tr>`;
  });
  html += '</table>';
  container.innerHTML = html;
}

/* ============================================================
   SECTION 6: Tab 3 — Vaccination Coverage Explorer
   ============================================================ */
function runCoverageAnalysis() {
  const diseaseKey = document.getElementById('cov-disease').value;
  const d = DISEASES[diseaseKey];
  const N = +document.getElementById('cov-pop-slider').value;
  const resolution = +document.getElementById('cov-res-slider').value;
  const drop = +document.getElementById('cov-drop-slider').value / 100;

  if (!d.communicable) return;

  // Sweep coverage 0-99%
  const sweepData = [];
  for (let i = 0; i <= resolution; i++) {
    const cov = i / resolution * 0.99;
    const result = runSEIRD(diseaseKey, N, 5, 365, cov, d.vaccineEfficacy);
    const last = result.data[result.data.length - 1];
    const totalCases = last.y[3] + last.y[4]; // R + D
    const deaths = last.y[4];
    sweepData.push({ coverage: cov, totalCases, deaths, reff: d.r0 * (1 - cov * d.vaccineEfficacy) });
  }

  drawCoverageSweep(sweepData, d, N);
  drawThresholdChart(d);
  drawMultiCoverageChart(drop, N);
  updateCoverageMetrics(d, sweepData, N);
}

function drawCoverageSweep(data, disease, N) {
  const container = document.getElementById('coverage-sweep');
  if (!container) return;
  container.innerHTML = '';

  const width = container.clientWidth || 700;
  const height = 340;
  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const x = d3.scaleLinear().domain([0, 1]).range([0, w]);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.totalCases) * 1.1]).range([h, 0]);

  g.append('g').attr('class', 'grid').call(d3.axisLeft(y).tickSize(-w).tickFormat('').ticks(6));
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(10).tickFormat(d => (d * 100).toFixed(0) + '%'))
    .append('text').attr('x', w / 2).attr('y', 38).attr('fill', '#555')
    .attr('text-anchor', 'middle').style('font-size', '0.8rem').text('Vaccination Coverage');
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(6).tickFormat(d3.format('.2s')));

  // Area under curve
  const area = d3.area().x(d => x(d.coverage)).y0(h).y1(d => y(d.totalCases)).curve(d3.curveBasis);
  g.append('path').datum(data).attr('d', area).attr('fill', '#ef4444').attr('opacity', 0.1);

  // Total cases line
  const line = d3.line().x(d => x(d.coverage)).y(d => y(d.totalCases)).curve(d3.curveBasis);
  g.append('path').datum(data).attr('fill', 'none').attr('stroke', '#ef4444').attr('stroke-width', 2.5).attr('d', line);

  // Deaths line
  const deathLine = d3.line().x(d => x(d.coverage)).y(d => y(d.deaths)).curve(d3.curveBasis);
  g.append('path').datum(data).attr('fill', 'none').attr('stroke', '#6b7280').attr('stroke-width', 2)
    .attr('stroke-dasharray', '6,3').attr('d', deathLine);

  // Herd immunity threshold
  const hit = disease.herdImmunity;
  if (hit > 0) {
    g.append('line').attr('class', 'herd-line')
      .attr('x1', x(hit)).attr('x2', x(hit)).attr('y1', 0).attr('y2', h);
    g.append('text').attr('x', x(hit) + 5).attr('y', 15)
      .style('font-size', '0.72rem').attr('fill', '#059669')
      .style('font-family', 'var(--font-heading)').style('font-weight', '600')
      .text(`HIT: ${(hit * 100).toFixed(0)}%`);
  }

  // Current US rate marker
  if (disease.usVaxRate > 0) {
    g.append('line').attr('x1', x(disease.usVaxRate)).attr('x2', x(disease.usVaxRate))
      .attr('y1', 0).attr('y2', h).attr('stroke', '#2563eb').attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,4');
    g.append('text').attr('x', x(disease.usVaxRate) - 5).attr('y', h - 5)
      .attr('text-anchor', 'end').style('font-size', '0.7rem').attr('fill', '#2563eb')
      .style('font-family', 'var(--font-heading)').text(`US: ${(disease.usVaxRate * 100).toFixed(0)}%`);
  }

  // Legend
  const legend = svg.append('g').attr('transform', `translate(${width - margin.right + 10}, ${margin.top})`);
  [{ color: '#ef4444', label: 'Total Cases', dash: '' },
   { color: '#6b7280', label: 'Deaths', dash: '6,3' },
   { color: '#059669', label: 'HIT', dash: '8,4' }].forEach((item, i) => {
    const row = legend.append('g').attr('transform', `translate(0, ${i * 20})`);
    row.append('line').attr('x1', 0).attr('x2', 14).attr('y1', 6).attr('y2', 6)
      .attr('stroke', item.color).attr('stroke-width', 2).attr('stroke-dasharray', item.dash);
    row.append('text').attr('x', 20).attr('y', 10).attr('class', 'chart-legend').attr('fill', '#555').text(item.label);
  });
}

function drawThresholdChart(disease) {
  const container = document.getElementById('threshold-chart');
  if (!container) return;
  container.innerHTML = '';

  const width = container.clientWidth || 700;
  const height = 280;
  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const data = [];
  for (let cov = 0; cov <= 1.0; cov += 0.01) {
    data.push({ coverage: cov, reff: disease.r0 * (1 - cov * disease.vaccineEfficacy) });
  }

  const x = d3.scaleLinear().domain([0, 1]).range([0, w]);
  const yMax = disease.r0 * 1.1;
  const y = d3.scaleLinear().domain([0, yMax]).range([h, 0]);

  g.append('g').attr('class', 'grid').call(d3.axisLeft(y).tickSize(-w).tickFormat('').ticks(5));
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(10).tickFormat(d => (d * 100).toFixed(0) + '%'))
    .append('text').attr('x', w / 2).attr('y', 38).attr('fill', '#555')
    .attr('text-anchor', 'middle').style('font-size', '0.8rem').text('Vaccination Coverage');
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(5));

  // Shaded area where Reff > 1 (epidemic zone)
  const epidemicData = data.filter(d => d.reff >= 1);
  if (epidemicData.length > 0) {
    const areaGen = d3.area().x(d => x(d.coverage)).y0(y(1)).y1(d => y(d.reff)).curve(d3.curveBasis);
    g.append('path').datum(epidemicData).attr('d', areaGen).attr('class', 'threshold-area');
  }

  // R_eff = 1 line
  g.append('line').attr('class', 'threshold-line')
    .attr('x1', 0).attr('x2', w).attr('y1', y(1)).attr('y2', y(1));
  g.append('text').attr('x', w - 5).attr('y', y(1) - 6).attr('text-anchor', 'end')
    .style('font-size', '0.72rem').attr('fill', '#dc2626')
    .style('font-family', 'var(--font-heading)').text('Reff = 1 (epidemic threshold)');

  // R_eff line
  const line = d3.line().x(d => x(d.coverage)).y(d => y(d.reff)).curve(d3.curveBasis);
  g.append('path').datum(data).attr('fill', 'none').attr('stroke', '#2563eb').attr('stroke-width', 2.5).attr('d', line);

  // HIT marker
  if (disease.herdImmunity > 0) {
    g.append('circle').attr('cx', x(disease.herdImmunity)).attr('cy', y(1)).attr('r', 6)
      .attr('fill', '#059669').attr('stroke', '#fff').attr('stroke-width', 2);
    g.append('text').attr('x', x(disease.herdImmunity)).attr('y', y(1) + 20)
      .attr('text-anchor', 'middle').style('font-size', '0.72rem').attr('fill', '#059669')
      .style('font-family', 'var(--font-heading)').style('font-weight', '600')
      .text(`HIT: ${(disease.herdImmunity * 100).toFixed(0)}%`);
  }
}

function drawMultiCoverageChart(drop, N) {
  const container = document.getElementById('multi-coverage');
  if (!container) return;
  container.innerHTML = '';

  const diseases = Object.entries(DISEASES)
    .filter(([, d]) => d.communicable && d.usVaxRate > 0)
    .map(([key, d]) => {
      const currentResult = runSEIRD(key, N, 5, 365, d.usVaxRate, d.vaccineEfficacy);
      const droppedResult = runSEIRD(key, N, 5, 365, Math.max(0, d.usVaxRate - drop), d.vaccineEfficacy);
      const currentLast = currentResult.data[currentResult.data.length - 1];
      const droppedLast = droppedResult.data[droppedResult.data.length - 1];
      return {
        label: d.label.length > 15 ? d.label.slice(0, 12) + '...' : d.label,
        fullLabel: d.label,
        currentCases: currentLast.y[3] + currentLast.y[4],
        droppedCases: droppedLast.y[3] + droppedLast.y[4],
      };
    })
    .filter(d => d.droppedCases > d.currentCases * 1.1)
    .sort((a, b) => (b.droppedCases - b.currentCases) - (a.droppedCases - a.currentCases))
    .slice(0, 10);

  if (diseases.length === 0) {
    container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--color-text-secondary);">Coverage drop too small to show significant impact.</p>';
    return;
  }

  const width = container.clientWidth || 700;
  const barH = 22;
  const height = diseases.length * (barH + 10) + margin.top + margin.bottom + 20;
  const mLeft = 160;

  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${mLeft},${margin.top})`);
  const w = width - mLeft - margin.right;

  const xMax = d3.max(diseases, d => d.droppedCases) * 1.1;
  const x = d3.scaleLinear().domain([0, xMax]).range([0, w]);
  const y = d3.scaleBand().domain(diseases.map(d => d.label)).range([0, diseases.length * (barH + 10)]).padding(0.2);

  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).tickSize(0)).select('.domain').remove();
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${diseases.length * (barH + 10)})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('.2s')));

  // Current coverage bars
  g.selectAll('.cur-bar').data(diseases).enter().append('rect')
    .attr('x', 0).attr('y', d => y(d.label))
    .attr('width', d => x(d.currentCases)).attr('height', y.bandwidth() / 2)
    .attr('fill', '#2563eb').attr('rx', 2).attr('opacity', 0.7);

  // Dropped coverage bars
  g.selectAll('.drop-bar').data(diseases).enter().append('rect')
    .attr('x', 0).attr('y', d => y(d.label) + y.bandwidth() / 2)
    .attr('width', d => x(d.droppedCases)).attr('height', y.bandwidth() / 2)
    .attr('fill', '#ef4444').attr('rx', 2).attr('opacity', 0.7);

  // Legend
  const legend = svg.append('g').attr('transform', `translate(${width - margin.right + 10}, ${margin.top})`);
  [{ color: '#2563eb', label: 'Current Rate' }, { color: '#ef4444', label: `−${(drop * 100).toFixed(0)}% Drop` }].forEach((item, i) => {
    const row = legend.append('g').attr('transform', `translate(0, ${i * 20})`);
    row.append('rect').attr('width', 12).attr('height', 12).attr('rx', 2).attr('fill', item.color).attr('opacity', 0.7);
    row.append('text').attr('x', 18).attr('y', 10).attr('class', 'chart-legend').attr('fill', '#555').text(item.label);
  });
}

function updateCoverageMetrics(d, sweepData, N) {
  const hit = d.herdImmunity;
  document.getElementById('cov-threshold').textContent = (hit * 100).toFixed(0) + '%';
  document.getElementById('cov-current').textContent = (d.usVaxRate * 100).toFixed(0) + '%';
  const safetyMargin = d.usVaxRate - hit;
  document.getElementById('cov-margin').textContent = (safetyMargin > 0 ? '+' : '') + (safetyMargin * 100).toFixed(1) + '%';

  // Find cases at 80% and 50%
  const at80 = sweepData.find(d => d.coverage >= 0.79 && d.coverage <= 0.81);
  const at50 = sweepData.find(d => d.coverage >= 0.49 && d.coverage <= 0.51);
  document.getElementById('cov-80').textContent = at80 ? Math.round(at80.totalCases).toLocaleString() : '—';
  document.getElementById('cov-50').textContent = at50 ? Math.round(at50.totalCases).toLocaleString() : '—';
}

/* ============================================================
   SECTION 7: Tab 4 — Historical Impact
   ============================================================ */
function runHistorical() {
  const sortBy = document.getElementById('hist-sort').value;
  const scale = document.getElementById('hist-scale').value;

  const entries = Object.entries(DISEASES).map(([key, d]) => ({
    key, ...d,
    reduction: d.preVaxAnnualCases > 0 ? ((d.preVaxAnnualCases - d.currentAnnualCases) / d.preVaxAnnualCases * 100) : 0,
    livesSaved: Math.round(d.preVaxAnnualDeaths * (1 - d.currentAnnualCases / Math.max(1, d.preVaxAnnualCases))),
  }));

  switch (sortBy) {
    case 'reduction': entries.sort((a, b) => b.reduction - a.reduction); break;
    case 'prevaccine': entries.sort((a, b) => b.preVaxAnnualCases - a.preVaxAnnualCases); break;
    case 'year': entries.sort((a, b) => a.vaccineYear - b.vaccineYear); break;
    case 'alpha': entries.sort((a, b) => a.label.localeCompare(b.label)); break;
  }

  drawHistoricalBar(entries, scale);
  drawLivesSaved(entries);
  drawTimeline(entries);
  updateHistoricalMetrics(entries);
}

function drawHistoricalBar(entries, scale) {
  const container = document.getElementById('historical-bar');
  if (!container) return;
  container.innerHTML = '';

  const width = container.clientWidth || 700;
  const barH = 20;
  const height = entries.length * (barH + 10) + margin.top + margin.bottom + 20;
  const mLeft = 200;

  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${mLeft},${margin.top})`);
  const w = width - mLeft - margin.right;

  const maxVal = d3.max(entries, d => d.preVaxAnnualCases);
  const x = scale === 'log'
    ? d3.scaleLog().domain([0.5, maxVal * 1.5]).range([0, w]).clamp(true)
    : d3.scaleLinear().domain([0, maxVal * 1.1]).range([0, w]);

  const y = d3.scaleBand().domain(entries.map(d => d.label)).range([0, entries.length * (barH + 10)]).padding(0.2);

  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).tickSize(0)).select('.domain').remove();
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${entries.length * (barH + 10)})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('.2s')));

  // Pre-vaccine bars
  g.selectAll('.pre-bar').data(entries).enter().append('rect')
    .attr('x', 0).attr('y', d => y(d.label))
    .attr('width', d => Math.max(2, x(Math.max(1, d.preVaxAnnualCases))))
    .attr('height', y.bandwidth() / 2)
    .attr('fill', '#ef4444').attr('rx', 2).attr('opacity', 0.75);

  // Current bars
  g.selectAll('.cur-bar').data(entries).enter().append('rect')
    .attr('x', 0).attr('y', d => y(d.label) + y.bandwidth() / 2)
    .attr('width', d => Math.max(1, x(Math.max(1, d.currentAnnualCases))))
    .attr('height', y.bandwidth() / 2)
    .attr('fill', '#2563eb').attr('rx', 2).attr('opacity', 0.75);

  // Reduction labels
  g.selectAll('.red-label').data(entries).enter().append('text')
    .attr('x', d => x(Math.max(1, d.preVaxAnnualCases)) + 5)
    .attr('y', d => y(d.label) + y.bandwidth() / 2 + 2)
    .attr('class', 'bar-value')
    .attr('fill', d => d.reduction > 95 ? '#059669' : '#555')
    .text(d => d.reduction > 0 ? `−${d.reduction.toFixed(1)}%` : '');

  // Legend
  const legend = svg.append('g').attr('transform', `translate(${width - margin.right + 10}, ${margin.top})`);
  [{ color: '#ef4444', label: 'Pre-vaccine' }, { color: '#2563eb', label: 'Current' }].forEach((item, i) => {
    const row = legend.append('g').attr('transform', `translate(0, ${i * 20})`);
    row.append('rect').attr('width', 12).attr('height', 12).attr('rx', 2).attr('fill', item.color).attr('opacity', 0.75);
    row.append('text').attr('x', 18).attr('y', 10).attr('class', 'chart-legend').attr('fill', '#555').text(item.label);
  });
}

function drawLivesSaved(entries) {
  const container = document.getElementById('lives-saved-chart');
  if (!container) return;
  container.innerHTML = '';

  const sorted = [...entries].filter(d => d.livesSaved > 0).sort((a, b) => b.livesSaved - a.livesSaved);
  if (sorted.length === 0) return;

  const width = container.clientWidth || 700;
  const height = 320;
  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${margin.left + 10},${margin.top})`);
  const w = width - margin.left - margin.right - 10;
  const h = height - margin.top - margin.bottom;

  const x = d3.scaleBand().domain(sorted.map(d => d.label)).range([0, w]).padding(0.2);
  const yMax = d3.max(sorted, d => d.livesSaved) * 1.1;
  const y = d3.scaleLinear().domain([0, yMax]).range([h, 0]);

  g.append('g').attr('class', 'grid').call(d3.axisLeft(y).tickSize(-w).tickFormat('').ticks(6));
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).tickSize(0))
    .selectAll('text').attr('transform', 'rotate(-45)').attr('text-anchor', 'end').style('font-size', '0.65rem');
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(6).tickFormat(d3.format(',')));

  g.selectAll('.saved-bar').data(sorted).enter().append('rect')
    .attr('x', d => x(d.label)).attr('y', d => y(d.livesSaved))
    .attr('width', x.bandwidth()).attr('height', d => h - y(d.livesSaved))
    .attr('fill', (d, i) => COMPARISON_COLORS[i % COMPARISON_COLORS.length])
    .attr('rx', 3).attr('opacity', 0.8);

  // Value labels
  g.selectAll('.saved-val').data(sorted).enter().append('text')
    .attr('x', d => x(d.label) + x.bandwidth() / 2)
    .attr('y', d => y(d.livesSaved) - 5)
    .attr('text-anchor', 'middle').style('font-size', '0.65rem').attr('fill', '#555')
    .text(d => d.livesSaved > 100 ? d3.format(',')(d.livesSaved) : d.livesSaved);
}

function drawTimeline(entries) {
  const container = document.getElementById('vaccine-timeline');
  if (!container) return;
  container.innerHTML = '';

  const sorted = [...entries].sort((a, b) => a.vaccineYear - b.vaccineYear);
  const width = container.clientWidth || 700;
  const height = 260;
  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const yearMin = d3.min(sorted, d => d.vaccineYear) - 10;
  const yearMax = 2025;
  const x = d3.scaleLinear().domain([yearMin, yearMax]).range([0, w]);

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h / 2})`)
    .call(d3.axisBottom(x).ticks(10).tickFormat(d3.format('d')));

  // Main timeline line
  g.append('line').attr('class', 'timeline-line')
    .attr('x1', 0).attr('x2', w).attr('y1', h / 2).attr('y2', h / 2);

  // Vaccine markers
  sorted.forEach((d, i) => {
    const cx = x(d.vaccineYear);
    const above = i % 2 === 0;
    const dy = above ? -30 - (i % 3) * 25 : 30 + (i % 3) * 25;

    g.append('line')
      .attr('x1', cx).attr('x2', cx)
      .attr('y1', h / 2).attr('y2', h / 2 + dy)
      .attr('stroke', '#cbd5e1').attr('stroke-width', 1);

    g.append('circle').attr('class', 'timeline-dot')
      .attr('cx', cx).attr('cy', h / 2).attr('r', 5);

    g.append('text').attr('class', 'timeline-label')
      .attr('x', cx).attr('y', h / 2 + dy + (above ? -5 : 15))
      .attr('text-anchor', 'middle')
      .text(d.label.length > 12 ? d.label.slice(0, 10) + '...' : d.label);

    g.append('text').attr('class', 'timeline-year')
      .attr('x', cx).attr('y', h / 2 + dy + (above ? -18 : 28))
      .attr('text-anchor', 'middle').text(d.vaccineYear);
  });
}

function updateHistoricalMetrics(entries) {
  const totalPre = d3.sum(entries, d => d.preVaxAnnualCases);
  const totalCur = d3.sum(entries, d => d.currentAnnualCases);
  const totalLives = d3.sum(entries, d => d.livesSaved);
  const reduction = totalPre > 0 ? ((totalPre - totalCur) / totalPre * 100).toFixed(1) : '0';

  document.getElementById('hist-pre-cases').textContent = totalPre.toLocaleString();
  document.getElementById('hist-cur-cases').textContent = totalCur.toLocaleString();
  document.getElementById('hist-reduction').textContent = reduction + '%';
  document.getElementById('hist-lives').textContent = totalLives.toLocaleString();
}

/* ============================================================
   SECTION 8: KaTeX Equation Rendering & Disease Table
   ============================================================ */
function renderEquations() {
  const eqEl = document.getElementById('vpd-equations');
  if (eqEl) {
    try {
      katex.render(String.raw`\frac{dS}{dt} = -\frac{\beta S I}{N}, \quad \frac{dE}{dt} = \frac{\beta S I}{N} - \sigma E, \quad \frac{dI}{dt} = \sigma E - \gamma I - \mu I, \quad \frac{dR}{dt} = \gamma I, \quad \frac{dD}{dt} = \mu I`,
        eqEl, { displayMode: true, throwOnError: false });
    } catch (_) { /* ignore */ }
  }
}

function renderLiteratureEquations() {
  const equations = {
    'lit-seird-eq': String.raw`\frac{dS}{dt} = -\frac{\beta S I}{N},\; \frac{dE}{dt} = \frac{\beta S I}{N} - \sigma E,\; \frac{dI}{dt} = \sigma E - (\gamma + \mu) I,\; \frac{dR}{dt} = \gamma I,\; \frac{dD}{dt} = \mu I`,
    'lit-hit-eq': String.raw`\text{HIT} = 1 - \frac{1}{R_0} \qquad \text{Coverage needed} = \frac{1 - 1/R_0}{\text{Vaccine Efficacy}}`,
    'lit-reff-eq': String.raw`R_{\text{eff}} = R_0 \times (1 - v \cdot e) \qquad \text{Epidemic if } R_{\text{eff}} > 1`,
  };

  for (const [id, eq] of Object.entries(equations)) {
    const el = document.getElementById(id);
    if (el) {
      try { katex.render(eq, el, { displayMode: true, throwOnError: false }); } catch (_) { /* ignore */ }
    }
  }
}

function populateFullDiseaseTable() {
  const tbody = document.getElementById('full-disease-tbody');
  if (!tbody) return;

  const sorted = Object.values(DISEASES).sort((a, b) => b.r0 - a.r0);
  tbody.innerHTML = sorted.map(d => `<tr>
    <td>${d.label}</td>
    <td>${d.r0 > 0 ? d.r0 + ' (' + d.r0Range[0] + '-' + d.r0Range[1] + ')' : 'N/A'}</td>
    <td>${d.incubationDays}</td>
    <td>${d.infectiousDays > 0 ? d.infectiousDays : 'N/A'}</td>
    <td>${(d.cfrPreVaccine * 100).toFixed(2)}</td>
    <td>${(d.vaccineEfficacy * 100).toFixed(0)}</td>
    <td>${(d.usVaxRate * 100).toFixed(0)}</td>
    <td>${d.preVaxAnnualCases.toLocaleString()}</td>
    <td>${d.currentAnnualCases.toLocaleString()}</td>
    <td>${d.vaccineYear}</td>
  </tr>`).join('');
}

/* ============================================================
   SECTION 9: Event Binding & Initialization
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
  // Outbreak controls
  document.getElementById('vpd-disease')?.addEventListener('change', (e) => {
    const d = DISEASES[e.target.value];
    if (!d) return;
    // Update defaults
    document.getElementById('vpd-vax-slider').value = d.usVaxRate * 100;
    document.getElementById('vpd-vax-display').textContent = (d.usVaxRate * 100).toFixed(0);
    document.getElementById('vpd-eff-slider').value = d.vaccineEfficacy * 100;
    document.getElementById('vpd-eff-display').textContent = (d.vaccineEfficacy * 100).toFixed(0);
    document.getElementById('vpd-current-rate').textContent = (d.usVaxRate * 100).toFixed(0);
    document.getElementById('vpd-default-eff').textContent = (d.vaccineEfficacy * 100).toFixed(0);

    // Override defaults
    document.getElementById('vpd-r0-slider').value = d.r0;
    document.getElementById('vpd-r0-display').textContent = d.r0.toFixed(1);
    document.getElementById('vpd-incub-slider').value = d.incubationDays;
    document.getElementById('vpd-incub-display').textContent = d.incubationDays;
    document.getElementById('vpd-infect-slider').value = d.infectiousDays;
    document.getElementById('vpd-infect-display').textContent = d.infectiousDays;
    document.getElementById('vpd-cfr-slider').value = d.cfrPreVaccine * 100;
    document.getElementById('vpd-cfr-display').textContent = (d.cfrPreVaccine * 100).toFixed(2);

    runOutbreak();
  });

  document.getElementById('vpd-override-toggle')?.addEventListener('change', (e) => {
    document.getElementById('override-params').style.display = e.target.checked ? 'block' : 'none';
  });

  const outbreakSliders = [
    ['vpd-vax-slider', 'vpd-vax-display'],
    ['vpd-eff-slider', 'vpd-eff-display'],
    ['vpd-pop-slider', 'vpd-pop-display', v => v.toLocaleString()],
    ['vpd-i0-slider', 'vpd-i0-display'],
    ['vpd-days-slider', 'vpd-days-display'],
    ['vpd-r0-slider', 'vpd-r0-display', v => v.toFixed(1)],
    ['vpd-incub-slider', 'vpd-incub-display'],
    ['vpd-infect-slider', 'vpd-infect-display'],
    ['vpd-cfr-slider', 'vpd-cfr-display', v => v.toFixed(2)],
  ];
  outbreakSliders.forEach(([sid, did, fmt]) => bindSliderDisplay(sid, did, fmt));

  document.getElementById('run-outbreak')?.addEventListener('click', runOutbreak);
  document.getElementById('reset-outbreak')?.addEventListener('click', () => {
    document.getElementById('vpd-disease').value = 'measles';
    document.getElementById('vpd-disease').dispatchEvent(new Event('change'));
  });

  // Comparison controls
  document.getElementById('run-comparison')?.addEventListener('click', runComparison);

  // Coverage controls
  const covSliders = [
    ['cov-pop-slider', 'cov-pop-display', v => v.toLocaleString()],
    ['cov-res-slider', 'cov-res-display'],
    ['cov-drop-slider', 'cov-drop-display'],
  ];
  covSliders.forEach(([sid, did, fmt]) => bindSliderDisplay(sid, did, fmt));
  document.getElementById('run-coverage')?.addEventListener('click', runCoverageAnalysis);

  // Historical controls
  document.getElementById('run-historical')?.addEventListener('click', runHistorical);
}

/* ============================================================
   SECTION 10: Bootstrap
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initControls();
  renderEquations();
  renderLiteratureEquations();
  populateFullDiseaseTable();

  // Run initial simulations
  runOutbreak();
  runComparison();
  runHistorical();
});
