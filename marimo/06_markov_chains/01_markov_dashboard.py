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
    # Markov Chain Dashboard

    A **discrete-time Markov chain** on a finite state space $\mathcal{S}$
    is characterised by its **transition matrix** $P$, where

    $$P_{ij} = \mathbb{P}(X_{n+1} = j \mid X_n = i)$$

    The **Markov property** states that, given the present, the future is
    independent of the past:

    $$\mathbb{P}(X_{n+1} = j \mid X_0, \ldots, X_n)
      = \mathbb{P}(X_{n+1} = j \mid X_n)$$

    The **stationary distribution** $\pi$ satisfies $\pi P = \pi$ with
    $\sum_i \pi_i = 1$.
    """)
    return


@app.cell
def _(mo):
    COLORS = ['#2563eb', '#e97319', '#059669', '#7c3aed',
              '#db2777', '#0891b2', '#ca8a04', '#64748b']

    preset_dd = mo.ui.dropdown(
        options=["Weather (3 states)", "Gambler's Ruin (5 states)",
                 "Periodic (4 states)"],
        value="Weather (3 states)",
        label="Preset",
    )
    n_steps_slider = mo.ui.slider(
        start=50, stop=2000, step=50, value=500, label="n steps"
    )
    initial_state_slider = mo.ui.slider(
        start=0, stop=4, step=1, value=0, label="Initial state"
    )
    seed_slider = mo.ui.slider(
        start=0, stop=100, step=1, value=42, label="Seed"
    )
    mo.hstack([preset_dd, n_steps_slider, initial_state_slider, seed_slider])
    return COLORS, initial_state_slider, n_steps_slider, preset_dd, seed_slider


@app.cell
def _(np):
    def get_preset(name):
        """Return (transition_matrix, state_names) for a preset."""
        if name == "Weather (3 states)":
            P = np.array([
                [0.7, 0.2, 0.1],
                [0.3, 0.4, 0.3],
                [0.2, 0.3, 0.5],
            ])
            states = ["Sunny", "Cloudy", "Rainy"]
        elif name == "Gambler's Ruin (5 states)":
            P = np.array([
                [1.0, 0.0, 0.0, 0.0, 0.0],
                [0.4, 0.0, 0.6, 0.0, 0.0],
                [0.0, 0.4, 0.0, 0.6, 0.0],
                [0.0, 0.0, 0.4, 0.0, 0.6],
                [0.0, 0.0, 0.0, 0.0, 1.0],
            ])
            states = ["$0", "$1", "$2", "$3", "$4"]
        elif name == "Periodic (4 states)":
            P = np.array([
                [0.0, 0.5, 0.5, 0.0],
                [0.0, 0.0, 0.0, 1.0],
                [0.0, 0.0, 0.0, 1.0],
                [1.0, 0.0, 0.0, 0.0],
            ])
            states = ["A", "B", "C", "D"]
        else:
            P = np.eye(2)
            states = ["0", "1"]
        return P, states

    def compute_stationary(P):
        """Compute stationary distribution via eigendecomposition."""
        n = P.shape[0]
        eigenvalues, eigenvectors = np.linalg.eig(P.T)
        # Find eigenvector for eigenvalue closest to 1
        idx = np.argmin(np.abs(eigenvalues - 1.0))
        pi = np.real(eigenvectors[:, idx])
        pi = pi / pi.sum()
        # Ensure non-negative
        if np.any(pi < -1e-10):
            return np.ones(n) / n  # fallback for absorbing chains
        pi = np.maximum(pi, 0)
        pi = pi / pi.sum()
        return pi

    def simulate_chain(P, initial_state, n_steps, rng):
        """Simulate a Markov chain trajectory."""
        n = P.shape[0]
        trajectory = np.zeros(n_steps + 1, dtype=int)
        trajectory[0] = initial_state
        for k in range(n_steps):
            trajectory[k + 1] = rng.choice(n, p=P[trajectory[k]])
        return trajectory

    return compute_stationary, get_preset, simulate_chain


@app.cell
def _(np, go, make_subplots, COLORS, get_preset, preset_dd):
    _P, _states = get_preset(preset_dd.value)
    _n = len(_states)

    fig_matrix = make_subplots(
        rows=1, cols=2,
        subplot_titles=["Transition Matrix P", "State Diagram"],
        specs=[[{"type": "heatmap"}, {"type": "scatter"}]],
    )

    # Heatmap of transition matrix
    fig_matrix.add_trace(go.Heatmap(
        z=_P, x=_states, y=_states,
        colorscale=[[0, '#f0f4ff'], [1, COLORS[0]]],
        showscale=True, text=np.round(_P, 2),
        texttemplate="%{text}", textfont=dict(size=12),
    ), row=1, col=1)

    # State diagram as circular layout
    _angles = np.linspace(0, 2 * np.pi, _n, endpoint=False)
    _cx = np.cos(_angles)
    _cy = np.sin(_angles)

    # Draw edges (arrows)
    for _i in range(_n):
        for _j in range(_n):
            if _P[_i, _j] > 0.01:
                if _i == _j:
                    # Self-loop: small circle indicator
                    fig_matrix.add_trace(go.Scatter(
                        x=[_cx[_i]], y=[_cy[_i] + 0.15],
                        mode='text', text=[f"{_P[_i,_j]:.1f}"],
                        textfont=dict(size=9, color=COLORS[7]),
                        showlegend=False,
                    ), row=1, col=2)
                else:
                    _alpha = max(0.2, _P[_i, _j])
                    fig_matrix.add_trace(go.Scatter(
                        x=[_cx[_i], _cx[_j]], y=[_cy[_i], _cy[_j]],
                        mode='lines', line=dict(
                            color=COLORS[7], width=max(1, _P[_i, _j] * 4)),
                        opacity=_alpha, showlegend=False,
                    ), row=1, col=2)

    # Draw nodes
    fig_matrix.add_trace(go.Scatter(
        x=_cx, y=_cy, mode='markers+text',
        marker=dict(size=30, color=COLORS[0], line=dict(width=2, color='white')),
        text=_states, textposition='middle center',
        textfont=dict(color='white', size=12, family='Inter, sans-serif'),
        showlegend=False,
    ), row=1, col=2)

    fig_matrix.update_layout(
        template='plotly_white', height=400,
        font=dict(family='Inter, sans-serif', size=13, color='#1a1a2e'),
        plot_bgcolor='#ffffff', paper_bgcolor='#fafafa',
        margin=dict(l=60, r=30, t=60, b=50),
    )
    fig_matrix.update_xaxes(showgrid=False, zeroline=False, showticklabels=False,
                            row=1, col=2)
    fig_matrix.update_yaxes(showgrid=False, zeroline=False, showticklabels=False,
                            scaleanchor="x2", row=1, col=2)
    fig_matrix
    return (fig_matrix,)


@app.cell
def _(np, go, make_subplots, COLORS,
      get_preset, simulate_chain, compute_stationary,
      preset_dd, n_steps_slider, initial_state_slider, seed_slider):
    _rng = np.random.default_rng(seed_slider.value)
    _P, _states = get_preset(preset_dd.value)
    _n = len(_states)
    _init = min(initial_state_slider.value, _n - 1)
    _n_steps = n_steps_slider.value

    _traj = simulate_chain(_P, _init, _n_steps, _rng)
    _pi = compute_stationary(_P)

    fig_sim = make_subplots(
        rows=1, cols=2,
        subplot_titles=["Chain trajectory (first 200 steps)", "State occupancy"],
    )

    # Trajectory plot
    _show = min(200, _n_steps)
    fig_sim.add_trace(go.Scatter(
        x=np.arange(_show + 1), y=_traj[:_show + 1],
        mode='lines+markers',
        line=dict(color=COLORS[0], width=1),
        marker=dict(size=3, color=COLORS[0]),
        name='X_n',
    ), row=1, col=1)

    # Occupancy histogram
    _counts = np.bincount(_traj, minlength=_n)[:_n]
    _empirical = _counts / len(_traj)

    fig_sim.add_trace(go.Bar(
        x=_states, y=_empirical,
        marker_color=COLORS[0], name='Empirical freq', opacity=0.7,
    ), row=1, col=2)
    fig_sim.add_trace(go.Bar(
        x=_states, y=_pi,
        marker_color=COLORS[1], name='Stationary pi', opacity=0.7,
    ), row=1, col=2)

    fig_sim.update_layout(
        template='plotly_white', height=400,
        font=dict(family='Inter, sans-serif', size=13, color='#1a1a2e'),
        plot_bgcolor='#ffffff', paper_bgcolor='#fafafa',
        margin=dict(l=60, r=30, t=60, b=50),
        barmode='group',
        title=f"Simulation: {_n_steps} steps from state {_states[_init]}",
    )
    fig_sim.update_xaxes(title_text="Step n", row=1, col=1)
    fig_sim.update_yaxes(title_text="State", row=1, col=1)
    fig_sim.update_xaxes(title_text="State", row=1, col=2)
    fig_sim.update_yaxes(title_text="Frequency", row=1, col=2)
    fig_sim
    return (fig_sim,)


@app.cell
def _(mo, np, get_preset, compute_stationary, preset_dd):
    _P, _states = get_preset(preset_dd.value)
    _pi = compute_stationary(_P)
    _n = len(_states)

    _eigenvalues = np.sort(np.abs(np.linalg.eigvals(_P)))[::-1]

    _rows = "| State | pi_i |\n|---|---|\n"
    for _i in range(_n):
        _rows += f"| {_states[_i]} | {_pi[_i]:.4f} |\n"

    _eig_str = ", ".join([f"{v:.4f}" for v in _eigenvalues])

    mo.md(f"""
    ### Stationary Distribution: $\\pi P = \\pi$

    {_rows}

    **Eigenvalues of P:** {_eig_str}

    **Verification:** $\\|\\pi P - \\pi\\|_\\infty$ = {np.max(np.abs(_pi @ _P - _pi)):.2e}

    For an **irreducible, aperiodic** chain, the stationary distribution is
    unique and $P^n(x, \\cdot) \\to \\pi$ for any starting state $x$.
    """)
    return


if __name__ == "__main__":
    app.run()
