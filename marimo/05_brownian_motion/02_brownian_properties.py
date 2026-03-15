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
    # Brownian Motion Properties

    Standard Brownian motion $\{B(t)\}_{t \ge 0}$ is the continuous-time
    stochastic process satisfying:

    1. $B(0) = 0$
    2. **Independent increments:** $B(t) - B(s) \perp B(u) - B(v)$ for
       disjoint intervals
    3. **Stationary Gaussian increments:** $B(t) - B(s) \sim N(0, t-s)$
    4. **Continuous paths** a.s.

    This notebook explores self-similarity, nowhere differentiability,
    quadratic variation, and distributional properties.
    """)
    return


@app.cell
def _(mo):
    COLORS = ['#2563eb', '#e97319', '#059669', '#7c3aed',
              '#db2777', '#0891b2', '#ca8a04', '#64748b']

    n_points_slider = mo.ui.slider(
        start=100, stop=10000, step=100, value=1000, label="n points"
    )
    n_paths_slider = mo.ui.slider(
        start=1, stop=10, step=1, value=3, label="n paths"
    )
    property_dd = mo.ui.dropdown(
        options=[
            "Sample Paths & Distribution",
            "Self-Similarity",
            "Quadratic Variation",
            "Nowhere Differentiability",
        ],
        value="Sample Paths & Distribution",
        label="Property",
    )
    seed_slider = mo.ui.slider(
        start=0, stop=100, step=1, value=42, label="Seed"
    )
    mo.hstack([property_dd, n_points_slider, n_paths_slider, seed_slider])
    return COLORS, n_paths_slider, n_points_slider, property_dd, seed_slider


@app.cell
def _(np):
    def simulate_bm(n_points, t_max, n_paths, rng):
        """Simulate Brownian motion paths on [0, t_max]."""
        dt = t_max / n_points
        t_grid = np.linspace(0, t_max, n_points + 1)
        increments = rng.normal(0, np.sqrt(dt), size=(n_paths, n_points))
        paths = np.zeros((n_paths, n_points + 1))
        paths[:, 1:] = np.cumsum(increments, axis=1)
        return t_grid, paths

    return (simulate_bm,)


@app.cell
def _(np, go, make_subplots, COLORS, stats, simulate_bm,
      property_dd, n_points_slider, n_paths_slider, seed_slider):
    _rng = np.random.default_rng(seed_slider.value)
    _n = n_points_slider.value
    _np = n_paths_slider.value
    _prop = property_dd.value

    if _prop == "Sample Paths & Distribution":
        _t, _paths = simulate_bm(_n, 1.0, _np, _rng)

        fig_main = make_subplots(
            rows=1, cols=2,
            subplot_titles=["Sample paths B(t)", "B(1) distribution"],
        )
        for _i in range(_np):
            fig_main.add_trace(go.Scatter(
                x=_t, y=_paths[_i], mode='lines',
                line=dict(color=COLORS[_i % len(COLORS)], width=1.5),
                name=f'Path {_i + 1}',
            ), row=1, col=1)

        # Distribution of B(t) at several times
        _n_mc = 5000
        _t_check, _paths_mc = simulate_bm(_n, 1.0, _n_mc, _rng)
        for _ti, _tval in enumerate([0.25, 0.5, 1.0]):
            _idx = int(_tval * _n)
            _vals = _paths_mc[:, _idx]
            fig_main.add_trace(go.Histogram(
                x=_vals, nbinsx=50,
                marker_color=COLORS[_ti], opacity=0.5,
                histnorm='probability density',
                name=f'B({_tval})',
            ), row=1, col=2)
            _x_pdf = np.linspace(-3, 3, 200)
            _pdf = stats.norm.pdf(_x_pdf, 0, np.sqrt(_tval))
            fig_main.add_trace(go.Scatter(
                x=_x_pdf, y=_pdf, mode='lines',
                line=dict(color=COLORS[_ti], width=2, dash='dash'),
                name=f'N(0,{_tval})', showlegend=False,
            ), row=1, col=2)

        fig_main.update_layout(
            template='plotly_white', height=450,
            font=dict(family='Inter, sans-serif', size=13, color='#1a1a2e'),
            plot_bgcolor='#ffffff', paper_bgcolor='#fafafa',
            margin=dict(l=60, r=30, t=60, b=50),
            title="B(t) ~ N(0, t): paths and marginal distributions",
        )
        fig_main.update_xaxes(title_text="t", row=1, col=1)
        fig_main.update_xaxes(title_text="value", row=1, col=2)

    elif _prop == "Self-Similarity":
        # B(ct) =_d sqrt(c) * B(t)
        _t, _paths = simulate_bm(_n, 1.0, 1, _rng)
        _path0 = _paths[0]

        fig_main = make_subplots(
            rows=1, cols=2,
            subplot_titles=["B(t) on [0,1]", "Rescaled: B(ct)/sqrt(c)"],
        )
        fig_main.add_trace(go.Scatter(
            x=_t, y=_path0, mode='lines',
            line=dict(color=COLORS[0], width=2), name='B(t)',
        ), row=1, col=1)

        # Generate B on [0, c] for c = 4 and rescale
        for _ci, _c in enumerate([2, 4, 8]):
            _t_long, _paths_long = simulate_bm(_n * _c, float(_c), 1, _rng)
            _rescaled = _paths_long[0] / np.sqrt(_c)
            _t_rescaled = _t_long / _c
            fig_main.add_trace(go.Scatter(
                x=_t_rescaled, y=_rescaled, mode='lines',
                line=dict(color=COLORS[_ci + 1], width=1.5),
                name=f'B({_c}t)/sqrt({_c})',
            ), row=1, col=2)

        fig_main.update_layout(
            template='plotly_white', height=400,
            font=dict(family='Inter, sans-serif', size=13, color='#1a1a2e'),
            plot_bgcolor='#ffffff', paper_bgcolor='#fafafa',
            margin=dict(l=60, r=30, t=60, b=50),
            title="Self-similarity: B(ct) has the same law as sqrt(c) B(t)",
        )
        fig_main.update_xaxes(title_text="t", row=1, col=1)
        fig_main.update_xaxes(title_text="t (rescaled)", row=1, col=2)

    elif _prop == "Quadratic Variation":
        # [B]_t = lim sum (B(t_{i+1}) - B(t_i))^2 = t
        _t_full, _paths_full = simulate_bm(10000, 1.0, 1, _rng)
        _path0 = _paths_full[0]

        _partitions = [10, 50, 100, 500, 1000, 5000, 10000]
        _qv_values = []
        for _m in _partitions:
            _step = 10000 // _m
            _indices = np.arange(0, 10001, _step)
            _vals = _path0[_indices]
            _qv = np.sum(np.diff(_vals) ** 2)
            _qv_values.append(_qv)

        fig_main = make_subplots(
            rows=1, cols=2,
            subplot_titles=[
                "Quadratic variation vs partition size",
                "Running QV along path",
            ],
        )
        fig_main.add_trace(go.Scatter(
            x=_partitions, y=_qv_values, mode='markers+lines',
            marker=dict(size=8, color=COLORS[0]),
            line=dict(color=COLORS[0], width=2),
            name='[B]_1 estimate',
        ), row=1, col=1)
        fig_main.add_hline(y=1.0, line_dash="dash", line_color=COLORS[1],
                           row=1, col=1,
                           annotation_text="[B]_1 = 1 (theory)")

        # Running quadratic variation
        _m_run = min(_n, 1000)
        _t_run, _paths_run = simulate_bm(_m_run, 1.0, 1, _rng)
        _path_run = _paths_run[0]
        _qv_running = np.concatenate([[0], np.cumsum(np.diff(_path_run) ** 2)])
        fig_main.add_trace(go.Scatter(
            x=_t_run, y=_qv_running, mode='lines',
            line=dict(color=COLORS[0], width=2),
            name='[B]_t (cumulative)',
        ), row=1, col=2)
        fig_main.add_trace(go.Scatter(
            x=_t_run, y=_t_run, mode='lines',
            line=dict(color=COLORS[1], width=2, dash='dash'),
            name='t (theory)',
        ), row=1, col=2)

        fig_main.update_layout(
            template='plotly_white', height=400,
            font=dict(family='Inter, sans-serif', size=13, color='#1a1a2e'),
            plot_bgcolor='#ffffff', paper_bgcolor='#fafafa',
            margin=dict(l=60, r=30, t=60, b=50),
            title="Quadratic Variation: [B]_t = t",
        )
        fig_main.update_xaxes(title_text="# partition points", row=1, col=1)
        fig_main.update_xaxes(title_text="t", row=1, col=2)

    else:  # Nowhere Differentiability
        _t, _paths = simulate_bm(_n, 1.0, 1, _rng)
        _path0 = _paths[0]
        _dt = 1.0 / _n

        # Approximate derivative: (B(t+dt) - B(t)) / dt
        _approx_deriv = np.diff(_path0) / _dt

        fig_main = make_subplots(
            rows=1, cols=2,
            subplot_titles=["B(t) path", "(B(t+dt)-B(t))/dt (approx derivative)"],
        )
        fig_main.add_trace(go.Scatter(
            x=_t, y=_path0, mode='lines',
            line=dict(color=COLORS[0], width=2), name='B(t)',
        ), row=1, col=1)
        fig_main.add_trace(go.Scatter(
            x=_t[:-1], y=_approx_deriv, mode='lines',
            line=dict(color=COLORS[1], width=1), name='approx deriv',
        ), row=1, col=2)

        fig_main.update_layout(
            template='plotly_white', height=400,
            font=dict(family='Inter, sans-serif', size=13, color='#1a1a2e'),
            plot_bgcolor='#ffffff', paper_bgcolor='#fafafa',
            margin=dict(l=60, r=30, t=60, b=50),
            title=f"Nowhere differentiable: dt = {_dt:.6f}, "
                  f"max|deriv| = {np.max(np.abs(_approx_deriv)):.1f}",
        )
        fig_main.update_xaxes(title_text="t", row=1, col=1)
        fig_main.update_xaxes(title_text="t", row=1, col=2)

    fig_main
    return (fig_main,)


@app.cell
def _(mo, property_dd):
    _explanations = {
        "Sample Paths & Distribution": r"""
