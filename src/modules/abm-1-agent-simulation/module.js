/* ============================================================
   ABM-1 — Agent-Based Modeling & Simulation
   Four interactive simulations:
     1. Epidemic ABM (SEIR spatial model)
     2. Flocking (Boids algorithm)
     3. Schelling Segregation
     4. Predator-Prey ecosystem
   ============================================================ */

import * as d3 from 'd3';
import '../../lib/copy-code.js';

// ── Constants ────────────────────────────────────────────────
const COLORS = {
  S: '#3b82f6', E: '#f59e0b', I: '#ef4444', R: '#10b981', D: '#6b7280',
  prey: '#22c55e', predator: '#ef4444', grass: '#86efac',
  typeA: '#3b82f6', typeB: '#e97319', empty: '#1e293b',
  boid: '#60a5fa', predatorBoid: '#ef4444',
};

// ── Utility ──────────────────────────────────────────────────
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function rand(lo, hi) { return lo + Math.random() * (hi - lo); }

// ── Tab Navigation ───────────────────────────────────────────
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

// ╔══════════════════════════════════════════════════════════════╗
// ║  1. EPIDEMIC ABM                                            ║
// ╚══════════════════════════════════════════════════════════════╝

const EPIDEMIC_PRESETS = {
  custom: null,
  covid:   { beta: 0.35, incub: 5, recov: 14, mort: 0.02, radius: 25, speed: 1.5 },
  measles: { beta: 0.90, incub: 10, recov: 8,  mort: 0.01, radius: 40, speed: 2.0 },
  flu:     { beta: 0.30, incub: 2, recov: 7,   mort: 0.001, radius: 20, speed: 2.0 },
  ebola:   { beta: 0.20, incub: 8, recov: 10,  mort: 0.50, radius: 15, speed: 0.5 },
};

const epidState = {
  agents: [], running: false, frameId: null, day: 0,
  timeSeries: [], secondaryInfections: [],
};

function readEpidControls() {
  return {
    pop: +document.getElementById('epid-pop-slider').value,
    initI: +document.getElementById('epid-init-slider').value,
    beta: +document.getElementById('epid-beta-slider').value,
    radius: +document.getElementById('epid-radius-slider').value,
    incub: +document.getElementById('epid-incub-slider').value,
    recov: +document.getElementById('epid-recov-slider').value,
    mort: +document.getElementById('epid-mort-slider').value,
    speed: +document.getElementById('epid-speed-slider').value,
    quarantine: document.getElementById('epid-quarantine-toggle').checked,
    vaccine: document.getElementById('epid-vaccine-toggle').checked,
  };
}

function createEpidAgents(p) {
  const canvas = document.getElementById('epidemic-canvas');
  const W = canvas.width, H = canvas.height;
  const agents = [];
  const vaccinated = p.vaccine ? Math.floor(p.pop * 0.3) : 0;

  for (let i = 0; i < p.pop; i++) {
    const a = {
      x: rand(10, W - 10), y: rand(10, H - 10),
      vx: rand(-p.speed, p.speed), vy: rand(-p.speed, p.speed),
      state: 'S', timer: 0, infected_by: -1, secondary: 0,
    };
    if (i < vaccinated) a.state = 'R'; // vaccinated = immune
    agents.push(a);
  }
  // Seed initial infected
  let seeded = 0;
  for (let i = vaccinated; i < agents.length && seeded < p.initI; i++) {
    agents[i].state = 'I';
    agents[i].timer = 0;
    seeded++;
  }
  return agents;
}

