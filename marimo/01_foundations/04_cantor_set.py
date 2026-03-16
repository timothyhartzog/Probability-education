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
    # 1.4 Cantor Set & Singular Measures

    The **Cantor set** is constructed by iteratively removing the middle portion
    of intervals. Starting from $C_0 = [0, 1]$:

    - At each step, remove the **open middle fraction** from every remaining interval
    - The Cantor set is $C = \bigcap_{n=0}^{\infty} C_n$

    For the classical **middle-thirds** Cantor set (removal fraction $r = 1/3$):

    $$C = \bigcap_{n=0}^{\infty} C_n, \qquad
    \text{Hausdorff dimension} = \frac{\log 2}{\log 3} \approx 0.6309$$

    The **Cantor function** (devil's staircase) is continuous, non-decreasing,
    surjective onto $[0,1]$, yet has derivative zero almost everywhere — a
    canonical example of a **singular measure**.
    """)
    return


@app.cell
def _(mo):
    depth_slider = mo.ui.slider(
        start=0, stop=12, step=1, value=5,
        label="Iteration depth",
    )
    removal_slider = mo.ui.slider(
        start=0.1, stop=0.9, step=0.05, value=1/3,
        label="Removal fraction (r)",
    )
    mo.hstack([depth_slider, removal_slider], justify="start", gap=2)
    return depth_slider, removal_slider


@app.cell
def _(depth_slider, removal_slider, np):
    depth = depth_slider.value
    r = removal_slider.value

    def build_cantor_intervals(depth_val, removal_frac):
        """Build the list of remaining intervals at each iteration stage.

        At each step, every interval [a, b] is replaced by:
          [a, a + keep*(b-a)] and [a + (1-keep)*(b-a), b]
        where keep = (1 - removal_frac) / 2.
        """
        keep = (1.0 - removal_frac) / 2.0
        stages = [[(0.0, 1.0)]]
        for d in range(1, depth_val + 1):
            prev = stages[-1]
            new_intervals = []
            for (a, b) in prev:
                length = b - a
                new_intervals.append((a, a + keep * length))
                new_intervals.append((b - keep * length, b))
            stages.append(new_intervals)
        return stages

    stages = build_cantor_intervals(depth, r)

    # Compute remaining measure at each stage
    keep_frac = (1.0 - r)
    measures = [keep_frac ** d for d in range(depth + 1)]

    # Hausdorff dimension
    if keep_frac > 0 and keep_frac < 1:
        hausdorff_dim = np.log(2) / np.log(1.0 / ((1.0 - r) / 2.0))
    else:
        hausdorff_dim = 0.0

    return depth, r, stages, measures, keep_frac, hausdorff_dim, build_cantor_intervals


@app.cell
def _(go, DEFAULT_LAYOUT, VIZ_COLORS, depth, stages):
    # --- Iterative construction visualization ---
    fig_construct = go.Figure()
    fig_construct.update_layout(
        **DEFAULT_LAYOUT,
        title=f"Cantor Set Construction (depth = {depth})",
        height=max(250, 50 + 40 * (depth + 1)),
        xaxis=dict(title="x", range=[-0.02, 1.02]),
        yaxis=dict(
            title="Iteration",
            tickvals=list(range(depth + 1)),
            ticktext=[f"C<sub>{d}</sub>" for d in range(depth + 1)],
            autorange="reversed",
        ),
        showlegend=False,
    )

    for d, intervals in enumerate(stages):
        color = VIZ_COLORS[d % len(VIZ_COLORS)]
        for (a, b) in intervals:
            fig_construct.add_trace(go.Scatter(
                x=[a, b], y=[d, d],
                mode="lines",
                line=dict(color=color, width=max(2, 12 - d)),
                hovertext=f"C_{d}: [{a:.6f}, {b:.6f}]",
                hoverinfo="text",
            ))

    fig_construct
    return (fig_construct,)


@app.cell
def _(mo, depth, r, measures, hausdorff_dim):
    keep = 1.0 - r
    mo.md(rf"""
    ### Iteration Statistics

    | Property | Value |
    |----------|-------|
    | Depth | {depth} |
    | Removal fraction $r$ | {r:.4f} |
    | Keep fraction per side | {keep/2:.4f} |
    | Intervals remaining | {2**depth} |
    | Remaining measure $\mu(C_{depth})$ | $(1 - r)^{depth}$ = {measures[-1]:.8f} |
    | Hausdorff dimension | $\dfrac{{\log 2}}{{\log(1/\text{{keep per side}})}}$ = {hausdorff_dim:.4f} |

    As $n \to \infty$: the measure $\mu(C_n) \to 0$, yet $C$ is **uncountable**
    (it contains all base-$1/r$ expansions using only digits $0$ and $2$
    for the classical case).
    """)
    return


@app.cell
def _(np, depth, r, build_cantor_intervals):
    def cantor_function(x_arr, depth_val, removal_frac):
        """Compute the Cantor (devil's staircase) function at given x values.

        Uses the iterative construction: at depth d, the function is piecewise
        linear on the complement of the removed intervals.
        """
        x_arr = np.asarray(x_arr, dtype=float)
        result = np.zeros_like(x_arr)
        # Build intervals at the given depth
        intervals = build_cantor_intervals(depth_val, removal_frac)
        final_intervals = intervals[depth_val]
        n_intervals = len(final_intervals)

        for i, x in enumerate(x_arr):
            # Find which interval x falls in or between
            found = False
            for j, (a, b) in enumerate(final_intervals):
                if a <= x <= b:
                    # Linearly interpolate within this interval
                    t = (x - a) / (b - a) if b > a else 0.5
                    result[i] = (j + t) / n_intervals
                    found = True
                    break
                elif j > 0:
                    _, prev_b = final_intervals[j - 1]
                    if prev_b < x < a:
                        # In a removed gap: constant value
                        result[i] = j / n_intervals
                        found = True
                        break
            if not found:
                if x <= 0:
                    result[i] = 0.0
                else:
                    result[i] = 1.0

        return result

    x_cantor = np.linspace(0, 1, 4000)
    y_cantor = cantor_function(x_cantor, depth, r)
    return cantor_function, x_cantor, y_cantor


@app.cell
def _(go, DEFAULT_LAYOUT, VIZ_COLORS, x_cantor, y_cantor, depth, r):
    fig_staircase = go.Figure()
    fig_staircase.update_layout(
        **DEFAULT_LAYOUT,
        title=f"Cantor Function (Devil's Staircase) — depth {depth}, r = {r:.3f}",
        height=450,
        xaxis_title="x",
        yaxis_title="F(x)",
    )

    fig_staircase.add_trace(go.Scatter(
        x=x_cantor, y=y_cantor, mode="lines",
        line=dict(color=VIZ_COLORS[3], width=2),
        name="Cantor function",
    ))

    # Add reference diagonal
    fig_staircase.add_trace(go.Scatter(
        x=[0, 1], y=[0, 1], mode="lines",
        line=dict(color="rgba(150,150,150,0.4)", width=1, dash="dash"),
        name="y = x",
    ))

    fig_staircase
    return (fig_staircase,)


@app.cell
def _(go, make_subplots, DEFAULT_LAYOUT, VIZ_COLORS, np, r):
    # --- Measure decay chart ---
    max_iter = 20
    iters = np.arange(0, max_iter + 1)
    keep = 1.0 - r
    remaining = keep ** iters

    fig_decay = make_subplots(
        rows=1, cols=2,
        subplot_titles=[
            "Remaining Measure μ(C<sub>n</sub>)",
            "Number of Intervals (log scale)"
        ],
        horizontal_spacing=0.12,
    )
    fig_decay.update_layout(**DEFAULT_LAYOUT, height=380)

    fig_decay.add_trace(go.Scatter(
        x=iters, y=remaining, mode="lines+markers",
        line=dict(color=VIZ_COLORS[0], width=2),
        marker=dict(size=6, color=VIZ_COLORS[0]),
        name=f"(1-r)ⁿ = {keep:.3f}ⁿ",
    ), row=1, col=1)
    fig_decay.update_xaxes(title_text="Iteration n", row=1, col=1)
    fig_decay.update_yaxes(title_text="μ(C_n)", row=1, col=1)

    fig_decay.add_trace(go.Scatter(
        x=iters, y=2.0 ** iters, mode="lines+markers",
        line=dict(color=VIZ_COLORS[1], width=2),
        marker=dict(size=6, color=VIZ_COLORS[1]),
        name="2ⁿ intervals",
    ), row=1, col=2)
    fig_decay.update_xaxes(title_text="Iteration n", row=1, col=2)
    fig_decay.update_yaxes(title_text="Count", type="log", row=1, col=2)

    fig_decay
    return (fig_decay,)


@app.cell
def _(mo, r, hausdorff_dim):
    keep_side = (1.0 - r) / 2.0
    mo.md(rf"""
    ## Why the Cantor Set Matters

    The Cantor set $C$ is a remarkable object in measure theory:

    | Property | Value |
    |----------|-------|
    | Lebesgue measure | $\mu(C) = 0$ |
    | Cardinality | Uncountable ($|C| = |\mathbb{{R}}|$) |
    | Topology | Closed, perfect, totally disconnected, compact |
    | Hausdorff dimension | $\dfrac{{\log 2}}{{\log(1/{keep_side:.4f})}} = {hausdorff_dim:.4f}$ |

    ### The Cantor Function (Devil's Staircase)

    The function $F: [0,1] \to [0,1]$ constructed above satisfies:

    - **Continuous** and **non-decreasing**
    - **Surjective** onto $[0, 1]$
    - $F'(x) = 0$ for almost every $x$ (on the complement of $C$, which has full measure)
    - Yet $F(0) = 0$ and $F(1) = 1$

    This means $F$ "goes from 0 to 1 without ever increasing" in the Lebesgue sense.
    The measure $\mu_F$ defined by $\mu_F([a,b]) = F(b) - F(a)$ is:

    - **Singular** with respect to Lebesgue measure (concentrated on $C$, a set of measure 0)
    - **Continuous** (no point masses, unlike a discrete measure)

    This is a **singular continuous measure** — the "third kind" of measure that
    is neither absolutely continuous nor discrete.

    ### Generalization

    By adjusting the removal fraction $r$:
    - $r \to 0$: the "Cantor set" approaches $[0,1]$ itself (dimension $\to 1$)
    - $r = 1/3$: classical middle-thirds Cantor set (dimension $\approx 0.631$)
    - $r \to 1$: the set shrinks toward a pair of points (dimension $\to 0$)
    """)
    return


@app.cell
def _(mo):
    mo.md(r"""
    ---
    *Module 1.4 — Cantor Set & Singular Measures*
    *Probability Education Platform*
    """)
    return


if __name__ == "__main__":
    app.run()
