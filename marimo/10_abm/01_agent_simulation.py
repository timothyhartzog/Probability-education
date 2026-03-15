import marimo

app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import numpy as np
    import plotly.graph_objects as go
    from plotly.subplots import make_subplots
    import sys
    sys.path.insert(0, "..")
    from shared.plotting import VIZ_COLORS, DEFAULT_LAYOUT, styled_figure
    return mo, np, go, make_subplots, VIZ_COLORS, DEFAULT_LAYOUT, styled_figure


@app.cell
def _(mo):
    mo.md(r"""
    # 10.1 Agent-Based SIR Simulation

    An **agent-based model (ABM)** simulates individual agents on a grid, each following
    simple local rules. Emergent population-level dynamics arise from these interactions.

    Here we model an **SIR epidemic** (Susceptible $\to$ Infected $\to$ Recovered) on an
    $N \times N$ grid. At each time step:

    1. Each **Susceptible** agent checks its 4 neighbours (von Neumann neighbourhood).
       For each **Infected** neighbour, it becomes infected with probability $\beta$.
    2. Each **Infected** agent recovers with probability $\gamma$.
    3. **Recovered** agents are immune and do not change state.

    The probability a susceptible agent with $k$ infected neighbours **escapes** infection
    in one step is $(1 - \beta)^k$, so the effective infection probability is:

    $$P(\text{infected}) = 1 - (1 - \beta)^{k}$$

    Adjust the sliders below to explore how infection and recovery rates shape the epidemic curve.
    """)
    return


@app.cell
def _(mo):
    grid_size = mo.ui.slider(
        start=20, stop=80, step=5, value=40,
        label="Grid size N",
    )
    infection_rate = mo.ui.slider(
        start=0.05, stop=0.8, step=0.05, value=0.3,
        label="Infection rate (beta)",
    )
    recovery_rate = mo.ui.slider(
        start=0.01, stop=0.5, step=0.01, value=0.05,
        label="Recovery rate (gamma)",
    )
    n_steps = mo.ui.slider(
        start=20, stop=300, step=10, value=100,
        label="Time steps",
    )
    seed_slider = mo.ui.slider(
        start=0, stop=99, step=1, value=42,
        label="Random seed",
    )
    controls = mo.hstack(
        [grid_size, infection_rate, recovery_rate, n_steps, seed_slider],
        wrap=True,
    )
    mo.md(f"**Simulation controls:** {controls}")
    return grid_size, infection_rate, recovery_rate, n_steps, seed_slider


