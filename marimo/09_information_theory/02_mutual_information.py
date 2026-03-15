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
    from shared.plotting import VIZ_COLORS, DEFAULT_LAYOUT, styled_figure, styled_subplots
    return mo, np, go, make_subplots, VIZ_COLORS, DEFAULT_LAYOUT, styled_figure, styled_subplots


@app.cell
def _(mo):
    mo.md(r"""
    # 9.2 Mutual Information & Channel Capacity

    **Mutual information** measures the amount of information one random variable
    contains about another:

    $$I(X;Y) = H(X) + H(Y) - H(X,Y) = H(X) - H(X|Y) = H(Y) - H(Y|X)$$

    The **channel capacity** is the maximum mutual information over all input distributions:

    $$C = \max_{p(x)} I(X;Y)$$

    We explore two fundamental channels:
    - **Binary Symmetric Channel (BSC)**: each bit flips with probability $\varepsilon$
    - **Binary Erasure Channel (BEC)**: each bit is erased with probability $\varepsilon$
    """)
    return


@app.cell
def _(mo):
    channel_dropdown = mo.ui.dropdown(
        options={
            "Binary Symmetric Channel (BSC)": "bsc",
            "Binary Erasure Channel (BEC)": "bec",
        },
        value="bsc",
        label="Channel type",
    )
    crossover_slider = mo.ui.slider(
        start=0.0, stop=0.5, step=0.01, value=0.1,
        label="Crossover/erasure probability ε",
    )
    input_slider = mo.ui.slider(
        start=0.01, stop=0.99, step=0.01, value=0.5,
        label="Input P(X=1)",
    )
    controls = mo.hstack([channel_dropdown, crossover_slider, input_slider], wrap=True)
    mo.md(f"## Controls\n\n{controls}")
    return channel_dropdown, crossover_slider, input_slider


@app.cell
def _(np, channel_dropdown, crossover_slider, input_slider):
    channel = channel_dropdown.value
    eps = crossover_slider.value
    px1 = input_slider.value
    px0 = 1 - px1

    def h_binary(p):
        """Binary entropy function H(p) = -p log2 p - (1-p) log2 (1-p)"""
        if p <= 0 or p >= 1:
            return 0.0
        return -p * np.log2(p) - (1 - p) * np.log2(1 - p)

    def entropy(probs):
        """Shannon entropy of a discrete distribution."""
        probs = np.array(probs)
        probs = probs[probs > 0]
        return -np.sum(probs * np.log2(probs))

    if channel == "bsc":
        # BSC: P(Y=0|X=0) = 1-eps, P(Y=1|X=0) = eps
        #      P(Y=1|X=1) = 1-eps, P(Y=0|X=1) = eps
        # Joint distribution
        pxy = np.array([
            [px0 * (1 - eps), px0 * eps],       # X=0: Y=0, Y=1
            [px1 * eps,       px1 * (1 - eps)],  # X=1: Y=0, Y=1
        ])
        py = pxy.sum(axis=0)  # marginal Y
        px = np.array([px0, px1])
        H_X = entropy(px)
        H_Y = entropy(py)
        H_XY = entropy(pxy.flatten())
        H_X_given_Y = H_XY - H_Y
        H_Y_given_X = h_binary(eps)  # symmetric channel
        I_XY = H_X - H_X_given_Y
        # Capacity: C = 1 - H(eps)
        capacity = 1 - h_binary(eps)
        channel_label = "BSC"
        output_labels = ["0", "1"]
    else:  # BEC
        # BEC: P(Y=0|X=0) = 1-eps, P(Y=e|X=0) = eps
        #      P(Y=1|X=1) = 1-eps, P(Y=e|X=1) = eps
        pxy = np.array([
            [px0 * (1 - eps), 0,               px0 * eps],  # X=0: Y=0, Y=1, Y=e
            [0,               px1 * (1 - eps),  px1 * eps],  # X=1: Y=0, Y=1, Y=e
        ])
        py = pxy.sum(axis=0)
        px = np.array([px0, px1])
        H_X = entropy(px)
        H_Y = entropy(py)
        H_XY = entropy(pxy.flatten())
        H_X_given_Y = H_XY - H_Y
        H_Y_given_X = H_XY - H_X
        I_XY = H_X - H_X_given_Y
        # Capacity: C = 1 - eps
        capacity = 1 - eps
        channel_label = "BEC"
        output_labels = ["0", "1", "e"]

    return (channel, eps, px0, px1, pxy, py, px, H_X, H_Y, H_XY,
            H_X_given_Y, H_Y_given_X, I_XY, capacity, channel_label,
            output_labels, h_binary, entropy)


