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
    from shared.plotting import VIZ_COLORS, DEFAULT_LAYOUT, styled_figure, styled_subplots
    return mo, np, go, make_subplots, VIZ_COLORS, DEFAULT_LAYOUT, styled_figure, styled_subplots


@app.cell
def _(mo):
    mo.md(r"""
    # 7.2 SDE Solver Studio

    Numerically solve **stochastic differential equations** of the form:

    $$dX_t = \mu(X_t, t)\,dt + \sigma(X_t, t)\,dB_t$$

    We compare two discretization schemes:

    - **Euler-Maruyama**: $X_{n+1} = X_n + \mu(X_n, t_n)\Delta t + \sigma(X_n, t_n)\Delta B_n$
    - **Milstein**: adds the correction $+\frac{1}{2}\sigma(X_n)\sigma'(X_n)\bigl[(\Delta B_n)^2 - \Delta t\bigr]$

    The Milstein method achieves **strong order 1.0** convergence vs 0.5 for Euler-Maruyama.
    """)
    return


@app.cell
def _(mo):
    sde_dropdown = mo.ui.dropdown(
        options={
            "Geometric Brownian Motion (GBM)": "gbm",
            "Ornstein-Uhlenbeck (OU)": "ou",
            "Cox-Ingersoll-Ross (CIR)": "cir",
        },
        value="gbm",
        label="SDE Preset",
    )
    method_dropdown = mo.ui.dropdown(
        options={"Euler-Maruyama": "euler", "Milstein": "milstein", "Both (compare)": "both"},
        value="both",
        label="Method",
    )
    dt_slider = mo.ui.slider(
        start=-4, stop=-1, step=0.5, value=-2, label="log₁₀(Δt)"
    )
    n_paths_slider = mo.ui.slider(
        start=1, stop=30, step=1, value=10, label="Number of paths"
    )
    mu_slider = mo.ui.slider(
        start=-1.0, stop=2.0, step=0.1, value=0.5, label="μ"
    )
    sigma_slider = mo.ui.slider(
        start=0.05, stop=2.0, step=0.05, value=0.3, label="σ"
    )
    theta_slider = mo.ui.slider(
        start=0.1, stop=5.0, step=0.1, value=1.0, label="θ (mean-reversion)"
    )
    seed_slider = mo.ui.slider(
        start=0, stop=100, step=1, value=42, label="Seed"
    )
    row1 = mo.hstack([sde_dropdown, method_dropdown, dt_slider, n_paths_slider], wrap=True)
    row2 = mo.hstack([mu_slider, sigma_slider, theta_slider, seed_slider], wrap=True)
    mo.md(f"## Controls\n\n{row1}\n\n{row2}")
    return (sde_dropdown, method_dropdown, dt_slider, n_paths_slider,
            mu_slider, sigma_slider, theta_slider, seed_slider)


