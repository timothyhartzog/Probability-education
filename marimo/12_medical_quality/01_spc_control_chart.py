import marimo

app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import numpy as np
    import plotly.graph_objects as go
    from plotly.subplots import make_subplots
    from scipy import stats
    import sys
    sys.path.insert(0, "..")
    from shared.plotting import VIZ_COLORS, DEFAULT_LAYOUT, styled_figure, styled_subplots
    return mo, np, go, make_subplots, stats, VIZ_COLORS, DEFAULT_LAYOUT, styled_figure, styled_subplots


@app.cell
def _(mo):
    mo.md(r"""
    # 12.1 Statistical Process Control (SPC) Charts

    SPC charts monitor hospital quality metrics over time, distinguishing **common-cause**
    variation (inherent to the process) from **special-cause** variation (signals of change).

    **Control limits** for an $\bar{X}$ chart:

    $$\text{UCL} = \bar{\bar{X}} + \frac{3\hat{\sigma}}{\sqrt{n}}, \qquad \text{LCL} = \bar{\bar{X}} - \frac{3\hat{\sigma}}{\sqrt{n}}$$

    **Western Electric rules** flag special causes when:
    1. One point beyond 3σ (Zone A)
    2. Two of three consecutive points beyond 2σ (Zone B)
    3. Four of five consecutive points beyond 1σ (Zone C)
    4. Eight consecutive points on one side of the center line
    """)
    return


@app.cell
def _(mo):
    chart_type = mo.ui.dropdown(
        options={"X-bar Chart": "xbar", "R Chart": "rchart", "p-Chart": "pchart"},
        value="xbar", label="Chart type"
    )
    n_samples = mo.ui.slider(start=20, stop=60, step=1, value=30, label="Number of samples")
    subgroup_size = mo.ui.slider(start=3, stop=10, step=1, value=5, label="Subgroup size (n)")
    shift_point = mo.ui.slider(start=5, stop=55, step=1, value=20, label="Shift starts at sample")
    shift_magnitude = mo.ui.slider(start=0.0, stop=3.0, step=0.1, value=0.0, label="Shift magnitude (σ units)")
    controls = mo.hstack([
        mo.vstack([chart_type, n_samples]),
        mo.vstack([subgroup_size, shift_point]),
        mo.vstack([shift_magnitude]),
    ], justify="start", gap=1)
    mo.md(f"### Controls\n{controls}")
    return chart_type, n_samples, subgroup_size, shift_point, shift_magnitude


@app.cell
def _(np, chart_type, n_samples, subgroup_size, shift_point, shift_magnitude):
    rng = np.random.default_rng(42)
    k = n_samples.value
    n = subgroup_size.value
    sp = shift_point.value
    sm = shift_magnitude.value
    ct = chart_type.value

    if ct in ("xbar", "rchart"):
        base_mean, base_std = 100.0, 5.0
        data = rng.normal(base_mean, base_std, size=(k, n))
        if sm > 0 and sp < k:
            data[sp:] += sm * base_std
        xbar = data.mean(axis=1)
        ranges = data.max(axis=1) - data.min(axis=1)
        grand_mean = xbar.mean()
        rbar = ranges.mean()
        # A2 and D3/D4 constants for subgroup sizes
        d2_table = {2: 1.128, 3: 1.693, 4: 2.059, 5: 2.326, 6: 2.534, 7: 2.704,
                    8: 2.847, 9: 2.970, 10: 3.078}
        A2_table = {2: 1.880, 3: 1.023, 4: 0.729, 5: 0.577, 6: 0.483, 7: 0.419,
                    8: 0.373, 9: 0.337, 10: 0.308}
        D3_table = {2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0.076, 8: 0.136, 9: 0.184, 10: 0.223}
        D4_table = {2: 3.267, 3: 2.575, 4: 2.282, 5: 2.115, 6: 2.004, 7: 1.924,
                    8: 1.864, 9: 1.816, 10: 1.777}
        d2 = d2_table[n]
        sigma_hat = rbar / d2
        # X-bar limits
        xbar_ucl = grand_mean + 3 * sigma_hat / np.sqrt(n)
        xbar_lcl = grand_mean - 3 * sigma_hat / np.sqrt(n)
        # R chart limits
        r_ucl = D4_table[n] * rbar
        r_lcl = D3_table[n] * rbar
        # Zone boundaries for X-bar
        zone_1s = sigma_hat / np.sqrt(n)
        spc_result = {
            "type": "xbar", "xbar": xbar, "ranges": ranges,
            "grand_mean": grand_mean, "rbar": rbar,
            "xbar_ucl": xbar_ucl, "xbar_lcl": xbar_lcl,
            "r_ucl": r_ucl, "r_lcl": r_lcl,
            "zone_1s": zone_1s, "k": k,
        }
    else:
        base_p = 0.05
        data_counts = rng.binomial(n, base_p, size=k)
        if sm > 0 and sp < k:
            shifted_p = min(base_p + sm * 0.02, 0.99)
            data_counts[sp:] = rng.binomial(n, shifted_p, size=k - sp)
        phat = data_counts / n
        pbar = phat.mean()
        p_ucl = pbar + 3 * np.sqrt(pbar * (1 - pbar) / n)
        p_lcl = max(0, pbar - 3 * np.sqrt(pbar * (1 - pbar) / n))
        zone_1s = np.sqrt(pbar * (1 - pbar) / n)
        spc_result = {
            "type": "pchart", "phat": phat, "pbar": pbar,
            "p_ucl": p_ucl, "p_lcl": p_lcl,
            "zone_1s": zone_1s, "k": k,
        }
    return spc_result, ct


