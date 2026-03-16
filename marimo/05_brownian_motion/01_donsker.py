import marimo

app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import numpy as np
    import plotly.graph_objects as go
    from plotly.subplots import make_subplots
    from scipy import stats
    return go, make_subplots, mo, np, stats


@app.cell
def _(mo):
    mo.md(r"""
    # Donsker's Theorem: Random Walk to Brownian Motion

    **Donsker's Invariance Principle** states that if $X_1, X_2, \ldots$ are
    i.i.d. with $\mathbb{E}[X_i] = 0$ and $\operatorname{Var}(X_i) = 1$, then
    the rescaled random walk

    $$B_n(t) = \frac{S_{\lfloor nt \rfloor}}{\sqrt{n}}, \quad t \in [0,1]$$

    converges in distribution (in $C[0,1]$) to standard Brownian motion $B(t)$.

    This is a **functional CLT** -- not just convergence of marginals, but of
    entire sample paths.
    """)
    return


@app.cell
def _(mo):
    COLORS = ['#2563eb', '#e97319', '#059669', '#7c3aed',
              '#db2777', '#0891b2', '#ca8a04', '#64748b']

    n_slider = mo.ui.slider(
        start=10, stop=5000, step=10, value=100, label="n (steps)"
    )
    n_paths_slider = mo.ui.slider(
        start=1, stop=15, step=1, value=5, label="n paths"
    )
    seed_slider = mo.ui.slider(
        start=0, stop=100, step=1, value=42, label="Seed"
    )
    mo.hstack([n_slider, n_paths_slider, seed_slider])
    return COLORS, n_paths_slider, n_slider, seed_slider


@app.cell
def _(np, go, COLORS, n_slider, n_paths_slider, seed_slider):
    _rng = np.random.default_rng(seed_slider.value)
    _n = n_slider.value
    _np = n_paths_slider.value

    # Time grid on [0,1]
    _t_grid = np.linspace(0, 1, 1000)

    fig_paths = go.Figure()

    for _i in range(_np):
        # Generate random walk with +1/-1 steps
        _steps = _rng.choice([-1, 1], size=_n)
        _s = np.concatenate([[0], np.cumsum(_steps)])

        # Rescaled path: B_n(t) = S_{floor(nt)} / sqrt(n)
        _indices = np.floor(_t_grid * _n).astype(int)
        _indices = np.clip(_indices, 0, _n)
        _b_n = _s[_indices] / np.sqrt(_n)

        fig_paths.add_trace(go.Scatter(
            x=_t_grid, y=_b_n, mode='lines',
            line=dict(color=COLORS[_i % len(COLORS)], width=1.5),
            name=f'Path {_i + 1}', opacity=0.8,
        ))

    fig_paths.update_layout(
        template='plotly_white', height=450,
        font=dict(family='Inter, sans-serif', size=13, color='#1a1a2e'),
        plot_bgcolor='#ffffff', paper_bgcolor='#fafafa',
        margin=dict(l=60, r=30, t=60, b=50),
        title=f"Scaled Random Walk B_n(t) = S_{{floor(nt)}} / sqrt({_n})",
        xaxis_title="t", yaxis_title="B_n(t)",
    )
    fig_paths
    return (fig_paths,)


@app.cell
def _(mo):
    mo.md(r"""
    ## Distribution of the Maximum

    As $n \to \infty$, the distribution of $\max_{0 \le t \le 1} B_n(t)$
    converges to that of $\max_{0 \le t \le 1} B(t)$, which follows
    the half-normal distribution: $\mathbb{P}(\max B(t) \le x) = 2\Phi(x) - 1$
    for $x \ge 0$.
    """)
    return


