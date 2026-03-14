# Probability Education Platform — Reconstruction Specification

**Version**: 1.0.0
**Generated**: 2026-03-14
**Purpose**: Enable complete reconstruction of this project in any language, framework, or OS environment by an AI coding assistant (Claude Code or equivalent).

---

## 1. PROJECT IDENTITY

| Field | Value |
|-------|-------|
| **Name** | Probability Education Platform |
| **Type** | Static web application — interactive educational modules |
| **Domain** | Advanced probability theory, statistics, simulation |
| **Audience** | University students and educators (graduate-level probability) |
| **Module Count** | 35 interactive visualization modules |
| **Source Lines** | ~35,000 (JS + CSS + HTML) |
| **License** | Private repository |

---

## 2. ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────┐
│                    Landing Page (index.html)                     │
│          Grid of module cards organized by section               │
└────────────┬───────────────────────────────────────┬────────────┘
             │                                       │
    ┌────────▼────────┐                    ┌─────────▼────────┐
    │  Design System   │                    │  Shared Library   │
    │  (CSS Tokens)    │                    │  (JS Components)  │
    └────────┬────────┘                    └─────────┬────────┘
             │              ┌────────┐               │
             └──────────────▶ Module  ◀──────────────┘
                            │ (×35)  │
                            └────────┘
```

### 2.1 Core Principles
- **Zero server-side logic** — 100% client-side, deployable as static files
- **Module independence** — each module is a self-contained unit; no cross-module runtime dependencies
- **D3 owns the DOM** — no React/Vue/Angular; D3 v7 selections build all interactive elements
- **KaTeX for math** — LaTeX rendering in-browser, no MathJax
- **Seeded PRNG** — all randomness is reproducible with deterministic seeds
- **Colorblind-safe palette** — 8-color visualization scheme safe for deuteranopia/protanopia

### 2.2 Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Build | Vite | ^7.3.x | Dev server, HMR, production bundling |
| Visualization | D3.js | ^7.9.x | DOM manipulation, scales, axes, shapes, transitions, zoom |
| Math Rendering | KaTeX | ^0.16.x | LaTeX → HTML formula rendering |
| Statistics | jStat | ^1.9.x | Gamma, beta, erf special functions |
| Unit Tests | Vitest | ^4.1.x | Fast Node.js unit testing |
| E2E Tests | Playwright | ^1.56.x | Browser automation, smoke tests, visual regression |
| Deployment | GitHub Pages | — | Static file hosting via GitHub Actions |

---

## 3. DIRECTORY STRUCTURE

```
Probability-education/
├── index.html                          # Landing page with module card grid
├── package.json                        # Dependencies and npm scripts
├── vite.config.js                      # Multi-entry build config
├── vitest.config.js                    # Unit test config
├── playwright.config.js                # E2E test config
├── .github/workflows/
│   ├── test.yml                        # CI: unit + build + E2E tests
│   └── deploy.yml                      # CD: build + deploy to GitHub Pages
├── css/                                # Root-level legacy styles (if any)
├── js/                                 # Root-level legacy scripts (if any)
├── src/
│   ├── assets/
│   │   ├── design-system.css           # CSS custom properties, base reset, component styles
│   │   └── module-template.css         # Module page shell layout
│   ├── lib/
│   │   ├── math-utils.js              # Lanczos gamma, characteristic functions, normalPdf, mulberry32
│   │   └── copy-code.js               # "Copy Code" button auto-initializer
│   ├── shared/
│   │   ├── components/
│   │   │   ├── index.js               # Re-exports all components
│   │   │   ├── ResponsiveHistogram.js # D3 histogram with KDE overlay
│   │   │   ├── MultiPathChart.js      # Multi-trajectory line chart
│   │   │   ├── ParameterPanel.js      # Slider/dropdown/toggle factory
│   │   │   └── MathAnnotation.js      # KaTeX-in-SVG via foreignObject
│   │   └── stats/
│   │       ├── index.js               # Re-exports PRNG + distributions
│   │       ├── prng.js                # SeedablePRNG (xoshiro128**)
│   │       └── distributions.js       # 11 distribution classes
│   └── modules/
│       ├── 1.1-sigma-algebra/         # Each module: index.html + module.js + style.css
│       ├── 1.2-measure-random-vars/
│       ├── 1.3-lebesgue-riemann/
│       ├── 1.4-cantor-set/
│       ├── 2.1-convergence-modes/
│       ├── 2.2-borel-cantelli/
│       ├── 2.3-lln-lab/
│       ├── 2.4-clt-studio/
│       ├── 3.1-characteristic-functions/
│       ├── 3.2-convolution-cfs/
│       ├── 4.1-conditional-expectation/
│       ├── 4.2-martingale-explorer/
│       ├── 5.1-donsker/
│       ├── 5.2-brownian-properties/
│       ├── 6.1-markov-dashboard/
│       ├── 6.2-ergodic-mixing/
│       ├── 7.1-ito-integral/
│       ├── 7.2-sde-solver/
│       ├── 8.1-prior-posterior/
│       ├── 8.2-mcmc-explorer/
│       ├── 9.1-entropy-kl/
│       ├── 9.2-mutual-information/
│       ├── abm-1-agent-simulation/
│       ├── abm-2-predator-prey-d3/    # Multi-file: + engine.js, charts.js, renderer.js
│       ├── fm-1-stochastic-finance/
│       ├── mq-1-spc-control-chart/
│       ├── mq-2-funnel-plot/
│       ├── mq-3-cusum-chart/
│       ├── mq-4-pareto-chart/
│       ├── mq-5-diagnostic-testing/
│       ├── mq-6-meta-analysis/
│       ├── mq-7-clinical-statistics/
│       ├── mq-8-disease-modeling/
│       ├── mq-8-ebm-integration/
│       └── mq-9-vaccine-preventable/
└── tests/
    ├── unit/
    │   ├── math-utils.test.js         # ~25 tests: gamma, CFs, PRNG
    │   └── abm-engine.test.js         # ~50 tests: RNG, grid, agents, rules, sim
    └── e2e/
        ├── smoke.spec.js              # 35×5 = 175 tests: all modules load
        ├── interactions.spec.js       # ~15 tests: control interactivity
        ├── screenshots.spec.js        # Visual regression for 18 modules
        └── abm-predator-prey.spec.js  # ~16 tests: ABM-2 specific
