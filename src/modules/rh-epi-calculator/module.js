// ═══════════════════════════════════════════════════════════════
// Rural Epidemiology Calculator Suite — module.js
// ═══════════════════════════════════════════════════════════════

// Chart.js is loaded via CDN script tag before this module runs
// It is available as the global `Chart`

// ── UTILITIES ──────────────────────────────────────────────────
function fmt(n, d = 2) { return isFinite(n) ? n.toFixed(d) : '-'; }
function fmtPct(n, d = 1) { return isFinite(n) ? (n * 100).toFixed(d) + '%' : '-'; }
function fmtN(n) { return isFinite(n) ? Math.round(n).toLocaleString() : '-'; }

const PALETTE = {
  navy: '#1B3A5C', teal: '#2E7D6B', gold: '#B5892A', rust: '#A63D2F',
  blue: '#2563EB', green: '#16A34A', purple: '#7C3AED', orange: '#EA580C',
};

// Bug fix: original had missing `)` before `=>` in destructuring parameter
function resultBoxes(items) {
  return items.map(([label, val, unit = '', cls = '']) =>
    `<div class="epi-result-box ${cls}">
      <div class="epi-result-label">${label}</div>
      <div class="epi-result-value">${val}<span class="epi-result-unit">${unit}</span></div>
    </div>`
  ).join('');
}

// ── TAB SWITCHING ──────────────────────────────────────────────
const TAB_IDS = ['seir', 'r0', 'attack', 'diag', 'rates', 'ci'];

function switchTab(id) {
  document.querySelectorAll('#epi-tab-bar .tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.epi-panel').forEach(p => p.classList.remove('active'));
  const tab = document.querySelector(`#epi-tab-bar [data-tab="${id}"]`);
  if (tab) tab.classList.add('active');
  const panel = document.getElementById('epi-panel-' + id);
  if (panel) panel.classList.add('active');
  // Lazy-init / recalc
  if (id === 'seir') { if (!seirChart) initSEIR(); else runSEIR(); }
  if (id === 'r0') { calcR0(); initHITChart(); }
  if (id === 'attack') calcAttack();
  if (id === 'diag') { calcDiag(); initDiagChart(); }
  if (id === 'rates') { calcRates(); calcNNT(); calcYPLL(); }
  if (id === 'ci') { calcCI(); calcMultiYear(); initCIChart(); }
}

// ═══════════════════════════════════════════════════════════════
// PANEL 1: SEIR/SEIRD MODEL (Runge-Kutta 4)
// ═══════════════════════════════════════════════════════════════
let seirChart = null;

const sliderMap = {
  N: v => parseInt(v).toLocaleString(),
  S0: v => v + '%',
  vacc: v => v + '%',
  beta: v => parseFloat(v).toFixed(2),
  gamma: v => parseFloat(v).toFixed(2),
  sigma: v => parseFloat(v).toFixed(2),
  mu: v => parseFloat(v).toFixed(1) + '%',
  days: v => v,
};

function updateVal(id) {
  const v = document.getElementById('r-' + id).value;
  document.getElementById('v-' + id).textContent = sliderMap[id](v);
}

function rk4Step(s, e, i, r, d, beta, sigma, gamma, mu, N, dt) {
  const f = (S, E, I) => {
    const dS = -beta * S * I / N;
    const dE = beta * S * I / N - sigma * E;
    const dI = sigma * E - gamma * I;
    const dR = gamma * (1 - mu) * I;
    const dD = gamma * mu * I;
    return [dS, dE, dI, dR, dD];
  };
  const [ds1, de1, di1, dr1, dd1] = f(s, e, i);
  const [ds2, de2, di2, dr2, dd2] = f(s + .5 * dt * ds1, e + .5 * dt * de1, i + .5 * dt * di1);
  const [ds3, de3, di3, dr3, dd3] = f(s + .5 * dt * ds2, e + .5 * dt * de2, i + .5 * dt * di2);
  const [ds4, de4, di4, dr4, dd4] = f(s + dt * ds3, e + dt * de3, i + dt * di3);
  return [
    s + dt / 6 * (ds1 + 2 * ds2 + 2 * ds3 + ds4),
    e + dt / 6 * (de1 + 2 * de2 + 2 * de3 + de4),
    i + dt / 6 * (di1 + 2 * di2 + 2 * di3 + di4),
    r + dt / 6 * (dr1 + 2 * dr2 + 2 * dr3 + dr4),
    d + dt / 6 * (dd1 + 2 * dd2 + 2 * dd3 + dd4),
  ];
}

