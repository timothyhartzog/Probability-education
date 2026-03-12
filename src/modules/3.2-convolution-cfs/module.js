/* ============================================================
   Module 3.2 — Convolution & CLT via Characteristic Functions
   ============================================================
   Visualises the product of characteristic functions converging
   to the Gaussian CF, providing a Fourier-domain proof of the CLT.
   ============================================================ */

import * as d3 from 'd3';
import katex from 'katex';

/* ---- Constants ---------------------------------------------- */
const SQRT2PI = Math.sqrt(2 * Math.PI);
const SQRT3 = Math.sqrt(3);
const SQRT2 = Math.sqrt(2);

/* ---- Characteristic functions (complex-valued) -------------- */
// Each returns { re, im } for a given t
const DISTRIBUTIONS = {
  uniform: {
    label: 'Uniform(-√3, √3)',
    // φ(t) = sin(t√3) / (t√3)
    cf(t) {
      if (Math.abs(t) < 1e-12) return { re: 1, im: 0 };
      const a = t * SQRT3;
      return { re: Math.sin(a) / a, im: 0 };
    },
    symmetric: true
  },
  bernoulli: {
    label: 'Bernoulli(±1)',
    // φ(t) = cos(t)
    cf(t) {
      return { re: Math.cos(t), im: 0 };
    },
    symmetric: true
  },
  exponential: {
    label: 'Centered Exponential',
    // Exp(1)-1: φ(t) = e^{-it}/(1 - it)
    cf(t) {
      // e^{-it} = cos(t) - i sin(t)
      // 1/(1-it) = (1+it)/(1+t^2)
      const denom = 1 + t * t;
      const invRe = 1 / denom;
      const invIm = t / denom;
      const eRe = Math.cos(t);
      const eIm = -Math.sin(t);
      return {
        re: eRe * invRe - eIm * invIm,
        im: eRe * invIm + eIm * invRe
      };
    },
    symmetric: false
  },
  poisson: {
    label: 'Centered Poisson(λ=1)',
    // (Poisson(1)-1)/1: φ(t) = exp(e^{it} - 1 - it)
    cf(t) {
      // e^{it} = cos(t) + i sin(t)
      // exponent = (cos(t)-1-0) + i(sin(t)-t) (real, imag parts)
      const expRe = Math.cos(t) - 1;
      const expIm = Math.sin(t) - t;
      // e^{a+ib} = e^a (cos b + i sin b)
      const mag = Math.exp(expRe);
      return { re: mag * Math.cos(expIm), im: mag * Math.sin(expIm) };
    },
    symmetric: false
  },
  'chi-squared': {
    label: 'Centered Chi-Squared(1)',
    // (χ²(1)-1)/√2: φ(t) = (1-2it/√2)^{-1/2} · e^{-it/√2}
    cf(t) {
      const s = t / SQRT2;
      // (1 - 2is)^{-1/2}
      // 1 - 2is has modulus sqrt(1+4s^2), angle = -atan2(2s,1)
      const modSq = 1 + 4 * s * s;
      const mod = Math.sqrt(modSq);
      const angle = -Math.atan2(2 * s, 1);
      // raise to -1/2: mod^{-1/2} with angle * (-1/2)
      const rPow = Math.pow(mod, -0.5);
      const aPow = angle * (-0.5);
      const partRe = rPow * Math.cos(aPow);
      const partIm = rPow * Math.sin(aPow);
      // e^{-is} = cos(s) - i sin(s)
      const eRe = Math.cos(s);
      const eIm = -Math.sin(s);
      return {
        re: partRe * eRe - partIm * eIm,
        im: partRe * eIm + partIm * eRe
      };
    },
    symmetric: false
  }
};

