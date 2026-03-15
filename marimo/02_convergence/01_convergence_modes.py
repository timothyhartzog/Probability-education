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
    # 2.1 Convergence Mode Comparator

    Random variables can converge in several distinct senses, each with different
    strength. This notebook lets you **compare four fundamental modes of convergence**
    side by side through concrete, constructive examples.

    | Mode | Notation | Definition |
    |------|----------|------------|
    | Almost sure | $X_n \xrightarrow{\text{a.s.}} X$ | $P\!\bigl(\omega : X_n(\omega) \to X(\omega)\bigr) = 1$ |
    | In probability | $X_n \xrightarrow{P} X$ | $\forall\,\varepsilon>0,\; P(\lvert X_n - X\rvert > \varepsilon) \to 0$ |
    | In $L^p$ | $X_n \xrightarrow{L^p} X$ | $E[\lvert X_n - X\rvert^p] \to 0$ |
    | In distribution | $X_n \xrightarrow{d} X$ | $F_{X_n}(x) \to F_X(x)$ at continuity points |

    **Implication hierarchy:** a.s. $\Rightarrow$ in probability $\Leftarrow$ $L^p$ $\Rightarrow$ in distribution.
    None of the reverse implications hold in general.
    """)
    return


@app.cell
def _(mo):
    COLORS = ['#2563eb', '#e97319', '#059669', '#7c3aed',
              '#db2777', '#0891b2', '#ca8a04', '#64748b']

    example_dropdown = mo.ui.dropdown(
        options={
            "X_n = Z * 1_{U > 1/n}  (a.s. & in prob)": "indicator",
            "Sliding bump  (in prob, NOT a.s.)": "sliding_bump",
            "X_n = n * 1_{U < 1/n}  (in dist, NOT in prob)": "spike",
            "X_n ~ N(0, 1/n)  (all four modes)": "normal_shrink",
        },
        value="X_n = Z * 1_{U > 1/n}  (a.s. & in prob)",
        label="Example sequence",
    )
    n_slider = mo.ui.slider(10, 500, value=100, step=10, label="Max n")
    eps_slider = mo.ui.slider(0.05, 1.0, value=0.3, step=0.05, label="Epsilon (ε)")
    paths_slider = mo.ui.slider(5, 50, value=20, step=5, label="Number of paths")
    seed_slider = mo.ui.slider(0, 100, value=42, step=1, label="Seed")

    controls = mo.hstack([example_dropdown, n_slider, eps_slider, paths_slider, seed_slider], wrap=True)
    controls
    return COLORS, eps_slider, example_dropdown, n_slider, paths_slider, seed_slider


@app.cell
def _(example_dropdown, mo):
    descriptions = {
        "indicator": r"""
**Example:** $X_n = Z \cdot \mathbf{1}_{\{U > 1/n\}}$ where $Z \sim N(0,1)$, $U \sim \text{Uniform}(0,1)$.

For each $\omega$, once $n > 1/U(\omega)$ (which happens for all $U > 0$), we have $X_n(\omega) = Z(\omega)$.
So $X_n \to Z$ **almost surely** (and hence in probability, in $L^p$, and in distribution).

| a.s. | in prob | $L^p$ | in dist |
|:----:|:-------:|:-----:|:-------:|
| YES | YES | YES | YES |
        """,
        "sliding_bump": r"""
**Example: Sliding Bump.** Partition $[0,1)$ into successive intervals of length $1/1, 1/2, 1/2, 1/3, 1/3, 1/3, \ldots$
Define $X_n(\omega) = 1$ if $\omega$ falls in the $n$-th interval, else $0$.

Then $P(|X_n| > \varepsilon) \to 0$ (convergence **in probability** to 0),
but for every $\omega$, $X_n(\omega) = 1$ infinitely often, so **NOT a.s.** convergent.

| a.s. | in prob | $L^p$ | in dist |
|:----:|:-------:|:-----:|:-------:|
| NO | YES | YES | YES |
        """,
        "spike": r"""
**Example:** $X_n = n \cdot \mathbf{1}_{\{U < 1/n\}}$ where $U \sim \text{Uniform}(0,1)$.

$P(X_n \neq 0) = 1/n \to 0$, so $X_n \xrightarrow{P} 0$. But $E[X_n] = 1$ for all $n$,
so $X_n$ does **not** converge in $L^1$. It does converge **in distribution** to 0.

| a.s. | in prob | $L^p$ | in dist |
|:----:|:-------:|:-----:|:-------:|
| YES | YES | NO | YES |
        """,
        "normal_shrink": r"""
**Example:** $X_n \sim N(0, 1/n)$.

