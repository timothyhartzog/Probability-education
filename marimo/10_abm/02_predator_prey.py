import marimo

app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import numpy as np
    import plotly.graph_objects as go
    from plotly.subplots import make_subplots
    from scipy.integrate import odeint
    import sys
    sys.path.insert(0, "..")
    from shared.plotting import VIZ_COLORS, DEFAULT_LAYOUT, styled_figure
    return mo, np, go, make_subplots, odeint, VIZ_COLORS, DEFAULT_LAYOUT, styled_figure


@app.cell
def _(mo):
    mo.md(r"""
    # 10.2 Predator-Prey Agent-Based Model

    This notebook implements a **Lotka-Volterra-style predator-prey ecosystem** as an
    agent-based model on a 2-D grid. Three entity types occupy the grid:

    - **Grass** (green): regrows after being eaten, with a fixed regrowth timer.
    - **Prey** (blue): eat grass to gain energy, move randomly, reproduce with probability $p_{\text{repr}}$.
    - **Predators** (orange): hunt prey to gain energy, lose energy each step, starve at zero energy.

    The classical **Lotka-Volterra ODEs** for comparison are:

    $$\frac{dx}{dt} = \alpha x - \beta x y, \qquad \frac{dy}{dt} = \delta x y - \gamma y$$

    where $x$ is prey count and $y$ is predator count. The ABM produces similar oscillatory
    dynamics but with stochastic fluctuations and the possibility of extinction.
    """)
    return


@app.cell
def _(mo):
    grid_size = mo.ui.slider(start=20, stop=60, step=5, value=30, label="Grid size N")
    initial_prey = mo.ui.slider(start=20, stop=300, step=10, value=100, label="Initial prey")
    initial_predators = mo.ui.slider(start=5, stop=100, step=5, value=30, label="Initial predators")
    prey_reproduce = mo.ui.slider(start=0.01, stop=0.15, step=0.01, value=0.04, label="Prey reproduce rate")
    predator_hunt = mo.ui.slider(start=0.3, stop=1.0, step=0.05, value=0.6, label="Predator hunt prob")
    predator_starve = mo.ui.slider(start=1, stop=10, step=1, value=5, label="Predator max starve steps")
    n_steps = mo.ui.slider(start=50, stop=500, step=25, value=200, label="Time steps")
    seed_slider = mo.ui.slider(start=0, stop=99, step=1, value=7, label="Random seed")

    controls = mo.hstack(
        [grid_size, initial_prey, initial_predators, prey_reproduce,
         predator_hunt, predator_starve, n_steps, seed_slider],
        wrap=True,
    )
    mo.md(f"**Model parameters:** {controls}")
    return (grid_size, initial_prey, initial_predators, prey_reproduce,
            predator_hunt, predator_starve, n_steps, seed_slider)


