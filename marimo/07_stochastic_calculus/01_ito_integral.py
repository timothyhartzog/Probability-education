import marimo

app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import numpy as np
    import plotly.graph_objects as go
    from plotly.subplots import make_subplots
    import sys
    sys.path.insert(0, "..")
    from shared.plotting import VIZ_COLORS, DEFAULT_LAYOUT, styled_figure, styled_subplots
    return mo, np, go, make_subplots, VIZ_COLORS, DEFAULT_LAYOUT, styled_figure, styled_subplots


@app.cell
def _(mo):
    mo.md(r"""
    # 7.1 Itô Integral & Stochastic Differentials

    The **Itô integral** extends classical integration to stochastic processes.
    For an adapted process $f(s)$ and Brownian motion $B(s)$:

    $$I(t) = \int_0^t f(s)\, dB(s)$$

    This is constructed as the $L^2$ limit of **non-anticipating** Riemann-type sums:

    $$I_n(t) = \sum_{k=0}^{n-1} f(t_k)\bigl[B(t_{k+1}) - B(t_k)\bigr]$$

    where $f$ is evaluated at the **left endpoint** $t_k$ (the adapted/non-anticipating requirement).

    A key result is the **Itô isometry**:

    $$\mathbb{E}\!\left[\left|\int_0^t f(s)\,dB(s)\right|^2\right] = \int_0^t \mathbb{E}\!\left[f(s)^2\right]ds$$
    """)
    return


@app.cell
def _(mo):
    integrand_dropdown = mo.ui.dropdown(
        options={"B(s) [canonical example]": "brownian", "s (deterministic)": "deterministic", "sin(B(s))": "sin_brownian", "1 (constant)": "constant"},
        value="brownian",
        label="Integrand f(s)",
    )
    n_partitions_slider = mo.ui.slider(
        start=4, stop=128, step=4, value=32, label="Number of partitions"
    )
    n_paths_slider = mo.ui.slider(
        start=1, stop=20, step=1, value=5, label="Number of paths"
    )
    seed_slider = mo.ui.slider(
        start=0, stop=100, step=1, value=42, label="Random seed"
    )
    controls = mo.hstack([integrand_dropdown, n_partitions_slider, n_paths_slider, seed_slider], wrap=True)
    mo.md(f"## Controls\n\n{controls}")
    return integrand_dropdown, n_partitions_slider, n_paths_slider, seed_slider


@app.cell
def _(np, integrand_dropdown, n_partitions_slider, n_paths_slider, seed_slider):
    # Simulation parameters
    _n_part = n_partitions_slider.value
    _n_paths = n_paths_slider.value
    _seed = seed_slider.value
    _integrand_type = integrand_dropdown.value
    T = 1.0
    dt = T / _n_part
    t_grid = np.linspace(0, T, _n_part + 1)

    rng = np.random.default_rng(_seed)

    # Generate Brownian motion paths
    dB_all = rng.normal(0, np.sqrt(dt), size=(_n_paths, _n_part))
    B_all = np.zeros((_n_paths, _n_part + 1))
    B_all[:, 1:] = np.cumsum(dB_all, axis=1)

    # Evaluate integrand at left endpoints (Itô) and midpoints (Stratonovich)
    def eval_integrand(B_vals, t_vals, kind):
        if kind == "brownian":
            return B_vals
        elif kind == "deterministic":
            return t_vals
        elif kind == "sin_brownian":
            return np.sin(B_vals)
        else:
            return np.ones_like(B_vals)

    # Itô sums: f evaluated at left endpoints
    f_left = eval_integrand(B_all[:, :-1], t_grid[:-1], _integrand_type)
    ito_increments = f_left * dB_all
    ito_cumsum = np.zeros((_n_paths, _n_part + 1))
    ito_cumsum[:, 1:] = np.cumsum(ito_increments, axis=1)

    # Stratonovich sums: f evaluated at midpoint approximation
    B_mid = 0.5 * (B_all[:, :-1] + B_all[:, 1:])
    t_mid = 0.5 * (t_grid[:-1] + t_grid[1:])
    f_mid = eval_integrand(B_mid, t_mid, _integrand_type)
    strat_increments = f_mid * dB_all
    strat_cumsum = np.zeros((_n_paths, _n_part + 1))
    strat_cumsum[:, 1:] = np.cumsum(strat_increments, axis=1)

    # Analytical values for B(s) dB(s)
    ito_analytical = 0.5 * (B_all ** 2 - t_grid[np.newaxis, :])  # ½(B²-t)
    strat_analytical = 0.5 * B_all ** 2  # ½B²
    return (t_grid, B_all, dB_all, dt, T, ito_cumsum, strat_cumsum,
            ito_analytical, strat_analytical, _n_paths, _n_part, _integrand_type,
            f_left, eval_integrand)


