/* ============================================================
   FM-1 — Stochastic Processes in Finance
   Interactive simulator: GBM, Black-Scholes, Portfolio,
   VaR/CVaR, Interest Rates, Jump-Diffusion
   ============================================================ */

// ── Utility helpers ──────────────────────────────────────────
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function normalCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function normalPDF(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function quantile(arr, q) {
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
}

function mean(arr) { return arr.reduce((s, v) => s + v, 0) / arr.length; }
function std(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function kurtosis(arr) {
  const m = mean(arr), s = std(arr);
  if (s === 0) return 0;
  return arr.reduce((acc, v) => acc + ((v - m) / s) ** 4, 0) / arr.length;
}

function skewness(arr) {
  const m = mean(arr), s = std(arr);
  if (s === 0) return 0;
  return arr.reduce((acc, v) => acc + ((v - m) / s) ** 3, 0) / arr.length;
}

function fmt(v, d = 2) {
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (Math.abs(v) >= 1e3) return v.toLocaleString(undefined, { maximumFractionDigits: d });
  return v.toFixed(d);
}

function pct(v) { return (v * 100).toFixed(2) + '%'; }

// Poisson random variable
function randPoisson(lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

// Student-t random variable (using ratio of normals method)
function randStudentT(df) {
  // Use the fact that T = Z / sqrt(V/df) where Z ~ N(0,1), V ~ Chi-squared(df)
  let v = 0;
  for (let i = 0; i < df; i++) { const z = randn(); v += z * z; }
  return randn() / Math.sqrt(v / df);
}

// ── Tab Navigation ───────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ── Slider wiring ────────────────────────────────────────────
function wireSlider(id, formatter) {
  const el = document.getElementById(id);
  const out = document.getElementById(id + '-val');
  if (!el || !out) return;
  const update = () => { out.textContent = formatter ? formatter(el.value) : el.value; };
  el.addEventListener('input', update);
  update();
}

// GBM sliders
wireSlider('gbm-s0');
wireSlider('gbm-mu');
wireSlider('gbm-sigma');
wireSlider('gbm-T');
wireSlider('gbm-steps');
wireSlider('gbm-paths');

// Black-Scholes sliders
wireSlider('bs-S');
wireSlider('bs-K');
wireSlider('bs-T', v => parseFloat(v).toFixed(2));
wireSlider('bs-r', v => parseFloat(v).toFixed(3));
wireSlider('bs-sigma');
wireSlider('bs-q', v => parseFloat(v).toFixed(3));

// Portfolio sliders
wireSlider('port-n');
wireSlider('port-rf', v => parseFloat(v).toFixed(3));
wireSlider('port-mc');

// VaR sliders
wireSlider('var-portfolio', v => parseInt(v).toLocaleString());
wireSlider('var-mu');
wireSlider('var-vol');
wireSlider('var-horizon');
wireSlider('var-sims');
wireSlider('var-df');

// Interest Rate sliders
wireSlider('ir-r0', v => parseFloat(v).toFixed(3));
wireSlider('ir-kappa', v => parseFloat(v).toFixed(2));
wireSlider('ir-theta', v => parseFloat(v).toFixed(3));
wireSlider('ir-sigma', v => parseFloat(v).toFixed(3));
wireSlider('ir-T');
wireSlider('ir-paths');

// Jump-Diffusion sliders
wireSlider('jd-s0');
wireSlider('jd-mu');
wireSlider('jd-sigma');
wireSlider('jd-lambda', v => parseFloat(v).toFixed(1));
wireSlider('jd-muj');
wireSlider('jd-sigmaj');
wireSlider('jd-T', v => parseFloat(v).toFixed(2));
wireSlider('jd-paths');

// ════════════════════════════════════════════════════════════════
//  TAB 1 — Geometric Brownian Motion
// ════════════════════════════════════════════════════════════════

function simulateGBM(S0, mu, sigma, T, steps, nPaths) {
  const dt = T / steps;
  const drift = (mu - 0.5 * sigma * sigma) * dt;
  const diffusion = sigma * Math.sqrt(dt);
  const paths = [];
  for (let p = 0; p < nPaths; p++) {
    const path = [S0];
    let s = S0;
    for (let i = 1; i <= steps; i++) {
      s = s * Math.exp(drift + diffusion * randn());
      path.push(s);
    }
    paths.push(path);
  }
  return paths;
}

function maxDrawdown(path) {
  let peak = path[0], maxDD = 0;
  for (const v of path) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

function drawGBMChart(paths, T) {
  const container = d3.select('#gbm-chart');
  container.selectAll('*').remove();
  const w = container.node().clientWidth;
  const h = 420;
  const margin = { top: 20, right: 30, bottom: 45, left: 65 };
  const iw = w - margin.left - margin.right;
  const ih = h - margin.top - margin.bottom;

  const svg = container.append('svg').attr('width', w).attr('height', h);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const steps = paths[0].length - 1;
  const x = d3.scaleLinear().domain([0, T]).range([0, iw]);
  const allVals = paths.flat();
  const y = d3.scaleLinear().domain([0, d3.max(allVals) * 1.05]).range([ih, 0]);

  // Grid
  g.append('g').attr('class', 'grid')
    .call(d3.axisLeft(y).tickSize(-iw).tickFormat(''));
  g.append('g').attr('class', 'grid').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(x).tickSize(-ih).tickFormat(''));

  // Axes
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d => d.toFixed(1) + 'y'));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(8).tickFormat(d => '$' + fmt(d, 0)));

  // Axis labels
  g.append('text').attr('x', iw / 2).attr('y', ih + 38).attr('text-anchor', 'middle')
    .attr('class', 'axis-label').text('Time (years)');
  g.append('text').attr('transform', 'rotate(-90)').attr('x', -ih / 2).attr('y', -50)
    .attr('text-anchor', 'middle').attr('class', 'axis-label').text('Price ($)');

  // Color scale for paths
  const color = d3.scaleSequential(d3.interpolateViridis).domain([0, paths.length]);

  const line = d3.line()
    .x((d, i) => x(i * T / steps))
    .y(d => y(d));

  paths.forEach((path, pi) => {
    g.append('path')
      .datum(path)
      .attr('fill', 'none')
      .attr('stroke', color(pi))
      .attr('stroke-width', paths.length > 100 ? 0.5 : 1.2)
      .attr('stroke-opacity', paths.length > 100 ? 0.3 : 0.6)
      .attr('d', line);
  });

  // Expected value line
  const S0 = paths[0][0];
  const mu = parseFloat(document.getElementById('gbm-mu').value);
  const expectedPath = Array.from({ length: steps + 1 }, (_, i) =>
    S0 * Math.exp(mu * (i * T / steps)));
  g.append('path')
    .datum(expectedPath)
    .attr('fill', 'none')
    .attr('stroke', '#ef4444')
    .attr('stroke-width', 2.5)
    .attr('stroke-dasharray', '8,4')
    .attr('d', line);

  // Legend
  const lg = g.append('g').attr('transform', `translate(${iw - 150}, 5)`);
  lg.append('line').attr('x1', 0).attr('x2', 20).attr('y1', 0).attr('y2', 0)
    .attr('stroke', '#ef4444').attr('stroke-width', 2.5).attr('stroke-dasharray', '8,4');
  lg.append('text').attr('x', 25).attr('y', 4).text('E[S(t)]')
    .attr('font-size', '0.75rem').attr('fill', '#64748b');
}