@app.cell
def _(np, grid_size, infection_rate, recovery_rate, n_steps, seed_slider):
    # --- Run the SIR ABM simulation ---
    _N = grid_size.value
    _beta = infection_rate.value
    _gamma = recovery_rate.value
    _T = n_steps.value
    rng = np.random.default_rng(seed_slider.value)

    # States: 0 = Susceptible, 1 = Infected, 2 = Recovered
    grid = np.zeros((_N, _N), dtype=int)

    # Seed initial infections: small cluster in the centre
    cx, cy = _N // 2, _N // 2
    radius = max(1, _N // 20)
    for dx in range(-radius, radius + 1):
        for dy in range(-radius, radius + 1):
            nx_, ny_ = cx + dx, cy + dy
            if 0 <= nx_ < _N and 0 <= ny_ < _N:
                grid[nx_, ny_] = 1

    # Track population counts
    s_counts = [int(np.sum(grid == 0))]
    i_counts = [int(np.sum(grid == 1))]
    r_counts = [int(np.sum(grid == 2))]

    # Store snapshots for visualisation
    snapshot_indices = [0]
    snapshots = [grid.copy()]

    for t in range(1, _T + 1):
        new_grid = grid.copy()

        # Identify infected neighbours for each cell via shifted arrays
        infected_mask = (grid == 1).astype(int)
        neighbour_count = np.zeros((_N, _N), dtype=int)
        # Up, Down, Left, Right shifts
        neighbour_count[1:, :] += infected_mask[:-1, :]
        neighbour_count[:-1, :] += infected_mask[1:, :]
        neighbour_count[:, 1:] += infected_mask[:, :-1]
        neighbour_count[:, :-1] += infected_mask[:, 1:]

        # Susceptible -> Infected
        susceptible = grid == 0
        has_inf_neighbours = susceptible & (neighbour_count > 0)
        if np.any(has_inf_neighbours):
            coords = np.argwhere(has_inf_neighbours)
            k_vals = neighbour_count[has_inf_neighbours]
            probs = 1.0 - (1.0 - _beta) ** k_vals
            rand_vals = rng.random(len(coords))
            for idx in range(len(coords)):
                if rand_vals[idx] < probs[idx]:
                    new_grid[coords[idx, 0], coords[idx, 1]] = 1

        # Infected -> Recovered
        infected_coords = np.argwhere(grid == 1)
        if len(infected_coords) > 0:
            recover_rolls = rng.random(len(infected_coords))
            for idx in range(len(infected_coords)):
                if recover_rolls[idx] < _gamma:
                    new_grid[infected_coords[idx, 0], infected_coords[idx, 1]] = 2

        grid = new_grid
        s_counts.append(int(np.sum(grid == 0)))
        i_counts.append(int(np.sum(grid == 1)))
        r_counts.append(int(np.sum(grid == 2)))

        # Save a few snapshots
        if t == _T // 4 or t == _T // 2 or t == 3 * _T // 4 or t == _T:
            snapshot_indices.append(t)
            snapshots.append(grid.copy())

    sim_results = dict(
        s_counts=s_counts, i_counts=i_counts, r_counts=r_counts,
        snapshots=snapshots, snapshot_indices=snapshot_indices,
        N=_N, T=_T,
    )
    return sim_results, rng


@app.cell
def _(mo):
    mo.md(r"""
    ## Grid Snapshots

    The heatmap below shows agent states at key time steps:
    **Blue** = Susceptible, **Orange** = Infected, **Green** = Recovered.
    """)
    return


@app.cell
def _(go, make_subplots, sim_results, VIZ_COLORS, DEFAULT_LAYOUT):
    _snaps = sim_results["snapshots"]
    _idxs = sim_results["snapshot_indices"]
    _n_snaps = len(_snaps)

    fig_grid = make_subplots(
        rows=1, cols=_n_snaps,
        subplot_titles=[f"t = {i}" for i in _idxs],
    )

    _colorscale = [
        [0.0, VIZ_COLORS[0]],   # Susceptible - blue
        [0.5, VIZ_COLORS[1]],   # Infected - orange
        [1.0, VIZ_COLORS[2]],   # Recovered - green
    ]

    for idx, snap in enumerate(_snaps):
        fig_grid.add_trace(
            go.Heatmap(
                z=snap,
                colorscale=_colorscale,
                zmin=0, zmax=2,
                showscale=(idx == _n_snaps - 1),
                colorbar=dict(
                    tickvals=[0, 1, 2],
                    ticktext=["S", "I", "R"],
                ),
            ),
            row=1, col=idx + 1,
        )

    fig_grid.update_layout(
        **DEFAULT_LAYOUT,
        height=350,
        title="SIR Grid Snapshots",
    )
    for i in range(1, _n_snaps + 1):
        fig_grid.update_xaxes(showticklabels=False, row=1, col=i)
        fig_grid.update_yaxes(showticklabels=False, row=1, col=i, scaleanchor=f"x{i if i > 1 else ''}")
    fig_grid
    return fig_grid,


@app.cell
def _(mo):
    mo.md(r"""
    ## Epidemic Curve

    The **epidemic curve** shows how the three compartments evolve over time.
    The peak of the Infected curve is the point of maximum disease prevalence.
    """)
    return


@app.cell
def _(go, sim_results, VIZ_COLORS, DEFAULT_LAYOUT):
    _T = sim_results["T"]
    _time = list(range(_T + 1))

    fig_curve = go.Figure()

    for _data, _name, _color in [
        (sim_results["s_counts"], "Susceptible", VIZ_COLORS[0]),
        (sim_results["i_counts"], "Infected", VIZ_COLORS[1]),
        (sim_results["r_counts"], "Recovered", VIZ_COLORS[2]),
    ]:
        fig_curve.add_trace(go.Scatter(
            x=_time, y=_data, mode="lines",
            name=_name, line=dict(color=_color, width=2.5),
        ))

    fig_curve.update_layout(
        **DEFAULT_LAYOUT,
        title="Population Dynamics (SIR)",
        xaxis_title="Time step",
        yaxis_title="Number of agents",
        height=420,
    )
    fig_curve
    return fig_curve,


@app.cell
def _(mo, sim_results):
    _peak_i = max(sim_results["i_counts"])
    _peak_t = sim_results["i_counts"].index(_peak_i)
    _total = sim_results["N"] ** 2
    _final_r = sim_results["r_counts"][-1]
    mo.md(f"""
    ## Key Statistics

    | Metric | Value |
    |--------|-------|
    | Total agents | {_total:,} |
    | Peak infected | {_peak_i:,} (at t = {_peak_t}) |
    | Final recovered | {_final_r:,} ({100 * _final_r / _total:.1f}% of population) |
    | Final susceptible | {sim_results['s_counts'][-1]:,} ({100 * sim_results['s_counts'][-1] / _total:.1f}%) |

    **Interpretation:** A higher $\\beta / \\gamma$ ratio (basic reproduction number $R_0$)
    leads to larger outbreaks. When $R_0 > 1$ the epidemic can spread; when $R_0 < 1$ it
    dies out quickly. In the spatial ABM, clustering and local herd-immunity effects can
    differ substantially from the well-mixed ODE model.
    """)
    return


if __name__ == "__main__":
    app.run()
