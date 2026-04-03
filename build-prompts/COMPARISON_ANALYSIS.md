# Build Prompts vs. Existing Repo — Full Comparison Analysis
**Generated 2026-04-03**

---

## Summary Verdict

The repository is **substantially more built than the build prompts assume.** The existing platform is a production-quality, 53-module interactive probability environment with sophisticated shared infrastructure, full CI/CD, and three applied domain suites (medical quality, rural healthcare, stochastic finance/ABM) that don't appear in the build prompts at all. The build prompts correctly identify genuine gaps at the beginner and advanced research ends of the curriculum, and correctly push toward SvelteKit + WASM — but they propose rebuilding from scratch work that should instead be migrated or extended.

---

## 1. What Already Exists (v1 Platform)

### 1.1 Scale
| Asset | Count |
|-------|-------|
| Interactive modules in `src/modules/` | **53** |
| Core probability theory modules (pillars 1–9) | **22** |
| Medical quality modules (mq-*) | **10** |
| Rural healthcare modules (rh-*) | **13** |
| Applied domain modules (ABM, finance) | **5** |
| Interactive textbook HTML series | **4 files, 48 D3 labs** |
| Named probability distributions implemented | **11** |
| Shared JS components | **6** |
| Total source lines (JS + CSS + HTML) | **~35,000** |

### 1.2 Core Probability Modules Already Built
These modules exist RIGHT NOW in `src/modules/` with full D3 interactivity:

| Module ID | Title | Maps to My Prompt |
|-----------|-------|-------------------|
| `1.1-sigma-algebra` | Sigma-Algebra Explorer | P4-01 SigmaAlgebraBuilder |
| `1.2-measure-random-vars` | Measure & Random Variables | P4-01 |
| `1.3-lebesgue-riemann` | Lebesgue vs Riemann | P4-01 LebesgueIntegralApproximator |
| `1.4-cantor-set` | Cantor Set + Devil's Staircase | P4-01 (not planned) |
| `2.1-convergence-modes` | Convergence Mode Comparator | P4-02 ConvergenceTypeAnimator |
| `2.2-borel-cantelli` | Borel-Cantelli Lab | P4-02 BorelCantelliSimulator |
| `2.3-lln-lab` | LLN Laboratory | P3-04 WLLNSimulator |
| `2.4-clt-studio` | CLT Studio + Q-Q plot | P3-04 CLTSimulator |
| `3.1-characteristic-functions` | Characteristic Functions in ℂ | P3-01 MGFExplorer |
| `3.2-convolution-cfs` | Convolution & CLT via CFs | P3-01 IndependenceSumsViaTransforms |
| `4.1-conditional-expectation` | Conditional Expectation (L² projection) | P3-03 |
| `4.2-martingale-explorer` | Martingale Explorer + OST | P4-03 |
| `5.1-donsker` | Donsker's Theorem + Functional CLT | P4-02 InvariancePrinciples |
| `5.2-brownian-properties` | Brownian Properties (QV, arcsine law) | P4-04 BrownianMotionSimulator |
| `6.1-markov-dashboard` | Markov Dashboard + force-directed | P3-05 MarkovChainEditor |
| `6.2-ergodic-mixing` | Ergodic Mixing + TV distance decay | P5-03 MixingVisualization |
| `7.1-ito-integral` | Itô Integral (vs. Stratonovich) | P5-01 ItoIntegralConstructor |
| `7.2-sde-solver` | SDE Solver: GBM, OU, CIR | P5-01 GeometricBrownianMotion |
| `8.1-prior-posterior` | Prior-to-Posterior (4 conjugate families) | P5-05 BvMTheoremDemo |
| `8.2-mcmc-explorer` | MCMC Explorer (MH step-by-step) | P6-05 MetropolisHastingsSimulator |
| `9.1-entropy-kl` | Entropy & KL Divergence | P5-04 ShannonEntropyExplorer |
| `9.2-mutual-information` | Mutual Information + Venn | P5-04 MutualInformationDashboard |

