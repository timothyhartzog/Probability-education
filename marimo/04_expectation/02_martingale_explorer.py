import marimo

app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import numpy as np
    import plotly.graph_objects as go
    from plotly.subplots import make_subplots
    return go, make_subplots, mo, np


@app.cell
def _(mo):
    mo.md(r"""
    # Martingale Path Explorer

    A sequence $(M_n)_{n \ge 0}$ adapted to a filtration $(\mathcal{F}_n)$
    is a **martingale** if for all $n$:

    $$\mathbb{E}[M_{n+1} \mid \mathcal{F}_n] = M_n$$

    Equivalently, $\mathbb{E}[M_n \mid \mathcal{F}_m] = M_m$ for all $m \le n$.

    This notebook simulates several martingale processes and illustrates the
    martingale property, stopping times, and the optional stopping theorem.
    """)
    return


@app.cell
def _(mo):
    COLORS = ['#2563eb', '#e97319', '#059669', '#7c3aed',
              '#db2777', '#0891b2', '#ca8a04', '#64748b']

    process_dd = mo.ui.dropdown(
        options=["Simple Random Walk", "Doob Martingale", "Branching Process Martingale"],
        value="Simple Random Walk",
        label="Process type",
    )
    n_steps_slider = mo.ui.slider(
        start=50, stop=500, step=50, value=200, label="n steps"
    )
    n_paths_slider = mo.ui.slider(
        start=1, stop=20, step=1, value=5, label="n paths"
    )
    seed_slider = mo.ui.slider(
        start=0, stop=100, step=1, value=42, label="Seed"
    )
    mo.hstack([process_dd, n_steps_slider, n_paths_slider, seed_slider])
    return COLORS, n_paths_slider, n_steps_slider, process_dd, seed_slider


@app.cell
def _(np):
    def simulate_martingale(process_type, n_steps, n_paths, rng):
        """Simulate martingale paths.

        Returns array of shape (n_paths, n_steps+1).
        """
        paths = np.zeros((n_paths, n_steps + 1))

        if process_type == "Simple Random Walk":
            # S_n = sum of +1/-1 with equal probability
            increments = rng.choice([-1, 1], size=(n_paths, n_steps))
            paths[:, 1:] = np.cumsum(increments, axis=1)

        elif process_type == "Doob Martingale":
            # M_n = E[X | F_n] where X = sum of n_steps iid Uniform(-1,1)
            # and F_n reveals the first n variables
            _u = rng.uniform(-1, 1, size=(n_paths, n_steps))
            _x_total = np.sum(_u, axis=1, keepdims=True)  # the target r.v.
            for k in range(n_steps + 1):
                if k == 0:
                    paths[:, k] = 0.0  # E[X] = 0
                else:
                    # E[X | F_k] = sum of first k revealed + E[remaining]
                    paths[:, k] = np.sum(_u[:, :k], axis=1)
            # At time n_steps, M_n = X itself

        elif process_type == "Branching Process Martingale":
            # Z_n / mu^n is a martingale for Galton-Watson with mean mu
            # Use Poisson(1.2) offspring
            _mu = 1.2
            for p in range(n_paths):
                z = 1  # start with one individual
                paths[p, 0] = z / 1.0  # Z_0 / mu^0
                for k in range(1, n_steps + 1):
                    if z == 0:
                        paths[p, k:] = 0.0
                        break
                    z = int(np.sum(rng.poisson(_mu, size=int(min(z, 10000)))))
                    paths[p, k] = z / (_mu ** k)

        return paths

    return (simulate_martingale,)


