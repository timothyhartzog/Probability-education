// rh-epi-textbook — module.js
// Interactive calculator widgets embedded in the textbook

// ── UTILITIES ──────────────────────────────────────────────────
const PALETTE = {
  navy: '#1B3A5C', teal: '#2E7D6B', gold: '#B5892A', rust: '#A63D2F',
  blue: '#2563EB', green: '#16A34A',
};

function fmt(n, d = 2) { return isFinite(n) ? n.toFixed(d) : '—'; }
function fmtPct(n, d = 1) { return isFinite(n) ? (n * 100).toFixed(d) + '%' : '—'; }
function fmtN(n) { return isFinite(n) ? Math.round(n).toLocaleString() : '—'; }

function resultBoxes(items) {
  return items.map(([label, val, unit = '', cls = '']) =>
    `<div class="w-result-box ${cls}">
      <div class="w-result-label">${label}</div>
      <div class="w-result-value">${val}<span class="w-result-unit">${unit}</span></div>
    </div>`
  ).join('');
}

function poissonCI(n) {
  if (n === 0) return [0, -Math.log(0.05)];
  const lo = n * Math.pow(1 - 1 / (9 * n) - 1.96 / Math.sqrt(9 * n), 3);
  const hi = (n + 1) * Math.pow(1 - 1 / (9 * (n + 1)) + 1.96 / Math.sqrt(9 * (n + 1)), 3);
  return [Math.max(0, lo), hi];
}

// ── READING PROGRESS ───────────────────────────────────────────
function updateProgress() {
  const content = document.getElementById('book-content');
  const bar = document.getElementById('progress-bar');
  if (!content || !bar) return;
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  bar.style.width = (scrollTop / docHeight * 100) + '%';
}

// ── SIDEBAR TOC ────────────────────────────────────────────────
function togglePart(id) {
  document.getElementById(id)?.classList.toggle('open');
}

function updateActiveTOC() {
  const sections = document.querySelectorAll('.book-chapter[id]');
  let current = '';
  sections.forEach(s => {
    if (s.getBoundingClientRect().top < 150) current = s.id;
  });
  document.querySelectorAll('.toc-ch').forEach(a => {
    const href = a.getAttribute('href')?.replace('#', '');
    a.classList.toggle('active', href === current);
  });
}

// ── WIDGET 1: Rate & CI Calculator ────────────────────────────
let wrChart = null;

function calcRateCI() {
  const n = parseInt(document.getElementById('wr-n').value) || 1;
  const pop = +document.getElementById('wr-pop').value || 1;
  const mult = +document.getElementById('wr-mult').value || 100000;
  document.getElementById('wr-n-val').textContent = n;
  const [lo, hi] = poissonCI(n);
  const rate = (n / pop) * mult;
  const rateLo = (lo / pop) * mult, rateHi = (hi / pop) * mult;
  const width = rateHi - rateLo;
  document.getElementById('wr-results').innerHTML = resultBoxes([
    ['Point Estimate', fmt(rate, 2), ` per ${mult.toLocaleString()}`, ''],
    ['Lower 95% CI', fmt(rateLo, 2), '', ''],
    ['Upper 95% CI', fmt(rateHi, 2), '', 'gold'],
    ['CI Width', fmt(width, 2), '', n < 20 ? 'warn' : ''],
    ['Stable?', n >= 20 ? 'Yes (n≥20)' : 'No (n<20)', '', n >= 20 ? '' : 'warn'],
  ]);
  const warn = n < 20;
  document.getElementById('wr-warn').innerHTML = warn
    ? `<strong>⚠ Small count warning:</strong> n = ${n}. CI spans ${fmt(rateLo, 1)}–${fmt(rateHi, 1)} per ${mult.toLocaleString()}. CDC recommends suppressing rates with n &lt; 20.`
    : `Count of ${n} meets CDC stability threshold. Rate is statistically stable.`;
  document.getElementById('wr-warn').className = `w-callout ${warn ? 'rust' : 'teal'}`;
  updateCIChart(n, pop, mult);
}