```

---

## 4. DESIGN SYSTEM SPECIFICATION

### 4.1 Color Tokens (CSS Custom Properties)

```css
:root {
  /* Core palette */
  --color-bg:              #fafafa;
  --color-surface:         #ffffff;
  --color-text:            #1a1a2e;
  --color-text-secondary:  #555;
  --color-primary:         #2563eb;   /* Blue */
  --color-primary-light:   #93c5fd;
  --color-secondary:       #e97319;   /* Orange */
  --color-accent:          #059669;   /* Green */
  --color-error:           #dc2626;   /* Red */

  /* Visualization palette — 8 colors, colorblind-safe */
  --viz-1: #2563eb;  /* Blue */
  --viz-2: #e97319;  /* Orange */
  --viz-3: #059669;  /* Green */
  --viz-4: #7c3aed;  /* Purple */
  --viz-5: #db2777;  /* Magenta */
  --viz-6: #0891b2;  /* Cyan */
  --viz-7: #ca8a04;  /* Yellow */
  --viz-8: #64748b;  /* Slate */

  /* Spacing: 4 / 8 / 16 / 24 / 32 / 48 px */
  /* Typography: STIX Two Text (body) / Inter (heading) / JetBrains Mono (code) */
  /* Borders: 4 / 8 / 12 px radius */
  /* Shadows: sm / md / lg */
  /* Transitions: 150 / 300 / 500 ms ease */
}
```

### 4.2 ABM-2 Dark Theme Tokens

```css
.abm-app {
  --abm-bg:          #0f172a;
  --abm-surface:     #1e293b;
  --abm-surface-2:   #0f172a;
  --abm-border:      #334155;
  --abm-text:        #e2e8f0;
  --abm-muted:       #64748b;
  --abm-accent:      #f59e0b;
  --abm-prey:        #3b82f6;
  --abm-predator:    #ef4444;
  --abm-grass:       #4ade80;
}
```

### 4.3 Typography

| Role | Font Stack | Usage |
|------|-----------|-------|
| Body | `STIX Two Text, Georgia, serif` | Mathematical text, descriptions |
| Heading | `Inter, Helvetica Neue, sans-serif` | Titles, labels, UI elements |
| Code | `JetBrains Mono, Fira Code, monospace` | Pseudocode, values, badges |

### 4.4 Responsive Breakpoints

| Breakpoint | Behavior |
|-----------|----------|
| ≤768px | Module layout stacks vertically; control panel goes full-width |
| ≤480px | Reduced padding and font sizes |
| ≤1100px | ABM inspector panel hidden |
| ≤900px | ABM sidebar stacks above canvas |

---

## 5. MODULE CATALOG

### 5.1 Module Template Pattern

Every standard module consists of exactly 3 files:

**`index.html`** — Entry point shell:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{Module Title} | Probability Education</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <link rel="stylesheet" href="../../assets/design-system.css">
  <link rel="stylesheet" href="../../assets/module-template.css">
  <link rel="stylesheet" href="./style.css">
</head>
<body>
  <div class="module-page">
    <header class="module-header">
      <nav class="breadcrumb">
        <a href="../../../index.html">Home</a> /
        <a href="../../../index.html#{section}">{Section}</a> /
        {Module Title}
      </nav>
      <h1>{Module Title}</h1>
      <p class="module-subtitle">{One-line description}</p>
    </header>
    <div class="module-layout">
      <div class="viz-area">
        <!-- Visualization containers with <div class="chart-area"> -->
      </div>
      <aside class="control-panel" id="controls"></aside>
    </div>
    <div class="info-panel" id="info"></div>
  </div>
  <script type="module" src="./module.js"></script>
</body>
</html>
```