function runSEIR() {
  const N = parseFloat(document.getElementById('r-N').value);
  const s0pct = parseFloat(document.getElementById('r-S0').value) / 100;
  const vaccPct = parseFloat(document.getElementById('r-vacc').value) / 100;
  const beta = parseFloat(document.getElementById('r-beta').value);
  const gamma = parseFloat(document.getElementById('r-gamma').value);
  const sigma = parseFloat(document.getElementById('r-sigma').value);
  const mu = parseFloat(document.getElementById('r-mu').value) / 100;
  const days = parseInt(document.getElementById('r-days').value);
  const dt = 0.5, sPerDay = Math.round(1 / dt);
  const effS0 = Math.max(0, Math.min(1, s0pct - vaccPct));
  let [S, E, I, R, D] = [N * effS0, N * 0.001, 0, N * (1 - effS0 - 0.001), 0];
  const sArr = [S], eArr = [E], iArr = [I], rArr = [R], dArr = [D];
  let peakI = I, peakDay = 0;
  for (let day = 1; day <= days; day++) {
    for (let t = 0; t < sPerDay; t++) {
      [S, E, I, R, D] = rk4Step(S, E, I, R, D, beta, sigma, gamma, mu, N, dt);
      [S, E, I, R, D] = [Math.max(0, S), Math.max(0, E), Math.max(0, I), Math.max(0, R), Math.max(0, D)];
    }
    if (I > peakI) { peakI = I; peakDay = day; }
    sArr.push(S); eArr.push(E); iArr.push(I); rArr.push(R); dArr.push(D);
  }
  const r0 = beta / gamma;
  const far = (N - S) / N;
  const labels = Array.from({ length: days + 1 }, (_, i) => i);
  if (!seirChart) initSEIR();
  seirChart.data.labels = labels;
  seirChart.data.datasets[0].data = sArr;
  seirChart.data.datasets[1].data = eArr;
  seirChart.data.datasets[2].data = iArr;
  seirChart.data.datasets[3].data = rArr;
  seirChart.data.datasets[4].data = dArr;
  seirChart.update('none');
  document.getElementById('seir-results').innerHTML = resultBoxes([
    ['R₀', fmt(r0, 2), '', ''],
    ['Peak Infectious', fmtN(peakI), ' persons', 'gold'],
    ['Peak Day', peakDay, ' days', ''],
    ['Final Attack Rate', fmtPct(far), '', ''],
    ['Total Deaths', fmtN(D), ' persons', 'rust'],
    ['HIT', fmtPct(r0 > 1 ? 1 - 1 / r0 : 0), '', ''],
  ]);
  const hit = r0 > 1 ? 1 - 1 / r0 : 0;
  const vacc = parseFloat(document.getElementById('r-vacc').value) / 100;
  let interp = `<strong>R₀ = ${fmt(r0, 2)}</strong> — `;
  if (r0 < 1) interp += 'Epidemic cannot sustain. Each case generates fewer than one secondary case.';
  else if (r0 < 2) interp += `Slow growth. Final attack rate ~${fmtPct(far)}. HIT = ${fmtPct(hit)}.`;
  else interp += `Significant outbreak expected. Peak at day ${peakDay} (${fmtN(peakI)} simultaneously infectious). Final attack rate: ${fmtPct(far)}. Total deaths: ~${fmtN(D)}.`;
  if (vacc > 0) interp += ` Current vaccination (${(vacc * 100).toFixed(0)}%) ${vacc >= hit ? '<strong>exceeds HIT — epidemic suppressed.</strong>' : 'does not yet reach HIT of ' + fmtPct(hit) + '.'}`;
  document.getElementById('seir-interp').innerHTML = interp;
}

