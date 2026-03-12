/* ============================================================
   Module MQ-2 — Hospital Performance Funnel Plot
   ============================================================
   Interactive funnel plot for comparing institutional outcomes
   accounting for case volume, with caterpillar plot and volume
   distribution.
   ============================================================ */

import * as d3 from 'd3';

/* ---- Seedable xoshiro128** PRNG ----------------------------- */
function xoshiro128ss(a, b, c, d) {
  return function () {
    const t = b << 9;
    let r = b * 5;
    r = ((r << 7) | (r >>> 25)) * 9;
    c ^= a; d ^= b; b ^= c; a ^= d;
    c ^= t;
    d = (d << 11) | (d >>> 21);
    return (r >>> 0) / 4294967296;
  };
}

function createRNG(seed) {
  function sm(s) {
    s |= 0; s = s + 0x9e3779b9 | 0;
    let t = s ^ (s >>> 16); t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15); t = Math.imul(t, 0x735a2d97);
    return ((t ^ (t >>> 15)) >>> 0);
  }
  const s0 = sm(seed), s1 = sm(s0), s2 = sm(s1), s3 = sm(s2);
  return xoshiro128ss(s0, s1, s2, s3);
}

/* ---- Random variate helpers --------------------------------- */
function randNormal(rng) {
  // Box-Muller
  let u, v;
  do { u = rng(); } while (u === 0);
  v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function randLogNormal(rng, mu, sigma) {
  return Math.exp(mu + sigma * randNormal(rng));
}

function randBinomial(rng, n, p) {
  // For large n use normal approximation for speed
  if (n > 50) {
    const mu = n * p;
    const sigma = Math.sqrt(n * p * (1 - p));
    let val = Math.round(mu + sigma * randNormal(rng));
    return Math.max(0, Math.min(n, val));
  }
  let successes = 0;
  for (let i = 0; i < n; i++) {
    if (rng() < p) successes++;
  }
  return successes;
}

/* ---- Metric definitions ------------------------------------- */
const METRICS = {
  mortality: {
    label: 'Risk-Adjusted Mortality',
    rate: 0.035,
    volMin: 50, volMax: 2000,
    volMu: 5.5, volSigma: 0.8,
    randomEffectSD: 0.008,
    fmt: d => (d * 100).toFixed(2) + '%'
  },
  readmission: {
    label: '30-Day Readmission',
    rate: 0.155,
    volMin: 100, volMax: 3000,
    volMu: 6.0, volSigma: 0.7,
    randomEffectSD: 0.02,
    fmt: d => (d * 100).toFixed(1) + '%'
  },
  csection: {
    label: 'C-Section Rate',
    rate: 0.31,
    volMin: 200, volMax: 5000,
    volMu: 6.5, volSigma: 0.7,
    randomEffectSD: 0.04,
    fmt: d => (d * 100).toFixed(1) + '%'
  },
  ssi: {
    label: 'Surgical Site Infection',
    rate: 0.018,
    volMin: 100, volMax: 1500,
    volMu: 5.3, volSigma: 0.7,
    randomEffectSD: 0.005,
    fmt: d => (d * 100).toFixed(2) + '%'
  },
  sepsis: {
    label: 'Sepsis Mortality',
    rate: 0.18,
    volMin: 50, volMax: 800,
    volMu: 4.8, volSigma: 0.7,
    randomEffectSD: 0.03,
    fmt: d => (d * 100).toFixed(1) + '%'
  }
};

/* ---- Hospital name generator -------------------------------- */
const CITY_NAMES = [
  'Riverside', 'Lakewood', 'Springfield', 'Fairview', 'Madison',
  'Georgetown', 'Clinton', 'Franklin', 'Oakdale', 'Greenville',
  'Burlington', 'Chester', 'Dayton', 'Salem', 'Arlington',
  'Ashland', 'Bristol', 'Cambridge', 'Dover', 'Easton',
  'Fenton', 'Grafton', 'Hampton', 'Irving', 'Jackson',
  'Kingston', 'Lancaster', 'Milton', 'Newport', 'Oxford',
  'Preston', 'Quincy', 'Richmond', 'Sterling', 'Trenton',
  'Union', 'Vernon', 'Weston', 'York', 'Zenith',
  'Bayview', 'Cedar', 'Dunmore', 'Elmwood', 'Florence',
  'Glendale', 'Hartland', 'Irvington', 'Jefferson', 'Kensington',
  'Lincoln', 'Monroe', 'Northfield', 'Orchard', 'Plymouth',
  'Redmond', 'Sheldon', 'Thornton', 'Upton', 'Valencia',
  'Waverly', 'Lexington', 'Belmont', 'Concord', 'Deerfield',
  'Evergreen', 'Foxborough', 'Glenwood', 'Hillcrest', 'Ironwood',
  'Jasper', 'Kenwood', 'Linden', 'Maplewood', 'Norwood',
  'Oakwood', 'Parkview', 'Rosewood', 'Summit', 'Tidewater',
  'Upland', 'Vista', 'Windham', 'Yorktown', 'Auburn',
  'Briarwood', 'Creekside', 'Danbury', 'Edgewood', 'Fairmont',
  'Granville', 'Haverford', 'Ivy', 'Jamestown', 'Kent',
  'Longview', 'Meridian', 'New Haven', 'Orion', 'Piedmont'
];

const SUFFIXES = [
  'General Hospital', 'Medical Center', 'Community Hospital',
  'Regional Medical Center', 'Memorial Hospital', 'Health System',
  'University Hospital', 'St. Mary\'s Hospital', 'Veterans Medical Center',
  'Children\'s Hospital'
];

function generateHospitalNames(n, rng) {
  const names = [];
  const used = new Set();
  for (let i = 0; i < n; i++) {
    let name;
    let attempts = 0;
    do {
      const city = CITY_NAMES[Math.floor(rng() * CITY_NAMES.length)];
      const suffix = SUFFIXES[Math.floor(rng() * SUFFIXES.length)];
      name = `${city} ${suffix}`;
      attempts++;
      if (attempts > 50) {
        name = `Hospital ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ''}`;
        break;
      }
    } while (used.has(name));
    used.add(name);
    names.push(name);
  }
  return names;
}

/* ---- CI z-values -------------------------------------------- */
const CI_CONFIG = {
  '95-998': [
    { level: '95%', z: 1.96, bandClass: 'funnel-band-95', lineClass: 'funnel-limit funnel-limit-95' },
    { level: '99.8%', z: 3.09, bandClass: 'funnel-band-998', lineClass: 'funnel-limit funnel-limit-998' }
  ],
  '95': [
    { level: '95%', z: 1.96, bandClass: 'funnel-band-95', lineClass: 'funnel-limit funnel-limit-95' }
  ],
  '998': [
    { level: '99.8%', z: 3.09, bandClass: 'funnel-band-998', lineClass: 'funnel-limit funnel-limit-998' }
  ],
  '90-99': [
    { level: '90%', z: 1.645, bandClass: 'funnel-band-95', lineClass: 'funnel-limit funnel-limit-95' },
    { level: '99%', z: 2.576, bandClass: 'funnel-band-998', lineClass: 'funnel-limit funnel-limit-998' }
  ]
};

/* ---- Data generation ---------------------------------------- */
function generateData(metricKey, numHospitals, rng) {
  const m = METRICS[metricKey];
  const names = generateHospitalNames(numHospitals, rng);

  const hospitals = names.map((name, i) => {
    // Log-normal volume, clamped to metric range
    let vol = Math.round(randLogNormal(rng, m.volMu, m.volSigma));
    vol = Math.max(m.volMin, Math.min(m.volMax, vol));

    // Hospital-specific rate with random effect
    let pHosp = m.rate + m.randomEffectSD * randNormal(rng);
    // Occasionally create true outliers (~5% chance)
    if (rng() < 0.03) pHosp += m.randomEffectSD * 4 * (rng() > 0.5 ? 1 : -1);
    if (rng() < 0.02) pHosp += m.randomEffectSD * 6;
    pHosp = Math.max(0.001, Math.min(0.999, pHosp));

    const events = randBinomial(rng, vol, pHosp);
    const obsRate = events / vol;

    return {
      id: i,
      name,
      volume: vol,
      events,
      obsRate,
      expectedRate: m.rate
    };
  });

  return hospitals;
}

/* ---- Classification ----------------------------------------- */
function classifyHospitals(hospitals, p, ciLevels, phi) {
  const sqrtPhi = Math.sqrt(phi);
  // Use the outermost CI for outlier classification, and inner for alert
  const sorted = [...ciLevels].sort((a, b) => a.z - b.z);
  const inner = sorted[0];
  const outer = sorted.length > 1 ? sorted[sorted.length - 1] : inner;

  return hospitals.map(h => {
    const se = sqrtPhi * Math.sqrt(p * (1 - p) / h.volume);
    const innerUpper = p + inner.z * se;
    const innerLower = p - inner.z * se;
    const outerUpper = p + outer.z * se;
    const outerLower = p - outer.z * se;

    // 95% CI for this hospital (for tooltip)
    const hospSE = Math.sqrt(h.obsRate * (1 - h.obsRate) / h.volume) || 0;
    const ci95Lower = Math.max(0, h.obsRate - 1.96 * hospSE);
    const ci95Upper = h.obsRate + 1.96 * hospSE;

    let status;
    if (h.obsRate > outerUpper) status = 'outlier-high';
    else if (h.obsRate < outerLower) status = 'outlier-low';
    else if (h.obsRate > innerUpper || h.obsRate < innerLower) status = 'alert';
    else status = 'within';

    return { ...h, status, ci95Lower, ci95Upper, funnelSE: se };
  });
}

/* ---- Estimate overdispersion phi ---------------------------- */
function estimatePhi(hospitals, p) {
  const n = hospitals.length;
  if (n < 2) return 1;
  // Method of moments: phi = (1/(K-1)) * sum( (o_i - e_i)^2 / (e_i * (1-p/1)) )
  // Simplified: winsorized Pearson chi-squared / df
  let chiSq = 0;
  for (const h of hospitals) {
    const expected = p;
    const variance = p * (1 - p) / h.volume;
    if (variance > 0) {
      chiSq += (h.obsRate - expected) ** 2 / variance;
    }
  }
  const phi = chiSq / (n - 1);
  return Math.max(1, phi); // phi >= 1
}

/* ---- Tooltip ------------------------------------------------ */
let tooltip;
function ensureTooltip() {
  if (!tooltip) {
    tooltip = d3.select('body').append('div')
      .attr('class', 'hospital-tooltip');
  }
  return tooltip;
}

function showTooltip(event, h, metric) {
  const tt = ensureTooltip();
  const m = METRICS[metric];
  tt.html(`
    <div class="tt-name">${h.name}</div>
    <div class="tt-detail">
      Volume: ${h.volume.toLocaleString()}<br/>
      Observed: ${m.fmt(h.obsRate)}<br/>
      Expected: ${m.fmt(h.expectedRate)}<br/>
      95% CI: [${m.fmt(h.ci95Lower)}, ${m.fmt(h.ci95Upper)}]
    </div>
  `);
  tt.classed('visible', true)
    .style('left', (event.pageX + 12) + 'px')
    .style('top', (event.pageY - 28) + 'px');
}

function hideTooltip() {
  const tt = ensureTooltip();
  tt.classed('visible', false);
}

/* ============================================================
   MAIN VISUALIZATION
   ============================================================ */

// State
let state = {
  metric: 'mortality',
  numHospitals: 80,
  ciLevel: '95-998',
  showLabels: false,
  showTarget: true,
  overdispersion: false,
  seed: 42,
  hospitals: [],
  classified: []
};

/* ---- Dimensions --------------------------------------------- */
const FUNNEL = { w: 960, h: 500, mt: 40, mr: 30, mb: 50, ml: 65 };
const CATER  = { w: 480, h: 350, mt: 30, mr: 20, mb: 40, ml: 150 };
const VOL    = { w: 480, h: 350, mt: 30, mr: 20, mb: 40, ml: 55 };

/* ---- Build / update ----------------------------------------- */
function buildAll() {
  const rng = createRNG(state.seed);
  state.hospitals = generateData(state.metric, state.numHospitals, rng);

  const m = METRICS[state.metric];
  const ciLevels = CI_CONFIG[state.ciLevel];
  const phi = state.overdispersion ? estimatePhi(state.hospitals, m.rate) : 1;
  state.classified = classifyHospitals(state.hospitals, m.rate, ciLevels, phi);

  drawFunnel(state.classified, m, ciLevels, phi);
  drawCaterpillar(state.classified, m);
  drawVolume(state.classified);
  updateStats(state.classified, m);
  updateLegend(ciLevels);
}

/* ---- Funnel Plot -------------------------------------------- */
function drawFunnel(data, metric, ciLevels, phi) {
  const container = d3.select('#funnel-chart');
  container.selectAll('*').remove();

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${FUNNEL.w} ${FUNNEL.h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%');

  const iw = FUNNEL.w - FUNNEL.ml - FUNNEL.mr;
  const ih = FUNNEL.h - FUNNEL.mt - FUNNEL.mb;
  const g = svg.append('g').attr('transform', `translate(${FUNNEL.ml},${FUNNEL.mt})`);

  const p = metric.rate;
  const sqrtPhi = Math.sqrt(phi);

  // Scales
  const xExtent = d3.extent(data, d => d.volume);
  const xScale = d3.scaleLinear()
    .domain([0, xExtent[1] * 1.05])
    .range([0, iw]);

  // y range: compute from outermost funnel
  const outerZ = Math.max(...ciLevels.map(c => c.z));
  const minVol = Math.max(1, d3.min(data, d => d.volume));
  const maxSE = sqrtPhi * Math.sqrt(p * (1 - p) / minVol);
  const yPad = outerZ * maxSE * 1.2;
  const yMin = Math.max(0, p - yPad);
  const yMax = Math.min(1, p + yPad);
  // Also account for data extremes
  const dataMin = d3.min(data, d => d.obsRate);
  const dataMax = d3.max(data, d => d.obsRate);
  const finalYMin = Math.max(0, Math.min(yMin, dataMin * 0.9));
  const finalYMax = Math.min(1, Math.max(yMax, dataMax * 1.1));

  const yScale = d3.scaleLinear()
    .domain([finalYMin, finalYMax])
    .range([ih, 0]);

  // Generate funnel curves (smooth, from xExtent[1] down to small volume)
  const nPoints = 200;
  const volRange = d3.range(nPoints).map(i => {
    const t = i / (nPoints - 1);
    return Math.max(5, xExtent[1] * 1.05 * (1 - t) + 5 * t);
  }).sort((a, b) => a - b);

  // Draw funnel bands (filled areas) -- outermost first
  const sortedCI = [...ciLevels].sort((a, b) => b.z - a.z);

  for (const ci of sortedCI) {
    const upperPoints = volRange.map(n => ({
      x: xScale(n),
      y: yScale(Math.min(1, p + ci.z * sqrtPhi * Math.sqrt(p * (1 - p) / n)))
    }));
    const lowerPoints = volRange.map(n => ({
      x: xScale(n),
      y: yScale(Math.max(0, p - ci.z * sqrtPhi * Math.sqrt(p * (1 - p) / n)))
    }));

    const areaPath = d3.area()
      .x(d => d.x)
      .y0((d, i) => lowerPoints[i].y)
      .y1(d => d.y);

    g.append('path')
      .datum(upperPoints)
      .attr('class', ci.bandClass)
      .attr('d', areaPath);
  }

  // Draw funnel limit lines
  for (const ci of ciLevels) {
    const upperLine = volRange.map(n => [
      xScale(n),
      yScale(Math.min(1, p + ci.z * sqrtPhi * Math.sqrt(p * (1 - p) / n)))
    ]);
    const lowerLine = volRange.map(n => [
      xScale(n),
      yScale(Math.max(0, p - ci.z * sqrtPhi * Math.sqrt(p * (1 - p) / n)))
    ]);

    const line = d3.line().x(d => d[0]).y(d => d[1]);

    g.append('path')
      .attr('class', ci.lineClass)
      .attr('d', line(upperLine));
    g.append('path')
      .attr('class', ci.lineClass)
      .attr('d', line(lowerLine));
  }

  // Target line
  if (state.showTarget) {
    g.append('line')
      .attr('class', 'target-line')
      .attr('x1', 0).attr('x2', iw)
      .attr('y1', yScale(p)).attr('y2', yScale(p));
  }

  // Hospital dots
  g.selectAll('.hospital-dot')
    .data(data)
    .join('circle')
    .attr('class', d => `hospital-dot ${d.status}`)
    .attr('cx', d => xScale(d.volume))
    .attr('cy', d => yScale(d.obsRate))
    .on('mouseenter', (event, d) => showTooltip(event, d, state.metric))
    .on('mousemove', (event, d) => showTooltip(event, d, state.metric))
    .on('mouseleave', hideTooltip);

  // Outlier labels
  if (state.showLabels) {
    const outliers = data.filter(d => d.status !== 'within');
    g.selectAll('.hospital-label')
      .data(outliers)
      .join('text')
      .attr('class', 'hospital-label')
      .attr('x', d => xScale(d.volume) + 6)
      .attr('y', d => yScale(d.obsRate) - 6)
      .text(d => {
        // Abbreviate name
        const parts = d.name.split(' ');
        return parts.length > 2 ? parts.slice(0, 2).join(' ') : d.name;
      });
  }

  // Axes
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(xScale).ticks(8).tickFormat(d3.format(',')));

  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(8).tickFormat(d => (d * 100).toFixed(1) + '%'));

  // Axis labels
  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', iw / 2).attr('y', ih + 38)
    .attr('text-anchor', 'middle')
    .text('Case Volume (number of cases)');

  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -ih / 2).attr('y', -50)
    .attr('text-anchor', 'middle')
    .text('Observed Rate');
}