function updateCIChart(curN, pop, mult) {
  if (!wrChart) return;
  const counts = Array.from({ length: 50 }, (_, i) => i + 1);
  const relWidths = counts.map(n => {
    const [lo, hi] = poissonCI(n);
    return ((hi - lo) / n) * 100;
  });
  wrChart.data.datasets[0].data = relWidths;
  wrChart.data.datasets[1].data = counts.map(n => n === curN ? relWidths[curN - 1] : null);
  wrChart.update('none');
}

function initCIChart() {
  const ctx = document.getElementById('wr-chart')?.getContext('2d');
  if (!ctx) return;
  const counts = Array.from({ length: 50 }, (_, i) => i + 1);
  const relWidths = counts.map(n => {
    const [lo, hi] = poissonCI(n);
    return ((hi - lo) / n) * 100;
  });
  wrChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: counts,
      datasets: [
        {
          label: '95% CI Width as % of Estimate',
          data: relWidths,
          borderColor: PALETTE.rust,
          backgroundColor: 'rgba(166,61,47,.1)',
          fill: true, pointRadius: 0, tension: .4
        },
        {
          label: 'Current n',
          data: Array(50).fill(null),
          borderColor: PALETTE.gold,
          backgroundColor: PALETTE.gold,
          pointRadius: 6, pointHoverRadius: 8,
          showLine: false
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { filter: item => item.dataset.label === 'Current n' || true }
      },
      scales: {
        x: { title: { display: true, text: 'Event Count (n)', font: { size: 11 } } },
        y: { title: { display: true, text: 'Relative CI Width (%)' }, min: 0 }
      }
    }
  });
  // CDC n=20 threshold line via plugin
  const plugin = {
    id: 'threshold',
    afterDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      const x = scales.x.getPixelForValue(19);
      ctx.save();
      ctx.beginPath(); ctx.moveTo(x, chartArea.top); ctx.lineTo(x, chartArea.bottom);
      ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.stroke();
      ctx.fillStyle = PALETTE.gold; ctx.font = '10px sans-serif';
      ctx.fillText('n=20 (CDC threshold)', x + 4, chartArea.top + 12);
      ctx.restore();
    }
  };
  Chart.register(plugin);
  wrChart.update();
}

// ── WIDGET 2: YPLL ─────────────────────────────────────────────
function calcYPLL() {
  let totalYPLL = 0, totalDeaths = 0;
  document.querySelectorAll('#ypll-rows tr').forEach(row => {
    const inputs = row.querySelectorAll('input');
    const age = +inputs[0].value || 0, deaths = +inputs[1].value || 0;
    const each = Math.max(0, 75 - age), total = each * deaths;
    const eachCell = row.querySelector('.ypll-each');
    const totalCell = row.querySelector('.ypll-total');
    if (eachCell) eachCell.textContent = each;
    if (totalCell) totalCell.textContent = total.toLocaleString();
    totalYPLL += total; totalDeaths += deaths;
  });
  document.getElementById('ypll-results').innerHTML = resultBoxes([
    ['Total YPLL', totalYPLL.toLocaleString(), ' years', ''],
    ['Total Deaths', totalDeaths.toLocaleString(), '', ''],
    ['YPLL/Death', totalDeaths > 0 ? fmt(totalYPLL / totalDeaths, 1) : '—', ' years', 'gold'],
  ]);
}