function initSEIR() {
  const ctx = document.getElementById('seirChart').getContext('2d');
  seirChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [], datasets: [
        { label: 'Susceptible (S)', borderColor: PALETTE.navy, backgroundColor: 'rgba(27,58,92,.08)', fill: true, pointRadius: 0, tension: .4, data: [] },
        { label: 'Exposed (E)', borderColor: PALETTE.gold, backgroundColor: 'rgba(181,137,42,.08)', fill: true, pointRadius: 0, tension: .4, data: [] },
        { label: 'Infectious (I)', borderColor: PALETTE.rust, backgroundColor: 'rgba(166,61,47,.15)', fill: true, pointRadius: 0, tension: .4, data: [] },
        { label: 'Recovered (R)', borderColor: PALETTE.teal, backgroundColor: 'rgba(46,125,107,.08)', fill: true, pointRadius: 0, tension: .4, data: [] },
        { label: 'Deaths (D)', borderColor: '#374151', backgroundColor: 'rgba(55,65,81,.06)', fill: true, pointRadius: 0, tension: .4, data: [] },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 14 } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${Math.round(ctx.parsed.y).toLocaleString()}` } }
      },
      scales: {
        x: { title: { display: true, text: 'Day', font: { size: 11 } }, ticks: { maxTicksLimit: 12 } },
        y: { title: { display: true, text: 'Persons', font: { size: 11 } }, ticks: { callback: v => v.toLocaleString() } },
      }
    }
  });
  runSEIR();
}

// ═══════════════════════════════════════════════════════════════
// PANEL 2: R₀ / HERD IMMUNITY
// ═══════════════════════════════════════════════════════════════
let hitChart = null;

function calcR0() {
  const beta = parseFloat(document.getElementById('r0-beta').value) || 0;
  const gamma = parseFloat(document.getElementById('r0-gamma').value) || 1;
  const immPct = parseFloat(document.getElementById('r0-immune').value) || 0;
  const directVal = document.getElementById('r0-direct').value;
  const r0 = directVal ? (parseFloat(directVal) || 0) : beta / gamma;
  showR0Results(r0, immPct / 100);
}

function showR0Results(r0, immFrac) {
  const hit = r0 > 1 ? 1 - 1 / r0 : 0;
  const reff = r0 * (1 - immFrac);
  let ar = 0;
  if (r0 > 1) {
    let x = 0.5;
    for (let i = 0; i < 100; i++) x = 1 - Math.exp(-r0 * x);
    ar = x;
  }
  const gammaDays = parseFloat(document.getElementById('r0-gamma').value) || 0.1;
  // Bug fix: original had broken `.map(i=>(i[3]==='teal'?{...i,3:''}:i))` — pass items directly
  document.getElementById('r0-results').innerHTML = resultBoxes([
    ['Basic R₀', fmt(r0, 2), '', ''],
    ['Effective Rₑ', fmt(reff, 2), '', reff < 1 ? '' : 'warn'],
    ['HIT', fmtPct(hit), '', 'gold'],
    ['Final Attack Rate', fmtPct(ar), '', 'rust'],
    ['Infectious Period', fmt(1 / gammaDays, 1), ' days', ''],
  ]);
  if (hitChart) updateHITChart(r0);
}

function initHITChart() {
  if (hitChart) return;
  const ctx = document.getElementById('hitChart').getContext('2d');
  const r0vals = Array.from({ length: 200 }, (_, i) => 1 + (i / 199) * 19);
  const hits = r0vals.map(r => (1 - 1 / r) * 100);
  hitChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: r0vals.map(v => v.toFixed(1)),
      datasets: [{
        label: 'Herd Immunity Threshold (%)', data: hits,
        borderColor: PALETTE.teal, backgroundColor: 'rgba(46,125,107,.12)',
        fill: true, pointRadius: 0, tension: .4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: 'Basic Reproduction Number (R₀)' }, ticks: { maxTicksLimit: 10 } },
        y: { title: { display: true, text: 'HIT (%)' }, min: 0, max: 100 },
      }
    }
  });
}

function updateHITChart(r0) { /* future: add vertical marker */ }

// ═══════════════════════════════════════════════════════════════
// PANEL 3: ATTACK RATE TABLE
// ═══════════════════════════════════════════════════════════════
let attackChart = null;

function addAttackRow() {
  const tbody = document.getElementById('attack-rows');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="epi-input" value="New Food Item"></td>
    <td><input type="number" class="epi-input" value="0" min="0"></td>
    <td><input type="number" class="epi-input" value="50" min="1"></td>
    <td><input type="number" class="epi-input" value="0" min="0"></td>
    <td><input type="number" class="epi-input" value="50" min="1"></td>
    <td><button class="epi-btn epi-btn-danger epi-remove-row" style="padding:.3rem .6rem;font-size:.75rem">✕</button></td>`;
  tbody.appendChild(tr);
  // bind remove button
  tr.querySelector('.epi-remove-row').addEventListener('click', e => { e.target.closest('tr').remove(); calcAttack(); });
  calcAttack();
}