/* ---- Legend -------------------------------------------------- */
function updateLegend(ciLevels) {
  const legend = d3.select('#funnel-legend');
  legend.selectAll('*').remove();

  const items = [
    { color: 'var(--color-primary)', label: 'Within limits', opacity: 0.7 },
    { color: '#f59e0b', label: 'Alert (between CI levels)', opacity: 1 },
    { color: 'var(--color-error)', label: 'High outlier', opacity: 1 },
    { color: 'var(--color-accent)', label: 'Low outlier (better)', opacity: 1 }
  ];

  const container = legend.append('div')
    .style('display', 'flex')
    .style('gap', '1.2rem')
    .style('flex-wrap', 'wrap')
    .style('justify-content', 'center')
    .style('font-size', '0.8rem');

  items.forEach(item => {
    const el = container.append('span')
      .style('display', 'inline-flex')
      .style('align-items', 'center')
      .style('gap', '0.3rem');
    el.append('span')
      .style('display', 'inline-block')
      .style('width', '10px')
      .style('height', '10px')
      .style('border-radius', '50%')
      .style('background', item.color)
      .style('opacity', item.opacity);
    el.append('span').text(item.label);
  });

  // Add CI level info
  const ciText = ciLevels.map(c => c.level).join(' & ');
  container.append('span')
    .style('color', 'var(--color-text-secondary)')
    .text(`| Limits: ${ciText}`);
}

