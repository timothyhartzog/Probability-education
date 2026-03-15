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
    # Ergodic Theory & Mixing Times

    For an **irreducible, aperiodic** Markov chain with transition matrix $P$
    and stationary distribution $\pi$:

    $$\|P^n(x, \cdot) - \pi\|_{TV} \;\to\; 0 \quad \text{as } n \to \infty$$

    The **mixing time** $t_{\text{mix}}(\varepsilon)$ is the smallest $n$ such that

    $$\max_x \|P^n(x, \cdot) - \pi\|_{TV} \le \varepsilon$$

    The rate of convergence is controlled by the **spectral gap**
    $\gamma = 1 - \lambda_2$, where $\lambda_2$ is the second-largest eigenvalue
    magnitude of $P$.
    """)
    return


@app.cell
def _(mo):
    COLORS = ['#2563eb', '#e97319', '#059669', '#7c3aed',
              '#db2777', '#0891b2', '#ca8a04', '#64748b']

    preset_dd = mo.ui.dropdown(
        options=["Weather (3 states)", "Lazy Random Walk (5 states)",
                 "Nearly Decomposable (4 states)"],
        value="Weather (3 states)",
        label="Preset",
    )
    initial_dd = mo.ui.dropdown(
        options=["State 0", "State 1", "State 2", "State 3", "State 4"],
        value="State 0",
        label="Initial state",
    )
    n_steps_slider = mo.ui.slider(
        start=5, stop=200, step=5, value=50, label="Max power n"
    )
    mo.hstack([preset_dd, initial_dd, n_steps_slider])
    return COLORS, initial_dd, n_steps_slider, preset_dd


@app.cell
def _(np):
    def get_preset_ergodic(name):
        """Return (P, state_names) for mixing-time presets."""
        if name == "Weather (3 states)":
            P = np.array([
                [0.7, 0.2, 0.1],
                [0.3, 0.4, 0.3],
                [0.2, 0.3, 0.5],
            ])
            states = ["Sunny", "Cloudy", "Rainy"]
        elif name == "Lazy Random Walk (5 states)":
            # Lazy RW on cycle: stay with prob 0.5, move L/R with 0.25 each
            n = 5
            P = np.zeros((n, n))
            for i in range(n):
                P[i, i] = 0.5
                P[i, (i + 1) % n] = 0.25
                P[i, (i - 1) % n] = 0.25
            states = [f"S{i}" for i in range(n)]
        elif name == "Nearly Decomposable (4 states)":
            # Two clusters weakly connected
            eps = 0.02
            P = np.array([
                [0.7, 0.3 - eps, eps, 0.0],
                [0.3 - eps, 0.7, 0.0, eps],
                [eps, 0.0, 0.7, 0.3 - eps],
                [0.0, eps, 0.3 - eps, 0.7],
            ])
            states = ["A1", "A2", "B1", "B2"]
        else:
            P = np.eye(2)
            states = ["0", "1"]
        return P, states

    def compute_stationary_eig(P):
        """Compute stationary distribution via left eigenvector."""
        eigenvalues, eigenvectors = np.linalg.eig(P.T)
        idx = np.argmin(np.abs(eigenvalues - 1.0))
        pi = np.real(eigenvectors[:, idx])
        pi = np.maximum(pi, 0)
        pi = pi / pi.sum()
        return pi

    def total_variation(p, q):
        """Total variation distance between two distributions."""
        return 0.5 * np.sum(np.abs(p - q))

    return compute_stationary_eig, get_preset_ergodic, total_variation


@app.cell
def _(np, go, make_subplots, COLORS,
      get_preset_ergodic, compute_stationary_eig, total_variation,
      preset_dd, initial_dd, n_steps_slider):
    _P, _states = get_preset_ergodic(preset_dd.value)
    _k = len(_states)
    _pi = compute_stationary_eig(_P)
    _init_idx = min(int(initial_dd.value.split()[-1]), _k - 1)
    _max_n = n_steps_slider.value

    # Compute P^n for n = 1, ..., max_n
    _Pn = np.eye(_k)
    _tv_distances = np.zeros((_k, _max_n + 1))
    _distributions = []

    for _n in range(_max_n + 1):
        if _n > 0:
            _Pn = _Pn @ _P
        for _s in range(_k):
            _tv_distances[_s, _n] = total_variation(_Pn[_s], _pi)
        _distributions.append(_Pn[_init_idx].copy())

    _distributions = np.array(_distributions)

    fig_conv = make_subplots(
        rows=1, cols=2,
        subplot_titles=[
            f"P^n({_states[_init_idx]}, .) convergence",
            "TV distance vs n (all starting states)",
        ],
    )

    # Left: distribution convergence
    for _j in range(_k):
        fig_conv.add_trace(go.Scatter(
            x=np.arange(_max_n + 1), y=_distributions[:, _j],
            mode='lines', line=dict(color=COLORS[_j % len(COLORS)], width=2),
            name=f'P^n -> {_states[_j]}',
        ), row=1, col=1)
        # Stationary value
        fig_conv.add_hline(y=_pi[_j], line_dash="dot",
                           line_color=COLORS[_j % len(COLORS)],
                           row=1, col=1, opacity=0.5)

    # Right: TV distance decay
    for _s in range(_k):
        fig_conv.add_trace(go.Scatter(
            x=np.arange(_max_n + 1), y=_tv_distances[_s],
            mode='lines', line=dict(color=COLORS[_s % len(COLORS)], width=2),
            name=f'TV from {_states[_s]}', showlegend=False,
        ), row=1, col=2)

    # Mixing time line at epsilon = 0.25
    _eps = 0.25
    _max_tv = np.max(_tv_distances, axis=0)
    _mix_candidates = np.where(_max_tv <= _eps)[0]
    if len(_mix_candidates) > 0:
        _t_mix = _mix_candidates[0]
        fig_conv.add_vline(x=_t_mix, line_dash="dash", line_color=COLORS[7],
                           row=1, col=2,
                           annotation_text=f"t_mix(0.25)={_t_mix}")

    fig_conv.update_layout(
        template='plotly_white', height=400,
        font=dict(family='Inter, sans-serif', size=13, color='#1a1a2e'),
        plot_bgcolor='#ffffff', paper_bgcolor='#fafafa',
        margin=dict(l=60, r=30, t=60, b=50),
    )
    fig_conv.update_xaxes(title_text="n", row=1, col=1)
    fig_conv.update_yaxes(title_text="P^n(x, j)", row=1, col=1)
    fig_conv.update_xaxes(title_text="n", row=1, col=2)
    fig_conv.update_yaxes(title_text="||P^n(x,.) - pi||_TV", type="log",
                          row=1, col=2)
    fig_conv
    return (fig_conv,)


@app.cell
def _(mo):
    mo.md(r"""
    ## Spectral Gap Analysis

    The eigenvalues of $P$ control the mixing rate. For a reversible chain:

    $$\|P^n(x, \cdot) - \pi\|_{TV} \le \frac{1}{2}\sqrt{\frac{1-\pi_x}{\pi_x}} \cdot \lambda_\star^n$$

    where $\lambda_\star = \max(|\lambda_2|, |\lambda_k|)$ is the second-largest
    eigenvalue in absolute value. The **spectral gap** is $\gamma = 1 - \lambda_\star$.
    """)
    return


@app.cell
def _(np, go, make_subplots, COLORS,
      get_preset_ergodic, compute_stationary_eig, preset_dd):
    _P, _states = get_preset_ergodic(preset_dd.value)
    _k = len(_states)
    _pi = compute_stationary_eig(_P)

    # Eigenvalue analysis
    _eigenvalues = np.linalg.eigvals(_P)
    _eig_sorted = sorted(_eigenvalues, key=lambda x: -abs(x))
    _eig_abs = np.sort(np.abs(_eigenvalues))[::-1]

    _lambda_star = _eig_abs[1] if len(_eig_abs) > 1 else 0
    _spectral_gap = 1 - _lambda_star

    # Mixing time bounds
    _t_mix_lower = max(1, int(np.ceil((_lambda_star / (1 - _lambda_star))
                                       * np.log(1 / (2 * 0.25)))))
    _t_mix_upper = max(1, int(np.ceil((1 / _spectral_gap)
                                       * np.log(1 / (min(_pi) * 0.25)))))

    fig_spec = make_subplots(
        rows=1, cols=2,
        subplot_titles=["Eigenvalues of P", "Spectral bound vs actual TV"],
    )

    # Eigenvalues in complex plane
    _theta = np.linspace(0, 2 * np.pi, 100)
    fig_spec.add_trace(go.Scatter(
        x=np.cos(_theta), y=np.sin(_theta), mode='lines',
        line=dict(color=COLORS[7], width=1, dash='dot'),
        name='Unit circle', showlegend=False,
    ), row=1, col=1)
    fig_spec.add_trace(go.Scatter(
        x=np.real(_eigenvalues), y=np.imag(_eigenvalues),
        mode='markers',
        marker=dict(size=12, color=COLORS[0],
                    line=dict(width=2, color='white')),
        name='Eigenvalues',
    ), row=1, col=1)

    # Spectral bound vs actual TV
    _max_n = 100
    _Pn = np.eye(_k)
    _actual_tv = np.zeros(_max_n)
    for _n in range(_max_n):
        _Pn = _Pn @ _P
        _max_tv = 0
        for _s in range(_k):
            _tv = 0.5 * np.sum(np.abs(_Pn[_s] - _pi))
            _max_tv = max(_max_tv, _tv)
        _actual_tv[_n] = _max_tv

    _ns = np.arange(_max_n)
    _spectral_bound = _lambda_star ** _ns

    fig_spec.add_trace(go.Scatter(
        x=_ns, y=_actual_tv, mode='lines',
        line=dict(color=COLORS[0], width=2),
        name='max TV distance',
    ), row=1, col=2)
    fig_spec.add_trace(go.Scatter(
        x=_ns, y=_spectral_bound, mode='lines',
        line=dict(color=COLORS[1], width=2, dash='dash'),
        name=f'lambda*^n ({_lambda_star:.3f}^n)',
    ), row=1, col=2)

    fig_spec.update_layout(
        template='plotly_white', height=400,
        font=dict(family='Inter, sans-serif', size=13, color='#1a1a2e'),
        plot_bgcolor='#ffffff', paper_bgcolor='#fafafa',
        margin=dict(l=60, r=30, t=60, b=50),
    )
    fig_spec.update_xaxes(title_text="Re", row=1, col=1)
    fig_spec.update_yaxes(title_text="Im", scaleanchor="x", row=1, col=1)
    fig_spec.update_xaxes(title_text="n", row=1, col=2)
    fig_spec.update_yaxes(title_text="TV / bound", type="log", row=1, col=2)
    fig_spec
    return _lambda_star, _spectral_gap, _t_mix_lower, _t_mix_upper, fig_spec


@app.cell
def _(mo, np, get_preset_ergodic, compute_stationary_eig, preset_dd,
      _lambda_star, _spectral_gap, _t_mix_lower, _t_mix_upper):
    _P, _states = get_preset_ergodic(preset_dd.value)
    _pi = compute_stationary_eig(_P)
    _eigenvalues = np.linalg.eigvals(_P)
    _eig_sorted = sorted(np.abs(_eigenvalues), reverse=True)

    _eig_str = ", ".join([f"{v:.4f}" for v in _eig_sorted])

    mo.md(f"""
    ### Summary for: {preset_dd.value}

    | Quantity | Value |
    |---|---|
    | Eigenvalue magnitudes | {_eig_str} |
    | $\\lambda_\\star$ (SLEM) | {_lambda_star:.4f} |
    | Spectral gap $\\gamma = 1 - \\lambda_\\star$ | {_spectral_gap:.4f} |
    | $t_{{\\text{{mix}}}}(0.25)$ lower bound | {_t_mix_lower} |
    | $t_{{\\text{{mix}}}}(0.25)$ upper bound | {_t_mix_upper} |

    **Interpretation:**
    - A **larger spectral gap** means faster mixing.
    - The "Nearly Decomposable" chain has $\\lambda_\\star \\approx 1$,
      so it mixes very slowly -- the chain gets trapped in clusters.
    - The TV distance decays as $O(\\lambda_\\star^n)$, and the mixing time
      scales as $t_{{\\text{{mix}}}} \\asymp 1/\\gamma$.
    """)
    return


if __name__ == "__main__":
    app.run()