function calcAttack() {
  const rows = document.querySelectorAll('#attack-rows tr');
  const data = [];
  rows.forEach(row => {
    const inputs = row.querySelectorAll('input');
    const name = inputs[0].value || 'Item';
    const illE = +inputs[1].value || 0, totE = +inputs[2].value || 1;
    const illNE = +inputs[3].value || 0, totNE = +inputs[4].value || 1;
    const arE = illE / totE, arNE = illNE / totNE;
    const rr = arNE > 0 ? arE / arNE : arE > 0 ? Infinity : 1;
    const ard = arE - arNE;
    const a = illE, b = totE - illE, c = illNE, d = totNE - illNE;
    const or = (b > 0 && c > 0) ? (a * d) / (b * c) : Infinity;
    const af = rr > 1 ? (rr - 1) / rr : 0;
    data.push({ name, arE, arNE, rr, ard, or, af, illE, totE, illNE, totNE });
  });
  data.sort((a, b) => b.rr - a.rr);
  const tbody2 = data.map((d, i) => `
    <tr class="${i === 0 ? 'epi-highlight' : ''}">
      <td>${i === 0 ? '⭐ ' : ''}<strong>${d.name}</strong></td>
      <td>${d.illE}/${d.totE}</td>
      <td style="font-family:var(--font-mono);font-weight:600">${fmtPct(d.arE, 1)}</td>
      <td>${d.illNE}/${d.totNE}</td>
      <td style="font-family:var(--font-mono)">${fmtPct(d.arNE, 1)}</td>
      <td><span class="badge-rr ${d.rr >= 3 ? 'high' : d.rr < 1.2 ? 'neutral' : 'low'}">${isFinite(d.rr) ? fmt(d.rr, 2) : '∞'}</span></td>
      <td style="font-family:var(--font-mono)">${fmtPct(d.ard, 1)}</td>
      <td style="font-family:var(--font-mono)">${isFinite(d.or) ? fmt(d.or, 2) : '∞'}</td>
      <td style="font-family:var(--font-mono)">${fmtPct(d.af, 0)}</td>
    </tr>`).join('');
  document.getElementById('attack-results').innerHTML = `
    <table class="epi-table">
      <thead><tr>
        <th>Food Item</th><th>Ill/Total (Ate)</th><th>AR (Ate)</th>
        <th>Ill/Total (Not)</th><th>AR (Not Ate)</th>
        <th>Risk Ratio</th><th>AR Diff.</th><th>Odds Ratio</th><th>Attr. Frac.</th>
      </tr></thead>
      <tbody>${tbody2}</tbody>
    </table>
    <div class="epi-callout" style="margin-top:1rem">
      <strong>Probable Vehicle: ${data[0]?.name || '—'}</strong> — Risk Ratio ${isFinite(data[0]?.rr) ? fmt(data[0]?.rr, 2) : '∞'}×
      (attack rate ${fmtPct(data[0]?.arE, 1)} among exposed vs. ${fmtPct(data[0]?.arNE, 1)} among unexposed;
      ARD = ${fmtPct(data[0]?.ard, 1)}). Attributable fraction: ${fmtPct(data[0]?.af, 0)} of cases in exposed group.
    </div>`;
  const labels = data.map(d => d.name);
  const rrs = data.map(d => isFinite(d.rr) ? d.rr : 15);
  if (!attackChart) {
    const ctx = document.getElementById('attackChart').getContext('2d');
    attackChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels, datasets: [
          { label: 'Risk Ratio', data: rrs, backgroundColor: data.map((_, i) => i === 0 ? PALETTE.rust : PALETTE.teal), borderRadius: 4 },
          { label: 'AR Exposed (%)', data: data.map(d => d.arE * 100), backgroundColor: 'rgba(181,137,42,.4)', borderRadius: 4 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { boxWidth: 14, font: { size: 11 } } } },
        scales: { y: { title: { display: true, text: 'Value' }, min: 0 } }
      }
    });
  } else {
    attackChart.data.labels = labels;
    attackChart.data.datasets[0].data = rrs;
    attackChart.data.datasets[0].backgroundColor = data.map((_, i) => i === 0 ? PALETTE.rust : PALETTE.teal);
    attackChart.data.datasets[1].data = data.map(d => d.arE * 100);
    attackChart.update('none');
  }
}