function drawGBMDistribution(paths) {
  const container = d3.select('#gbm-dist-chart');
  container.selectAll('*').remove();
  const w = container.node().clientWidth;
  const h = 280;
  const margin = { top: 15, right: 20, bottom: 40, left: 55 };
  const iw = w - margin.left - margin.right;
  const ih = h - margin.top - margin.bottom;

  const svg = container.append('svg').attr('width', w).attr('height', h);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const finals = paths.map(p => p[p.length - 1]);
  const x = d3.scaleLinear()
    .domain([d3.min(finals) * 0.9, d3.max(finals) * 1.1])
    .range([0, iw]);

  const histogram = d3.bin().domain(x.domain()).thresholds(40);
  const bins = histogram(finals);

  const y = d3.scaleLinear()
    .domain([0, d3.max(bins, d => d.length)])
    .range([ih, 0]);

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d => '$' + fmt(d, 0)));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(6));

  g.append('text').attr('x', iw / 2).attr('y', ih + 35).attr('text-anchor', 'middle')
    .attr('class', 'axis-label').text('Final Price ($)');

  g.selectAll('.hist-bar')
    .data(bins)
    .enter().append('rect')
    .attr('class', 'hist-bar')
    .attr('x', d => x(d.x0) + 1)
    .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 2))
    .attr('y', d => y(d.length))
    .attr('height', d => ih - y(d.length))
    .attr('fill', '#6366f1')
    .attr('opacity', 0.7);

  // Mean line
  const m = mean(finals);
  g.append('line').attr('x1', x(m)).attr('x2', x(m)).attr('y1', 0).attr('y2', ih)
    .attr('stroke', '#ef4444').attr('stroke-width', 2).attr('stroke-dasharray', '6,3');
  g.append('text').attr('x', x(m) + 5).attr('y', 12).text('Mean: $' + fmt(m, 0))
    .attr('font-size', '0.72rem').attr('fill', '#ef4444');
}

function runGBM() {
  const S0 = +document.getElementById('gbm-s0').value;
  const mu = +document.getElementById('gbm-mu').value;
  const sigma = +document.getElementById('gbm-sigma').value;
  const T = +document.getElementById('gbm-T').value;
  const steps = +document.getElementById('gbm-steps').value;
  const nPaths = +document.getElementById('gbm-paths').value;

  const paths = simulateGBM(S0, mu, sigma, T, steps, nPaths);
  drawGBMChart(paths, T);
  drawGBMDistribution(paths);

  const finals = paths.map(p => p[p.length - 1]);
  const drawdowns = paths.map(maxDrawdown);
  document.getElementById('gbm-mean-final').textContent = '$' + fmt(mean(finals), 0);
  document.getElementById('gbm-median-final').textContent = '$' + fmt(quantile(finals, 0.5), 0);
  document.getElementById('gbm-std').textContent = '$' + fmt(std(finals), 0);
  document.getElementById('gbm-maxdd').textContent = pct(mean(drawdowns));
  document.getElementById('gbm-ploss').textContent = pct(finals.filter(f => f < S0).length / finals.length);
}

// GBM Presets
const GBM_PRESETS = {
  sp500:  { mu: 0.10, sigma: 0.16, s0: 100 },
  crypto: { mu: 0.50, sigma: 0.80, s0: 100 },
  bond:   { mu: 0.03, sigma: 0.05, s0: 100 },
  penny:  { mu: 0.15, sigma: 0.60, s0: 5 },
};

document.querySelectorAll('[data-preset]').forEach(btn => {
  btn.addEventListener('click', () => {
    const p = GBM_PRESETS[btn.dataset.preset];
    if (!p) return;
    document.getElementById('gbm-s0').value = p.s0;
    document.getElementById('gbm-mu').value = p.mu;
    document.getElementById('gbm-sigma').value = p.sigma;
    ['gbm-s0', 'gbm-mu', 'gbm-sigma'].forEach(id => {
      document.getElementById(id).dispatchEvent(new Event('input'));
    });
    runGBM();
  });
});

document.getElementById('gbm-run').addEventListener('click', runGBM);
document.getElementById('gbm-reset').addEventListener('click', () => {
  const defaults = { 'gbm-s0': 100, 'gbm-mu': 0.08, 'gbm-sigma': 0.20, 'gbm-T': 1, 'gbm-steps': 252, 'gbm-paths': 50 };
  Object.entries(defaults).forEach(([id, v]) => {
    document.getElementById(id).value = v;
    document.getElementById(id).dispatchEvent(new Event('input'));
  });
  runGBM();
});

// ════════════════════════════════════════════════════════════════
//  TAB 2 — Black-Scholes Options Pricing
// ════════════════════════════════════════════════════════════════

function blackScholes(S, K, T, r, sigma, q = 0) {
  if (T <= 0) {
    const callIntrinsic = Math.max(S - K, 0);
    const putIntrinsic = Math.max(K - S, 0);
    return { call: callIntrinsic, put: putIntrinsic, d1: 0, d2: 0 };
  }
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  const call = S * Math.exp(-q * T) * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
  const put = K * Math.exp(-r * T) * normalCDF(-d2) - S * Math.exp(-q * T) * normalCDF(-d1);
  return { call, put, d1, d2 };
}

function greeks(S, K, T, r, sigma, q = 0) {
  if (T <= 0) return { delta: S > K ? 1 : 0, gamma: 0, vega: 0, theta: 0, rho: 0 };
  const { d1, d2 } = blackScholes(S, K, T, r, sigma, q);
  const sqrtT = Math.sqrt(T);
  const delta = Math.exp(-q * T) * normalCDF(d1);
  const gamma = Math.exp(-q * T) * normalPDF(d1) / (S * sigma * sqrtT);
  const vega = S * Math.exp(-q * T) * normalPDF(d1) * sqrtT / 100; // per 1% vol
  const theta = (-(S * sigma * Math.exp(-q * T) * normalPDF(d1)) / (2 * sqrtT)
    - r * K * Math.exp(-r * T) * normalCDF(d2)
    + q * S * Math.exp(-q * T) * normalCDF(d1)) / 365;
  const rho = K * T * Math.exp(-r * T) * normalCDF(d2) / 100;
  return { delta, gamma, vega, theta, rho };
}

function runBlackScholes() {
  const S = +document.getElementById('bs-S').value;
  const K = +document.getElementById('bs-K').value;
  const T = +document.getElementById('bs-T').value;
  const r = +document.getElementById('bs-r').value;
  const sigma = +document.getElementById('bs-sigma').value;
  const q = +document.getElementById('bs-q').value;

  const bs = blackScholes(S, K, T, r, sigma, q);
  const g = greeks(S, K, T, r, sigma, q);

  document.getElementById('bs-call').textContent = '$' + fmt(bs.call);
  document.getElementById('bs-put').textContent = '$' + fmt(bs.put);
  document.getElementById('bs-delta').textContent = fmt(g.delta, 4);
  document.getElementById('bs-gamma').textContent = fmt(g.gamma, 4);
  document.getElementById('bs-vega').textContent = fmt(g.vega, 4);
  document.getElementById('bs-theta').textContent = fmt(g.theta, 4);

  drawBSSurface(K, T, r, sigma, q);
  drawBSGreeks(K, T, r, sigma, q);
  drawBSPnL(S, K, T, r, sigma, q);
}

