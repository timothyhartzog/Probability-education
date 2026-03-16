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
    from shared.plotting import VIZ_COLORS, DEFAULT_LAYOUT, styled_subplots
    return mo, np, go, make_subplots, VIZ_COLORS, DEFAULT_LAYOUT, styled_subplots


@app.cell
def _(mo):
    mo.md(r"""
    # 12.8 Disease Modeling — SIR & SEIR Compartmental Models

    Compartmental models divide a population into groups based on disease status.

    **SIR model** (Susceptible → Infected → Recovered):

    $$\frac{dS}{dt} = -\beta S I, \qquad \frac{dI}{dt} = \beta S I - \gamma I, \qquad \frac{dR}{dt} = \gamma I$$

    **SEIR model** adds an **Exposed** compartment (latent period):

    $$\frac{dE}{dt} = \beta S I - \sigma E, \qquad \frac{dI}{dt} = \sigma E - \gamma I$$

    Key quantities:
    - **Basic reproduction number**: $R_0 = \beta / \gamma$
    - **Herd immunity threshold**: $1 - 1/R_0$
    """)
    return


@app.cell
def _(mo):
    model_type = mo.ui.dropdown(
        options={"SIR": "sir", "SEIR": "seir"},
        value="sir", label="Model type"
    )
    beta = mo.ui.slider(start=0.1, stop=1.0, step=0.01, value=0.3, label="β (transmission rate)")
    gamma = mo.ui.slider(start=0.01, stop=0.5, step=0.01, value=0.1, label="γ (recovery rate)")
    sigma = mo.ui.slider(start=0.05, stop=1.0, step=0.05, value=0.2,
                          label="σ (1/latent period, SEIR only)")
    initial_infected = mo.ui.slider(start=0.0001, stop=0.05, step=0.0001, value=0.001,
                                     label="Initial infected fraction")
    n_days = mo.ui.slider(start=50, stop=365, step=10, value=160, label="Simulation days")
    controls = mo.hstack([
        mo.vstack([model_type, beta, gamma]),
        mo.vstack([sigma, initial_infected, n_days]),
    ], justify="start", gap=1)
    mo.md(f"### Controls\n{controls}")
    return model_type, beta, gamma, sigma, initial_infected, n_days


@app.cell
def _(np, model_type, beta, gamma, sigma, initial_infected, n_days):
    b = beta.value
    g = gamma.value
    sig = sigma.value
    I0 = initial_infected.value
    days = n_days.value
    mt = model_type.value
    dt = 0.1
    steps = int(days / dt)
    t = np.linspace(0, days, steps)

    R0 = b / g
    herd_threshold = max(0, 1 - 1 / R0) if R0 > 1 else 0

    if mt == "sir":
        S = np.zeros(steps)
        I = np.zeros(steps)
        R = np.zeros(steps)
        S[0], I[0], R[0] = 1 - I0, I0, 0
        for i in range(1, steps):
            dS = -b * S[i-1] * I[i-1]
            dI = b * S[i-1] * I[i-1] - g * I[i-1]
            dR = g * I[i-1]
            S[i] = S[i-1] + dS * dt
            I[i] = I[i-1] + dI * dt
            R[i] = R[i-1] + dR * dt
        E = None
    else:
        S = np.zeros(steps)
        E = np.zeros(steps)
        I = np.zeros(steps)
        R = np.zeros(steps)
        S[0], E[0], I[0], R[0] = 1 - I0, 0, I0, 0
        for i in range(1, steps):
            dS = -b * S[i-1] * I[i-1]
            dE = b * S[i-1] * I[i-1] - sig * E[i-1]
            dI = sig * E[i-1] - g * I[i-1]
            dR = g * I[i-1]
            S[i] = S[i-1] + dS * dt
            E[i] = E[i-1] + dE * dt
            I[i] = I[i-1] + dI * dt
            R[i] = R[i-1] + dR * dt

    peak_I = I.max()
    peak_day = t[I.argmax()]
    final_R = R[-1]
    return t, S, E, I, R, R0, herd_threshold, peak_I, peak_day, final_R, mt