// ═══════════════════════════════════════════════════════════════
// PANEL 4: DIAGNOSTIC TEST
// ═══════════════════════════════════════════════════════════════
let diagChart = null;
let diagMode = '2x2';

function setDiagMode(m) {
  diagMode = m;
  document.getElementById('diag-2x2-inputs').style.display = m === '2x2' ? '' : 'none';
  document.getElementById('diag-sens-inputs').style.display = m === 'sens' ? '' : 'none';
  const btn2x2 = document.getElementById('btn-2x2');
  const btnSens = document.getElementById('btn-sens');
  btn2x2.className = m === '2x2' ? 'epi-btn epi-btn-primary' : 'epi-btn epi-btn-secondary';
  btnSens.className = m === 'sens' ? 'epi-btn epi-btn-primary' : 'epi-btn epi-btn-secondary';
  if (m === '2x2') calcDiag(); else calcDiagSens();
}

function calcDiag() {
  const a = +document.getElementById('d-a').value || 0;
  const b = +document.getElementById('d-b').value || 0;
  const c = +document.getElementById('d-c').value || 0;
  const d = +document.getElementById('d-d').value || 0;
  const sens = a / (a + c), spec = d / (b + d);
  const ppv = a / (a + b), npv = d / (c + d);
  const lrp = sens / (1 - spec), lrn = (1 - sens) / spec;
  const prev = (a + c) / (a + b + c + d);
  showDiagResults(sens, spec, ppv, npv, lrp, lrn, prev);
}

function calcDiagSens() {
  const sens = parseFloat(document.getElementById('d-sens').value) / 100;
  const spec = parseFloat(document.getElementById('d-spec').value) / 100;
  const prev = parseFloat(document.getElementById('d-prev').value) / 100;
  const ppv = (sens * prev) / (sens * prev + (1 - spec) * (1 - prev));
  const npv = (spec * (1 - prev)) / ((1 - sens) * prev + spec * (1 - prev));
  const lrp = sens / (1 - spec), lrn = (1 - sens) / spec;
  showDiagResults(sens, spec, ppv, npv, lrp, lrn, prev);
}

function showDiagResults(sens, spec, ppv, npv, lrp, lrn, prev) {
  // Bug fix: original had broken `.map(i=>(i[3]==='teal'?{...i,3:''}:i))` — removed, pass items directly
  document.getElementById('diag-results').innerHTML = resultBoxes([
    ['Sensitivity', fmtPct(sens), '', ''],
    ['Specificity', fmtPct(spec), '', ''],
    ['PPV', fmtPct(ppv), '', 'gold'],
    ['NPV', fmtPct(npv), '', ''],
    ['LR+', fmt(lrp, 2), '', ''],
    ['LR−', fmt(lrn, 3), '', ''],
    ['Accuracy', fmtPct((prev > 0 && prev < 1) ? sens * prev + spec * (1 - prev) : 0), '', ''],
    ['Prevalence', fmtPct(prev), '', ''],
  ]);
  let interp = `Sensitivity ${fmtPct(sens)}, Specificity ${fmtPct(spec)}. `;
  interp += `At prevalence ${fmtPct(prev)}: PPV = ${fmtPct(ppv)} (${fmtPct(1 - ppv)} false positive rate), NPV = ${fmtPct(npv)}. `;
  if (lrp >= 10) interp += 'LR+ ≥ 10: strong rule-in. ';
  else if (lrp >= 5) interp += 'LR+ 5–10: moderate rule-in. ';
  if (lrn <= 0.1) interp += 'LR− ≤ 0.1: strong rule-out. ';
  document.getElementById('diag-interp').innerHTML = interp;
  updateDiagChart(sens, spec);
}

function initDiagChart() {
  if (diagChart) return;
  const ctx = document.getElementById('diagChart').getContext('2d');
  diagChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [], datasets: [
        { label: 'PPV', borderColor: PALETTE.gold, backgroundColor: 'rgba(181,137,42,.1)', fill: true, pointRadius: 0, tension: .4, data: [] },
        { label: 'NPV', borderColor: PALETTE.teal, backgroundColor: 'rgba(46,125,107,.1)', fill: true, pointRadius: 0, tension: .4, data: [] },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top', labels: { boxWidth: 14 } } },
      scales: {
        x: { title: { display: true, text: 'Disease Prevalence (%)' }, ticks: { maxTicksLimit: 10 } },
        y: { title: { display: true, text: 'Predictive Value (%)' }, min: 0, max: 100 },
      }
    }
  });
  calcDiag();
}