/* ---- Complex power: [φ(t)]^n via polar form ----------------- */
function complexPow(re, im, n) {
  const r = Math.sqrt(re * re + im * im);
  if (r < 1e-30) return { re: 0, im: 0 };
  const theta = Math.atan2(im, re);
  const rn = Math.pow(r, n);
  return { re: rn * Math.cos(n * theta), im: rn * Math.sin(n * theta) };
}

/* ---- Standard normal PDF ------------------------------------ */
function normalPDF(x) { return Math.exp(-0.5 * x * x) / SQRT2PI; }

/* ---- State -------------------------------------------------- */
const state = {
  distribution: 'uniform',
  n: 1,
  tRange: 6,
  showGaussian: true,
  showIndividual: false,
  playing: false,
  animFrame: null
};

/* ---- Chart dimensions using viewBox ------------------------- */
const CF_W = 960, CF_H = 400;
const SM_W = 460, SM_H = 300;
const MARGIN = { top: 30, right: 25, bottom: 45, left: 55 };
const SM_MARGIN = { top: 25, right: 20, bottom: 40, left: 50 };

/* ---- Numerical CF evaluation -------------------------------- */
function evalCFProduct(tArr, n, distKey) {
  const dist = DISTRIBUTIONS[distKey];
  return tArr.map(t => {
    const phi = dist.cf(t / Math.sqrt(n));
    const pn = complexPow(phi.re, phi.im, n);
    return { t, re: pn.re, im: pn.im };
  });
}

function evalIndividualCF(tArr, n, distKey) {
  const dist = DISTRIBUTIONS[distKey];
  return tArr.map(t => {
    const phi = dist.cf(t / Math.sqrt(n));
    return { t, re: phi.re, im: phi.im };
  });
}

function gaussianCF(t) {
  return { re: Math.exp(-t * t / 2), im: 0 };
}

/* ---- Numerical density inversion via Riemann sum ------------ */
function invertCFtoDensity(xArr, n, distKey, T) {
  const numT = 512;
  const dt = (2 * T) / numT;
  const dist = DISTRIBUTIONS[distKey];
  const sqrtN = Math.sqrt(n);

  // precompute CF values on the t-grid
  const tGrid = [];
  const cfVals = [];
  for (let k = 0; k <= numT; k++) {
    const t = -T + k * dt;
    tGrid.push(t);
    const phi = dist.cf(t / sqrtN);
    const pn = complexPow(phi.re, phi.im, n);
    cfVals.push(pn);
  }

  return xArr.map(x => {
    let sumRe = 0;
    for (let k = 0; k <= numT; k++) {
      const t = tGrid[k];
      // e^{-itx} * φ_n(t)
      const cosv = Math.cos(t * x);
      const sinv = Math.sin(t * x);
      // Re(e^{-itx} * φ) = cos(tx)*re + sin(tx)*im
      const contrib = cosv * cfVals[k].re + sinv * cfVals[k].im;
      // trapezoidal weighting
      const w = (k === 0 || k === numT) ? 0.5 : 1;
      sumRe += w * contrib;
    }
    const density = sumRe * dt / (2 * Math.PI);
    return { x, density: Math.max(density, 0) };
  });
}

/* ---- Sup error computation ---------------------------------- */
function computeSupError(tArr, n, distKey) {
  let maxErr = 0;
  const dist = DISTRIBUTIONS[distKey];
  const sqrtN = Math.sqrt(n);
  for (const t of tArr) {
    const phi = dist.cf(t / sqrtN);
    const pn = complexPow(phi.re, phi.im, n);
    const g = gaussianCF(t);
    const dRe = pn.re - g.re;
    const dIm = pn.im - g.im;
    const err = Math.sqrt(dRe * dRe + dIm * dIm);
    if (err > maxErr) maxErr = err;
  }
  return maxErr;
}

/* ---- Build t-array ------------------------------------------ */
function makeTArr(tRange, numPts) {
  const arr = [];
  for (let i = 0; i <= numPts; i++) {
    arr.push(-tRange + (2 * tRange * i) / numPts);
  }
  return arr;
}