@app.cell
def _(np, go, make_subplots, VIZ_COLORS, DEFAULT_LAYOUT,
      t, S, E, I, R, R0, herd_threshold, mt):
    fig = make_subplots(rows=1, cols=2,
                        subplot_titles=["Compartment Dynamics", "Phase Portrait (S vs I)"],
                        horizontal_spacing=0.1)

    fig.add_trace(go.Scatter(x=t, y=S, mode="lines", name="Susceptible (S)",
                             line=dict(color=VIZ_COLORS[0], width=2)), row=1, col=1)
    if mt == "seir" and E is not None:
        fig.add_trace(go.Scatter(x=t, y=E, mode="lines", name="Exposed (E)",
                                 line=dict(color=VIZ_COLORS[6], width=2)), row=1, col=1)
    fig.add_trace(go.Scatter(x=t, y=I, mode="lines", name="Infected (I)",
                             line=dict(color=VIZ_COLORS[4], width=2.5)), row=1, col=1)
    fig.add_trace(go.Scatter(x=t, y=R, mode="lines", name="Recovered (R)",
                             line=dict(color=VIZ_COLORS[2], width=2)), row=1, col=1)

    # Herd immunity threshold line
    if R0 > 1:
        fig.add_hline(y=1 / R0, line=dict(color=VIZ_COLORS[7], width=1, dash="dot"),
                      annotation_text=f"S = 1/R₀ = {1/R0:.3f}", row=1, col=1)

    fig.update_xaxes(title_text="Days", row=1, col=1)
    fig.update_yaxes(title_text="Fraction of Population", row=1, col=1)

    # Phase portrait: S vs I
    fig.add_trace(go.Scatter(x=S, y=I, mode="lines", name="Trajectory",
                             line=dict(color=VIZ_COLORS[3], width=2),
                             showlegend=False), row=1, col=2)
    fig.add_trace(go.Scatter(x=[S[0]], y=[I[0]], mode="markers", name="Start",
                             marker=dict(color=VIZ_COLORS[2], size=10, symbol="circle")),
                  row=1, col=2)
    fig.add_trace(go.Scatter(x=[S[-1]], y=[I[-1]], mode="markers", name="End",
                             marker=dict(color=VIZ_COLORS[4], size=10, symbol="square")),
                  row=1, col=2)
    if R0 > 1:
        fig.add_vline(x=1/R0, line=dict(color=VIZ_COLORS[7], width=1, dash="dot"),
                      annotation_text=f"1/R₀", row=1, col=2)

    fig.update_xaxes(title_text="Susceptible (S)", row=1, col=2)
    fig.update_yaxes(title_text="Infected (I)", row=1, col=2)

    model_label = "SEIR" if mt == "seir" else "SIR"
    fig.update_layout(**DEFAULT_LAYOUT, height=480,
                      title=f"{model_label} Model — R₀ = {R0:.2f}")
    fig
    return


@app.cell
def _(mo, R0, herd_threshold, peak_I, peak_day, final_R, mt):
    model_label = "SEIR" if mt == "seir" else "SIR"
    mo.md(f"""
    ### {model_label} Model Summary

    | Metric | Value |
    |--------|-------|
    | R₀ | {R0:.2f} |
    | Herd immunity threshold | {herd_threshold:.1%} |
    | Peak infected fraction | {peak_I:.4f} ({peak_I*100:.2f}%) |
    | Peak day | {peak_day:.1f} |
    | Final recovered fraction | {final_R:.4f} ({final_R*100:.2f}%) |
    | Epidemic occurs? | {"Yes" if R0 > 1 else "No (R₀ ≤ 1)"} |
    """)
    return


if __name__ == "__main__":
    app.run()