function updateDiagChart(sens, spec) {
  if (!diagChart) return;
  const prevs = Array.from({ length: 100 }, (_, i) => (i + 1) / 100);
  const ppvs = prevs.map(p => (sens * p / (sens * p + (1 - spec) * (1 - p))) * 100);
  const npvs = prevs.map(p => (spec * (1 - p) / ((1 - sens) * p + spec * (1 - p))) * 100);
  diagChart.data.labels = prevs.map(p => (p * 100).toFixed(0));
  diagChart.data.datasets[0].data = ppvs;
  diagChart.data.datasets[1].data = npvs;
  diagChart.update('none');
}

// ═══════════════════════════════════════════════════════════════
// PANEL 5: RATES
// ═══════════════════════════════════════════════════════════════
function poissonCI(n) {
  if (n === 0) return [0, -Math.log(0.05)];
  const lo = n * Math.pow(1 - 1 / (9 * n) - 1.96 / Math.sqrt(9 * n), 3);
  const hi = (n + 1) * Math.pow(1 - 1 / (9 * (n + 1)) + 1.96 / Math.sqrt(9 * (n + 1)), 3);
  return [Math.max(0, lo), hi];
}

function calcRates() {
  const n = +document.getElementById('rc-events').value || 0;
  const pop = +document.getElementById('rc-pop').value || 1;
  const mult = +document.getElementById('rc-mult').value || 100000;
  const yrs = +document.getElementById('rc-years').value || 1;
  const rate = (n / pop / yrs) * mult;
  const [lo, hi] = poissonCI(n);
  const rateLo = (lo / pop / yrs) * mult, rateHi = (hi / pop / yrs) * mult;
  document.getElementById('rate-results').innerHTML = resultBoxes([
    ['Crude Rate', fmt(rate, 2), ` per ${mult.toLocaleString()}/yr`, ''],
    ['95% CI Lower', fmt(rateLo, 2), ` per ${mult.toLocaleString()}`, ''],
    ['95% CI Upper', fmt(rateHi, 2), ` per ${mult.toLocaleString()}`, 'gold'],
    ['Person-Years', (pop * yrs).toLocaleString(), '', ''],
    ['Stable?', n >= 20 ? 'Yes (n≥20)' : 'No — multi-year avg recommended', '', n >= 20 ? '' : 'warn'],
  ]);
}

function calcNNT() {
  const rt = parseFloat(document.getElementById('nnt-rt').value) / 100;
  const rc = parseFloat(document.getElementById('nnt-rc').value) / 100;
  const ard = rc - rt;
  const rr = rc > 0 ? rt / rc : 0;
  const or = (rc > 0 && 1 - rt > 0 && 1 - rc > 0) ? (rt * (1 - rc)) / (rc * (1 - rt)) : 0;
  const nnt = ard !== 0 ? 1 / Math.abs(ard) : Infinity;
  const label = ard > 0 ? 'NNT (Benefit)' : 'NNH (Harm)';
  document.getElementById('nnt-results').innerHTML = resultBoxes([
    [label, isFinite(nnt) ? Math.ceil(nnt).toLocaleString() : '∞', '', ''],
    ['ARD', fmtPct(Math.abs(ard)), '', 'gold'],
    ['Risk Ratio', fmt(rr, 3), '', ''],
    ['Odds Ratio', fmt(or, 3), '', ''],
  ]);
  const dir = ard > 0 ? 'benefit' : 'harm';
  document.getElementById('nnt-interp').innerHTML =
    `<strong>${label} = ${isFinite(nnt) ? Math.ceil(nnt).toLocaleString() : '∞'}</strong>: ${isFinite(nnt) ? `Treating ${Math.ceil(nnt).toLocaleString()} persons prevents 1 additional ${dir} compared to control.` : 'No difference between groups.'}`;
}

