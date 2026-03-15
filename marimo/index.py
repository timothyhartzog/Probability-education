import marimo

app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    return (mo,)


@app.cell
def _(mo):
    mo.md(
        r"""
    # Interactive Probability Education

    **A graduate-level exploration of probability theory, stochastic processes, and applications.**

    This collection of interactive Marimo notebooks covers 35 modules across 12 chapters,
    from measure-theoretic foundations to applied medical quality statistics. Each notebook
    features reactive visualizations, interactive controls, and rigorous mathematical exposition.

    ---

    ## Chapter 1: Foundations — Measure Theory & Probability

    *The mathematical bedrock: sigma-algebras, measures, and the Lebesgue integral.*

    | Module | Topic | Description |
    |--------|-------|-------------|
    | 1.1 | **Sigma-Algebra Explorer** | Build sigma-algebras from generators, visualize closure operations and the lattice of all sigma-algebras |
    | 1.2 | **Measure Construction & Random Variables** | Probability measures on finite spaces, random variables as measurable functions, pushforward measures |
    | 1.3 | **Lebesgue vs. Riemann Integration** | Side-by-side comparison of domain partitioning (Riemann) vs. range partitioning (Lebesgue) |
    | 1.4 | **Cantor Set & Singular Measures** | Iterative construction, devil's staircase, Hausdorff dimension, measure decay |

    ---

    ## Chapter 2: Convergence & Limit Theorems

    *How sequences of random variables converge — and the powerful consequences.*

    | Module | Topic | Description |
    |--------|-------|-------------|
    | 2.1 | **Convergence Mode Comparator** | Compare almost sure, in probability, $L^p$, and in distribution convergence |
    | 2.2 | **Borel-Cantelli Lemmas** | Event sequences, summability conditions, and "infinitely often" |
    | 2.3 | **Law of Large Numbers Lab** | WLLN and SLLN: watch $\bar{X}_n \to \mu$ across distributions |
    | 2.4 | **Central Limit Theorem Studio** | Histogram of standardized sums converging to the Gaussian, Q-Q plots, moment tracking |

    ---

    ## Chapter 3: Characteristic Functions

    *The Fourier transform of probability — a powerful analytical tool.*

    | Module | Topic | Description |
    |--------|-------|-------------|
    | 3.1 | **Characteristic Function Gallery** | Visualize $\varphi_X(t) = E[e^{itX}]$ for common distributions |
    | 3.2 | **Convolution & CLT via CFs** | Product of CFs equals CF of sum; watch CLT emerge in Fourier space |

    ---

    ## Chapter 4: Expectation & Conditioning

    *Conditional expectation as projection, and the martingale property.*

    | Module | Topic | Description |
    |--------|-------|-------------|
    | 4.1 | **Conditional Expectation Explorer** | $E[Y \mid X]$ as projection onto $\sigma(X)$, tower property |
    | 4.2 | **Martingale Path Explorer** | Random walks, Doob martingales, optional stopping theorem |

    ---

    ## Chapter 5: Brownian Motion

    *The central object of continuous-time probability.*

    | Module | Topic | Description |
    |--------|-------|-------------|
    | 5.1 | **Donsker's Theorem** | Scaled random walk $\to$ Brownian motion as $n \to \infty$ |
    | 5.2 | **Brownian Motion Properties** | Self-similarity, quadratic variation, nowhere differentiability |

    ---

    ## Chapter 6: Markov Chains

    *Memoryless dynamics on discrete state spaces.*

    | Module | Topic | Description |
    |--------|-------|-------------|
    | 6.1 | **Markov Chain Dashboard** | Transition matrices, state diagrams, trajectory simulation, stationary distributions |
    | 6.2 | **Ergodic Theory & Mixing Times** | Convergence to stationarity, total variation distance, spectral gap |

    ---

    ## Chapter 7: Stochastic Calculus

    *Integration with respect to Brownian motion and stochastic differential equations.*

    | Module | Topic | Description |
    |--------|-------|-------------|
    | 7.1 | **Itô Integral** | Construction of $\int f \, dB$, Itô vs. Stratonovich, Itô isometry |
    | 7.2 | **SDE Solver Studio** | Euler-Maruyama and Milstein methods for GBM, OU, CIR processes |

    ---

    ## Chapter 8: Bayesian Inference

    *Updating beliefs with data — the probabilistic learning machine.*

    | Module | Topic | Description |
    |--------|-------|-------------|
    | 8.1 | **Prior-to-Posterior Machine** | Conjugate Bayesian updating: Beta-Binomial, Normal-Normal, Gamma-Poisson |
    | 8.2 | **MCMC Sampling Explorer** | Metropolis-Hastings visualization with diagnostics |

    ---

    ## Chapter 9: Information Theory

    *Quantifying uncertainty and the flow of information.*

    | Module | Topic | Description |
    |--------|-------|-------------|
    | 9.1 | **Entropy & KL Divergence** | $H(X)$, $D_{KL}(P \| Q)$, and their asymmetry |
    | 9.2 | **Mutual Information & Channel Capacity** | $I(X;Y)$, BSC/BEC channels, capacity optimization |

    ---

    ## Applied Domains

    ### Agent-Based Modeling

    | Module | Topic | Description |
    |--------|-------|-------------|
    | ABM-1 | **Agent Simulation** | Grid-based SIR agent model with emergent dynamics |
    | ABM-2 | **Predator-Prey Ecosystem** | Lotka-Volterra agent model with phase portraits |

    ### Financial Mathematics

    | Module | Topic | Description |
    |--------|-------|-------------|
    | FM-1 | **Stochastic Finance** | GBM, Black-Scholes, Monte Carlo pricing, VaR |

    ### Medical Quality & Epidemiology

    | Module | Topic | Description |
    |--------|-------|-------------|
    | MQ-1 | **SPC Control Chart** | X-bar, R, and p-charts with Western Electric rules |
    | MQ-2 | **Funnel Plot** | Hospital performance with volume-adjusted control limits |
    | MQ-3 | **CUSUM Chart** | Sequential detection of process shifts |
    | MQ-4 | **Pareto Chart** | Defect categorization and the 80/20 rule |
    | MQ-5 | **Diagnostic Testing** | Sensitivity, specificity, ROC curves, Bayes' theorem |
    | MQ-6 | **Meta-Analysis** | Forest plots, heterogeneity, publication bias |
    | MQ-7 | **Clinical Statistics** | Power analysis and sample size calculation |
    | MQ-8 | **Disease Modeling** | SIR/SEIR compartmental models, $R_0$, herd immunity |
    | MQ-9 | **Evidence-Based Medicine** | NNT, likelihood ratios, levels of evidence |
    | MQ-10 | **Vaccine Impact Simulator** | Vaccination effects on outbreak dynamics |

    ---

    ### Getting Started

    ```bash
    # Install dependencies
    pip install marimo numpy scipy plotly matplotlib

    # Run any notebook
    marimo run 02_convergence/04_clt_studio.py

    # Or edit interactively
    marimo edit 02_convergence/04_clt_studio.py
    ```
    """
    )
    return


if __name__ == "__main__":
    app.run()