function drawBSSurface(K, T, r, sigma, q) {
  const container = d3.select('#bs-surface-chart');
  container.selectAll('*').remove();
  const w = container.node().clientWidth;
  const h = 400;
  const margin = { top: 20, right: 80, bottom: 45, left: 65 };
  const iw = w - margin.left - margin.right;
  const ih = h - margin.top - margin.bottom;

  const svg = container.append('svg').attr('width', w).attr('height', h);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Heatmap: spot price vs time to expiry, color = call price
  const nS = 60, nT = 40;
  const sMin = K * 0.5, sMax = K * 1.5;
  const tMin = 0.01, tMax = Math.max(T * 2, 0.5);

  const xScale = d3.scaleLinear().domain([tMin, tMax]).range([0, iw]);
  const yScale = d3.scaleLinear().domain([sMin, sMax]).range([ih, 0]);

  let maxPrice = 0;
  const data = [];
  for (let i = 0; i < nS; i++) {
    for (let j = 0; j < nT; j++) {
      const s = sMin + (sMax - sMin) * i / (nS - 1);
      const t = tMin + (tMax - tMin) * j / (nT - 1);
      const price = blackScholes(s, K, t, r, sigma, q).call;
      if (price > maxPrice) maxPrice = price;
      data.push({ s, t, price });
    }
  }

  const colorScale = d3.scaleSequential(d3.interpolateInferno).domain([0, maxPrice]);
  const cellW = iw / nT, cellH = ih / nS;

  g.selectAll('rect').data(data).enter().append('rect')
    .attr('x', d => xScale(d.t) - cellW / 2)
    .attr('y', d => yScale(d.s) - cellH / 2)
    .attr('width', cellW + 1)
    .attr('height', cellH + 1)
    .attr('fill', d => colorScale(d.price));

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(xScale).ticks(8).tickFormat(d => d.toFixed(1) + 'y'));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(yScale).ticks(8).tickFormat(d => '$' + d));

  g.append('text').attr('x', iw / 2).attr('y', ih + 38).attr('text-anchor', 'middle')
    .attr('class', 'axis-label').text('Time to Expiry');
  g.append('text').attr('transform', 'rotate(-90)').attr('x', -ih / 2).attr('y', -50)
    .attr('text-anchor', 'middle').attr('class', 'axis-label').text('Spot Price ($)');

  // Color bar
  const barW = 15, barH = ih;
  const barG = svg.append('g').attr('transform', `translate(${w - margin.right + 15},${margin.top})`);
  const barScale = d3.scaleLinear().domain([0, maxPrice]).range([barH, 0]);
  const barAxis = d3.axisRight(barScale).ticks(5).tickFormat(d => '$' + fmt(d, 0));

  const defs = svg.append('defs');
  const grad = defs.append('linearGradient').attr('id', 'bs-grad')
    .attr('x1', '0').attr('y1', '1').attr('x2', '0').attr('y2', '0');
  for (let i = 0; i <= 10; i++) {
    grad.append('stop').attr('offset', (i * 10) + '%')
      .attr('stop-color', colorScale(maxPrice * i / 10));
  }
  barG.append('rect').attr('width', barW).attr('height', barH).attr('fill', 'url(#bs-grad)');
  barG.append('g').attr('transform', `translate(${barW},0)`).call(barAxis);
}

function drawBSGreeks(K, T, r, sigma, q) {
  const container = d3.select('#bs-greeks-chart');
  container.selectAll('*').remove();
  const w = container.node().clientWidth;
  const h = 320;
  const margin = { top: 20, right: 30, bottom: 45, left: 65 };
  const iw = w - margin.left - margin.right;
  const ih = h - margin.top - margin.bottom;

  const svg = container.append('svg').attr('width', w).attr('height', h);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const greekName = document.getElementById('bs-greek-select').value;
  const sMin = K * 0.5, sMax = K * 1.5;
  const nPts = 200;
  const data = [];
  for (let i = 0; i < nPts; i++) {
    const s = sMin + (sMax - sMin) * i / (nPts - 1);
    const g_ = greeks(s, K, T, r, sigma, q);
    data.push({ s, value: g_[greekName] });
  }

  const x = d3.scaleLinear().domain([sMin, sMax]).range([0, iw]);
  const y = d3.scaleLinear().domain(d3.extent(data, d => d.value)).nice().range([ih, 0]);

  g.append('g').attr('class', 'grid').call(d3.axisLeft(y).tickSize(-iw).tickFormat(''));
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d => '$' + d));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(8));

  g.append('text').attr('x', iw / 2).attr('y', ih + 38).attr('text-anchor', 'middle')
    .attr('class', 'axis-label').text('Spot Price ($)');
  g.append('text').attr('transform', 'rotate(-90)').attr('x', -ih / 2).attr('y', -50)
    .attr('text-anchor', 'middle').attr('class', 'axis-label')
    .text(greekName.charAt(0).toUpperCase() + greekName.slice(1));

  const line = d3.line().x(d => x(d.s)).y(d => y(d.value)).curve(d3.curveMonotoneX);
  g.append('path').datum(data).attr('fill', 'none').attr('stroke', '#6366f1')
    .attr('stroke-width', 2.5).attr('d', line);

  // Strike line
  g.append('line').attr('x1', x(K)).attr('x2', x(K)).attr('y1', 0).attr('y2', ih)
    .attr('stroke', '#ef4444').attr('stroke-dasharray', '6,3').attr('stroke-width', 1.5);
  g.append('text').attr('x', x(K) + 5).attr('y', 14).text('K=' + K)
    .attr('font-size', '0.72rem').attr('fill', '#ef4444');
}

function drawBSPnL(S, K, T, r, sigma, q) {
  const container = d3.select('#bs-pnl-chart');
  container.selectAll('*').remove();
  const w = container.node().clientWidth;
  const h = 280;
  const margin = { top: 15, right: 30, bottom: 40, left: 60 };
  const iw = w - margin.left - margin.right;
  const ih = h - margin.top - margin.bottom;

  const svg = container.append('svg').attr('width', w).attr('height', h);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const bs = blackScholes(S, K, T, r, sigma, q);
  const sMin = K * 0.5, sMax = K * 1.5, nPts = 200;
  const callData = [], putData = [];

  for (let i = 0; i < nPts; i++) {
    const sT = sMin + (sMax - sMin) * i / (nPts - 1);
    callData.push({ s: sT, pnl: Math.max(sT - K, 0) - bs.call });
    putData.push({ s: sT, pnl: Math.max(K - sT, 0) - bs.put });
  }

  const x = d3.scaleLinear().domain([sMin, sMax]).range([0, iw]);
  const allPnL = callData.map(d => d.pnl).concat(putData.map(d => d.pnl));
  const y = d3.scaleLinear().domain(d3.extent(allPnL)).nice().range([ih, 0]);

  g.append('g').attr('class', 'grid').call(d3.axisLeft(y).tickSize(-iw).tickFormat(''));
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d => '$' + d));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(6).tickFormat(d => '$' + fmt(d)));

  // Zero line
  g.append('line').attr('x1', 0).attr('x2', iw).attr('y1', y(0)).attr('y2', y(0))
    .attr('stroke', '#94a3b8').attr('stroke-dasharray', '4,4');

  const line = d3.line().x(d => x(d.s)).y(d => y(d.pnl));
  g.append('path').datum(callData).attr('fill', 'none').attr('stroke', '#22c55e')
    .attr('stroke-width', 2.5).attr('d', line);
  g.append('path').datum(putData).attr('fill', 'none').attr('stroke', '#ef4444')
    .attr('stroke-width', 2.5).attr('d', line);

  // Legend
  const lg = g.append('g').attr('transform', `translate(${iw - 100}, 5)`);
  lg.append('line').attr('x1', 0).attr('x2', 20).attr('y1', 0).attr('y2', 0).attr('stroke', '#22c55e').attr('stroke-width', 2.5);
  lg.append('text').attr('x', 25).attr('y', 4).text('Call P&L').attr('font-size', '0.72rem').attr('fill', '#64748b');
  lg.append('line').attr('x1', 0).attr('x2', 20).attr('y1', 18).attr('y2', 18).attr('stroke', '#ef4444').attr('stroke-width', 2.5);
  lg.append('text').attr('x', 25).attr('y', 22).text('Put P&L').attr('font-size', '0.72rem').attr('fill', '#64748b');
}

document.getElementById('bs-run').addEventListener('click', runBlackScholes);
document.getElementById('bs-greek-select').addEventListener('change', runBlackScholes);
document.getElementById('bs-reset').addEventListener('click', () => {
  const defaults = { 'bs-S': 100, 'bs-K': 100, 'bs-T': 0.5, 'bs-r': 0.05, 'bs-sigma': 0.20, 'bs-q': 0 };
  Object.entries(defaults).forEach(([id, v]) => {
    document.getElementById(id).value = v;
    document.getElementById(id).dispatchEvent(new Event('input'));
  });
  runBlackScholes();
});

// ════════════════════════════════════════════════════════════════
//  TAB 3 — Portfolio Optimization (Markowitz)
// ════════════════════════════════════════════════════════════════

const ASSET_NAMES = ['Stocks', 'Bonds', 'Real Estate', 'Gold', 'Intl Equity', 'Crypto', 'Commodities', 'Cash'];
const ASSET_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#eab308', '#3b82f6', '#a855f7', '#f97316', '#94a3b8'];

