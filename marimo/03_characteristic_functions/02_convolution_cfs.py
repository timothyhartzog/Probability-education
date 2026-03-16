import marimo

app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import numpy as np
    import plotly.graph_objects as go
    from plotly.subplots import make_subplots
    from scipy import stats
    return go, make_subplots, mo, np, stats


@app.cell
def _(mo):
    mo.md(r"""
    # Convolution & CLT via Characteristic Functions

    A fundamental property: if $X_1, \dots, X_n$ are independent then

    $$\varphi_{X_1 + \cdots + X_n}(t) = \prod_{k=1}^{n} \varphi_{X_k}(t)$$

    This makes the CLT transparent: for i.i.d. copies with mean $\mu$ and
    variance $\sigma^2$, the CF of $S_n^* = (S_n - n\mu)/(\sigma\sqrt{n})$ satisfies

    $$\varphi_{S_n^*}(t) = \left[\varphi_X\!\left(\frac{t}{\sigma\sqrt{n}}\right)
    e^{-i\mu t/(\sigma\sqrt{n})}\right]^n \;\longrightarrow\; e^{-t^2/2}$$
    """)
    return


@app.cell
def _(mo):
    COLORS = ['#2563eb', '#e97319', '#059669', '#7c3aed',
              '#db2777', '#0891b2', '#ca8a04', '#64748b']

    dist_dd = mo.ui.dropdown(
        options=["Uniform(-1,1)", "Exponential(1)", "Bernoulli(0.5)", "Poisson(3)"],
        value="Uniform(-1,1)",
        label="Base distribution",
    )
    n_slider = mo.ui.slider(start=1, stop=100, step=1, value=5, label="n (# summands)")
    t_range = mo.ui.slider(start=5.0, stop=20.0, step=1.0, value=10.0, label="t-range")
    overlay_normal = mo.ui.checkbox(value=True, label="Overlay N(0,1) CF")
    mo.hstack([dist_dd, n_slider, t_range, overlay_normal])
    return COLORS, dist_dd, n_slider, overlay_normal, t_range


@app.cell
def _(np):
    def _cf_base(t, name):
        """CF of base distribution evaluated at array t."""
        if name == "Uniform(-1,1)":
            return np.where(np.abs(t) < 1e-12, 1.0 + 0j,
                            np.sin(t) / t + 0j)
        elif name == "Exponential(1)":
            return 1.0 / (1.0 - 1j * t)
        elif name == "Bernoulli(0.5)":
            return 0.5 + 0.5 * np.exp(1j * t)
        elif name == "Poisson(3)":
            return np.exp(3.0 * (np.exp(1j * t) - 1))
        return np.ones_like(t, dtype=complex)

    def _mean_var(name):
        """Return (mean, variance) for centering."""
        if name == "Uniform(-1,1)":
            return 0.0, 1.0 / 3.0
        elif name == "Exponential(1)":
            return 1.0, 1.0
        elif name == "Bernoulli(0.5)":
            return 0.5, 0.25
        elif name == "Poisson(3)":
            return 3.0, 3.0
        return 0.0, 1.0

    return _cf_base, _mean_var


@app.cell
def _(mo):
    mo.md(r"""
    ## Product of CFs = CF of Sum

    The plot below shows how the CF of the standardised sum $S_n^*$
    converges to $e^{-t^2/2}$ as $n$ grows. The real part converges to
    a Gaussian bell, while the imaginary part vanishes.
    """)
    return


@app.cell
def _(np, go, make_subplots, COLORS, _cf_base, _mean_var,
      dist_dd, n_slider, t_range, overlay_normal):
    _T = t_range.value
    _t = np.linspace(-_T, _T, 800)
    _name = dist_dd.value
    _n = n_slider.value

    _mu, _var = _mean_var(_name)
    _sigma = np.sqrt(_var)

    # CF of standardised sum S_n^*
    _t_scaled = _t / (_sigma * np.sqrt(_n))
    _phi_single = _cf_base(_t_scaled, _name) * np.exp(-1j * _mu * _t_scaled)
    _phi_sum = _phi_single ** _n

    # Standard normal CF
    _phi_normal = np.exp(-0.5 * _t**2)

    fig = make_subplots(rows=1, cols=2, subplot_titles=["Re(phi)", "Im(phi)"])
    fig.add_trace(go.Scatter(x=_t, y=np.real(_phi_sum), mode='lines',
                             line=dict(color=COLORS[0], width=2),
                             name=f'S*_n (n={_n})'), row=1, col=1)
    fig.add_trace(go.Scatter(x=_t, y=np.imag(_phi_sum), mode='lines',
                             line=dict(color=COLORS[0], width=2),
                             showlegend=False), row=1, col=2)

    if overlay_normal.value:
        fig.add_trace(go.Scatter(x=_t, y=np.real(_phi_normal), mode='lines',
                                 line=dict(color=COLORS[1], width=2, dash='dash'),
                                 name='N(0,1)'), row=1, col=1)
        fig.add_trace(go.Scatter(x=_t, y=np.imag(_phi_normal), mode='lines',
                                 line=dict(color=COLORS[1], width=2, dash='dash'),
                                 showlegend=False), row=1, col=2)

    fig.update_layout(
        template='plotly_white', height=400,
        font=dict(family='Inter, sans-serif', size=13, color='#1a1a2e'),
        plot_bgcolor='#ffffff', paper_bgcolor='#fafafa',
        margin=dict(l=60, r=30, t=60, b=50),
        title=f"CLT convergence: {_name}, n = {_n}",
    )
    for c in [1, 2]:
        fig.update_xaxes(title_text="t", row=1, col=c)
    fig
    return (fig,)


