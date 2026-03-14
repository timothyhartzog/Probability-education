// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Smoke tests: every module loads without JS errors and renders SVG content.
 */

const MODULES = [
  { id: '1.1-sigma-algebra',         title: 'Sigma-Algebra Explorer' },
  { id: '1.2-measure-random-vars',   title: 'Measure Construction & Random Variables' },
  { id: '1.3-lebesgue-riemann',      title: 'Lebesgue vs. Riemann' },
  { id: '1.4-cantor-set',            title: 'Cantor Set' },
  { id: '2.1-convergence-modes',     title: 'Convergence Mode Comparator' },
  { id: '2.2-borel-cantelli',        title: 'Borel-Cantelli Lemmas' },
  { id: '2.3-lln-lab',               title: 'Laws of Large Numbers' },
  { id: '2.4-clt-studio',            title: 'Central Limit Theorem' },
  { id: '3.1-characteristic-functions', title: 'Characteristic Function Gallery' },
  { id: '3.2-convolution-cfs',       title: 'Convolution & CLT via CFs' },
  { id: '4.1-conditional-expectation', title: 'Conditional Expectation' },
  { id: '4.2-martingale-explorer',   title: 'Martingale Path Explorer' },
  { id: '5.1-donsker',               title: 'Random Walk to Brownian Motion' },
  { id: '5.2-brownian-properties',   title: 'Brownian Motion Properties' },
  { id: '6.1-markov-dashboard',      title: 'Markov Chain Dynamics' },
  { id: '6.2-ergodic-mixing',        title: 'Ergodic Theory & Mixing Times' },
  { id: 'mq-1-spc-control-chart',    title: 'SPC Control Chart' },
  { id: 'mq-2-funnel-plot',          title: 'Hospital Funnel Plot' },
  { id: 'mq-3-cusum-chart',          title: 'CUSUM Sequential Analysis' },
  { id: 'mq-4-pareto-chart',         title: 'Quality Pareto Analysis' },
  { id: 'mq-5-diagnostic-testing',  title: 'Diagnostic Test Probability' },
  { id: 'mq-6-meta-analysis',       title: 'Meta-Analysis & Evidence Synthesis' },
  { id: 'mq-7-clinical-statistics', title: 'Clinical Trial Statistics' },
  { id: '7.1-ito-integral',        title: 'Itô Integral & Stochastic Differentials' },
  { id: '7.2-sde-solver',          title: 'SDE Solver Studio' },
  { id: '8.1-prior-posterior',      title: 'Prior-to-Posterior Machine' },
  { id: '8.2-mcmc-explorer',       title: 'MCMC Sampling Explorer' },
  { id: '9.1-entropy-kl',          title: 'Entropy & KL Divergence' },
  { id: '9.2-mutual-information',  title: 'Mutual Information & Channel Capacity' },
  { id: 'mq-8-disease-modeling',   title: 'Infectious Disease Modeling' },
  { id: 'mq-9-vaccine-preventable', title: 'Vaccine-Preventable Disease Simulator' },
  { id: 'fm-1-stochastic-finance', title: 'Stochastic Finance Modeling' },
  { id: 'abm-1-agent-simulation', title: 'Agent-Based Modeling & Simulation' },
];

for (const mod of MODULES) {
  test.describe(`Module ${mod.id}`, () => {

    test('loads without JavaScript errors', async ({ page }) => {
      const errors = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto(`/src/modules/${mod.id}/index.html`);
      // Allow time for D3 rendering
      await page.waitForTimeout(2000);

      expect(errors).toEqual([]);
    });

    test('renders at least one SVG element', async ({ page }) => {
      await page.goto(`/src/modules/${mod.id}/index.html`);
      const svg = page.locator('svg').first();
      await expect(svg).toBeVisible({ timeout: 10_000 });
    });

    test('has a page title', async ({ page }) => {
      await page.goto(`/src/modules/${mod.id}/index.html`);
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
    });

    test('has an h1 heading', async ({ page }) => {
      await page.goto(`/src/modules/${mod.id}/index.html`);
      const h1 = page.locator('h1').first();
      await expect(h1).toBeVisible();
      const text = await h1.textContent();
      expect(text.length).toBeGreaterThan(0);
    });

    test('no broken CSS (module-page container renders)', async ({ page }) => {
      await page.goto(`/src/modules/${mod.id}/index.html`);
      const container = page.locator('.module-page');
      await expect(container).toBeVisible();
    });

  });
}