function calcYPLL() {
  let totalYPLL = 0, totalDeaths = 0;
  document.querySelectorAll('#ypll-rows tr').forEach(row => {
    const inputs = row.querySelectorAll('input');
    const age = +inputs[0].value || 0, deaths = +inputs[1].value || 0;
    const each = Math.max(0, 75 - age), total = each * deaths;
    row.querySelector('.ypll-each').textContent = each;
    row.querySelector('.ypll-total').textContent = total.toLocaleString();
    totalYPLL += total; totalDeaths += deaths;
  });
  document.getElementById('ypll-results').innerHTML = resultBoxes([
    ['Total YPLL', totalYPLL.toLocaleString(), ' years', ''],
    ['Total Deaths', totalDeaths.toLocaleString(), '', ''],
    ['YPLL/Death', totalDeaths > 0 ? fmt(totalYPLL / totalDeaths, 1) : '-', ' years', 'gold'],
  ]);
}

function addYPLLRow() {
  const tbody = document.getElementById('ypll-rows');
  const tr = document.createElement('tr');
  tr.innerHTML = `<td><input type="number" class="epi-input" value="50" min="0" max="74"></td>
    <td><input type="number" class="epi-input" value="1" min="0"></td>
    <td class="ypll-each" style="font-family:var(--font-mono)">25</td>
    <td class="ypll-total" style="font-family:var(--font-mono);font-weight:600">25</td>`;
  tbody.appendChild(tr);
  // bind inputs
  tr.querySelectorAll('input').forEach(inp => inp.addEventListener('input', calcYPLL));
  calcYPLL();
}

// ═══════════════════════════════════════════════════════════════
// PANEL 6: CONFIDENCE INTERVALS
// ═══════════════════════════════════════════════════════════════
let ciChart = null;

function calcCI() {
  const n = +document.getElementById('ci-n').value || 0;
  const pop = +document.getElementById('ci-pop').value || 1;
  const mult = +document.getElementById('ci-mult').value || 100000;
  const [lo, hi] = poissonCI(n);
  const rate = (n / pop) * mult;
  const rateLo = (lo / pop) * mult, rateHi = (hi / pop) * mult;
  const width = rateHi - rateLo;
  document.getElementById('ci-results').innerHTML = resultBoxes([
    ['Point Estimate', fmt(rate, 2), ` per ${mult.toLocaleString()}`, ''],
    ['Lower 95% CI', fmt(rateLo, 2), '', ''],
    ['Upper 95% CI', fmt(rateHi, 2), '', 'gold'],
    ['CI Width', fmt(width, 2), '', ''],
    ['CV (%)', rate > 0 ? fmt((width / 2 / rate) * 100, 1) : '∞', '', ''],
  ]);
  const warn = n < 20;
  document.getElementById('ci-warn').innerHTML = warn
    ? `<strong>⚠ Small count warning:</strong> n = ${n}. Confidence interval spans ${fmt(rateLo, 1)}–${fmt(rateHi, 1)} per ${mult.toLocaleString()} (CV = ${rate > 0 ? fmt((width / 2 / rate) * 100, 0) : '∞'}%). CDC recommends suppressing rates based on n < 20. Consider 3–5 year rolling averages.`
    : `Count of ${n} meets CDC stability threshold (n ≥ 20). Rate is statistically stable.`;
  document.getElementById('ci-warn').className = `epi-callout ${warn ? 'rust' : 'teal'}`;
}

function calcMultiYear() {
  let totalEvents = 0, totalPop = 0;
  const mult = 100000;
  document.querySelectorAll('#multi-year-rows tr').forEach(row => {
    const inputs = row.querySelectorAll('input');
    const ev = +inputs[0].value || 0, pop = +inputs[1].value || 1;
    const rate = (ev / pop) * mult;
    row.querySelector('.my-rate').textContent = fmt(rate, 1);
    totalEvents += ev; totalPop += pop;
  });
  const pooledRate = (totalEvents / totalPop) * mult;
  const [lo, hi] = poissonCI(totalEvents);
  document.getElementById('multi-year-results').innerHTML = resultBoxes([
    ['Pooled Events', totalEvents, '', ''],
    ['Pooled Rate', fmt(pooledRate, 2), ` per ${mult.toLocaleString()}`, 'gold'],
    ['95% CI', `${fmt((lo / totalPop) * mult, 1)}–${fmt((hi / totalPop) * mult, 1)}`, ` per ${mult.toLocaleString()}`, ''],
    ['Stability', totalEvents >= 20 ? 'Stable' : 'Add more years', '', totalEvents >= 20 ? '' : 'warn'],
  ]);
}