@app.cell
def _(np, go, COLORS, simulate_martingale, process_dd,
      n_steps_slider, n_paths_slider, seed_slider):
    _rng = np.random.default_rng(seed_slider.value)
    _n = n_steps_slider.value
    _np = n_paths_slider.value
    _proc = process_dd.value

    _paths = simulate_martingale(_proc, _n, _np, _rng)
    _time = np.arange(_n + 1)

    fig_paths = go.Figure()
    for _i in range(_np):
        fig_paths.add_trace(go.Scatter(
            x=_time, y=_paths[_i],
            mode='lines', line=dict(color=COLORS[_i % len(COLORS)], width=1.5),
            name=f'Path {_i + 1}', opacity=0.8,
        ))

    # Add mean line
    _mean_path = np.mean(_paths, axis=0)
    fig_paths.add_trace(go.Scatter(
        x=_time, y=_mean_path,
        mode='lines', line=dict(color='black', width=2.5, dash='dash'),
        name='Sample mean',
    ))

    fig_paths.update_layout(
        template='plotly_white', height=450,
        font=dict(family='Inter, sans-serif', size=13, color='#1a1a2e'),
        plot_bgcolor='#ffffff', paper_bgcolor='#fafafa',
        margin=dict(l=60, r=30, t=60, b=50),
        title=f"{_proc}: {_np} paths, {_n} steps",
        xaxis_title="Time step n",
        yaxis_title="M_n",
    )
    fig_paths
    return _paths, fig_paths


@app.cell
def _(mo):
    mo.md(r"""
    ## Martingale Property: $\mathbb{E}[M_n \mid \mathcal{F}_m] = M_m$

    We verify this empirically: pick a conditioning time $m$ and a future time $n > m$.
    For all paths sharing the same $M_m$ value (approximately), the average of
    $M_n$ should be close to $M_m$.
    """)
    return


