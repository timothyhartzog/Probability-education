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
    # 12.6 Meta-Analysis — Forest Plot & Heterogeneity

    Meta-analysis combines results from multiple studies to estimate an overall
    treatment effect. Key components:

    - **Forest plot**: individual study effects with confidence intervals
    - **Fixed-effects model**: weights by inverse variance $w_i = 1/\sigma_i^2$
    - **Random-effects model** (DerSimonian-Laird): adds between-study variance $\tau^2$

    **Heterogeneity** measures:
    - $Q = \sum w_i(\hat{\theta}_i - \hat{\theta}_{\text{FE}})^2 \sim \chi^2_{k-1}$
    - $I^2 = \max\!\left(0,\; \frac{Q - (k-1)}{Q}\right) \times 100\%$
    """)
    return


@app.cell
def _(mo):
    n_studies = mo.ui.slider(start=5, stop=20, step=1, value=10, label="Number of studies")
    true_effect = mo.ui.slider(start=-1.0, stop=1.0, step=0.05, value=0.3, label="True effect (d)")
    heterogeneity = mo.ui.slider(start=0.0, stop=1.0, step=0.05, value=0.2,
                                  label="Between-study SD (τ)")
    model_type = mo.ui.dropdown(
        options={"Fixed-effects": "fixed", "Random-effects": "random"},
        value="random", label="Pooling model"
    )
    controls = mo.hstack([
        mo.vstack([n_studies, true_effect]),
        mo.vstack([heterogeneity, model_type]),
    ], justify="start", gap=1)
    mo.md(f"### Controls\n{controls}")
    return n_studies, true_effect, heterogeneity, model_type


@app.cell
def _(np, stats, n_studies, true_effect, heterogeneity):
    rng = np.random.default_rng(55)
    k = n_studies.value
    d_true = true_effect.value
    tau = heterogeneity.value

    # Generate study-specific true effects
    study_effects = rng.normal(d_true, tau, size=k)
    # Study sample sizes
    sample_sizes = rng.integers(30, 500, size=k)
    # Within-study SE
    se = 1.0 / np.sqrt(sample_sizes) * rng.uniform(0.8, 1.2, size=k)
    # Observed effects
    observed = study_effects + rng.normal(0, se)

    # Fixed-effects
    w_fe = 1.0 / se**2
    theta_fe = np.sum(w_fe * observed) / np.sum(w_fe)
    se_fe = 1.0 / np.sqrt(np.sum(w_fe))

    # Heterogeneity
    Q = np.sum(w_fe * (observed - theta_fe)**2)
    df = k - 1
    Q_pval = 1 - stats.chi2.cdf(Q, df)
    I2 = max(0, (Q - df) / Q) * 100 if Q > 0 else 0

    # DerSimonian-Laird tau^2 estimate
    C = np.sum(w_fe) - np.sum(w_fe**2) / np.sum(w_fe)
    tau2_dl = max(0, (Q - df) / C)

    # Random-effects
    w_re = 1.0 / (se**2 + tau2_dl)
    theta_re = np.sum(w_re * observed) / np.sum(w_re)
    se_re = 1.0 / np.sqrt(np.sum(w_re))

    study_names = [f"Study {i+1}" for i in range(k)]
    return (k, observed, se, sample_sizes, study_names,
            theta_fe, se_fe, theta_re, se_re,
            w_fe, w_re, Q, Q_pval, I2, tau2_dl, d_true)


@app.cell
def _(np, go, make_subplots, VIZ_COLORS, DEFAULT_LAYOUT, stats,
      k, observed, se, study_names, model_type,
      theta_fe, se_fe, theta_re, se_re, w_fe, w_re):
    mt = model_type.value
    theta_pool = theta_re if mt == "random" else theta_fe
    se_pool = se_re if mt == "random" else se_fe
    weights = w_re if mt == "random" else w_fe
    rel_weights = weights / weights.sum() * 100

    fig = make_subplots(rows=1, cols=2, column_widths=[0.7, 0.3],
                        subplot_titles=["Forest Plot", "Funnel Plot (Publication Bias)"],
                        horizontal_spacing=0.12)

    # Forest plot
    z95 = stats.norm.ppf(0.975)
    y_positions = np.arange(k + 1, 0, -1)

    for i in range(k):
        ci_lo = observed[i] - z95 * se[i]
        ci_hi = observed[i] + z95 * se[i]
        yp = y_positions[i]
        # CI line
        fig.add_trace(go.Scatter(
            x=[ci_lo, ci_hi], y=[yp, yp], mode="lines",
            line=dict(color=VIZ_COLORS[0], width=1.5), showlegend=False
        ), row=1, col=1)
        # Point (size ~ weight)
        fig.add_trace(go.Scatter(
            x=[observed[i]], y=[yp], mode="markers",
            marker=dict(color=VIZ_COLORS[0], size=4 + rel_weights[i] * 0.4, symbol="square"),
            showlegend=False,
            hovertext=f"{study_names[i]}: {observed[i]:.3f} [{ci_lo:.3f}, {ci_hi:.3f}]<br>Weight: {rel_weights[i]:.1f}%"
        ), row=1, col=1)

    # Pooled diamond
    pool_lo = theta_pool - z95 * se_pool
    pool_hi = theta_pool + z95 * se_pool
    yp_pool = 0.3
    fig.add_trace(go.Scatter(
        x=[pool_lo, theta_pool, pool_hi, theta_pool, pool_lo],
        y=[yp_pool, yp_pool + 0.25, yp_pool, yp_pool - 0.25, yp_pool],
        fill="toself", fillcolor=VIZ_COLORS[4],
        line=dict(color=VIZ_COLORS[4], width=1),
        name=f"Pooled ({mt})"
    ), row=1, col=1)

    fig.add_vline(x=0, line=dict(color=VIZ_COLORS[7], width=1, dash="dash"), row=1, col=1)
    fig.add_vline(x=theta_pool, line=dict(color=VIZ_COLORS[4], width=1, dash="dot"), row=1, col=1)

    # Y-axis labels
    tick_vals = list(y_positions[:k]) + [yp_pool]
    tick_text = study_names + [f"Pooled ({mt})"]
    fig.update_yaxes(tickvals=tick_vals, ticktext=tick_text, row=1, col=1)
    fig.update_xaxes(title_text="Effect Size (d)", row=1, col=1)

    # Funnel plot
    fig.add_trace(go.Scatter(
        x=observed, y=se, mode="markers", name="Studies",
        marker=dict(color=VIZ_COLORS[0], size=8)
    ), row=1, col=2)
    # Funnel lines
    se_range = np.linspace(0.001, se.max() * 1.2, 100)
    fig.add_trace(go.Scatter(
        x=theta_pool + z95 * se_range, y=se_range, mode="lines",
        line=dict(color=VIZ_COLORS[7], width=1, dash="dash"), showlegend=False
    ), row=1, col=2)
    fig.add_trace(go.Scatter(
        x=theta_pool - z95 * se_range, y=se_range, mode="lines",
        line=dict(color=VIZ_COLORS[7], width=1, dash="dash"), showlegend=False
    ), row=1, col=2)
    fig.add_vline(x=theta_pool, line=dict(color=VIZ_COLORS[2], width=1.5), row=1, col=2)
    fig.update_yaxes(autorange="reversed", title_text="Standard Error", row=1, col=2)
    fig.update_xaxes(title_text="Effect Size", row=1, col=2)

    fig.update_layout(**DEFAULT_LAYOUT, height=550,
                      title="Meta-Analysis — Treatment Effect Across Studies")
    fig
    return theta_pool, se_pool


@app.cell
def _(mo, stats, theta_pool, se_pool, Q, Q_pval, I2, tau2_dl, k, model_type):
    z95 = stats.norm.ppf(0.975)
    ci_lo = theta_pool - z95 * se_pool
    ci_hi = theta_pool + z95 * se_pool
    mo.md(f"""
    ### Results ({model_type.value.replace('_', '-')} model)

    | Metric | Value |
    |--------|-------|
    | Pooled effect | {theta_pool:.4f} [{ci_lo:.4f}, {ci_hi:.4f}] |
    | Q statistic | {Q:.2f} (df = {k - 1}, p = {Q_pval:.4f}) |
    | I² | {I2:.1f}% |
    | τ² (DL estimate) | {tau2_dl:.4f} |

    **I² interpretation**: {"Low" if I2 < 25 else "Moderate" if I2 < 75 else "High"} heterogeneity.
    {"The Q test is significant (p < 0.05), suggesting true between-study variation." if Q_pval < 0.05 else "The Q test is not significant — observed variation is consistent with sampling error alone."}
    """)
    return


if __name__ == "__main__":
    app.run()