@app.cell
def _(np, go, VIZ_COLORS, DEFAULT_LAYOUT, spc_result, ct):
    res = spc_result
    k = res["k"]
    samples = np.arange(1, k + 1)

    if ct in ("xbar", "rchart"):
        if ct == "xbar":
            values = res["xbar"]
            cl = res["grand_mean"]
            ucl = res["xbar_ucl"]
            lcl = res["xbar_lcl"]
            z1 = res["zone_1s"]
            title = "X-bar Control Chart — Hospital Wait Times"
            yaxis_title = "Sample Mean (minutes)"
        else:
            values = res["ranges"]
            cl = res["rbar"]
            ucl = res["r_ucl"]
            lcl = res["r_lcl"]
            z1 = (ucl - cl) / 3
            title = "R Control Chart — Hospital Wait Times"
            yaxis_title = "Sample Range (minutes)"
    else:
        values = res["phat"]
        cl = res["pbar"]
        ucl = res["p_ucl"]
        lcl = res["p_lcl"]
        z1 = res["zone_1s"]
        title = "p-Chart — Hospital Complication Rate"
        yaxis_title = "Proportion"

    # Detect Western Electric rule violations
    violations = np.zeros(k, dtype=bool)
    for i in range(k):
        if values[i] > ucl or values[i] < lcl:
            violations[i] = True
    # Rule 4: 8 consecutive on one side
    for i in range(7, k):
        segment = values[i-7:i+1]
        if np.all(segment > cl) or np.all(segment < cl):
            violations[i-7:i+1] = True

    fig = go.Figure()
    # Zone bands
    for mult, zone_label, opacity in [(1, "C", 0.06), (2, "B", 0.06), (3, "A", 0.06)]:
        fig.add_hrect(y0=cl - mult * z1, y1=cl + mult * z1,
                      fillcolor=VIZ_COLORS[0], opacity=opacity,
                      line_width=0, annotation_text=f"Zone {zone_label}" if mult == 3 else None)

    # Normal points
    normal_mask = ~violations
    fig.add_trace(go.Scatter(x=samples[normal_mask], y=values[normal_mask],
                             mode="markers+lines", name="In control",
                             marker=dict(color=VIZ_COLORS[0], size=7),
                             line=dict(color=VIZ_COLORS[0], width=1.5)))
    # Violation points
    if violations.any():
        fig.add_trace(go.Scatter(x=samples[violations], y=values[violations],
                                 mode="markers", name="Special cause",
                                 marker=dict(color=VIZ_COLORS[4], size=10, symbol="x")))

    fig.add_hline(y=cl, line=dict(color=VIZ_COLORS[2], width=2, dash="solid"),
                  annotation_text=f"CL = {cl:.2f}")
    fig.add_hline(y=ucl, line=dict(color=VIZ_COLORS[1], width=2, dash="dash"),
                  annotation_text=f"UCL = {ucl:.2f}")
    fig.add_hline(y=lcl, line=dict(color=VIZ_COLORS[1], width=2, dash="dash"),
                  annotation_text=f"LCL = {lcl:.2f}")
    fig.update_layout(**DEFAULT_LAYOUT, title=title,
                      xaxis_title="Sample Number", yaxis_title=yaxis_title, height=500)
    fig
    return


@app.cell
def _(mo, spc_result, ct):
    res = spc_result
    if ct == "xbar":
        summary = f"""
        ### Summary Statistics
        | Metric | Value |
        |--------|-------|
        | Grand Mean (X̄̄) | {res['grand_mean']:.2f} |
        | Average Range (R̄) | {res['rbar']:.2f} |
        | UCL | {res['xbar_ucl']:.2f} |
        | LCL | {res['xbar_lcl']:.2f} |
        | Est. σ | {res['zone_1s'] * (res['k'] ** 0.5):.2f} |
        """
    elif ct == "rchart":
        summary = f"""
        ### Summary Statistics
        | Metric | Value |
        |--------|-------|
        | Average Range (R̄) | {res['rbar']:.2f} |
        | UCL | {res['r_ucl']:.2f} |
        | LCL | {res['r_lcl']:.2f} |
        """
    else:
        summary = f"""
        ### Summary Statistics
        | Metric | Value |
        |--------|-------|
        | p̄ | {res['pbar']:.4f} |
        | UCL | {res['p_ucl']:.4f} |
        | LCL | {res['p_lcl']:.4f} |
        """
    mo.md(summary)
    return


if __name__ == "__main__":
    app.run()