**`module.js`** — All logic (7–50 KB):
```javascript
// Pattern:
import * as d3 from 'd3';
import katex from 'katex';
import { SeedablePRNG } from '@shared/stats';
import { ParameterPanel } from '@shared/components';

// 1. State object with defaults
const state = { param1: defaultVal, param2: defaultVal, ... };

// 2. Data generation functions
function generateData(params, rng) { ... }

// 3. D3 visualization creation and update
function createViz(container) { ... }
function updateViz(data) { ... }

// 4. Controls initialization
function initControls() {
  ParameterPanel.createSlider(container, {
    label, min, max, step, value, onChange: (v) => { state.param = v; update(); }
  });
}

// 5. Info panel with KaTeX math
function populateInfo() {
  katex.render('\\LaTeX formula', element, { displayMode: true });
}

// 6. Init on DOMContentLoaded
document.addEventListener('DOMContentLoaded', init);
```

**`style.css`** — Module-specific overrides (~100–300 lines)

### 5.2 Complete Module List

#### Section 1: Measure Theory & Foundations
| ID | Title | Mathematical Content |
|----|-------|---------------------|
| 1.1 | Sigma-Algebra Explorer | Power set visualization; bitmask-based set encoding; measurability checks |
| 1.2 | Measure Construction & Random Variables | Lebesgue measure on [0,1]; pushforward measures; measurable functions |
| 1.3 | Lebesgue vs. Riemann Integration | Side-by-side comparison; Dirichlet function; partition refinement |
| 1.4 | Cantor Set | Fractal construction; measure zero; uncountable but negligible |

#### Section 2: Limit Theorems
| ID | Title | Mathematical Content |
|----|-------|---------------------|
| 2.1 | Convergence Mode Comparator | Almost sure, L^p, in-probability, distributional convergence; typewriter sequence |
| 2.2 | Borel-Cantelli Lemmas | limsup events; first/second lemma visualization; independence requirement |
| 2.3 | Laws of Large Numbers | WLLN/SLLN; law of iterated logarithm; convergence rate |
| 2.4 | Central Limit Theorem Studio | Standardized sums; Q-Q plots; moment convergence; Berry-Esseen bound |