const PORT_PRESETS = {
  classic60_40: {
    n: 4, returns: [0.10, 0.04, 0.08, 0.03], vols: [0.16, 0.06, 0.14, 0.10],
    corr: [[1, -0.1, 0.5, 0.05], [-0.1, 1, 0.1, 0.3], [0.5, 0.1, 1, 0.1], [0.05, 0.3, 0.1, 1]]
  },
  tech: {
    n: 3, returns: [0.15, 0.20, 0.12], vols: [0.22, 0.35, 0.18],
    corr: [[1, 0.7, 0.5], [0.7, 1, 0.4], [0.5, 0.4, 1]]
  },
  diverse: {
    n: 6, returns: [0.10, 0.04, 0.07, 0.05, 0.09, 0.25],
    vols: [0.16, 0.06, 0.13, 0.15, 0.18, 0.65],
    corr: [
      [1, -0.1, 0.5, 0.05, 0.8, 0.2],
      [-0.1, 1, 0.1, 0.3, -0.05, -0.1],
      [0.5, 0.1, 1, 0.1, 0.4, 0.1],
      [0.05, 0.3, 0.1, 1, 0.1, 0.15],
      [0.8, -0.05, 0.4, 0.1, 1, 0.25],
      [0.2, -0.1, 0.1, 0.15, 0.25, 1]
    ]
  }
};

function buildPortfolioInputs() {
  const n = +document.getElementById('port-n').value;
  const retDiv = document.getElementById('port-returns-inputs');
  const volDiv = document.getElementById('port-vol-inputs');
  const corrDiv = document.getElementById('port-corr-inputs');
  retDiv.innerHTML = '';
  volDiv.innerHTML = '';
  corrDiv.innerHTML = '';

  for (let i = 0; i < n; i++) {
    retDiv.innerHTML += `<div class="control-group compact"><label>${ASSET_NAMES[i]}</label>
      <input type="number" id="port-ret-${i}" value="${[0.10, 0.04, 0.08, 0.05, 0.09, 0.03, 0.06, 0.02][i]}" step="0.01" class="input-sm" /></div>`;
    volDiv.innerHTML += `<div class="control-group compact"><label>${ASSET_NAMES[i]}</label>
      <input type="number" id="port-vol-${i}" value="${[0.16, 0.06, 0.14, 0.10, 0.18, 0.12, 0.15, 0.02][i]}" step="0.01" class="input-sm" /></div>`;
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      corrDiv.innerHTML += `<div class="control-group compact"><label>ρ(${ASSET_NAMES[i].slice(0,4)},${ASSET_NAMES[j].slice(0,4)})</label>
        <input type="number" id="port-corr-${i}-${j}" value="${i === 0 && j === 1 ? '-0.10' : '0.30'}" step="0.05" min="-1" max="1" class="input-sm" /></div>`;
    }
  }
}

document.getElementById('port-n').addEventListener('input', buildPortfolioInputs);

function getPortfolioParams() {
  const n = +document.getElementById('port-n').value;
  const returns = [], vols = [];
  for (let i = 0; i < n; i++) {
    returns.push(+(document.getElementById('port-ret-' + i)?.value || 0.05));
    vols.push(+(document.getElementById('port-vol-' + i)?.value || 0.10));
  }
  // Build correlation matrix
  const corr = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) corr[i][i] = 1;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const val = +(document.getElementById(`port-corr-${i}-${j}`)?.value || 0.3);
      corr[i][j] = val;
      corr[j][i] = val;
    }
  }
  // Build covariance matrix
  const cov = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => corr[i][j] * vols[i] * vols[j])
  );
  return { n, returns, vols, cov, corr };
}

function randomPortfolio(n, allowShort) {
  let w;
  if (allowShort) {
    w = Array.from({ length: n }, () => randn());
    const s = w.reduce((a, b) => a + b, 0);
    w = w.map(x => x / s);
  } else {
    w = Array.from({ length: n }, () => Math.random());
    const s = w.reduce((a, b) => a + b, 0);
    w = w.map(x => x / s);
  }
  return w;
}

function portfolioStats(w, returns, cov) {
  const n = w.length;
  let ret = 0;
  for (let i = 0; i < n; i++) ret += w[i] * returns[i];
  let variance = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      variance += w[i] * w[j] * cov[i][j];
  return { ret, risk: Math.sqrt(Math.max(0, variance)) };
}

function runPortfolio() {
  const { n, returns, vols, cov } = getPortfolioParams();
  const rf = +document.getElementById('port-rf').value;
  const nMC = +document.getElementById('port-mc').value;
  const allowShort = document.getElementById('port-short').value === 'yes';

  const portfolios = [];
  let bestSharpe = -Infinity, bestIdx = 0;
  let minVar = Infinity, minVarIdx = 0;

  for (let i = 0; i < nMC; i++) {
    const w = randomPortfolio(n, allowShort);
    const { ret, risk } = portfolioStats(w, returns, cov);
    const sharpe = (ret - rf) / risk;
    portfolios.push({ w, ret, risk, sharpe });
    if (sharpe > bestSharpe) { bestSharpe = sharpe; bestIdx = i; }
    if (risk < minVar) { minVar = risk; minVarIdx = i; }
  }

  const optimal = portfolios[bestIdx];
  const minVarPort = portfolios[minVarIdx];

  document.getElementById('port-return').textContent = pct(optimal.ret);
  document.getElementById('port-risk').textContent = pct(optimal.risk);
  document.getElementById('port-sharpe').textContent = fmt(optimal.sharpe);
  document.getElementById('port-minvar').textContent = pct(minVarPort.risk);

  drawFrontier(portfolios, optimal, minVarPort, rf);
  drawAllocation(optimal.w, n);
}

function drawFrontier(portfolios, optimal, minVar, rf) {
  const container = d3.select('#frontier-chart');
  container.selectAll('*').remove();
  const w = container.node().clientWidth;
  const h = 420;
  const margin = { top: 20, right: 30, bottom: 45, left: 65 };
  const iw = w - margin.left - margin.right;
  const ih = h - margin.top - margin.bottom;

  const svg = container.append('svg').attr('width', w).attr('height', h);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain([0, d3.max(portfolios, d => d.risk) * 1.1])
    .range([0, iw]);
  const y = d3.scaleLinear()
    .domain([d3.min(portfolios, d => d.ret) * 0.9, d3.max(portfolios, d => d.ret) * 1.1])
    .range([ih, 0]);

  g.append('g').attr('class', 'grid').call(d3.axisLeft(y).tickSize(-iw).tickFormat(''));
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d => pct(d)));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(8).tickFormat(d => pct(d)));

  g.append('text').attr('x', iw / 2).attr('y', ih + 38).attr('text-anchor', 'middle')
    .attr('class', 'axis-label').text('Risk (σ)');
  g.append('text').attr('transform', 'rotate(-90)').attr('x', -ih / 2).attr('y', -50)
    .attr('text-anchor', 'middle').attr('class', 'axis-label').text('Expected Return');

  // Sharpe color scale
  const sharpeExtent = d3.extent(portfolios, d => d.sharpe);
  const colorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain(sharpeExtent);

  // All portfolios
  g.selectAll('.port-dot')
    .data(portfolios)
    .enter().append('circle')
    .attr('cx', d => x(d.risk))
    .attr('cy', d => y(d.ret))
    .attr('r', 2)
    .attr('fill', d => colorScale(d.sharpe))
    .attr('opacity', 0.5);

  // Capital Market Line
  const cmlSlope = (optimal.ret - rf) / optimal.risk;
  const maxX = d3.max(portfolios, d => d.risk) * 1.1;
  g.append('line')
    .attr('x1', x(0)).attr('y1', y(rf))
    .attr('x2', x(maxX)).attr('y2', y(rf + cmlSlope * maxX))
    .attr('stroke', '#6366f1').attr('stroke-width', 1.5).attr('stroke-dasharray', '6,4');

  // Optimal portfolio
  g.append('circle').attr('cx', x(optimal.risk)).attr('cy', y(optimal.ret))
    .attr('r', 8).attr('fill', '#ef4444').attr('stroke', '#fff').attr('stroke-width', 2);
  g.append('text').attr('x', x(optimal.risk) + 12).attr('y', y(optimal.ret) + 4)
    .text('Max Sharpe').attr('font-size', '0.72rem').attr('fill', '#ef4444').attr('font-weight', '600');

  // Min variance
  g.append('circle').attr('cx', x(minVar.risk)).attr('cy', y(minVar.ret))
    .attr('r', 6).attr('fill', '#22c55e').attr('stroke', '#fff').attr('stroke-width', 2);
  g.append('text').attr('x', x(minVar.risk) + 10).attr('y', y(minVar.ret) + 4)
    .text('Min Variance').attr('font-size', '0.72rem').attr('fill', '#22c55e');

  // Risk-free rate
  g.append('circle').attr('cx', x(0)).attr('cy', y(rf))
    .attr('r', 5).attr('fill', '#3b82f6').attr('stroke', '#fff').attr('stroke-width', 2);
  g.append('text').attr('x', 8).attr('y', y(rf) - 8)
    .text('Rf=' + pct(rf)).attr('font-size', '0.72rem').attr('fill', '#3b82f6');
}