function addYPLLRow() {
  const tbody = document.getElementById('ypll-rows');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="number" class="w-attack-input" value="50" min="0" max="74"></td>
    <td><input type="number" class="w-attack-input" value="1" min="0"></td>
    <td class="ypll-each" style="font-family:var(--font-mono)">25</td>
    <td class="ypll-total" style="font-family:var(--font-mono);font-weight:600">25</td>`;
  tbody.appendChild(tr);
  tr.querySelectorAll('input').forEach(inp => inp.addEventListener('input', calcYPLL));
  calcYPLL();
}

// ── WIDGET 3: NNT ──────────────────────────────────────────────
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

// ── WIDGET 4: Attack Rate ──────────────────────────────────────
function calcAttack() {
  const rows = document.querySelectorAll('#atk-rows tr');
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
  const tbody = data.map((d, i) => `
    <tr class="${i === 0 ? 'w-highlight' : ''}">
      <td>${i === 0 ? '⭐ ' : ''}<strong>${d.name}</strong></td>
      <td>${d.illE}/${d.totE}</td>
      <td style="font-family:var(--font-mono);font-weight:600">${fmtPct(d.arE, 1)}</td>
      <td>${d.illNE}/${d.totNE}</td>
      <td style="font-family:var(--font-mono)">${fmtPct(d.arNE, 1)}</td>
      <td><span class="badge-rr ${d.rr >= 3 ? 'high' : 'neutral'}">${isFinite(d.rr) ? fmt(d.rr, 2) : '∞'}</span></td>
      <td style="font-family:var(--font-mono)">${fmtPct(d.ard, 1)}</td>
      <td style="font-family:var(--font-mono)">${isFinite(d.or) ? fmt(d.or, 2) : '∞'}</td>
    </tr>`).join('');
  document.getElementById('atk-results').innerHTML = `
    <table class="w-table">
      <thead><tr>
        <th>Food Item</th><th>Ill/Total (Ate)</th><th>AR (Ate)</th>
        <th>Ill/Total (Not)</th><th>AR (Not Ate)</th>
        <th>Risk Ratio</th><th>ARD</th><th>OR</th>
      </tr></thead>
      <tbody>${tbody}</tbody>
    </table>
    <div class="w-callout" style="margin-top:.65rem">
      <strong>Probable Vehicle: ${data[0]?.name || '—'}</strong> — RR ${isFinite(data[0]?.rr) ? fmt(data[0]?.rr, 2) : '∞'}×
      (AR ${fmtPct(data[0]?.arE, 1)} exposed vs. ${fmtPct(data[0]?.arNE, 1)} unexposed; ARD = ${fmtPct(data[0]?.ard, 1)}).
    </div>`;
}

function addAtkRow() {
  const tbody = document.getElementById('atk-rows');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="w-attack-input" value="New Food Item"></td>
    <td><input type="number" class="w-attack-input" value="0" min="0"></td>
    <td><input type="number" class="w-attack-input" value="50" min="1"></td>
    <td><input type="number" class="w-attack-input" value="0" min="0"></td>
    <td><input type="number" class="w-attack-input" value="50" min="1"></td>
    <td><button class="w-btn w-btn-sm" style="background:#A63D2F" onclick="this.closest('tr').remove();calcAttack()">✕</button></td>`;
  tbody.appendChild(tr);
  tr.querySelectorAll('input').forEach(inp => inp.addEventListener('input', calcAttack));
  calcAttack();
}

// ── WIDGET 5: Diagnostic Test ──────────────────────────────────
let diagChart = null;
let diagMode = '2x2';

function setDiagMode(m) {
  diagMode = m;
  document.getElementById('diag-2x2').style.display = m === '2x2' ? '' : 'none';
  document.getElementById('diag-sens').style.display = m === 'sens' ? '' : 'none';
  document.getElementById('diag-btn-2x2').className = m === '2x2' ? 'w-btn' : 'w-btn w-btn-sec';
  document.getElementById('diag-btn-sens').className = m === 'sens' ? 'w-btn' : 'w-btn w-btn-sec';
  if (m === '2x2') calcDiag2x2(); else calcDiagSens();
}

function calcDiag2x2() {
  const a = +document.getElementById('d-a').value || 0;
  const b = +document.getElementById('d-b').value || 0;
  const c = +document.getElementById('d-c').value || 0;
  const d = +document.getElementById('d-d').value || 0;
  const sens = a / (a + c), spec = d / (b + d);
  const ppv = a / (a + b), npv = d / (c + d);
  const lrp = sens / (1 - spec), lrn = (1 - sens) / spec;
  const prev = (a + c) / (a + b + c + d);
  showDiag(sens, spec, ppv, npv, lrp, lrn, prev);
}

