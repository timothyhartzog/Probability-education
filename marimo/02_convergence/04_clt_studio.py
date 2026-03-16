import marimo

__generated_with = "0.13.0"
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
    # 2.4 Central Limit Theorem Studio

    The **Central Limit Theorem (CLT)** is arguably the most important result in probability
    and statistics. It explains why the normal distribution appears so frequently in nature.

    > **Theorem (Lindeberg-Levy CLT).** Let $X_1, X_2, \ldots$ be i.i.d. with mean $\mu$ and
    > finite variance $\sigma^2 > 0$. Then
    > $$Z_n = \frac{S_n - n\mu}{\sigma\sqrt{n}} = \frac{\bar{X}_n - \mu}{\sigma / \sqrt{n}} \xrightarrow{d} N(0,1)$$

    This module lets you watch the CLT in action: pick a distribution (even highly non-normal ones)
    and increase $n$ to see the standardized sum approach the bell curve.
    """)
    return


@app.cell
def _(mo):
    COLORS = ['#2563eb', '#e97319', '#059669', '#7c3aed',
              '#db2777', '#0891b2', '#ca8a04', '#64748b']

    dist_dropdown = mo.ui.dropdown(
        options={
            "Uniform(0, 1)": "uniform",
            "Exponential(1)": "exponential",
            "Bernoulli(0.5)": "bernoulli",
            "Dice (1-6)": "dice",
            "Chi-squared(3)": "chi2",
        },
        value="Exponential(1)",
        label="Distribution",
    )
    n_slider = mo.ui.slider(1, 100, value=1, step=1, label="n (terms in sum)")
    samples_slider = mo.ui.slider(1000, 50000, value=10000, step=1000, label="Number of samples")
    seed_slider = mo.ui.slider(0, 100, value=42, step=1, label="Seed")

    controls = mo.hstack([dist_dropdown, n_slider, samples_slider, seed_slider], wrap=True)
    controls
    return COLORS, dist_dropdown, n_slider, samples_slider, seed_slider


@app.cell
def _(dist_dropdown, mo):
    _key = {v: k for k, v in dist_dropdown.options.items()}[dist_dropdown.value]
    _info = {
        "uniform": r"""
**Uniform(0, 1):** $\mu = 1/2$, $\sigma^2 = 1/12$. Already symmetric, so convergence
to normality is fast. Even $n = 3$ looks quite Gaussian.
        """,
        "exponential": r"""
**Exponential(1):** $\mu = 1$, $\sigma^2 = 1$. Right-skewed (skewness = 2).
The CLT needs larger $n$ (around 20-30) to smooth out the skewness.
        """,
        "bernoulli": r"""
**Bernoulli(0.5):** $\mu = 1/2$, $\sigma^2 = 1/4$. Symmetric discrete distribution.
For large $n$, the binomial distribution $\text{Bin}(n, 1/2)$ is well-approximated by
$N(n/2, n/4)$ --- this is the original form of the CLT proved by de Moivre and Laplace.
        """,
        "dice": r"""
**Fair die (1-6):** $\mu = 7/2$, $\sigma^2 = 35/12$. Discrete uniform on $\{1,\ldots,6\}$.
Despite the unusual shape, the sum of dice rolls becomes Gaussian quickly.
        """,
        "chi2": r"""
