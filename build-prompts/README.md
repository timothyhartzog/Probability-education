# Probability Textbook — Build Prompt Manifest

> Claude Code build instructions for the **SvelteKit 2 + rust-sci-core (WASM) + D3.js 7.8.5** rebuild of the Probability Education Platform.

## Overview

`probability_textbook_build_prompts.json` contains **98 structured prompts** across **8 phases** that guide Claude Code in building a fully interactive probability textbook — from high school coin flips to graduate-level stochastic calculus.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | SvelteKit 2 + adapter-static (PWA) |
| Scientific Computing | rust-sci-core (WASM) — `timothyhartzog/rust-sci-core` |
| Visualization | D3.js 7.8.5 (cdnjs) |
| Math Rendering | KaTeX 0.16.x (cdnjs) |
| Styling | Hartzog Web Standard v1.0 |
| Testing | Vitest + Playwright |
| Deployment | GitHub Pages via GitHub Actions |

## Phase Summary

| Phase | Title | Prompts |
|-------|-------|---------|
| 1 | Project Scaffolding & Infrastructure | 8 |
| 2 | Part I — Foundations (Ch. 1–6) | 6 |
| 3 | Part II — Intermediate (Ch. 7–11) | 5 |
| 4 | Part III — Advanced Undergrad (Ch. 12–15) | 4 |
| 5 | Part IV — Graduate (Ch. 16–22) | 7 |
| 6 | Part V — Research Frontiers (Ch. 23–28) | 6 |
| 7 | Appendices & Reference | 4 |
| 8 | Cross-Cutting Features & Polish | 8 |
| **Total** | | **48 chapter/feature prompts** |

> Plus sub-prompts: 98 total discrete build units.

## How to Use

### 1. Open Claude Code in this repository root

```bash
cd /path/to/Probability-education
# Open Claude Code (claude.ai/code or CLI)
```

### 2. Execute Phase 1 first (critical foundation)

Feed each `P1-XX` prompt to Claude Code in order:

```
P1-01 → SvelteKit 2 Project Init
P1-02 → rust-sci-core WASM Build Pipeline  
P1-03 → Shared D3.js Utility Library
P1-04 → KaTeX Math Rendering Component
P1-05 → Global Layout and Navigation
P1-06 → Home Page and Chapter Index
P1-07 → GitHub Actions CI/CD
P1-08 → Shared Types and Chapter Data Registry
```

### 3. Verify the scaffold

```bash
npm run build:wasm    # compile rust-sci-core → static/wasm/
npm run dev           # launch dev server at localhost:5173
```

### 4. Execute chapter phases (2–6) in any order

Chapter prompts within each phase are **independent** — run them in parallel across multiple Claude Code sessions for speed.

### 5. Execute Phase 8 last

Cross-cutting features (search, PWA, accessibility, performance) assume all chapter routes exist.

## Prompt Format

Each prompt object contains:

```json
{
  "id": "P2-04",
  "title": "Chapter 4 — Discrete Random Variables",
  "difficulty_level": "high-school",
  "wasm_modules": ["sci-stats: binomial_pmf, ..."],
  "depends_on": ["P1-02", "P2-01"],
  "prompt": "Full Claude Code instruction..."
}
```

## Route Map

