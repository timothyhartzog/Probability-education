import marimo

app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import numpy as np
    import plotly.graph_objects as go
    from plotly.subplots import make_subplots
    return go, make_subplots, mo, np


@app.cell
def _(mo):
    mo.md(r"""
    # Characteristic Function Gallery

    The **characteristic function** of a random variable $X$ is defined as

    $$\varphi_X(t) = \mathbb{E}[e^{itX}] = \int_{-\infty}^{\infty} e^{itx}\, f_X(x)\,dx$$

    It always exists (unlike the moment-generating function) and uniquely
    determines the distribution.  Below we visualise
    $\operatorname{Re}\varphi(t)$, $\operatorname{Im}\varphi(t)$,
    $|\varphi(t)|$, and $\arg\varphi(t)$ for several classical distributions.

    Use the controls to change the distribution and its parameters.
    """)
    return


@app.cell
def _(mo):
    COLORS = ['#2563eb', '#e97319', '#059669', '#7c3aed',
              '#db2777', '#0891b2', '#ca8a04', '#64748b']

    dist_dropdown = mo.ui.dropdown(
        options=["Normal", "Uniform", "Exponential", "Poisson", "Cauchy", "Bernoulli"],
        value="Normal",
        label="Distribution",
    )
    param1_slider = mo.ui.slider(
        start=0.1, stop=5.0, step=0.1, value=1.0, label="Parameter 1"
    )
    param2_slider = mo.ui.slider(
        start=0.1, stop=5.0, step=0.1, value=1.0, label="Parameter 2"
    )
    t_range_slider = mo.ui.slider(
        start=5.0, stop=30.0, step=1.0, value=10.0, label="t-range"
    )
    mo.hstack([dist_dropdown, param1_slider, param2_slider, t_range_slider])
    return COLORS, dist_dropdown, param1_slider, param2_slider, t_range_slider


@app.cell
def _(mo, dist_dropdown, param1_slider, param2_slider):
    _dist = dist_dropdown.value
    _labels = {
        "Normal": ("mu (mean)", "sigma (std dev)"),
        "Uniform": ("a (half-width)", "b (half-width)"),
        "Exponential": ("lambda (rate)", "(unused)"),
        "Poisson": ("lambda (rate)", "(unused)"),
        "Cauchy": ("x0 (location)", "gamma (scale)"),
        "Bernoulli": ("p (probability)", "(unused)"),
    }
    _p1, _p2 = _labels.get(_dist, ("param1", "param2"))
    mo.md(
        f"**{_dist}** -- {_p1} = {param1_slider.value:.2f}, "
        f"{_p2} = {param2_slider.value:.2f}"
    )
    return


@app.cell
def _(np):
    def compute_cf(t_arr, dist_name, p1, p2):
        """Return complex CF values for the given distribution."""
        t = t_arr
        if dist_name == "Normal":
            mu, sigma = p1, p2
            return np.exp(1j * mu * t - 0.5 * sigma**2 * t**2)
        elif dist_name == "Uniform":
            a, b = -p1, p2
            return np.where(
                np.abs(t) < 1e-12,
                1.0 + 0j,
                (np.exp(1j * b * t) - np.exp(1j * a * t)) / (1j * (b - a) * t),
            )
        elif dist_name == "Exponential":
            lam = p1
            return lam / (lam - 1j * t)
        elif dist_name == "Poisson":
            lam = p1
            return np.exp(lam * (np.exp(1j * t) - 1))
        elif dist_name == "Cauchy":
            x0, gamma = p1, p2
            return np.exp(1j * x0 * t - gamma * np.abs(t))
        elif dist_name == "Bernoulli":
            p = min(p1, 1.0)
            return (1 - p) + p * np.exp(1j * t)
        return np.ones_like(t, dtype=complex)

    return (compute_cf,)


