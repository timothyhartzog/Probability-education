/**
 * @module charts
 * @description D3 SVG charts — Population, Phase Portrait, Energy Histogram, Action Donut.
 *              D3 SVG only — ZERO Canvas API.
 * @d3api d3-selection, d3-scale, d3-axis, d3-shape, d3-array, d3-transition
 * @see Project Plan Sections 6.2, 7.4
 */

import * as d3 from 'd3';
import { PALETTE } from './renderer.js';

// ════════════════════════════════════════════════════════════════
//  SHARED CHART UTILITIES
// ════════════════════════════════════════════════════════════════

function clearContainer(el) { el.innerHTML = ''; }

const CHART_COLORS = {
  prey:     '#3b82f6',
  predator: '#ef4444',
  preyFill: 'rgba(59,130,246,0.12)',
  predFill: 'rgba(239,68,68,0.12)',
  grass:    '#4ade80',
  grassFill:'rgba(74,222,128,0.10)',
  phase:    '#7c3aed',
  axis:     '#64748b',
  grid:     '#334155',
  muted:    '#94a3b8',
};

// ════════════════════════════════════════════════════════════════
//  POPULATION CHART — dual line + area
// ════════════════════════════════════════════════════════════════

export function drawPopulationChart(container, history, isRunning) {
  clearContainer(container);
  if (!history || history.length < 2) return;

  const width = container.clientWidth || 580;
  const height = 200;
  const m = { top: 16, right: 85, bottom: 30, left: 42 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;

  const svg = d3.select(container).append('svg')
    .attr('data-testid', 'chart-population')
    .attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  // Scales
  const x = d3.scaleLinear()
    .domain([history[0].tick, history[history.length - 1].tick])
    .range([0, w]);
  const yMax = d3.max(history, d => Math.max(d.prey, d.predator)) * 1.15 || 10;
  const y = d3.scaleLinear().domain([0, yMax]).range([h, 0]).nice();

  // Grid lines
  g.append('g').attr('class', 'grid')
    .call(d3.axisLeft(y).ticks(4).tickSize(-w).tickFormat(''))
    .selectAll('line').attr('stroke', CHART_COLORS.grid).attr('stroke-dasharray', '2,3');
  g.selectAll('.grid .domain').remove();

  // Axes
  g.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')))
    .selectAll('text').attr('fill', CHART_COLORS.axis);
  g.append('g')
    .call(d3.axisLeft(y).ticks(4))
    .selectAll('text').attr('fill', CHART_COLORS.axis);

  // Area fills
  const preyArea = d3.area()
    .x(d => x(d.tick)).y0(h).y1(d => y(d.prey))
    .curve(d3.curveCatmullRom.alpha(0.5));
  const predArea = d3.area()
    .x(d => x(d.tick)).y0(h).y1(d => y(d.predator))
    .curve(d3.curveCatmullRom.alpha(0.5));

  g.append('path').datum(history)
    .attr('fill', CHART_COLORS.preyFill).attr('d', preyArea);
  g.append('path').datum(history)
    .attr('fill', CHART_COLORS.predFill).attr('d', predArea);

  // Lines
  const preyLine = d3.line()
    .x(d => x(d.tick)).y(d => y(d.prey))
    .curve(d3.curveCatmullRom.alpha(0.5));
  const predLine = d3.line()
    .x(d => x(d.tick)).y(d => y(d.predator))
    .curve(d3.curveCatmullRom.alpha(0.5));

  g.append('path').datum(history)
    .attr('fill', 'none').attr('stroke', CHART_COLORS.prey)
    .attr('stroke-width', 2).attr('d', preyLine);
  g.append('path').datum(history)
    .attr('fill', 'none').attr('stroke', CHART_COLORS.predator)
    .attr('stroke-width', 2).attr('d', predLine);

  // Labels
  const last = history[history.length - 1];
  g.append('text').attr('x', w + 6).attr('y', y(last.prey)).attr('dy', '0.35em')
    .attr('fill', CHART_COLORS.prey).attr('font-size', 11).text(`Prey ${last.prey}`);
  g.append('text').attr('x', w + 6).attr('y', y(last.predator)).attr('dy', '0.35em')
    .attr('fill', CHART_COLORS.predator).attr('font-size', 11).text(`Pred ${last.predator}`);

  // Axis labels
  svg.append('text').attr('x', width / 2).attr('y', height - 2)
    .attr('text-anchor', 'middle').attr('fill', CHART_COLORS.muted).attr('font-size', 10)
    .text('Tick');
}

// ════════════════════════════════════════════════════════════════
//  PHASE PORTRAIT — prey vs predator scatter trail
// ════════════════════════════════════════════════════════════════

export function drawPhasePortrait(container, history) {
  clearContainer(container);
  if (!history || history.length < 3) return;

  const width = container.clientWidth || 580;
  const height = 240;
  const m = { top: 16, right: 20, bottom: 36, left: 48 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;

  const svg = d3.select(container).append('svg')
    .attr('data-testid', 'chart-phase')
    .attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const xMax = d3.max(history, d => d.prey) * 1.1 || 10;
  const yMax = d3.max(history, d => d.predator) * 1.1 || 10;
  const x = d3.scaleLinear().domain([0, xMax]).range([0, w]).nice();
  const y = d3.scaleLinear().domain([0, yMax]).range([h, 0]).nice();

  // Grid
  g.append('g').attr('class', 'grid')
    .call(d3.axisLeft(y).ticks(4).tickSize(-w).tickFormat(''))
    .selectAll('line').attr('stroke', CHART_COLORS.grid).attr('stroke-dasharray', '2,3');
  g.selectAll('.grid .domain').remove();

  // Axes
  g.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(5))
    .selectAll('text').attr('fill', CHART_COLORS.axis);
  g.append('g')
    .call(d3.axisLeft(y).ticks(4))
    .selectAll('text').attr('fill', CHART_COLORS.axis);

  // Trail line with color gradient (old = faded, new = bright)
  const trail = d3.line()
    .x(d => x(d.prey)).y(d => y(d.predator))
    .curve(d3.curveCatmullRom.alpha(0.5));

  // Split into segments for color fading
  const segLen = Math.max(1, Math.floor(history.length / 8));
  for (let i = 0; i < history.length - 1; i += segLen) {
    const segment = history.slice(i, Math.min(i + segLen + 1, history.length));
    const opacity = 0.15 + 0.85 * (i / history.length);
    g.append('path').datum(segment)
      .attr('fill', 'none').attr('stroke', CHART_COLORS.phase)
      .attr('stroke-width', 1.5).attr('opacity', opacity)
      .attr('d', trail);
  }

  // Current position dot
  const last = history[history.length - 1];
  g.append('circle').attr('cx', x(last.prey)).attr('cy', y(last.predator))
    .attr('r', 5).attr('fill', CHART_COLORS.phase).attr('stroke', '#fff').attr('stroke-width', 1.5);

  // Start position
  const first = history[0];
  g.append('circle').attr('cx', x(first.prey)).attr('cy', y(first.predator))
    .attr('r', 3).attr('fill', 'none').attr('stroke', CHART_COLORS.muted).attr('stroke-width', 1);

  // Axis labels
  svg.append('text').attr('x', width / 2).attr('y', height - 2)
    .attr('text-anchor', 'middle').attr('fill', CHART_COLORS.muted).attr('font-size', 10)
    .text('Prey Population');
  svg.append('text')
    .attr('transform', `translate(12,${height / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle').attr('fill', CHART_COLORS.muted).attr('font-size', 10)
    .text('Predator Population');
}

// ════════════════════════════════════════════════════════════════
//  ENERGY HISTOGRAM — prey vs predator energy distribution
// ════════════════════════════════════════════════════════════════

export function drawEnergyHistogram(container, preyEnergies, predEnergies, maxEnergy) {
  clearContainer(container);
  if (preyEnergies.length === 0 && predEnergies.length === 0) return;

  const width = container.clientWidth || 580;
  const height = 180;
  const m = { top: 16, right: 20, bottom: 30, left: 42 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;

  const svg = d3.select(container).append('svg')
    .attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const x = d3.scaleLinear().domain([0, maxEnergy]).range([0, w]);
  const binGen = d3.bin().domain(x.domain()).thresholds(20);

  const preyBins = binGen(preyEnergies);
  const predBins = binGen(predEnergies);
  const yMax = d3.max([...preyBins, ...predBins], b => b.length) || 1;
  const y = d3.scaleLinear().domain([0, yMax]).range([h, 0]).nice();

  // Axes
  g.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(6))
    .selectAll('text').attr('fill', CHART_COLORS.axis);
  g.append('g')
    .call(d3.axisLeft(y).ticks(4))
    .selectAll('text').attr('fill', CHART_COLORS.axis);

  const barW = w / preyBins.length * 0.4;

  // Prey bars
  g.selectAll('.prey-bar').data(preyBins).join('rect')
    .attr('class', 'prey-bar')
    .attr('x', d => x(d.x0) + 1)
    .attr('y', d => y(d.length))
    .attr('width', barW)
    .attr('height', d => h - y(d.length))
    .attr('fill', CHART_COLORS.prey).attr('opacity', 0.7);

  // Predator bars
  g.selectAll('.pred-bar').data(predBins).join('rect')
    .attr('class', 'pred-bar')
    .attr('x', d => x(d.x0) + barW + 2)
    .attr('y', d => y(d.length))
    .attr('width', barW)
    .attr('height', d => h - y(d.length))
    .attr('fill', CHART_COLORS.predator).attr('opacity', 0.7);

  // Legend
  const legend = g.append('g').attr('transform', `translate(${w - 120}, 0)`);
  legend.append('rect').attr('x', 0).attr('y', 0).attr('width', 10).attr('height', 10)
    .attr('fill', CHART_COLORS.prey).attr('opacity', 0.7);
  legend.append('text').attr('x', 14).attr('y', 9).attr('fill', CHART_COLORS.muted)
    .attr('font-size', 10).text('Prey');
  legend.append('rect').attr('x', 55).attr('y', 0).attr('width', 10).attr('height', 10)
    .attr('fill', CHART_COLORS.predator).attr('opacity', 0.7);
  legend.append('text').attr('x', 69).attr('y', 9).attr('fill', CHART_COLORS.muted)
    .attr('font-size', 10).text('Predator');

  // Axis label
  svg.append('text').attr('x', width / 2).attr('y', height - 2)
    .attr('text-anchor', 'middle').attr('fill', CHART_COLORS.muted).attr('font-size', 10)
    .text('Energy');
}

// ════════════════════════════════════════════════════════════════
//  ACTION DONUT — distribution of current actions
// ════════════════════════════════════════════════════════════════

const ACTION_COLORS = {
  flee:    '#fbbf24',
  eat:     '#4ade80',
  forage:  '#22d3ee',
  pursue:  '#f87171',
  wander:  '#94a3b8',
  idle:    '#475569',
};

export function drawActionDonut(container, actionDist) {
  clearContainer(container);
  const entries = Object.entries(actionDist).filter(([, v]) => v > 0);
  if (entries.length === 0) return;

  const width = container.clientWidth || 260;
  const height = 180;
  const radius = Math.min(width, height) / 2 - 20;

  const svg = d3.select(container).append('svg')
    .attr('width', width).attr('height', height);
  const g = svg.append('g')
    .attr('transform', `translate(${width / 2},${height / 2})`);

  const pie = d3.pie().value(d => d[1]).sort(null);
  const arc = d3.arc().innerRadius(radius * 0.55).outerRadius(radius);
  const labelArc = d3.arc().innerRadius(radius * 0.78).outerRadius(radius * 0.78);

  const arcs = g.selectAll('.arc').data(pie(entries)).join('g').attr('class', 'arc');

  arcs.append('path')
    .attr('d', arc)
    .attr('fill', d => ACTION_COLORS[d.data[0]] || '#64748b')
    .attr('stroke', '#0f172a').attr('stroke-width', 1.5);

  // Labels (only if segment is large enough)
  arcs.filter(d => d.endAngle - d.startAngle > 0.35)
    .append('text')
    .attr('transform', d => `translate(${labelArc.centroid(d)})`)
    .attr('text-anchor', 'middle').attr('fill', '#e2e8f0')
    .attr('font-size', 10).attr('font-weight', 600)
    .text(d => d.data[0]);

  // Center total
  const total = entries.reduce((s, [, v]) => s + v, 0);
  g.append('text').attr('text-anchor', 'middle').attr('dy', '-0.2em')
    .attr('fill', '#e2e8f0').attr('font-size', 18).attr('font-weight', 700)
    .text(total);
  g.append('text').attr('text-anchor', 'middle').attr('dy', '1.2em')
    .attr('fill', CHART_COLORS.muted).attr('font-size', 10)
    .text('agents');
}

// ════════════════════════════════════════════════════════════════
//  GRASS HEATMAP
// ════════════════════════════════════════════════════════════════

export function drawGrassHeatmap(container, grid, gridW, gridH) {
  clearContainer(container);

  const width = container.clientWidth || 580;
  const cellSize = Math.min(Math.floor(width / gridW), 8);
  const height = cellSize * gridH;

  const svg = d3.select(container).append('svg')
    .attr('width', cellSize * gridW).attr('height', height);

  const colorScale = d3.scaleSequential(d3.interpolateGreens).domain([0, 1]);

  // Build flat data
  const cells = [];
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      cells.push({ gx, gy, val: grid[gy * gridW + gx] });
    }
  }

  svg.selectAll('.hcell').data(cells).join('rect')
    .attr('class', 'hcell')
    .attr('x', d => d.gx * cellSize)
    .attr('y', d => d.gy * cellSize)
    .attr('width', cellSize).attr('height', cellSize)
    .attr('fill', d => colorScale(d.val));
}