#### Section 3: Characteristic Functions
| ID | Title | Mathematical Content |
|----|-------|---------------------|
| 3.1 | Characteristic Function Gallery | E[e^{itX}] for 6+ distributions; real/imaginary parts; phase plots |
| 3.2 | Convolution & CLT via CFs | Product rule; CLT proof via CF convergence; inversion theorem |

#### Section 4: Conditional Expectation & Martingales
| ID | Title | Mathematical Content |
|----|-------|---------------------|
| 4.1 | Conditional Expectation | Tower property; sigma-algebra projection; L^2 projection interpretation |
| 4.2 | Martingale Path Explorer | Optional stopping theorem; Doob's decomposition; crossing inequalities |

#### Section 5: Brownian Motion
| ID | Title | Mathematical Content |
|----|-------|---------------------|
| 5.1 | Random Walk → Brownian Motion | Donsker invariance principle; scaled walks; functional CLT |
| 5.2 | Brownian Motion Properties | Quadratic variation; nowhere differentiability; reflection principle |

#### Section 6: Markov Chains & Ergodic Theory
| ID | Title | Mathematical Content |
|----|-------|---------------------|
| 6.1 | Markov Chain Dynamics | Transition matrices; preset chains; transient/recurrent classification; D3 graph |
| 6.2 | Ergodic Theory & Mixing Times | Spectral gap; total variation distance; cutoff phenomenon |

#### Section 7: Stochastic Calculus
| ID | Title | Mathematical Content |
|----|-------|---------------------|
| 7.1 | Ito Integral | Ito isometry; quadratic variation; stochastic differential |
| 7.2 | SDE Solver Studio | Euler-Maruyama; geometric Brownian motion; Ornstein-Uhlenbeck |

#### Section 8: Bayesian Inference
| ID | Title | Mathematical Content |
|----|-------|---------------------|
| 8.1 | Prior-to-Posterior Machine | Conjugate families; Beta-Binomial, Normal-Normal; sequential updates |
| 8.2 | MCMC Sampling Explorer | Metropolis-Hastings; acceptance rates; burn-in; trace plots |

#### Section 9: Information Theory
| ID | Title | Mathematical Content |
|----|-------|---------------------|
| 9.1 | Entropy & KL Divergence | H(X); D_KL(P||Q); cross-entropy; Gibbs inequality |
| 9.2 | Mutual Information | I(X;Y); channel capacity; entropy Venn diagrams |

#### Agent-Based Modeling
| ID | Title | Mathematical Content |
|----|-------|---------------------|
| abm-1 | Agent-Based Modeling | 4-tab sim: Epidemic (SIR), Flocking (Boids), Segregation (Schelling), Predator-Prey |
| abm-2 | D3 Predator-Prey Simulator | Multi-file; 3 decision rules; Lotka-Volterra; spatial grid; Gini coefficient |

#### Financial Mathematics
| ID | Title | Mathematical Content |
|----|-------|---------------------|
| fm-1 | Stochastic Finance | Black-Scholes; GBM option pricing; portfolio optimization |

#### Medical/Quality Applications
| ID | Title | Mathematical Content |
|----|-------|---------------------|
| mq-1 | SPC Control Chart | X-bar, R charts; Shewhart rules; OOC detection |
| mq-2 | Hospital Funnel Plot | Binomial/Poisson funnels; overdispersion; winsorization |
| mq-3 | CUSUM Chart | Sequential analysis; ARL; change point detection |
| mq-4 | Pareto Chart | Vital few / trivial many; 80/20; cumulative percentage |
| mq-5 | Diagnostic Testing | Sensitivity/specificity; PPV/NPV; Bayes' theorem; prevalence effects |
| mq-6 | Meta-Analysis | Forest plots; I^2 heterogeneity; random effects; funnel plots for bias |
| mq-7 | Clinical Trial Statistics | Sample size; power; risk difference; NNT; odds ratio |
| mq-8a | Disease Modeling | SIR/SEIR/SEIRS compartmental models; R0; herd immunity |
| mq-8b | EBM Integration | Likelihood ratios; Fagan nomogram; evidence grading |
| mq-9 | Vaccine-Preventable Diseases | Vaccination schedules; disease incidence; herd immunity dynamics |

---