function initCIChart() {
  if (ciChart) return;
  const ctx = document.getElementById('ciChart').getContext('2d');
  const counts = Array.from({ length: 50 }, (_, i) => i + 1);
  const relWidths = counts.map(n => {
    const [lo, hi] = poissonCI(n);
    return n > 0 ? ((hi - lo) / n) * 100 : 0;
  });
  ciChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: counts,
      datasets: [{
        label: '95% CI Width as % of Point Estimate',
        data: relWidths,
        borderColor: PALETTE.rust,
        backgroundColor: 'rgba(166,61,47,.1)',
        fill: true, pointRadius: 0, tension: .4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: 'Event Count (n)' } },
        y: { title: { display: true, text: 'Relative CI Width (%)' }, min: 0 },
      }
    }
  });
  // Draw CDC threshold line at n=20 via plugin
  const thresholdPlugin = {
    id: 'epiThreshold',
    afterDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      const x = scales.x.getPixelForValue(19);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.strokeStyle = '#B5892A';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.fillStyle = '#B5892A';
      ctx.font = '11px IBM Plex Sans, sans-serif';
      ctx.fillText('CDC threshold (n=20)', x + 4, chartArea.top + 14);
      ctx.restore();
    }
  };
  Chart.register(thresholdPlugin);
  ciChart.update();
}

// ═══════════════════════════════════════════════════════════════
// EVENT BINDING & INIT
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Set Chart.js defaults
  Chart.defaults.font.family = "'IBM Plex Sans', sans-serif";
  Chart.defaults.color = '#4A5568';

  // Tab buttons
  document.querySelectorAll('#epi-tab-bar .tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // SEIR sliders
  ['N', 'S0', 'vacc', 'beta', 'gamma', 'sigma', 'mu', 'days'].forEach(id => {
    const el = document.getElementById('r-' + id);
    if (el) el.addEventListener('input', () => { updateVal(id); runSEIR(); });
  });

  // R₀ inputs
  ['r0-beta', 'r0-gamma', 'r0-immune', 'r0-direct'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', calcR0);
  });

  // Attack rate — input delegation
  document.getElementById('attack-rows').addEventListener('input', calcAttack);
  document.getElementById('atk-name').addEventListener('input', calcAttack);
  document.getElementById('atk-incub').addEventListener('input', calcAttack);
  document.getElementById('atk-total').addEventListener('input', calcAttack);
  document.getElementById('atk-add-btn').addEventListener('click', addAttackRow);

  // Remove row buttons (initial rows)
  document.querySelectorAll('.epi-remove-row').forEach(btn => {
    btn.addEventListener('click', e => { e.target.closest('tr').remove(); calcAttack(); });
  });

  // Diagnostic mode toggle
  document.getElementById('btn-2x2').addEventListener('click', () => setDiagMode('2x2'));
  document.getElementById('btn-sens').addEventListener('click', () => setDiagMode('sens'));

  // Diagnostic inputs
  ['d-a', 'd-b', 'd-c', 'd-d'].forEach(id => {
    document.getElementById(id).addEventListener('input', calcDiag);
  });
  ['d-sens', 'd-spec', 'd-prev'].forEach(id => {
    document.getElementById(id).addEventListener('input', calcDiagSens);
  });

  // Rate calculator
  ['rc-events', 'rc-pop', 'rc-mult', 'rc-years'].forEach(id => {
    document.getElementById(id).addEventListener('input', calcRates);
    document.getElementById(id).addEventListener('change', calcRates);
  });
  ['nnt-rt', 'nnt-rc'].forEach(id => {
    document.getElementById(id).addEventListener('input', calcNNT);
  });
  document.getElementById('ypll-add-btn').addEventListener('click', addYPLLRow);
  document.getElementById('ypll-rows').addEventListener('input', calcYPLL);

  // CI
  ['ci-n', 'ci-pop', 'ci-mult'].forEach(id => {
    document.getElementById(id).addEventListener('input', calcCI);
    document.getElementById(id).addEventListener('change', calcCI);
  });
  document.getElementById('multi-year-rows').addEventListener('input', calcMultiYear);

  // Initial render
  initSEIR();
  calcAttack();
  calcR0();
  calcRates();
  calcNNT();
  calcYPLL();
  calcMultiYear();
});