/* ---- Caterpillar Plot --------------------------------------- */
function drawCaterpillar(data, metric) {
  const container = d3.select('#caterpillar-chart');
  container.selectAll('*').remove();

  // Sort by observed rate
  const sorted = [...data].sort((a, b) => a.obsRate - b.obsRate);

  // Adjust height for number of hospitals
  const barH = Math.max(4, Math.min(12, 300 / sorted.length));
  const dynH = Math.max(CATER.h, sorted.length * barH + CATER.mt + CATER.mb);

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${CATER.w} ${dynH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%');

  const iw = CATER.w - CATER.ml - CATER.mr;
  const ih = dynH - CATER.mt - CATER.mb;
  const g = svg.append('g').attr('transform', `translate(${CATER.ml},${CATER.mt})`);

  const p = metric.rate;

  // Scales
  const allRates = sorted.flatMap(d => [d.ci95Lower, d.ci95Upper, d.obsRate]);
  const xMin = Math.max(0, d3.min(allRates) * 0.9);
  const xMax = Math.min(1, d3.max(allRates) * 1.1);
  const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, iw]);

  const yScale = d3.scaleBand()
    .domain(sorted.map((_, i) => i))
    .range([0, ih])
    .padding(0.3);

  // Reference line
  g.append('line')
    .attr('class', 'reference-line')
    .attr('x1', xScale(p)).attr('x2', xScale(p))
    .attr('y1', 0).attr('y2', ih);

  // CI lines
  g.selectAll('.ci-line')
    .data(sorted)
    .join('line')
    .attr('class', d => `ci-line`)
    .attr('stroke', d => {
      if (d.status === 'outlier-high') return 'var(--color-error)';
      if (d.status === 'outlier-low') return 'var(--color-accent)';
      if (d.status === 'alert') return '#f59e0b';
      return 'var(--color-primary)';
    })
    .attr('x1', d => xScale(d.ci95Lower))
    .attr('x2', d => xScale(d.ci95Upper))
    .attr('y1', (_, i) => yScale(i) + yScale.bandwidth() / 2)
    .attr('y2', (_, i) => yScale(i) + yScale.bandwidth() / 2);

  // Dots
  g.selectAll('.cat-dot')
    .data(sorted)
    .join('circle')
    .attr('class', d => `cat-dot ${d.status}`)
    .attr('fill', d => {
      if (d.status === 'outlier-high') return 'var(--color-error)';
      if (d.status === 'outlier-low') return 'var(--color-accent)';
      if (d.status === 'alert') return '#f59e0b';
      return 'var(--color-primary)';
    })
    .attr('cx', d => xScale(d.obsRate))
    .attr('cy', (_, i) => yScale(i) + yScale.bandwidth() / 2)
    .on('mouseenter', (event, d) => showTooltip(event, d, state.metric))
    .on('mousemove', (event, d) => showTooltip(event, d, state.metric))
    .on('mouseleave', hideTooltip);

  // Hospital name labels (abbreviated, only show subset if too many)
  const maxLabels = Math.floor(ih / 10);
  const step = Math.max(1, Math.ceil(sorted.length / maxLabels));

  g.selectAll('.cat-label')
    .data(sorted.filter((_, i) => i % step === 0))
    .join('text')
    .attr('class', 'axis-label')
    .attr('x', -4)
    .attr('y', (d) => {
      const idx = sorted.indexOf(d);
      return yScale(idx) + yScale.bandwidth() / 2;
    })
    .attr('dy', '0.35em')
    .attr('text-anchor', 'end')
    .style('font-size', '8px')
    .text(d => {
      const parts = d.name.split(' ');
      return parts.length > 2 ? parts.slice(0, 2).join(' ') : d.name;
    });

  // X axis
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => (d * 100).toFixed(1) + '%'));

  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', iw / 2).attr('y', ih + 32)
    .attr('text-anchor', 'middle')
    .text('Observed Rate');
}

