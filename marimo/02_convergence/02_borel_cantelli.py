import marimo

__generated_with = "0.13.0"
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
    # 2.2 Borel-Cantelli Lemmas

    The **Borel-Cantelli lemmas** are cornerstones of probability theory that tell us
    when events occur *infinitely often* (abbreviated **i.o.**).

    Given a sequence of events $\{A_n\}_{n \ge 1}$, define
    $$\{A_n \text{ i.o.}\} = \limsup_{n \to \infty} A_n = \bigcap_{n=1}^{\infty} \bigcup_{k=n}^{\infty} A_k.$$

    An outcome $\omega$ belongs to $\{A_n \text{ i.o.}\}$ if and only if $\omega \in A_n$ for infinitely many $n$.

    | Lemma | Condition | Conclusion |
    |-------|-----------|------------|
    | **First BC** | $\sum_{n=1}^{\infty} P(A_n) < \infty$ | $P(A_n \text{ i.o.}) = 0$ |
    | **Second BC** | $A_n$ independent, $\sum_{n=1}^{\infty} P(A_n) = \infty$ | $P(A_n \text{ i.o.}) = 1$ |

    The first lemma requires no independence assumption. The second **needs independence**
    (or at least pairwise independence) --- the divergence of the sum alone is not sufficient.
    """)
    return


@app.cell
def _(mo):
    COLORS = ['#2563eb', '#e97319', '#059669', '#7c3aed',
              '#db2777', '#0891b2', '#ca8a04', '#64748b']

    seq_dropdown = mo.ui.dropdown(
        options={
            "P(A_n) = 1/n^2  (summable)": "inv_n2",
            "P(A_n) = 1/n  (divergent, harmonic)": "inv_n",
            "P(A_n) = p^n  (geometric, summable)": "geometric",
            "P(A_n) = 1/sqrt(n)  (divergent)": "inv_sqrt_n",
        },
        value="P(A_n) = 1/n^2  (summable)",
        label="Sequence type",
    )
    n_events_slider = mo.ui.slider(20, 200, value=80, step=10, label="Number of events (N)")
    n_samples_slider = mo.ui.slider(20, 200, value=100, step=10, label="Number of samples")
    seed_slider = mo.ui.slider(0, 100, value=42, step=1, label="Seed")

    controls = mo.hstack([seq_dropdown, n_events_slider, n_samples_slider, seed_slider], wrap=True)
    controls
    return COLORS, n_events_slider, n_samples_slider, seed_slider, seq_dropdown


@app.cell
def _(seq_dropdown, mo):
    _key = {v: k for k, v in seq_dropdown.options.items()}[seq_dropdown.value]
    _descs = {
        "inv_n2": r"""
**Sequence:** $P(A_n) = 1/n^2$. Since $\sum 1/n^2 = \pi^2/6 < \infty$,
the **First Borel-Cantelli Lemma** guarantees $P(A_n \text{ i.o.}) = 0$.
Almost every sample will eventually stop belonging to $A_n$.
        """,
        "inv_n": r"""
**Sequence:** $P(A_n) = 1/n$. The harmonic series $\sum 1/n = \infty$ diverges.
With **independent** events, the **Second Borel-Cantelli Lemma** gives $P(A_n \text{ i.o.}) = 1$.
Every sample belongs to infinitely many $A_n$.
        """,
        "geometric": r"""
**Sequence:** $P(A_n) = (1/2)^n$. The geometric series $\sum (1/2)^n = 1 < \infty$
is summable, so the **First BC Lemma** applies: $P(A_n \text{ i.o.}) = 0$.
Events die out quickly.
        """,
        "inv_sqrt_n": r"""