## 6. SHARED LIBRARY SPECIFICATIONS

### 6.1 Seeded PRNG (`src/shared/stats/prng.js`)

**Algorithm**: xoshiro128** with splitmix32 seeding

```
Interface: SeedablePRNG
  constructor(seed?: number)
  .seed(s: number): void
  .random(): number              // Uniform [0, 1)
  .randomNormal(mu, sigma): number  // Box-Muller transform
  .randomExponential(lambda): number
  .sample(distribution): number  // Draw from distribution object
```

### 6.2 Distributions (`src/shared/stats/distributions.js`)

11 distribution classes, each implementing:

```
Interface: Distribution
  constructor(params...)
  .sample(rng: SeedablePRNG): number
  .pdf(x: number): number    // or .pmf() for discrete
  .cdf(x: number): number
  .mean(): number
  .variance(): number
  .cf(t: number): {re, im}   // Characteristic function
```

**Implementations**: Normal, Uniform, Exponential, Poisson, Binomial, Beta, Gamma, Cauchy, Pareto, StudentT, ChiSquared

### 6.3 Shared Components

| Component | Interface | D3 Pattern |
|-----------|----------|------------|
| `ResponsiveHistogram` | `new ResponsiveHistogram(container, config)` with `.update(data)` | viewBox SVG; bins + KDE overlay; reference curve |
| `MultiPathChart` | `new MultiPathChart(container, config)` with `.update(paths)` | Multi-line SVG chart; legend; hover |
| `ParameterPanel` | Static: `.createSlider()`, `.createDropdown()`, `.createToggle()` | Returns `{getValue(), setValue(), element}` |
| `MathAnnotation` | Static: `.renderMath(container, latex, x, y, options)` | KaTeX in SVG foreignObject |

### 6.4 Math Utilities (`src/lib/math-utils.js`)

```
lnGamma(z)                    // Lanczos approximation, 7-term
lnFactorial(n)                // via lnGamma(n+1)
characteristicFunctions        // Object: {normal, uniform, exponential, poisson, cauchy, bernoulli}
normalPdf(x, mu, sigma)       // Standard Gaussian PDF
mulberry32(seed)               // Returns () => number in [0,1)
```

---

## 7. ABM-2 PREDATOR-PREY — DETAILED SPECIFICATION

This is the most architecturally complex module and warrants detailed specification.

### 7.1 File Architecture

```
abm-2-predator-prey-d3/
├── index.html      # Minimal shell: <div id="abm-root">
├── module.js       # Main entry: D3 layout, event dispatch, state management, keyboard
├── engine.js       # Pure simulation: ZERO DOM imports
├── renderer.js     # Canvas 2D rendering: ZERO D3 imports
├── charts.js       # D3 SVG charts: ZERO Canvas API
└── style.css       # Dark theme, CSS custom properties
```

### 7.2 Engine (`engine.js`)

**Constants**:
- `GRID_W = 80`, `GRID_H = 60`
- `DEFAULT_PARAMS`: 15 numeric parameters + 2 boolean toggles + 1 string (decisionRule)
- `PARAM_LIMITS`: min/max/step for each slider parameter
- `PRESETS`: 4 preset configurations (balanced, predatorBoom, preyDominant, scarceResources)

**Core Functions**:
```
createRNG(seed) → { next(), range(lo, hi), int(lo, hi) }    // Mulberry32
SpatialGrid.build(agents) → grid                             // O(1) neighbor queries
SpatialGrid.queryRadius(x, y, r) → agents[]                  // Toroidal wrapping
makeAgent(type, x, y, energy, rng) → Agent                   // Factory with auto-increment ID
reactiveDecision(agent, neighbors, grid, params, rng) → action
boundedDecision(agent, neighbors, grid, params, rng) → action
bdiDecision(agent, neighbors, grid, params, rng) → action
initSim(params, seed) → SimState                              // Immutable initial state
stepSim(state, params) → SimState                             // Pure: input not mutated
computeStats(agents) → { prey, predator, meanPrey/PredEnergy, actionDist }
giniCoefficient(values) → number                              // 0 = equal, 1 = max inequality
```