@app.cell
def _(go, np, VIZ_COLORS, DEFAULT_LAYOUT, H_X, H_Y, H_XY, H_X_given_Y,
      H_Y_given_X, I_XY, styled_figure):
    # Entropy Venn diagram using overlapping circles
    fig_venn = styled_figure(title="Entropy Venn Diagram", height=420)

    # Draw two overlapping ellipses
    theta = np.linspace(0, 2 * np.pi, 100)
    # Circle for H(X) centered at (-0.5, 0)
    cx1, cy1, rx, ry = -0.6, 0, 1.5, 1.0
    x1 = cx1 + rx * np.cos(theta)
    y1 = cy1 + ry * np.sin(theta)
    fig_venn.add_trace(go.Scatter(
        x=x1, y=y1, mode='lines', fill='toself',
        fillcolor='rgba(37,99,235,0.15)', line=dict(color=VIZ_COLORS[0], width=2),
        name='H(X)', showlegend=False,
    ))
    # Circle for H(Y) centered at (0.5, 0)
    cx2, cy2 = 0.6, 0
    x2 = cx2 + rx * np.cos(theta)
    y2 = cy2 + ry * np.sin(theta)
    fig_venn.add_trace(go.Scatter(
        x=x2, y=y2, mode='lines', fill='toself',
        fillcolor='rgba(233,115,25,0.15)', line=dict(color=VIZ_COLORS[1], width=2),
        name='H(Y)', showlegend=False,
    ))

    # Labels
    annotations = [
        dict(x=-1.3, y=0, text=f"H(X|Y)<br>{H_X_given_Y:.3f}", showarrow=False,
             font=dict(size=13, color=VIZ_COLORS[0])),
        dict(x=0, y=0, text=f"I(X;Y)<br>{I_XY:.3f}", showarrow=False,
             font=dict(size=14, color=VIZ_COLORS[2], family="Inter, sans-serif")),
        dict(x=1.3, y=0, text=f"H(Y|X)<br>{H_Y_given_X:.3f}", showarrow=False,
             font=dict(size=13, color=VIZ_COLORS[1])),
        dict(x=-1.5, y=1.2, text=f"H(X) = {H_X:.3f}", showarrow=False,
             font=dict(size=14, color=VIZ_COLORS[0])),
        dict(x=1.5, y=1.2, text=f"H(Y) = {H_Y:.3f}", showarrow=False,
             font=dict(size=14, color=VIZ_COLORS[1])),
        dict(x=0, y=-1.4, text=f"H(X,Y) = {H_XY:.3f}", showarrow=False,
             font=dict(size=13, color=VIZ_COLORS[7])),
    ]
    fig_venn.update_layout(
        annotations=annotations,
        xaxis=dict(visible=False, range=[-3, 3]),
        yaxis=dict(visible=False, range=[-2, 2], scaleanchor="x"),
    )
    fig_venn
    return


@app.cell
def _(mo, H_X, H_Y, H_XY, H_X_given_Y, H_Y_given_X, I_XY, capacity,
      channel_label, eps):
    if channel_label == "BSC":
        cap_formula = "$C_{\\mathrm{BSC}} = 1 - H(\\varepsilon) = 1 - H(" + str(eps) + ") = " + f"{capacity:.4f}" + "$"
    else:
        cap_formula = "$C_{\\mathrm{BEC}} = 1 - \\varepsilon = 1 - " + str(eps) + " = " + f"{capacity:.4f}" + "$"
    mo.md(rf"""
    ## Information Measures (bits)

    | Quantity | Formula | Value |
    |----------|---------|-------|
    | $H(X)$ | $-\sum p(x)\log_2 p(x)$ | {H_X:.4f} |
    | $H(Y)$ | $-\sum p(y)\log_2 p(y)$ | {H_Y:.4f} |
    | $H(X,Y)$ | $-\sum p(x,y)\log_2 p(x,y)$ | {H_XY:.4f} |
    | $H(X|Y)$ | $H(X,Y) - H(Y)$ | {H_X_given_Y:.4f} |
    | $H(Y|X)$ | $H(X,Y) - H(X)$ | {H_Y_given_X:.4f} |
    | $I(X;Y)$ | $H(X) - H(X|Y)$ | {I_XY:.4f} |

    ### Channel Capacity ({channel_label})

    $$C = {capacity:.4f} \text{{ bits/use}}$$

    {cap_formula}

    The capacity is achieved when $P(X=0) = P(X=1) = 0.5$ (uniform input).
    """)
    return


