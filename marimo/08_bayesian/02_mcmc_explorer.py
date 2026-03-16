import marimo

app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import numpy as np
    import plotly.graph_objects as go
    from plotly.subplots import make_subplots
    from scipy import stats
    import sys
    sys.path.insert(0, "..")
    from shared.plotting import VIZ_COLORS, DEFAULT_LAYOUT, styled_figure, styled_subplots
    return mo, np, go, make_subplots, stats, VIZ_COLORS, DEFAULT_LAYOUT, styled_figure, styled_subplots


@app.cell
def _(mo):
    mo.md(r"""
    # 8.2 MCMC Sampling Explorer

    **Markov Chain Monte Carlo (MCMC)** generates samples from complex target distributions
    $\pi(x)$ that may be known only up to a normalizing constant.

    The **Metropolis-Hastings** algorithm:

    1. Start at $x_0$. At step $t$, propose $y \sim q(y \mid x_t)$
    2. Compute acceptance ratio: $\alpha = \min\!\left(1,\; \dfrac{\pi(y)\,q(x_t \mid y)}{\pi(x_t)\,q(y \mid x_t)}\right)$
    3. Accept ($x_{t+1} = y$) with probability $\alpha$; otherwise $x_{t+1} = x_t$

    With a **symmetric** proposal $q(y \mid x) = q(x \mid y)$, this simplifies to
    the **Metropolis** algorithm: $\alpha = \min\!\bigl(1,\; \pi(y)/\pi(x_t)\bigr)$.
    """)
    return


@app.cell
def _(mo):
    target_dropdown = mo.ui.dropdown(
        options={
            "Mixture of Normals": "mixture",
            "Banana-Shaped": "banana",
            "Multimodal (5 peaks)": "multimodal",
        },
        value="mixture",
        label="Target distribution",
    )
    proposal_sd_slider = mo.ui.slider(
        start=0.1, stop=5.0, step=0.1, value=1.0, label="Proposal σ"
    )
    n_samples_slider = mo.ui.slider(
        start=500, stop=10000, step=500, value=5000, label="Number of samples"
    )
    burn_in_slider = mo.ui.slider(
        start=0, stop=2000, step=100, value=500, label="Burn-in"
    )
    seed_slider = mo.ui.slider(
        start=0, stop=100, step=1, value=42, label="Seed"
    )
    row1 = mo.hstack([target_dropdown, proposal_sd_slider, n_samples_slider], wrap=True)
    row2 = mo.hstack([burn_in_slider, seed_slider], wrap=True)
    mo.md(f"## Controls\n\n{row1}\n\n{row2}")
    return target_dropdown, proposal_sd_slider, n_samples_slider, burn_in_slider, seed_slider


@app.cell
def _(np, stats, target_dropdown, proposal_sd_slider, n_samples_slider,
      burn_in_slider, seed_slider):
    target_type = target_dropdown.value
    prop_sd = proposal_sd_slider.value
    n_samples = n_samples_slider.value
    burn_in = burn_in_slider.value
    seed = seed_slider.value
    rng = np.random.default_rng(seed)

    # Define target log-densities (1D for simplicity in visualization)
    def log_target(x, kind):
        if kind == "mixture":
            # Mixture of 3 normals
            p = (0.3 * stats.norm.pdf(x, -3, 0.8)
                 + 0.4 * stats.norm.pdf(x, 1, 1.2)
                 + 0.3 * stats.norm.pdf(x, 5, 0.6))
            return np.log(p + 1e-300)
        elif kind == "banana":
            # Banana-shaped in 1D approximation (skewed heavy-tailed)
            return -0.5 * ((x - 2) ** 2 / 4 + ((x - 2) ** 2 - 4) ** 2 / 8)
        else:  # multimodal
            p = sum(0.2 * stats.norm.pdf(x, mu, 0.5) for mu in [-4, -1.5, 1, 3.5, 6])
            return np.log(p + 1e-300)

    # Metropolis-Hastings sampling
    samples = np.zeros(n_samples)
    samples[0] = 0.0
    accepted = np.zeros(n_samples, dtype=bool)
    proposals = np.zeros(n_samples)

    for t in range(1, n_samples):
        proposal = samples[t - 1] + rng.normal(0, prop_sd)
        proposals[t] = proposal
        log_alpha = log_target(proposal, target_type) - log_target(samples[t - 1], target_type)
        if np.log(rng.uniform()) < log_alpha:
            samples[t] = proposal
            accepted[t] = True
        else:
            samples[t] = samples[t - 1]
            accepted[t] = False

    post_burn = samples[burn_in:]
    acceptance_rate = np.mean(accepted[burn_in:])
    return (samples, accepted, proposals, post_burn, acceptance_rate,
            target_type, prop_sd, n_samples, burn_in, log_target)