@app.cell
def _(np, sde_dropdown, method_dropdown, dt_slider, n_paths_slider,
      mu_slider, sigma_slider, theta_slider, seed_slider):
    # Parameters
    sde_type = sde_dropdown.value
    method = method_dropdown.value
    dt = 10 ** dt_slider.value
    n_paths = n_paths_slider.value
    mu = mu_slider.value
    sigma = sigma_slider.value
    theta = theta_slider.value
    seed = seed_slider.value
    T = 2.0
    X0 = 1.0 if sde_type in ("gbm", "cir") else 0.0
    n_steps = int(T / dt)
    t_grid = np.linspace(0, T, n_steps + 1)
    rng = np.random.default_rng(seed)

    # Drift and diffusion functions + Milstein correction
    def get_sde_funcs(sde_type, mu, sigma, theta):
        if sde_type == "gbm":
            def drift(x, t): return mu * x
            def diff(x, t): return sigma * x
            def diff_prime(x, t): return sigma  # σ'(x) for Milstein
        elif sde_type == "ou":
            def drift(x, t): return theta * (mu - x)
            def diff(x, t): return sigma * np.ones_like(x)
            def diff_prime(x, t): return 0.0
        else:  # CIR
            def drift(x, t): return theta * (mu - x)
            def diff(x, t): return sigma * np.sqrt(np.maximum(x, 0))
            def diff_prime(x, t): return 0.5 * sigma / np.sqrt(np.maximum(x, 1e-10))
        return drift, diff, diff_prime

    drift_fn, diff_fn, diff_prime_fn = get_sde_funcs(sde_type, mu, sigma, theta)

    def solve_euler(drift_fn, diff_fn, X0, dt, n_steps, n_paths, rng):
        X = np.zeros((n_paths, n_steps + 1))
        X[:, 0] = X0
        for i in range(n_steps):
            dB = rng.normal(0, np.sqrt(dt), n_paths)
            X[:, i + 1] = X[:, i] + drift_fn(X[:, i], i * dt) * dt + diff_fn(X[:, i], i * dt) * dB
            if sde_type == "cir":
                X[:, i + 1] = np.maximum(X[:, i + 1], 0)
        return X

    def solve_milstein(drift_fn, diff_fn, diff_prime_fn, X0, dt, n_steps, n_paths, rng):
        X = np.zeros((n_paths, n_steps + 1))
        X[:, 0] = X0
        for i in range(n_steps):
            dB = rng.normal(0, np.sqrt(dt), n_paths)
            sig = diff_fn(X[:, i], i * dt)
            X[:, i + 1] = (X[:, i]
                           + drift_fn(X[:, i], i * dt) * dt
                           + sig * dB
                           + 0.5 * sig * diff_prime_fn(X[:, i], i * dt) * (dB ** 2 - dt))
            if sde_type == "cir":
                X[:, i + 1] = np.maximum(X[:, i + 1], 0)
        return X

    # Solve with shared random state for fair comparison
    results = {}
    if method in ("euler", "both"):
        rng_e = np.random.default_rng(seed)
        results["euler"] = solve_euler(drift_fn, diff_fn, X0, dt, n_steps, n_paths, rng_e)
    if method in ("milstein", "both"):
        rng_m = np.random.default_rng(seed)
        results["milstein"] = solve_milstein(drift_fn, diff_fn, diff_prime_fn, X0, dt, n_steps, n_paths, rng_m)

    # Analytical solution for GBM
    analytical = None
    if sde_type == "gbm" and method in ("euler", "both"):
        rng_a = np.random.default_rng(seed)
        dB_all = rng_a.normal(0, np.sqrt(dt), (n_paths, n_steps))
        W = np.zeros((n_paths, n_steps + 1))
        W[:, 1:] = np.cumsum(dB_all, axis=1)
        analytical = X0 * np.exp((mu - 0.5 * sigma ** 2) * t_grid[np.newaxis, :] + sigma * W)

    return (t_grid, results, analytical, sde_type, n_paths, dt, n_steps,
            method, mu, sigma, theta, X0, T)


@app.cell
def _(go, np, VIZ_COLORS, DEFAULT_LAYOUT, t_grid, results, analytical,
      sde_type, n_paths, method, styled_subplots, styled_figure):
    if method == "both":
        fig = styled_subplots(
            rows=1, cols=2,
            titles=["Euler-Maruyama", "Milstein"],
            height=480,
        )
        for label, col_idx in [("euler", 1), ("milstein", 2)]:
            X = results[label]
            for i in range(n_paths):
                color = VIZ_COLORS[i % len(VIZ_COLORS)]
                fig.add_trace(go.Scatter(
                    x=t_grid, y=X[i], mode='lines',
                    line=dict(color=color, width=1.2), opacity=0.7,
                    showlegend=False,
                ), row=1, col=col_idx)
            # Mean path
            fig.add_trace(go.Scatter(
                x=t_grid, y=np.mean(X, axis=0), mode='lines',
                name=f'Mean ({label})', line=dict(color='black', width=2.5),
                showlegend=True,
            ), row=1, col=col_idx)
        if analytical is not None:
            fig.add_trace(go.Scatter(
                x=t_grid, y=np.mean(analytical, axis=0), mode='lines',
                name='Analytical mean', line=dict(color='red', width=2, dash='dash'),
            ), row=1, col=1)
        fig.update_xaxes(title_text="t")
        fig.update_yaxes(title_text="X(t)")
    else:
        fig = styled_figure(title=f"{'Euler-Maruyama' if method == 'euler' else 'Milstein'} Paths", height=480)
        label = method
        X = results[label]
        for i in range(n_paths):
            color = VIZ_COLORS[i % len(VIZ_COLORS)]
            fig.add_trace(go.Scatter(
                x=t_grid, y=X[i], mode='lines',
                line=dict(color=color, width=1.2), opacity=0.7,
                showlegend=False,
            ))
        fig.add_trace(go.Scatter(
            x=t_grid, y=np.mean(X, axis=0), mode='lines',
            name='Mean', line=dict(color='black', width=2.5),
        ))
        if analytical is not None:
            fig.add_trace(go.Scatter(
                x=t_grid, y=np.mean(analytical, axis=0), mode='lines',
                name='Analytical mean', line=dict(color='red', width=2, dash='dash'),
            ))
        fig.update_xaxes(title_text="t")
        fig.update_yaxes(title_text="X(t)")
    fig
    return