**Agent Structure**:
```javascript
{
  id: number,
  type: 'prey' | 'predator',
  x: number, y: number,         // Grid coordinates (float)
  vx: number, vy: number,       // Velocity components
  energy: number,
  alive: boolean,
  action: string,                // Current: 'eat' | 'flee' | 'forage' | 'pursue' | 'wander'
  trail: [{x, y}],              // Recent positions (max 12)
  bdi: { beliefs: {}, desires: [], intention: null }  // BDI architecture state
}
```

**SimState Structure**:
```javascript
{
  agents: Agent[],
  grid: Float32Array,            // Grass levels, GRID_W × GRID_H
  tick: number,
  history: [{ tick, prey, predator, meanPreyEnergy, meanPredEnergy }],
  seed: number,
  rng: RNG
}
```

**Decision Rules**:

1. **Reactive** (stimulus-response):
   - Prey: if predator_nearby → FLEE; elif grass_here > 0.1 → EAT; elif grass_nearby → FORAGE; else WANDER
   - Predator: if prey_nearby → PURSUE; else WANDER

2. **Bounded Rationality** (satisficing, Herbert Simon):
   - Maintains aspiration level (energy threshold)
   - Satisfices: picks first "good enough" option rather than optimizing
   - Adjusts aspiration based on success/failure

3. **BDI** (Beliefs-Desires-Intentions):
   - Beliefs: perceived environment state
   - Desires: ranked goals (survive > eat > reproduce > explore)
   - Intention: committed plan; maintained unless belief revision triggers reconsideration

### 7.3 Renderer (`renderer.js`)

**Techniques**:
- `ImageData` pixel buffer for grass grid (performance)
- `Path2D` cached shapes for agents (circle for prey, triangle for predator)
- Energy-to-color mapping with type-specific hue
- Alpha-faded trails
- Vision radius circles and selection ring overlay

**Exports**:
```
PALETTE                           // Color constants
drawFrame(ctx, state, params, uiState)  // Main compositor
hitTest(agents, cx, cy, w, h, r) → Agent | null
```

### 7.4 Charts (`charts.js`)

5 chart types, all D3 SVG:
```
drawPopulationChart(container, history, isRunning)       // Dual-line + area, CatmullRom, tooltip
drawPhasePortrait(container, history)                    // Prey-vs-predator scatter trail, tooltip
drawEnergyHistogram(container, preyE, predE, maxE)      // Dual bar histogram
drawActionDonut(container, actionDist)                   // D3 arc/pie donut
drawGrassHeatmap(container, grid, gridW, gridH)          // Sequential green color scale + legend
```

### 7.5 Module (`module.js`)

**Event Bus**: `d3.dispatch('sim:start', 'sim:pause', 'sim:reset', 'sim:step', 'sim:tick', 'param:change', 'param:preset', 'agent:select', 'agent:deselect', 'rule:change', 'engine:error')`

**Stores**:
- `ParamStore`: get/set with validation, loadPreset
- `SimStore`: init/tick/start/pause/step with error dispatch
- `uiState`: selectedId, activeChart, speed, zoomTransform
- `fpsMonitor`: rolling 60-frame FPS

**UI Components Built by D3**:
- Stats bar (Tick, Prey, Predators, Grass%, FPS)
- Sidebar: playback buttons, rule selector, 15 parameter sliders, 2 toggles, presets, export buttons, pseudocode panel
- Canvas with d3-zoom (scale 0.5–6×), ResizeObserver
- Chart tabs (5 tabs)
- Agent inspector (detail panel on click-select)
- Keyboard shortcut help panel (? key)
- Error banner

**Keyboard Shortcuts**:
| Key | Action |
|-----|--------|
| Space | Play/Pause |
| R | Reset |
| → | Step forward |
| 1/2/3 | Switch decision rule |
| T | Toggle trails |
| V | Toggle vision circles |
| +/- | Adjust speed |
| Esc | Deselect agent |
| Ctrl+Z | Reset zoom |
| ? | Toggle help panel |

---

## 8. BUILD AND TEST CONFIGURATION

### 8.1 Vite Config