function drawAllocation(weights, n) {
  const container = d3.select('#allocation-chart');
  container.selectAll('*').remove();
  const w_ = container.node().clientWidth;
  const h = 280;
  const margin = { top: 15, right: 20, bottom: 50, left: 100 };
  const iw = w_ - margin.left - margin.right;
  const ih = h - margin.top - margin.bottom;

  const svg = container.append('svg').attr('width', w_).attr('height', h);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const data = weights.map((w, i) => ({ name: ASSET_NAMES[i], weight: w }))
    .sort((a, b) => b.weight - a.weight);

  const y = d3.scaleBand().domain(data.map(d => d.name)).range([0, ih]).padding(0.3);
  const x = d3.scaleLinear().domain([Math.min(0, d3.min(data, d => d.weight)), d3.max(data, d => d.weight)]).nice().range([0, iw]);

  g.append('g').attr('class', 'axis').call(d3.axisLeft(y));
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d => pct(d)));

  g.selectAll('.alloc-bar').data(data).enter().append('rect')
    .attr('x', d => x(Math.min(0, d.weight)))
    .attr('y', d => y(d.name))
    .attr('width', d => Math.abs(x(d.weight) - x(0)))
    .attr('height', y.bandwidth())
    .attr('fill', (d, i) => ASSET_COLORS[i % ASSET_COLORS.length])
    .attr('rx', 3);

  g.selectAll('.alloc-label').data(data).enter().append('text')
    .attr('x', d => d.weight >= 0 ? x(d.weight) + 5 : x(d.weight) - 5)
    .attr('y', d => y(d.name) + y.bandwidth() / 2 + 4)
    .attr('text-anchor', d => d.weight >= 0 ? 'start' : 'end')
    .text(d => pct(d.weight))
    .attr('font-size', '0.72rem').attr('fill', '#64748b');

  // Zero line
  g.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', ih)
    .attr('stroke', '#94a3b8').attr('stroke-dasharray', '4,4');
}

document.querySelectorAll('[data-port-preset]').forEach(btn => {
  btn.addEventListener('click', () => {
    const p = PORT_PRESETS[btn.dataset.portPreset];
    if (!p) return;
    document.getElementById('port-n').value = p.n;
    document.getElementById('port-n').dispatchEvent(new Event('input'));
    setTimeout(() => {
      for (let i = 0; i < p.n; i++) {
        const retEl = document.getElementById('port-ret-' + i);
        const volEl = document.getElementById('port-vol-' + i);
        if (retEl) retEl.value = p.returns[i];
        if (volEl) volEl.value = p.vols[i];
      }
      for (let i = 0; i < p.n; i++) {
        for (let j = i + 1; j < p.n; j++) {
          const el = document.getElementById(`port-corr-${i}-${j}`);
          if (el) el.value = p.corr[i][j];
        }
      }
      runPortfolio();
    }, 50);
  });
});

document.getElementById('port-run').addEventListener('click', runPortfolio);
document.getElementById('port-reset').addEventListener('click', () => {
  document.getElementById('port-n').value = 4;
  document.getElementById('port-rf').value = 0.03;
  document.getElementById('port-mc').value = 5000;
  ['port-n', 'port-rf', 'port-mc'].forEach(id => document.getElementById(id).dispatchEvent(new Event('input')));
  buildPortfolioInputs();
  runPortfolio();
});

// ════════════════════════════════════════════════════════════════
//  TAB 4 — Value at Risk & CVaR
// ════════════════════════════════════════════════════════════════

function runVaR() {
  const portValue = +document.getElementById('var-portfolio').value;
  const mu = +document.getElementById('var-mu').value;
  const vol = +document.getElementById('var-vol').value;
  const horizon = +document.getElementById('var-horizon').value;
  const nSims = +document.getElementById('var-sims').value;
  const method = document.getElementById('var-method').value;
  const df = +document.getElementById('var-df').value;

  const hMu = mu * horizon;
  const hVol = vol * Math.sqrt(horizon);

  // Generate returns based on method
  const returns = [];
  for (let i = 0; i < nSims; i++) {
    let r;
    if (method === 'parametric' || method === 'mc') {
      r = hMu + hVol * randn();
    } else if (method === 't') {
      r = hMu + hVol * randStudentT(df) * Math.sqrt((df - 2) / df);
    } else {
      // Historical — simulate synthetic "historical" with slight skew
      r = hMu + hVol * randn() * (1 + 0.1 * randn());
    }
    returns.push(r);
  }

  returns.sort((a, b) => a - b);

  const var95 = -quantile(returns, 0.05) * portValue;
  const var99 = -quantile(returns, 0.01) * portValue;

  // CVaR = expected loss beyond VaR
  const idx95 = Math.floor(0.05 * nSims);
  const idx99 = Math.floor(0.01 * nSims);
  const cvar95 = -mean(returns.slice(0, idx95)) * portValue;
  const cvar99 = -mean(returns.slice(0, idx99)) * portValue;

  const sk = skewness(returns);
  const ku = kurtosis(returns);

  document.getElementById('var-95').textContent = '$' + fmt(var95, 0);
  document.getElementById('var-99').textContent = '$' + fmt(var99, 0);
  document.getElementById('cvar-95').textContent = '$' + fmt(cvar95, 0);
  document.getElementById('cvar-99').textContent = '$' + fmt(cvar99, 0);
  document.getElementById('var-skew').textContent = fmt(sk, 3);
  document.getElementById('var-kurt').textContent = fmt(ku, 3);

  drawVaRChart(returns, portValue, var95, var99, cvar95, cvar99);
  drawVaRBacktest(portValue, mu, vol, horizon, method, df);
}

function drawVaRChart(returns, portValue, var95, var99, cvar95, cvar99) {
  const container = d3.select('#var-chart');
  container.selectAll('*').remove();
  const w = container.node().clientWidth;
  const h = 380;
  const margin = { top: 20, right: 30, bottom: 45, left: 65 };
  const iw = w - margin.left - margin.right;
  const ih = h - margin.top - margin.bottom;

  const svg = container.append('svg').attr('width', w).attr('height', h);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const losses = returns.map(r => -r * portValue);
  const x = d3.scaleLinear().domain(d3.extent(losses)).nice().range([0, iw]);
  const histogram = d3.bin().domain(x.domain()).thresholds(60);
  const bins = histogram(losses);
  const y = d3.scaleLinear().domain([0, d3.max(bins, d => d.length)]).range([ih, 0]);

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d => '$' + fmt(d, 0)));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(6));

  g.append('text').attr('x', iw / 2).attr('y', ih + 38).attr('text-anchor', 'middle')
    .attr('class', 'axis-label').text('Loss (negative = gain)');

  g.selectAll('.hist-bar').data(bins).enter().append('rect')
    .attr('x', d => x(d.x0) + 1)
    .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 2))
    .attr('y', d => y(d.length))
    .attr('height', d => ih - y(d.length))
    .attr('fill', d => d.x0 >= var95 ? '#f87171' : d.x0 >= 0 ? '#94a3b8' : '#6ee7b7')
    .attr('opacity', 0.7);

  // VaR lines
  [[var95, '95% VaR', '#f59e0b'], [var99, '99% VaR', '#ef4444']].forEach(([val, label, color]) => {
    g.append('line').attr('x1', x(val)).attr('x2', x(val)).attr('y1', 0).attr('y2', ih)
      .attr('stroke', color).attr('stroke-width', 2).attr('stroke-dasharray', '6,3');
    g.append('text').attr('x', x(val) + 5).attr('y', 15).text(label + ': $' + fmt(val, 0))
      .attr('font-size', '0.72rem').attr('fill', color).attr('font-weight', '600');
  });

  // CVaR shading for 95%
  const cvarX = x(var95);
  g.append('rect').attr('x', cvarX).attr('y', 0).attr('width', iw - cvarX).attr('height', ih)
    .attr('fill', '#ef4444').attr('opacity', 0.06);
}

