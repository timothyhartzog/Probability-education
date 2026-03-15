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
    # 8.1 Prior-to-Posterior Machine

    **Bayesian updating** combines prior beliefs with observed data via **Bayes' theorem**:

    $$\underbrace{p(\theta \mid \text{data})}_{\text{posterior}} \;\propto\; \underbrace{p(\text{data} \mid \theta)}_{\text{likelihood}} \;\times\; \underbrace{p(\theta)}_{\text{prior}}$$

    When the prior and likelihood form a **conjugate pair**, the posterior has the same
    distributional family as the prior, with updated parameters.

    | Prior | Likelihood | Posterior |
    |-------|-----------|-----------|
    | Beta($\alpha, \beta$) | Binomial($n, \theta$) | Beta($\alpha + k, \beta + n - k$) |
    | Normal($\mu_0, \sigma_0^2$) | Normal($\theta, \sigma^2$) | Normal($\mu_n, \sigma_n^2$) |
    | Gamma($\alpha, \beta$) | Poisson($\theta$) | Gamma($\alpha + \sum x_i, \beta + n$) |
    """)
    return


@app.cell
def _(mo):
    family_dropdown = mo.ui.dropdown(
        options={
            "Beta-Binomial": "beta_binomial",
            "Normal-Normal": "normal_normal",
            "Gamma-Poisson": "gamma_poisson",
        },
        value="beta_binomial",
        label="Conjugate family",
    )
    mo.md(f"## Controls\n\n{family_dropdown}")
    return (family_dropdown,)


@app.cell
def _(mo, family_dropdown):
    family = family_dropdown.value
    if family == "beta_binomial":
        param1 = mo.ui.slider(start=0.1, stop=20, step=0.1, value=2.0, label="Prior α")
        param2 = mo.ui.slider(start=0.1, stop=20, step=0.1, value=5.0, label="Prior β")
        data1 = mo.ui.slider(start=0, stop=100, step=1, value=7, label="Successes (k)")
        data2 = mo.ui.slider(start=1, stop=100, step=1, value=10, label="Trials (n)")
    elif family == "normal_normal":
        param1 = mo.ui.slider(start=-10, stop=10, step=0.5, value=0.0, label="Prior μ₀")
        param2 = mo.ui.slider(start=0.1, stop=10, step=0.1, value=3.0, label="Prior σ₀")
        data1 = mo.ui.slider(start=-10, stop=10, step=0.1, value=2.5, label="Observed mean x̄")
        data2 = mo.ui.slider(start=1, stop=50, step=1, value=10, label="n observations (known σ=1)")
    else:
        param1 = mo.ui.slider(start=0.1, stop=20, step=0.1, value=2.0, label="Prior α")
        param2 = mo.ui.slider(start=0.1, stop=10, step=0.1, value=1.0, label="Prior β")
        data1 = mo.ui.slider(start=0, stop=100, step=1, value=15, label="Sum of observations Σxᵢ")
        data2 = mo.ui.slider(start=1, stop=50, step=1, value=5, label="n observations")
    controls = mo.hstack([param1, param2, data1, data2], wrap=True)
    mo.md(f"{controls}")
    return param1, param2, data1, data2, family


@app.cell
def _(np, stats, family, param1, param2, data1, data2):
    p1 = param1.value
    p2 = param2.value
    d1 = data1.value
    d2 = data2.value

    if family == "beta_binomial":
        alpha_prior, beta_prior = p1, p2
        k, n = d1, d2
        k = min(k, n)
        alpha_post = alpha_prior + k
        beta_post = beta_prior + n - k
        x = np.linspace(0.001, 0.999, 500)
        prior_pdf = stats.beta.pdf(x, alpha_prior, beta_prior)
        post_pdf = stats.beta.pdf(x, alpha_post, beta_post)
        # Likelihood (as function of theta, proportional)
        like = stats.binom.pmf(k, n, x)
        like_scaled = like / (like.max() + 1e-30) * max(prior_pdf.max(), post_pdf.max()) * 0.6
        x_label = "θ (success probability)"
        desc = {
            "prior": f"Beta({alpha_prior:.1f}, {beta_prior:.1f})",
            "post": f"Beta({alpha_post:.1f}, {beta_post:.1f})",
            "data": f"{k} successes in {n} trials",
        }
    elif family == "normal_normal":
        mu0, sigma0 = p1, p2
        xbar, n = d1, d2
        sigma_known = 1.0
        sigma_post2 = 1.0 / (1.0 / sigma0 ** 2 + n / sigma_known ** 2)
        mu_post = sigma_post2 * (mu0 / sigma0 ** 2 + n * xbar / sigma_known ** 2)
        sigma_post = np.sqrt(sigma_post2)
        lo = min(mu0 - 4 * sigma0, mu_post - 4 * sigma_post)
        hi = max(mu0 + 4 * sigma0, mu_post + 4 * sigma_post)
        x = np.linspace(lo, hi, 500)
        prior_pdf = stats.norm.pdf(x, mu0, sigma0)
        post_pdf = stats.norm.pdf(x, mu_post, sigma_post)
        like = stats.norm.pdf(x, xbar, sigma_known / np.sqrt(n))
        like_scaled = like / (like.max() + 1e-30) * max(prior_pdf.max(), post_pdf.max()) * 0.6
        x_label = "θ (mean)"
        desc = {
            "prior": f"N({mu0:.1f}, {sigma0:.1f}²)",
            "post": f"N({mu_post:.2f}, {sigma_post:.3f}²)",
            "data": f"x̄ = {xbar:.1f}, n = {n}",
        }
    else:  # gamma_poisson
        alpha_prior, beta_prior = p1, p2
        sum_x, n = d1, d2
        alpha_post = alpha_prior + sum_x
        beta_post = beta_prior + n
        hi = max(alpha_prior / beta_prior + 5 * np.sqrt(alpha_prior) / beta_prior,
                 alpha_post / beta_post + 5 * np.sqrt(alpha_post) / beta_post)
        x = np.linspace(0.001, hi, 500)
        prior_pdf = stats.gamma.pdf(x, alpha_prior, scale=1.0 / beta_prior)
        post_pdf = stats.gamma.pdf(x, alpha_post, scale=1.0 / beta_post)
        # Poisson likelihood as function of lambda (proportional)
        like = np.exp(sum_x * np.log(x + 1e-30) - n * x)
        like = like / (like.max() + 1e-30) * max(prior_pdf.max(), post_pdf.max()) * 0.6
        like_scaled = like
        x_label = "λ (rate)"
        desc = {
            "prior": f"Gamma({alpha_prior:.1f}, {beta_prior:.1f})",
            "post": f"Gamma({alpha_post:.1f}, {beta_post:.1f})",
            "data": f"Σxᵢ = {sum_x}, n = {n}",
        }
    return x, prior_pdf, post_pdf, like_scaled, x_label, desc


@app.cell
def _(go, VIZ_COLORS, DEFAULT_LAYOUT, x, prior_pdf, post_pdf, like_scaled, x_label, desc, styled_figure):
    fig = styled_figure(title="Prior × Likelihood ∝ Posterior", height=480)
    fig.add_trace(go.Scatter(
        x=x, y=prior_pdf, mode='lines', name=f'Prior: {desc["prior"]}',
        line=dict(color=VIZ_COLORS[0], width=2.5),
    ))
    fig.add_trace(go.Scatter(
        x=x, y=like_scaled, mode='lines', name=f'Likelihood (scaled): {desc["data"]}',
        line=dict(color=VIZ_COLORS[1], width=2, dash='dash'),
        fill='tozeroy', fillcolor='rgba(233,115,25,0.1)',
    ))
    fig.add_trace(go.Scatter(
        x=x, y=post_pdf, mode='lines', name=f'Posterior: {desc["post"]}',
        line=dict(color=VIZ_COLORS[2], width=2.5),
        fill='tozeroy', fillcolor='rgba(5,150,105,0.1)',
    ))
    fig.update_xaxes(title_text=x_label)
    fig.update_yaxes(title_text="Density")
    fig
    return


@app.cell
def _(mo, family, param1, param2):
    # Sequential update section
    mo.md(r"""
    ## Sequential Bayesian Updates

    One of the most elegant features of Bayesian inference is **sequential updating**:
    the posterior from one observation becomes the prior for the next.
    Use the button below to see data arriving one observation at a time.
    """)
    return


@app.cell
def _(mo, family):
    n_sequential = mo.ui.slider(start=1, stop=30, step=1, value=10, label="Number of sequential observations")
    seq_seed = mo.ui.slider(start=0, stop=100, step=1, value=7, label="Seed")
    seq_controls = mo.hstack([n_sequential, seq_seed])
    mo.md(f"{seq_controls}")
    return n_sequential, seq_seed


@app.cell
def _(np, stats, go, VIZ_COLORS, DEFAULT_LAYOUT, family, param1, param2,
      n_sequential, seq_seed, styled_figure):
    rng = np.random.default_rng(seq_seed.value)
    n_seq = n_sequential.value
    p1_v = param1.value
    p2_v = param2.value

    if family == "beta_binomial":
        true_theta = 0.6
        observations = rng.binomial(1, true_theta, n_seq)
        alphas = [p1_v]
        betas = [p2_v]
        for obs in observations:
            alphas.append(alphas[-1] + obs)
            betas.append(betas[-1] + 1 - obs)
        x_seq = np.linspace(0.001, 0.999, 300)
        fig_seq = styled_figure(title=f"Sequential Beta-Binomial Updates (true θ = {true_theta})", height=480)
        n_show = len(alphas)
        for i in [0, n_show // 4, n_show // 2, 3 * n_show // 4, n_show - 1]:
            pdf = stats.beta.pdf(x_seq, alphas[i], betas[i])
            fig_seq.add_trace(go.Scatter(
                x=x_seq, y=pdf, mode='lines',
                name=f'After {i} obs: Beta({alphas[i]:.1f},{betas[i]:.1f})',
                line=dict(color=VIZ_COLORS[i % len(VIZ_COLORS)], width=2),
            ))
        fig_seq.add_vline(x=true_theta, line=dict(color='red', dash='dash', width=1.5),
                          annotation_text="True θ")
        fig_seq.update_xaxes(title_text="θ")
        fig_seq.update_yaxes(title_text="Density")
    elif family == "normal_normal":
        true_theta = 3.0
        sigma_known = 1.0
        observations = rng.normal(true_theta, sigma_known, n_seq)
        mus = [p1_v]
        sigmas = [p2_v]
        for obs in observations:
            s2_new = 1.0 / (1.0 / sigmas[-1] ** 2 + 1.0 / sigma_known ** 2)
            mu_new = s2_new * (mus[-1] / sigmas[-1] ** 2 + obs / sigma_known ** 2)
            mus.append(mu_new)
            sigmas.append(np.sqrt(s2_new))
        lo = min(min(mus) - 4 * max(sigmas), true_theta - 3)
        hi = max(max(mus) + 4 * max(sigmas), true_theta + 3)
        x_seq = np.linspace(lo, hi, 300)
        fig_seq = styled_figure(title=f"Sequential Normal-Normal Updates (true θ = {true_theta})", height=480)
        n_show = len(mus)
        for i in [0, n_show // 4, n_show // 2, 3 * n_show // 4, n_show - 1]:
            pdf = stats.norm.pdf(x_seq, mus[i], sigmas[i])
            fig_seq.add_trace(go.Scatter(
                x=x_seq, y=pdf, mode='lines',
                name=f'After {i} obs: N({mus[i]:.2f},{sigmas[i]:.2f}²)',
                line=dict(color=VIZ_COLORS[i % len(VIZ_COLORS)], width=2),
            ))
        fig_seq.add_vline(x=true_theta, line=dict(color='red', dash='dash', width=1.5),
                          annotation_text="True θ")
        fig_seq.update_xaxes(title_text="θ")
        fig_seq.update_yaxes(title_text="Density")
    else:  # gamma_poisson
        true_lambda = 4.0
        observations = rng.poisson(true_lambda, n_seq)
        alphas_seq = [p1_v]
        betas_seq = [p2_v]
        for obs in observations:
            alphas_seq.append(alphas_seq[-1] + obs)
            betas_seq.append(betas_seq[-1] + 1)
        hi = max(alphas_seq[-1] / betas_seq[-1] + 5 * np.sqrt(alphas_seq[-1]) / betas_seq[-1],
                 true_lambda + 5)
        x_seq = np.linspace(0.001, hi, 300)
        fig_seq = styled_figure(title=f"Sequential Gamma-Poisson Updates (true λ = {true_lambda})", height=480)
        n_show = len(alphas_seq)
        for i in [0, n_show // 4, n_show // 2, 3 * n_show // 4, n_show - 1]:
            pdf = stats.gamma.pdf(x_seq, alphas_seq[i], scale=1.0 / betas_seq[i])
            fig_seq.add_trace(go.Scatter(
                x=x_seq, y=pdf, mode='lines',
                name=f'After {i} obs: Γ({alphas_seq[i]:.1f},{betas_seq[i]:.1f})',
                line=dict(color=VIZ_COLORS[i % len(VIZ_COLORS)], width=2),
            ))
        fig_seq.add_vline(x=true_lambda, line=dict(color='red', dash='dash', width=1.5),
                          annotation_text="True λ")
        fig_seq.update_xaxes(title_text="λ")
        fig_seq.update_yaxes(title_text="Density")

    fig_seq
    return


@app.cell
def _(mo):
    mo.md(r"""
    ### Key Insights

    - As **more data** arrives, the posterior **concentrates** around the true parameter value
    - The prior becomes less influential with more data (**likelihood dominance**)
    - With conjugate priors, each update is a simple **parameter update** — no numerical integration needed
    - The order of observations doesn't matter — only the **sufficient statistics** matter

    ---
    *Module 8.1 — Prior-to-Posterior Machine*
    *Probability Education Platform*
    """)
    return


if __name__ == "__main__":
    app.run()