function stepEpidemic(p) {
  const canvas = document.getElementById('epidemic-canvas');
  const W = canvas.width, H = canvas.height;
  const agents = epidState.agents;

  // Move agents
  for (const a of agents) {
    if (p.quarantine && a.state === 'I') continue; // quarantined stay still
    a.x += a.vx;
    a.y += a.vy;
    if (a.x < 0 || a.x > W) { a.vx *= -1; a.x = clamp(a.x, 0, W); }
    if (a.y < 0 || a.y > H) { a.vy *= -1; a.y = clamp(a.y, 0, H); }
  }

  // Transmission: build spatial grid
  const cellSize = Math.max(p.radius, 20);
  const grid = new Map();
  for (let i = 0; i < agents.length; i++) {
    const cx = Math.floor(agents[i].x / cellSize);
    const cy = Math.floor(agents[i].y / cellSize);
    const key = `${cx},${cy}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(i);
  }

  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    if (a.state !== 'I') continue;
    const cx = Math.floor(a.x / cellSize);
    const cy = Math.floor(a.y / cellSize);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const neighbors = grid.get(`${cx + dx},${cy + dy}`);
        if (!neighbors) continue;
        for (const j of neighbors) {
          if (i === j) continue;
          const b = agents[j];
          if (b.state !== 'S') continue;
          if (dist(a, b) <= p.radius && Math.random() < p.beta) {
            b.state = p.incub > 0 ? 'E' : 'I';
            b.timer = 0;
            b.infected_by = i;
            a.secondary++;
          }
        }
      }
    }
  }

  // State transitions
  for (const a of agents) {
    if (a.state === 'E') {
      a.timer++;
      if (a.timer >= p.incub) { a.state = 'I'; a.timer = 0; }
    } else if (a.state === 'I') {
      a.timer++;
      if (a.timer >= p.recov) {
        a.state = Math.random() < p.mort ? 'D' : 'R';
        epidState.secondaryInfections.push(a.secondary);
      }
    }
  }

  epidState.day++;
  const counts = { S: 0, E: 0, I: 0, R: 0, D: 0 };
  for (const a of agents) counts[a.state]++;
  epidState.timeSeries.push({ t: epidState.day, ...counts });
  return counts;
}

function renderEpidemicCanvas() {
  const canvas = document.getElementById('epidemic-canvas');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const a of epidState.agents) {
    if (a.state === 'D') continue;
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.state === 'I' ? 4 : 3, 0, Math.PI * 2);
    ctx.fillStyle = COLORS[a.state];
    ctx.fill();
  }
}

function updateEpidemicMetrics(c) {
  document.getElementById('metric-day').textContent = epidState.day;
  document.getElementById('metric-S').textContent = c.S;
  document.getElementById('metric-I').textContent = c.I + c.E;
  document.getElementById('metric-R').textContent = c.R;
  document.getElementById('metric-D').textContent = c.D;

  // Effective R
  if (epidState.secondaryInfections.length > 5) {
    const recent = epidState.secondaryInfections.slice(-20);
    const rEff = recent.reduce((a, b) => a + b, 0) / recent.length;
    document.getElementById('metric-Reff').textContent = rEff.toFixed(2);
  }

  document.getElementById('epidemic-status').textContent =
    c.I + c.E === 0 && epidState.day > 0
      ? `Epidemic ended on day ${epidState.day}`
      : `Day ${epidState.day} — ${c.I} infected, ${c.E} exposed`;
}

function drawEpidemicCurve() {
  const el = document.getElementById('epidemic-curve-chart');
  el.innerHTML = '';
  const data = epidState.timeSeries;
  if (data.length < 2) return;

  const width = el.clientWidth || 650;
  const height = 260;
  const m = { top: 20, right: 100, bottom: 35, left: 50 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;

  const svg = d3.select(el).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const x = d3.scaleLinear().domain([0, d3.max(data, d => d.t)]).range([0, w]);
  const maxPop = d3.max(data, d => d.S + d.E + d.I + d.R + d.D);
  const y = d3.scaleLinear().domain([0, maxPop]).range([h, 0]).nice();

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).ticks(8));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(5));

  const compartments = [
    { key: 'S', color: COLORS.S, label: 'Susceptible' },
    { key: 'E', color: COLORS.E, label: 'Exposed' },
    { key: 'I', color: COLORS.I, label: 'Infected' },
    { key: 'R', color: COLORS.R, label: 'Recovered' },
    { key: 'D', color: COLORS.D, label: 'Deceased' },
  ];

  for (const comp of compartments) {
    const line = d3.line().x(d => x(d.t)).y(d => y(d[comp.key])).curve(d3.curveBasis);
    g.append('path').datum(data).attr('fill', 'none')
      .attr('stroke', comp.color).attr('stroke-width', 2).attr('d', line);

    const last = data[data.length - 1];
    g.append('text').attr('x', w + 5).attr('y', y(last[comp.key]))
      .attr('fill', comp.color).attr('font-size', 11).attr('dy', '0.35em')
      .text(comp.label);
  }
}

function epidemicLoop() {
  if (!epidState.running) return;
  const p = readEpidControls();
  const counts = stepEpidemic(p);
  renderEpidemicCanvas();
  updateEpidemicMetrics(counts);
  if (epidState.day % 3 === 0) drawEpidemicCurve();

  if (counts.I + counts.E === 0 && epidState.day > 1) {
    epidState.running = false;
    document.getElementById('epid-start-btn').textContent = 'Start';
    drawEpidemicCurve();
    return;
  }
  epidState.frameId = setTimeout(() => requestAnimationFrame(epidemicLoop), 50);
}

function initEpidemic() {
  const startBtn = document.getElementById('epid-start-btn');
  const resetBtn = document.getElementById('epid-reset-btn');
  const presetSel = document.getElementById('epidemic-preset');

  // Slider display updates
  const sliders = [
    ['epid-pop-slider', 'epid-pop-display', v => v],
    ['epid-init-slider', 'epid-init-display', v => v],
    ['epid-beta-slider', 'epid-beta-display', v => (+v).toFixed(2)],
    ['epid-radius-slider', 'epid-radius-display', v => v],
    ['epid-incub-slider', 'epid-incub-display', v => v],
    ['epid-recov-slider', 'epid-recov-display', v => v],
    ['epid-mort-slider', 'epid-mort-display', v => (+v).toFixed(2)],
    ['epid-speed-slider', 'epid-speed-display', v => (+v).toFixed(1)],
  ];
  for (const [sid, did, fmt] of sliders) {
    document.getElementById(sid).addEventListener('input', function () {
      document.getElementById(did).textContent = fmt(this.value);
    });
  }

  presetSel.addEventListener('change', () => {
    const preset = EPIDEMIC_PRESETS[presetSel.value];
    if (!preset) return;
    document.getElementById('epid-beta-slider').value = preset.beta;
    document.getElementById('epid-beta-display').textContent = preset.beta.toFixed(2);
    document.getElementById('epid-incub-slider').value = preset.incub;
    document.getElementById('epid-incub-display').textContent = preset.incub;
    document.getElementById('epid-recov-slider').value = preset.recov;
    document.getElementById('epid-recov-display').textContent = preset.recov;
    document.getElementById('epid-mort-slider').value = preset.mort;
    document.getElementById('epid-mort-display').textContent = preset.mort.toFixed(2);
    document.getElementById('epid-radius-slider').value = preset.radius;
    document.getElementById('epid-radius-display').textContent = preset.radius;
    document.getElementById('epid-speed-slider').value = preset.speed;
    document.getElementById('epid-speed-display').textContent = preset.speed.toFixed(1);
  });

  startBtn.addEventListener('click', () => {
    if (epidState.running) {
      epidState.running = false;
      startBtn.textContent = 'Resume';
      return;
    }
    if (epidState.agents.length === 0 || epidState.day === 0) {
      const p = readEpidControls();
      epidState.agents = createEpidAgents(p);
      epidState.day = 0;
      epidState.timeSeries = [];
      epidState.secondaryInfections = [];
    }
    epidState.running = true;
    startBtn.textContent = 'Pause';
    epidemicLoop();
  });

  resetBtn.addEventListener('click', () => {
    epidState.running = false;
    if (epidState.frameId) clearTimeout(epidState.frameId);
    epidState.agents = [];
    epidState.day = 0;
    epidState.timeSeries = [];
    epidState.secondaryInfections = [];
    startBtn.textContent = 'Start';
    document.getElementById('epidemic-status').innerHTML = 'Click <strong>Start</strong> to begin simulation';
    const canvas = document.getElementById('epidemic-canvas');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    document.getElementById('epidemic-curve-chart').innerHTML = '';
    ['metric-day', 'metric-S', 'metric-I', 'metric-R', 'metric-D'].forEach(id =>
      document.getElementById(id).textContent = '0');
    document.getElementById('metric-Reff').textContent = '—';
  });

  // Render equations
  try {
    katex.render(String.raw`
      P(\text{S} \to \text{E}) = 1 - (1 - \beta)^{n_{\text{contacts}}}, \quad
      \text{E} \xrightarrow{T_{\text{incub}}} \text{I} \xrightarrow{T_{\text{recov}}}
      \begin{cases} \text{R} & \text{w.p. } 1 - \mu \\ \text{D} & \text{w.p. } \mu \end{cases}
    `, document.getElementById('epidemic-equations'), { displayMode: true, throwOnError: false });
  } catch (e) { /* KaTeX not loaded */ }
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  2. FLOCKING (BOIDS)                                        ║
// ╚══════════════════════════════════════════════════════════════╝

const flockState = { boids: [], predator: null, running: false, frameId: null };

function createBoids(count, canvas) {
  const boids = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = rand(1.5, 3);
    boids.push({
      x: rand(0, canvas.width), y: rand(0, canvas.height),
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      trail: [],
    });
  }
  return boids;
}

function readFlockControls() {
  return {
    count: +document.getElementById('flock-count-slider').value,
    separation: +document.getElementById('flock-sep-slider').value,
    alignment: +document.getElementById('flock-ali-slider').value,
    cohesion: +document.getElementById('flock-coh-slider').value,
    radius: +document.getElementById('flock-radius-slider').value,
    maxSpeed: +document.getElementById('flock-speed-slider').value,
    predator: document.getElementById('flock-predator-toggle').checked,
    trails: document.getElementById('flock-trails-toggle').checked,
  };
}

function stepBoids(p) {
  const canvas = document.getElementById('flocking-canvas');
  const W = canvas.width, H = canvas.height;
  const boids = flockState.boids;

  for (const b of boids) {
    let sepX = 0, sepY = 0;
    let aliX = 0, aliY = 0;
    let cohX = 0, cohY = 0;
    let neighbors = 0;
    let closeToo = 0;

    for (const other of boids) {
      if (other === b) continue;
      const d = dist(b, other);
      if (d > p.radius) continue;
      neighbors++;

      // Separation
      if (d < p.radius * 0.4 && d > 0) {
        sepX += (b.x - other.x) / d;
        sepY += (b.y - other.y) / d;
        closeToo++;
      }

      // Alignment
      aliX += other.vx;
      aliY += other.vy;

      // Cohesion
      cohX += other.x;
      cohY += other.y;
    }

    if (neighbors > 0) {
      // Separation
      if (closeToo > 0) { sepX /= closeToo; sepY /= closeToo; }
      b.vx += sepX * p.separation * 0.3;
      b.vy += sepY * p.separation * 0.3;

      // Alignment
      aliX /= neighbors; aliY /= neighbors;
      b.vx += (aliX - b.vx) * p.alignment * 0.05;
      b.vy += (aliY - b.vy) * p.alignment * 0.05;

      // Cohesion
      cohX /= neighbors; cohY /= neighbors;
      b.vx += (cohX - b.x) * p.cohesion * 0.005;
      b.vy += (cohY - b.y) * p.cohesion * 0.005;
    }

    // Flee from predator
    if (p.predator && flockState.predator) {
      const dp = dist(b, flockState.predator);
      if (dp < p.radius * 2 && dp > 0) {
        b.vx += (b.x - flockState.predator.x) / dp * 2;
        b.vy += (b.y - flockState.predator.y) / dp * 2;
      }
    }

    // Clamp speed
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > p.maxSpeed) {
      b.vx = (b.vx / speed) * p.maxSpeed;
      b.vy = (b.vy / speed) * p.maxSpeed;
    }

    b.x += b.vx;
    b.y += b.vy;

    // Wrap
    if (b.x < 0) b.x += W;
    if (b.x > W) b.x -= W;
    if (b.y < 0) b.y += H;
    if (b.y > H) b.y -= H;

    // Trail
    if (p.trails) {
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 15) b.trail.shift();
    } else {
      b.trail = [];
    }
  }

  // Move predator toward nearest boid
  if (p.predator && flockState.predator) {
    let closest = null, minD = Infinity;
    for (const b of boids) {
      const d = dist(flockState.predator, b);
      if (d < minD) { minD = d; closest = b; }
    }
    if (closest) {
      const dx = closest.x - flockState.predator.x;
      const dy = closest.y - flockState.predator.y;
      const d = Math.hypot(dx, dy) || 1;
      flockState.predator.vx += (dx / d) * 0.15;
      flockState.predator.vy += (dy / d) * 0.15;
      const sp = Math.hypot(flockState.predator.vx, flockState.predator.vy);
      if (sp > p.maxSpeed * 0.8) {
        flockState.predator.vx = (flockState.predator.vx / sp) * p.maxSpeed * 0.8;
        flockState.predator.vy = (flockState.predator.vy / sp) * p.maxSpeed * 0.8;
      }
    }
    flockState.predator.x += flockState.predator.vx;
    flockState.predator.y += flockState.predator.vy;
    if (flockState.predator.x < 0) flockState.predator.x += W;
    if (flockState.predator.x > W) flockState.predator.x -= W;
    if (flockState.predator.y < 0) flockState.predator.y += H;
    if (flockState.predator.y > H) flockState.predator.y -= H;
  }
}

function renderFlocking(p) {
  const canvas = document.getElementById('flocking-canvas');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Trails
  if (p.trails) {
    ctx.globalAlpha = 0.2;
    for (const b of flockState.boids) {
      if (b.trail.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(b.trail[0].x, b.trail[0].y);
      for (let i = 1; i < b.trail.length; i++) ctx.lineTo(b.trail[i].x, b.trail[i].y);
      ctx.strokeStyle = COLORS.boid;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Boids as triangles pointing in velocity direction
  for (const b of flockState.boids) {
    const angle = Math.atan2(b.vy, b.vx);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -3);
    ctx.lineTo(-4, 3);
    ctx.closePath();
    ctx.fillStyle = COLORS.boid;
    ctx.fill();
    ctx.restore();
  }

  // Predator
  if (p.predator && flockState.predator) {
    const pr = flockState.predator;
    const angle = Math.atan2(pr.vy, pr.vx);
    ctx.save();
    ctx.translate(pr.x, pr.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fillStyle = COLORS.predatorBoid;
    ctx.fill();
    ctx.restore();
  }
}

function updateFlockMetrics() {
  const boids = flockState.boids;
  document.getElementById('metric-boids').textContent = boids.length;

  const avgSpeed = boids.reduce((s, b) => s + Math.hypot(b.vx, b.vy), 0) / boids.length;
  document.getElementById('metric-avg-speed').textContent = avgSpeed.toFixed(1);

  // Alignment: average dot product of velocity directions
  let totalAlign = 0;
  const avgVx = boids.reduce((s, b) => s + b.vx, 0) / boids.length;
  const avgVy = boids.reduce((s, b) => s + b.vy, 0) / boids.length;
  const avgMag = Math.hypot(avgVx, avgVy) || 1;
  for (const b of boids) {
    const mag = Math.hypot(b.vx, b.vy) || 1;
    totalAlign += (b.vx * avgVx + b.vy * avgVy) / (mag * avgMag);
  }
  document.getElementById('metric-alignment').textContent = (totalAlign / boids.length).toFixed(2);

  // Simple cluster count via connected components at radius/2
  const visited = new Set();
  let clusters = 0;
  const r = 40;
  for (let i = 0; i < boids.length; i++) {
    if (visited.has(i)) continue;
    clusters++;
    const queue = [i];
    while (queue.length) {
      const ci = queue.pop();
      if (visited.has(ci)) continue;
      visited.add(ci);
      for (let j = 0; j < boids.length; j++) {
        if (!visited.has(j) && dist(boids[ci], boids[j]) < r) queue.push(j);
      }
    }
  }
  document.getElementById('metric-clusters').textContent = clusters;
}

function flockingLoop() {
  if (!flockState.running) return;
  const p = readFlockControls();
  stepBoids(p);
  renderFlocking(p);
  updateFlockMetrics();
  flockState.frameId = requestAnimationFrame(flockingLoop);
}

function initFlocking() {
  const startBtn = document.getElementById('flock-start-btn');
  const resetBtn = document.getElementById('flock-reset-btn');

  const sliders = [
    ['flock-count-slider', 'flock-count-display', v => v],
    ['flock-sep-slider', 'flock-sep-display', v => (+v).toFixed(1)],
    ['flock-ali-slider', 'flock-ali-display', v => (+v).toFixed(1)],
    ['flock-coh-slider', 'flock-coh-display', v => (+v).toFixed(1)],
    ['flock-radius-slider', 'flock-radius-display', v => v],
    ['flock-speed-slider', 'flock-speed-display', v => (+v).toFixed(1)],
  ];
  for (const [sid, did, fmt] of sliders) {
    document.getElementById(sid).addEventListener('input', function () {
      document.getElementById(did).textContent = fmt(this.value);
    });
  }

  startBtn.addEventListener('click', () => {
    if (flockState.running) {
      flockState.running = false;
      if (flockState.frameId) cancelAnimationFrame(flockState.frameId);
      startBtn.textContent = 'Resume';
      return;
    }
    const p = readFlockControls();
    if (flockState.boids.length === 0) {
      const canvas = document.getElementById('flocking-canvas');
      flockState.boids = createBoids(p.count, canvas);
      if (p.predator) {
        flockState.predator = {
          x: canvas.width / 2, y: canvas.height / 2, vx: 1, vy: 0
        };
      }
    }
    if (p.predator && !flockState.predator) {
      const canvas = document.getElementById('flocking-canvas');
      flockState.predator = { x: canvas.width / 2, y: canvas.height / 2, vx: 1, vy: 0 };
    }
    if (!p.predator) flockState.predator = null;
    flockState.running = true;
    startBtn.textContent = 'Pause';
    flockingLoop();
  });

  resetBtn.addEventListener('click', () => {
    flockState.running = false;
    if (flockState.frameId) cancelAnimationFrame(flockState.frameId);
    flockState.boids = [];
    flockState.predator = null;
    startBtn.textContent = 'Start';
    const canvas = document.getElementById('flocking-canvas');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ['metric-boids', 'metric-avg-speed', 'metric-alignment', 'metric-clusters'].forEach(id =>
      document.getElementById(id).textContent = '0');
  });

  // Equations
  try {
    katex.render(String.raw`
      \vec{v}_i \leftarrow \vec{v}_i
        + w_s \cdot \underbrace{\sum_{j \in N_i^{\text{close}}} \frac{\vec{r}_i - \vec{r}_j}{\|\vec{r}_i - \vec{r}_j\|}}_{\text{separation}}
        + w_a \cdot \underbrace{(\bar{\vec{v}}_{N_i} - \vec{v}_i)}_{\text{alignment}}
        + w_c \cdot \underbrace{(\bar{\vec{r}}_{N_i} - \vec{r}_i)}_{\text{cohesion}}
    `, document.getElementById('flocking-equations'), { displayMode: true, throwOnError: false });
  } catch (e) { /* KaTeX not loaded */ }
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  3. SCHELLING SEGREGATION                                   ║
// ╚══════════════════════════════════════════════════════════════╝

const segState = { grid: [], size: 0, running: false, frameId: null, step: 0, timeSeries: [] };

function readSegControls() {
  return {
    size: +document.getElementById('seg-grid-slider').value,
    density: +document.getElementById('seg-density-slider').value,
    threshold: +document.getElementById('seg-thresh-slider').value,
    ratio: +document.getElementById('seg-ratio-slider').value,
  };
}

function createSegGrid(p) {
  const grid = new Array(p.size * p.size).fill(0); // 0=empty, 1=typeA, 2=typeB
  const totalOccupied = Math.floor(p.size * p.size * p.density);
  const typeA = Math.floor(totalOccupied * p.ratio);
  const typeB = totalOccupied - typeA;

  // Fill and shuffle
  const indices = Array.from({ length: p.size * p.size }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  for (let i = 0; i < typeA; i++) grid[indices[i]] = 1;
  for (let i = typeA; i < typeA + typeB; i++) grid[indices[i]] = 2;
  return grid;
}

function getSegNeighbors(idx, size) {
  const r = Math.floor(idx / size), c = idx % size;
  const neighbors = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
        neighbors.push(nr * size + nc);
      }
    }
  }
  return neighbors;
}

function stepSegregation(p) {
  const grid = segState.grid;
  const size = segState.size;
  let moves = 0;

  // Find unhappy agents and empty cells
  const unhappy = [];
  const empties = [];

  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === 0) { empties.push(i); continue; }
    const neighbors = getSegNeighbors(i, size);
    const occupied = neighbors.filter(n => grid[n] !== 0);
    if (occupied.length === 0) continue;
    const same = occupied.filter(n => grid[n] === grid[i]).length;
    if (same / occupied.length < p.threshold) unhappy.push(i);
  }

  // Shuffle unhappy and move to random empty cells
  for (let i = unhappy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unhappy[i], unhappy[j]] = [unhappy[j], unhappy[i]];
  }

  for (const idx of unhappy) {
    if (empties.length === 0) break;
    const emptyIdx = Math.floor(Math.random() * empties.length);
    const target = empties[emptyIdx];
    grid[target] = grid[idx];
    grid[idx] = 0;
    empties[emptyIdx] = idx; // old cell is now empty
    moves++;
  }

  segState.step++;

  // Calculate metrics
  let happyCount = 0, totalOccupied = 0, segIndex = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === 0) continue;
    totalOccupied++;
    const neighbors = getSegNeighbors(i, size);
    const occupied = neighbors.filter(n => grid[n] !== 0);
    if (occupied.length === 0) { happyCount++; continue; }
    const same = occupied.filter(n => grid[n] === grid[i]).length;
    const ratio = same / occupied.length;
    segIndex += ratio;
    if (ratio >= p.threshold) happyCount++;
  }
  segIndex = totalOccupied > 0 ? segIndex / totalOccupied : 0;
  const happyPct = totalOccupied > 0 ? (happyCount / totalOccupied * 100) : 0;

  segState.timeSeries.push({ step: segState.step, segIndex, happyPct, moves });
  return { happyPct, segIndex, moves };
}

function renderSegCanvas() {
  const canvas = document.getElementById('seg-canvas');
  const ctx = canvas.getContext('2d');
  const size = segState.size;
  const cellW = canvas.width / size;
  const cellH = canvas.height / size;

  ctx.fillStyle = COLORS.empty;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < segState.grid.length; i++) {
    if (segState.grid[i] === 0) continue;
    const r = Math.floor(i / size), c = i % size;
    ctx.fillStyle = segState.grid[i] === 1 ? COLORS.typeA : COLORS.typeB;
    ctx.fillRect(c * cellW, r * cellH, cellW - 0.5, cellH - 0.5);
  }
}

function drawSegChart() {
  const el = document.getElementById('seg-chart');
  el.innerHTML = '';
  const data = segState.timeSeries;
  if (data.length < 2) return;

  const width = el.clientWidth || 600;
  const height = 240;
  const m = { top: 20, right: 80, bottom: 35, left: 50 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;

  const svg = d3.select(el).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const x = d3.scaleLinear().domain([0, d3.max(data, d => d.step)]).range([0, w]);
  const y = d3.scaleLinear().domain([0, 1]).range([h, 0]);

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).ticks(6));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.0%')));

  const lineSeg = d3.line().x(d => x(d.step)).y(d => y(d.segIndex)).curve(d3.curveBasis);
  g.append('path').datum(data).attr('fill', 'none')
    .attr('stroke', COLORS.typeA).attr('stroke-width', 2).attr('d', lineSeg);

  const lineHappy = d3.line().x(d => x(d.step)).y(d => y(d.happyPct / 100)).curve(d3.curveBasis);
  g.append('path').datum(data).attr('fill', 'none')
    .attr('stroke', COLORS.typeB).attr('stroke-width', 2).attr('d', lineHappy);

  const last = data[data.length - 1];
  g.append('text').attr('x', w + 5).attr('y', y(last.segIndex)).attr('fill', COLORS.typeA)
    .attr('font-size', 11).attr('dy', '0.35em').text('Seg Index');
  g.append('text').attr('x', w + 5).attr('y', y(last.happyPct / 100)).attr('fill', COLORS.typeB)
    .attr('font-size', 11).attr('dy', '0.35em').text('Happy %');
}

function updateSegMetrics(m) {
  document.getElementById('metric-seg-step').textContent = segState.step;
  document.getElementById('metric-seg-happy').textContent = m.happyPct.toFixed(1) + '%';
  document.getElementById('metric-seg-index').textContent = m.segIndex.toFixed(3);
  document.getElementById('metric-seg-moves').textContent = m.moves;
}

function segLoop() {
  if (!segState.running) return;
  const p = readSegControls();
  const m = stepSegregation(p);
  renderSegCanvas();
  updateSegMetrics(m);
  if (segState.step % 2 === 0) drawSegChart();

  if (m.moves === 0) {
    segState.running = false;
    document.getElementById('seg-start-btn').textContent = 'Start';
    drawSegChart();
    return;
  }
  segState.frameId = setTimeout(() => requestAnimationFrame(segLoop), 80);
}

function initSegregation() {
  const startBtn = document.getElementById('seg-start-btn');
  const stepBtn = document.getElementById('seg-step-btn');
  const resetBtn = document.getElementById('seg-reset-btn');

  const sliders = [
    ['seg-grid-slider', 'seg-grid-display', v => v],
    ['seg-density-slider', 'seg-density-display', v => (+v).toFixed(2)],
    ['seg-thresh-slider', 'seg-thresh-display', v => (+v).toFixed(2)],
    ['seg-ratio-slider', 'seg-ratio-display', v => (+v).toFixed(2)],
  ];
  for (const [sid, did, fmt] of sliders) {
    document.getElementById(sid).addEventListener('input', function () {
      document.getElementById(did).textContent = fmt(this.value);
    });
  }

  function resetSeg() {
    segState.running = false;
    if (segState.frameId) clearTimeout(segState.frameId);
    const p = readSegControls();
    segState.size = p.size;
    segState.grid = createSegGrid(p);
    segState.step = 0;
    segState.timeSeries = [];
    startBtn.textContent = 'Start';
    renderSegCanvas();
    document.getElementById('seg-chart').innerHTML = '';
    updateSegMetrics({ happyPct: 0, segIndex: 0, moves: 0 });
  }

  startBtn.addEventListener('click', () => {
    if (segState.running) {
      segState.running = false;
      if (segState.frameId) clearTimeout(segState.frameId);
      startBtn.textContent = 'Resume';
      return;
    }
    if (segState.grid.length === 0) resetSeg();
    segState.running = true;
    startBtn.textContent = 'Pause';
    segLoop();
  });

  stepBtn.addEventListener('click', () => {
    if (segState.grid.length === 0) resetSeg();
    const p = readSegControls();
    const m = stepSegregation(p);
    renderSegCanvas();
    updateSegMetrics(m);
    drawSegChart();
  });

  resetBtn.addEventListener('click', resetSeg);

  // Initialize grid
  resetSeg();
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  4. PREDATOR-PREY                                           ║
// ╚══════════════════════════════════════════════════════════════╝

const ppState = { prey: [], predators: [], food: [], running: false, frameId: null, step: 0, timeSeries: [] };

function readPPControls() {
  return {
    initPrey: +document.getElementById('pp-prey-slider').value,
    initPred: +document.getElementById('pp-pred-slider').value,
    preyRepro: +document.getElementById('pp-prey-repro-slider').value,
    predRepro: +document.getElementById('pp-pred-repro-slider').value,
    starve: +document.getElementById('pp-starve-slider').value,
    grassRegrow: +document.getElementById('pp-grass-slider').value,
  };
}

function createPPWorld(p) {
  const canvas = document.getElementById('pp-canvas');
  const W = canvas.width, H = canvas.height;

  const prey = [];
  for (let i = 0; i < p.initPrey; i++) {
    prey.push({
      x: rand(0, W), y: rand(0, H),
      vx: rand(-1.5, 1.5), vy: rand(-1.5, 1.5),
      energy: 20 + Math.floor(Math.random() * 20),
    });
  }

  const predators = [];
  for (let i = 0; i < p.initPred; i++) {
    predators.push({
      x: rand(0, W), y: rand(0, H),
      vx: rand(-1, 1), vy: rand(-1, 1),
      energy: p.starve,
    });
  }

  // Scatter food patches
  const food = [];
  for (let i = 0; i < Math.floor(W * H / 1500); i++) {
    food.push({ x: rand(0, W), y: rand(0, H), alive: true });
  }

  return { prey, predators, food };
}

function stepPP(p) {
  const canvas = document.getElementById('pp-canvas');
  const W = canvas.width, H = canvas.height;

  // Move prey (random walk + flee predators)
  for (const pr of ppState.prey) {
    let fleeX = 0, fleeY = 0;
    for (const pred of ppState.predators) {
      const d = dist(pr, pred);
      if (d < 80 && d > 0) {
        fleeX += (pr.x - pred.x) / d;
        fleeY += (pr.y - pred.y) / d;
      }
    }
    pr.vx += fleeX * 0.3 + rand(-0.5, 0.5);
    pr.vy += fleeY * 0.3 + rand(-0.5, 0.5);
    const sp = Math.hypot(pr.vx, pr.vy);
    if (sp > 2.5) { pr.vx = (pr.vx / sp) * 2.5; pr.vy = (pr.vy / sp) * 2.5; }
    pr.x += pr.vx; pr.y += pr.vy;
    if (pr.x < 0) pr.x += W; if (pr.x > W) pr.x -= W;
    if (pr.y < 0) pr.y += H; if (pr.y > H) pr.y -= H;

    // Eat food
    for (const f of ppState.food) {
      if (f.alive && dist(pr, f) < 10) {
        f.alive = false;
        pr.energy += 10;
        break;
      }
    }
    pr.energy--;
  }

  // Move predators (chase nearest prey)
  for (const pred of ppState.predators) {
    let closest = null, minD = Infinity;
    for (const pr of ppState.prey) {
      const d = dist(pred, pr);
      if (d < minD) { minD = d; closest = pr; }
    }
    if (closest && minD < 120) {
      const dx = closest.x - pred.x, dy = closest.y - pred.y;
      const d = Math.hypot(dx, dy) || 1;
      pred.vx += (dx / d) * 0.2;
      pred.vy += (dy / d) * 0.2;
    } else {
      pred.vx += rand(-0.3, 0.3);
      pred.vy += rand(-0.3, 0.3);
    }
    const sp = Math.hypot(pred.vx, pred.vy);
    if (sp > 2) { pred.vx = (pred.vx / sp) * 2; pred.vy = (pred.vy / sp) * 2; }
    pred.x += pred.vx; pred.y += pred.vy;
    if (pred.x < 0) pred.x += W; if (pred.x > W) pred.x -= W;
    if (pred.y < 0) pred.y += H; if (pred.y > H) pred.y -= H;

    // Eat prey
    for (let i = ppState.prey.length - 1; i >= 0; i--) {
      if (dist(pred, ppState.prey[i]) < 8) {
        ppState.prey.splice(i, 1);
        pred.energy += 20;
        break;
      }
    }
    pred.energy--;
  }

  // Prey die if no energy
  ppState.prey = ppState.prey.filter(pr => pr.energy > 0);

  // Predators die if starved
  ppState.predators = ppState.predators.filter(pred => pred.energy > 0);

  // Prey reproduce
  const newPrey = [];
  for (const pr of ppState.prey) {
    if (pr.energy > 15 && Math.random() < p.preyRepro) {
      pr.energy = Math.floor(pr.energy / 2);
      newPrey.push({
        x: pr.x + rand(-5, 5), y: pr.y + rand(-5, 5),
        vx: rand(-1.5, 1.5), vy: rand(-1.5, 1.5),
        energy: pr.energy,
      });
    }
  }
  ppState.prey.push(...newPrey);

  // Predators reproduce
  const newPred = [];
  for (const pred of ppState.predators) {
    if (pred.energy > p.starve * 0.5 && Math.random() < p.predRepro) {
      pred.energy = Math.floor(pred.energy / 2);
      newPred.push({
        x: pred.x + rand(-5, 5), y: pred.y + rand(-5, 5),
        vx: rand(-1, 1), vy: rand(-1, 1),
        energy: pred.energy,
      });
    }
  }
  ppState.predators.push(...newPred);

  // Grass regrowth
  for (const f of ppState.food) {
    if (!f.alive && Math.random() < p.grassRegrow) f.alive = true;
  }

  // Cap populations
  if (ppState.prey.length > 500) ppState.prey.length = 500;
  if (ppState.predators.length > 200) ppState.predators.length = 200;

  ppState.step++;
  ppState.timeSeries.push({
    step: ppState.step,
    prey: ppState.prey.length,
    predators: ppState.predators.length,
    food: ppState.food.filter(f => f.alive).length,
  });
}

function renderPP() {
  const canvas = document.getElementById('pp-canvas');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Food
  for (const f of ppState.food) {
    if (!f.alive) continue;
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(f.x - 2, f.y - 2, 4, 4);
  }

  // Prey
  ctx.fillStyle = COLORS.prey;
  for (const pr of ppState.prey) {
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Predators
  ctx.fillStyle = COLORS.predator;
  for (const pred of ppState.predators) {
    ctx.beginPath();
    ctx.arc(pred.x, pred.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function updatePPMetrics() {
  document.getElementById('metric-pp-step').textContent = ppState.step;
  document.getElementById('metric-pp-prey').textContent = ppState.prey.length;
  document.getElementById('metric-pp-pred').textContent = ppState.predators.length;
  document.getElementById('metric-pp-food').textContent = ppState.food.filter(f => f.alive).length;
}

function drawPPCharts() {
  // Population chart
  const el = document.getElementById('pp-pop-chart');
  el.innerHTML = '';
  const data = ppState.timeSeries;
  if (data.length < 2) return;

  const width = el.clientWidth || 650;
  const height = 240;
  const m = { top: 20, right: 80, bottom: 35, left: 50 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;

  const svg = d3.select(el).append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const x = d3.scaleLinear().domain([0, d3.max(data, d => d.step)]).range([0, w]);
  const yMax = d3.max(data, d => Math.max(d.prey, d.predators));
  const y = d3.scaleLinear().domain([0, yMax * 1.1]).range([h, 0]).nice();

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).ticks(8));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(5));

  const linePrey = d3.line().x(d => x(d.step)).y(d => y(d.prey)).curve(d3.curveBasis);
  g.append('path').datum(data).attr('fill', 'none')
    .attr('stroke', COLORS.prey).attr('stroke-width', 2).attr('d', linePrey);

  const linePred = d3.line().x(d => x(d.step)).y(d => y(d.predators)).curve(d3.curveBasis);
  g.append('path').datum(data).attr('fill', 'none')
    .attr('stroke', COLORS.predator).attr('stroke-width', 2).attr('d', linePred);

  const last = data[data.length - 1];
  g.append('text').attr('x', w + 5).attr('y', y(last.prey)).attr('fill', COLORS.prey)
    .attr('font-size', 11).attr('dy', '0.35em').text('Prey');
  g.append('text').attr('x', w + 5).attr('y', y(last.predators)).attr('fill', COLORS.predator)
    .attr('font-size', 11).attr('dy', '0.35em').text('Predators');

  // Phase portrait
  const el2 = document.getElementById('pp-phase-chart');
  el2.innerHTML = '';

  const svg2 = d3.select(el2).append('svg').attr('width', width).attr('height', 280);
  const g2 = svg2.append('g').attr('transform', `translate(${m.left},${m.top})`);
  const h2 = 280 - m.top - m.bottom;

  const xP = d3.scaleLinear().domain([0, d3.max(data, d => d.prey) * 1.1]).range([0, w]).nice();
  const yP = d3.scaleLinear().domain([0, d3.max(data, d => d.predators) * 1.1]).range([h2, 0]).nice();

  g2.append('g').attr('class', 'axis').attr('transform', `translate(0,${h2})`).call(d3.axisBottom(xP).ticks(6));
  g2.append('g').attr('class', 'axis').call(d3.axisLeft(yP).ticks(5));
  g2.append('text').attr('x', w / 2).attr('y', h2 + 30).attr('text-anchor', 'middle')
    .attr('font-size', 11).attr('fill', '#888').text('Prey');
  g2.append('text').attr('x', -h2 / 2).attr('y', -35).attr('text-anchor', 'middle')
    .attr('transform', 'rotate(-90)').attr('font-size', 11).attr('fill', '#888').text('Predators');

  const phaseLine = d3.line().x(d => xP(d.prey)).y(d => yP(d.predators)).curve(d3.curveBasis);
  g2.append('path').datum(data).attr('fill', 'none')
    .attr('stroke', '#7c3aed').attr('stroke-width', 1.5).attr('opacity', 0.7).attr('d', phaseLine);

  // Mark current position
  g2.append('circle').attr('cx', xP(last.prey)).attr('cy', yP(last.predators))
    .attr('r', 4).attr('fill', '#7c3aed');
}

function ppLoop() {
  if (!ppState.running) return;
  const p = readPPControls();
  stepPP(p);
  renderPP();
  updatePPMetrics();
  if (ppState.step % 5 === 0) drawPPCharts();

  // Stop if extinct
  if (ppState.prey.length === 0 && ppState.predators.length === 0) {
    ppState.running = false;
    document.getElementById('pp-start-btn').textContent = 'Start';
    drawPPCharts();
    return;
  }
  ppState.frameId = setTimeout(() => requestAnimationFrame(ppLoop), 40);
}

function initPredPrey() {
  const startBtn = document.getElementById('pp-start-btn');
  const resetBtn = document.getElementById('pp-reset-btn');

  const sliders = [
    ['pp-prey-slider', 'pp-prey-display', v => v],
    ['pp-pred-slider', 'pp-pred-display', v => v],
    ['pp-prey-repro-slider', 'pp-prey-repro-display', v => (+v).toFixed(2)],
    ['pp-pred-repro-slider', 'pp-pred-repro-display', v => (+v).toFixed(2)],
    ['pp-starve-slider', 'pp-starve-display', v => v],
    ['pp-grass-slider', 'pp-grass-display', v => (+v).toFixed(2)],
  ];
  for (const [sid, did, fmt] of sliders) {
    document.getElementById(sid).addEventListener('input', function () {
      document.getElementById(did).textContent = fmt(this.value);
    });
  }

  startBtn.addEventListener('click', () => {
    if (ppState.running) {
      ppState.running = false;
      if (ppState.frameId) clearTimeout(ppState.frameId);
      startBtn.textContent = 'Resume';
      return;
    }
    if (ppState.prey.length === 0 && ppState.predators.length === 0 && ppState.step === 0) {
      const p = readPPControls();
      const world = createPPWorld(p);
      ppState.prey = world.prey;
      ppState.predators = world.predators;
      ppState.food = world.food;
      ppState.step = 0;
      ppState.timeSeries = [];
    }
    ppState.running = true;
    startBtn.textContent = 'Pause';
    ppLoop();
  });

  resetBtn.addEventListener('click', () => {
    ppState.running = false;
    if (ppState.frameId) clearTimeout(ppState.frameId);
    ppState.prey = [];
    ppState.predators = [];
    ppState.food = [];
    ppState.step = 0;
    ppState.timeSeries = [];
    startBtn.textContent = 'Start';
    const canvas = document.getElementById('pp-canvas');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    document.getElementById('pp-pop-chart').innerHTML = '';
    document.getElementById('pp-phase-chart').innerHTML = '';
    ['metric-pp-step', 'metric-pp-prey', 'metric-pp-pred', 'metric-pp-food'].forEach(id =>
      document.getElementById(id).textContent = '0');
  });
}

// ── Initialization ───────────────────────────────────────────
function init() {
  initTabs();
  initEpidemic();
  initFlocking();
  initSegregation();
  initPredPrey();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