function calcDiagSens() {
  const sens = parseFloat(document.getElementById('d-sens').value) / 100;
  const spec = parseFloat(document.getElementById('d-spec').value) / 100;
  const prev = parseFloat(document.getElementById('d-prev').value) / 100;
  const ppv = (sens * prev) / (sens * prev + (1 - spec) * (1 - prev));
  const npv = (spec * (1 - prev)) / ((1 - sens) * prev + spec * (1 - prev));
  const lrp = sens / (1 - spec), lrn = (1 - sens) / spec;
  showDiag(sens, spec, ppv, npv, lrp, lrn, prev);
}

function showDiag(sens, spec, ppv, npv, lrp, lrn, prev) {
  document.getElementById('diag-results').innerHTML = resultBoxes([
    ['Sensitivity', fmtPct(sens), '', ''],
    ['Specificity', fmtPct(spec), '', ''],
    ['PPV', fmtPct(ppv), '', 'gold'],
    ['NPV', fmtPct(npv), '', ''],
    ['LR+', fmt(lrp, 2), '', ''],
    ['LR−', fmt(lrn, 3), '', ''],
    ['Prevalence', fmtPct(prev), '', ''],
  ]);
  let interp = `At prevalence ${fmtPct(prev)}: PPV = ${fmtPct(ppv)}, NPV = ${fmtPct(npv)}. `;
  if (lrp >= 10) interp += 'LR+ ≥ 10: strong rule-in. ';
  else if (lrp >= 5) interp += 'LR+ 5–10: moderate rule-in. ';
  if (lrn <= 0.1) interp += 'LR− ≤ 0.1: strong rule-out.';
  document.getElementById('diag-interp').innerHTML = interp;
  updateDiagChart(sens, spec);
}

function initDiagChart() {
  const ctx = document.getElementById('diag-chart')?.getContext('2d');
  if (!ctx) return;
  diagChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'PPV', borderColor: PALETTE.gold, backgroundColor: 'rgba(181,137,42,.1)', fill: true, pointRadius: 0, tension: .4, data: [] },
        { label: 'NPV', borderColor: PALETTE.teal, backgroundColor: 'rgba(46,125,107,.1)', fill: true, pointRadius: 0, tension: .4, data: [] },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
      scales: {
        x: { title: { display: true, text: 'Disease Prevalence (%)' }, ticks: { maxTicksLimit: 10 } },
        y: { title: { display: true, text: 'Predictive Value (%)' }, min: 0, max: 100 }
      }
    }
  });
}

function updateDiagChart(sens, spec) {
  if (!diagChart) return;
  const prevs = Array.from({ length: 100 }, (_, i) => (i + 1) / 100);
  diagChart.data.labels = prevs.map(p => (p * 100).toFixed(0));
  diagChart.data.datasets[0].data = prevs.map(p => (sens * p / (sens * p + (1 - spec) * (1 - p))) * 100);
  diagChart.data.datasets[1].data = prevs.map(p => (spec * (1 - p) / ((1 - sens) * p + spec * (1 - p))) * 100);
  diagChart.update('none');
}

// ── WIDGET 6: SEIR/SEIRD ───────────────────────────────────────
let seirChart = null;

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

const seirSliderMap = {
  'ws-N': v => parseInt(v).toLocaleString(),
  'ws-beta': v => parseFloat(v).toFixed(2),
  'ws-gamma': v => parseFloat(v).toFixed(2),
  'ws-sigma': v => parseFloat(v).toFixed(2),
  'ws-mu': v => parseFloat(v).toFixed(1) + '%',
  'ws-vacc': v => v + '%',
};

function updateSEIRVal(id) {
  const v = document.getElementById(id).value;
  document.getElementById(id + '-val').textContent = seirSliderMap[id](v);
}