@app.cell
def _(np, go, make_subplots, COLORS, stats, n_slider, seed_slider):
    _rng = np.random.default_rng(seed_slider.value + 100)
    _n_values = [50, 200, 1000, n_slider.value]
    _n_values = sorted(set(_n_values))
    _n_mc = 3000  # Monte Carlo replications

    fig_max = make_subplots(
        rows=1, cols=2,
        subplot_titles=["Distribution of max B_n(t)", "Hitting time P(tau_a <= 1)"],
    )

    # True distribution of max B(t) on [0,1] is |N(0,1)| (folded normal)
    _x_max = np.linspace(0, 4, 200)
    _pdf_true = 2 * stats.norm.pdf(_x_max)  # density of |N(0,1)|
    fig_max.add_trace(go.Scatter(
        x=_x_max, y=_pdf_true, mode='lines',
        line=dict(color='black', width=2.5, dash='dash'),
        name='BM limit (|N(0,1)|)',
    ), row=1, col=1)

    for _idx, _n in enumerate(_n_values):
        _maxima = np.zeros(_n_mc)
        for _j in range(_n_mc):
            _steps = _rng.choice([-1, 1], size=_n)
            _s = np.cumsum(_steps)
            _maxima[_j] = np.max(_s) / np.sqrt(_n)

        fig_max.add_trace(go.Histogram(
            x=_maxima, nbinsx=50,
            marker_color=COLORS[_idx % len(COLORS)],
            opacity=0.5, histnorm='probability density',
            name=f'n={_n}',
        ), row=1, col=1)

    # Hitting time comparison
    _barriers = np.linspace(0.1, 3.0, 30)
    for _idx, _n in enumerate(_n_values):
        _hit_probs = np.zeros(len(_barriers))
        for _bi, _a in enumerate(_barriers):
            _hit_count = 0
            for _j in range(500):
                _steps = _rng.choice([-1, 1], size=_n)
                _s = np.cumsum(_steps) / np.sqrt(_n)
                if np.max(_s) >= _a:
                    _hit_count += 1
            _hit_probs[_bi] = _hit_count / 500

        fig_max.add_trace(go.Scatter(
            x=_barriers, y=_hit_probs, mode='lines+markers',
            line=dict(color=COLORS[_idx % len(COLORS)], width=1.5),
            marker=dict(size=4),
            name=f'n={_n}', showlegend=False,
        ), row=1, col=2)

    # BM hitting probability: P(max B(t) >= a) = 2(1 - Phi(a))
    _hit_true = 2 * (1 - stats.norm.cdf(_barriers))
    fig_max.add_trace(go.Scatter(
        x=_barriers, y=_hit_true, mode='lines',
        line=dict(color='black', width=2.5, dash='dash'),
        name='BM limit', showlegend=False,
    ), row=1, col=2)

    fig_max.update_layout(
        template='plotly_white', height=400,
        font=dict(family='Inter, sans-serif', size=13, color='#1a1a2e'),
        plot_bgcolor='#ffffff', paper_bgcolor='#fafafa',
        margin=dict(l=60, r=30, t=60, b=50),
    )
    fig_max.update_xaxes(title_text="max value", row=1, col=1)
    fig_max.update_xaxes(title_text="barrier a", row=1, col=2)
    fig_max.update_yaxes(title_text="density", row=1, col=1)
    fig_max.update_yaxes(title_text="P(tau_a <= 1)", row=1, col=2)
    fig_max
    return (fig_max,)


@app.cell
def _(mo, n_slider):
    mo.md(f"""
    ## Convergence Summary

    With $n = {n_slider.value}$ steps:

    - The rescaled paths $B_n(t)$ approximate continuous Brownian paths.
    - The distribution of $\\max_{{0 \\le t \\le 1}} B_n(t)$ approaches $|N(0,1)|$.
    - Hitting-time probabilities $\\mathbb{{P}}(\\tau_a \\le 1)$ converge to
      $2(1 - \\Phi(a))$.
    - Convergence is in the **Skorokhod topology** on $D[0,1]$, but since
      the limit is continuous, this is equivalent to uniform convergence in
      distribution.

    **Rate:** The convergence rate is typically $O(1/\\sqrt{{n}})$ for smooth
    functionals, by the Berry-Esseen theorem.
    """)
    return


if __name__ == "__main__":
    app.run()