```javascript
{
  root: '.',
  base: process.env.GITHUB_ACTIONS ? '/Probability-education/' : './',
  resolve: {
    alias: {
      '@shared': 'src/shared',
      '@modules': 'src/modules',
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        // ... all 35 module index.html files
      }
    }
  }
}
```

### 8.2 NPM Scripts

```json
{
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run && npx playwright test --grep-invert visual",
  "test:unit": "vitest run",
  "test:e2e": "npx playwright test --grep-invert visual",
  "test:e2e:smoke": "npx playwright test smoke",
  "test:e2e:interactions": "npx playwright test interactions",
  "test:screenshots": "npx playwright test screenshots",
  "test:screenshots:update": "npx playwright test screenshots --update-snapshots"
}
```

### 8.3 Playwright Config

```javascript
{
  testDir: 'tests/e2e',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  workers: 4,
  retries: 1,
  reporter: [['list'], ['html']],
  use: {
    baseURL: 'http://localhost:4173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
}
```

### 8.4 CI/CD Workflows

**Test Workflow** (on push/PR to main):
1. Unit tests (Node 20, vitest)
2. Build check (vite build)
3. E2E tests (Playwright chromium, upload artifacts on failure)

**Deploy Workflow** (on push to main):
1. Build production bundle
2. Upload to GitHub Pages

---

## 9. RECONSTRUCTION INSTRUCTIONS

### 9.1 To Rebuild in the Same Stack (JavaScript + D3)

1. Initialize: `npm init`, install dependencies (d3, jstat, katex, vite, vitest, @playwright/test)
2. Create design system CSS with exact tokens from Section 4
3. Create shared library (PRNG, distributions, components) per Section 6
4. Create math-utils.js per Section 6.4
5. For each of the 35 modules in Section 5:
   a. Create index.html from template (Section 5.1)
   b. Implement module.js with the mathematical content described
   c. Create module-specific style.css
6. Create landing page index.html with card grid linking to all modules
7. Configure vite.config.js with all entry points
8. Write unit tests for math-utils and any complex engine code
9. Write E2E smoke tests verifying all modules load

### 9.2 To Rebuild in a Different Language/Framework

**Mapping Concepts**:

| This Project | React/Next.js | Python/Dash | Flutter | Desktop (Qt/Electron) |
|-------------|---------------|-------------|---------|----------------------|
| D3 selections | React components + d3 in useEffect | Plotly/Dash components | CustomPaint + fl_chart | QML Charts / d3 in Electron |
| KaTeX | react-katex | dash-katex / MathJax | flutter_math_fork | QLabel with MathJax |
| CSS custom props | Tailwind / styled-components | Dash CSS | ThemeData | QSS / CSS |
| Vite | Next.js / CRA | Flask/Dash server | flutter build | electron-builder |
| Canvas 2D | react-canvas / Canvas component | Plotly canvas | CustomPainter | QGraphicsView |
| d3-zoom | react-zoom-pan-pinch | Dash callbacks | GestureDetector | QGraphicsView zoom |

**Critical Algorithms to Preserve**:
1. xoshiro128** or equivalent seedable PRNG with identical stream for reproducibility
2. All 11 distribution implementations (PDF, CDF, sampling, CF)
3. Lanczos gamma approximation (7-term)
4. SpatialGrid with toroidal wrapping for ABM
5. Three decision rule architectures (reactive, bounded, BDI)
6. Lotka-Volterra ecosystem dynamics with tuned parameters
7. Gini coefficient calculation
8. All characteristic function formulas

**Mathematical Accuracy Requirements**:
- Distributions must match reference implementations to 6+ significant digits
- PRNG must produce identical sequences for identical seeds
- Convergence demonstrations must show correct asymptotic behavior
- CLT convergence rate must match Berry-Esseen bound
- Markov chain stationary distributions must be correct eigenvectors

### 9.3 Minimum Viable Reconstruction

If rebuilding incrementally, prioritize in this order:

1. **Phase 1**: Design system + shared stats library + 3 core modules (2.4-clt, 6.1-markov, 8.1-prior-posterior)
2. **Phase 2**: Remaining foundations (Section 1) and convergence (Section 2)
3. **Phase 3**: Stochastic calculus (Section 7) and information theory (Section 9)
4. **Phase 4**: Medical/quality applications (Section mq)
5. **Phase 5**: ABM modules and financial math