@app.cell
def _(mo):
    mo.md(r"""
    ## Numerical Inversion of the Characteristic Function

    The PDF can be recovered via the **inversion formula**:

    $$f_X(x) = \frac{1}{2\pi} \int_{-\infty}^{\infty} e^{-itx}\,\varphi_X(t)\,dt$$

    Below we numerically invert the CF of the standardised sum and compare
    to the standard normal density.
    """)
    return


@app.cell
def _(np, go, COLORS, stats, _cf_base, _mean_var, dist_dd, n_slider):
    _name = dist_dd.value
    _n = n_slider.value
    _mu, _var = _mean_var(_name)
    _sigma = np.sqrt(_var)

    # Numerical inversion via trapezoidal rule
    _T_inv = 30.0
    _dt = 0.02
    _t_inv = np.arange(-_T_inv, _T_inv, _dt)

    _t_scaled = _t_inv / (_sigma * np.sqrt(_n))
    _phi_single = _cf_base(_t_scaled, _name) * np.exp(-1j * _mu * _t_scaled)
    _phi_sum = _phi_single ** _n

    _x_vals = np.linspace(-4, 4, 300)
    _pdf_inv = np.zeros_like(_x_vals)
    for _i, _x in enumerate(_x_vals):
        integrand = np.exp(-1j * _t_inv * _x) * _phi_sum
        _pdf_inv[_i] = np.real(np.sum(integrand) * _dt / (2 * np.pi))
    _pdf_inv = np.maximum(_pdf_inv, 0)

    _normal_pdf = stats.norm.pdf(_x_vals)

    fig2 = go.Figure()
    fig2.add_trace(go.Scatter(x=_x_vals, y=_pdf_inv, mode='lines',
                              line=dict(color=COLORS[0], width=2),
                              name=f'Inverted CF (n={_n})'))
    fig2.add_trace(go.Scatter(x=_x_vals, y=_normal_pdf, mode='lines',
                              line=dict(color=COLORS[1], width=2, dash='dash'),
                              name='N(0,1) PDF'))
    fig2.update_layout(
        template='plotly_white', height=400,
        font=dict(family='Inter, sans-serif', size=13, color='#1a1a2e'),
        plot_bgcolor='#ffffff', paper_bgcolor='#fafafa',
        margin=dict(l=60, r=30, t=60, b=50),
        title="Numerical Inversion: Recovered PDF vs N(0,1)",
        xaxis_title="x", yaxis_title="f(x)",
    )
    fig2
    return (fig2,)


@app.cell
def _(mo, dist_dd, n_slider, np, _cf_base, _mean_var):
    _name = dist_dd.value
    _n = n_slider.value
    _mu, _var = _mean_var(_name)
    _sigma = np.sqrt(_var)

    _t_check = np.array([0.5, 1.0, 2.0])
    _t_sc = _t_check / (_sigma * np.sqrt(_n))
    _phi_s = (_cf_base(_t_sc, _name) * np.exp(-1j * _mu * _t_sc)) ** _n
    _phi_n = np.exp(-0.5 * _t_check**2)

    _rows = "| t | |phi_Sn*(t)| | exp(-t^2/2) | error |\n|---|---|---|---|\n"
    for _j in range(len(_t_check)):
        _err = abs(_phi_s[_j] - _phi_n[_j])
        _rows += (f"| {_t_check[_j]:.1f} | {abs(_phi_s[_j]):.6f} "
                  f"| {abs(_phi_n[_j]):.6f} | {_err:.6f} |\n")

    mo.md(f"""
    ### Point-wise Convergence Check (n = {_n})

    {_rows}

    As $n \\to \\infty$ the error vanishes at every fixed $t$.
    """)
    return


if __name__ == "__main__":
    app.run()