/* ---- CF Product Chart --------------------------------------- */
let cfSVG, cfG;
function initCFProduct() {
  const container = d3.select('#cf-product-chart');
  cfSVG = container.append('svg')
    .attr('viewBox', `0 0 ${CF_W} ${CF_H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%');
  cfG = cfSVG.append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  cfG.append('line').attr('class', 'zero-line');
  cfG.append('g').attr('class', 'axis x-axis');
  cfG.append('g').attr('class', 'axis y-axis');
  cfG.append('path').attr('class', 'cf-individual-line cf-indiv-re');
  cfG.append('path').attr('class', 'cf-individual-line cf-indiv-im')
    .style('stroke', 'var(--color-secondary)');
  cfG.append('path').attr('class', 'cf-product-line');
  cfG.append('path').attr('class', 'cf-im-line');
  cfG.append('path').attr('class', 'cf-gaussian-line');
  cfG.append('path').attr('class', 'cf-gaussian-im');
  cfG.append('text').attr('class', 'axis-label')
    .attr('text-anchor', 'middle');
  cfG.append('text').attr('class', 'axis-label')
    .attr('text-anchor', 'middle')
    .attr('transform', 'rotate(-90)');
}

function updateCFProduct() {
  const w = CF_W - MARGIN.left - MARGIN.right;
  const h = CF_H - MARGIN.top - MARGIN.bottom;

  const tRange = state.tRange;
  const tArr = makeTArr(tRange, 500);
  const data = evalCFProduct(tArr, state.n, state.distribution);

  const x = d3.scaleLinear().domain([-tRange, tRange]).range([0, w]);
  const y = d3.scaleLinear().domain([-1.1, 1.1]).range([h, 0]);

  // Axes
  cfG.select('.x-axis')
    .attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(10));
  cfG.select('.y-axis')
    .call(d3.axisLeft(y).ticks(6));

  // Zero line
  cfG.select('.zero-line')
    .attr('x1', 0).attr('x2', w)
    .attr('y1', y(0)).attr('y2', y(0));

  // Axis labels
  const labels = cfG.selectAll('.axis-label');
  const labelNodes = labels.nodes();
  d3.select(labelNodes[0])
    .attr('x', w / 2).attr('y', h + 38).text('t');
  d3.select(labelNodes[1])
    .attr('x', -h / 2).attr('y', -40).text('φ(t)');

  const line = d3.line().curve(d3.curveLinear);

  // Real part (blue)
  cfG.select('.cf-product-line')
    .datum(data)
    .transition().duration(200)
    .attr('d', line.x(d => x(d.t)).y(d => y(d.re)));

  // Imaginary part (orange)
  cfG.select('.cf-im-line')
    .datum(data)
    .transition().duration(200)
    .attr('d', line.x(d => x(d.t)).y(d => y(d.im)));

  // Gaussian overlay
  if (state.showGaussian) {
    const gData = tArr.map(t => ({ t, ...gaussianCF(t) }));
    cfG.select('.cf-gaussian-line')
      .datum(gData)
      .transition().duration(200)
      .attr('d', line.x(d => x(d.t)).y(d => y(d.re)))
      .attr('opacity', 1);
    // Gaussian Im = 0 (same as zero line, but show as dashed)
    cfG.select('.cf-gaussian-im')
      .datum(gData)
      .transition().duration(200)
      .attr('d', line.x(d => x(d.t)).y(d => y(d.im)))
      .attr('opacity', 1);
  } else {
    cfG.select('.cf-gaussian-line').attr('opacity', 0);
    cfG.select('.cf-gaussian-im').attr('opacity', 0);
  }

  // Individual CF φ(t/√n)
  if (state.showIndividual) {
    const indivData = evalIndividualCF(tArr, state.n, state.distribution);
    cfG.select('.cf-indiv-re')
      .datum(indivData)
      .transition().duration(200)
      .attr('d', line.x(d => x(d.t)).y(d => y(d.re)))
      .attr('opacity', 0.4)
      .style('stroke', 'var(--color-primary)');
    cfG.select('.cf-indiv-im')
      .datum(indivData)
      .transition().duration(200)
      .attr('d', line.x(d => x(d.t)).y(d => y(d.im)))
      .attr('opacity', 0.4);
  } else {
    cfG.select('.cf-indiv-re').attr('opacity', 0);
    cfG.select('.cf-indiv-im').attr('opacity', 0);
  }
}

/* ---- Density Evolution Chart -------------------------------- */
let densSVG, densG;
function initDensity() {
  const container = d3.select('#density-evolution-chart');
  densSVG = container.append('svg')
    .attr('viewBox', `0 0 ${SM_W} ${SM_H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%');
  densG = densSVG.append('g')
    .attr('transform', `translate(${SM_MARGIN.left},${SM_MARGIN.top})`);

  densG.append('g').attr('class', 'axis x-axis');
  densG.append('g').attr('class', 'axis y-axis');
  densG.append('path').attr('class', 'density-current');
  densG.append('path').attr('class', 'density-gaussian');
  densG.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle');
  densG.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle')
    .attr('transform', 'rotate(-90)');
}

function updateDensity() {
  const w = SM_W - SM_MARGIN.left - SM_MARGIN.right;
  const h = SM_H - SM_MARGIN.top - SM_MARGIN.bottom;

  const xRange = 4.5;
  const numX = 200;
  const xArr = [];
  for (let i = 0; i <= numX; i++) {
    xArr.push(-xRange + (2 * xRange * i) / numX);
  }

  // Use a wider T for inversion to get decent density
  const T = Math.max(state.tRange, 10);
  const densityData = invertCFtoDensity(xArr, state.n, state.distribution, T);

  const x = d3.scaleLinear().domain([-xRange, xRange]).range([0, w]);
  const yMax = Math.max(d3.max(densityData, d => d.density) || 0.5, normalPDF(0) * 1.1);
  const y = d3.scaleLinear().domain([0, yMax]).range([h, 0]);

  densG.select('.x-axis')
    .attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(6));
  densG.select('.y-axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.2f')));

  const labels = densG.selectAll('.axis-label');
  const labelNodes = labels.nodes();
  d3.select(labelNodes[0]).attr('x', w / 2).attr('y', h + 35).text('x');
  d3.select(labelNodes[1]).attr('x', -h / 2).attr('y', -38).text('f(x)');

  // Current density as filled area
  const area = d3.area()
    .x(d => x(d.x))
    .y0(h)
    .y1(d => y(d.density))
    .curve(d3.curveLinear);

  densG.select('.density-current')
    .datum(densityData)
    .transition().duration(200)
    .attr('d', area);

  // Gaussian overlay
  if (state.showGaussian) {
    const gaussData = xArr.map(xv => ({ x: xv, density: normalPDF(xv) }));
    const gaussLine = d3.line()
      .x(d => x(d.x))
      .y(d => y(d.density))
      .curve(d3.curveLinear);
    densG.select('.density-gaussian')
      .datum(gaussData)
      .transition().duration(200)
      .attr('d', gaussLine)
      .attr('opacity', 1);
  } else {
    densG.select('.density-gaussian').attr('opacity', 0);
  }
}

