import marimo

app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import numpy as np
    import plotly.graph_objects as go
    from scipy import stats
    import sys
    sys.path.insert(0, "..")
    from shared.plotting import VIZ_COLORS, DEFAULT_LAYOUT, styled_figure
    return mo, np, go, stats, VIZ_COLORS, DEFAULT_LAYOUT, styled_figure


@app.cell
def _(mo):
    mo.md(r"""
    # 12.2 Funnel Plot — Hospital Performance Comparison

    A **funnel plot** compares institutional performance while accounting for
    different sample sizes. Hospitals with larger patient volumes have tighter
    control limits, creating a funnel shape.

    For a proportion (e.g., mortality rate), the **exact binomial** or
    **normal-approximation** limits at confidence level $\alpha$ are:

    $$\hat{p} \pm z_{\alpha/2}\,\sqrt{\frac{\bar{p}(1-\bar{p})}{n_i}}$$

    Hospitals falling outside the funnel are **statistical outliers** — their
    performance differs significantly from the overall average, beyond what
    sampling variation would explain.
    """)
    return


@app.cell
def _(mo):
    n_hospitals = mo.ui.slider(start=20, stop=100, step=5, value=50, label="Number of hospitals")
    overall_rate = mo.ui.slider(start=0.01, stop=0.15, step=0.005, value=0.05,
                                label="Overall event rate (p̄)")
    show_labels = mo.ui.checkbox(value=False, label="Show hospital labels")
    controls = mo.hstack([n_hospitals, overall_rate, show_labels], justify="start", gap=1)
    mo.md(f"### Controls\n{controls}")
    return n_hospitals, overall_rate, show_labels


@app.cell
def _(np, n_hospitals, overall_rate):
    rng = np.random.default_rng(123)
    n_h = n_hospitals.value
    p_bar = overall_rate.value

    # Generate hospital volumes (varying sizes)
    volumes = rng.integers(50, 2000, size=n_h)
    volumes.sort()

    # Most hospitals near average, a few outliers
    true_rates = np.clip(rng.normal(p_bar, p_bar * 0.3, size=n_h), 0.001, 0.99)
    # Make 2-3 hospitals genuine outliers
    n_outliers = max(2, n_h // 15)
    outlier_idx = rng.choice(n_h, size=n_outliers, replace=False)
    true_rates[outlier_idx[:n_outliers // 2]] = p_bar * 2.5
    true_rates[outlier_idx[n_outliers // 2:]] = p_bar * 0.3

    events = rng.binomial(volumes, true_rates)
    observed_rates = events / volumes
    return rng, n_h, p_bar, volumes, observed_rates, events


@app.cell
def _(np, go, stats, VIZ_COLORS, DEFAULT_LAYOUT, p_bar, volumes, observed_rates, n_h, show_labels):
    # Compute funnel limits
    vol_range = np.linspace(max(volumes.min(), 10), volumes.max(), 300)
    se = np.sqrt(p_bar * (1 - p_bar) / vol_range)

    z95 = stats.norm.ppf(0.975)
    z998 = stats.norm.ppf(0.999)
    ucl_95 = p_bar + z95 * se
    lcl_95 = p_bar - z95 * se
    ucl_998 = p_bar + z998 * se
    lcl_998 = p_bar - z998 * se

    # Classify hospitals
    se_hosp = np.sqrt(p_bar * (1 - p_bar) / volumes)
    z_hosp = (observed_rates - p_bar) / se_hosp
    within_95 = np.abs(z_hosp) <= z95
    between_95_998 = (~within_95) & (np.abs(z_hosp) <= z998)
    beyond_998 = np.abs(z_hosp) > z998

    fig = go.Figure()

    # Funnel bands
    fig.add_trace(go.Scatter(
        x=np.concatenate([vol_range, vol_range[::-1]]),
        y=np.concatenate([ucl_998, lcl_998[::-1]]),
        fill="toself", fillcolor="rgba(37,99,235,0.08)",
        line=dict(width=0), name="99.8% limits", showlegend=True
    ))
    fig.add_trace(go.Scatter(
        x=np.concatenate([vol_range, vol_range[::-1]]),
        y=np.concatenate([ucl_95, lcl_95[::-1]]),
        fill="toself", fillcolor="rgba(37,99,235,0.15)",
        line=dict(width=0), name="95% limits", showlegend=True
    ))

    # Limit lines
    for y_arr, dash, label in [(ucl_95, "dash", "95% UCL"), (lcl_95, "dash", "95% LCL"),
                                (ucl_998, "dot", "99.8% UCL"), (lcl_998, "dot", "99.8% LCL")]:
        fig.add_trace(go.Scatter(x=vol_range, y=y_arr, mode="lines",
                                 line=dict(color=VIZ_COLORS[0], width=1.5, dash=dash),
                                 showlegend=False))

    fig.add_hline(y=p_bar, line=dict(color=VIZ_COLORS[2], width=2),
                  annotation_text=f"Overall rate = {p_bar:.3f}")

    # Hospital points
    labels = [f"H{i+1}" for i in range(n_h)]
    text_mode = "markers+text" if show_labels.value else "markers"

    fig.add_trace(go.Scatter(
        x=volumes[within_95], y=observed_rates[within_95],
        mode=text_mode, name="Within 95%",
        text=[labels[i] for i in np.where(within_95)[0]] if show_labels.value else None,
        textposition="top center", textfont=dict(size=8),
        marker=dict(color=VIZ_COLORS[7], size=7, opacity=0.7)
    ))
    fig.add_trace(go.Scatter(
        x=volumes[between_95_998], y=observed_rates[between_95_998],
        mode=text_mode, name="Alert (95–99.8%)",
        text=[labels[i] for i in np.where(between_95_998)[0]] if show_labels.value else None,
        textposition="top center", textfont=dict(size=8),
        marker=dict(color=VIZ_COLORS[1], size=9, symbol="diamond")
    ))
    fig.add_trace(go.Scatter(
        x=volumes[beyond_998], y=observed_rates[beyond_998],
        mode=text_mode, name="Outlier (>99.8%)",
        text=[labels[i] for i in np.where(beyond_998)[0]] if show_labels.value else None,
        textposition="top center", textfont=dict(size=9),
        marker=dict(color=VIZ_COLORS[4], size=11, symbol="x")
    ))

    fig.update_layout(**DEFAULT_LAYOUT, title="Funnel Plot — Hospital Complication Rates",
                      xaxis_title="Patient Volume", yaxis_title="Observed Rate",
                      height=520)
    fig
    return within_95, between_95_998, beyond_998


@app.cell
def _(mo, n_h, within_95, between_95_998, beyond_998):
    mo.md(f"""
    ### Interpretation

    | Category | Count | Percentage |
    |----------|-------|------------|
    | Within 95% limits | {within_95.sum()} | {100*within_95.sum()/n_h:.1f}% |
    | Alert zone (95–99.8%) | {between_95_998.sum()} | {100*between_95_998.sum()/n_h:.1f}% |
    | Outlier (>99.8%) | {beyond_998.sum()} | {100*beyond_998.sum()/n_h:.1f}% |

    Hospitals in the **outlier** category warrant further investigation. Those below the
    funnel are performing better than expected; those above may have quality concerns.
    """)
    return


if __name__ == "__main__":
    app.run()