@app.cell
def _(np, go, make_subplots, COLORS, simulate_martingale, process_dd,
      n_steps_slider, seed_slider):
    _rng = np.random.default_rng(seed_slider.value + 1000)
    _n = n_steps_slider.value
    _n_mc = 500  # many paths for statistical verification

    _paths_mc = simulate_martingale(process_dd.value, _n, _n_mc, _rng)

    # Pick m = n//4, n_future = n//2
    _m = max(1, _n // 4)
    _n_fut = _n // 2

    _m_vals = _paths_mc[:, _m]
    _n_vals = _paths_mc[:, _n_fut]

    fig_mg = make_subplots(rows=1, cols=2,
                           subplot_titles=[
                               f"M_{_n_fut} vs M_{_m}",
                               f"E[M_{_n_fut} | M_{_m}] vs M_{_m}",
                           ])

    fig_mg.add_trace(go.Scatter(
        x=_m_vals, y=_n_vals, mode='markers',
        marker=dict(size=3, color=COLORS[7], opacity=0.3),
        name='(M_m, M_n)',
    ), row=1, col=1)
    # 45-degree line
    _range = [min(_m_vals.min(), _n_vals.min()), max(_m_vals.max(), _n_vals.max())]
    fig_mg.add_trace(go.Scatter(
        x=_range, y=_range, mode='lines',
        line=dict(color=COLORS[0], width=2, dash='dash'),
        name='y = x',
    ), row=1, col=1)

    # Binned conditional expectation
    _nbins = 20
    _bin_edges = np.linspace(np.percentile(_m_vals, 2), np.percentile(_m_vals, 98), _nbins + 1)
    _bin_centers = 0.5 * (_bin_edges[:-1] + _bin_edges[1:])
    _bin_means = np.full(_nbins, np.nan)
    _digitized = np.digitize(_m_vals, _bin_edges)
    for _b in range(1, _nbins + 1):
        _mask = _digitized == _b
        if np.sum(_mask) > 2:
            _bin_means[_b - 1] = np.mean(_n_vals[_mask])

    _valid = ~np.isnan(_bin_means)
    fig_mg.add_trace(go.Scatter(
        x=_bin_centers[_valid], y=_bin_means[_valid],
        mode='markers+lines',
        marker=dict(size=8, color=COLORS[1]),
        line=dict(color=COLORS[1], width=2),
        name='E[M_n | M_m] (binned)',
    ), row=1, col=2)
    fig_mg.add_trace(go.Scatter(
        x=_bin_centers[_valid], y=_bin_centers[_valid],
        mode='lines', line=dict(color=COLORS[0], width=2, dash='dash'),
        name='y = x (martingale)',
    ), row=1, col=2)

    fig_mg.update_layout(
        template='plotly_white', height=400,
        font=dict(family='Inter, sans-serif', size=13, color='#1a1a2e'),
        plot_bgcolor='#ffffff', paper_bgcolor='#fafafa',
        margin=dict(l=60, r=30, t=60, b=50),
    )
    fig_mg
    return (fig_mg,)


@app.cell
def _(mo):
    mo.md(r"""
    ## Stopping Times & Optional Stopping

    The **Optional Stopping Theorem** says that if $(M_n)$ is a martingale
    and $\tau$ is a bounded stopping time (or satisfies certain integrability
    conditions), then

    $$\mathbb{E}[M_\tau] = \mathbb{E}[M_0]$$

    Below we use the first hitting time $\tau = \inf\{n : M_n \ge a\}$ for
    simple random walk, capped at max steps.
    """)
    return


@app.cell
def _(np, go, COLORS, n_steps_slider, seed_slider):
    _rng = np.random.default_rng(seed_slider.value + 2000)
    _n = n_steps_slider.value
    _n_mc = 2000
    _barrier = 10

    # Simulate random walks and find stopping times
    _increments = _rng.choice([-1, 1], size=(_n_mc, _n))
    _walks = np.zeros((_n_mc, _n + 1))
    _walks[:, 1:] = np.cumsum(_increments, axis=1)

    _tau = np.full(_n_mc, _n)  # default: not stopped
    _m_tau = np.zeros(_n_mc)
    for _i in range(_n_mc):
        _hits = np.where(_walks[_i] >= _barrier)[0]
        if len(_hits) > 0:
            _tau[_i] = _hits[0]
        _m_tau[_i] = _walks[_i, _tau[_i]]

    _stopped_frac = np.mean(_tau < _n)

    fig_stop = go.Figure()
    fig_stop.add_trace(go.Histogram(
        x=_m_tau, nbinsx=40,
        marker_color=COLORS[0], opacity=0.7,
        name='M_tau values',
    ))
    fig_stop.add_vline(x=0, line_dash="dash", line_color=COLORS[1],
                       annotation_text=f"E[M_0] = 0")
    fig_stop.add_vline(x=np.mean(_m_tau), line_dash="solid", line_color=COLORS[2],
                       annotation_text=f"E[M_tau] = {np.mean(_m_tau):.2f}")

    fig_stop.update_layout(
        template='plotly_white', height=350,
        font=dict(family='Inter, sans-serif', size=13, color='#1a1a2e'),
        plot_bgcolor='#ffffff', paper_bgcolor='#fafafa',
        margin=dict(l=60, r=30, t=60, b=50),
        title=f"Optional Stopping: barrier={_barrier}, "
              f"stopped={_stopped_frac:.1%}, "
              f"E[M_tau]={np.mean(_m_tau):.2f}",
        xaxis_title="M_tau", yaxis_title="Count",
    )
    fig_stop
    return (fig_stop,)


@app.cell
def _(mo):
    mo.md(r"""
    ## Key Takeaways

    - **Martingale = fair game:** on average, the future value equals the present.
    - **Doob martingale:** $M_n = \mathbb{E}[X \mid \mathcal{F}_n]$ converges a.s.
      to $X$ as $n \to \infty$.
    - **Branching process:** $Z_n / \mu^n$ is a non-negative martingale and
      converges a.s. by the martingale convergence theorem.
    - **Optional stopping** can fail without boundedness: the unbounded stopping
      time $\tau = \inf\{n: S_n = a\}$ gives $\mathbb{E}[M_\tau] = a \neq 0$.
    """)
    return


if __name__ == "__main__":
    app.run()