**Sequence:** $P(A_n) = 1/\sqrt{n}$. Since $\sum 1/\sqrt{n}$ diverges, and with
**independent** events, the **Second BC Lemma** gives $P(A_n \text{ i.o.}) = 1$.
        """,
    }
    mo.md(_descs[_key])
    return


@app.cell
def _(COLORS, go, make_subplots, mo, np, n_events_slider, n_samples_slider, seed_slider, seq_dropdown):
    _key = {v: k for k, v in seq_dropdown.options.items()}[seq_dropdown.value]
    _N = n_events_slider.value
    _M = n_samples_slider.value
    _rng = np.random.default_rng(seed_slider.value)
    _ns = np.arange(1, _N + 1)

    # Compute P(A_n) for each sequence type
    def _get_probs(key, N):
        if key == "inv_n2":
            return 1.0 / np.arange(1, N + 1) ** 2
        elif key == "inv_n":
            return 1.0 / np.arange(1, N + 1)
        elif key == "geometric":
            return 0.5 ** np.arange(1, N + 1)
        elif key == "inv_sqrt_n":
            return 1.0 / np.sqrt(np.arange(1, N + 1))
        return np.zeros(N)

    _probs = _get_probs(_key, _N)

    # Generate event occurrences: indicator[sample, event]
    _uniforms = _rng.random((_M, _N))
    _indicators = (_uniforms < _probs[None, :]).astype(int)

    # Running partial sum of P(A_n)
    _partial_sums = np.cumsum(_probs)

    # For each sample, find the last n where the sample was in A_n
    _last_occurrence = np.zeros(_M, dtype=int)
    for _s in range(_M):
        _hits = np.where(_indicators[_s] == 1)[0]
        if len(_hits) > 0:
            _last_occurrence[_s] = _hits[-1] + 1  # 1-indexed

    # "In A_n i.o." heuristic: sample is in A_n for some n >= N/2
    _late_threshold = _N // 2
    _in_io = np.array([
        np.any(_indicators[s, _late_threshold:] == 1)
        for s in range(_M)
    ])
    _frac_io = np.mean(_in_io)

    # --- Plots ---
    _fig = make_subplots(
        rows=2, cols=2,
        subplot_titles=[
            "Event Occurrence Grid (sample x event)",
            "Running Sum of P(A_n)",
            "Last Occurrence of A_n per Sample",
            "Fraction with Late Hits (n >= N/2)",
        ],
        vertical_spacing=0.14,
        horizontal_spacing=0.10,
    )
    _fig.update_layout(
        template='plotly_white',
        font=dict(family='Inter, Helvetica Neue, sans-serif', size=12),
        height=700,
        margin=dict(l=60, r=30, t=60, b=50),
        showlegend=False,
    )

    # (1) Event occurrence heatmap
    _show_samples = min(_M, 60)
    _show_events = min(_N, 100)
    _fig.add_trace(go.Heatmap(
        z=_indicators[:_show_samples, :_show_events],
        colorscale=[[0, '#f1f5f9'], [1, COLORS[0]]],
        showscale=False,
        xgap=1, ygap=1,
    ), row=1, col=1)
    _fig.update_xaxes(title_text="Event n", row=1, col=1)
    _fig.update_yaxes(title_text="Sample", row=1, col=1)

    # (2) Running sum of P(A_n)
    _fig.add_trace(go.Scatter(
        x=_ns, y=_partial_sums,
        mode='lines',
        line=dict(color=COLORS[1], width=2),
        fill='tozeroy',
        fillcolor='rgba(233,115,25,0.12)',
    ), row=1, col=2)
    _fig.update_xaxes(title_text="n", row=1, col=2)
    _fig.update_yaxes(title_text="Sum P(A_k), k=1..n", row=1, col=2)

    # Check if sum converges
    _is_summable = _key in ("inv_n2", "geometric")
    if _is_summable:
        _limit_val = _partial_sums[-1]
        _fig.add_hline(y=_limit_val, line_dash="dash", line_color="#dc2626",
                       line_width=1.5, row=1, col=2,
                       annotation_text=f"~{_limit_val:.2f}",
                       annotation_position="top right")

    # (3) Histogram of last occurrence
    _fig.add_trace(go.Histogram(
        x=_last_occurrence,
        nbinsx=min(40, _N),
        marker_color=COLORS[2],
        opacity=0.7,
    ), row=2, col=1)
    _fig.update_xaxes(title_text="Last event n where sample in A_n", row=2, col=1)
    _fig.update_yaxes(title_text="Count", row=2, col=1)

    # (4) Bar chart: fraction of samples with hits in late half
    _fig.add_trace(go.Bar(
        x=["Late hits (n >= N/2)", "No late hits"],
        y=[_frac_io, 1 - _frac_io],
        marker_color=[COLORS[3], COLORS[7]],
    ), row=2, col=2)
    _fig.update_yaxes(title_text="Fraction of samples", range=[0, 1.1], row=2, col=2)

    mo.ui.plotly(_fig)
    return


@app.cell
def _(COLORS, go, mo, np, n_events_slider, seed_slider, seq_dropdown):
    # Show running fraction of samples still hitting events
    _key = {v: k for k, v in seq_dropdown.options.items()}[seq_dropdown.value]
    _N = n_events_slider.value
    _M_large = 2000
    _rng2 = np.random.default_rng(seed_slider.value + 999)
    _ns = np.arange(1, _N + 1)

    def _get_probs2(key, N):
        if key == "inv_n2":
            return 1.0 / np.arange(1, N + 1) ** 2
        elif key == "inv_n":
            return 1.0 / np.arange(1, N + 1)
        elif key == "geometric":
            return 0.5 ** np.arange(1, N + 1)
        elif key == "inv_sqrt_n":
            return 1.0 / np.sqrt(np.arange(1, N + 1))
        return np.zeros(N)

    _probs2 = _get_probs2(_key, _N)
    _uniforms2 = _rng2.random((_M_large, _N))
    _indicators2 = (_uniforms2 < _probs2[None, :]).astype(int)

    # For each n, fraction of samples that belong to at least one A_k for k >= n
    _frac_future = np.zeros(_N)
    for _n_idx in range(_N):
        _any_future = np.any(_indicators2[:, _n_idx:] == 1, axis=1)
        _frac_future[_n_idx] = np.mean(_any_future)

    _fig3 = go.Figure()
    _fig3.update_layout(
        template='plotly_white',
        font=dict(family='Inter, Helvetica Neue, sans-serif', size=13),
        height=350,
        title="P(belongs to some A_k with k >= n) vs n",
        xaxis_title="n",
        yaxis_title="Empirical probability",
        margin=dict(l=60, r=30, t=60, b=50),
    )
    _fig3.add_trace(go.Scatter(
        x=_ns, y=_frac_future,
        mode='lines',
        line=dict(color=COLORS[4], width=2),
        fill='tozeroy',
        fillcolor='rgba(219,39,119,0.1)',
    ))
    _fig3.add_hline(y=0, line_dash="dash", line_color="#999")
    _fig3.update_yaxes(range=[-0.05, 1.1])

    mo.ui.plotly(_fig3)
    return


@app.cell
def _(mo):
    mo.md(r"""
    ## Interpreting the Results

    - **Summable case** ($\sum P(A_n) < \infty$): The event grid becomes sparse for large $n$.
      The "last occurrence" histogram clusters at small values, and the fraction with late hits
      drops toward zero. The limsup probability $P(A_n \text{ i.o.})$ is empirically near 0.

    - **Divergent case** ($\sum P(A_n) = \infty$, independent): Events keep appearing throughout
      the grid. Nearly every sample has hits even for large $n$, confirming $P(A_n \text{ i.o.}) = 1$.

    ### Why independence matters for BC2

    Consider $A_n = A$ for all $n$ with $P(A) = 1/2$. Then $\sum P(A_n) = \infty$, but
    $P(A_n \text{ i.o.}) = P(A) = 1/2 \neq 1$. The events are not independent, so BC2 does not apply.

    ---
    *Module 2.2 --- Borel-Cantelli Lemmas*
    *Probability Education Platform*
    """)
    return


if __name__ == "__main__":
    app.run()