**Conclusion: 22 of my "build" prompts are describing modules that already exist at production quality.**

### 1.3 Entirely Missing from My Build Prompts
These exist in the repo but have no equivalent in the build manifest:

| Category | Modules | Value |
|----------|---------|-------|
| Medical Quality | 10 modules (SPC, CUSUM, funnel plot, meta-analysis, diagnostic testing, Pareto, EBM, disease modeling, vaccine) | High — Timothy's clinical domain |
| Rural Healthcare | 13 modules (catchment, patient flow, digital twin, workforce, financial risk, disaster resilience) | High — Timothy's core work |
| Stochastic Finance | GBM, Black-Scholes Greeks, Markowitz frontier, VaR/CVaR, Vasicek/CIR, Merton jump-diffusion | High — connects to Ch 16 |
| ABM Laboratory | SEIR epidemic, Boids, Schelling segregation, predator-prey (3 architectures) | Medium |
| Cantor Set module | Devil's staircase, fractal dimension — beautiful | Medium |
| Intro probability stats | `intro-prob-stats` module | Low — likely superseded by Ch 1-6 |

### 1.4 Existing Shared Infrastructure
The repo already has a mature shared library that my prompts propose rebuilding:

| Existing Component | My Prompt Equivalent | Status |
|-------------------|---------------------|--------|
| `SimulationEngine.js` (D3.timer animation loop, error isolation, telemetry) | None planned — build prompts use Svelte reactivity | **Conflict — needs migration plan** |
| `ErrorBoundary.js` (window.onerror + ANTIGRAVITY_LOG) | Svelte error boundaries (implicit) | **Duplicate effort** |
| `ParameterPanel.js` (slider/dropdown/toggle factory) | P8-04 accessibility work (implicit) | **Already exists** |
| `ResponsiveHistogram.js` (D3 histogram + KDE overlay) | P1-03 D3 utils (partial overlap) | **Already exists** |
| `distributions.js` (11 distributions, Box-Muller, xoshiro128**) | rust-sci-core sci-stats (WASM) | **Replace with WASM — correct call** |
| `prng.js` (SeedablePRNG xoshiro128**) | rust-sci-core (WASM) | **Replace — correct** |

### 1.5 Existing WASM Proof-of-Concept
`src/modules/abm-3-predator-prey-wasm/` uses **AssemblyScript** (TypeScript-to-WASM), not Rust:
- Has a working `bridge.js` with lazy-load + JS fallback pattern
- Has a built `pkg/engine.wasm` already in the repo
- The bridge pattern (`getEngine()` → lazy init → cached) is exactly what P1-02 describes
- **Implication:** The WASM bridge pattern is already proven here; P1-02 should EXTEND this rather than invent a new pattern. The key decision is AssemblyScript vs. rust-sci-core — both valid.

### 1.6 Typography and Design System
The existing design system uses a **different** font stack and palette from Hartzog Web Standard v1.0:

| Property | Existing (v1) | My Build Prompts (v2 / Hartzog) |
|----------|--------------|----------------------------------|
| Heading font | Inter | DM Serif Display |
| Body font | STIX Two Text (mathematical serif) | IBM Plex Sans |
| Mono font | JetBrains Mono | IBM Plex Mono |
| Primary color | `#2563eb` (same blue) | `#2563eb` (same) |
| Secondary color | `#e97319` (orange) | `#ea580c` (orange — slightly different) |
| Background | `#fafafa` | `#fafaf8` (nearly identical) |
| Body text | `#1a1a2e` (navy-black) | `#1a1a18` (warm-black) |

STIX Two Text is a deliberate academic math serif — arguably better than IBM Plex Sans for a probability textbook. The font migration will visually change every existing module.

---

## 2. What the Build Prompts Add That's Genuinely Missing

### 2.1 Coverage Gaps — Beginner Level (Chapters 1–6)
The existing platform starts at **measure theory** (sigma-algebras, Lebesgue integral). It has **zero coverage** of:

| Gap | My Build Prompt | Priority |
|-----|----------------|----------|
| Classical/frequentist probability intro | P2-01 Ch 1 | HIGH — every student starts here |
| Combinatorics (permutations, Pascal's Triangle) | P2-02 Ch 2 | HIGH |
| Conditional probability, Bayes, Monty Hall, Birthday | P2-03 Ch 3 | HIGH — Bayes is the most-taught topic |
| Discrete distributions (Binomial, Poisson, Geometric) | P2-04 Ch 4 | HIGH |
| Continuous distributions (Normal, Exponential, Gamma) | P2-05 Ch 5 | HIGH |
| Joint distributions (bivariate Normal, covariance) | P2-06 Ch 6 | HIGH |

These 6 chapters represent the majority of an undergraduate probability course. **The current platform is inaccessible to beginners.** This is the most valuable addition the build prompts make.

### 2.2 Coverage Gaps — Advanced Graduate (Chapters 20–28)
The existing platform's 9 "pillars" stop at MCMC and information theory. Missing:

| Gap | My Build Prompt | Priority |
|-----|----------------|----------|
| Dirichlet process, Gaussian process regression | P5-05 Ch 20 | High |
| Wigner semicircle, Marchenko-Pastur, Tracy-Widom | P5-06 Ch 21 | Medium |
| Erdős-Rényi phase transition, Lovász LLL | P5-07 Ch 22 | Medium |
| Rough paths, Malliavin calculus | P6-01 Ch 23 | Low (research-only) |
| Voter model, TASEP, hydrodynamic limits | P6-02 Ch 24 | Medium |
| Optimal transport (Sinkhorn, Wasserstein) | P6-03 Ch 25 | High — hot research area |
| JL lemma, VC dimension, compressed sensing | P6-04 Ch 26 | High |
| HMC, particle filters, mixing time | P6-05 Ch 27 | High (extends existing MCMC) |
| Bayesian networks, belief propagation, causal DAGs | P6-06 Ch 28 | High |

### 2.3 Infrastructure Missing from v1
| Feature | My Build Prompt | Exists? |
|---------|----------------|---------|
| SvelteKit routing (chapter URLs like /part-1/chapter-3) | P1-01 | No — flat module URLs |
| Full-text search | P8-01 | No |
| Progress tracking + bookmarks | P8-02 | No — explicitly stateless |
| PWA / offline mode | P8-03 | No |
| WCAG AA accessibility audit | P8-04 | No (noted gap in catalog) |
| Cross-browser testing | P8-06 | No (Chromium only) |
| Dark/light theme toggle | P1-05 | No |
| Distribution reference table | P7-01 | Partial (in textbook HTMLs) |
| Inequalities compendium | P7-02 | No |

### 2.4 WASM Computation Power
The existing platform uses:
- **jStat** for Gamma/Beta/regularized functions (JS, no WASM)
- **Custom Box-Muller** and sampling algorithms (pure JS)
- **AssemblyScript** for ONE module (abm-3) as a proof-of-concept

My build prompts add **rust-sci-core** for:
- Numerically stable high-precision distribution computations
- Large-scale simulations (random matrices at N=1000 require WASM)
- Convergence speed for Monte Carlo at 1M+ iterations
- This is a **correct and significant upgrade** for the advanced chapters

---

## 3. Overlap Mapping — Simulation by Simulation

### Redundant (existing module covers it, build prompt would duplicate):

| My Prompt | Existing Module | Recommendation |
|-----------|----------------|----------------|
| P4-01 SigmaAlgebraBuilder | `1.1-sigma-algebra` ✅ | **Migrate, don't rebuild** |
| P4-01 LebesgueIntegralApproximator | `1.3-lebesgue-riemann` ✅ | **Migrate, don't rebuild** |
| P4-02 ConvergenceTypeAnimator | `2.1-convergence-modes` ✅ | **Migrate** |
| P4-02 BorelCantelliSimulator | `2.2-borel-cantelli` ✅ | **Migrate** |
| P3-04 WLLNSimulator | `2.3-lln-lab` ✅ | **Migrate** |
| P3-04 CLTSimulator | `2.4-clt-studio` ✅ | **Migrate** |
| P3-01 MGFExplorer | `3.1-characteristic-functions` ✅ | **Migrate + extend** |
| P3-01 IndependenceSumsViaTransforms | `3.2-convolution-cfs` ✅ | **Migrate** |
| P3-03 ConditionalExpectationExplorer | `4.1-conditional-expectation` ✅ | **Migrate** |
| P4-03 MartingalePathPlotter | `4.2-martingale-explorer` ✅ | **Migrate** |
| P4-04 BrownianMotionSimulator | `5.2-brownian-properties` ✅ | **Migrate** |
| P3-05 MarkovChainEditor | `6.1-markov-dashboard` ✅ | **Migrate** |
| P5-03 MixingVisualization | `6.2-ergodic-mixing` ✅ | **Migrate** |
| P5-01 ItoIntegralConstructor | `7.1-ito-integral` ✅ | **Migrate** |
| P5-01 GeometricBrownianMotion | `7.2-sde-solver` ✅ | **Migrate** |
| P5-05 BvMTheoremDemo | `8.1-prior-posterior` ✅ | **Migrate + extend** |
| P6-05 MetropolisHastingsSimulator | `8.2-mcmc-explorer` ✅ | **Migrate** |
| P5-04 ShannonEntropyExplorer | `9.1-entropy-kl` ✅ | **Migrate** |
| P5-04 MutualInformationDashboard | `9.2-mutual-information` ✅ | **Migrate** |

**19 of the chapter-level simulation prompts describe work that's already done.**

### Partial Overlap (existing covers part of what's planned):

| My Prompt | Existing Coverage | What's Missing |
|-----------|-----------------|----------------|
| P4-02 LindebergCLTChecker | `2.4-clt-studio` has CLT | Lindeberg condition checker is new |
| P4-02 LargeDeviationsRateFunction | Nothing on rate functions | Entirely new |
| P4-03 AzumaHoeffdingDemo | `4.2-martingale-explorer` has OST | Azuma bounds are new |
| P4-04 OUProcessSimulator | `7.2-sde-solver` has OU | Stationary distribution display is new |
| P4-04 GaussianProcessDashboard | `8.1-prior-posterior` has GP-adjacent content | Full GP posterior is new |
| P6-05 HMCSimulator | `8.2-mcmc-explorer` has MH | HMC + phase space is new |
| P6-05 MixingTimeAnalyzer | `6.2-ergodic-mixing` has TV distance | Spectral gap + Cheeger is new |

### Entirely New (no existing coverage):

| My Prompt | Topic | Priority |
|-----------|-------|----------|
| P2-01 through P2-06 | ALL of Part I (beginners) | 🔴 Highest |
| P3-01 CumulantDashboard | Cumulant generating function | Medium |
| P3-02 MultinomialExplorer | Multinomial distribution | Medium |
| P3-02 OrderStatisticsPlotter | Order statistics | High |
| P3-02 ConvolutionAnimator | Step-by-step convolution | High |
| P3-02 GaussianMixtureExplorer | Mixture models | High |
| P3-03 TowerPropertyVerifier | Law of total expectation | High |
| P3-03 EvesLawDecomposition | Eve's law variance decomposition | High |
| P3-05 GamblerRuin | Gambler's ruin animation | High |
| P3-05 PoissonProcessSimulator | Poisson arrival animation | High |
| P5-05 DirichletProcessExplorer | CRP, stick-breaking | High |
| P5-05 GaussianProcessRegression | GP with posterior update | High |
| P5-06 WignerSemicircleSimulator | Random matrices | Medium |
| P5-06 MarchenkoPasturExplorer | Wishart eigenvalues | Medium |
| P5-07 ErdosRenyiPhaseTransition | Giant component | High |
| P6-01 RoughPathSignature | Path signatures | Low |
| P6-02 VoterModel/TASEP | Particle systems | Medium |
| P6-03 ALL | Optimal transport | High |
| P6-04 ALL | High-dimensional probability | High |
| P6-06 BayesianNetworkBuilder | PGM with exact inference | High |
| P6-06 CausalDAGExplorer | do-calculus | High |
| P7-01 DistributionReference | Reference table + comparison | High |
| P7-02 InequalitiesCompendium | All inequalities with demos | High |

---

## 4. Architecture Conflict Analysis

### 4.1 Framework: Vanilla ES Modules vs. SvelteKit
| Dimension | v1 (Existing) | v2 (Build Prompts) |
|-----------|--------------|-------------------|
| Framework | None — vanilla ES modules | SvelteKit 2 |
| Routing | Multi-entry Vite (51 HTML files) | SPA routing (/part-1/chapter-3) |
| State | Explicitly stateless (fresh on every load) | localStorage progress tracking |
| Module boundary | Hard (each module = separate bundle) | Soft (Svelte components in a shell) |
| SSR | No | No (adapter-static) |
| Migration path | Iframe embed OR full rewrite | Iframe is fastest |

**Recommendation:** Use SvelteKit as the shell/router. Embed existing modules as `<iframe>` inside chapter routes for Phase 1 of migration. Rewrite individual modules to native Svelte components in subsequent phases. This preserves 53 modules of existing work immediately.

### 4.2 WASM: AssemblyScript vs. rust-sci-core
| Dimension | v1 (AssemblyScript, abm-3 only) | v2 (rust-sci-core / Rust) |
|-----------|--------------------------------|--------------------------|
| Language | TypeScript-like (easy for JS devs) | Rust (harder, more powerful) |
| Compile target | WASM | WASM |
| In repo already? | Yes (abm-3 has working pipeline) | No (new dependency) |
| Performance | Good for integer-heavy ABM | Better for float-heavy probability math |
| Ecosystem | Limited | Rich (ndarray, nalgebra, statrs) |
| Build complexity | `npm run build:wasm` | Rust toolchain + wasm-pack |
| CI cost | Low | Medium (Rust compile ~3 min) |

**Recommendation:** For existing modules (distributions, sampling), migrate to rust-sci-core. For the ABM modules, keep AssemblyScript — it's better suited. Use both pipelines in the same repo.

### 4.3 Distribution Computation: jStat vs. rust-sci-core
The existing `distributions.js` has known good implementations:
- Box-Muller with s=0 guard ✅
- Gamma via Marsaglia-Tsang + Ahrens-Dieter ✅
- Beta CDF via Lentz continued fraction ✅
- Binomial/Poisson boundary guards (p=0, λ=0) ✅

These are **not trivial to re-implement correctly** in Rust. rust-sci-core should use the `statrs` crate which has all of these already. The build prompts don't explicitly call out this risk.

### 4.4 Font Migration Risk
The existing platform uses **STIX Two Text** as the body font — a mathematical serif specifically designed for probability/statistics text. IBM Plex Sans (the Hartzog standard) is a clean sans-serif that will look more modern but less "textbook." This is a deliberate aesthetic trade-off. The Hartzog standard was designed for clinical/medical content; it may feel slightly off for pure mathematics. Worth reconsidering for this specific project.

---

## 5. What the Build Prompts Should Be Updated To Reflect

### 5.1 Phase 0: Audit and Migration Plan (Missing Phase)
The build prompts skip directly to scaffolding. Add a Phase 0:

```
P0-01: SvelteKit shell that iframes all 53 existing modules 
        at their existing paths, wrapped in the new nav/layout
P0-02: Migrate design-system.css tokens to Hartzog CSS vars
        (keep STIX Two Text body font — reconsider IBM Plex Sans)
P0-03: Adapt SimulationEngine.js for Svelte reactivity
P0-04: Move mq-*, rh-*, fm-*, abm-* to /applied/ route subtree
```

### 5.2 Reuse Existing Simulations for 19 Chapter Prompts
Chapters 12–19 build prompts should say: "Migrate and embed the existing `[module-id]` module rather than rebuilding from scratch. Wrap in a Svelte component with the standard chapter layout, progress tracking, and deep-link anchor."

### 5.3 WASM Bridge Clarification
P1-02 should reference the existing AssemblyScript bridge at `abm-3-predator-prey-wasm/bridge.js` as the pattern to follow. The lazy-load + fallback + caching pattern is already proven.

### 5.4 Missing Applied Content
Add three new chapters or appendix sections for the applied domains that already exist:
- `/applied/medical-quality` — wrapping the 10 mq-* modules
- `/applied/rural-healthcare` — wrapping the 13 rh-* modules
- `/applied/stochastic-finance` — wrapping fm-1

### 5.5 Testing Gap
The existing test suite lacks:
- Statistical correctness tests (no chi-squared goodness-of-fit on sampled distributions)
- Accessibility testing (acknowledged in catalog section 10)
- Mobile/touch testing
- Cross-browser beyond Chromium

P8-06 in the build prompts adds accessibility (axe-core) but misses the statistical correctness gap.

---

## 6. Priority-Ordered Build Recommendation

Given the overlap analysis, here's the revised priority order:

### Do First (Highest ROI, no overlap with existing)
1. **P2-01 → P2-06**: All of Part I (Chapters 1–6) — beginners are completely unserved
2. **P1-01, P1-05, P1-06**: SvelteKit shell + layout + home page
3. **P0-01**: Iframe-embed all 53 existing modules in the new shell immediately
4. **P8-01**: Search — users can't navigate 53 modules without it
5. **P7-01**: Distribution reference table — high utility, easy to build

### Do Second (Fills genuine curriculum gaps)
6. **P5-05 Ch 20**: Gaussian process regression + Dirichlet process
7. **P6-03 Ch 25**: Optimal transport (hot research area, nothing similar exists)
8. **P6-04 Ch 26**: High-dimensional probability
9. **P6-06 Ch 28**: Bayesian networks + causal DAGs
10. **P7-02**: Inequalities compendium

### Do Third (Migrate and extend existing simulations)
11. **P3-01 → P3-05**: Parts II chapters — extend existing modules with deeper content
12. **P4-01 → P4-04**: Part III — wrap existing modules in chapter layout
13. **P5-01 → P5-04**: Part IV — wrap existing modules

### Do Last (Lower ROI, high complexity, research-only)
14. **P6-01 Ch 23**: Rough paths / Malliavin (research frontier, small audience)
15. **P6-02 Ch 24**: Particle systems
16. **P5-06 Ch 21**: Random matrices
17. **P5-07 Ch 22**: Probabilistic combinatorics

---

## 7. Summary Table

| Dimension | v1 Platform | Build Prompts v2 | Gap? |
|-----------|------------|-----------------|------|
| Beginner coverage (Ch 1–6) | ❌ None | ✅ Full | **Major gap in v1** |
| Core grad probability (Ch 12–19) | ✅ 22 modules | ✅ 22 chapters | Overlap — migrate |
| Advanced research (Ch 20–28) | ❌ Sparse | ✅ 9 chapters | **Major gap in v1** |
| Medical quality content | ✅ 10 modules | ❌ Not planned | **Major gap in v2** |
| Rural healthcare content | ✅ 13 modules | ❌ Not planned | **Major gap in v2** |
| Stochastic finance | ✅ Full module | ❌ Not planned | Gap in v2 |
| WASM computation | ⚠️ AssemblyScript (1 module) | ✅ rust-sci-core (all) | Upgrade path exists |
| SvelteKit routing | ❌ Multi-entry flat | ✅ Planned | Big win for UX |
| Search | ❌ None | ✅ Planned | Big win |
| Progress tracking | ❌ Stateless | ✅ Planned | Win |
| PWA offline | ❌ None | ✅ Planned | Win |
| Accessibility | ❌ Not tested | ✅ Planned | Win |
| CI/CD | ✅ Full pipeline | ✅ Planned | Already good |
| Font system | STIX Two Text (math serif) | IBM Plex Sans (sans) | Debatable trade-off |

---

*Analysis by Claude Sonnet 4.6 — 2026-04-03*
*Repository: timothyhartzog/Probability-education*
