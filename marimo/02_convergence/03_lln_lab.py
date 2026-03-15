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
    # 2.3 Law of Large Numbers Lab

    The **Law of Large Numbers** is one of the most fundamental results in probability.
    It states that the sample average $\bar{X}_n = S_n / n$ converges to the population mean $\mu$.

    | Version | Statement | Condition |
    |---------|-----------|-----------|
    | **WLLN** (Weak) | $\bar{X}_n \xrightarrow{P} \mu$ | Finite variance (or weaker) |
    | **SLLN** (Strong) | $\bar{X}_n \xrightarrow{\text{a.s.}} \mu$ | Finite expectation ($E[\lvert X\rvert] < \infty$) |

    $$\bar{X}_n = \frac{S_n}{n} = \frac{1}{n}\sum_{i=1}^{n} X_i \xrightarrow{\text{a.s.}} \mu = E[X_1]$$

    The **Cauchy distribution** is a famous counterexample: it has no finite mean,
    so the LLN does **not** apply. Watch the sample average fail to stabilize!
    """)
    return


@app.cell
def _(mo):
    COLORS = ['#2563eb', '#e97319', '#059669', '#7c3aed',
              '#db2777', '#0891b2', '#ca8a04', '#64748b']

    dist_dropdown = mo.ui.dropdown(
        options={
            "Normal(0, 1)": "normal",
            "Uniform(0, 1)": "uniform",
            "Exponential(1)": "exponential",
            "Bernoulli(0.3)": "bernoulli",
            "Cauchy (no LLN!)": "cauchy",
        },
        value="Normal(0, 1)",
        label="Distribution",
    )
    n_max_slider = mo.ui.slider(100, 10000, value=2000, step=100, label="Max n")
    paths_slider = mo.ui.slider(1, 30, value=10, step=1, label="Number of paths")
    seed_slider = mo.ui.slider(0, 100, value=42, step=1, label="Seed")

    controls = mo.hstack([dist_dropdown, n_max_slider, paths_slider, seed_slider], wrap=True)
    controls
    return COLORS, dist_dropdown, n_max_slider, paths_slider, seed_slider


@app.cell
def _(dist_dropdown, mo):
    _key = {v: k for k, v in dist_dropdown.options.items()}[dist_dropdown.value]
    _info = {
        "normal": r"""
**Normal(0, 1):** $\mu = 0$, $\sigma^2 = 1$. Both WLLN and SLLN apply.
The sample average converges to 0 at rate $\sigma / \sqrt{n}$.
        """,
        "uniform": r"""
**Uniform(0, 1):** $\mu = 1/2$, $\sigma^2 = 1/12$. Both WLLN and SLLN apply.
$\bar{X}_n \to 1/2$ almost surely.
        """,
        "exponential": r"""
**Exponential(1):** $\mu = 1$, $\sigma^2 = 1$. Both WLLN and SLLN apply.
The skewness of the distribution is visible for small $n$ but the average
converges to 1.
        """,
        "bernoulli": r"""
**Bernoulli(0.3):** $\mu = 0.3$, $\sigma^2 = 0.21$. Both WLLN and SLLN apply.
$\bar{X}_n$ is the empirical success fraction, converging to $p = 0.3$.
        """,
        "cauchy": r"""