function drawVaRBacktest(portValue, mu, vol, horizon, method, df) {
  const container = d3.select('#var-backtest-chart');
  container.selectAll('*').remove();
  const w = container.node().clientWidth;
  const h = 280;
  const margin = { top: 15, right: 30, bottom: 40, left: 65 };
  const iw = w - margin.left - margin.right;
  const ih = h - margin.top - margin.bottom;

  const svg = container.append('svg').attr('width', w).attr('height', h);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Simulate 500 days of returns
  const nDays = 500;
  const dailyReturns = [];
  const varLine = [];
  const hVol = vol * Math.sqrt(horizon);
  const hMu = mu * horizon;

  for (let i = 0; i < nDays; i++) {
    let r;
    if (method === 't') {
      r = hMu + hVol * randStudentT(df) * Math.sqrt((df - 2) / df);
    } else {
      r = hMu + hVol * randn();
    }
    dailyReturns.push(r * portValue);
    // Rolling VaR estimate (parametric)
    varLine.push(-(-1.645 * hVol + hMu) * portValue);
  }

  const x = d3.scaleLinear().domain([0, nDays]).range([0, iw]);
  const allVals = dailyReturns.concat(varLine.map(v => -v));
  const y = d3.scaleLinear().domain(d3.extent(allVals)).nice().range([ih, 0]);

  g.append('g').attr('class', 'grid').call(d3.axisLeft(y).tickSize(-iw).tickFormat(''));
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(10).tickFormat(d => 'Day ' + d));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(6).tickFormat(d => '$' + fmt(d, 0)));

  // Zero line
  g.append('line').attr('x1', 0).attr('x2', iw).attr('y1', y(0)).attr('y2', y(0))
    .attr('stroke', '#94a3b8').attr('stroke-width', 1);

  // P&L bars
  g.selectAll('.pnl-bar').data(dailyReturns).enter().append('rect')
    .attr('x', (d, i) => x(i))
    .attr('width', Math.max(1, iw / nDays - 1))
    .attr('y', d => d >= 0 ? y(d) : y(0))
    .attr('height', d => Math.abs(y(d) - y(0)))
    .attr('fill', (d, i) => d < -varLine[i] ? '#ef4444' : d < 0 ? '#f59e0b' : '#22c55e')
    .attr('opacity', 0.7);

  // VaR line (negative)
  const varLinePath = d3.line().x((d, i) => x(i)).y(d => y(-d));
  g.append('path').datum(varLine).attr('fill', 'none').attr('stroke', '#ef4444')
    .attr('stroke-width', 1.5).attr('stroke-dasharray', '4,3').attr('d', varLinePath);

  const exceedances = dailyReturns.filter((r, i) => r < -varLine[i]).length;
  g.append('text').attr('x', iw - 5).attr('y', 15).attr('text-anchor', 'end')
    .text(`Exceedances: ${exceedances}/${nDays} (${pct(exceedances / nDays)})`)
    .attr('font-size', '0.72rem').attr('fill', '#ef4444').attr('font-weight', '600');
}

document.getElementById('var-run').addEventListener('click', runVaR);
document.getElementById('var-reset').addEventListener('click', () => {
  const defaults = { 'var-portfolio': 1000000, 'var-mu': 0.0003, 'var-vol': 0.015, 'var-horizon': 1, 'var-sims': 10000, 'var-df': 5 };
  Object.entries(defaults).forEach(([id, v]) => {
    document.getElementById(id).value = v;
    document.getElementById(id).dispatchEvent(new Event('input'));
  });
  document.getElementById('var-method').value = 'mc';
  runVaR();
});

// ════════════════════════════════════════════════════════════════
//  TAB 5 — Interest Rate Models
// ════════════════════════════════════════════════════════════════

function simulateIR(model, r0, kappa, theta, sigma, T, nPaths) {
  const steps = Math.max(500, Math.round(T * 252));
  const dt = T / steps;
  const sqrtDt = Math.sqrt(dt);
  const paths = [];

  for (let p = 0; p < nPaths; p++) {
    const path = [r0];
    let r = r0;
    for (let i = 1; i <= steps; i++) {
      const z = randn();
      if (model === 'vasicek') {
        r = r + kappa * (theta - r) * dt + sigma * sqrtDt * z;
      } else if (model === 'cir') {
        const sqrtR = Math.sqrt(Math.max(0, r));
        r = r + kappa * (theta - r) * dt + sigma * sqrtR * sqrtDt * z;
        r = Math.max(0, r);
      } else { // hull-white (time-homogeneous approximation)
        r = r + kappa * (theta - r) * dt + sigma * sqrtDt * z;
      }
      path.push(r);
    }
    paths.push(path);
  }
  return { paths, steps };
}

function bondPriceVasicek(r, kappa, theta, sigma, T) {
  if (T <= 0) return 1;
  const B = (1 - Math.exp(-kappa * T)) / kappa;
  const A = Math.exp((theta - sigma * sigma / (2 * kappa * kappa)) * (B - T)
    - sigma * sigma * B * B / (4 * kappa));
  return A * Math.exp(-B * r);
}

function drawIRChart(result, T) {
  const container = d3.select('#ir-chart');
  container.selectAll('*').remove();
  const w = container.node().clientWidth;
  const h = 400;
  const margin = { top: 20, right: 30, bottom: 45, left: 65 };
  const iw = w - margin.left - margin.right;
  const ih = h - margin.top - margin.bottom;

  const svg = container.append('svg').attr('width', w).attr('height', h);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const { paths, steps } = result;
  const x = d3.scaleLinear().domain([0, T]).range([0, iw]);
  const allVals = paths.flat();
  const y = d3.scaleLinear()
    .domain([Math.min(0, d3.min(allVals)), d3.max(allVals) * 1.1])
    .range([ih, 0]);

  g.append('g').attr('class', 'grid').call(d3.axisLeft(y).tickSize(-iw).tickFormat(''));
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d => d.toFixed(0) + 'y'));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(8).tickFormat(d => pct(d)));

  g.append('text').attr('x', iw / 2).attr('y', ih + 38).attr('text-anchor', 'middle')
    .attr('class', 'axis-label').text('Time (years)');
  g.append('text').attr('transform', 'rotate(-90)').attr('x', -ih / 2).attr('y', -50)
    .attr('text-anchor', 'middle').attr('class', 'axis-label').text('Interest Rate');

  const color = d3.scaleSequential(d3.interpolateCool).domain([0, paths.length]);
  const line = d3.line()
    .x((d, i) => x(i * T / steps))
    .y(d => y(d));

  paths.forEach((path, pi) => {
    // Subsample for performance
    const sub = path.filter((_, i) => i % Math.max(1, Math.floor(steps / 500)) === 0 || i === steps);
    const subLine = d3.line()
      .x((d, i) => x(i * Math.max(1, Math.floor(steps / 500)) * T / steps))
      .y(d => y(d));
    g.append('path').datum(sub)
      .attr('fill', 'none')
      .attr('stroke', color(pi))
      .attr('stroke-width', paths.length > 50 ? 0.5 : 1)
      .attr('stroke-opacity', paths.length > 50 ? 0.3 : 0.5)
      .attr('d', subLine);
  });

  // Long-run mean line
  const theta = +document.getElementById('ir-theta').value;
  g.append('line').attr('x1', 0).attr('x2', iw).attr('y1', y(theta)).attr('y2', y(theta))
    .attr('stroke', '#ef4444').attr('stroke-width', 2).attr('stroke-dasharray', '8,4');
  g.append('text').attr('x', iw - 5).attr('y', y(theta) - 8).attr('text-anchor', 'end')
    .text('θ = ' + pct(theta)).attr('font-size', '0.72rem').attr('fill', '#ef4444');

  // Zero line if visible
  if (d3.min(allVals) < 0) {
    g.append('line').attr('x1', 0).attr('x2', iw).attr('y1', y(0)).attr('y2', y(0))
      .attr('stroke', '#94a3b8').attr('stroke-width', 1).attr('stroke-dasharray', '4,4');
  }
}