function runSEIR() {
  const N = parseFloat(document.getElementById('ws-N').value);
  const beta = parseFloat(document.getElementById('ws-beta').value);
  const gamma = parseFloat(document.getElementById('ws-gamma').value);
  const sigma = parseFloat(document.getElementById('ws-sigma').value);
  const mu = parseFloat(document.getElementById('ws-mu').value) / 100;
  const vacc = parseFloat(document.getElementById('ws-vacc').value) / 100;
  const days = 365;
  const dt = 0.5, sPerDay = 2;
  const s0 = Math.max(0, 1 - 0.001 - vacc);
  let [S, E, I, R, D] = [N * s0, N * 0.001, 0, N * vacc, 0];
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
  const hit = r0 > 1 ? 1 - 1 / r0 : 0;
  if (!seirChart) initSEIRChart();
  const labels = Array.from({ length: days + 1 }, (_, i) => i);
  seirChart.data.labels = labels;
  seirChart.data.datasets[0].data = sArr;
  seirChart.data.datasets[1].data = eArr;
  seirChart.data.datasets[2].data = iArr;
  seirChart.data.datasets[3].data = rArr;
  seirChart.data.datasets[4].data = dArr;
  seirChart.update('none');
  document.getElementById('ws-results').innerHTML = resultBoxes([
    ['R₀', fmt(r0, 2), '', r0 > 1 ? 'warn' : ''],
    ['HIT', fmtPct(hit), '', 'gold'],
    ['Peak Day', peakDay, ' days', ''],
    ['Peak Infectious', fmtN(peakI), ' persons', 'gold'],
    ['Final Attack Rate', fmtPct(far), '', ''],
    ['Total Deaths', fmtN(D), ' persons', D > 0 ? 'rust' : ''],
  ]);
  let interp = `<strong>R₀ = ${fmt(r0, 2)}</strong> — `;
  if (r0 < 1) interp += 'Epidemic cannot sustain. Each case generates fewer than one secondary case.';
  else interp += `Outbreak expected. Peak at day ${peakDay} (${fmtN(peakI)} infectious). Final attack rate: ${fmtPct(far)}. HIT = ${fmtPct(hit)}.`;
  if (vacc >= hit && r0 > 1) interp += ` <strong style="color:#2E7D6B">Vaccination exceeds HIT — epidemic suppressed.</strong>`;
  document.getElementById('ws-interp').innerHTML = interp;
  document.getElementById('ws-interp').className = `w-callout ${vacc >= hit && r0 > 1 ? 'teal' : ''}`;
}