**Chi-squared(3):** $\mu = 3$, $\sigma^2 = 6$. Right-skewed (skewness $= 2\sqrt{2/3}$).
Being a sum of squared normals, it takes moderate $n$ to look Gaussian.
        """,
    }
    mo.md(_info[_key])
    return


@app.cell
def _(COLORS, dist_dropdown, go, make_subplots, mo, np, n_slider, samples_slider, seed_slider, stats):
    _key = {v: k for k, v in dist_dropdown.options.items()}[dist_dropdown.value]
    _n = n_slider.value
    _n_samples = samples_slider.value
    _rng = np.random.default_rng(seed_slider.value)

    # Distribution configs: sampler, mu, sigma
    _dist_config = {
        "uniform":     {"sampler": lambda rng, shape: rng.random(shape),
                        "mu": 0.5, "sigma": 1.0 / np.sqrt(12)},
        "exponential": {"sampler": lambda rng, shape: rng.exponential(1.0, shape),
                        "mu": 1.0, "sigma": 1.0},
        "bernoulli":   {"sampler": lambda rng, shape: rng.binomial(1, 0.5, shape).astype(float),
                        "mu": 0.5, "sigma": 0.5},
        "dice":        {"sampler": lambda rng, shape: rng.integers(1, 7, shape).astype(float),
                        "mu": 3.5, "sigma": np.sqrt(35.0 / 12.0)},
        "chi2":        {"sampler": lambda rng, shape: rng.chisquare(3, shape),
                        "mu": 3.0, "sigma": np.sqrt(6.0)},
    }
    _cfg = _dist_config[_key]
    _mu = _cfg["mu"]
    _sigma = _cfg["sigma"]

    # Generate standardized sums
    _raw = _cfg["sampler"](_rng, (_n_samples, _n))
    _sums = np.sum(_raw, axis=1)
    if _n > 1 or _sigma > 0:
        _Z = (_sums - _n * _mu) / (_sigma * np.sqrt(_n))
    else:
        _Z = _sums - _mu

    # Compute moments of standardized sums
    _skewness = float(stats.skew(_Z))
    _kurtosis = float(stats.kurtosis(_Z))  # excess kurtosis

    # --- Create subplot figure ---
    _fig = make_subplots(
        rows=2, cols=2,
        subplot_titles=[
            f"Histogram of Z_n with N(0,1) overlay (n={_n})",
            "Q-Q Plot vs N(0,1)",
            "Skewness vs n",
            "Excess Kurtosis vs n",
        ],
        vertical_spacing=0.14,
        horizontal_spacing=0.10,
    )
    _fig.update_layout(
        template='plotly_white',
        font=dict(family='Inter, Helvetica Neue, sans-serif', size=12),
        height=750,
        margin=dict(l=60, r=30, t=60, b=50),
        showlegend=False,
    )

    # --- (1) Histogram + N(0,1) ---
    _fig.add_trace(go.Histogram(
        x=_Z,
        nbinsx=80,
        histnorm='probability density',
        marker_color=COLORS[0],
        opacity=0.6,
        name='Z_n',
    ), row=1, col=1)

    # N(0,1) overlay
    _x_pdf = np.linspace(-4, 4, 300)
    _y_pdf = stats.norm.pdf(_x_pdf)
    _fig.add_trace(go.Scatter(
        x=_x_pdf, y=_y_pdf,
        mode='lines',
        line=dict(color='#dc2626', width=2.5, dash='dash'),
        name='N(0,1)',
    ), row=1, col=1)
    _fig.update_xaxes(title_text="z", range=[-4.5, 4.5], row=1, col=1)
    _fig.update_yaxes(title_text="Density", row=1, col=1)

    # --- (2) Q-Q Plot ---
    _sorted_z = np.sort(_Z)
    _n_qq = len(_sorted_z)
    _theoretical_q = stats.norm.ppf((np.arange(1, _n_qq + 1) - 0.5) / _n_qq)

    # Subsample for plotting if too many points
    if _n_qq > 2000:
        _qq_idx = np.linspace(0, _n_qq - 1, 2000, dtype=int)
        _tq = _theoretical_q[_qq_idx]
        _eq = _sorted_z[_qq_idx]
    else:
        _tq = _theoretical_q
        _eq = _sorted_z

    _fig.add_trace(go.Scatter(
        x=_tq, y=_eq,
        mode='markers',
        marker=dict(color=COLORS[0], size=2.5, opacity=0.5),
        name='Q-Q',
    ), row=1, col=2)

    # Reference line y=x
    _qq_range = [-3.5, 3.5]
    _fig.add_trace(go.Scatter(
        x=_qq_range, y=_qq_range,
        mode='lines',
        line=dict(color='#dc2626', width=2, dash='dash'),
        name='y = x',
    ), row=1, col=2)
    _fig.update_xaxes(title_text="Theoretical quantiles", range=_qq_range, row=1, col=2)
    _fig.update_yaxes(title_text="Sample quantiles", range=_qq_range, row=1, col=2)

    # --- (3,4) Skewness and Kurtosis vs n ---
    # Compute moments for n = 1, 2, ..., current n
    _n_range = np.arange(1, min(_n, 100) + 1)
    _rng2 = np.random.default_rng(seed_slider.value + 777)
    _n_mc = min(_n_samples, 10000)
    _skews = np.zeros(len(_n_range))
    _kurts = np.zeros(len(_n_range))

    for _idx, _nv in enumerate(_n_range):
        _raw_mc = _cfg["sampler"](_rng2, (_n_mc, _nv))
        _sums_mc = np.sum(_raw_mc, axis=1)
        _Z_mc = (_sums_mc - _nv * _mu) / (_sigma * np.sqrt(_nv))
        _skews[_idx] = stats.skew(_Z_mc)
        _kurts[_idx] = stats.kurtosis(_Z_mc)

    _fig.add_trace(go.Scatter(
        x=_n_range, y=_skews,
        mode='lines+markers',
        line=dict(color=COLORS[2], width=2),
        marker=dict(size=4),
        name='Skewness',
    ), row=2, col=1)
    _fig.add_hline(y=0, line_dash="dash", line_color="#999", row=2, col=1)
    _fig.update_xaxes(title_text="n", row=2, col=1)
    _fig.update_yaxes(title_text="Skewness", row=2, col=1)

    _fig.add_trace(go.Scatter(
        x=_n_range, y=_kurts,
        mode='lines+markers',
        line=dict(color=COLORS[3], width=2),
        marker=dict(size=4),
        name='Excess Kurtosis',
    ), row=2, col=2)
    _fig.add_hline(y=0, line_dash="dash", line_color="#999", row=2, col=2)
    _fig.update_xaxes(title_text="n", row=2, col=2)
    _fig.update_yaxes(title_text="Excess Kurtosis", row=2, col=2)

    mo.ui.plotly(_fig)
    return


@app.cell
def _(dist_dropdown, mo, n_slider, stats):
    _key = {v: k for k, v in dist_dropdown.options.items()}[dist_dropdown.value]
    _n = n_slider.value
    mo.md(rf"""
    ## Current Statistics (n = {_n})

    | Quantity | Value | Target (N(0,1)) |
    |----------|-------|-----------------|
    | **Skewness** | computed from histogram | 0 |
    | **Excess Kurtosis** | computed from histogram | 0 |

    As $n$ increases, both skewness and excess kurtosis should approach **zero**,
    confirming convergence to the standard normal distribution.

    ### Berry-Esseen Bound

    The CLT convergence rate is quantified by the **Berry-Esseen theorem**:
    $$\sup_z \left\lvert P(Z_n \le z) - \Phi(z) \right\rvert \le \frac{{C \cdot E[|X_1 - \mu|^3]}}{{\sigma^3 \sqrt{{n}}}}$$

    where $C \le 0.4748$. This gives a uniform bound of order $O(1/\sqrt{{n}})$ on the CDF error.

    ### Tips for Exploration

    - Start with $n = 1$ to see the raw distribution shape
    - Increase $n$ slowly and watch the histogram morph into a bell curve
    - The **Q-Q plot** is the most sensitive diagnostic: points should fall on the $y = x$ line
    - **Skewed distributions** (Exponential, Chi-squared) need larger $n$ than symmetric ones
    - Try the **dice** distribution to see the classic "sum of dice" CLT demonstration
    """)
    return


@app.cell
def _(COLORS, dist_dropdown, go, mo, np, seed_slider, stats):
    # Berry-Esseen comparison: empirical CDF vs N(0,1)
    _key = {v: k for k, v in dist_dropdown.options.items()}[dist_dropdown.value]
    _rng3 = np.random.default_rng(seed_slider.value + 3000)
    _n_mc = 20000

    _dist_config = {
        "uniform":     {"sampler": lambda rng, shape: rng.random(shape),
                        "mu": 0.5, "sigma": 1.0 / np.sqrt(12)},
        "exponential": {"sampler": lambda rng, shape: rng.exponential(1.0, shape),
                        "mu": 1.0, "sigma": 1.0},
        "bernoulli":   {"sampler": lambda rng, shape: rng.binomial(1, 0.5, shape).astype(float),
                        "mu": 0.5, "sigma": 0.5},
        "dice":        {"sampler": lambda rng, shape: rng.integers(1, 7, shape).astype(float),
                        "mu": 3.5, "sigma": np.sqrt(35.0 / 12.0)},
        "chi2":        {"sampler": lambda rng, shape: rng.chisquare(3, shape),
                        "mu": 3.0, "sigma": np.sqrt(6.0)},
    }
    _cfg = _dist_config[_key]

    # Compute sup|F_n(z) - Phi(z)| for various n
    _test_ns = [1, 2, 3, 5, 10, 20, 30, 50, 75, 100]
    _sup_errors = []
    _z_grid = np.linspace(-4, 4, 500)
    _phi = stats.norm.cdf(_z_grid)

    for _nv in _test_ns:
        _raw = _cfg["sampler"](_rng3, (_n_mc, _nv))
        _sums = np.sum(_raw, axis=1)
        _Z = (_sums - _nv * _cfg["mu"]) / (_cfg["sigma"] * np.sqrt(_nv))
        # Empirical CDF at z_grid points
        _ecdf = np.array([np.mean(_Z <= z) for z in _z_grid])
        _sup_err = np.max(np.abs(_ecdf - _phi))
        _sup_errors.append(_sup_err)

    _fig3 = go.Figure()
    _fig3.update_layout(
        template='plotly_white',
        font=dict(family='Inter, Helvetica Neue, sans-serif', size=13),
        height=380,
        title="CDF Approximation Error: sup|F_Zn(z) - Phi(z)| vs n",
        xaxis_title="n",
        yaxis_title="sup |F - Phi|",
        margin=dict(l=60, r=30, t=60, b=50),
    )
    _fig3.add_trace(go.Scatter(
        x=_test_ns, y=_sup_errors,
        mode='lines+markers',
        line=dict(color=COLORS[0], width=2),
        marker=dict(size=7, color=COLORS[0]),
        name='Empirical',
    ))

    # 1/sqrt(n) reference curve (scaled)
    _ref_ns = np.array(_test_ns, dtype=float)
    _scale = _sup_errors[0] * np.sqrt(_test_ns[0])
    _fig3.add_trace(go.Scatter(
        x=_test_ns, y=_scale / np.sqrt(_ref_ns),
        mode='lines',
        line=dict(color=COLORS[1], width=2, dash='dash'),
        name='C / sqrt(n) reference',
    ))

    _fig3.update_yaxes(rangemode="tozero")

    mo.ui.plotly(_fig3)
    return


@app.cell
def _(mo):
    mo.md(r"""
    ---
    *Module 2.4 --- Central Limit Theorem Studio (Flagship)*
    *Probability Education Platform*
    """)
    return


if __name__ == "__main__":
    app.run()