/* ---- Volume Histogram --------------------------------------- */
function drawVolume(data) {
  const container = d3.select('#volume-chart');
  container.selectAll('*').remove();

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${VOL.w} ${VOL.h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%');

  const iw = VOL.w - VOL.ml - VOL.mr;
  const ih = VOL.h - VOL.mt - VOL.mb;
  const g = svg.append('g').attr('transform', `translate(${VOL.ml},${VOL.mt})`);

  const volumes = data.map(d => d.volume);
  const xScale = d3.scaleLinear()
    .domain([0, d3.max(volumes) * 1.05])
    .range([0, iw]);

  const histogram = d3.bin()
    .domain(xScale.domain())
    .thresholds(xScale.ticks(20));

  const bins = histogram(volumes);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(bins, d => d.length)])
    .nice()
    .range([ih, 0]);

  g.selectAll('.vol-bar')
    .data(bins)
    .join('rect')
    .attr('class', 'vol-bar')
    .attr('x', d => xScale(d.x0) + 1)
    .attr('y', d => yScale(d.length))
    .attr('width', d => Math.max(0, xScale(d.x1) - xScale(d.x0) - 2))
    .attr('height', d => ih - yScale(d.length));

  // Axes
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.format(',')));

  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(5));

  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', iw / 2).attr('y', ih + 34)
    .attr('text-anchor', 'middle')
    .text('Case Volume');

  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -ih / 2).attr('y', -40)
    .attr('text-anchor', 'middle')
    .text('Count');
}