@app.cell
def _(go, np, VIZ_COLORS, DEFAULT_LAYOUT, t_grid, B_all, ito_cumsum, strat_cumsum,
      ito_analytical, strat_analytical, _n_paths, _integrand_type, styled_subplots):
    fig = styled_subplots(
        rows=1, cols=2,
        titles=["Itô Integral Approximation", "Stratonovich Integral Approximation"],
        height=450,
    )

    for i in range(_n_paths):
        color = VIZ_COLORS[i % len(VIZ_COLORS)]
        show_legend = (i == 0)
        # Itô
        fig.add_trace(go.Scatter(
            x=t_grid, y=ito_cumsum[i], mode='lines',
            name='Itô sum' if show_legend else None,
            line=dict(color=color, width=1.5),
            opacity=0.7, showlegend=show_legend,
            legendgroup='ito',
        ), row=1, col=1)
        # Stratonovich
        fig.add_trace(go.Scatter(
            x=t_grid, y=strat_cumsum[i], mode='lines',
            name='Strat. sum' if show_legend else None,
            line=dict(color=color, width=1.5, dash='dot'),
            opacity=0.7, showlegend=show_legend,
            legendgroup='strat',
        ), row=1, col=2)

    # Overlay analytical for the canonical case
    if _integrand_type == "brownian":
        for i in range(_n_paths):
            color = VIZ_COLORS[i % len(VIZ_COLORS)]
            show_legend = (i == 0)
            fig.add_trace(go.Scatter(
                x=t_grid, y=ito_analytical[i], mode='lines',
                name='½(B²−t)' if show_legend else None,
                line=dict(color='black', width=1, dash='dash'),
                opacity=0.4, showlegend=show_legend,
                legendgroup='ito_exact',
            ), row=1, col=1)
            fig.add_trace(go.Scatter(
                x=t_grid, y=strat_analytical[i], mode='lines',
                name='½B²' if show_legend else None,
                line=dict(color='black', width=1, dash='dash'),
                opacity=0.4, showlegend=show_legend,
                legendgroup='strat_exact',
            ), row=1, col=2)

    fig.update_xaxes(title_text="t", row=1, col=1)
    fig.update_xaxes(title_text="t", row=1, col=2)
    fig.update_yaxes(title_text="∫f dB", row=1, col=1)
    fig
    return


@app.cell
def _(mo, np, go, VIZ_COLORS, DEFAULT_LAYOUT, t_grid, B_all, f_left, dB_all, _n_part, styled_figure):
    # Visualize Riemann-type sum construction for path 0
    path_idx = 0
    fig2 = styled_figure(title="Riemann-Sum Construction (Path 1, Itô)", height=400)

    # Show Brownian motion path
    fig2.add_trace(go.Scatter(
        x=t_grid, y=B_all[path_idx], mode='lines',
        name='B(t)', line=dict(color=VIZ_COLORS[7], width=1.5),
    ))

    # Show step function of integrand values
    for k in range(min(_n_part, 64)):
        fig2.add_trace(go.Scatter(
            x=[t_grid[k], t_grid[k + 1]], y=[f_left[path_idx, k], f_left[path_idx, k]],
            mode='lines', line=dict(color=VIZ_COLORS[0], width=2),
            showlegend=(k == 0), name='f(tₖ) [left endpoint]',
            legendgroup='step',
        ))
        # Vertical connectors
        if k < _n_part - 1:
            fig2.add_trace(go.Scatter(
                x=[t_grid[k + 1], t_grid[k + 1]],
                y=[f_left[path_idx, k], f_left[path_idx, min(k + 1, _n_part - 1)]],
                mode='lines', line=dict(color=VIZ_COLORS[0], width=1, dash='dot'),
                showlegend=False, legendgroup='step',
            ))

    fig2.update_xaxes(title_text="t")
    fig2.update_yaxes(title_text="Value")
    mo.md(f"### Riemann-Sum Construction\n\nThe Itô integral uses **left-endpoint** evaluation (non-anticipating):")
    return (fig2,)