@app.cell
def _(go, np, VIZ_COLORS, DEFAULT_LAYOUT, channel, h_binary, styled_subplots):
    # Capacity vs epsilon curve
    eps_range = np.linspace(0.001, 0.499, 200)
    if channel == "bsc":
        cap_curve = np.array([1 - h_binary(e) for e in eps_range])
        cap_title = "BSC Capacity: C = 1 - H(ε)"
    else:
        cap_curve = 1 - eps_range
        cap_title = "BEC Capacity: C = 1 - ε"

    # Also: mutual information vs input distribution for current epsilon
    px1_range = np.linspace(0.01, 0.99, 200)

    fig_cap = styled_subplots(
        rows=1, cols=2,
        titles=[cap_title, "I(X;Y) vs P(X=1)"],
        height=400,
    )

    fig_cap.add_trace(go.Scatter(
        x=eps_range, y=cap_curve, mode='lines',
        line=dict(color=VIZ_COLORS[3], width=2.5),
        name='Capacity', showlegend=False,
    ), row=1, col=1)
    fig_cap.update_xaxes(title_text="ε", row=1, col=1)
    fig_cap.update_yaxes(title_text="C (bits/use)", row=1, col=1)

    # I(X;Y) as function of P(X=1) for fixed epsilon
    from itertools import product as _
    eps_fixed = 0.1
    mi_values = []
    for px1_v in px1_range:
        px0_v = 1 - px1_v
        if channel == "bsc":
            py0 = px0_v * (1 - eps_fixed) + px1_v * eps_fixed
            py1 = px0_v * eps_fixed + px1_v * (1 - eps_fixed)
            py = np.array([py0, py1])
            hx = -px0_v * np.log2(px0_v + 1e-30) - px1_v * np.log2(px1_v + 1e-30)
            hy = -np.sum(py * np.log2(py + 1e-30))
            hy_x = h_binary(eps_fixed)
            mi_values.append(hy - hy_x)
        else:
            hy_vals = []
            py = np.array([px0_v * (1 - eps_fixed), px1_v * (1 - eps_fixed), eps_fixed])
            hy = -np.sum(py[py > 0] * np.log2(py[py > 0]))
            hx = -px0_v * np.log2(px0_v + 1e-30) - px1_v * np.log2(px1_v + 1e-30)
            pxy_flat = np.array([px0_v * (1 - eps_fixed), 0, px0_v * eps_fixed,
                                 0, px1_v * (1 - eps_fixed), px1_v * eps_fixed])
            pxy_flat = pxy_flat[pxy_flat > 0]
            hxy = -np.sum(pxy_flat * np.log2(pxy_flat))
            mi_values.append(hx + hy - hxy)

    fig_cap.add_trace(go.Scatter(
        x=px1_range, y=mi_values, mode='lines',
        line=dict(color=VIZ_COLORS[2], width=2.5),
        name='I(X;Y)', showlegend=False,
    ), row=1, col=2)
    fig_cap.update_xaxes(title_text="P(X=1)", row=1, col=2)
    fig_cap.update_yaxes(title_text="I(X;Y) bits", row=1, col=2)
    fig_cap
    return


@app.cell
def _(go, np, VIZ_COLORS, DEFAULT_LAYOUT, channel, eps, pxy, styled_figure):
    # Channel transition diagram as a heatmap
    fig_trans = styled_figure(title="Channel Transition Matrix P(Y|X)", height=350)
    if channel == "bsc":
        trans_matrix = np.array([[1 - eps, eps], [eps, 1 - eps]])
        x_labels = ["Y=0", "Y=1"]
        y_labels = ["X=0", "X=1"]
    else:
        trans_matrix = np.array([[1 - eps, 0, eps], [0, 1 - eps, eps]])
        x_labels = ["Y=0", "Y=1", "Y=e"]
        y_labels = ["X=0", "X=1"]

    fig_trans.add_trace(go.Heatmap(
        z=trans_matrix, x=x_labels, y=y_labels,
        colorscale=[[0, '#ffffff'], [1, VIZ_COLORS[0]]],
        text=np.round(trans_matrix, 3).astype(str),
        texttemplate="%{text}",
        showscale=False,
    ))
    fig_trans.update_yaxes(autorange="reversed")
    fig_trans
    return


@app.cell
def _(mo):
    mo.md(r"""
    ### Key Concepts

    - **Mutual information** $I(X;Y) \geq 0$ with equality iff $X \perp Y$
    - **Data processing inequality**: if $X \to Y \to Z$ is a Markov chain, then $I(X;Z) \leq I(X;Y)$
    - **Shannon's channel coding theorem**: reliable communication is possible at rates up to $C$
    - BSC capacity is achieved at **uniform input**; BEC capacity is also maximized at uniform input
    - As $\varepsilon \to 0$: perfect channel, $C \to 1$ bit/use
    - As $\varepsilon \to 0.5$ (BSC): completely noisy, $C \to 0$

    ---
    *Module 9.2 — Mutual Information & Channel Capacity*
    *Probability Education Platform*
    """)
    return


if __name__ == "__main__":
    app.run()
