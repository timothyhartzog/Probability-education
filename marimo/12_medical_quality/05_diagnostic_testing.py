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
    # 12.5 Diagnostic Testing — Sensitivity, Specificity & ROC

    Evaluating a diagnostic test requires understanding:

    - **Sensitivity (Se)**: $P(\text{Test}^+ | \text{Disease}^+)$ — true positive rate
    - **Specificity (Sp)**: $P(\text{Test}^- | \text{Disease}^-)$ — true negative rate
    - **PPV**: $P(\text{Disease}^+ | \text{Test}^+)$
    - **NPV**: $P(\text{Disease}^- | \text{Test}^-)$

    **Bayes' theorem** links these via prevalence:

    $$\text{PPV} = \frac{\text{Se} \times \text{Prev}}{\text{Se} \times \text{Prev} + (1 - \text{Sp})(1 - \text{Prev})}$$
    """)
    return


@app.cell
def _(mo):
    sensitivity = mo.ui.slider(start=0.50, stop=1.00, step=0.01, value=0.90, label="Sensitivity")
    specificity = mo.ui.slider(start=0.50, stop=1.00, step=0.01, value=0.95, label="Specificity")
    prevalence = mo.ui.slider(start=0.001, stop=0.30, step=0.001, value=0.05, label="Prevalence")
    n_patients = mo.ui.slider(start=500, stop=10000, step=500, value=2000, label="Population size")
    controls = mo.hstack([
        mo.vstack([sensitivity, specificity]),
        mo.vstack([prevalence, n_patients]),
    ], justify="start", gap=1)
    mo.md(f"### Controls\n{controls}")
    return sensitivity, specificity, prevalence, n_patients


@app.cell
def _(np, sensitivity, specificity, prevalence, n_patients):
    Se = sensitivity.value
    Sp = specificity.value
    Prev = prevalence.value
    N = n_patients.value

    # 2x2 table
    diseased = int(N * Prev)
    healthy = N - diseased
    TP = int(diseased * Se)
    FN = diseased - TP
    FP = int(healthy * (1 - Sp))
    TN = healthy - FP

    # Predictive values via Bayes
    PPV = (Se * Prev) / (Se * Prev + (1 - Sp) * (1 - Prev))
    NPV = (Sp * (1 - Prev)) / (Sp * (1 - Prev) + (1 - Se) * Prev)

    # Likelihood ratios
    LR_pos = Se / (1 - Sp) if Sp < 1 else float('inf')
    LR_neg = (1 - Se) / Sp if Sp > 0 else 0
    return Se, Sp, Prev, N, TP, FN, FP, TN, PPV, NPV, LR_pos, LR_neg


@app.cell
def _(mo, TP, FN, FP, TN, Se, Sp, PPV, NPV, LR_pos, LR_neg):
    mo.md(f"""
    ### 2 x 2 Contingency Table

    |  | Disease + | Disease - | Total |
    |--|-----------|-----------|-------|
    | **Test +** | {TP} (TP) | {FP} (FP) | {TP + FP} |
    | **Test -** | {FN} (FN) | {TN} (TN) | {FN + TN} |
    | **Total** | {TP + FN} | {FP + TN} | {TP + FN + FP + TN} |

    ### Performance Metrics

    | Metric | Value |
    |--------|-------|
    | Sensitivity | {Se:.3f} |
    | Specificity | {Sp:.3f} |
    | PPV | {PPV:.4f} |
    | NPV | {NPV:.4f} |
    | LR+ | {LR_pos:.2f} |
    | LR- | {LR_neg:.4f} |
    """)
    return


@app.cell
def _(np, go, make_subplots, VIZ_COLORS, DEFAULT_LAYOUT, Se, Sp, Prev):
    fig = make_subplots(rows=1, cols=2,
                        subplot_titles=["ROC Curve", "PPV vs Prevalence"])

    # ROC curve: vary threshold conceptually
    # Generate a smooth ROC using a parametric model
    rng = np.random.default_rng(10)
    # The current test point
    fig.add_trace(go.Scatter(
        x=[0, 1 - Sp, 1], y=[0, Se, 1],
        mode="lines", name="ROC",
        line=dict(color=VIZ_COLORS[0], width=2)
    ), row=1, col=1)

    # More realistic ROC: use a binormal model
    d_prime = 2.0  # separation
    thresholds = np.linspace(-4, 4, 200)
    from scipy import stats as sp_stats
    fpr_curve = 1 - sp_stats.norm.cdf(thresholds)
    tpr_curve = 1 - sp_stats.norm.cdf(thresholds - d_prime)
    auc = np.trapz(tpr_curve[::-1], fpr_curve[::-1])

    fig.add_trace(go.Scatter(
        x=fpr_curve, y=tpr_curve, mode="lines", name=f"Binormal ROC (AUC={auc:.3f})",
        line=dict(color=VIZ_COLORS[0], width=2.5)
    ), row=1, col=1)

    # Current operating point
    fig.add_trace(go.Scatter(
        x=[1 - Sp], y=[Se], mode="markers", name="Current test",
        marker=dict(color=VIZ_COLORS[4], size=12, symbol="star")
    ), row=1, col=1)

    # Diagonal
    fig.add_trace(go.Scatter(
        x=[0, 1], y=[0, 1], mode="lines", showlegend=False,
        line=dict(color=VIZ_COLORS[7], width=1, dash="dash")
    ), row=1, col=1)

    # PPV vs Prevalence
    prev_range = np.linspace(0.001, 0.5, 200)
    ppv_curve = (Se * prev_range) / (Se * prev_range + (1 - Sp) * (1 - prev_range))
    fig.add_trace(go.Scatter(
        x=prev_range, y=ppv_curve, mode="lines", name="PPV",
        line=dict(color=VIZ_COLORS[2], width=2.5)
    ), row=1, col=2)

    # Current prevalence
    ppv_current = (Se * Prev) / (Se * Prev + (1 - Sp) * (1 - Prev))
    fig.add_trace(go.Scatter(
        x=[Prev], y=[ppv_current], mode="markers", name=f"Current (PPV={ppv_current:.3f})",
        marker=dict(color=VIZ_COLORS[4], size=12, symbol="star")
    ), row=1, col=2)

    fig.update_xaxes(title_text="False Positive Rate (1 - Sp)", row=1, col=1)
    fig.update_yaxes(title_text="True Positive Rate (Se)", row=1, col=1)
    fig.update_xaxes(title_text="Prevalence", row=1, col=2)
    fig.update_yaxes(title_text="Positive Predictive Value", row=1, col=2)

    fig.update_layout(**DEFAULT_LAYOUT, height=450,
                      title="Diagnostic Test Performance")
    fig
    return


if __name__ == "__main__":
    app.run()