```
/                           Home — chapter grid, hero animation
/part-1/chapter-1           What Is Probability?
/part-1/chapter-2           Counting and Combinatorics
/part-1/chapter-3           Conditional Probability
/part-1/chapter-4           Discrete Random Variables
/part-1/chapter-5           Continuous Random Variables
/part-1/chapter-6           Joint Distributions (Intro)
/part-2/chapter-7           Transforms and Generating Functions
/part-2/chapter-8           Multivariate Distributions
/part-2/chapter-9           Conditional Expectation
/part-2/chapter-10          Limit Theorems
/part-2/chapter-11          Intro to Stochastic Processes
/part-3/chapter-12          Measure-Theoretic Probability
/part-3/chapter-13          Advanced Limit Theorems
/part-3/chapter-14          Martingales
/part-3/chapter-15          Continuous-Time Processes
/part-4/chapter-16          Stochastic Calculus
/part-4/chapter-17          Markov Processes and Potential Theory
/part-4/chapter-18          Ergodic Theory
/part-4/chapter-19          Information Theory and Probability
/part-4/chapter-20          Bayesian Nonparametrics
/part-4/chapter-21          Random Matrices
/part-4/chapter-22          Probabilistic Combinatorics
/part-5/chapter-23          Stochastic Analysis on Manifolds
/part-5/chapter-24          Interacting Particle Systems
/part-5/chapter-25          Optimal Transport
/part-5/chapter-26          High-Dimensional Probability
/part-5/chapter-27          MCMC and Computational Probability
/part-5/chapter-28          Probabilistic Graphical Models
/appendix/distributions      Distribution Reference Table
/appendix/inequalities       Inequalities Compendium
/appendix/measure-theory     Real Analysis & Measure Theory
/appendix/notation           Notation Glossary
/appendix/solutions          Hints and Selected Solutions
/appendix/bibliography       Annotated Bibliography
```

## Simulations by Chapter

| Chapter | Key Simulations | WASM? |
|---------|----------------|-------|
| Ch 1 | Coin flip frequentist, Venn diagram, Kolmogorov axiom checker | No |
| Ch 2 | Permutation tree, Pascal's Triangle, inclusion-exclusion animator | No |
| Ch 3 | Bayes natural frequency, Monty Hall, Birthday paradox | No |
| Ch 4 | PMF explorer (6 distributions), CLT preview | Yes |
| Ch 5 | PDF integrator, Normal explorer, Gamma family | Yes |
| Ch 6 | Joint PMF heatmap, Bivariate Normal contours | Yes |
| Ch 7 | MGF explorer, Moment recovery, Cumulant dashboard | Yes |
| Ch 8 | Multinomial, Multivariate Normal, Order statistics, Convolution | Yes |
| Ch 9 | Conditional expectation, Tower property, Eve's Law | Yes |
| Ch 10 | LLN/CLT simulator, Concentration inequality comparison | Yes |
| Ch 11 | Markov chain editor, Gambler's ruin, Poisson process | Yes |
| Ch 12 | σ-algebra builder, Lebesgue integral approximator | No |
| Ch 13 | Borel-Cantelli, Weak convergence, Large deviations | Yes |
| Ch 14 | Martingale paths, Optional stopping, Azuma-Hoeffding | Yes |
| Ch 15 | Brownian motion, OU process, Gaussian process | Yes |
| Ch 16 | Itô integral, GBM, Girsanov, Feynman-Kac | Yes |
| Ch 17 | Lévy process, Lévy-Itô decomposition, Ising model | Yes |
| Ch 18 | Birkhoff ergodic, Baker's map mixing, KS entropy | Yes |
| Ch 19 | Shannon entropy, KL divergence, Mutual information, Fisher info | Yes |
| Ch 20 | Dirichlet process, GP regression, Bernstein-von Mises | Yes |
| Ch 21 | Wigner semicircle, Marchenko-Pastur, Tracy-Widom | Yes |
| Ch 22 | Erdős-Rényi phase transition, Lovász LLL, Talagrand | Yes |
| Ch 23 | BM on sphere, Rough path signature, Malliavin derivative | Yes |
| Ch 24 | Voter model, Contact process, TASEP | Yes |
| Ch 25 | Monge transport, Sinkhorn algorithm, Wasserstein barycenters | Yes |
| Ch 26 | Concentration on sphere, JL lemma, VC dimension, compressed sensing | Yes |
| Ch 27 | MH sampler, Gibbs, HMC, mixing time, particle filter | Yes |
| Ch 28 | Bayesian network builder, BP animator, EM algorithm, causal DAG | Yes |

---

*Generated 2026-04-03 | Probability Education Platform v2.0*
*rust-sci-core: timothyhartzog/rust-sci-core | D3.js 7.8.5 | SvelteKit 2*