As $n \to \infty$, the variance $\to 0$, so $X_n \to 0$ in **all four modes**:
a.s., in probability, in $L^p$ (for all $p$), and in distribution.

| a.s. | in prob | $L^p$ | in dist |
|:----:|:-------:|:-----:|:-------:|
| YES | YES | YES | YES |
        """,
    }
    key = {v: k for k, v in example_dropdown.options.items()}[example_dropdown.value]
    mo.md(descriptions[key])
    return


@app.cell
def _(COLORS, eps_slider, example_dropdown, go, make_subplots, mo, np, n_slider, paths_slider, seed_slider):
    _mode_key = {v: k for k, v in example_dropdown.options.items()}[example_dropdown.value]
    _n_max = n_slider.value
    _eps = eps_slider.value
    _n_paths = paths_slider.value
    _rng = np.random.default_rng(seed_slider.value)
    _ns = np.arange(1, _n_max + 1)

    # --- Generate paths ---
    def _gen_indicator(rng, n_max, n_paths):
        Z = rng.standard_normal(n_paths)
        U = rng.random(n_paths)
        paths = np.zeros((n_paths, n_max))
        for i in range(n_paths):
            for n in range(n_max):
                paths[i, n] = Z[i] if U[i] > 1.0 / (n + 1) else 0.0
        limits = Z
        return paths, limits

    def _gen_sliding_bump(rng, n_max, n_paths):
        omega = rng.random(n_paths)
        paths = np.zeros((n_paths, n_max))
        idx = 0
        k = 1
        while idx < n_max:
            seg_len = 1.0 / k
            for j in range(k):
                if idx >= n_max:
                    break
                lo = j * seg_len
                hi = lo + seg_len
                for i in range(n_paths):
                    paths[i, idx] = 1.0 if lo <= omega[i] < hi else 0.0
                idx += 1
            k += 1
        limits = np.zeros(n_paths)
        return paths, limits

    def _gen_spike(rng, n_max, n_paths):
        U = rng.random(n_paths)
        paths = np.zeros((n_paths, n_max))
        for i in range(n_paths):
            for n in range(n_max):
                paths[i, n] = (n + 1) if U[i] < 1.0 / (n + 1) else 0.0
        limits = np.zeros(n_paths)
        return paths, limits

    def _gen_normal_shrink(rng, n_max, n_paths):
        paths = np.zeros((n_paths, n_max))
        for n in range(n_max):
            paths[:, n] = rng.normal(0, 1.0 / np.sqrt(n + 1), size=n_paths)
        limits = np.zeros(n_paths)
        return paths, limits

    generators = {
        "indicator": _gen_indicator,
        "sliding_bump": _gen_sliding_bump,
        "spike": _gen_spike,
        "normal_shrink": _gen_normal_shrink,
    }
    _paths, _limits = generators[_mode_key](_rng, _n_max, _n_paths)

    # --- Compute P(|X_n - X| > eps) empirically ---
    _deviations = np.abs(_paths - _limits[:, None])
    _prob_exceed = np.mean(_deviations > _eps, axis=0)

    # --- Plot ---
    _fig = make_subplots(
        rows=1, cols=2,
        subplot_titles=["Sample Paths X_n(w)", "P(|X_n - X| > epsilon)"],
        column_widths=[0.55, 0.45],
    )
    _fig.update_layout(
        template='plotly_white',
        font=dict(family='Inter, Helvetica Neue, sans-serif', size=13),
        height=480,
        margin=dict(l=60, r=30, t=60, b=50),
        showlegend=False,
    )

    # Sample paths
    _show_paths = min(_n_paths, 20)
    for _i in range(_show_paths):
        _fig.add_trace(go.Scatter(
            x=_ns, y=_paths[_i],
            mode='lines',
            line=dict(color=COLORS[_i % len(COLORS)], width=1),
            opacity=0.5,
            showlegend=False,
        ), row=1, col=1)

    # Limit line (for first path's limit as representative)
    if _mode_key == "indicator":
        _fig.add_trace(go.Scatter(
            x=[1, _n_max], y=[_limits[0], _limits[0]],
            mode='lines',
            line=dict(color='#dc2626', width=2, dash='dash'),
            name='Limit Z(w1)',
            showlegend=True,
        ), row=1, col=1)
    else:
        _fig.add_hline(y=0, line_dash="dash", line_color="#dc2626",
                       line_width=2, row=1, col=1)

    _fig.update_xaxes(title_text="n", row=1, col=1)
    _fig.update_yaxes(title_text="X_n(w)", row=1, col=1)

    # Probability of deviation
    _fig.add_trace(go.Scatter(
        x=_ns, y=_prob_exceed,
        mode='lines',
        line=dict(color=COLORS[0], width=2),
        fill='tozeroy',
        fillcolor='rgba(37,99,235,0.15)',
        showlegend=False,
    ), row=1, col=2)

    _fig.add_hline(y=0, line_dash="dash", line_color="#999", row=1, col=2)
    _fig.update_xaxes(title_text="n", row=1, col=2)
    _fig.update_yaxes(title_text=f"P(|X_n - X| > {_eps})", range=[-0.05, 1.05], row=1, col=2)

    mo.ui.plotly(_fig)
    return


@app.cell
def _(COLORS, eps_slider, example_dropdown, go, mo, np, n_slider, seed_slider):
    _mode_key = {v: k for k, v in example_dropdown.options.items()}[example_dropdown.value]
    _n_max = n_slider.value
    _eps = eps_slider.value
    _rng = np.random.default_rng(seed_slider.value + 1000)
    _n_mc = 2000
    _ns = np.arange(1, _n_max + 1)

    # Monte Carlo for L^p norms
    def _compute_lp(mode_key, rng, n_max, n_mc):
        if mode_key == "indicator":
            Z = rng.standard_normal(n_mc)
            U = rng.random(n_mc)
            l1 = np.zeros(n_max)
            l2 = np.zeros(n_max)
            for n in range(n_max):
                Xn = np.where(U > 1.0 / (n + 1), Z, 0.0)
                diff = np.abs(Xn - Z)
                l1[n] = np.mean(diff)
                l2[n] = np.mean(diff ** 2)
        elif mode_key == "sliding_bump":
            omega = rng.random(n_mc)
            l1 = np.zeros(n_max)
            l2 = np.zeros(n_max)
            idx = 0
            k = 1
            while idx < n_max:
                seg_len = 1.0 / k
                for j in range(k):
                    if idx >= n_max:
                        break
                    lo = j * seg_len
                    hi = lo + seg_len
                    Xn = np.where((omega >= lo) & (omega < hi), 1.0, 0.0)
                    l1[idx] = np.mean(np.abs(Xn))
                    l2[idx] = np.mean(Xn ** 2)
                    idx += 1
                k += 1
        elif mode_key == "spike":
            U = rng.random(n_mc)
            l1 = np.zeros(n_max)
            l2 = np.zeros(n_max)
            for n in range(n_max):
                Xn = np.where(U < 1.0 / (n + 1), float(n + 1), 0.0)
                l1[n] = np.mean(np.abs(Xn))
                l2[n] = np.mean(Xn ** 2)
        else:
            l1 = np.zeros(n_max)
            l2 = np.zeros(n_max)
            for n in range(n_max):
                Xn = rng.normal(0, 1.0 / np.sqrt(n + 1), size=n_mc)
                l1[n] = np.mean(np.abs(Xn))
                l2[n] = np.mean(Xn ** 2)
        return l1, np.sqrt(l2)

    _l1, _l2 = _compute_lp(_mode_key, _rng, _n_max, _n_mc)

    _fig2 = go.Figure()
    _fig2.update_layout(
        template='plotly_white',
        font=dict(family='Inter, Helvetica Neue, sans-serif', size=13),
        height=380,
        title="L^p Norms: E[|X_n - X|^p]^{1/p}",
        xaxis_title="n",
        yaxis_title="Norm value",
        margin=dict(l=60, r=30, t=60, b=50),
    )
    _fig2.add_trace(go.Scatter(
        x=_ns, y=_l1, mode='lines', name='L1 norm',
        line=dict(color=COLORS[2], width=2),
    ))
    _fig2.add_trace(go.Scatter(
        x=_ns, y=_l2, mode='lines', name='L2 norm',
        line=dict(color=COLORS[3], width=2),
    ))
    _fig2.update_yaxes(rangemode="tozero")

    mo.ui.plotly(_fig2)
    return


@app.cell
def _(mo):
    mo.md(r"""
    ## Key Takeaways

    - **Almost sure** convergence is pathwise: for (almost) every $\omega$, the sequence settles down.
    - **In probability** only requires the *probability of large deviations* to vanish; individual paths may misbehave.
    - **$L^p$ convergence** controls the *average size* of deviations, which is stronger than convergence in probability.
    - **In distribution** is the weakest mode --- it only concerns the CDFs, not the joint behaviour of $X_n$ and $X$.

    Try the **sliding bump** example to see a sequence that converges in probability but *not* almost surely:
    every sample path revisits 1 infinitely often, yet for each fixed $n$, only a small fraction of paths are at 1.

    ---
    *Module 2.1 --- Convergence Mode Comparator*
    *Probability Education Platform*
    """)
    return


if __name__ == "__main__":
    app.run()
