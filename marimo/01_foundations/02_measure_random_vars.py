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
    # 1.2 Measure Construction & Random Variables

    A **probability measure** $P$ on $(\Omega, \mathcal{F})$ assigns a number
    $P(A) \in [0, 1]$ to each event $A \in \mathcal{F}$ satisfying:

    1. **Non-negativity:** $P(A) \geq 0$ for all $A \in \mathcal{F}$
    2. **Normalization:** $P(\Omega) = 1$
    3. **Countable additivity:** For pairwise disjoint $A_1, A_2, \ldots \in \mathcal{F}$,
       $P\!\left(\bigcup_{i=1}^{\infty} A_i\right) = \sum_{i=1}^{\infty} P(A_i)$

    A **random variable** $X : \Omega \to \mathbb{R}$ is a measurable function, meaning
    $X^{-1}(B) = \{\omega \in \Omega : X(\omega) \in B\} \in \mathcal{F}$ for every
    Borel set $B$.

    The **pushforward measure** (law of $X$) is defined by
    $P_X(B) = P(X^{-1}(B))$.
    """)
    return


@app.cell
def _(mo):
    omega_slider = mo.ui.slider(
        start=2, stop=8, step=1, value=4,
        label="Size of Ω",
    )
    rv_type = mo.ui.dropdown(
        options={
            "Indicator (1 on first half)": "indicator",
            "Two-value (even/odd)": "two_value",
            "Three-value (mod 3)": "three_value",
            "Identity (X=ω)": "identity",
        },
        value="two_value",
        label="Random variable type",
    )
    mo.hstack([omega_slider, rv_type], justify="start", gap=2)
    return omega_slider, rv_type


@app.cell
def _(omega_slider, rv_type, np):
    n = omega_slider.value
    omega = list(range(1, n + 1))

    # Define the random variable X based on selected type
    rv_kind = rv_type.value
    if rv_kind == "indicator":
        half = n // 2
        X_values = [1 if w <= half else 0 for w in omega]
        rv_description = f"X(ω) = 1 if ω ≤ {half}, else 0"
    elif rv_kind == "two_value":
        X_values = [0 if w % 2 == 0 else 1 for w in omega]
        rv_description = "X(ω) = 0 if ω even, 1 if ω odd"
    elif rv_kind == "three_value":
        X_values = [w % 3 for w in omega]
        rv_description = "X(ω) = ω mod 3"
    else:  # identity
        X_values = list(omega)
        rv_description = "X(ω) = ω"

    # Start with uniform probability; will be adjusted by weight sliders
    base_weights = np.ones(n, dtype=float) / n
    return n, omega, X_values, rv_description, rv_kind, base_weights


@app.cell
def _(mo, n, omega):
    weight_sliders = mo.ui.array(
        [mo.ui.slider(start=1, stop=20, step=1, value=10,
                       label=f"w({w})") for w in omega],
    )
    mo.md(f"""
    ### Adjust Probability Weights

    Drag the sliders to change the probability of each outcome.
    Weights are automatically normalized to sum to 1.

    {mo.hstack(list(weight_sliders), wrap=True)}
    """)
    return (weight_sliders,)


@app.cell
def _(weight_sliders, np, n, omega, X_values, VIZ_COLORS):
    # Compute normalized probabilities from weights
    raw_weights = np.array([float(w) for w in weight_sliders.value])
    probs = raw_weights / raw_weights.sum()

    # Group outcomes by X value (preimage sets)
    range_X = sorted(set(X_values))
    preimage_groups = {}
    for y in range_X:
        preimage_groups[y] = [omega[i] for i in range(n) if X_values[i] == y]

    # Assign colors by preimage group
    omega_colors = []
    for i in range(n):
        y = X_values[i]
        group_idx = range_X.index(y)
        omega_colors.append(VIZ_COLORS[group_idx % len(VIZ_COLORS)])

    # Pushforward measure P_X
    pushforward = {}
    for y in range_X:
        pushforward[y] = sum(probs[i] for i in range(n) if X_values[i] == y)

    return probs, range_X, preimage_groups, omega_colors, pushforward


@app.cell
def _(mo, n, omega, X_values, probs, range_X, preimage_groups, pushforward,
      rv_description, VIZ_COLORS):
    # Build preimage table
    preimage_rows = ""
    for idx, y in enumerate(range_X):
        members = preimage_groups[y]
        c = VIZ_COLORS[idx % len(VIZ_COLORS)]
        members_str = ", ".join(str(m) for m in members)
        p_val = pushforward[y]
        preimage_rows += (
            f"| <span style='color:{c}'>**{y}**</span> "
            f"| {{{members_str}}} "
            f"| {p_val:.4f} |\n"
        )

    prob_str = ", ".join(f"P({{ω_{w}}}) = {probs[i]:.3f}" for i, w in enumerate(omega))

    mo.md(rf"""
    ### Current Configuration

    **Random variable:** {rv_description}

    **Probability measure:** {prob_str}

    **Preimage decomposition** $X^{{-1}}(\{{y\}})$ and pushforward $P_X$:

    | $y$ | $X^{{-1}}(\{{y\}})$ | $P_X(\{{y\}}) = P(X^{{-1}}(\{{y\}}))$ |
    |-----|---------------------|---------------------------------------|
    {preimage_rows}

    Note how $\sum_y P_X(\{{y\}}) = {sum(pushforward.values()):.4f} = 1$,
    confirming $P_X$ is a valid probability measure on $\mathbb{{R}}$.
    """)
    return


@app.cell
def _(go, make_subplots, DEFAULT_LAYOUT, VIZ_COLORS, omega, probs,
      omega_colors, n, X_values):
    # --- Probability measure bar chart ---
    fig_prob = make_subplots(
        rows=1, cols=2,
        subplot_titles=["P({ω}) — Probability Measure on Ω",
                        "X: Ω → ℝ (Function Mapping)"],
        horizontal_spacing=0.12,
    )
    fig_prob.update_layout(**DEFAULT_LAYOUT, height=400)

    fig_prob.add_trace(
        go.Bar(
            x=[f"ω={w}" for w in omega],
            y=list(probs),
            marker_color=omega_colors,
            text=[f"{p:.3f}" for p in probs],
            textposition="outside",
            name="P({ω})",
            showlegend=False,
        ),
        row=1, col=1,
    )
    fig_prob.update_yaxes(range=[0, max(probs) * 1.3], title_text="P({ω})", row=1, col=1)

    # --- Arrow diagram: Ω → ℝ ---
    # Place Ω elements on left column (x=0), range values on right column (x=1)
    range_vals = sorted(set(X_values))
    omega_y_positions = np.linspace(n - 1, 0, n)
    range_y_positions = np.linspace(len(range_vals) - 1, 0, len(range_vals))
    range_y_map = {v: range_y_positions[i] for i, v in enumerate(range_vals)}

    # Draw arrows (lines from omega to range)
    for i, w in enumerate(omega):
        y_val = X_values[i]
        color = omega_colors[i]
        fig_prob.add_trace(
            go.Scatter(
                x=[0.1, 0.9], y=[omega_y_positions[i], range_y_map[y_val]],
                mode="lines",
                line=dict(color=color, width=2),
                showlegend=False,
                hoverinfo="skip",
            ),
            row=1, col=2,
        )

    # Omega nodes
    fig_prob.add_trace(
        go.Scatter(
            x=[0] * n, y=list(omega_y_positions),
            mode="markers+text",
            marker=dict(size=22, color=omega_colors,
                        line=dict(width=2, color="white")),
            text=[f"ω={w}" for w in omega],
            textposition="middle left",
            textfont=dict(size=11),
            showlegend=False,
            hoverinfo="skip",
        ),
        row=1, col=2,
    )

    # Range nodes
    range_colors = [VIZ_COLORS[i % len(VIZ_COLORS)] for i in range(len(range_vals))]
    fig_prob.add_trace(
        go.Scatter(
            x=[1] * len(range_vals), y=list(range_y_positions),
            mode="markers+text",
            marker=dict(size=22, color=range_colors,
                        line=dict(width=2, color="white")),
            text=[f"  {v}" for v in range_vals],
            textposition="middle right",
            textfont=dict(size=12, color=range_colors),
            showlegend=False,
            hoverinfo="skip",
        ),
        row=1, col=2,
    )

    fig_prob.update_xaxes(visible=False, range=[-0.3, 1.5], row=1, col=2)
    fig_prob.update_yaxes(visible=False, row=1, col=2)

    # Add axis labels for the arrow diagram
    fig_prob.add_annotation(
        x=0, y=-0.6, text="Ω", showarrow=False,
        font=dict(size=14, color=VIZ_COLORS[0]), xref="x2", yref="y2",
    )
    fig_prob.add_annotation(
        x=1, y=-0.6, text="ℝ", showarrow=False,
        font=dict(size=14, color=VIZ_COLORS[1]), xref="x2", yref="y2",
    )

    fig_prob
    return (fig_prob,)


@app.cell
def _(go, DEFAULT_LAYOUT, VIZ_COLORS, range_X, pushforward, probs,
      preimage_groups, omega):
    # --- Pushforward measure bar chart ---
    pf_colors = [VIZ_COLORS[i % len(VIZ_COLORS)] for i in range(len(range_X))]
    pf_values = [pushforward[y] for y in range_X]

    fig_push = go.Figure()
    fig_push.update_layout(
        **DEFAULT_LAYOUT,
        title="Pushforward Measure P<sub>X</sub> (Law of X)",
        height=350,
    )

    fig_push.add_trace(go.Bar(
        x=[f"y = {y}" for y in range_X],
        y=pf_values,
        marker_color=pf_colors,
        text=[f"{v:.3f}" for v in pf_values],
        textposition="outside",
        hovertext=[
            f"P_X({{{y}}}) = P(X⁻¹({{{y}}})) = P({{{', '.join(str(m) for m in preimage_groups[y])}}}) = {pushforward[y]:.4f}"
            for y in range_X
        ],
        hoverinfo="text",
        showlegend=False,
    ))
    fig_push.update_yaxes(range=[0, max(pf_values) * 1.3], title_text="P_X({y})")
    fig_push.update_xaxes(title_text="Range of X")

    fig_push
    return (fig_push,)


@app.cell
def _(mo, VIZ_COLORS):
    mo.md(rf"""
    ## Key Concepts

    ### Measurability
    A function $X: \Omega \to \mathbb{{R}}$ is **measurable** with respect to
    $(\Omega, \mathcal{{F}})$ if for every Borel set $B \subseteq \mathbb{{R}}$:

    $$X^{{-1}}(B) = \{{\omega \in \Omega : X(\omega) \in B\}} \in \mathcal{{F}}$$

    On finite sample spaces with the power set $\sigma$-algebra, **every**
    function is measurable (since every subset is in $\mathcal{{F}} = 2^\Omega$).

    ### Pushforward Construction
    The pushforward $P_X$ transfers the probability structure from
    $(\Omega, \mathcal{{F}}, P)$ to $(\mathbb{{R}}, \mathcal{{B}})$:

    $$P_X(B) = P(X^{{-1}}(B)) = P(\{{\omega : X(\omega) \in B\}})$$

    The <span style="color:{VIZ_COLORS[0]}">**color coding**</span> in the
    visualizations above shows how outcomes in $\Omega$ are grouped by their
    $X$-value — each color represents one **preimage fiber** $X^{{-1}}(\{{y\}})$.

    ### Why This Matters
    - Random variables let us study **numerical summaries** of random experiments
    - The pushforward converts a measure on an abstract space to one on $\mathbb{{R}}$
    - This is the foundation for **distributions**, **expectations**, and all of
      probability theory
    """)
    return


@app.cell
def _(mo):
    mo.md(r"""
    ---
    *Module 1.2 — Measure Construction & Random Variables*
    *Probability Education Platform*
    """)
    return


if __name__ == "__main__":
    app.run()
