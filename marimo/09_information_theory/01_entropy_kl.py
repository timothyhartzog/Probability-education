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
    # 9.1 Entropy & KL Divergence

    **Shannon entropy** quantifies the uncertainty (information content) of a random variable:

    $$H(X) = -\sum_{x} p(x) \log p(x)$$

    **Kullback-Leibler divergence** measures how one distribution differs from another:

    $$D_{\mathrm{KL}}(P \| Q) = \sum_{x} p(x) \log \frac{p(x)}{q(x)}$$

    Key properties:
    - $H(X) \geq 0$, with equality iff $X$ is deterministic
    - $D_{\mathrm{KL}}(P\|Q) \geq 0$ (Gibbs' inequality), with equality iff $P = Q$
    - $D_{\mathrm{KL}}$ is **not symmetric**: $D_{\mathrm{KL}}(P\|Q) \neq D_{\mathrm{KL}}(Q\|P)$ in general
    """)
    return


@app.cell
def _(mo):
    dist_type = mo.ui.dropdown(
        options={"Discrete (categorical)": "discrete", "Continuous (Normal)": "continuous"},
        value="discrete",
        label="Distribution type",
    )
    mo.md(f"## Controls\n\n{dist_type}")
    return (dist_type,)


@app.cell
def _(mo, dist_type):
    dtype = dist_type.value
    if dtype == "discrete":
        p1_slider = mo.ui.slider(start=0.01, stop=0.98, step=0.01, value=0.5, label="P: p(x=1)")
        p2_slider = mo.ui.slider(start=0.01, stop=0.98, step=0.01, value=0.3, label="P: p(x=2)")
        q1_slider = mo.ui.slider(start=0.01, stop=0.98, step=0.01, value=0.33, label="Q: q(x=1)")
        q2_slider = mo.ui.slider(start=0.01, stop=0.98, step=0.01, value=0.33, label="Q: q(x=2)")
        controls = mo.hstack([p1_slider, p2_slider, q1_slider, q2_slider], wrap=True)
        info_text = "Remaining probability goes to x=3. Distributions are automatically normalized."
    else:
        p1_slider = mo.ui.slider(start=-5, stop=5, step=0.1, value=0.0, label="P: μ_P")
        p2_slider = mo.ui.slider(start=0.1, stop=5.0, step=0.1, value=1.0, label="P: σ_P")
        q1_slider = mo.ui.slider(start=-5, stop=5, step=0.1, value=1.0, label="Q: μ_Q")
        q2_slider = mo.ui.slider(start=0.1, stop=5.0, step=0.1, value=2.0, label="Q: σ_Q")
        controls = mo.hstack([p1_slider, p2_slider, q1_slider, q2_slider], wrap=True)
        info_text = ""
    mo.md(f"{controls}\n\n{info_text}")
    return p1_slider, p2_slider, q1_slider, q2_slider, dtype


@app.cell
def _(np, dtype, p1_slider, p2_slider, q1_slider, q2_slider):
    def entropy_discrete(p):
        p = p[p > 0]
        return -np.sum(p * np.log2(p))

    def kl_discrete(p, q):
        mask = p > 0
        return np.sum(p[mask] * np.log2(p[mask] / q[mask]))

    def entropy_normal(sigma):
        return 0.5 * np.log2(2 * np.pi * np.e * sigma ** 2)

    def kl_normal(mu_p, sig_p, mu_q, sig_q):
        return (np.log(sig_q / sig_p)
                + (sig_p ** 2 + (mu_p - mu_q) ** 2) / (2 * sig_q ** 2)
                - 0.5)

    if dtype == "discrete":
        raw_p = np.array([p1_slider.value, p2_slider.value,
                          max(0.01, 1 - p1_slider.value - p2_slider.value)])
        raw_q = np.array([q1_slider.value, q2_slider.value,
                          max(0.01, 1 - q1_slider.value - q2_slider.value)])
        P = raw_p / raw_p.sum()
        Q = raw_q / raw_q.sum()
        H_P = entropy_discrete(P)
        H_Q = entropy_discrete(Q)
        KL_PQ = kl_discrete(P, Q)
        KL_QP = kl_discrete(Q, P)
        labels = ["x=1", "x=2", "x=3"]
    else:
        mu_p, sig_p = p1_slider.value, p2_slider.value
        mu_q, sig_q = q1_slider.value, q2_slider.value
        H_P = entropy_normal(sig_p)
        H_Q = entropy_normal(sig_q)
        KL_PQ = kl_normal(mu_p, sig_p, mu_q, sig_q)
        KL_QP = kl_normal(mu_q, sig_q, mu_p, sig_p)
        P = Q = labels = None
    return (P, Q, H_P, H_Q, KL_PQ, KL_QP, labels,
            entropy_discrete, kl_discrete, entropy_normal, kl_normal)


@app.cell
def _(go, np, VIZ_COLORS, DEFAULT_LAYOUT, dtype, P, Q, labels,
      p1_slider, p2_slider, q1_slider, q2_slider, styled_subplots, stats):
    if dtype == "discrete":
        fig = styled_subplots(
            rows=1, cols=2,
            titles=["Distribution P", "Distribution Q"],
            height=400,
        )
        fig.add_trace(go.Bar(
            x=labels, y=P, marker_color=VIZ_COLORS[0], name='P', showlegend=True,
        ), row=1, col=1)
        fig.add_trace(go.Bar(
            x=labels, y=Q, marker_color=VIZ_COLORS[1], name='Q', showlegend=True,
        ), row=1, col=2)
        fig.update_yaxes(title_text="Probability", range=[0, 1], row=1, col=1)
        fig.update_yaxes(title_text="Probability", range=[0, 1], row=1, col=2)
    else:
        mu_p, sig_p = p1_slider.value, p2_slider.value
        mu_q, sig_q = q1_slider.value, q2_slider.value
        lo = min(mu_p - 4 * sig_p, mu_q - 4 * sig_q)
        hi = max(mu_p + 4 * sig_p, mu_q + 4 * sig_q)
        x = np.linspace(lo, hi, 500)
        pdf_p = stats.norm.pdf(x, mu_p, sig_p)
        pdf_q = stats.norm.pdf(x, mu_q, sig_q)
        fig = styled_subplots(rows=1, cols=1, titles=["P vs Q"], height=400)
        fig.add_trace(go.Scatter(
            x=x, y=pdf_p, mode='lines', name=f'P: N({mu_p},{sig_p}²)',
            line=dict(color=VIZ_COLORS[0], width=2.5),
            fill='tozeroy', fillcolor='rgba(37,99,235,0.15)',
        ))
        fig.add_trace(go.Scatter(
            x=x, y=pdf_q, mode='lines', name=f'Q: N({mu_q},{sig_q}²)',
            line=dict(color=VIZ_COLORS[1], width=2.5),
            fill='tozeroy', fillcolor='rgba(233,115,25,0.15)',
        ))
        fig.update_xaxes(title_text="x")
        fig.update_yaxes(title_text="Density")
    fig
    return


@app.cell
def _(mo, H_P, H_Q, KL_PQ, KL_QP, dtype):
    unit = "bits" if dtype == "discrete" else "nats"
    if dtype == "continuous":
        unit = "nats"
    mo.md(rf"""
    ## Information Measures

    | Quantity | Value ({unit}) |
    |----------|-------|
    | $H(P)$ — Entropy of P | {H_P:.4f} |
    | $H(Q)$ — Entropy of Q | {H_Q:.4f} |
    | $D_{{\mathrm{{KL}}}}(P \| Q)$ | {KL_PQ:.4f} |
    | $D_{{\mathrm{{KL}}}}(Q \| P)$ | {KL_QP:.4f} |
    | **Asymmetry** $|D_{{KL}}(P\|Q) - D_{{KL}}(Q\|P)|$ | {abs(KL_PQ - KL_QP):.4f} |

    > Notice that $D_{{\mathrm{{KL}}}}(P\|Q) \neq D_{{\mathrm{{KL}}}}(Q\|P)$ — KL divergence is **not a true metric**.
    > This asymmetry has practical implications: $D_{{\mathrm{{KL}}}}(P\|Q)$ penalizes places where $P > 0$ but $Q \approx 0$
    > ("zero-avoiding"), while $D_{{\mathrm{{KL}}}}(Q\|P)$ does the reverse ("zero-forcing").
    """)
    return


@app.cell
def _(go, np, VIZ_COLORS, DEFAULT_LAYOUT, dtype, P, Q, labels,
      p1_slider, p2_slider, q1_slider, q2_slider, stats, styled_figure):
    # Pointwise KL contribution visualization
    if dtype == "discrete":
        kl_pointwise = P * np.log2(P / Q)
        kl_pointwise_rev = Q * np.log2(Q / P)
        fig_kl = styled_figure(title="Pointwise KL Contributions", height=380)
        x_pos = np.arange(len(labels))
        fig_kl.add_trace(go.Bar(
            x=[f"{l} (P||Q)" for l in labels], y=kl_pointwise,
            marker_color=VIZ_COLORS[0], name='D_KL(P||Q) contributions',
        ))
        fig_kl.add_trace(go.Bar(
            x=[f"{l} (Q||P)" for l in labels], y=kl_pointwise_rev,
            marker_color=VIZ_COLORS[1], name='D_KL(Q||P) contributions',
        ))
        fig_kl.update_yaxes(title_text="p(x) log(p(x)/q(x))")
    else:
        mu_p, sig_p = p1_slider.value, p2_slider.value
        mu_q, sig_q = q1_slider.value, q2_slider.value
        lo = min(mu_p - 4 * sig_p, mu_q - 4 * sig_q)
        hi = max(mu_p + 4 * sig_p, mu_q + 4 * sig_q)
        x = np.linspace(lo, hi, 500)
        pdf_p = stats.norm.pdf(x, mu_p, sig_p)
        pdf_q = stats.norm.pdf(x, mu_q, sig_q)
        kl_density = pdf_p * np.log(pdf_p / (pdf_q + 1e-300) + 1e-300)
        kl_density_rev = pdf_q * np.log(pdf_q / (pdf_p + 1e-300) + 1e-300)
        fig_kl = styled_figure(title="Pointwise KL Density", height=380)
        fig_kl.add_trace(go.Scatter(
            x=x, y=kl_density, mode='lines', name='D_KL(P||Q) density',
            line=dict(color=VIZ_COLORS[0], width=2),
            fill='tozeroy', fillcolor='rgba(37,99,235,0.15)',
        ))
        fig_kl.add_trace(go.Scatter(
            x=x, y=kl_density_rev, mode='lines', name='D_KL(Q||P) density',
            line=dict(color=VIZ_COLORS[1], width=2),
            fill='tozeroy', fillcolor='rgba(233,115,25,0.15)',
        ))
        fig_kl.update_xaxes(title_text="x")
        fig_kl.update_yaxes(title_text="p(x) log(p(x)/q(x))")
    fig_kl
    return


@app.cell
def _(mo):
    mo.md(r"""
    ### Important Relationships

    - **Cross-entropy**: $H(P, Q) = -\sum p(x) \log q(x) = H(P) + D_{\mathrm{KL}}(P\|Q)$
    - **Jensen-Shannon divergence** (symmetric): $\mathrm{JSD}(P\|Q) = \tfrac{1}{2}D_{\mathrm{KL}}(P\|M) + \tfrac{1}{2}D_{\mathrm{KL}}(Q\|M)$ where $M = \tfrac{1}{2}(P+Q)$
    - **Maximum entropy**: uniform distribution maximizes $H$ over all distributions on a finite set
    - For continuous distributions, differential entropy $h(X) = -\int f(x)\log f(x)\,dx$ can be negative

    ---
    *Module 9.1 — Entropy & KL Divergence*
    *Probability Education Platform*
    """)
    return


if __name__ == "__main__":
    app.run()
