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
    # 12.10 Vaccine-Preventable Disease Simulator

    This module extends the **SIR model** with vaccination. A fraction of the
    population is vaccinated before the outbreak, effectively moving them from
    the Susceptible to the Recovered compartment.

    $$S_0^{\text{vax}} = S_0 \times (1 - v), \qquad R_0^{\text{vax}} = v$$

    where $v$ is the vaccination rate. The **effective reproduction number** becomes:

    $$R_e = R_0 \times (1 - v)$$

    When $R_e < 1$, **herd immunity** is achieved and the outbreak cannot sustain itself.
    The **herd immunity threshold** is $v^* = 1 - 1/R_0$.
    """)
    return


@app.cell
def _(mo):
    disease_preset = mo.ui.dropdown(
        options={
            "Measles (R₀ ≈ 15)": "measles",
            "Influenza (R₀ ≈ 2)": "flu",
            "COVID-19 (R₀ ≈ 3)": "covid",
            "Custom": "custom"
        },
        value="covid", label="Disease preset"
    )
    vaccination_rate = mo.ui.slider(start=0.0, stop=0.99, step=0.01, value=0.0,
                                     label="Vaccination rate (v)")
    n_days = mo.ui.slider(start=50, stop=365, step=10, value=180, label="Simulation days")
    population = mo.ui.slider(start=1000, stop=1000000, step=1000, value=100000,
                               label="Population size")
    controls = mo.hstack([
        mo.vstack([disease_preset, vaccination_rate]),
        mo.vstack([n_days, population]),
    ], justify="start", gap=1)
    mo.md(f"### Controls\n{controls}")
    return disease_preset, vaccination_rate, n_days, population


@app.cell
def _(np, disease_preset, vaccination_rate, n_days, population):
    preset = disease_preset.value
    v = vaccination_rate.value
    days = n_days.value
    pop = population.value

    # Disease parameters
    presets = {
        "measles": {"beta": 1.5, "gamma": 0.1, "name": "Measles"},
        "flu": {"beta": 0.4, "gamma": 0.2, "name": "Influenza"},
        "covid": {"beta": 0.3, "gamma": 0.1, "name": "COVID-19"},
        "custom": {"beta": 0.3, "gamma": 0.1, "name": "Custom"},
    }
    params = presets[preset]
    beta = params["beta"]
    gamma = params["gamma"]
    disease_name = params["name"]

    R0 = beta / gamma
    Re = R0 * (1 - v)
    herd_threshold = max(0, 1 - 1 / R0) if R0 > 1 else 0

    I0_frac = 1.0 / pop  # one initial case
    dt = 0.1
    steps = int(days / dt)
    t = np.linspace(0, days, steps)

    def run_sir(vax_rate):
        S = np.zeros(steps)
        I_arr = np.zeros(steps)
        R = np.zeros(steps)
        S[0] = (1 - I0_frac) * (1 - vax_rate)
        I_arr[0] = I0_frac
        R[0] = vax_rate
        for i in range(1, steps):
            dS = -beta * S[i-1] * I_arr[i-1]
            dI = beta * S[i-1] * I_arr[i-1] - gamma * I_arr[i-1]
            dR = gamma * I_arr[i-1]
            S[i] = max(0, S[i-1] + dS * dt)
            I_arr[i] = max(0, I_arr[i-1] + dI * dt)
            R[i] = min(1, R[i-1] + dR * dt)
        return S, I_arr, R

    S_novax, I_novax, R_novax = run_sir(0.0)
    S_vax, I_vax, R_vax = run_sir(v)

    peak_novax = I_novax.max()
    peak_vax = I_vax.max()
    total_infected_novax = R_novax[-1] - 0.0
    total_infected_vax = R_vax[-1] - v
    return (t, S_novax, I_novax, R_novax, S_vax, I_vax, R_vax,
            R0, Re, herd_threshold, v, pop, disease_name,
            peak_novax, peak_vax, total_infected_novax, total_infected_vax, beta, gamma)


@app.cell
def _(np, go, make_subplots, VIZ_COLORS, DEFAULT_LAYOUT,
      t, I_novax, I_vax, S_vax, R_vax,
      R0, Re, herd_threshold, v, disease_name, pop):
    fig = make_subplots(rows=1, cols=2,
                        subplot_titles=[
                            f"Outbreak Comparison — {disease_name}",
                            "Herd Immunity Threshold"
                        ])

    # Left panel: infection curves
    fig.add_trace(go.Scatter(x=t, y=I_novax * pop, mode="lines",
                             name="No vaccination",
                             line=dict(color=VIZ_COLORS[4], width=2, dash="dash")),
                  row=1, col=1)
    fig.add_trace(go.Scatter(x=t, y=I_vax * pop, mode="lines",
                             name=f"Vaccinated ({v:.0%})",
                             line=dict(color=VIZ_COLORS[2], width=2.5)),
                  row=1, col=1)

    fig.update_xaxes(title_text="Days", row=1, col=1)
    fig.update_yaxes(title_text="Number Infected", row=1, col=1)

    # Right panel: herd immunity visualization
    vax_range = np.linspace(0, 0.99, 200)
    Re_curve = R0 * (1 - vax_range)

    fig.add_trace(go.Scatter(x=vax_range * 100, y=Re_curve, mode="lines",
                             name="Rₑ",
                             line=dict(color=VIZ_COLORS[0], width=2.5)),
                  row=1, col=2)
    fig.add_hline(y=1, line=dict(color=VIZ_COLORS[4], width=1.5, dash="dash"),
                  annotation_text="Rₑ = 1 (threshold)", row=1, col=2)
    fig.add_vline(x=herd_threshold * 100,
                  line=dict(color=VIZ_COLORS[2], width=1.5, dash="dot"),
                  annotation_text=f"HIT = {herd_threshold:.0%}", row=1, col=2)

    # Current vaccination point
    fig.add_trace(go.Scatter(
        x=[v * 100], y=[Re], mode="markers",
        name=f"Current (v={v:.0%}, Rₑ={Re:.2f})",
        marker=dict(color=VIZ_COLORS[1], size=12, symbol="star")
    ), row=1, col=2)

    # Shade region where Re < 1
    fill_x = vax_range[Re_curve <= 1] * 100
    fill_y = Re_curve[Re_curve <= 1]
    if len(fill_x) > 0:
        fig.add_trace(go.Scatter(
            x=np.concatenate([fill_x, fill_x[::-1]]),
            y=np.concatenate([fill_y, np.zeros(len(fill_y))]),
            fill="toself", fillcolor="rgba(5,150,105,0.15)",
            line=dict(width=0), name="Herd immunity zone", showlegend=True
        ), row=1, col=2)

    fig.update_xaxes(title_text="Vaccination Rate (%)", row=1, col=2)
    fig.update_yaxes(title_text="Effective R (Rₑ)", row=1, col=2)

    fig.update_layout(**DEFAULT_LAYOUT, height=480,
                      title=f"{disease_name} — Vaccination Impact (R₀ = {R0:.1f})")
    fig
    return


@app.cell
def _(mo, R0, Re, herd_threshold, v, disease_name, pop,
      peak_novax, peak_vax, total_infected_novax, total_infected_vax):
    cases_prevented = max(0, (total_infected_novax - total_infected_vax) * pop)
    herd_achieved = "Yes" if Re < 1 else "No"
    mo.md(f"""
    ### {disease_name} Simulation Summary

    | Metric | No Vaccination | With {v:.0%} Vaccination |
    |--------|---------------|------------------------|
    | Peak infected | {peak_novax * pop:,.0f} ({peak_novax:.2%}) | {peak_vax * pop:,.0f} ({peak_vax:.2%}) |
    | Total infected | {total_infected_novax * pop:,.0f} ({total_infected_novax:.1%}) | {max(0, total_infected_vax) * pop:,.0f} ({max(0, total_infected_vax):.1%}) |

    | Parameter | Value |
    |-----------|-------|
    | R₀ | {R0:.2f} |
    | Rₑ (with vaccination) | {Re:.2f} |
    | Herd immunity threshold | {herd_threshold:.1%} |
    | Herd immunity achieved? | **{herd_achieved}** |
    | Cases prevented by vaccination | **{cases_prevented:,.0f}** |

    {"The vaccination rate exceeds the herd immunity threshold — the outbreak is contained." if Re < 1 else f"To achieve herd immunity, vaccination must reach at least **{herd_threshold:.0%}** of the population."}
    """)
    return


if __name__ == "__main__":
    app.run()