function drawYieldCurve(model, r0, kappa, theta, sigma) {
  const container = d3.select('#ir-yield-chart');
  container.selectAll('*').remove();
  const w = container.node().clientWidth;
  const h = 280;
  const margin = { top: 15, right: 30, bottom: 40, left: 65 };
  const iw = w - margin.left - margin.right;
  const ih = h - margin.top - margin.bottom;

  const svg = container.append('svg').attr('width', w).attr('height', h);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const maturities = d3.range(0.25, 30.25, 0.25);
  const yields = maturities.map(T => {
    if (model === 'vasicek' || model === 'hull-white') {
      const P = bondPriceVasicek(r0, kappa, theta, sigma, T);
      return -Math.log(P) / T;
    } else {
      // CIR analytical
      const h_ = Math.sqrt(kappa * kappa + 2 * sigma * sigma);
      const num = 2 * h_ * Math.exp((kappa + h_) * T / 2);
      const den = (kappa + h_) * (Math.exp(h_ * T) - 1) + 2 * h_;
      const A = Math.pow(num / den, 2 * kappa * theta / (sigma * sigma));
      const B = 2 * (Math.exp(h_ * T) - 1) / den;
      const P = A * Math.exp(-B * r0);
      return -Math.log(Math.max(1e-10, P)) / T;
    }
  });

  const x = d3.scaleLinear().domain([0, 30]).range([0, iw]);
  const y = d3.scaleLinear().domain(d3.extent(yields)).nice().range([ih, 0]);

  g.append('g').attr('class', 'grid').call(d3.axisLeft(y).tickSize(-iw).tickFormat(''));
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d => d + 'y'));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(6).tickFormat(d => pct(d)));

  g.append('text').attr('x', iw / 2).attr('y', ih + 35).attr('text-anchor', 'middle')
    .attr('class', 'axis-label').text('Maturity');
  g.append('text').attr('transform', 'rotate(-90)').attr('x', -ih / 2).attr('y', -50)
    .attr('text-anchor', 'middle').attr('class', 'axis-label').text('Yield');

  const line = d3.line().x((d, i) => x(maturities[i])).y(d => y(d)).curve(d3.curveMonotoneX);
  g.append('path').datum(yields).attr('fill', 'none').attr('stroke', '#6366f1')
    .attr('stroke-width', 2.5).attr('d', line);
}

function runIR() {
  const model = document.getElementById('ir-model').value;
  const r0 = +document.getElementById('ir-r0').value;
  const kappa = +document.getElementById('ir-kappa').value;
  const theta = +document.getElementById('ir-theta').value;
  const sigma = +document.getElementById('ir-sigma').value;
  const T = +document.getElementById('ir-T').value;
  const nPaths = +document.getElementById('ir-paths').value;

  const result = simulateIR(model, r0, kappa, theta, sigma, T, nPaths);
  drawIRChart(result, T);
  drawYieldCurve(model, r0, kappa, theta, sigma);

  const finals = result.paths.map(p => p[p.length - 1]);
  document.getElementById('ir-mean').textContent = pct(mean(finals));
  document.getElementById('ir-std').textContent = pct(std(finals));
  document.getElementById('ir-longrun').textContent = pct(theta);
  document.getElementById('ir-halflife').textContent = fmt(Math.log(2) / kappa, 2) + 'y';
}

document.getElementById('ir-run').addEventListener('click', runIR);
document.getElementById('ir-reset').addEventListener('click', () => {
  const defaults = { 'ir-r0': 0.05, 'ir-kappa': 0.5, 'ir-theta': 0.05, 'ir-sigma': 0.02, 'ir-T': 10, 'ir-paths': 30 };
  Object.entries(defaults).forEach(([id, v]) => {
    document.getElementById(id).value = v;
    document.getElementById(id).dispatchEvent(new Event('input'));
  });
  document.getElementById('ir-model').value = 'vasicek';
  runIR();
});

// ════════════════════════════════════════════════════════════════
//  TAB 6 — Merton Jump-Diffusion
// ════════════════════════════════════════════════════════════════

function simulateJD(S0, mu, sigma, lambda, muJ, sigmaJ, T, nPaths) {
  const steps = Math.max(252, Math.round(T * 252));
  const dt = T / steps;
  const drift = (mu - 0.5 * sigma * sigma - lambda * (Math.exp(muJ + 0.5 * sigmaJ * sigmaJ) - 1)) * dt;
  const diffusion = sigma * Math.sqrt(dt);
  const paths = [];
  let totalJumps = 0;

  for (let p = 0; p < nPaths; p++) {
    const path = [S0];
    let s = S0;
    let pathJumps = 0;
    for (let i = 1; i <= steps; i++) {
      const nJ = randPoisson(lambda * dt);
      let jumpSum = 0;
      for (let j = 0; j < nJ; j++) {
        jumpSum += muJ + sigmaJ * randn();
        pathJumps++;
      }
      s = s * Math.exp(drift + diffusion * randn() + jumpSum);
      path.push(Math.max(0.001, s));
    }
    paths.push(path);
    totalJumps += pathJumps;
  }
  return { paths, steps, avgJumps: totalJumps / nPaths };
}

function drawJDChart(result, T) {
  const container = d3.select('#jd-chart');
  container.selectAll('*').remove();
  const w = container.node().clientWidth;
  const h = 400;
  const margin = { top: 20, right: 30, bottom: 45, left: 65 };
  const iw = w - margin.left - margin.right;
  const ih = h - margin.top - margin.bottom;

  const svg = container.append('svg').attr('width', w).attr('height', h);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const { paths, steps } = result;
  const x = d3.scaleLinear().domain([0, T]).range([0, iw]);
  const allVals = paths.flat();
  const y = d3.scaleLinear().domain([0, d3.max(allVals) * 1.05]).range([ih, 0]);

  g.append('g').attr('class', 'grid').call(d3.axisLeft(y).tickSize(-iw).tickFormat(''));
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d => d.toFixed(1) + 'y'));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(8).tickFormat(d => '$' + fmt(d, 0)));

  g.append('text').attr('x', iw / 2).attr('y', ih + 38).attr('text-anchor', 'middle')
    .attr('class', 'axis-label').text('Time (years)');
  g.append('text').attr('transform', 'rotate(-90)').attr('x', -ih / 2).attr('y', -50)
    .attr('text-anchor', 'middle').attr('class', 'axis-label').text('Price ($)');

  const color = d3.scaleSequential(d3.interpolatePlasma).domain([0, paths.length]);
  const subRate = Math.max(1, Math.floor(steps / 500));

  paths.forEach((path, pi) => {
    const sub = path.filter((_, i) => i % subRate === 0 || i === steps);
    const subLine = d3.line()
      .x((d, i) => x(i * subRate * T / steps))
      .y(d => y(d));
    g.append('path').datum(sub)
      .attr('fill', 'none')
      .attr('stroke', color(pi))
      .attr('stroke-width', paths.length > 100 ? 0.5 : 1.2)
      .attr('stroke-opacity', paths.length > 100 ? 0.3 : 0.6)
      .attr('d', subLine);
  });
}

