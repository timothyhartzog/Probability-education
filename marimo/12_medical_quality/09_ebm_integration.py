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
    from shared.plotting import VIZ_COLORS, DEFAULT_LAYOUT, styled_subplots
    return mo, np, go, make_subplots, stats, VIZ_COLORS, DEFAULT_LAYOUT, styled_subplots


@app.cell
def _(mo):
    mo.md(r"""
    # 12.9 Evidence-Based Medicine Integration

    **Evidence-Based Medicine (EBM)** integrates clinical expertise with the
    best available research evidence. Key measures for treatment decisions:

    - **ARR** (Absolute Risk Reduction) = CER − EER
    - **RRR** (Relative Risk Reduction) = ARR / CER
    - **NNT** (Number Needed to Treat) = 1 / ARR
    - **OR** (Odds Ratio) = $\frac{\text{EER}/(1-\text{EER})}{\text{CER}/(1-\text{CER})}$

    The **Fagan nomogram** concept links **pre-test probability**, **likelihood ratio**,
    and **post-test probability** via Bayes' theorem.
    """)
    return


@app.cell
def _(mo):
    cer = mo.ui.slider(start=0.05, stop=0.60, step=0.01, value=0.30,
                        label="CER (Control Event Rate)")
    eer = mo.ui.slider(start=0.01, stop=0.55, step=0.01, value=0.20,
                        label="EER (Experimental Event Rate)")
    n_control = mo.ui.slider(start=50, stop=1000, step=50, value=200,
                              label="Control group size")
    n_treatment = mo.ui.slider(start=50, stop=1000, step=50, value=200,
                                label="Treatment group size")
    controls = mo.hstack([
        mo.vstack([cer, eer]),
        mo.vstack([n_control, n_treatment]),
    ], justify="start", gap=1)
    mo.md(f"### Controls\n{controls}")
    return cer, eer, n_control, n_treatment


@app.cell
def _(np, stats, cer, eer, n_control, n_treatment):
    CER = cer.value
    EER = eer.value
    nc = n_control.value
    nt = n_treatment.value

    ARR = CER - EER
    RRR = ARR / CER if CER > 0 else 0
    NNT = 1 / ARR if ARR > 0 else float('inf')
    RR = EER / CER if CER > 0 else 0

    # Odds ratio
    odds_e = EER / (1 - EER) if EER < 1 else float('inf')
    odds_c = CER / (1 - CER) if CER < 1 else float('inf')
    OR = odds_e / odds_c if odds_c > 0 else float('inf')

    # Confidence intervals (Wald method)
    se_arr = np.sqrt(CER * (1 - CER) / nc + EER * (1 - EER) / nt)
    z95 = stats.norm.ppf(0.975)
    arr_ci = (ARR - z95 * se_arr, ARR + z95 * se_arr)

    # NNT CI (invert ARR CI)
    if arr_ci[0] > 0:
        nnt_ci = (1 / arr_ci[1], 1 / arr_ci[0])
    else:
        nnt_ci = (float('nan'), float('nan'))

    # OR CI (log method)
    a = int(nt * EER)
    b = nt - a
    c = int(nc * CER)
    d_val = nc - c
    if min(a, b, c, d_val) > 0:
        se_log_or = np.sqrt(1/a + 1/b + 1/c + 1/d_val)
        or_ci = (np.exp(np.log(OR) - z95 * se_log_or),
                 np.exp(np.log(OR) + z95 * se_log_or))
    else:
        or_ci = (float('nan'), float('nan'))

    return CER, EER, ARR, RRR, NNT, RR, OR, arr_ci, nnt_ci, or_ci, se_arr, nc, nt


@app.cell
def _(mo, CER, EER, ARR, RRR, NNT, RR, OR, arr_ci, nnt_ci, or_ci):
    beneficial = ARR > 0
    direction = "beneficial" if beneficial else "harmful" if ARR < 0 else "no difference"
    mo.md(f"""
    ### Treatment Effect Measures

    | Measure | Value | 95% CI |
    |---------|-------|--------|
    | CER | {CER:.3f} | — |
    | EER | {EER:.3f} | — |
    | ARR | {ARR:.4f} | [{arr_ci[0]:.4f}, {arr_ci[1]:.4f}] |
    | RRR | {RRR:.1%} | — |
    | RR | {RR:.3f} | — |
    | NNT | {NNT:.1f} | [{nnt_ci[0]:.1f}, {nnt_ci[1]:.1f}] |
    | OR | {OR:.3f} | [{or_ci[0]:.3f}, {or_ci[1]:.3f}] |

    **Interpretation**: The treatment is **{direction}**. {"You need to treat **" + f"{NNT:.0f}" + "** patients to prevent one additional adverse event." if beneficial else ""}
    """)
    return


