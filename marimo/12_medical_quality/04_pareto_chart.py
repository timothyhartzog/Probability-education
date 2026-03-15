import marimo

app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import numpy as np
    import plotly.graph_objects as go
    import sys
    sys.path.insert(0, "..")
    from shared.plotting import VIZ_COLORS, DEFAULT_LAYOUT, styled_figure
    return mo, np, go, VIZ_COLORS, DEFAULT_LAYOUT, styled_figure


@app.cell
def _(mo):
    mo.md(r"""
    # 12.4 Pareto Chart — Quality Defect Analysis

    The **Pareto principle** (80/20 rule) states that roughly 80% of effects come
    from 20% of causes. In healthcare quality improvement, a Pareto chart helps
    prioritize which defect categories to address first.

    The chart combines:
    - **Bar chart**: defect categories sorted by frequency (descending)
    - **Cumulative line**: running total percentage, highlighting the vital few

    This tool helps quality teams focus resources on the categories that will
    yield the greatest improvement.
    """)
    return


@app.cell
def _(mo):
    n_categories = mo.ui.slider(start=5, stop=15, step=1, value=8, label="Number of defect categories")
    seed = mo.ui.slider(start=1, stop=100, step=1, value=42, label="Random seed")
    controls = mo.hstack([n_categories, seed], justify="start", gap=1)
    mo.md(f"### Controls\n{controls}")
    return n_categories, seed


@app.cell
def _(np, n_categories, seed):
    rng = np.random.default_rng(seed.value)
    nc = n_categories.value

    category_pool = [
        "Medication Error", "Patient Fall", "Surgical Site Infection",
        "Documentation Gap", "Lab Processing Delay", "Wrong-Site Surgery",
        "Device Malfunction", "Communication Failure", "Discharge Delay",
        "Transfusion Reaction", "Pressure Ulcer", "Missed Diagnosis",
        "Specimen Mislabel", "Consent Issue", "Staffing Shortage"
    ]
    categories = category_pool[:nc]

    # Generate Pareto-like counts using power-law distribution
    raw = rng.pareto(1.5, size=nc) * 50 + 5
    counts = np.round(raw).astype(int)
    # Sort descending
    sort_idx = np.argsort(counts)[::-1]
    counts = counts[sort_idx]
    categories = [categories[i] for i in sort_idx]

    total = counts.sum()
    cumulative_pct = np.cumsum(counts) / total * 100
    return categories, counts, total, cumulative_pct, nc


@app.cell
def _(np, go, VIZ_COLORS, DEFAULT_LAYOUT, categories, counts, total, cumulative_pct, nc):
    # Find 80% threshold
    threshold_idx = np.searchsorted(cumulative_pct, 80)

    bar_colors = [VIZ_COLORS[0] if i <= threshold_idx else VIZ_COLORS[7]
                  for i in range(nc)]

    fig = go.Figure()

    fig.add_trace(go.Bar(
        x=categories, y=counts, name="Count",
        marker_color=bar_colors,
        text=counts, textposition="outside",
        textfont=dict(size=11)
    ))

    fig.add_trace(go.Scatter(
        x=categories, y=cumulative_pct, name="Cumulative %",
        mode="lines+markers", yaxis="y2",
        line=dict(color=VIZ_COLORS[1], width=2.5),
        marker=dict(color=VIZ_COLORS[1], size=7)
    ))

    # 80% reference line
    fig.add_hline(y=80, line=dict(color=VIZ_COLORS[4], width=1.5, dash="dash"),
                  annotation_text="80% threshold", yref="y2")

    fig.update_layout(
        **DEFAULT_LAYOUT,
        title=f"Pareto Chart — Hospital Quality Defects (n = {total})",
        xaxis_title="Defect Category",
        yaxis_title="Frequency",
        yaxis2=dict(title="Cumulative %", overlaying="y", side="right",
                    range=[0, 105], showgrid=False),
        height=520,
        legend=dict(x=0.75, y=0.3),
        xaxis_tickangle=-30
    )
    fig
    return threshold_idx


@app.cell
def _(mo, categories, counts, total, cumulative_pct, threshold_idx):
    vital_few = categories[:threshold_idx + 1]
    vital_count = counts[:threshold_idx + 1].sum()
    mo.md(f"""
    ### Pareto Analysis

    **Vital few** categories (accounting for ≥80% of defects):

    | Rank | Category | Count | Cumulative % |
    |------|----------|-------|-------------|
    """ + "\n".join([
        f"| {i+1} | {categories[i]} | {counts[i]} | {cumulative_pct[i]:.1f}% |"
        for i in range(threshold_idx + 1)
    ]) + f"""

    These **{threshold_idx + 1}** categories represent **{vital_count}** of {total}
    defects ({100*vital_count/total:.1f}%). Focusing improvement efforts here will
    address the majority of quality issues.
    """)
    return


if __name__ == "__main__":
    app.run()