**Marginal distributions:** $B(t) \sim N(0,t)$ for each $t$.
The increments $B(t)-B(s) \sim N(0,t-s)$ are independent for
disjoint intervals. The histograms confirm the Gaussian marginals.
        """,
        "Self-Similarity": r"""
**Self-similarity:** Brownian motion satisfies $\{B(ct)\}_{t \ge 0}
\stackrel{d}{=} \{\sqrt{c}\,B(t)\}_{t \ge 0}$. The rescaled paths
$B(ct)/\sqrt{c}$ are statistically indistinguishable from $B(t)$.
The **Hurst exponent** is $H = 1/2$.
        """,
        "Quadratic Variation": r"""
**Quadratic variation:** $[B]_t = \lim_{|\Pi| \to 0}
\sum_{i}(B(t_{i+1})-B(t_i))^2 = t$. Unlike smooth functions
(which have zero quadratic variation), BM accumulates variation
at rate $dt$ per unit time. This is why $dB^2 = dt$ in Ito calculus.
        """,
        "Nowhere Differentiability": r"""
**Nowhere differentiable:** The difference quotient
$(B(t+h)-B(t))/h \sim N(0, 1/h)$ diverges as $h \to 0$.
With probability 1, BM is nowhere differentiable.
The approximate derivative grows without bound as the grid refines.
        """,
    }
    mo.md(_explanations.get(property_dd.value, ""))
    return


if __name__ == "__main__":
    app.run()