@app.cell
def _(go, np, stats, VIZ_COLORS, DEFAULT_LAYOUT, samples, post_burn,
      accepted, target_type, acceptance_rate, n_samples, burn_in,
      log_target, styled_subplots):
    fig = styled_subplots(
        rows=2, cols=2,
        titles=["Trace Plot", "Histogram vs Target",
                "First 200 Steps (Accept/Reject)", "Autocorrelation"],
        height=700,
    )

    # Trace plot
    fig.add_trace(go.Scatter(
        x=np.arange(n_samples), y=samples, mode='lines',
        line=dict(color=VIZ_COLORS[0], width=0.5),
        name='Chain', showlegend=False,
    ), row=1, col=1)
    if burn_in > 0:
        fig.add_vrect(x0=0, x1=burn_in, fillcolor="red", opacity=0.08,
                      annotation_text="burn-in", row=1, col=1)

    # Histogram vs target density
    fig.add_trace(go.Histogram(
        x=post_burn, nbinsx=60, histnorm='probability density',
        marker_color=VIZ_COLORS[0], opacity=0.6, name='MCMC samples',
        showlegend=False,
    ), row=1, col=2)
    x_range = np.linspace(post_burn.min() - 1, post_burn.max() + 1, 500)
    target_pdf = np.exp(np.array([log_target(xi, target_type) for xi in x_range]))
    # Normalize
    dx = x_range[1] - x_range[0]
    target_pdf = target_pdf / (np.sum(target_pdf) * dx)
    fig.add_trace(go.Scatter(
        x=x_range, y=target_pdf, mode='lines',
        name='Target', line=dict(color=VIZ_COLORS[1], width=2.5),
        showlegend=False,
    ), row=1, col=2)

    # Accept/reject visualization (first 200 post-burn steps)
    n_show = min(200, len(post_burn))
    idx_start = burn_in
    for i in range(n_show):
        t = idx_start + i
        color = VIZ_COLORS[2] if accepted[t] else VIZ_COLORS[4]
        fig.add_trace(go.Scatter(
            x=[i], y=[samples[t]], mode='markers',
            marker=dict(color=color, size=3),
            showlegend=False,
        ), row=2, col=1)

    # Autocorrelation
    max_lag = min(200, len(post_burn) - 1)
    centered = post_burn - np.mean(post_burn)
    var = np.var(post_burn)
    acf = np.array([np.mean(centered[:len(centered) - lag] * centered[lag:]) / (var + 1e-30)
                     for lag in range(max_lag)])
    fig.add_trace(go.Bar(
        x=np.arange(max_lag), y=acf,
        marker_color=VIZ_COLORS[5], name='ACF', showlegend=False,
    ), row=2, col=2)
    fig.add_hline(y=0, line=dict(color='black', width=0.5), row=2, col=2)

    fig.update_xaxes(title_text="Iteration", row=1, col=1)
    fig.update_xaxes(title_text="x", row=1, col=2)
    fig.update_xaxes(title_text="Step", row=2, col=1)
    fig.update_xaxes(title_text="Lag", row=2, col=2)
    fig.update_yaxes(title_text="x", row=1, col=1)
    fig.update_yaxes(title_text="Density", row=1, col=2)
    fig.update_yaxes(title_text="x", row=2, col=1)
    fig.update_yaxes(title_text="Autocorrelation", row=2, col=2)
    fig
    return


@app.cell
def _(mo, np, acceptance_rate, post_burn):
    # Effective sample size estimation
    n_post = len(post_burn)
    centered = post_burn - np.mean(post_burn)
    var = np.var(post_burn)
    # Compute autocorrelation sum for ESS
    max_lag_ess = min(500, n_post - 1)
    acf_vals = np.array([np.mean(centered[:n_post - lag] * centered[lag:]) / (var + 1e-30)
                          for lag in range(max_lag_ess)])
    # Truncate at first negative pair (Geyer's method, simplified)
    tau = 1.0
    for lag in range(1, max_lag_ess):
        if acf_vals[lag] < 0:
            break
        tau += 2 * acf_vals[lag]
    ess = n_post / tau

    mo.md(rf"""
    ## Diagnostics

    | Metric | Value |
    |--------|-------|
    | **Acceptance rate** | {acceptance_rate:.1%} |
    | **Post-burn-in samples** | {n_post:,} |
    | **Effective sample size (ESS)** | {ess:.0f} |
    | **Efficiency (ESS/n)** | {ess/n_post:.1%} |
    | **Sample mean** | {np.mean(post_burn):.3f} |
    | **Sample std** | {np.std(post_burn):.3f} |

    ### Tuning Guidelines

    - **Acceptance rate ≈ 23–44%** is optimal for most target distributions
    - Too high → proposal σ too small → slow exploration (high autocorrelation)
    - Too low → proposal σ too large → many rejections (chain gets stuck)
    - **ESS/n** measures sampling efficiency; closer to 1 is better
    """)
    return


@app.cell
def _(mo):
    mo.md(r"""
    ### How Metropolis-Hastings Works

    The algorithm constructs a **Markov chain** whose stationary distribution is the target $\pi$.

    Key properties:
    - **Detailed balance**: $\pi(x) P(x \to y) = \pi(y) P(y \to x)$ ensures reversibility
    - **Ergodicity**: under mild conditions, the chain explores the full support
    - The normalizing constant of $\pi$ **cancels** in the acceptance ratio — we only need $\pi$ up to proportionality

    Color coding in the accept/reject plot:
    - <span style="color:#059669">**Green**</span> = accepted proposals
    - <span style="color:#db2777">**Pink**</span> = rejected proposals (chain stays at current value)

    ---
    *Module 8.2 — MCMC Sampling Explorer*
    *Probability Education Platform*
    """)
    return


if __name__ == "__main__":
    app.run()
