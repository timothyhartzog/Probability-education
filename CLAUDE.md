# Probability Education Platform — Agent Startup Guide
> Read this file completely before writing any code.
> This is the canonical reference for the Claude Code agent.

---

## 1. Project Identity

**What this is:** An interactive probability textbook, `timothyhartzog/Probability-education`, covering high school coin flips through graduate-level stochastic calculus. Every theorem has a live simulation.

**Two parallel codebases live here:**

| Codebase | Location | Stack | Status |
|----------|----------|-------|--------|
| **v1** (existing) | `src/modules/` | Vanilla JS + D3.js 7.9 + Vite | ✅ Production — 53 working modules, DO NOT BREAK |
| **v2** (new) | `app/` | SvelteKit 2 + D3.js 7.8.5 + KaTeX | 🚧 In development — this is what you build |

**Your job:** Build out the `app/` SvelteKit v2 platform. The v1 platform is read-only reference — never modify files in `src/`, `index.html`, `vite.config.js`, `package.json` (root), or `css/js/` directories.

---

## 2. Immediate Environment Setup

Run this before anything else:

```bash
# 1. Enter the app directory (ALL your work happens here)
cd app

# 2. Install dependencies (if node_modules missing)
npm install --legacy-peer-deps

# 3. Sync SvelteKit types
npx svelte-kit sync

# 4. Verify build works BEFORE making changes
npm run build
# Expected: "✓ built in Xs" with zero errors

# 5. Start dev server to preview
npm run dev
# Opens at http://localhost:5174
```

**If build fails, fix it before adding new code.** A passing build is the minimum bar.

---

## 3. Current State (as of 2026-04-03)

### What's done ✅
- SvelteKit 2 scaffold with adapter-static (GitHub Pages ready)
- Hartzog Web Standard v1.0 CSS system (light + dark theme)
- Global layout: sticky nav, sidebar with all 28 chapters, dark mode toggle
- Home page: animated Galton board hero, prerequisite cards, full chapter grid
- `ChapterLayout.svelte` — reusable chapter shell (breadcrumb, header, prev/next)
- `LegacyModule.svelte` — iframe wrapper for existing v1 modules
- Chapter data registry: all 28 chapters with metadata (`src/lib/data/chapters.ts`)
- **Chapter 1** — Full interactive page: coin flip D3 animation, Kolmogorov axiom checker
- **Chapter 2** — Full interactive page: Pascal's Triangle, permutation calculator, inclusion-exclusion, derangements
- **Chapter 3** — Full interactive page: Bayes natural frequency visualizer, Monty Hall simulator, Birthday paradox
- **Chapters 4–28** — Scaffold pages (45–46 lines each, need real content)
- **Appendix: Distributions** — Searchable reference table (121 lines, complete)
- GitHub Actions workflow: `.github/workflows/deploy-v2.yml`

### What's needed 🚧 (prioritized order)
See `agent-tasks.json` for the machine-readable task queue.

**Priority 1 — Part I chapters (beginners are completely unserved):**
- Chapter 4: Discrete Random Variables — PMF explorer, binomial/Poisson/geometric simulations
- Chapter 5: Continuous Random Variables — PDF integrator, Normal explorer
- Chapter 6: Joint Distributions — bivariate Normal contours, covariance visualizer

**Priority 2 — Infrastructure:**
- Full-text search (FlexSearch)
- Progress tracking (localStorage store)
- Inequalities appendix page

**Priority 3 — New graduate content (not in v1):**
- Chapter 20: Bayesian Nonparametrics (Dirichlet process, GP regression)
- Chapter 25: Optimal Transport (Sinkhorn, Wasserstein)
- Chapter 26: High-Dimensional Probability (JL lemma, VC dimension)
- Chapter 28: Probabilistic Graphical Models (Bayesian networks, belief propagation)

**Priority 4 — Enrich legacy-wrapped chapters:**
- Add expository text + KaTeX formulas above each LegacyModule iframe
- Chapters 7, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 27

---

## 4. Architecture

```
app/
├── src/
│   ├── app.html              ← Root HTML: loads D3 7.8.5 + KaTeX 0.16 from CDN
│   ├── app.css               ← Hartzog Web Standard v1.0 global styles
│   ├── lib/
│   │   ├── components/
│   │   │   ├── ChapterLayout.svelte    ← Use for ALL chapter pages
│   │   │   └── LegacyModule.svelte     ← Iframe wrapper for v1 modules
│   │   └── data/
│   │       └── chapters.ts             ← Chapter registry (all 28 chapters)
│   └── routes/
│       ├── +layout.svelte              ← Global nav + sidebar
│       ├── +page.svelte                ← Home page
│       ├── part-1/chapter-{1-6}/      ← Part I (HIGH PRIORITY — build these)
│       ├── part-2/chapter-{7-11}/     ← Part II (have LegacyModule wrappers)
│       ├── part-3/chapter-{12-15}/    ← Part III (have LegacyModule wrappers)
│       ├── part-4/chapter-{16-22}/    ← Part IV (have LegacyModule wrappers)
│       ├── part-5/chapter-{23-28}/    ← Part V (have LegacyModule wrappers)
│       └── appendix/
│           └── distributions/          ← Complete ✅
└── static/
    └── favicon.svg
```