@app.cell
def _(fig2):
    fig2
    return


@app.cell
def _(mo, np, ito_cumsum, strat_cumsum, t_grid, _integrand_type, _n_paths):
    # Itô isometry check
    if _integrand_type == "brownian":
        # E[|∫B dB|²] = ∫E[B²]dt = ∫t dt = t²/2
        theoretical_var = t_grid ** 2 / 2
        empirical_var_ito = np.mean(ito_cumsum ** 2, axis=0)
        iso_text = r"""
    ### Itô Isometry Verification

    For $f(s) = B(s)$, the Itô isometry gives:

    $$\mathbb{E}\!\left[\left(\int_0^t B(s)\,dB(s)\right)^2\right] = \int_0^t \mathbb{E}[B(s)^2]\,ds = \int_0^t s\,ds = \frac{t^2}{2}$$

    | Quantity | Value at $t=1$ |
    |----------|---------------|
    | Theoretical $\mathbb{E}[I^2]$ | {:.4f} |
    | Empirical mean $I^2$ ({} paths) | {:.4f} |
    """.format(theoretical_var[-1], _n_paths, empirical_var_ito[-1])
    elif _integrand_type == "constant":
        theoretical_var_const = t_grid
        empirical_var_ito_const = np.mean(ito_cumsum ** 2, axis=0)
        iso_text = r"""
    ### Itô Isometry Verification

    For $f(s) = 1$, the integral $\int_0^t dB(s) = B(t) \sim N(0,t)$:

    $$\mathbb{E}\!\left[\left(\int_0^t dB(s)\right)^2\right] = \int_0^t 1\,ds = t$$

    | Quantity | Value at $t=1$ |
    |----------|---------------|
    | Theoretical $\mathbb{E}[I^2]$ | {:.4f} |
    | Empirical mean $I^2$ ({} paths) | {:.4f} |
    """.format(theoretical_var_const[-1], _n_paths, empirical_var_ito_const[-1])
    else:
        iso_text = r"""
    ### Itô Isometry

    $$\mathbb{E}\!\left[\left|\int_0^t f(s)\,dB(s)\right|^2\right] = \int_0^t \mathbb{E}[f(s)^2]\,ds$$

    Select the **B(s)** or **constant** integrand to see a numerical verification.
    """
    mo.md(iso_text)
    return


@app.cell
def _(mo, _integrand_type):
    if _integrand_type == "brownian":
        ito_vs_strat = r"""
    ### Itô vs Stratonovich: The Canonical Example

    $$\int_0^t B(s)\,dB(s) = \begin{cases} \frac{1}{2}\bigl(B(t)^2 - t\bigr) & \text{(Itô)} \\[6pt] \frac{1}{2}B(t)^2 & \text{(Stratonovich)} \end{cases}$$

    The extra $-t/2$ term in Itô's formula comes from the **quadratic variation** of Brownian motion:
    $\langle B \rangle_t = t$. The Stratonovich integral obeys the ordinary chain rule,
    while Itô's formula includes an additional correction term.

    The **conversion** between the two is:

    $$\int_0^t f(s)\circ dB(s) = \int_0^t f(s)\,dB(s) + \frac{1}{2}\int_0^t f'(s)\,d\langle B\rangle_s$$
    """
    else:
        ito_vs_strat = r"""
    ### Itô vs Stratonovich Interpretations

    | Feature | Itô | Stratonovich |
    |---------|-----|-------------|
    | Evaluation point | Left endpoint $t_k$ | Midpoint $\frac{t_k+t_{k+1}}{2}$ |
    | Martingale? | Yes | No (in general) |
    | Chain rule | Itô's lemma (extra term) | Ordinary chain rule |
    | Adaptedness | Non-anticipating | Requires future info |

    Select **B(s)** as the integrand to see the classical example where
    Itô and Stratonovich differ by $-t/2$.
    """
    mo.md(ito_vs_strat)
    return


@app.cell
def _(mo):
    mo.md(r"""
    ---
    *Module 7.1 — Itô Integral & Stochastic Differentials*
    *Probability Education Platform*
    """)
    return


if __name__ == "__main__":
    app.run()
