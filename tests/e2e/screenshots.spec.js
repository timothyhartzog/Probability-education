// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Visual regression tests: capture a screenshot of each module's initial state.
 * On first run these create baseline images; subsequent runs compare against them.
 *
 * Run with: npx playwright test screenshots --update-snapshots  (to create/update baselines)
 */

const MODULES = [
  '1.1-sigma-algebra',
  '1.2-measure-random-vars',
  '1.3-lebesgue-riemann',
  '1.4-cantor-set',
  '2.1-convergence-modes',
  '2.2-borel-cantelli',
  '2.3-lln-lab',
  '2.4-clt-studio',
  '3.1-characteristic-functions',
  '3.2-convolution-cfs',
  '4.1-conditional-expectation',
  '4.2-martingale-explorer',
  '5.1-donsker',
  '5.2-brownian-properties',
  '6.1-markov-dashboard',
  '6.2-ergodic-mixing',
  'mq-1-spc-control-chart',
  'mq-2-funnel-plot',
  'mq-3-cusum-chart',
  'mq-4-pareto-chart',
  'mq-5-diagnostic-testing',
  'mq-6-meta-analysis',
  'mq-7-clinical-statistics',
  '7.1-ito-integral',
  '7.2-sde-solver',
  '8.1-prior-posterior',
  '8.2-mcmc-explorer',
  '9.1-entropy-kl',
  '9.2-mutual-information',
];

for (const mod of MODULES) {
  test(`visual snapshot: ${mod}`, async ({ page }) => {
    await page.goto(`/src/modules/${mod}/index.html`);
    // Wait for SVG rendering to stabilize
    await page.waitForSelector('svg', { timeout: 10_000 });
    await page.waitForTimeout(2000);

    // Mask any animated or random elements to reduce flakiness
    await expect(page).toHaveScreenshot(`${mod}.png`, {
      maxDiffPixelRatio: 0.05,
      animations: 'disabled',
      fullPage: true,
    });
  });
}
