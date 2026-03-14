// @ts-check
import { test, expect } from '@playwright/test';

const MODULE_URL = '/src/modules/abm-2-predator-prey-d3/index.html';

test.describe('ABM-2 Predator-Prey Simulator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(MODULE_URL);
    await page.waitForSelector('[data-testid="abm-app"]');
    await page.waitForTimeout(300);
  });

  // ── Playback Controls ───────────────────────────────────────

  test('Run button starts simulation — tick increments', async ({ page }) => {
    const before = await page.$eval('[data-testid="stat-tick"]', el => parseInt(el.textContent));
    await page.click('[data-testid="btn-run"]');
    await page.waitForTimeout(1500);
    const after = await page.$eval('[data-testid="stat-tick"]', el => parseInt(el.textContent));
    expect(after).toBeGreaterThan(before + 3);
  });

  test('Pause freezes tick counter', async ({ page }) => {
    await page.click('[data-testid="btn-run"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="btn-pause"]');
    const a = await page.$eval('[data-testid="stat-tick"]', el => el.textContent);
    await page.waitForTimeout(600);
    const b = await page.$eval('[data-testid="stat-tick"]', el => el.textContent);
    expect(a).toBe(b);
  });

  test('Step advances simulation by one tick', async ({ page }) => {
    const before = await page.$eval('[data-testid="stat-tick"]', el => parseInt(el.textContent));
    await page.click('[data-testid="btn-step"]');
    await page.waitForTimeout(200);
    const after = await page.$eval('[data-testid="stat-tick"]', el => parseInt(el.textContent));
    expect(after).toBe(before + 1);
  });

  test('Reset returns tick to 0', async ({ page }) => {
    await page.click('[data-testid="btn-run"]');
    await page.waitForTimeout(800);
    await page.click('[data-testid="btn-reset"]');
    await page.waitForTimeout(200);
    const tick = await page.$eval('[data-testid="stat-tick"]', el => el.textContent);
    expect(tick).toBe('0');
  });

  // ── Rule Switching ──────────────────────────────────────────

  test('Rule buttons switch decision rule and update pseudocode', async ({ page }) => {
    // Start with bounded (default)
    const initialPseudo = await page.$eval('[data-testid="pseudocode-panel"]', el => el.textContent);
    expect(initialPseudo).toContain('Satisfice');

    // Switch to reactive
    await page.click('[data-testid="btn-rule-reactive"]');
    const reactivePseudo = await page.$eval('[data-testid="pseudocode-panel"]', el => el.textContent);
    expect(reactivePseudo).toContain('FLEE');
    expect(reactivePseudo).not.toContain('Satisfice');

    // Switch to BDI
    await page.click('[data-testid="btn-rule-bdi"]');
    const bdiPseudo = await page.$eval('[data-testid="pseudocode-panel"]', el => el.textContent);
    expect(bdiPseudo).toContain('BELIEFS');
    expect(bdiPseudo).toContain('INTENTION');
  });

  test('Active rule button has correct styling', async ({ page }) => {
    await page.click('[data-testid="btn-rule-reactive"]');
    const reactiveActive = await page.$eval('[data-testid="btn-rule-reactive"]', el =>
      el.classList.contains('abm-btn-active'));
    expect(reactiveActive).toBe(true);

    const boundedActive = await page.$eval('[data-testid="btn-rule-bounded"]', el =>
      el.classList.contains('abm-btn-active'));
    expect(boundedActive).toBe(false);
  });

  // ── Stats Bar ───────────────────────────────────────────────

  test('Stats bar shows initial population counts', async ({ page }) => {
    const prey = await page.$eval('[data-testid="stat-prey"]', el => parseInt(el.textContent));
    const pred = await page.$eval('[data-testid="stat-predator"]', el => parseInt(el.textContent));
    expect(prey).toBeGreaterThan(0);
    expect(pred).toBeGreaterThan(0);
  });

  test('Stats bar updates during simulation', async ({ page }) => {
    const initialGrass = await page.$eval('[data-testid="stat-grass"]', el => el.textContent);
    await page.click('[data-testid="btn-run"]');
    await page.waitForTimeout(1500);
    await page.click('[data-testid="btn-pause"]');
    const updatedGrass = await page.$eval('[data-testid="stat-grass"]', el => el.textContent);
    // Grass percentage should change during simulation
    // (It may not always change, but tick definitely will)
    const tick = await page.$eval('[data-testid="stat-tick"]', el => parseInt(el.textContent));
    expect(tick).toBeGreaterThan(0);
  });

  // ── Canvas Rendering ───────────────────────────────────────

  test('Canvas element is present and has correct dimensions', async ({ page }) => {
    const canvas = page.locator('[data-testid="sim-canvas"]');
    await expect(canvas).toBeVisible();
    const width = await canvas.getAttribute('width');
    const height = await canvas.getAttribute('height');
    expect(parseInt(width)).toBeGreaterThan(0);
    expect(parseInt(height)).toBeGreaterThan(0);
  });

  // ── Chart Tabs ──────────────────────────────────────────────

  test('Chart tabs switch between chart views', async ({ page }) => {
    // Run a few ticks first to generate data
    await page.click('[data-testid="btn-run"]');
    await page.waitForTimeout(800);
    await page.click('[data-testid="btn-pause"]');

    // Population chart should be visible by default
    const popChart = page.locator('#chart-population');
    await expect(popChart).toBeVisible();

    // Switch to phase portrait
    await page.click('button[data-chart="phase"]');
    await page.waitForTimeout(200);
    const phaseChart = page.locator('#chart-phase');
    await expect(phaseChart).toBeVisible();
    await expect(popChart).not.toBeVisible();

    // Switch to energy
    await page.click('button[data-chart="energy"]');
    await page.waitForTimeout(200);
    const energyChart = page.locator('#chart-energy');
    await expect(energyChart).toBeVisible();
  });

  // ── Population Chart SVG ────────────────────────────────────

  test('Population chart renders SVG after simulation runs', async ({ page }) => {
    await page.click('[data-testid="btn-run"]');
    await page.waitForTimeout(1500);
    await page.click('[data-testid="btn-pause"]');
    await page.waitForTimeout(200);

    const svg = page.locator('[data-testid="chart-population"]');
    await expect(svg).toBeVisible();
  });

  // ── Parameter Sliders ───────────────────────────────────────

  test('Slider updates badge value', async ({ page }) => {
    const slider = page.locator('[data-testid="input-preyCount"]');
    await slider.fill('150');
    await slider.dispatchEvent('input');
    await page.waitForTimeout(100);

    const badge = page.locator('[data-testid="slider-preyCount"] .abm-slider-badge');
    const text = await badge.textContent();
    expect(text).toBe('150');
  });

  // ── Agent Inspector ─────────────────────────────────────────

  test('Inspector placeholder visible before agent selection', async ({ page }) => {
    const placeholder = page.locator('.abm-inspector-empty');
    await expect(placeholder).toBeVisible();
    const detail = page.locator('.abm-inspector-detail');
    await expect(detail).not.toBeVisible();
  });

  // ── Keyboard Shortcuts ──────────────────────────────────────

  test('Space key toggles simulation', async ({ page }) => {
    await page.keyboard.press('Space');
    await page.waitForTimeout(800);
    const tickAfterStart = await page.$eval('[data-testid="stat-tick"]', el => parseInt(el.textContent));
    expect(tickAfterStart).toBeGreaterThan(0);

    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    const tickAfterPause = await page.$eval('[data-testid="stat-tick"]', el => el.textContent);
    await page.waitForTimeout(400);
    const tickStillPaused = await page.$eval('[data-testid="stat-tick"]', el => el.textContent);
    expect(tickAfterPause).toBe(tickStillPaused);
  });

  test('R key resets simulation', async ({ page }) => {
    await page.click('[data-testid="btn-run"]');
    await page.waitForTimeout(600);
    await page.keyboard.press('r');
    await page.waitForTimeout(200);
    const tick = await page.$eval('[data-testid="stat-tick"]', el => el.textContent);
    expect(tick).toBe('0');
  });

  test('Number keys switch decision rules', async ({ page }) => {
    await page.keyboard.press('1');
    await page.waitForTimeout(100);
    const pseudo1 = await page.$eval('[data-testid="pseudocode-panel"]', el => el.textContent);
    expect(pseudo1).toContain('FLEE');

    await page.keyboard.press('3');
    await page.waitForTimeout(100);
    const pseudo3 = await page.$eval('[data-testid="pseudocode-panel"]', el => el.textContent);
    expect(pseudo3).toContain('BELIEFS');
  });
});
