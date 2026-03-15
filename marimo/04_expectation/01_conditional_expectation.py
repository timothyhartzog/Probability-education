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
    # Conditional Expectation Explorer

    The conditional expectation $\mathbb{E}[Y \mid X]$ is the
    **best $L^2$-predictor** of $Y$ given $X$. Formally it is the unique
    $\sigma(X)$-measurable random variable satisfying

    $$\mathbb{E}\bigl[(Y - \mathbb{E}[Y|X])^2\bigr]
      \;\le\; \mathbb{E}\bigl[(Y - g(X))^2\bigr]$$

    for every measurable $g$. It can be viewed as the **orthogonal projection**
    of $Y$ onto $L^2(\sigma(X))$.

    **Tower property:** $\;\mathbb{E}\bigl[\mathbb{E}[Y \mid X]\bigr] = \mathbb{E}[Y]$
    """)
    return


@app.cell
def _(mo):
    COLORS = ['#2563eb', '#e97319', '#059669', '#7c3aed',
              '#db2777', '#0891b2', '#ca8a04', '#64748b']

    dist_type = mo.ui.dropdown(
        options=["Bivariate Normal", "Discrete (joint table)"],
        value="Bivariate Normal",
        label="Distribution type",
    )
    corr_slider = mo.ui.slider(
        start=-0.95, stop=0.95, step=0.05, value=0.6, label="Correlation (rho)"
    )
    n_samples_slider = mo.ui.slider(
        start=200, stop=5000, step=200, value=1000, label="n samples"
    )
    seed_slider = mo.ui.slider(
        start=0, stop=100, step=1, value=42, label="Seed"
    )
    mo.hstack([dist_type, corr_slider, n_samples_slider, seed_slider])
    return COLORS, corr_slider, dist_type, n_samples_slider, seed_slider


@app.cell
def _(mo):
    mo.md(r"""
    ## Bivariate Normal: $\mathbb{E}[Y \mid X = x] = \mu_Y + \rho\,\frac{\sigma_Y}{\sigma_X}(x - \mu_X)$

    For the standard bivariate normal with correlation $\rho$:
    $\;\mathbb{E}[Y \mid X=x] = \rho\, x$
    """)
    return


@app.cell
def _(np, go, make_subplots, COLORS, stats,
      dist_type, corr_slider, n_samples_slider, seed_slider):
    _rng = np.random.default_rng(seed_slider.value)
    _n = n_samples_slider.value
    _rho = corr_slider.value

    if dist_type.value == "Bivariate Normal":
        # Generate bivariate normal samples
        _cov = np.array([[1.0, _rho], [_rho, 1.0]])
        _samples = _rng.multivariate_normal([0, 0], _cov, _n)
        _x, _y = _samples[:, 0], _samples[:, 1]

        # True conditional expectation E[Y|X=x] = rho * x
        _x_grid = np.linspace(-3.5, 3.5, 200)
        _cond_exp = _rho * _x_grid

        # Empirical conditional expectation via binning
        _nbins = 25
        _bin_edges = np.linspace(-3.5, 3.5, _nbins + 1)
        _bin_centers = 0.5 * (_bin_edges[:-1] + _bin_edges[1:])
        _bin_means = np.full(_nbins, np.nan)
        _digitized = np.digitize(_x, _bin_edges)
        for _b in range(1, _nbins + 1):
            _mask = _digitized == _b
            if np.sum(_mask) > 0:
                _bin_means[_b - 1] = np.mean(_y[_mask])

        fig_joint = make_subplots(
            rows=1, cols=2,
            subplot_titles=["Joint scatter + E[Y|X=x]", "E[Y|X=x] function"],
        )

        fig_joint.add_trace(go.Scatter(
            x=_x, y=_y, mode='markers',
            marker=dict(size=3, color=COLORS[7], opacity=0.3),
            name='(X, Y) samples',
        ), row=1, col=1)
        fig_joint.add_trace(go.Scatter(
            x=_x_grid, y=_cond_exp, mode='lines',
            line=dict(color=COLORS[0], width=3),
            name='E[Y|X=x] (theory)',
        ), row=1, col=1)
        fig_joint.add_trace(go.Scatter(
            x=_bin_centers, y=_bin_means, mode='markers',
            marker=dict(size=8, color=COLORS[1], symbol='diamond'),
            name='E[Y|X=x] (empirical)',
        ), row=1, col=1)

        # Right panel: E[Y|X=x] function
        fig_joint.add_trace(go.Scatter(
            x=_x_grid, y=_cond_exp, mode='lines',
            line=dict(color=COLORS[0], width=3), showlegend=False,
        ), row=1, col=2)
        _valid = ~np.isnan(_bin_means)
        fig_joint.add_trace(go.Scatter(
            x=_bin_centers[_valid], y=_bin_means[_valid], mode='markers+lines',
            marker=dict(size=6, color=COLORS[1]),
            line=dict(color=COLORS[1], width=1, dash='dot'),
            showlegend=False,
        ), row=1, col=2)

        fig_joint.update_layout(
            template='plotly_white', height=450,
            font=dict(family='Inter, sans-serif', size=13, color='#1a1a2e'),
            plot_bgcolor='#ffffff', paper_bgcolor='#fafafa',
            margin=dict(l=60, r=30, t=60, b=50),
            title=f"Bivariate Normal, rho = {_rho:.2f}",
        )
        fig_joint.update_xaxes(title_text="x", row=1, col=1)
        fig_joint.update_yaxes(title_text="y", row=1, col=1)
        fig_joint.update_xaxes(title_text="x", row=1, col=2)
        fig_joint.update_yaxes(title_text="E[Y|X=x]", row=1, col=2)
    else:
        # Discrete joint distribution example
        _joint = np.array([
            [0.10, 0.05, 0.02],
            [0.05, 0.20, 0.10],
            [0.02, 0.10, 0.15],
            [0.01, 0.05, 0.15],
        ])
        _x_vals = np.array([1, 2, 3, 4])
        _y_vals = np.array([10, 20, 30])

        _px = _joint.sum(axis=1)
        _cond_exp_disc = np.array([
            np.sum(_joint[i, :] / _px[i] * _y_vals) for i in range(len(_x_vals))
        ])

        fig_joint = make_subplots(
            rows=1, cols=2,
            subplot_titles=["Joint PMF (heatmap)", "E[Y|X=x]"],
        )
        fig_joint.add_trace(go.Heatmap(
            z=_joint, x=[str(v) for v in _y_vals],
            y=[str(v) for v in _x_vals],
            colorscale=[[0, '#f0f4ff'], [1, COLORS[0]]],
            showscale=True, name='P(X=x, Y=y)',
        ), row=1, col=1)
        fig_joint.add_trace(go.Bar(
            x=[str(v) for v in _x_vals], y=_cond_exp_disc,
            marker_color=COLORS[1], name='E[Y|X=x]',
        ), row=1, col=2)

        fig_joint.update_layout(
            template='plotly_white', height=400,
            font=dict(family='Inter, sans-serif', size=13, color='#1a1a2e'),
            plot_bgcolor='#ffffff', paper_bgcolor='#fafafa',
            margin=dict(l=60, r=30, t=60, b=50),
            title="Discrete Joint Distribution",
        )
        fig_joint.update_xaxes(title_text="Y", row=1, col=1)
        fig_joint.update_yaxes(title_text="X", row=1, col=1)
        fig_joint.update_xaxes(title_text="X", row=1, col=2)
        fig_joint.update_yaxes(title_text="E[Y|X=x]", row=1, col=2)

    fig_joint
    return (fig_joint,)


@app.cell
def _(mo, np, dist_type, corr_slider, n_samples_slider, seed_slider):
    _rng = np.random.default_rng(seed_slider.value)
    _rho = corr_slider.value
    _n = n_samples_slider.value

    if dist_type.value == "Bivariate Normal":
        _cov = np.array([[1.0, _rho], [_rho, 1.0]])
        _samples = _rng.multivariate_normal([0, 0], _cov, _n)
        _x, _y = _samples[:, 0], _samples[:, 1]

        _ey = np.mean(_y)
        _eyx = _rho * _x
        _e_eyx = np.mean(_eyx)

        mo.md(f"""
    ### Tower Property Verification

    $$\\mathbb{{E}}[\\mathbb{{E}}[Y \\mid X]] = \\mathbb{{E}}[Y]$$

    | Quantity | Value |
    |---|---|
    | $\\mathbb{{E}}[Y]$ (sample) | {_ey:.4f} |
    | $\\mathbb{{E}}[\\mathbb{{E}}[Y \\mid X]]$ (sample) | {_e_eyx:.4f} |
    | Difference | {abs(_ey - _e_eyx):.6f} |
    | $\\mathbb{{E}}[Y]$ (true) | 0.0000 |

    The tower property holds: both quantities estimate the same mean.
    The small difference is due to finite-sample variability.
        """)
    else:
        _joint = np.array([
            [0.10, 0.05, 0.02],
            [0.05, 0.20, 0.10],
            [0.02, 0.10, 0.15],
            [0.01, 0.05, 0.15],
        ])
        _x_vals = np.array([1, 2, 3, 4])
        _y_vals = np.array([10, 20, 30])
        _px = _joint.sum(axis=1)
        _cond_exp_disc = np.array([
            np.sum(_joint[i, :] / _px[i] * _y_vals) for i in range(len(_x_vals))
        ])
        _ey = np.sum(_joint * _y_vals[np.newaxis, :])
        _e_eyx = np.sum(_cond_exp_disc * _px)

        mo.md(f"""
    ### Tower Property Verification (Discrete)

    | Quantity | Value |
    |---|---|
    | $\\mathbb{{E}}[Y]$ | {_ey:.4f} |
    | $\\mathbb{{E}}[\\mathbb{{E}}[Y \\mid X]]$ | {_e_eyx:.4f} |
    | Difference | {abs(_ey - _e_eyx):.8f} |

    Exact equality (up to floating-point precision).
        """)
    return


@app.cell
def _(mo):
    mo.md(r"""
    ## Key Facts

    - **Projection interpretation:** $\mathbb{E}[Y|X]$ is the orthogonal
      projection of $Y$ onto $L^2(\sigma(X))$.
    - **Tower property:** $\mathbb{E}[\mathbb{E}[Y|\mathcal{G}] \mid \mathcal{H}]
      = \mathbb{E}[Y|\mathcal{H}]$ when $\mathcal{H} \subseteq \mathcal{G}$.
    - **Variance decomposition:**
      $\operatorname{Var}(Y) = \mathbb{E}[\operatorname{Var}(Y|X)]
      + \operatorname{Var}(\mathbb{E}[Y|X])$ (law of total variance).
    - For bivariate normal: $\operatorname{Var}(Y|X) = \sigma_Y^2(1-\rho^2)$.
    """)
    return


if __name__ == "__main__":
    app.run()
