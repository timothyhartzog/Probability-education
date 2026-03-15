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
    # 12.3 CUSUM Chart — Sequential Quality Monitoring

    The **Cumulative Sum (CUSUM)** chart detects small, sustained shifts in a
    process mean more quickly than Shewhart charts.

    Two one-sided CUSUM statistics track upward and downward shifts:

    $$C^+_i = \max\!\bigl(0,\; C^+_{i-1} + x_i - \mu_0 - K\bigr)$$
    $$C^-_i = \min\!\bigl(0,\; C^-_{i-1} + x_i - \mu_0 + K\bigr)$$

    - $K$ is the **reference value** (slack, typically $\delta\sigma/2$ for a shift of size $\delta$)
    - $H$ is the **decision interval** — an alarm triggers when $|C^+_i| > H$ or $|C^-_i| > H$

    Larger $K$ makes the chart less sensitive to small shifts; larger $H$ reduces false alarms.
    """)
    return


@app.cell
def _(mo):
    n_observations = mo.ui.slider(start=50, stop=200, step=10, value=100,
                                   label="Number of observations")
    target_mean = mo.ui.slider(start=90.0, stop=110.0, step=1.0, value=100.0,
                                label="Target mean (μ₀)")
    shift_at = mo.ui.slider(start=10, stop=180, step=5, value=60,
                             label="Shift starts at observation")
    shift_size = mo.ui.slider(start=0.0, stop=3.0, step=0.1, value=1.0,
                               label="Shift size (σ units)")
    K_value = mo.ui.slider(start=0.1, stop=2.0, step=0.1, value=0.5, label="K (reference value)")
    H_value = mo.ui.slider(start=1.0, stop=10.0, step=0.5, value=5.0, label="H (decision interval)")
    controls = mo.hstack([
        mo.vstack([n_observations, target_mean, shift_at]),
        mo.vstack([shift_size, K_value, H_value]),
    ], justify="start", gap=1)
    mo.md(f"### Controls\n{controls}")
    return n_observations, target_mean, shift_at, shift_size, K_value, H_value


@app.cell
def _(np, n_observations, target_mean, shift_at, shift_size, K_value, H_value):
    rng = np.random.default_rng(77)
    n = n_observations.value
    mu0 = target_mean.value
    sigma = 5.0
    sa = shift_at.value
    ss = shift_size.value
    K = K_value.value * sigma
    H = H_value.value * sigma

    # Generate data
    x = rng.normal(mu0, sigma, size=n)
    if ss > 0 and sa < n:
        x[sa:] += ss * sigma

    # Compute CUSUM
    Cp = np.zeros(n)
    Cm = np.zeros(n)
    for i in range(n):
        if i == 0:
            Cp[i] = max(0, x[i] - mu0 - K)
            Cm[i] = min(0, x[i] - mu0 + K)
        else:
            Cp[i] = max(0, Cp[i-1] + x[i] - mu0 - K)
            Cm[i] = min(0, Cm[i-1] + x[i] - mu0 + K)

    # Alarm points
    alarm_up = np.where(Cp > H)[0]
    alarm_down = np.where(Cm < -H)[0]
    first_alarm = None
    if len(alarm_up) > 0:
        first_alarm = alarm_up[0]
    if len(alarm_down) > 0:
        ad = alarm_down[0]
        if first_alarm is None or ad < first_alarm:
            first_alarm = ad
    return n, x, Cp, Cm, H, K, mu0, sigma, sa, first_alarm


@app.cell
def _(np, go, make_subplots, VIZ_COLORS, DEFAULT_LAYOUT, n, x, Cp, Cm, H, mu0, sa, first_alarm, shift_size):
    obs = np.arange(1, n + 1)
    fig = make_subplots(rows=2, cols=1, shared_xaxes=True,
                        subplot_titles=["Individual Observations", "CUSUM Statistics"],
                        vertical_spacing=0.12)

    # Top panel: raw data
    fig.add_trace(go.Scatter(x=obs, y=x, mode="markers+lines", name="Observed",
                             marker=dict(color=VIZ_COLORS[0], size=4),
                             line=dict(color=VIZ_COLORS[0], width=1)), row=1, col=1)
    fig.add_hline(y=mu0, line=dict(color=VIZ_COLORS[2], width=2, dash="dash"),
                  annotation_text=f"μ₀ = {mu0:.1f}", row=1, col=1)
    if shift_size.value > 0:
        fig.add_vline(x=sa + 1, line=dict(color=VIZ_COLORS[1], width=1.5, dash="dot"),
                      annotation_text="Shift", row=1, col=1)

    # Bottom panel: CUSUM
    fig.add_trace(go.Scatter(x=obs, y=Cp, mode="lines", name="C⁺ (upper)",
                             line=dict(color=VIZ_COLORS[0], width=2)), row=2, col=1)
    fig.add_trace(go.Scatter(x=obs, y=Cm, mode="lines", name="C⁻ (lower)",
                             line=dict(color=VIZ_COLORS[3], width=2)), row=2, col=1)
    fig.add_hline(y=H, line=dict(color=VIZ_COLORS[4], width=2, dash="dash"),
                  annotation_text=f"H = {H:.1f}", row=2, col=1)
    fig.add_hline(y=-H, line=dict(color=VIZ_COLORS[4], width=2, dash="dash"),
                  annotation_text=f"-H = {-H:.1f}", row=2, col=1)
    fig.add_hline(y=0, line=dict(color=VIZ_COLORS[7], width=1), row=2, col=1)

    if first_alarm is not None:
        fig.add_vline(x=first_alarm + 1, line=dict(color="#dc2626", width=2),
                      annotation_text=f"Alarm at {first_alarm + 1}", row=2, col=1)

    fig.update_layout(**DEFAULT_LAYOUT, height=600,
                      title="CUSUM Chart — Monitoring Hospital Lab Turnaround Time")
    fig.update_xaxes(title_text="Observation Number", row=2, col=1)
    fig.update_yaxes(title_text="Value", row=1, col=1)
    fig.update_yaxes(title_text="CUSUM Statistic", row=2, col=1)
    fig
    return


@app.cell
def _(mo, first_alarm, sa, shift_size):
    if shift_size.value == 0:
        msg = "No shift applied — the CUSUM should remain within the decision boundaries."
    elif first_alarm is not None:
        delay = first_alarm - sa + 1
        msg = (f"Shift introduced at observation **{sa + 1}**. "
               f"CUSUM alarm triggered at observation **{first_alarm + 1}** "
               f"(detection delay: **{delay}** observations).")
    else:
        msg = (f"Shift introduced at observation **{sa + 1}**, but no alarm was triggered. "
               "Try increasing the shift size or decreasing H/K.")
    mo.md(f"### Detection Result\n{msg}")
    return


if __name__ == "__main__":
    app.run()