@app.cell
def _(np, go, make_subplots, COLORS, compute_cf,
      dist_dropdown, param1_slider, param2_slider, t_range_slider):
    _T = t_range_slider.value
    _t = np.linspace(-_T, _T, 1000)
    _cf = compute_cf(_t, dist_dropdown.value, param1_slider.value, param2_slider.value)

    _layout = dict(
        template='plotly_white',
        font=dict(family='Inter, sans-serif', size=13, color='#1a1a2e'),
        plot_bgcolor='#ffffff', paper_bgcolor='#fafafa',
        margin=dict(l=60, r=30, t=50, b=50),
    )

    fig = make_subplots(
        rows=2, cols=2,
        subplot_titles=[
            "Re(phi(t))", "Im(phi(t))", "|phi(t)|", "arg(phi(t))"
        ],
    )
    fig.add_trace(go.Scatter(x=_t, y=np.real(_cf), mode='lines',
                             line=dict(color=COLORS[0], width=2), name='Re'),
                  row=1, col=1)
    fig.add_trace(go.Scatter(x=_t, y=np.imag(_cf), mode='lines',
                             line=dict(color=COLORS[1], width=2), name='Im'),
                  row=1, col=2)
    fig.add_trace(go.Scatter(x=_t, y=np.abs(_cf), mode='lines',
                             line=dict(color=COLORS[2], width=2), name='|phi|'),
                  row=2, col=1)
    fig.add_trace(go.Scatter(x=_t, y=np.angle(_cf), mode='lines',
                             line=dict(color=COLORS[3], width=2), name='arg'),
                  row=2, col=2)

    fig.update_layout(
        **_layout,
        height=600,
        title=f"Characteristic Function: {dist_dropdown.value}",
        showlegend=False,
    )
    for i in range(1, 5):
        fig.update_xaxes(title_text="t", row=(i - 1) // 2 + 1, col=(i - 1) % 2 + 1)
    fig
    return (fig,)


@app.cell
def _(mo, np, go, COLORS, compute_cf, dist_dropdown, param1_slider, param2_slider):
    _dists = ["Normal", "Uniform", "Exponential", "Poisson", "Cauchy", "Bernoulli"]
    _t = np.linspace(-10, 10, 600)

    fig_compare = go.Figure()
    for _i, _d in enumerate(_dists):
        _p1 = param1_slider.value if _d == dist_dropdown.value else 1.0
        _p2 = param2_slider.value if _d == dist_dropdown.value else 1.0
        _cf_vals = compute_cf(_t, _d, _p1, _p2)
        fig_compare.add_trace(go.Scatter(
            x=_t, y=np.abs(_cf_vals), mode='lines',
            line=dict(color=COLORS[_i % len(COLORS)], width=2),
            name=_d,
        ))

    fig_compare.update_layout(
        template='plotly_white', height=400,
        font=dict(family='Inter, sans-serif', size=13, color='#1a1a2e'),
        plot_bgcolor='#ffffff', paper_bgcolor='#fafafa',
        margin=dict(l=60, r=30, t=60, b=50),
        title="Comparison: |phi(t)| across all distributions",
        xaxis_title="t", yaxis_title="|phi(t)|",
    )
    fig_compare
    return (fig_compare,)


@app.cell
def _(mo):
    mo.md(r"""
    ## Closed-Form Expressions

    | Distribution | $\varphi_X(t)$ |
    |---|---|
    | $\text{Normal}(\mu, \sigma^2)$ | $e^{i\mu t - \sigma^2 t^2/2}$ |
    | $\text{Uniform}(a,b)$ | $\dfrac{e^{ibt}-e^{iat}}{i(b-a)t}$ |
    | $\text{Exp}(\lambda)$ | $\dfrac{\lambda}{\lambda - it}$ |
    | $\text{Poisson}(\lambda)$ | $\exp\!\bigl(\lambda(e^{it}-1)\bigr)$ |
    | $\text{Cauchy}(x_0,\gamma)$ | $e^{ix_0 t - \gamma|t|}$ |
    | $\text{Bernoulli}(p)$ | $(1-p) + pe^{it}$ |

    **Key properties:**
    - $\varphi_X(0) = 1$ always.
    - $|\varphi_X(t)| \le 1$ for all $t$.
    - $\varphi_X$ is uniformly continuous on $\mathbb{R}$.
    - Moments from derivatives: $\mathbb{E}[X^n] = \dfrac{\varphi^{(n)}(0)}{i^n}$.
    - If $\int |\varphi_X(t)|\,dt < \infty$ then $X$ has a bounded continuous density.
    """)
    return


if __name__ == "__main__":
    app.run()