@app.cell
def _(np, grid_size, initial_prey, initial_predators, prey_reproduce,
      predator_hunt, predator_starve, n_steps, seed_slider):
    # --- Predator-Prey ABM simulation ---
    _N = grid_size.value
    _n_prey0 = min(initial_prey.value, _N * _N // 2)
    _n_pred0 = min(initial_predators.value, _N * _N // 4)
    _p_repr = prey_reproduce.value
    _p_hunt = predator_hunt.value
    _max_starve = predator_starve.value
    _T = n_steps.value
    rng = np.random.default_rng(seed_slider.value)

    # Represent agents as lists of (row, col, energy)
    # Place agents randomly
    all_positions = [(r, c) for r in range(_N) for c in range(_N)]
    rng.shuffle(all_positions)

    prey_list = [dict(r=p[0], c=p[1], energy=4) for p in all_positions[:_n_prey0]]
    pred_list = [dict(r=p[0], c=p[1], energy=_max_starve)
                 for p in all_positions[_n_prey0:_n_prey0 + _n_pred0]]

    # Grass grid: 0 = grass present, >0 = regrowing (countdown)
    grass = np.zeros((_N, _N), dtype=int)
    grass_regrow_time = 5

    prey_counts = [len(prey_list)]
    pred_counts = [len(pred_list)]
    grass_counts = [int(np.sum(grass == 0))]

    snapshot_steps = {0, _T // 4, _T // 2, 3 * _T // 4, _T}
    snapshots = {}

    def _make_snapshot():
        s = np.full((_N, _N), 0)  # 0 = empty/no-grass
        s[grass == 0] = 1  # 1 = grass
        for a in prey_list:
            s[a["r"], a["c"]] = 2  # 2 = prey
        for a in pred_list:
            s[a["r"], a["c"]] = 3  # 3 = predator
        return s

    snapshots[0] = _make_snapshot()

    def _move(agent):
        dr, dc = [(0, 1), (0, -1), (1, 0), (-1, 0)][rng.integers(4)]
        agent["r"] = (agent["r"] + dr) % _N
        agent["c"] = (agent["c"] + dc) % _N

    for t in range(1, _T + 1):
        # --- Grass regrowth ---
        regrowing = grass > 0
        grass[regrowing] -= 1

        # --- Prey phase ---
        new_prey = []
        for a in prey_list:
            _move(a)
            # Eat grass
            if grass[a["r"], a["c"]] == 0:
                a["energy"] += 2
                grass[a["r"], a["c"]] = grass_regrow_time
            a["energy"] -= 1
            if a["energy"] <= 0:
                continue  # prey dies
            # Reproduce
            if rng.random() < _p_repr:
                a["energy"] //= 2
                new_prey.append(dict(r=a["r"], c=a["c"], energy=a["energy"]))
        prey_list.extend(new_prey)
        prey_list = [a for a in prey_list if a["energy"] > 0]

        # --- Predator phase ---
        # Build prey occupancy lookup
        prey_map = {}
        for i, a in enumerate(prey_list):
            prey_map.setdefault((a["r"], a["c"]), []).append(i)

        eaten_indices = set()
        new_preds = []
        for a in pred_list:
            _move(a)
            # Hunt prey at current cell
            key = (a["r"], a["c"])
            if key in prey_map and prey_map[key]:
                if rng.random() < _p_hunt:
                    victim = prey_map[key].pop()
                    eaten_indices.add(victim)
                    a["energy"] += 5
                    # Predator reproduces after successful hunt
                    if rng.random() < _p_repr:
                        a["energy"] //= 2
                        new_preds.append(dict(r=a["r"], c=a["c"], energy=a["energy"]))
            a["energy"] -= 1

        prey_list = [a for i, a in enumerate(prey_list) if i not in eaten_indices]
        pred_list = [a for a in pred_list if a["energy"] > 0]
        pred_list.extend(new_preds)

        prey_counts.append(len(prey_list))
        pred_counts.append(len(pred_list))
        grass_counts.append(int(np.sum(grass == 0)))

        if t in snapshot_steps:
            snapshots[t] = _make_snapshot()

    abm_results = dict(
        prey_counts=prey_counts, pred_counts=pred_counts,
        grass_counts=grass_counts, snapshots=snapshots,
        N=_N, T=_T, p_repr=_p_repr, p_hunt=_p_hunt,
    )
    return abm_results, rng


@app.cell
def _(mo):
    mo.md(r"""
    ## Grid Snapshots

    **Dark green** = grass, **Blue** = prey, **Orange** = predator, **Tan** = bare ground.
    """)
    return


@app.cell
def _(go, make_subplots, abm_results, VIZ_COLORS, DEFAULT_LAYOUT):
    _snaps = abm_results["snapshots"]
    _keys = sorted(_snaps.keys())
    _n = len(_keys)

    fig_snap = make_subplots(rows=1, cols=_n, subplot_titles=[f"t = {k}" for k in _keys])

    _colorscale = [
        [0.0, "#d2b48c"],       # 0 bare
        [0.333, VIZ_COLORS[2]], # 1 grass - green
        [0.667, VIZ_COLORS[0]], # 2 prey - blue
        [1.0, VIZ_COLORS[1]],   # 3 predator - orange
    ]

    for idx, k in enumerate(_keys):
        fig_snap.add_trace(
            go.Heatmap(
                z=_snaps[k], colorscale=_colorscale,
                zmin=0, zmax=3,
                showscale=(idx == _n - 1),
                colorbar=dict(tickvals=[0, 1, 2, 3], ticktext=["Bare", "Grass", "Prey", "Pred"]),
            ),
            row=1, col=idx + 1,
        )

    fig_snap.update_layout(**DEFAULT_LAYOUT, height=320, title="Ecosystem Snapshots")
    for i in range(1, _n + 1):
        fig_snap.update_xaxes(showticklabels=False, row=1, col=i)
        fig_snap.update_yaxes(showticklabels=False, row=1, col=i)
    fig_snap
    return fig_snap,


@app.cell
def _(mo):
    mo.md(r"""
    ## Population Time Series & ODE Comparison

    The left panel shows the ABM population dynamics. The right panel overlays the
    deterministic **Lotka-Volterra ODE** solution (dashed) for comparison. ODE parameters
    are fitted from the ABM initial conditions and rates.
    """)
    return


@app.cell
def _(go, np, odeint, make_subplots, abm_results, VIZ_COLORS, DEFAULT_LAYOUT):
    _T = abm_results["T"]
    _time = np.arange(_T + 1)
    _prey = np.array(abm_results["prey_counts"], dtype=float)
    _pred = np.array(abm_results["pred_counts"], dtype=float)

    fig_pop = make_subplots(rows=1, cols=2, subplot_titles=["ABM Dynamics", "ABM vs ODE"])

    # ABM curves
    for _data, _name, _color, _col in [
        (_prey, "Prey (ABM)", VIZ_COLORS[0], 1),
        (_pred, "Predators (ABM)", VIZ_COLORS[1], 1),
    ]:
        fig_pop.add_trace(
            go.Scatter(x=_time, y=_data, mode="lines", name=_name,
                       line=dict(color=_color, width=2)),
            row=1, col=_col,
        )

    # Lotka-Volterra ODE
    alpha = abm_results["p_repr"] * 5
    beta = abm_results["p_hunt"] * 0.005
    delta = beta * 0.4
    gamma = 0.1

    def _lotka_volterra(state, t_val):
        x, y = state
        return [alpha * x - beta * x * y, delta * x * y - gamma * y]

    x0 = max(_prey[0], 1.0)
    y0 = max(_pred[0], 1.0)
    _ode_sol = odeint(_lotka_volterra, [x0, y0], _time.astype(float))

    for _col_idx, _label_suffix in [(1, ""), (2, "")]:
        if _col_idx == 2:
            # ABM on col 2 as well
            fig_pop.add_trace(
                go.Scatter(x=_time, y=_prey, mode="lines", name="Prey (ABM)",
                           line=dict(color=VIZ_COLORS[0], width=2), showlegend=False),
                row=1, col=2,
            )
            fig_pop.add_trace(
                go.Scatter(x=_time, y=_pred, mode="lines", name="Pred (ABM)",
                           line=dict(color=VIZ_COLORS[1], width=2), showlegend=False),
                row=1, col=2,
            )
            # ODE overlay
            fig_pop.add_trace(
                go.Scatter(x=_time, y=_ode_sol[:, 0], mode="lines", name="Prey (ODE)",
                           line=dict(color=VIZ_COLORS[0], width=2, dash="dash")),
                row=1, col=2,
            )
            fig_pop.add_trace(
                go.Scatter(x=_time, y=_ode_sol[:, 1], mode="lines", name="Pred (ODE)",
                           line=dict(color=VIZ_COLORS[1], width=2, dash="dash")),
                row=1, col=2,
            )

    fig_pop.update_layout(**DEFAULT_LAYOUT, height=400, title="Population Dynamics")
    fig_pop.update_xaxes(title_text="Time step", row=1, col=1)
    fig_pop.update_xaxes(title_text="Time step", row=1, col=2)
    fig_pop.update_yaxes(title_text="Count", row=1, col=1)
    fig_pop
    return fig_pop,


@app.cell
def _(mo):
    mo.md(r"""
    ## Phase Portrait

    The **phase portrait** plots predator count vs prey count over time. In the classic
    Lotka-Volterra system the trajectory forms closed orbits; in the stochastic ABM the
    trajectory spirals due to demographic noise and may collapse to extinction.
    """)
    return


@app.cell
def _(go, abm_results, VIZ_COLORS, DEFAULT_LAYOUT):
    _prey = abm_results["prey_counts"]
    _pred = abm_results["pred_counts"]

    fig_phase = go.Figure()
    fig_phase.add_trace(go.Scatter(
        x=_prey, y=_pred, mode="lines",
        line=dict(color=VIZ_COLORS[3], width=1.5),
        name="Trajectory",
    ))
    fig_phase.add_trace(go.Scatter(
        x=[_prey[0]], y=[_pred[0]], mode="markers",
        marker=dict(color=VIZ_COLORS[2], size=10, symbol="star"),
        name="Start",
    ))
    fig_phase.add_trace(go.Scatter(
        x=[_prey[-1]], y=[_pred[-1]], mode="markers",
        marker=dict(color=VIZ_COLORS[4], size=10, symbol="x"),
        name="End",
    ))

    fig_phase.update_layout(
        **DEFAULT_LAYOUT, height=420,
        title="Phase Portrait (Prey vs Predators)",
        xaxis_title="Prey count",
        yaxis_title="Predator count",
    )
    fig_phase
    return fig_phase,


@app.cell
def _(mo, abm_results):
    _prey = abm_results["prey_counts"]
    _pred = abm_results["pred_counts"]
    mo.md(f"""
    ## Summary

    | Metric | Value |
    |--------|-------|
    | Final prey | {_prey[-1]} |
    | Final predators | {_pred[-1]} |
    | Peak prey | {max(_prey)} |
    | Peak predators | {max(_pred)} |
    | Prey extinct? | {"Yes" if _prey[-1] == 0 else "No"} |
    | Predators extinct? | {"Yes" if _pred[-1] == 0 else "No"} |

    **Note:** Unlike the deterministic ODE model, the ABM can exhibit **extinction events**
    when populations fluctuate to zero. This is a key difference between stochastic
    individual-based and mean-field models.
    """)
    return


if __name__ == "__main__":
    app.run()
