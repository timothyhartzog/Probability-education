/**
 * @module renderer
 * @description Canvas 2D renderer — grid, agents, trails, overlays, hit test.
 *              ZERO D3 imports. Pure Canvas 2D API.
 * @see Project Plan Sections 3.5, 10.2, 10.3
 */

import { GRID_W, GRID_H } from './engine.js';

// ── Palette ─────────────────────────────────────────────────
const PALETTE = {
  bg:         '#0f172a',
  prey:       '#3b82f6',
  preyStroke: '#1d4ed8',
  predator:   '#ef4444',
  predStroke: '#991b1b',
  grassHigh:  '#4ade80',
  grassLow:   '#166534',
  trail:      'rgba(59,130,246,0.25)',
  predTrail:  'rgba(239,68,68,0.25)',
  vision:     'rgba(250,204,21,0.08)',
  visionRing: 'rgba(250,204,21,0.2)',
  selectRing: '#f59e0b',
  dead:       '#475569',
};

export { PALETTE };

// ── Pre-built Path2D shapes ─────────────────────────────────
const PREY_RADIUS = 3.5;
const PRED_SIZE   = 5;

const PREY_SHAPE = new Path2D();
PREY_SHAPE.arc(0, 0, PREY_RADIUS, 0, Math.PI * 2);

const PRED_SHAPE = new Path2D();
PRED_SHAPE.moveTo(0, -PRED_SIZE * 1.3);
PRED_SHAPE.lineTo(PRED_SIZE * 1.1, PRED_SIZE * 0.8);
PRED_SHAPE.lineTo(-PRED_SIZE * 1.1, PRED_SIZE * 0.8);
PRED_SHAPE.closePath();

// ── Energy Color Scales ─────────────────────────────────────
function energyColor(energy, maxEnergy, type) {
  const ratio = Math.max(0, Math.min(1, energy / maxEnergy));
  if (type === 'prey') {
    const r = Math.round(30 + (59 - 30) * ratio);
    const g = Math.round(64 + (130 - 64) * ratio);
    const b = Math.round(120 + (246 - 120) * ratio);
    return `rgb(${r},${g},${b})`;
  } else {
    const r = Math.round(120 + (239 - 120) * ratio);
    const g = Math.round(30 + (68 - 30) * ratio);
    const b = Math.round(30 + (68 - 30) * ratio);
    return `rgb(${r},${g},${b})`;
  }
}

// ── Grid Renderer (ImageData technique) ─────────────────────
let grassImageData = null;

export function drawGrid(ctx, grid, canvasW, canvasH) {
  const cellW = canvasW / GRID_W;
  const cellH = canvasH / GRID_H;

  // Use ImageData for performance if cells are small
  if (cellW < 12 && cellH < 12) {
    if (!grassImageData || grassImageData.width !== canvasW || grassImageData.height !== canvasH) {
      grassImageData = ctx.createImageData(canvasW, canvasH);
    }
    const data = grassImageData.data;
    // Fill background
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 15; data[i+1] = 23; data[i+2] = 42; data[i+3] = 255;
    }
    // Draw grass
    for (let gy = 0; gy < GRID_H; gy++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        const v = grid[gy * GRID_W + gx];
        if (v < 0.05) continue;
        const r = Math.round(22 + 52 * v);
        const g = Math.round(101 + 117 * v);
        const b = Math.round(52 + 76 * v);
        const px0 = Math.floor(gx * cellW);
        const py0 = Math.floor(gy * cellH);
        const px1 = Math.floor((gx + 1) * cellW);
        const py1 = Math.floor((gy + 1) * cellH);
        for (let py = py0; py < py1; py++) {
          for (let px = px0; px < px1; px++) {
            const i = (py * canvasW + px) * 4;
            data[i] = r; data[i+1] = g; data[i+2] = b;
          }
        }
      }
    }
    ctx.putImageData(grassImageData, 0, 0);
  } else {
    // Fallback for large cells
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, canvasW, canvasH);
    for (let gy = 0; gy < GRID_H; gy++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        const v = grid[gy * GRID_W + gx];
        if (v < 0.05) continue;
        const r = Math.round(22 + 52 * v);
        const g = Math.round(101 + 117 * v);
        const b = Math.round(52 + 76 * v);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(gx * cellW, gy * cellH, cellW, cellH);
      }
    }
  }
}