function drawJDDistComparison(jdPaths, S0, mu, sigma, T) {
  const container = d3.select('#jd-dist-chart');
  container.selectAll('*').remove();
  const w = container.node().clientWidth;
  const h = 280;
  const margin = { top: 15, right: 30, bottom: 40, left: 55 };
  const iw = w - margin.left - margin.right;
  const ih = h - margin.top - margin.bottom;

  const svg = container.append('svg').attr('width', w).attr('height', h);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Log returns
  const jdReturns = jdPaths.map(p => Math.log(p[p.length - 1] / S0));
  // GBM returns for comparison
  const gbmReturns = [];
  const nSims = jdPaths.length;
  for (let i = 0; i < nSims; i++) {
    gbmReturns.push((mu - 0.5 * sigma * sigma) * T + sigma * Math.sqrt(T) * randn());
  }

  const allRets = jdReturns.concat(gbmReturns);
  const x = d3.scaleLinear().domain(d3.extent(allRets)).nice().range([0, iw]);

  const histogram = d3.bin().domain(x.domain()).thresholds(50);
  const jdBins = histogram(jdReturns);
  const gbmBins = histogram(gbmReturns);

  const maxCount = d3.max([...jdBins, ...gbmBins], d => d.length);
  const y = d3.scaleLinear().domain([0, maxCount]).range([ih, 0]);

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d => (d * 100).toFixed(0) + '%'));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(5));

  g.append('text').attr('x', iw / 2).attr('y', ih + 35).attr('text-anchor', 'middle')
    .attr('class', 'axis-label').text('Log Return');

  // GBM bars
  g.selectAll('.gbm-bar').data(gbmBins).enter().append('rect')
    .attr('x', d => x(d.x0) + 1)
    .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 2))
    .attr('y', d => y(d.length))
    .attr('height', d => ih - y(d.length))
    .attr('fill', '#60a5fa').attr('opacity', 0.4);

  // JD bars
  g.selectAll('.jd-bar').data(jdBins).enter().append('rect')
    .attr('x', d => x(d.x0) + 1)
    .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 2))
    .attr('y', d => y(d.length))
    .attr('height', d => ih - y(d.length))
    .attr('fill', '#f97316').attr('opacity', 0.5);

  // Legend
  const lg = g.append('g').attr('transform', `translate(${iw - 130}, 5)`);
  lg.append('rect').attr('width', 12).attr('height', 12).attr('fill', '#60a5fa').attr('opacity', 0.5);
  lg.append('text').attr('x', 16).attr('y', 10).text('GBM').attr('font-size', '0.72rem').attr('fill', '#64748b');
  lg.append('rect').attr('y', 18).attr('width', 12).attr('height', 12).attr('fill', '#f97316').attr('opacity', 0.6);
  lg.append('text').attr('x', 16).attr('y', 28).text('Jump-Diffusion').attr('font-size', '0.72rem').attr('fill', '#64748b');
}

function runJD() {
  const S0 = +document.getElementById('jd-s0').value;
  const mu = +document.getElementById('jd-mu').value;
  const sigma = +document.getElementById('jd-sigma').value;
  const lambda = +document.getElementById('jd-lambda').value;
  const muJ = +document.getElementById('jd-muj').value;
  const sigmaJ = +document.getElementById('jd-sigmaj').value;
  const T = +document.getElementById('jd-T').value;
  const nPaths = +document.getElementById('jd-paths').value;

  const result = simulateJD(S0, mu, sigma, lambda, muJ, sigmaJ, T, nPaths);
  drawJDChart(result, T);
  drawJDDistComparison(result.paths, S0, mu, sigma, T);

  const finals = result.paths.map(p => p[p.length - 1]);
  const logReturns = finals.map(f => Math.log(f / S0));
  document.getElementById('jd-mean').textContent = '$' + fmt(mean(finals), 0);
  document.getElementById('jd-std').textContent = '$' + fmt(std(finals), 0);
  document.getElementById('jd-jumps').textContent = fmt(result.avgJumps, 1);
  document.getElementById('jd-kurt').textContent = fmt(kurtosis(logReturns), 2);
}

document.getElementById('jd-run').addEventListener('click', runJD);
document.getElementById('jd-reset').addEventListener('click', () => {
  const defaults = { 'jd-s0': 100, 'jd-mu': 0.08, 'jd-sigma': 0.15, 'jd-lambda': 2, 'jd-muj': -0.05, 'jd-sigmaj': 0.10, 'jd-T': 1, 'jd-paths': 50 };
  Object.entries(defaults).forEach(([id, v]) => {
    document.getElementById(id).value = v;
    document.getElementById(id).dispatchEvent(new Event('input'));
  });
  runJD();
});

// ════════════════════════════════════════════════════════════════
//  TAB 7 — Theory & Literature (KaTeX equations)
// ════════════════════════════════════════════════════════════════

function renderEquations() {
  const eqs = {
    'eq-gbm': 'dS_t = \\mu S_t \\, dt + \\sigma S_t \\, dW_t \\quad \\Rightarrow \\quad S_t = S_0 \\exp\\!\\left[\\left(\\mu - \\tfrac{\\sigma^2}{2}\\right)t + \\sigma W_t\\right]',

    'eq-bs-call': 'C(S,t) = S e^{-qT} \\Phi(d_1) - K e^{-rT} \\Phi(d_2)',
    'eq-bs-put': 'P(S,t) = K e^{-rT} \\Phi(-d_2) - S e^{-qT} \\Phi(-d_1)',
    'eq-bs-d1d2': 'd_1 = \\frac{\\ln(S/K) + (r - q + \\sigma^2/2)T}{\\sigma\\sqrt{T}}, \\quad d_2 = d_1 - \\sigma\\sqrt{T}',

    'eq-greeks': '\\Delta = \\frac{\\partial C}{\\partial S} = e^{-qT}\\Phi(d_1), \\quad \\Gamma = \\frac{\\partial^2 C}{\\partial S^2}, \\quad \\mathcal{V} = \\frac{\\partial C}{\\partial \\sigma}, \\quad \\Theta = \\frac{\\partial C}{\\partial t}, \\quad \\rho = \\frac{\\partial C}{\\partial r}',

    'eq-portfolio': '\\min_w \; w^\\top \\Sigma w \\quad \\text{s.t.} \\quad w^\\top \\mu = \\mu_p, \\quad w^\\top \\mathbf{1} = 1 \\qquad \\text{Sharpe} = \\frac{\\mu_p - r_f}{\\sigma_p}',

    'eq-var': '\\text{VaR}_\\alpha = -\\inf\\{x : P(L \\le x) \\ge 1-\\alpha\\}, \\qquad \\text{CVaR}_\\alpha = E[L \\mid L \\ge \\text{VaR}_\\alpha]',

    'eq-vasicek': '\\text{Vasicek:} \\quad dr_t = \\kappa(\\theta - r_t)\\,dt + \\sigma\\,dW_t',
    'eq-cir': '\\text{CIR:} \\quad dr_t = \\kappa(\\theta - r_t)\\,dt + \\sigma\\sqrt{r_t}\\,dW_t \\qquad (\\text{Feller: } 2\\kappa\\theta > \\sigma^2)',

    'eq-merton': '\\frac{dS_t}{S_{t^-}} = \\mu\\,dt + \\sigma\\,dW_t + J\\,dN_t, \\quad J \\sim \\mathcal{N}(\\mu_J, \\sigma_J^2), \\quad N_t \\sim \\text{Poisson}(\\lambda t)',
  };

  Object.entries(eqs).forEach(([id, tex]) => {
    const el = document.getElementById(id);
    if (el) {
      try {
        katex.render(tex, el, { displayMode: true, throwOnError: false });
      } catch (e) {
        el.textContent = tex;
      }
    }
  });
}

// ── Initialization ───────────────────────────────────────────
function init() {
  buildPortfolioInputs();
  renderEquations();

  // Auto-run first tab
  runGBM();
}

// Run after DOM + KaTeX loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