/* ---- Stats cards -------------------------------------------- */
function updateStats(data, metric) {
  const highOutliers = data.filter(d => d.status === 'outlier-high').length;
  const lowOutliers = data.filter(d => d.status === 'outlier-low').length;
  const medianVol = d3.median(data, d => d.volume);

  d3.select('#stat-target').text(metric.fmt(metric.rate));
  d3.select('#stat-outliers-high').text(highOutliers);
  d3.select('#stat-outliers-low').text(lowOutliers);
  d3.select('#stat-median-vol').text(Math.round(medianVol).toLocaleString());
}

/* ---- Wire controls ------------------------------------------ */
function wireControls() {
  // Metric dropdown
  d3.select('#metric-select').on('change', function () {
    state.metric = this.value;
    state.seed = Math.floor(Math.random() * 100000);
    buildAll();
  });

  // Number of hospitals slider
  d3.select('#num-hospitals').on('input', function () {
    state.numHospitals = +this.value;
    d3.select('#num-hospitals-val').text(this.value);
    buildAll();
  });

  // CI level dropdown
  d3.select('#ci-level').on('change', function () {
    state.ciLevel = this.value;
    buildAll();
  });

  // Show labels toggle
  d3.select('#toggle-labels').on('change', function () {
    state.showLabels = this.checked;
    buildAll();
  });

  // Show target toggle
  d3.select('#toggle-target').on('change', function () {
    state.showTarget = this.checked;
    buildAll();
  });

  // Overdispersion toggle
  d3.select('#toggle-overdispersion').on('change', function () {
    state.overdispersion = this.checked;
    buildAll();
  });

  // Regenerate button
  d3.select('#regenerate-btn').on('click', function () {
    state.seed = Math.floor(Math.random() * 100000);
    buildAll();
  });
}

/* ---- Subtitle updates --------------------------------------- */
function updateSubtitles() {
  // Subtitles are static for now, could be made dynamic
}

/* ---- Init --------------------------------------------------- */
function init() {
  wireControls();
  buildAll();
}

init();
