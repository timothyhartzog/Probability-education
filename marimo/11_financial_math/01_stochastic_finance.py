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
    from shared.plotting import VIZ_COLORS, DEFAULT_LAYOUT, styled_figure
    return mo, np, go, make_subplots, stats, VIZ_COLORS, DEFAULT_LAYOUT, styled_figure


@app.cell
def _(mo):
    mo.md(r"""
    # 11.1 Stochastic Finance Modeling

    This notebook explores three pillars of quantitative finance through the lens of
    stochastic processes:

    1. **Geometric Brownian Motion (GBM)** -- the standard model for stock prices
    2. **Black-Scholes Option Pricing** -- closed-form and Monte Carlo approaches
    3. **Value at Risk (VaR)** -- portfolio risk measurement

    ## Geometric Brownian Motion

    Under GBM the stock price $S(t)$ satisfies the SDE:

    $$dS = \mu S \, dt + \sigma S \, dB_t$$

    whose exact solution is:

    $$S(t) = S_0 \exp\!\left[\left(\mu - \tfrac{\sigma^2}{2}\right)t + \sigma B_t\right]$$

    where $B_t$ is a standard Brownian motion, $\mu$ is the drift (expected return),
    and $\sigma$ is the volatility.
    """)
    return


@app.cell
def _(mo):
    S0_slider = mo.ui.slider(start=50, stop=200, step=5, value=100, label="S₀ (initial price)")
    mu_slider = mo.ui.slider(start=-0.2, stop=0.4, step=0.02, value=0.08, label="μ (drift)")
    sigma_slider = mo.ui.slider(start=0.05, stop=0.8, step=0.05, value=0.2, label="σ (volatility)")
    T_slider = mo.ui.slider(start=0.25, stop=3.0, step=0.25, value=1.0, label="T (years)")
    K_slider = mo.ui.slider(start=50, stop=200, step=5, value=105, label="K (strike price)")
    r_slider = mo.ui.slider(start=0.0, stop=0.1, step=0.005, value=0.05, label="r (risk-free rate)")
    n_paths_slider = mo.ui.slider(start=100, stop=5000, step=100, value=1000, label="Monte Carlo paths")
    seed_slider = mo.ui.slider(start=0, stop=99, step=1, value=42, label="Random seed")

    controls = mo.hstack(
        [S0_slider, mu_slider, sigma_slider, T_slider,
         K_slider, r_slider, n_paths_slider, seed_slider],
        wrap=True,
    )
    mo.md(f"**Parameters:** {controls}")
    return (S0_slider, mu_slider, sigma_slider, T_slider, K_slider,
            r_slider, n_paths_slider, seed_slider)


@app.cell
def _(np, S0_slider, mu_slider, sigma_slider, T_slider, r_slider,
      K_slider, n_paths_slider, seed_slider):
    # --- Simulate GBM paths ---
    S0 = S0_slider.value
    mu = mu_slider.value
    sigma = sigma_slider.value
    T = T_slider.value
    r = r_slider.value
    K = K_slider.value
    n_paths = n_paths_slider.value
    rng = np.random.default_rng(seed_slider.value)

    n_steps = 252  # daily steps
    dt = T / n_steps
    t_grid = np.linspace(0, T, n_steps + 1)

    # Generate paths under physical measure (drift mu)
    Z = rng.standard_normal((n_paths, n_steps))
    log_increments = (mu - 0.5 * sigma**2) * dt + sigma * np.sqrt(dt) * Z
    log_paths = np.zeros((n_paths, n_steps + 1))
    log_paths[:, 0] = np.log(S0)
    log_paths[:, 1:] = np.log(S0) + np.cumsum(log_increments, axis=1)
    S_paths = np.exp(log_paths)

    # Generate paths under risk-neutral measure (drift r) for MC pricing
    Z_rn = rng.standard_normal((n_paths, n_steps))
    log_inc_rn = (r - 0.5 * sigma**2) * dt + sigma * np.sqrt(dt) * Z_rn
    log_paths_rn = np.zeros((n_paths, n_steps + 1))
    log_paths_rn[:, 0] = np.log(S0)
    log_paths_rn[:, 1:] = np.log(S0) + np.cumsum(log_inc_rn, axis=1)
    S_paths_rn = np.exp(log_paths_rn)

    S_terminal = S_paths[:, -1]
    S_terminal_rn = S_paths_rn[:, -1]

    gbm_data = dict(
        S_paths=S_paths, S_terminal=S_terminal,
        S_paths_rn=S_paths_rn, S_terminal_rn=S_terminal_rn,
        t_grid=t_grid, S0=S0, mu=mu, sigma=sigma, T=T, r=r, K=K,
        n_paths=n_paths, dt=dt,
    )
    return gbm_data, rng


