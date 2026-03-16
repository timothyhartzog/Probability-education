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
    # 12.7 Clinical Trial Statistics — Power & Sample Size

    Before running a clinical trial, we must determine **how many patients** are
    needed to detect a clinically meaningful effect.

    Key concepts:
    - **Type I error (α)**: rejecting $H_0$ when it is true (false positive)
    - **Type II error (β)**: failing to reject $H_0$ when it is false (false negative)
    - **Power** = $1 - \beta$: probability of detecting a true effect

    For a **two-sample z-test** comparing means:

    $$n = \frac{(z_{\alpha/2} + z_\beta)^2 \cdot 2\sigma^2}{\delta^2}$$

    where $\delta$ is the minimum detectable effect size.
    """)
    return


@app.cell
def _(mo):
    effect_size = mo.ui.slider(start=0.1, stop=1.5, step=0.05, value=0.5,
                                label="Effect size (Cohen's d)")
    alpha = mo.ui.slider(start=0.01, stop=0.10, step=0.005, value=0.05,
                          label="Significance level (α)")
    power_target = mo.ui.slider(start=0.70, stop=0.99, step=0.01, value=0.80,
                                 label="Target power (1-β)")
    test_type = mo.ui.dropdown(
        options={"One-sample z-test": "one_sample", "Two-sample z-test": "two_sample",
                 "Paired t-test": "paired"},
        value="two_sample", label="Test type"
    )
    controls = mo.hstack([
        mo.vstack([effect_size, alpha]),
        mo.vstack([power_target, test_type]),
    ], justify="start", gap=1)
    mo.md(f"### Controls\n{controls}")
    return effect_size, alpha, power_target, test_type


@app.cell
def _(np, stats, effect_size, alpha, power_target, test_type):
    d = effect_size.value
    a = alpha.value
    target_pow = power_target.value
    tt = test_type.value

    z_alpha = stats.norm.ppf(1 - a / 2)
    z_beta = stats.norm.ppf(target_pow)

    # Sample size calculation
    if tt == "one_sample":
        n_required = ((z_alpha + z_beta) / d) ** 2
        multiplier = 1
    elif tt == "two_sample":
        n_required = 2 * ((z_alpha + z_beta) / d) ** 2
        multiplier = 2
    else:  # paired
        n_required = ((z_alpha + z_beta) / d) ** 2
        multiplier = 1

    n_required = int(np.ceil(n_required))

    # Power curve: power as function of n
    n_range = np.arange(5, max(n_required * 3, 50))
    if tt == "two_sample":
        ncp = d * np.sqrt(n_range / 2)
    else:
        ncp = d * np.sqrt(n_range)
    power_curve = 1 - stats.norm.cdf(z_alpha - ncp)
    return d, a, target_pow, tt, n_required, n_range, power_curve, z_alpha, z_beta, multiplier


@app.cell
def _(np, go, make_subplots, stats, VIZ_COLORS, DEFAULT_LAYOUT,
      d, a, n_required, n_range, power_curve, target_pow, z_alpha):
    fig = make_subplots(rows=1, cols=2,
                        subplot_titles=["Power vs Sample Size",
                                        "Type I & II Error Visualization"])

    # Left panel: power curve
    fig.add_trace(go.Scatter(
        x=n_range, y=power_curve, mode="lines", name="Power",
        line=dict(color=VIZ_COLORS[0], width=2.5)
    ), row=1, col=1)
    fig.add_hline(y=target_pow, line=dict(color=VIZ_COLORS[1], width=1.5, dash="dash"),
                  annotation_text=f"Target = {target_pow:.0%}", row=1, col=1)
    fig.add_vline(x=n_required, line=dict(color=VIZ_COLORS[2], width=1.5, dash="dash"),
                  annotation_text=f"n = {n_required}", row=1, col=1)
    fig.add_trace(go.Scatter(
        x=[n_required], y=[target_pow], mode="markers",
        marker=dict(color=VIZ_COLORS[4], size=12, symbol="star"),
        name=f"Required n = {n_required}"
    ), row=1, col=1)

    fig.update_xaxes(title_text="Sample Size (per group)", row=1, col=1)
    fig.update_yaxes(title_text="Statistical Power", range=[0, 1.05], row=1, col=1)

    # Right panel: overlapping distributions
    x_dist = np.linspace(-4, 4 + d * 3, 500)
    null_pdf = stats.norm.pdf(x_dist, 0, 1)
    alt_pdf = stats.norm.pdf(x_dist, d * np.sqrt(n_required), 1)

    # Normalize for display (both on same scale relative to n)
    se = 1.0 / np.sqrt(n_required)
    x_vals = np.linspace(-4 * se, d + 4 * se, 500)
    null_y = stats.norm.pdf(x_vals, 0, se)
    alt_y = stats.norm.pdf(x_vals, d, se)
    crit = z_alpha * se

    fig.add_trace(go.Scatter(x=x_vals, y=null_y, mode="lines", name="H₀ distribution",
                             line=dict(color=VIZ_COLORS[0], width=2)), row=1, col=2)
    fig.add_trace(go.Scatter(x=x_vals, y=alt_y, mode="lines", name="H₁ distribution",
                             line=dict(color=VIZ_COLORS[2], width=2)), row=1, col=2)

    # Shade alpha region
    alpha_x = x_vals[x_vals >= crit]
    alpha_y = stats.norm.pdf(alpha_x, 0, se)
    fig.add_trace(go.Scatter(
        x=np.concatenate([[crit], alpha_x, [alpha_x[-1]]]),
        y=np.concatenate([[0], alpha_y, [0]]),
        fill="toself", fillcolor="rgba(220,38,38,0.3)",
        line=dict(width=0), name=f"α = {a}"
    ), row=1, col=2)

    # Shade beta region
    beta_x = x_vals[x_vals <= crit]
    beta_y = stats.norm.pdf(beta_x, d, se)
    fig.add_trace(go.Scatter(
        x=np.concatenate([[beta_x[0]], beta_x, [crit]]),
        y=np.concatenate([[0], beta_y, [0]]),
        fill="toself", fillcolor="rgba(233,115,25,0.3)",
        line=dict(width=0), name=f"β = {1-target_pow:.2f}"
    ), row=1, col=2)

    fig.add_vline(x=crit, line=dict(color=VIZ_COLORS[7], width=1.5, dash="dash"),
                  annotation_text="Critical value", row=1, col=2)

    fig.update_xaxes(title_text="Effect Size", row=1, col=2)
    fig.update_yaxes(title_text="Density", row=1, col=2)

    fig.update_layout(**DEFAULT_LAYOUT, height=450,
                      title="Clinical Trial Power Analysis")
    fig
    return


@app.cell
def _(mo, d, a, target_pow, n_required, tt):
    test_labels = {"one_sample": "One-sample z-test", "two_sample": "Two-sample z-test",
                   "paired": "Paired t-test"}
    total_n = n_required * 2 if tt == "two_sample" else n_required
    mo.md(f"""
    ### Sample Size Calculation

    | Parameter | Value |
    |-----------|-------|
    | Test type | {test_labels[tt]} |
    | Effect size (d) | {d:.2f} |
    | α (two-sided) | {a:.3f} |
    | Target power | {target_pow:.0%} |
    | **n per group** | **{n_required}** |
    | **Total N** | **{total_n}** |

    With {total_n} total patients, the trial has {target_pow:.0%} power to detect
    an effect of d = {d:.2f} at the {a:.3f} significance level.
    """)
    return


if __name__ == "__main__":
    app.run()