---

## 10. DATA FLOW PATTERNS

### 10.1 Standard Module Data Flow

```
User Input (slider/dropdown/toggle)
    │
    ▼
Parameter Change Handler
    │
    ▼
State Object Update
    │
    ▼
Data Generation (may use seeded PRNG)
    │
    ▼
D3 Visualization Update
    │
    ├──▶ SVG DOM manipulation (scales, axes, paths, shapes)
    ├──▶ KaTeX math rendering (formulas update with params)
    └──▶ Info panel text update
```

### 10.2 ABM-2 Event-Driven Flow

```
User Action ──▶ d3.dispatch event
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
ParamStore      SimStore         UIState
    │               │               │
    │          stepSim() ◀──────────┘
    │               │
    │          sim:tick event
    │               │
    ├───────┬───────┼───────┬───────┐
    ▼       ▼       ▼       ▼       ▼
 Canvas  StatsBar Charts Inspector ErrorBanner
(60fps)  (60fps)  (4Hz)   (60fps)  (on error)
```

---

## 11. TESTING STRATEGY

### 11.1 Unit Test Coverage

| Domain | Test Count | What's Tested |
|--------|-----------|---------------|
| Math utilities | ~25 | Gamma function accuracy, CF formulas, PRNG determinism |
| ABM engine | ~50 | RNG, geometry, spatial grid, agent factory, decision rules, sim step immutability, 500-tick survival |

### 11.2 E2E Test Coverage

| Test Suite | Count | What's Tested |
|-----------|-------|---------------|
| Smoke | ~175 | All 35 modules load, render SVG/canvas, no JS errors |
| Interactions | ~15 | Control panel responsiveness, CLT sampling, Markov transitions |
| ABM-specific | ~16 | Playback, rules, stats, canvas, charts, sliders, keyboard |
| Visual regression | ~18 | Pixel-level screenshot comparison for key modules |

### 11.3 Key Test Invariants

- Every module must load without JavaScript errors
- Every module must render at least one SVG or canvas element
- Seeded simulations must produce identical results
- ABM ecosystem must survive 500 ticks under all 3 decision rules
- All distribution PDFs must integrate to ~1.0 over their support

---

## 12. PERFORMANCE CONSIDERATIONS

### 12.1 ABM Rendering Pipeline

| Technique | Purpose | Impact |
|-----------|---------|--------|
| ImageData pixel buffer | Grass grid rendering | ~10× faster than individual rect draws |
| Path2D cache | Agent shapes | Eliminates per-frame path construction |
| Canvas 2D (not SVG) | Agent rendering | O(n) draw vs O(n) DOM nodes |
| Chart throttling (4Hz) | SVG chart updates | Prevents D3 thrash on 60fps sim |
| d3.timer() | Simulation loop | Proper rAF integration with pause/resume |

### 12.2 General D3 Patterns

- Use `.join()` (D3 v7) instead of enter/update/exit for cleaner updates
- Use `viewBox` for responsive SVGs (no manual resize)
- Minimize DOM mutations: batch updates, use transitions sparingly during animation
- Use `d3.bisector` for efficient tooltip data lookup

---

## 13. EXTENSION CHECKLIST

When adding a new module:

- [ ] Create `src/modules/{id}-{name}/` with index.html, module.js, style.css
- [ ] Follow HTML template from Section 5.1
- [ ] Import shared components/stats as needed
- [ ] Add entry to `vite.config.js` rollupOptions.input
- [ ] Add module card to `index.html` landing page
- [ ] Add module URL to `tests/e2e/smoke.spec.js` MODULES array
- [ ] Verify: `npm run build` succeeds
- [ ] Verify: `npm run test:unit` passes
- [ ] Verify: `npm run test:e2e:smoke` passes
- [ ] Consider adding interaction tests if module has complex controls
- [ ] Consider adding visual regression snapshot

---

*This specification is machine-readable and human-readable. An AI coding assistant should be able to reconstruct the full project from this document plus the source files in the repository.*