function initSEIRChart() {
  const ctx = document.getElementById('ws-chart')?.getContext('2d');
  if (!ctx) return;
  seirChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'Susceptible', borderColor: PALETTE.navy, backgroundColor: 'rgba(27,58,92,.06)', fill: true, pointRadius: 0, tension: .4, data: [] },
        { label: 'Exposed', borderColor: PALETTE.gold, backgroundColor: 'rgba(181,137,42,.06)', fill: true, pointRadius: 0, tension: .4, data: [] },
        { label: 'Infectious', borderColor: PALETTE.rust, backgroundColor: 'rgba(166,61,47,.12)', fill: true, pointRadius: 0, tension: .4, data: [] },
        { label: 'Recovered', borderColor: PALETTE.teal, backgroundColor: 'rgba(46,125,107,.06)', fill: true, pointRadius: 0, tension: .4, data: [] },
        { label: 'Deaths', borderColor: '#374151', backgroundColor: 'rgba(55,65,81,.04)', fill: true, pointRadius: 0, tension: .4, data: [] },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, font: { size: 10 } } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${Math.round(ctx.parsed.y).toLocaleString()}` } }
      },
      scales: {
        x: { title: { display: true, text: 'Day' }, ticks: { maxTicksLimit: 12 } },
        y: { title: { display: true, text: 'Persons' }, ticks: { callback: v => v.toLocaleString() } }
      }
    }
  });
}

// ── WIDGET 7: R₀ Calculator ────────────────────────────────────
let r0HitChart = null;

function calcR0Widget() {
  const directVal = document.getElementById('r0-direct').value;
  const beta = parseFloat(document.getElementById('r0-beta').value) || 0;
  const gamma = parseFloat(document.getElementById('r0-gamma').value) || 1;
  const immPct = parseFloat(document.getElementById('r0-immune').value) || 0;
  const r0 = directVal ? (parseFloat(directVal) || 0) : beta / gamma;
  const hit = r0 > 1 ? 1 - 1 / r0 : 0;
  const reff = r0 * (1 - immPct / 100);
  let ar = 0;
  if (r0 > 1) {
    let x = 0.5;
    for (let i = 0; i < 100; i++) x = 1 - Math.exp(-r0 * x);
    ar = x;
  }
  document.getElementById('r0-results').innerHTML = resultBoxes([
    ['Basic R₀', fmt(r0, 2), '', r0 > 1 ? 'warn' : ''],
    ['Effective Rₑ', fmt(reff, 2), '', reff < 1 ? '' : 'warn'],
    ['HIT', fmtPct(hit), '', 'gold'],
    ['Final Attack Rate', fmtPct(ar), '', 'rust'],
    ['Infectious Period', fmt(1 / (gamma || 1), 1), ' days', ''],
  ]);
  let interp = `<strong>R₀ = ${fmt(r0, 2)}</strong>: `;
  if (r0 < 1) interp += 'Epidemic cannot sustain. R₀ &lt; 1 — chain of transmission dies out.';
  else if (r0 < 2) interp += `Slow growth. HIT = ${fmtPct(hit)}. Expected final attack rate: ${fmtPct(ar)}.`;
  else interp += `Substantial epidemic expected. HIT = ${fmtPct(hit)} (${(hit * 100).toFixed(0)}% of population must be immune to halt spread). Final attack rate if uncontrolled: ${fmtPct(ar)}.`;
  if (immPct > 0) {
    if (immPct / 100 >= hit) interp += ` <strong style="color:#2E7D6B">Current immunity (${immPct}%) exceeds HIT — Rₑ &lt; 1, epidemic suppressed.</strong>`;
    else interp += ` Current immunity (${immPct}%) is below HIT — Rₑ = ${fmt(reff, 2)}, epidemic can still spread.`;
  }
  document.getElementById('r0-interp').innerHTML = interp;
  document.getElementById('r0-interp').className = `w-callout ${immPct / 100 >= hit && r0 > 1 ? 'teal' : ''}`;
  if (r0HitChart) updateR0Chart(r0);
}

function initR0HitChart() {
  const ctx = document.getElementById('r0-hit-chart')?.getContext('2d');
  if (!ctx) return;
  const r0vals = Array.from({ length: 200 }, (_, i) => 1 + (i / 199) * 19);
  const hits = r0vals.map(r => (1 - 1 / r) * 100);
  r0HitChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: r0vals.map(v => v.toFixed(1)),
      datasets: [{
        label: 'Herd Immunity Threshold (%)',
        data: hits,
        borderColor: PALETTE.teal,
        backgroundColor: 'rgba(46,125,107,.12)',
        fill: true, pointRadius: 0, tension: .4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: 'Basic Reproduction Number (R₀)' }, ticks: { maxTicksLimit: 10 } },
        y: { title: { display: true, text: 'HIT (%)' }, min: 0, max: 100 }
      }
    }
  });
}

function updateR0Chart(currentR0) {
  if (!r0HitChart) return;
  // Nothing needed — static curve
}

// ── WIDGET 8: Multi-Year Stabilization ────────────────────────
function calcMultiYear() {
  let totalEvents = 0, totalPop = 0;
  const mult = 100000;
  document.querySelectorAll('#my-rows tr').forEach(row => {
    const inputs = row.querySelectorAll('input');
    const ev = +inputs[0].value || 0, pop = +inputs[1].value || 1;
    const rate = (ev / pop) * mult;
    const rateCell = row.querySelector('.my-rate');
    if (rateCell) rateCell.textContent = fmt(rate, 1);
    totalEvents += ev; totalPop += pop;
  });
  const pooledRate = (totalEvents / totalPop) * mult;
  const [lo, hi] = poissonCI(totalEvents);
  document.getElementById('my-results').innerHTML = resultBoxes([
    ['Pooled Events', totalEvents, '', totalEvents >= 20 ? '' : 'warn'],
    ['Pooled Rate', fmt(pooledRate, 2), ' per 100k', 'gold'],
    ['95% CI', `${fmt((lo / totalPop) * mult, 1)}–${fmt((hi / totalPop) * mult, 1)}`, ' per 100k', ''],
    ['Stable?', totalEvents >= 20 ? 'Yes (n≥20)' : 'Not yet', '', totalEvents >= 20 ? '' : 'warn'],
  ]);
  document.getElementById('my-interp').innerHTML = totalEvents >= 20
    ? `Pooled n = ${totalEvents} meets CDC stability threshold. Pooled rate ${fmt(pooledRate, 2)} per 100,000 (95% CI: ${fmt((lo / totalPop) * mult, 1)}–${fmt((hi / totalPop) * mult, 1)}).`
    : `Pooled n = ${totalEvents} is still below 20. Consider adding more years or reporting as a multi-year pooled estimate with a stability caveat.`;
  document.getElementById('my-interp').className = `w-callout ${totalEvents >= 20 ? 'teal' : 'rust'}`;
}

// ── INIT ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Chart.defaults.font.family = 'IBM Plex Sans, sans-serif';
  Chart.defaults.color = '#4A5568';

  // Progress + TOC scroll tracking
  window.addEventListener('scroll', () => { updateProgress(); updateActiveTOC(); }, { passive: true });

  // TOC smooth scroll
  document.querySelectorAll('.toc-ch').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const id = a.getAttribute('href')?.replace('#', '');
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // ── Rate / CI widget ──
  initCIChart();
  document.getElementById('wr-n').addEventListener('input', calcRateCI);
  document.getElementById('wr-pop').addEventListener('input', calcRateCI);
  document.getElementById('wr-mult').addEventListener('change', calcRateCI);
  calcRateCI();

  // ── YPLL widget ──
  document.getElementById('ypll-rows').addEventListener('input', calcYPLL);
  document.getElementById('ypll-add').addEventListener('click', addYPLLRow);
  calcYPLL();

  // ── NNT widget ──
  document.getElementById('nnt-rt').addEventListener('input', calcNNT);
  document.getElementById('nnt-rc').addEventListener('input', calcNNT);
  calcNNT();

  // ── Attack rate widget ──
  document.getElementById('atk-rows').addEventListener('input', calcAttack);
  document.getElementById('atk-add').addEventListener('click', addAtkRow);
  calcAttack();

  // ── Diagnostic widget ──
  document.getElementById('diag-btn-2x2').addEventListener('click', () => setDiagMode('2x2'));
  document.getElementById('diag-btn-sens').addEventListener('click', () => setDiagMode('sens'));
  document.getElementById('diag-2x2').addEventListener('input', calcDiag2x2);
  document.getElementById('diag-sens').addEventListener('input', calcDiagSens);
  initDiagChart();
  calcDiag2x2();

  // ── SEIR widget ──
  ['ws-N', 'ws-beta', 'ws-gamma', 'ws-sigma', 'ws-mu', 'ws-vacc'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => { updateSEIRVal(id); runSEIR(); });
  });
  initSEIRChart();
  runSEIR();

  // ── R₀ widget ──
  ['r0-beta', 'r0-gamma', 'r0-direct', 'r0-immune'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', calcR0Widget);
  });
  initR0HitChart();
  calcR0Widget();

  // ── Multi-year widget ──
  const myRows = document.getElementById('my-rows');
  if (myRows) {
    myRows.addEventListener('input', calcMultiYear);
    calcMultiYear();
  }
});

// expose for inline onclick in attack table
window.calcAttack = calcAttack;
window.togglePart = togglePart;