@app.cell
def _(go, np, VIZ_COLORS, DEFAULT_LAYOUT, results, n_paths, styled_figure):
    # Terminal distribution histogram
    fig_hist = styled_figure(title="Terminal Distribution X(T)", height=380)
    for label, color in [("euler", VIZ_COLORS[0]), ("milstein", VIZ_COLORS[1])]:
        if label in results:
            X_T = results[label][:, -1]
            fig_hist.add_trace(go.Histogram(
                x=X_T, name=label.capitalize(), marker_color=color,
                opacity=0.6, nbinsx=30, histnorm='probability density',
            ))
    fig_hist.update_xaxes(title_text="X(T)")
    fig_hist.update_yaxes(title_text="Density")
    fig_hist
    return


@app.cell
def _(mo, sde_type, mu, sigma, theta, X0):
    sde_descriptions = {
        "gbm": rf"""
    ### Geometric Brownian Motion

    $$dX_t = \mu X_t\,dt + \sigma X_t\,dB_t, \quad X_0 = {X0}$$

    **Analytical solution:** $X_t = X_0 \exp\!\bigl[(\mu - \tfrac{{\sigma^2}}{{2}})t + \sigma B_t\bigr]$

    With $\mu = {mu}$, $\sigma = {sigma}$:
    - $\mathbb{{E}}[X_t] = X_0 e^{{\mu t}}$
    - $\text{{Var}}(X_t) = X_0^2 e^{{2\mu t}}(e^{{\sigma^2 t}} - 1)$

    Used extensively in **Black-Scholes** option pricing.
    """,
        "ou": rf"""
    ### Ornstein-Uhlenbeck Process

    $$dX_t = \theta(\mu - X_t)\,dt + \sigma\,dB_t, \quad X_0 = {X0}$$

    **Mean-reverting** to $\mu = {mu}$ with rate $\theta = {theta}$.

    - Stationary distribution: $X_\infty \sim N\!\left(\mu,\; \dfrac{{\sigma^2}}{{2\theta}}\right)$
    - Milstein = Euler-Maruyama (since $\sigma' = 0$)

    Models interest rates (Vasicek), particle velocities, etc.
    """,
        "cir": rf"""
    ### Cox-Ingersoll-Ross (CIR) Process

    $$dX_t = \theta(\mu - X_t)\,dt + \sigma\sqrt{{X_t}}\,dB_t, \quad X_0 = {X0}$$

    With $\theta = {theta}$, $\mu = {mu}$, $\sigma = {sigma}$.

    - **Feller condition**: $2\theta\mu \geq \sigma^2$ ensures $X_t > 0$
    - Current: $2\theta\mu = {2*theta*mu:.2f}$ vs $\sigma^2 = {sigma**2:.2f}$
      → {"**satisfied** ✓" if 2*theta*mu >= sigma**2 else "**violated** ✗ (process can hit zero)"}

    Used for **interest rate** and **stochastic volatility** modeling.
    """,
    }
    mo.md(sde_descriptions[sde_type])
    return


@app.cell
def _(mo):
    mo.md(r"""
    ### Method Comparison

    | Property | Euler-Maruyama | Milstein |
    |----------|---------------|----------|
    | Strong order | 0.5 | 1.0 |
    | Weak order | 1.0 | 1.0 |
    | Requires $\sigma'(x)$ | No | Yes |
    | Cost per step | Lower | Slightly higher |
    | Best for | Quick simulations | Accuracy-critical work |

    Increase the number of partitions (decrease Δt) to see both methods converge
    to the analytical solution.

    ---
    *Module 7.2 — SDE Solver Studio*
    *Probability Education Platform*
    """)
    return


if __name__ == "__main__":
    app.run()