**Cauchy distribution:** $E[|X|] = \infty$ --- the mean does **not exist**.
The LLN does not apply! The sample average $\bar{X}_n$ is itself Cauchy-distributed
for every $n$, so it never stabilizes. Watch the wild fluctuations persist.
        """,
    }
    mo.md(_info[_key])
    return


@app.cell
def _(COLORS, dist_dropdown, go, make_subplots, mo, np, n_max_slider, paths_slider, seed_slider, stats):
    _key = {v: k for k, v in dist_dropdown.options.items()}[dist_dropdown.value]
    _n_max = n_max_slider.value
    _n_paths = paths_slider.value
    _rng = np.random.default_rng(seed_slider.value)

    # Distribution parameters
    _dist_config = {
        "normal":      {"sampler": lambda rng, size: rng.standard_normal(size), "mu": 0.0, "sigma": 1.0},
        "uniform":     {"sampler": lambda rng, size: rng.random(size), "mu": 0.5, "sigma": 1.0 / np.sqrt(12)},
        "exponential": {"sampler": lambda rng, size: rng.exponential(1.0, size), "mu": 1.0, "sigma": 1.0},
        "bernoulli":   {"sampler": lambda rng, size: rng.binomial(1, 0.3, size).astype(float), "mu": 0.3, "sigma": np.sqrt(0.21)},
        "cauchy":      {"sampler": lambda rng, size: rng.standard_cauchy(size), "mu": None, "sigma": None},
    }
    _cfg = _dist_config[_key]
    _mu = _cfg["mu"]
    _sigma = _cfg["sigma"]

    # Generate sample paths of running averages
    _ns = np.arange(1, _n_max + 1)
    _running_avgs = np.zeros((_n_paths, _n_max))
    for _p in range(_n_paths):
        _samples = _cfg["sampler"](_rng, _n_max)
        _running_avgs[_p] = np.cumsum(_samples) / _ns

    # --- Plots ---
    _fig = make_subplots(
        rows=1, cols=2,
        subplot_titles=["Running Average S_n / n", "P(|S_n/n - mu| > epsilon) (empirical)"],
        column_widths=[0.6, 0.4],
    )
    _fig.update_layout(
        template='plotly_white',
        font=dict(family='Inter, Helvetica Neue, sans-serif', size=13),
        height=500,
        margin=dict(l=60, r=30, t=60, b=50),
        showlegend=False,
    )

    # (1) Running averages
    for _i in range(_n_paths):
        _fig.add_trace(go.Scatter(
            x=_ns, y=_running_avgs[_i],
            mode='lines',
            line=dict(color=COLORS[_i % len(COLORS)], width=1.2),
            opacity=0.6,
            showlegend=False,
        ), row=1, col=1)

    # Theoretical mean line
    if _mu is not None:
        _fig.add_hline(y=_mu, line_dash="dash", line_color="#dc2626",
                       line_width=2, row=1, col=1,
                       annotation_text=f"mu = {_mu}",
                       annotation_position="top right")

        # Confidence band: mu +/- 2*sigma/sqrt(n)
        if _sigma is not None:
            _band_ns = _ns[9:]  # start from n=10
            _upper = _mu + 2 * _sigma / np.sqrt(_band_ns)
            _lower = _mu - 2 * _sigma / np.sqrt(_band_ns)
            _fig.add_trace(go.Scatter(
                x=np.concatenate([_band_ns, _band_ns[::-1]]),
                y=np.concatenate([_upper, _lower[::-1]]),
                fill='toself',
                fillcolor='rgba(220,38,38,0.08)',
                line=dict(color='rgba(220,38,38,0.3)', width=1, dash='dot'),
                showlegend=False,
                name='2sigma/sqrt(n) band',
            ), row=1, col=1)

    _fig.update_xaxes(title_text="n", row=1, col=1)
    _fig.update_yaxes(title_text="S_n / n", row=1, col=1)

    # (2) Empirical P(|S_n/n - mu| > eps)
    if _mu is not None:
        _eps_val = 0.1
        # Use large Monte Carlo for this panel
        _rng2 = np.random.default_rng(seed_slider.value + 500)
        _n_mc = 3000
        _mc_samples = np.zeros((_n_mc, _n_max))
        for _m in range(_n_mc):
            _samps = _cfg["sampler"](_rng2, _n_max)
            _mc_samples[_m] = np.cumsum(_samps) / _ns

        _deviations = np.abs(_mc_samples - _mu)
        _prob_exceed = np.mean(_deviations > _eps_val, axis=0)

        _fig.add_trace(go.Scatter(
            x=_ns, y=_prob_exceed,
            mode='lines',
            line=dict(color=COLORS[0], width=2),
            fill='tozeroy',
            fillcolor='rgba(37,99,235,0.12)',
            showlegend=False,
        ), row=1, col=2)

        # Chebyshev bound: sigma^2 / (n * eps^2)
        if _sigma is not None:
            _cheby = _sigma**2 / (_ns * _eps_val**2)
            _cheby = np.minimum(_cheby, 1.0)
            _fig.add_trace(go.Scatter(
                x=_ns, y=_cheby,
                mode='lines',
                line=dict(color=COLORS[1], width=2, dash='dash'),
                name='Chebyshev bound',
                showlegend=True,
            ), row=1, col=2)

        _fig.update_yaxes(title_text=f"P(|S_n/n - mu| > {_eps_val})", range=[-0.05, 1.1], row=1, col=2)
    else:
        # Cauchy case: show that the average doesn't concentrate
        _fig.add_annotation(
            text="LLN does not apply<br>(mean undefined)",
            xref="x2", yref="y2",
            x=0.5, y=0.5,
            xanchor="center", yanchor="middle",
            showarrow=False,
            font=dict(size=16, color="#dc2626"),
            row=1, col=2,
        )

    _fig.update_xaxes(title_text="n", row=1, col=2)

    mo.ui.plotly(_fig)
    return


@app.cell
def _(COLORS, dist_dropdown, go, mo, np, n_max_slider, seed_slider):
    # Distribution of S_n/n at various n values
    _key = {v: k for k, v in dist_dropdown.options.items()}[dist_dropdown.value]
    _n_max = n_max_slider.value
    _rng3 = np.random.default_rng(seed_slider.value + 2000)

    _dist_config = {
        "normal":      {"sampler": lambda rng, size: rng.standard_normal(size), "mu": 0.0},
        "uniform":     {"sampler": lambda rng, size: rng.random(size), "mu": 0.5},
        "exponential": {"sampler": lambda rng, size: rng.exponential(1.0, size), "mu": 1.0},
        "bernoulli":   {"sampler": lambda rng, size: rng.binomial(1, 0.3, size).astype(float), "mu": 0.3},
        "cauchy":      {"sampler": lambda rng, size: rng.standard_cauchy(size), "mu": None},
    }
    _cfg = _dist_config[_key]

    # Pick snapshot values of n
    _n_snapshots = [10, 50, 200, min(1000, _n_max)]
    _n_snapshots = [n for n in _n_snapshots if n <= _n_max]
    _n_mc = 5000

    _fig2 = go.Figure()
    _fig2.update_layout(
        template='plotly_white',
        font=dict(family='Inter, Helvetica Neue, sans-serif', size=13),
        height=380,
        title="Distribution of S_n/n at Various n (histogram)",
        xaxis_title="S_n / n",
        yaxis_title="Density",
        margin=dict(l=60, r=30, t=60, b=50),
        barmode='overlay',
    )

    for _idx, _n_val in enumerate(_n_snapshots):
        _averages = np.zeros(_n_mc)
        for _m in range(_n_mc):
            _samps = _cfg["sampler"](_rng3, _n_val)
            _averages[_m] = np.mean(_samps)

        _fig2.add_trace(go.Histogram(
            x=_averages,
            nbinsx=60,
            name=f"n = {_n_val}",
            marker_color=COLORS[_idx % len(COLORS)],
            opacity=0.5,
            histnorm='probability density',
        ))

    # Add vertical line at mu
    if _cfg["mu"] is not None:
        _fig2.add_vline(x=_cfg["mu"], line_dash="dash", line_color="#dc2626",
                        line_width=2,
                        annotation_text=f"mu = {_cfg['mu']}",
                        annotation_position="top right")

    mo.ui.plotly(_fig2)
    return


@app.cell
def _(mo):
    mo.md(r"""
    ## Key Observations

    - **As $n$ increases**, all paths of $\bar{X}_n$ converge toward $\mu$ (the red dashed line),
      illustrating both the WLLN and SLLN.
    - The **$2\sigma/\sqrt{n}$ band** shrinks at rate $1/\sqrt{n}$, capturing roughly 95% of paths.
    - The **Chebyshev bound** $P(|\bar{X}_n - \mu| > \varepsilon) \le \sigma^2/(n\varepsilon^2)$
      is a loose upper bound on the deviation probability.
    - The **histogram snapshots** show the distribution of $\bar{X}_n$ concentrating around $\mu$.
    - **Cauchy distribution**: The sample average $\bar{X}_n$ is itself Cauchy for all $n$,
      so it never concentrates. This is the canonical counterexample to the LLN when
      $E[|X|] = \infty$.

    ### Rate of convergence

    For i.i.d. random variables with finite variance $\sigma^2$:
    $$\sqrt{n}\,(\bar{X}_n - \mu) \xrightarrow{d} N(0, \sigma^2)$$

    This is the **Central Limit Theorem** --- explored in the next module!

    ---
    *Module 2.3 --- Law of Large Numbers Lab*
    *Probability Education Platform*
    """)
    return


if __name__ == "__main__":
    app.run()