@app.cell
def _(mo):
    mo.md(r"""
    ## GBM Sample Paths

    Below are simulated stock price trajectories. The shaded band shows the
    theoretical mean $\pm$ 2 standard deviations:

    $$\mathbb{E}[S(t)] = S_0 e^{\mu t}, \quad \text{Std}[S(t)] = S_0 e^{\mu t}\sqrt{e^{\sigma^2 t} - 1}$$
    """)
    return


@app.cell
def _(go, np, gbm_data, VIZ_COLORS, DEFAULT_LAYOUT):
    _d = gbm_data
    _t = _d["t_grid"]
    _paths = _d["S_paths"]
    _n_show = min(50, _d["n_paths"])

    fig_gbm = go.Figure()

    # Plot a subset of paths
    for i in range(_n_show):
        fig_gbm.add_trace(go.Scatter(
            x=_t, y=_paths[i], mode="lines",
            line=dict(color=VIZ_COLORS[0], width=0.6),
            opacity=0.3, showlegend=False,
        ))

    # Theoretical mean and band
    mean_t = _d["S0"] * np.exp(_d["mu"] * _t)
    std_t = mean_t * np.sqrt(np.exp(_d["sigma"]**2 * _t) - 1)
    fig_gbm.add_trace(go.Scatter(
        x=_t, y=mean_t, mode="lines", name="E[S(t)]",
        line=dict(color=VIZ_COLORS[1], width=2.5),
    ))
    fig_gbm.add_trace(go.Scatter(
        x=np.concatenate([_t, _t[::-1]]),
        y=np.concatenate([mean_t + 2 * std_t, (mean_t - 2 * std_t)[::-1]]),
        fill="toself", fillcolor="rgba(233,115,25,0.15)",
        line=dict(width=0), showlegend=False,
    ))

    fig_gbm.update_layout(
        **DEFAULT_LAYOUT, height=420,
        title=f"GBM Paths (S₀={_d['S0']}, μ={_d['mu']}, σ={_d['sigma']})",
        xaxis_title="Time (years)", yaxis_title="Price",
    )
    fig_gbm
    return fig_gbm,


@app.cell
def _(mo):
    mo.md(r"""
    ## Black-Scholes Option Pricing

    The **Black-Scholes formula** for a European call option is:

    $$C = S_0 \, N(d_1) - K e^{-rT} N(d_2)$$

    where

    $$d_1 = \frac{\ln(S_0/K) + (r + \sigma^2/2)T}{\sigma\sqrt{T}}, \qquad d_2 = d_1 - \sigma\sqrt{T}$$

    and $N(\cdot)$ is the standard normal CDF. We compare this with a **Monte Carlo estimate**
    obtained by simulating risk-neutral paths and computing:

    $$\hat{C}_{\text{MC}} = e^{-rT} \frac{1}{n} \sum_{i=1}^{n} \max(S_T^{(i)} - K, 0)$$
    """)
    return


@app.cell
def _(np, stats, gbm_data):
    _d = gbm_data

    # Black-Scholes closed-form
    d1 = (np.log(_d["S0"] / _d["K"]) + (_d["r"] + 0.5 * _d["sigma"]**2) * _d["T"]) / (
        _d["sigma"] * np.sqrt(_d["T"])
    )
    d2 = d1 - _d["sigma"] * np.sqrt(_d["T"])
    bs_call = _d["S0"] * stats.norm.cdf(d1) - _d["K"] * np.exp(-_d["r"] * _d["T"]) * stats.norm.cdf(d2)
    bs_put = _d["K"] * np.exp(-_d["r"] * _d["T"]) * stats.norm.cdf(-d2) - _d["S0"] * stats.norm.cdf(-d1)

    # Monte Carlo pricing (risk-neutral paths)
    call_payoffs = np.maximum(_d["S_terminal_rn"] - _d["K"], 0)
    discount = np.exp(-_d["r"] * _d["T"])
    mc_call = discount * np.mean(call_payoffs)
    mc_call_se = discount * np.std(call_payoffs) / np.sqrt(_d["n_paths"])
    mc_call_ci = (mc_call - 1.96 * mc_call_se, mc_call + 1.96 * mc_call_se)

    put_payoffs = np.maximum(_d["K"] - _d["S_terminal_rn"], 0)
    mc_put = discount * np.mean(put_payoffs)
    mc_put_se = discount * np.std(put_payoffs) / np.sqrt(_d["n_paths"])

    pricing = dict(
        bs_call=bs_call, bs_put=bs_put, d1=d1, d2=d2,
        mc_call=mc_call, mc_call_se=mc_call_se, mc_call_ci=mc_call_ci,
        mc_put=mc_put, mc_put_se=mc_put_se,
        call_payoffs=call_payoffs, put_payoffs=put_payoffs,
    )
    return pricing,