---

## 5. Coding Standards

### Every chapter page MUST use ChapterLayout

```svelte
<script lang="ts">
  import ChapterLayout from '$lib/components/ChapterLayout.svelte';
  import { getChapter, getNext, getPrev } from '$lib/data/chapters';
  const ch = getChapter(PART, NUM)!;
</script>

<svelte:head><title>Chapter N: Title | Probability Education</title></svelte:head>

<ChapterLayout {ch} nextCh={getNext(ch)} prevCh={getPrev(ch)}>
  <!-- your content here -->
</ChapterLayout>
```

### KaTeX rendering pattern (D3 and KaTeX load from CDN — not npm imports)

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  // ...
  onMount(() => {
    setTimeout(() => {
      const K = (window as any).katex;
      if (!K) return;
      const r = (id: string, tex: string) => {
        const el = document.getElementById(id);
        if (el) K.render(tex, el, { displayMode: true, throwOnError: false });
      };
      r('eq-my-formula', 'P(A \\mid B) = \\frac{P(A \\cap B)}{P(B)}');
    }, 300); // 300ms delay ensures KaTeX CDN script has loaded
  });
</script>

<!-- In template: -->
<div class="math-block"><span id="eq-my-formula"></span></div>
```

### D3 rendering pattern (D3 is window.d3, NOT an import)

```svelte
<script lang="ts">
  let chartDiv: HTMLDivElement;
  onMount(() => {
    const d3 = (window as any).d3;
    const W = chartDiv.offsetWidth, H = 250;
    const svg = d3.select(chartDiv).append('svg').attr('width', W).attr('height', H);
    // ... build chart
  });
</script>
<div bind:this={chartDiv} style="width:100%;"></div>
```

### CSS conventions
- Use CSS custom properties exclusively: `var(--accent)`, `var(--surface)`, `var(--text2)`, etc.
- Never hardcode colors. All vars are in `src/app.css`.
- Use `var(--font-heading)` for h1-h4, `var(--font-body)` for prose, `var(--font-mono)` for numbers/code.
- Simulation containers: wrap in `<div class="sim-container">` with `<div class="sim-header">` inside.

### Svelte 5 rules
- This project uses Svelte 5. Use `$state()`, `$derived()`, `$effect()` runes OR Svelte 4 compatibility syntax (`let x = ...`, `$: derived = ...`). Pick one style per file.
- **No duplicate `<script>` blocks.** One `<script lang="ts">` per component, max.
- `import { onMount }` goes inside the single script block.
- `<style>` goes at the bottom, one per component.

### WASM (not yet implemented — skip for now)
- The rust-sci-core WASM pipeline is planned but not built yet.
- Use pure JavaScript math for all simulations currently.
- Mark computationally heavy functions with `// TODO: replace with WASM` comment.

---

## 6. v1 Legacy Module Reference

When wrapping a v1 module with `<LegacyModule>`, use these exact module IDs:

| Module ID | Topic | Chapter |
|-----------|-------|---------|
| `1.1-sigma-algebra` | σ-algebra explorer | Ch 12 |
| `1.2-measure-random-vars` | Measure & random variables | Ch 12 |
| `1.3-lebesgue-riemann` | Lebesgue vs Riemann | Ch 12 |
| `1.4-cantor-set` | Cantor set | Ch 12 |
| `2.1-convergence-modes` | Convergence type comparator | Ch 13 |
| `2.2-borel-cantelli` | Borel-Cantelli lab | Ch 13 |
| `2.3-lln-lab` | LLN laboratory | Ch 10 |
| `2.4-clt-studio` | CLT studio | Ch 10 |
| `3.1-characteristic-functions` | Characteristic functions | Ch 7 |
| `3.2-convolution-cfs` | Convolution via CFs | Ch 7 |
| `4.1-conditional-expectation` | Conditional expectation | Ch 9 |
| `4.2-martingale-explorer` | Martingale explorer | Ch 14 |
| `5.1-donsker` | Donsker's theorem | Ch 13 |
| `5.2-brownian-properties` | Brownian motion properties | Ch 15 |
| `6.1-markov-dashboard` | Markov chain dashboard | Ch 11 |
| `6.2-ergodic-mixing` | Ergodic mixing | Ch 18 |
| `7.1-ito-integral` | Itô integral | Ch 16 |
| `7.2-sde-solver` | SDE solver | Ch 16 |
| `8.1-prior-posterior` | Prior to posterior | Ch 20 |
| `8.2-mcmc-explorer` | MCMC explorer | Ch 27 |
| `9.1-entropy-kl` | Entropy & KL divergence | Ch 19 |
| `9.2-mutual-information` | Mutual information | Ch 19 |