// ── Trail Renderer ──────────────────────────────────────────
export function drawTrails(ctx, agents, cellW, cellH) {
  for (const agent of agents) {
    if (!agent.alive || agent.trail.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(agent.trail[0].x * cellW, agent.trail[0].y * cellH);
    for (let i = 1; i < agent.trail.length; i++) {
      ctx.lineTo(agent.trail[i].x * cellW, agent.trail[i].y * cellH);
    }
    ctx.strokeStyle = agent.type === 'prey' ? PALETTE.trail : PALETTE.predTrail;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// ── Agent Renderer ──────────────────────────────────────────
export function drawAgents(ctx, agents, maxEnergy, cellW, cellH) {
  for (const agent of agents) {
    if (!agent.alive) continue;
    ctx.save();
    ctx.translate(agent.x * cellW, agent.y * cellH);

    if (agent.type === 'predator') {
      // Rotate triangle toward movement direction
      const angle = Math.atan2(agent.vy, agent.vx) + Math.PI / 2;
      ctx.rotate(angle);
    }

    ctx.fillStyle = energyColor(agent.energy, maxEnergy, agent.type);
    ctx.strokeStyle = agent.type === 'prey' ? PALETTE.preyStroke : PALETTE.predStroke;
    ctx.lineWidth = 1;
    ctx.fill(agent.type === 'prey' ? PREY_SHAPE : PRED_SHAPE);
    ctx.stroke(agent.type === 'prey' ? PREY_SHAPE : PRED_SHAPE);

    // Action indicator dot
    if (agent.action === 'flee') {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(agent.type === 'prey' ? 5 : 0, agent.type === 'prey' ? -5 : -8, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (agent.action === 'pursue') {
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.arc(0, -8, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

// ── Overlay Renderer (vision circles, selection ring) ───────
export function drawOverlay(ctx, agents, params, selectedId, cellW, cellH) {
  for (const agent of agents) {
    if (!agent.alive) continue;
    const px = agent.x * cellW;
    const py = agent.y * cellH;
    const vr = params.visionRadius * Math.min(cellW, cellH);

    // Vision circles
    if (params.showVision) {
      ctx.beginPath();
      ctx.arc(px, py, vr, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.vision;
      ctx.fill();
      ctx.strokeStyle = PALETTE.visionRing;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Selection ring
    if (selectedId !== null && agent.id === selectedId) {
      ctx.beginPath();
      ctx.arc(px, py, 10, 0, Math.PI * 2);
      ctx.strokeStyle = PALETTE.selectRing;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

// ── Full Frame Compositor ───────────────────────────────────
export function drawFrame(ctx, state, params, uiState) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const cellW = W / GRID_W;
  const cellH = H / GRID_H;

  // 1. Grid (grass)
  drawGrid(ctx, state.grid, W, H);

  // 2. Trails
  if (params.showTrails) {
    drawTrails(ctx, state.agents, cellW, cellH);
  }

  // 3. Agents
  drawAgents(ctx, state.agents, params.maxEnergy, cellW, cellH);

  // 4. Overlays
  if (params.showVision || uiState.selectedId !== null) {
    drawOverlay(ctx, state.agents, params, uiState.selectedId, cellW, cellH);
  }
}

// ── Hit Test — canvas coords → agent ────────────────────────
export function hitTest(agents, canvasX, canvasY, canvasW, canvasH, radius) {
  const cellW = canvasW / GRID_W;
  const cellH = canvasH / GRID_H;
  const gridX = canvasX / cellW;
  const gridY = canvasY / cellH;
  const r = radius || 1.5;

  let closest = null;
  let closestDist = Infinity;

  for (const agent of agents) {
    if (!agent.alive) continue;
    const d = Math.hypot(agent.x - gridX, agent.y - gridY);
    if (d < r && d < closestDist) {
      closest = agent;
      closestDist = d;
    }
  }
  return closest;
}