@app.cell
def _(mo, gbm_data, pricing):
    _d = gbm_data
    _p = pricing
    mo.md(f"""
    ### Pricing Results

    | Method | Call Price | Put Price |
    |--------|-----------|-----------|
    | **Black-Scholes** | {_p['bs_call']:.4f} | {_p['bs_put']:.4f} |
    | **Monte Carlo** ({_d['n_paths']} paths) | {_p['mc_call']:.4f} +/- {_p['mc_call_se']:.4f} | {_p['mc_put']:.4f} +/- {_p['mc_put_se']:.4f} |

    MC 95% CI for call: [{_p['mc_call_ci'][0]:.4f}, {_p['mc_call_ci'][1]:.4f}]

    Parameters: $S_0 = {_d['S0']}$, $K = {_d['K']}$, $r = {_d['r']}$,
    $\\sigma = {_d['sigma']}$, $T = {_d['T']}$ yr
    """)
    return


@app.cell
def _(mo):
    mo.md("## Option Payoff Diagram & Terminal Price Distribution")
    return


@app.cell
def _(go, np, make_subplots, gbm_data, pricing, VIZ_COLORS, DEFAULT_LAYOUT):
    _d = gbm_data
    _p = pricing

    fig_opt = make_subplots(
        rows=1, cols=2,
        subplot_titles=["Call Payoff at Expiry", "Terminal Price Distribution"],
    )

    # --- Payoff diagram ---
    _s_range = np.linspace(_d["S0"] * 0.5, _d["S0"] * 1.8, 200)
    _call_payoff = np.maximum(_s_range - _d["K"], 0)
    _call_profit = _call_payoff - _p["bs_call"]

    fig_opt.add_trace(go.Scatter(
        x=_s_range, y=_call_payoff, mode="lines", name="Payoff",
        line=dict(color=VIZ_COLORS[0], width=2.5),
    ), row=1, col=1)
    fig_opt.add_trace(go.Scatter(
        x=_s_range, y=_call_profit, mode="lines", name="Profit",
        line=dict(color=VIZ_COLORS[2], width=2, dash="dash"),
    ), row=1, col=1)
    fig_opt.add_hline(y=0, line_dash="dot", line_color="gray", row=1, col=1)
    fig_opt.add_vline(x=_d["K"], line_dash="dot", line_color=VIZ_COLORS[7],
                      annotation_text="K", row=1, col=1)

    # --- Terminal distribution ---
    fig_opt.add_trace(go.Histogram(
        x=_d["S_terminal_rn"], nbinsx=60, name="S(T) distribution",
        marker_color=VIZ_COLORS[0], opacity=0.6,
        histnorm="probability density",
    ), row=1, col=2)

    # Log-normal theoretical PDF
    _s_plot = np.linspace(
        max(1, np.percentile(_d["S_terminal_rn"], 0.5)),
        np.percentile(_d["S_terminal_rn"], 99.5), 300,
    )
    _ln_mu = np.log(_d["S0"]) + (_d["r"] - 0.5 * _d["sigma"]**2) * _d["T"]
    _ln_sigma = _d["sigma"] * np.sqrt(_d["T"])
    _pdf = np.exp(-0.5 * ((np.log(_s_plot) - _ln_mu) / _ln_sigma)**2) / (
        _s_plot * _ln_sigma * np.sqrt(2 * np.pi)
    )
    fig_opt.add_trace(go.Scatter(
        x=_s_plot, y=_pdf, mode="lines", name="Log-normal PDF",
        line=dict(color=VIZ_COLORS[1], width=2),
    ), row=1, col=2)
    fig_opt.add_vline(x=_d["K"], line_dash="dot", line_color=VIZ_COLORS[4],
                      annotation_text="K", row=1, col=2)

    fig_opt.update_layout(**DEFAULT_LAYOUT, height=400, title="Option Analysis")
    fig_opt.update_xaxes(title_text="S(T)", row=1, col=1)
    fig_opt.update_xaxes(title_text="S(T)", row=1, col=2)
    fig_opt.update_yaxes(title_text="Payoff / Profit", row=1, col=1)
    fig_opt.update_yaxes(title_text="Density", row=1, col=2)
    fig_opt
    return fig_opt,


