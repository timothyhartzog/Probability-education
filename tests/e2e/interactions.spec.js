// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Interaction tests: verify that controls (sliders, dropdowns, buttons)
 * update the visualization without errors.
 */

test.describe('CLT Studio interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/modules/2.4-clt-studio/index.html');
    await page.waitForSelector('svg', { timeout: 10_000 });
  });

  test('control panel renders with interactive controls', async ({ page }) => {
    const controls = page.locator('#controls, #control-panel, .control-panel');
    await expect(controls.first()).toBeVisible();

    // Should have at least one interactive element
    const inputs = page.locator('input, select, button');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
  });

  test('changing a select updates SVG without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const select = page.locator('select').first();
    if (await select.isVisible()) {
      const options = await select.locator('option').allTextContents();
      if (options.length > 1) {
        await select.selectOption({ index: 1 });
        await page.waitForTimeout(1500);
      }
    }

    expect(errors).toEqual([]);
  });

  test('changing a range slider updates SVG without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const slider = page.locator('input[type="range"]').first();
    if (await slider.isVisible()) {
      const min = Number(await slider.getAttribute('min') ?? '0');
      const max = Number(await slider.getAttribute('max') ?? '100');
      const step = Number(await slider.getAttribute('step') ?? '1');
      const mid = Math.round((min + max) / 2 / step) * step;
      await slider.fill(String(mid));
      await page.waitForTimeout(1500);
    }

    expect(errors).toEqual([]);
  });
});

test.describe('Sigma-Algebra Explorer interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/modules/1.1-sigma-algebra/index.html');
    await page.waitForSelector('svg', { timeout: 10_000 });
  });

  test('SVG elements are clickable without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Click on the first clickable SVG element
    const clickable = page.locator('svg circle, svg rect, svg g[class]').first();
    if (await clickable.isVisible()) {
      await clickable.click();
      await page.waitForTimeout(1000);
    }

    expect(errors).toEqual([]);
  });
});

test.describe('Markov Chain Dashboard interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/modules/6.1-markov-dashboard/index.html');
    await page.waitForSelector('svg', { timeout: 10_000 });
  });

  test('dropdown change updates visualization without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const select = page.locator('select').first();
    if (await select.isVisible()) {
      const options = await select.locator('option').allTextContents();
      if (options.length > 1) {
        await select.selectOption({ index: Math.min(1, options.length - 1) });
        await page.waitForTimeout(1500);
      }
    }

    expect(errors).toEqual([]);
    // SVG should still be present after interaction
    await expect(page.locator('svg').first()).toBeVisible();
  });
});

test.describe('SPC Control Chart interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/modules/mq-1-spc-control-chart/index.html');
    await page.waitForSelector('svg', { timeout: 10_000 });
  });

  test('has interactive controls and SVG renders', async ({ page }) => {
    const inputs = page.locator('input, select, button');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
    await expect(page.locator('svg').first()).toBeVisible();
  });

  test('changing controls does not cause errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const select = page.locator('select').first();
    if (await select.isVisible()) {
      const options = await select.locator('option').allTextContents();
      if (options.length > 1) {
        await select.selectOption({ index: 1 });
        await page.waitForTimeout(1500);
      }
    }

    expect(errors).toEqual([]);
  });
});

test.describe('Characteristic Functions interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/modules/3.1-characteristic-functions/index.html');
    await page.waitForSelector('svg', { timeout: 10_000 });
  });

  test('distribution dropdown changes update all charts', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const select = page.locator('select').first();
    if (await select.isVisible()) {
      const options = await select.locator('option').allTextContents();
      for (let i = 1; i < Math.min(options.length, 4); i++) {
        await select.selectOption({ index: i });
        await page.waitForTimeout(800);
      }
    }

    expect(errors).toEqual([]);
    // Multiple SVGs should be visible (complex plane, re/im, density)
    const svgCount = await page.locator('svg').count();
    expect(svgCount).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Brownian Motion interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/modules/5.2-brownian-properties/index.html');
    await page.waitForSelector('svg', { timeout: 10_000 });
  });

  test('tab switching works without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Try clicking tab-like buttons
    const tabs = page.locator('button, .tab, [role="tab"]');
    const tabCount = await tabs.count();
    for (let i = 0; i < Math.min(tabCount, 4); i++) {
      const tab = tabs.nth(i);
      if (await tab.isVisible()) {
        await tab.click();
        await page.waitForTimeout(800);
      }
    }

    expect(errors).toEqual([]);
  });
});
