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
    # 1.3 Lebesgue vs Riemann Integration

    Two fundamentally different strategies for computing $\int f \, d\mu$:

    - **Riemann:** Partition the **domain** $[a, b]$ into subintervals and
      approximate $f$ by its values on each piece.
    - **Lebesgue:** Partition the **range** of $f$ into horizontal slices and
      measure the **preimage** of each slice.

    $$\text{Riemann lower} \;\leq\; \int f\,d\mu \;\leq\; \text{Riemann upper}$$

    The Lebesgue approach is more general: it can integrate functions (like the
    Dirichlet function) that defeat the Riemann integral entirely.
    """)
    return


@app.cell
def _(mo):
    func_dropdown = mo.ui.dropdown(
        options={
            "sin(2πx) + 1.5": "sine",
            "Step function": "step",
            "x²": "quadratic",
            "√x": "sqrt",
            "sin(20πx)": "oscillating",
            "Dirichlet-like": "dirichlet",
        },
        value="sine",
        label="Function",
    )
    partition_slider = mo.ui.slider(
        start=2, stop=100, step=1, value=10,
        label="Number of partition intervals",
    )
    mo.hstack([func_dropdown, partition_slider], justify="start", gap=2)
    return func_dropdown, partition_slider


@app.cell
def _(func_dropdown, np):
    # Define the selected function on [0, 1]
    kind = func_dropdown.value

    def get_func(kind_val):
        if kind_val == "sine":
            f = lambda x: np.sin(2 * np.pi * x) + 1.5
            title = "f(x) = sin(2πx) + 1.5"
            exact = 1.5  # integral over [0,1]
        elif kind_val == "step":
            def f(x):
                x = np.asarray(x, dtype=float)
                result = np.where(x < 0.3, 1.0,
                         np.where(x < 0.7, 2.5, 0.5))
                return result
            title = "Step function"
            exact = 1.0 * 0.3 + 2.5 * 0.4 + 0.5 * 0.3  # = 1.45
        elif kind_val == "quadratic":
            f = lambda x: x ** 2
            title = "f(x) = x²"
            exact = 1.0 / 3.0
        elif kind_val == "sqrt":
            f = lambda x: np.sqrt(np.maximum(x, 0))
            title = "f(x) = √x"
            exact = 2.0 / 3.0
        elif kind_val == "oscillating":
            f = lambda x: np.sin(20 * np.pi * x)
            title = "f(x) = sin(20πx)"
            exact = 0.0
        else:  # dirichlet-like
            def f(x):
                x = np.asarray(x, dtype=float)
                # Approximate Dirichlet: 1 at rationals p/q with q <= 10
                result = np.zeros_like(x)
                for q in range(1, 11):
                    for p in range(0, q + 1):
                        mask = np.abs(x - p / q) < 0.005
                        result = np.where(mask, 1.0, result)
                return result
            title = "Dirichlet-like (spikes at rationals)"
            exact = None  # Not Riemann integrable
        return f, title, exact

    f, func_title, exact_integral = get_func(kind)
    return kind, get_func, f, func_title, exact_integral


@app.cell
def _(partition_slider, np, f):
    N = partition_slider.value
    x_fine = np.linspace(0, 1, 2000)
    y_fine = f(x_fine)

    # Riemann partition of [0, 1]
    edges = np.linspace(0, 1, N + 1)
    dx = 1.0 / N

    # Compute lower and upper sums
    lower_sum = 0.0
    upper_sum = 0.0
    lower_heights = []
    upper_heights = []
    midpoint_sum = 0.0

    for i in range(N):
        x_sub = np.linspace(edges[i], edges[i + 1], 100)
        y_sub = f(x_sub)
        lo = np.min(y_sub)
        hi = np.max(y_sub)
        lower_heights.append(lo)
        upper_heights.append(hi)
        lower_sum += lo * dx
        upper_sum += hi * dx
        midpoint_sum += f((edges[i] + edges[i + 1]) / 2) * dx

    return (N, x_fine, y_fine, edges, dx, lower_sum, upper_sum,
            lower_heights, upper_heights, midpoint_sum)


@app.cell
def _(np, f, N):
    # Lebesgue-style integration: partition the range
    x_sample = np.linspace(0, 1, 2000)
    y_sample = f(x_sample)
    y_min, y_max = np.min(y_sample), np.max(y_sample)

    # Partition the range into N horizontal slices
    if y_max - y_min < 1e-10:
        range_edges = np.array([y_min - 0.5, y_max + 0.5])
    else:
        range_edges = np.linspace(y_min, y_max, N + 1)

    lebesgue_sum = 0.0
    slice_measures = []
    slice_mids = []
    dx_sample = 1.0 / len(x_sample)

    for i in range(len(range_edges) - 1):
        lo_y = range_edges[i]
        hi_y = range_edges[i + 1]
        mid_y = (lo_y + hi_y) / 2
        # Measure of preimage: fraction of x where f(x) is in [lo_y, hi_y)
        if i == len(range_edges) - 2:
            mask = (y_sample >= lo_y) & (y_sample <= hi_y)
        else:
            mask = (y_sample >= lo_y) & (y_sample < hi_y)
        measure = np.sum(mask) * dx_sample
        slice_measures.append(measure)
        slice_mids.append(mid_y)
        lebesgue_sum += mid_y * measure

    return (y_min, y_max, range_edges, lebesgue_sum,
            slice_measures, slice_mids)


@app.cell
def _(go, make_subplots, DEFAULT_LAYOUT, VIZ_COLORS, x_fine, y_fine,
      edges, N, lower_heights, upper_heights, func_title, np,
      range_edges, slice_measures, f):
    fig = make_subplots(
        rows=1, cols=2,
        subplot_titles=["Riemann: Partition the Domain",
                        "Lebesgue: Partition the Range"],
        horizontal_spacing=0.08,
    )
    fig.update_layout(**DEFAULT_LAYOUT, height=480, showlegend=True,
                      legend=dict(x=0.01, y=0.99, font=dict(size=10)))

    # --- LEFT: Riemann ---
    # Upper sum rectangles
    for i in range(N):
        fig.add_trace(go.Scatter(
            x=[edges[i], edges[i], edges[i + 1], edges[i + 1], edges[i]],
            y=[0, upper_heights[i], upper_heights[i], 0, 0],
            fill="toself",
            fillcolor=f"rgba(233, 115, 25, 0.2)",
            line=dict(color=VIZ_COLORS[1], width=0.5),
            name="Upper sum" if i == 0 else None,
            showlegend=(i == 0),
            hoverinfo="skip",
        ), row=1, col=1)

    # Lower sum rectangles
    for i in range(N):
        fig.add_trace(go.Scatter(
            x=[edges[i], edges[i], edges[i + 1], edges[i + 1], edges[i]],
            y=[0, lower_heights[i], lower_heights[i], 0, 0],
            fill="toself",
            fillcolor=f"rgba(37, 99, 235, 0.25)",
            line=dict(color=VIZ_COLORS[0], width=0.5),
            name="Lower sum" if i == 0 else None,
            showlegend=(i == 0),
            hoverinfo="skip",
        ), row=1, col=1)

    # The function curve
    fig.add_trace(go.Scatter(
        x=x_fine, y=y_fine, mode="lines",
        line=dict(color=VIZ_COLORS[2], width=2.5),
        name="f(x)",
    ), row=1, col=1)
    fig.update_xaxes(title_text="x (domain)", row=1, col=1)
    fig.update_yaxes(title_text="f(x)", row=1, col=1)

    # --- RIGHT: Lebesgue ---
    # Draw horizontal slices
    x_dense = np.linspace(0, 1, 2000)
    y_dense = f(x_dense)
    n_slices = len(range_edges) - 1

    for i in range(n_slices):
        lo_y = range_edges[i]
        hi_y = range_edges[i + 1]
        if i == n_slices - 1:
            mask = (y_dense >= lo_y) & (y_dense <= hi_y)
        else:
            mask = (y_dense >= lo_y) & (y_dense < hi_y)

        if np.any(mask):
            color_idx = i % len(VIZ_COLORS)
            c = VIZ_COLORS[color_idx]
            # Plot highlighted x-regions for this slice
            fig.add_trace(go.Scatter(
                x=x_dense[mask], y=y_dense[mask],
                mode="markers",
                marker=dict(size=2, color=c, opacity=0.6),
                name=f"[{lo_y:.2f}, {hi_y:.2f})" if i < 4 else None,
                showlegend=(i < 4),
                hovertext=f"Range slice [{lo_y:.2f}, {hi_y:.2f})<br>Measure: {slice_measures[i]:.4f}",
                hoverinfo="text",
            ), row=1, col=2)

        # Draw horizontal band boundaries
        fig.add_trace(go.Scatter(
            x=[0, 1], y=[lo_y, lo_y],
            mode="lines",
            line=dict(color="rgba(100,100,100,0.3)", width=0.5, dash="dot"),
            showlegend=False, hoverinfo="skip",
        ), row=1, col=2)

    # Function curve on right panel too
    fig.add_trace(go.Scatter(
        x=x_fine, y=y_fine, mode="lines",
        line=dict(color=VIZ_COLORS[2], width=2, dash="dash"),
        name="f(x)", showlegend=False,
    ), row=1, col=2)

    fig.update_xaxes(title_text="x (domain)", row=1, col=2)
    fig.update_yaxes(title_text="f(x)", row=1, col=2)

    fig
    return (fig,)


@app.cell
def _(mo, lower_sum, upper_sum, lebesgue_sum, midpoint_sum,
      exact_integral, func_title, N):
    exact_str = f"{exact_integral:.6f}" if exact_integral is not None else "N/A (not Riemann integrable)"
    mo.md(rf"""
    ### Integration Results for {func_title} with **{N}** partition intervals

    | Method | Value |
    |--------|-------|
    | Riemann lower sum | {lower_sum:.6f} |
    | Riemann upper sum | {upper_sum:.6f} |
    | Riemann midpoint | {midpoint_sum:.6f} |
    | Lebesgue-style sum | {lebesgue_sum:.6f} |
    | Exact integral | {exact_str} |
    | Upper − Lower gap | {upper_sum - lower_sum:.6f} |

    As $N \to \infty$, the upper and lower sums converge to the same value
    (when the function is Riemann integrable). The Lebesgue sum converges
    regardless of the partitioning strategy used.
    """)
    return


@app.cell
def _(go, DEFAULT_LAYOUT, VIZ_COLORS, get_func, kind, np):
    # Convergence chart: how sums converge with increasing partition size
    partition_sizes = np.arange(2, 101)
    f_conv, _, exact_conv = get_func(kind)

    lower_vals = []
    upper_vals = []
    lebesgue_vals = []

    for nn in partition_sizes:
        edges_c = np.linspace(0, 1, nn + 1)
        dx_c = 1.0 / nn
        x_samp = np.linspace(0, 1, 2000)
        y_samp = f_conv(x_samp)

        lo_s = 0.0
        hi_s = 0.0
        for i in range(nn):
            sub = np.linspace(edges_c[i], edges_c[i + 1], 100)
            ys = f_conv(sub)
            lo_s += np.min(ys) * dx_c
            hi_s += np.max(ys) * dx_c
        lower_vals.append(lo_s)
        upper_vals.append(hi_s)

        # Lebesgue sum
        y_lo, y_hi = np.min(y_samp), np.max(y_samp)
        if y_hi - y_lo < 1e-10:
            leb = y_lo
        else:
            r_edges = np.linspace(y_lo, y_hi, nn + 1)
            leb = 0.0
            dx_s = 1.0 / len(x_samp)
            for i in range(nn):
                mid = (r_edges[i] + r_edges[i + 1]) / 2
                if i == nn - 1:
                    m = (y_samp >= r_edges[i]) & (y_samp <= r_edges[i + 1])
                else:
                    m = (y_samp >= r_edges[i]) & (y_samp < r_edges[i + 1])
                leb += mid * np.sum(m) * dx_s
        lebesgue_vals.append(leb)

    fig_conv = go.Figure()
    fig_conv.update_layout(
        **DEFAULT_LAYOUT,
        title="Convergence of Integration Methods",
        height=400,
        xaxis_title="Number of partition intervals",
        yaxis_title="Integral estimate",
    )

    fig_conv.add_trace(go.Scatter(
        x=partition_sizes, y=upper_vals, mode="lines",
        name="Riemann upper", line=dict(color=VIZ_COLORS[1], width=2),
    ))
    fig_conv.add_trace(go.Scatter(
        x=partition_sizes, y=lower_vals, mode="lines",
        name="Riemann lower", line=dict(color=VIZ_COLORS[0], width=2),
    ))
    fig_conv.add_trace(go.Scatter(
        x=partition_sizes, y=lebesgue_vals, mode="lines",
        name="Lebesgue sum", line=dict(color=VIZ_COLORS[3], width=2, dash="dash"),
    ))

    if exact_conv is not None:
        fig_conv.add_hline(
            y=exact_conv,
            line=dict(color=VIZ_COLORS[2], width=2, dash="dot"),
            annotation_text=f"Exact = {exact_conv:.4f}",
            annotation_position="top right",
        )

    fig_conv
    return (fig_conv,)


@app.cell
def _(mo):
    mo.md(r"""
    ## Why Lebesgue?

    The **Riemann integral** partitions the domain and asks:
    *"What does $f$ do on each subinterval?"*

    The **Lebesgue integral** partitions the range and asks:
    *"Where does $f$ take values near $y$? How much domain lands there?"*

    $$\int f\,d\mu \;=\; \int_0^\infty \mu\!\big(\{x : f(x) > t\}\big)\,dt$$

    This is more powerful because:

    1. **Monotone Convergence Theorem** — if $f_n \uparrow f$ pointwise, then
       $\int f_n \to \int f$ (fails for Riemann)
    2. **Dominated Convergence Theorem** — the workhorse of modern analysis
    3. **Handles wild functions** — the Dirichlet function is Lebesgue integrable
       (integral = 0) but not Riemann integrable

    Try the **Dirichlet-like** function and watch how the Riemann upper/lower
    sums never converge to each other, while the Lebesgue approach still works.
    """)
    return


@app.cell
def _(mo):
    mo.md(r"""
    ---
    *Module 1.3 — Lebesgue vs Riemann Integration*
    *Probability Education Platform*
    """)
    return


if __name__ == "__main__":
    app.run()