@app.cell
def _(np, go, make_subplots, VIZ_COLORS, DEFAULT_LAYOUT, CER, EER, ARR, NNT):
    fig = make_subplots(rows=1, cols=2,
                        subplot_titles=["Evidence Pyramid", "NNT Visualization"],
                        specs=[[{"type": "xy"}, {"type": "xy"}]])

    # Evidence pyramid
    levels = [
        "Expert Opinion", "Case Series", "Case-Control", "Cohort Studies",
        "RCTs", "Systematic Reviews\n& Meta-Analyses"
    ]
    widths = [1.0, 0.85, 0.70, 0.55, 0.40, 0.25]
    colors_pyramid = [VIZ_COLORS[7], VIZ_COLORS[6], VIZ_COLORS[5],
                      VIZ_COLORS[1], VIZ_COLORS[0], VIZ_COLORS[2]]
    y_base = 0
    for i, (level, w, c) in enumerate(zip(levels, widths, colors_pyramid)):
        fig.add_trace(go.Bar(
            x=[level], y=[1], width=[w],
            marker_color=c, showlegend=False,
            text=level, textposition="inside",
            textfont=dict(color="white", size=10)
        ), row=1, col=1)

    fig.update_xaxes(visible=False, row=1, col=1)
    fig.update_yaxes(visible=False, row=1, col=1)

    # NNT icon array visualization
    nnt_int = max(1, int(np.round(NNT))) if np.isfinite(NNT) and ARR > 0 else 20
    grid_size = max(nnt_int, 10)
    cols = int(np.ceil(np.sqrt(grid_size)))
    rows_grid = int(np.ceil(grid_size / cols))

    x_icons, y_icons, colors_icons = [], [], []
    for idx in range(grid_size):
        r = idx // cols
        c = idx % cols
        x_icons.append(c)
        y_icons.append(-r)
        if idx == 0 and ARR > 0:
            colors_icons.append(VIZ_COLORS[2])  # the one helped
        elif idx < nnt_int:
            colors_icons.append(VIZ_COLORS[0])  # treated but not helped
        else:
            colors_icons.append(VIZ_COLORS[7])

    fig.add_trace(go.Scatter(
        x=x_icons, y=y_icons, mode="markers",
        marker=dict(color=colors_icons, size=18, symbol="circle",
                    line=dict(width=1, color="white")),
        showlegend=False,
        hovertext=[f"Patient {i+1}" for i in range(grid_size)]
    ), row=1, col=2)

    fig.update_xaxes(visible=False, row=1, col=2)
    fig.update_yaxes(visible=False, row=1, col=2)

    nnt_label = f"{NNT:.0f}" if np.isfinite(NNT) and ARR > 0 else "∞"
    fig.update_layout(**DEFAULT_LAYOUT, height=450,
                      title=f"EBM Dashboard — NNT = {nnt_label}")
    fig
    return


@app.cell
def _(np, go, VIZ_COLORS, DEFAULT_LAYOUT, CER):
    # Fagan nomogram concept: pre-test probability vs LR+ → post-test probability
    pre_test = np.linspace(0.01, 0.99, 200)
    lr_values = [1, 2, 5, 10, 20]

    fig_fagan = go.Figure()
    for lr in lr_values:
        pre_odds = pre_test / (1 - pre_test)
        post_odds = pre_odds * lr
        post_test = post_odds / (1 + post_odds)
        fig_fagan.add_trace(go.Scatter(
            x=pre_test * 100, y=post_test * 100, mode="lines",
            name=f"LR+ = {lr}",
            line=dict(width=2)
        ))

    fig_fagan.add_trace(go.Scatter(
        x=[0, 100], y=[0, 100], mode="lines", showlegend=False,
        line=dict(color=VIZ_COLORS[7], width=1, dash="dash")
    ))

    fig_fagan.update_layout(**DEFAULT_LAYOUT, height=420,
                            title="Fagan Nomogram Concept — Post-test Probability vs Pre-test Probability",
                            xaxis_title="Pre-test Probability (%)",
                            yaxis_title="Post-test Probability (%)")
    fig_fagan
    return


if __name__ == "__main__":
    app.run()