/* ---- Log-Modulus Chart -------------------------------------- */
let logSVG, logG;
function initLogMod() {
  const container = d3.select('#log-mod-chart');
  logSVG = container.append('svg')
    .attr('viewBox', `0 0 ${SM_W} ${SM_H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%');
  logG = logSVG.append('g')
    .attr('transform', `translate(${SM_MARGIN.left},${SM_MARGIN.top})`);

  logG.append('line').attr('class', 'zero-line');
  logG.append('g').attr('class', 'axis x-axis');
  logG.append('g').attr('class', 'axis y-axis');
  logG.append('path').attr('class', 'logmod-line');
  logG.append('path').attr('class', 'logmod-gaussian');
  logG.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle');
  logG.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle')
    .attr('transform', 'rotate(-90)');
}

function updateLogMod() {
  const w = SM_W - SM_MARGIN.left - SM_MARGIN.right;
  const h = SM_H - SM_MARGIN.top - SM_MARGIN.bottom;

  const tRange = state.tRange;
  const tArr = makeTArr(tRange, 400);
  const dist = DISTRIBUTIONS[state.distribution];
  const sqrtN = Math.sqrt(state.n);

  const logModData = tArr.map(t => {
    const phi = dist.cf(t / sqrtN);
    const r = Math.sqrt(phi.re * phi.re + phi.im * phi.im);
    const logR = r > 1e-30 ? state.n * Math.log(r) : -50;
    return { t, logMod: Math.max(logR, -20) };
  });

  const gaussLogMod = tArr.map(t => ({ t, logMod: -t * t / 2 }));

  const x = d3.scaleLinear().domain([-tRange, tRange]).range([0, w]);

  const allY = logModData.map(d => d.logMod).concat(gaussLogMod.map(d => d.logMod));
  const yMin = Math.max(d3.min(allY), -20);
  const yMax = 0.5;
  const y = d3.scaleLinear().domain([yMin, yMax]).range([h, 0]);

  logG.select('.x-axis')
    .attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(6));
  logG.select('.y-axis')
    .call(d3.axisLeft(y).ticks(5));

  // Zero line
  logG.select('.zero-line')
    .attr('x1', 0).attr('x2', w)
    .attr('y1', y(0)).attr('y2', y(0));

  const labels = logG.selectAll('.axis-label');
  const labelNodes = labels.nodes();
  d3.select(labelNodes[0]).attr('x', w / 2).attr('y', h + 35).text('t');
  d3.select(labelNodes[1]).attr('x', -h / 2).attr('y', -38).text('log|φₙ(t)|');

  const line = d3.line().curve(d3.curveLinear);

  logG.select('.logmod-line')
    .datum(logModData)
    .transition().duration(200)
    .attr('d', line.x(d => x(d.t)).y(d => y(d.logMod)));

  if (state.showGaussian) {
    logG.select('.logmod-gaussian')
      .datum(gaussLogMod)
      .transition().duration(200)
      .attr('d', line.x(d => x(d.t)).y(d => y(d.logMod)))
      .attr('opacity', 1);
  } else {
    logG.select('.logmod-gaussian').attr('opacity', 0);
  }
}

/* ---- Legend -------------------------------------------------- */
function buildLegend() {
  const legend = d3.select('#cf-product-legend');
  legend.html('');
  const items = [
    { color: 'var(--color-primary)', label: 'Re(φₙ(t))', dash: false },
    { color: 'var(--color-secondary)', label: 'Im(φₙ(t))', dash: false },
    { color: 'var(--color-error)', label: 'Gaussian CF', dash: true }
  ];
  items.forEach(item => {
    const span = legend.append('span')
      .style('display', 'inline-flex')
      .style('align-items', 'center')
      .style('margin-right', '16px')
      .style('font-size', '12px');
    span.append('svg')
      .attr('width', 20).attr('height', 10)
      .append('line')
      .attr('x1', 0).attr('y1', 5).attr('x2', 20).attr('y2', 5)
      .attr('stroke', item.color)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', item.dash ? '6 4' : 'none');
    span.append('span')
      .style('margin-left', '4px')
      .text(item.label);
  });
}

/* ---- Stats update ------------------------------------------- */
function updateStatsDisplay() {
  const tArr = makeTArr(state.tRange, 300);
  const supErr = computeSupError(tArr, state.n, state.distribution);

  d3.select('#stat-n').text(state.n);
  d3.select('#stat-sup-error').text(supErr.toFixed(4));
  d3.select('#num-summands-val').text(state.n);
  d3.select('#t-range-val').text(state.tRange);
}

/* ---- KaTeX formulas ----------------------------------------- */
function renderFormulas() {
  const productEl = document.getElementById('info-product-def');
  if (productEl) {
    try {
      katex.render(
        String.raw`\varphi_{X+Y}(t) = \varphi_X(t) \cdot \varphi_Y(t)`,
        productEl,
        { displayMode: true, throwOnError: false }
      );
    } catch (e) {
      productEl.textContent = 'φ_{X+Y}(t) = φ_X(t) · φ_Y(t)';
    }
  }
  const cltEl = document.getElementById('info-clt-fourier');
  if (cltEl) {
    try {
      katex.render(
        String.raw`\left[\varphi\!\left(\frac{t}{\sqrt{n}}\right)\right]^n \;\longrightarrow\; e^{-t^2/2}`,
        cltEl,
        { displayMode: true, throwOnError: false }
      );
    } catch (e) {
      cltEl.textContent = '[φ(t/√n)]^n → e^{-t²/2}';
    }
  }
}

/* ---- Play / Animate ----------------------------------------- */
function togglePlay() {
  if (state.playing) {
    stopPlay();
  } else {
    startPlay();
  }
}

function startPlay() {
  state.playing = true;
  state.n = 1;
  d3.select('#num-summands').property('value', 1);
  updatePlayButton();

  const maxN = 100;
  const msPerStep = 80;
  let lastTime = null;
  let accumulator = 0;

  function step(timestamp) {
    if (!state.playing) return;
    if (lastTime === null) lastTime = timestamp;
    accumulator += timestamp - lastTime;
    lastTime = timestamp;

    let stepped = false;
    while (accumulator >= msPerStep && state.n < maxN) {
      const inc = state.n < 20 ? 1 : state.n < 50 ? 2 : 3;
      state.n = Math.min(state.n + inc, maxN);
      accumulator -= msPerStep;
      stepped = true;
    }

    if (stepped) {
      d3.select('#num-summands').property('value', state.n);
      updateAll();
    }

    if (state.n >= maxN) {
      stopPlay();
      return;
    }

    state.animFrame = requestAnimationFrame(step);
  }

  state.animFrame = requestAnimationFrame(step);
}

function stopPlay() {
  state.playing = false;
  if (state.animFrame) {
    cancelAnimationFrame(state.animFrame);
    state.animFrame = null;
  }
  updatePlayButton();
}

function updatePlayButton() {
  const btn = d3.select('#play-btn');
  btn.classed('playing', state.playing);
  btn.text(state.playing ? 'Pause' : 'Animate n');
}

/* ---- Wire Controls ------------------------------------------ */
function wireControls() {
  d3.select('#dist-select').on('change', function () {
    state.distribution = this.value;
    updateAll();
  });

  d3.select('#num-summands').on('input', function () {
    state.n = +this.value;
    updateAll();
  });

  d3.select('#t-range').on('input', function () {
    state.tRange = +this.value;
    updateAll();
  });

  d3.select('#toggle-gaussian').on('change', function () {
    state.showGaussian = this.checked;
    updateAll();
  });

  d3.select('#toggle-individual').on('change', function () {
    state.showIndividual = this.checked;
    updateAll();
  });

  d3.select('#play-btn').on('click', togglePlay);
}

/* ---- Master update ------------------------------------------ */
function updateAll() {
  updateCFProduct();
  updateDensity();
  updateLogMod();
  updateStatsDisplay();
}

/* ---- Resize handler ----------------------------------------- */
let resizeTimer;
function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(updateAll, 150);
}

/* ---- Initialise --------------------------------------------- */
function init() {
  initCFProduct();
  initDensity();
  initLogMod();
  buildLegend();
  wireControls();
  renderFormulas();
  updateAll();
  window.addEventListener('resize', onResize);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