@app.cell
def _(mo):
    mo.md(r"""
    ## Value at Risk (VaR)

    **Value at Risk** at confidence level $\alpha$ answers: *"What is the maximum loss
    over the horizon $T$ that will not be exceeded with probability $\alpha$?"*

    For a log-normal portfolio:

    $$\text{VaR}_\alpha = S_0 \left(1 - \exp\!\left[\left(\mu - \tfrac{\sigma^2}{2}\right)T
    + \sigma\sqrt{T}\,\Phi^{-1}(1 - \alpha)\right]\right)$$

    We also compute **Conditional VaR (CVaR)** -- the expected loss given that the loss
    exceeds VaR -- using Monte Carlo:

    $$\text{CVaR}_\alpha = \mathbb{E}\!\left[-\Delta P \;\middle|\; -\Delta P \geq \text{VaR}_\alpha\right]$$
    """)
    return


@app.cell
def _(go, np, stats, gbm_data, VIZ_COLORS, DEFAULT_LAYOUT):
    _d = gbm_data
    _returns = _d["S_terminal"] / _d["S0"] - 1.0
    _losses = -_returns * _d["S0"]  # dollar losses

    # Parametric VaR
    alpha_levels = [0.90, 0.95, 0.99]
    var_results = {}
    for alpha in alpha_levels:
        z = stats.norm.ppf(1 - alpha)
        parametric_var = _d["S0"] * (
            1 - np.exp((_d["mu"] - 0.5 * _d["sigma"]**2) * _d["T"]
                       + _d["sigma"] * np.sqrt(_d["T"]) * z)
        )
        # Historical VaR from simulation
        historical_var = np.percentile(_losses, alpha * 100)
        # CVaR
        tail_losses = _losses[_losses >= historical_var]
        cvar = np.mean(tail_losses) if len(tail_losses) > 0 else historical_var
        var_results[alpha] = dict(
            parametric=parametric_var, historical=historical_var, cvar=cvar,
        )

    # Plot loss distribution with VaR lines
    fig_var = go.Figure()
    fig_var.add_trace(go.Histogram(
        x=_losses, nbinsx=80, name="P&L distribution",
        marker_color=VIZ_COLORS[0], opacity=0.6,
        histnorm="probability density",
    ))

    _colors_var = [VIZ_COLORS[1], VIZ_COLORS[4], VIZ_COLORS[3]]
    for idx, alpha in enumerate(alpha_levels):
        _v = var_results[alpha]["historical"]
        fig_var.add_vline(
            x=_v, line_dash="dash", line_color=_colors_var[idx],
            annotation_text=f"VaR {int(alpha*100)}% = {_v:.2f}",
            annotation_position="top",
        )

    fig_var.update_layout(
        **DEFAULT_LAYOUT, height=420,
        title="Portfolio Loss Distribution with VaR",
        xaxis_title="Loss ($)",
        yaxis_title="Density",
    )
    fig_var
    return fig_var, var_results


@app.cell
def _(mo, gbm_data, var_results):
    _d = gbm_data
    _rows = []
    for alpha in [0.90, 0.95, 0.99]:
        v = var_results[alpha]
        _rows.append(
            f"| {int(alpha*100)}% | {v['parametric']:.2f} | {v['historical']:.2f} | {v['cvar']:.2f} |"
        )
    _table = "\n".join(_rows)
    mo.md(f"""
    ### VaR Summary (Horizon = {_d['T']} yr, S₀ = ${_d['S0']})

    | Confidence | Parametric VaR | Historical VaR | CVaR |
    |------------|---------------|----------------|------|
    {_table}

    **Interpretation:** The 95% VaR says that with 95% confidence the portfolio loss will
    not exceed the stated amount over the investment horizon. CVaR (Expected Shortfall)
    captures the average loss in the worst {100 - 95}% of scenarios and is a **coherent
    risk measure**, unlike VaR.

    ---

    *All simulations use `numpy.random.default_rng` for reproducibility.*
    """)
    return


if __name__ == "__main__":
    app.run()