---

## 7. Math Content Reference

### Distributions to implement for Part I

| Chapter | Distributions | Key formulas |
|---------|--------------|--------------|
| Ch 4 | Bernoulli, Binomial, Geometric, Neg. Binomial, Hypergeometric, Poisson | PMF, E[X], Var(X) |
| Ch 5 | Uniform, Exponential, Normal, Gamma, Beta | PDF, CDF via integration |
| Ch 6 | Bivariate Normal | ρ parameter, marginals, conditionals |

### JavaScript math utilities you can copy into any chapter

```typescript
// Factorial (n ≤ 20 exact, n > 20 use Stirling)
function fact(n: number): number {
  let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
}

// Binomial coefficient C(n,k)
function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let r = 1;
  for (let i = 0; i < Math.min(k, n-k); i++) {
    r = r * (n - i) / (i + 1);
  }
  return Math.round(r);
}

// Normal PDF
function normalPdf(x: number, mu = 0, sigma = 1): number {
  return Math.exp(-0.5 * ((x-mu)/sigma)**2) / (sigma * Math.sqrt(2*Math.PI));
}

// Normal CDF (Abramowitz & Stegun approximation, error < 7.5e-8)
function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x*x/2);
  const p = d*t*(0.3193815 + t*(-0.3565638 + t*(1.7814779 + t*(-1.8212560 + t*1.3302744))));
  return x > 0 ? 1 - p : p;
}

// Poisson PMF
function poissonPmf(k: number, lambda: number): number {
  if (lambda === 0) return k === 0 ? 1 : 0;
  let log_p = k * Math.log(lambda) - lambda;
  for (let i = 1; i <= k; i++) log_p -= Math.log(i);
  return Math.exp(log_p);
}

// Binomial PMF
function binomialPmf(k: number, n: number, p: number): number {
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === n ? 1 : 0;
  return binom(n, k) * Math.pow(p, k) * Math.pow(1-p, n-k);
}

// Gamma function (Lanczos approximation)
function gamma(z: number): number {
  const g = 7, c = [0.99999999999980993,676.5203681218851,-1259.1392167224028,
    771.32342877765313,-176.61502916214059,12.507343278686905,
    -0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI*z) * gamma(1-z));
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g+2; i++) x += c[i]/(z+i);
  const t = z + g + 0.5;
  return Math.sqrt(2*Math.PI) * Math.pow(t, z+0.5) * Math.exp(-t) * x;
}

// Exponential PDF/CDF
function expPdf(x: number, lambda: number): number { return x < 0 ? 0 : lambda * Math.exp(-lambda*x); }
function expCdf(x: number, lambda: number): number { return x < 0 ? 0 : 1 - Math.exp(-lambda*x); }
```

---

## 8. Git Workflow

```bash
# Always work from the repo root for git commands
cd /path/to/Probability-education  # NOT from app/

# Standard commit after completing a chapter:
git add app/
git commit -m "feat(ch-N): Chapter N title — description of what was built"
git push origin main

# NEVER modify these files:
# - src/  (v1 modules — read only)
# - index.html (v1 landing page)
# - vite.config.js (v1 Vite config)
# - package.json (root — v1 deps)
# - css/, js/ (v1 stylesheets)
```

**GitHub PAT:** stored in your memory. Repo scope. Use for git push via HTTPS.

---

## 9. Testing Your Work

```bash
cd app

# Build check (must pass before committing)
npm run build

# Type check
npm run check

# Preview production build
npm run preview   # http://localhost:4173

# Quick sanity checks to run after each chapter:
# 1. npm run build  — zero errors
# 2. Open chapter in browser, check no console errors
# 3. Verify D3 simulation renders (not blank)
# 4. Verify KaTeX formulas render (not raw LaTeX strings)
# 5. Verify prev/next navigation works
```

---

## 10. File to Read Next

After this file, read `agent-tasks.json` in the repo root. It contains the complete machine-readable task queue with exact specifications for what to build next, in priority order.

Then read `build-prompts/probability_textbook_build_prompts.json` for the detailed per-chapter simulation specifications.

Then start coding. Begin with `app/src/routes/part-1/chapter-4/+page.svelte`.
