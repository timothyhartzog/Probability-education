"""
Shared plotting utilities and design system for Marimo notebooks.
Colorblind-safe palette matching the CSS design system.
"""

import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots

# Colorblind-safe visualization palette (matches CSS --viz-1 through --viz-8)
VIZ_COLORS = [
    '#2563eb',  # blue
    '#e97319',  # orange
    '#059669',  # green
    '#7c3aed',  # purple
    '#db2777',  # pink
    '#0891b2',  # cyan
    '#ca8a04',  # yellow
    '#64748b',  # slate
]

# Semantic colors
COLOR_PRIMARY = '#2563eb'
COLOR_SECONDARY = '#e97319'
COLOR_ACCENT = '#059669'
COLOR_ERROR = '#dc2626'
COLOR_BG = '#fafafa'
COLOR_SURFACE = '#ffffff'
COLOR_TEXT = '#1a1a2e'
COLOR_TEXT_SECONDARY = '#555555'

# Default layout template
DEFAULT_LAYOUT = dict(
    template='plotly_white',
    font=dict(family='Inter, Helvetica Neue, sans-serif', size=13, color=COLOR_TEXT),
    plot_bgcolor=COLOR_SURFACE,
    paper_bgcolor=COLOR_BG,
    margin=dict(l=60, r=30, t=50, b=50),
    colorway=VIZ_COLORS,
)


def styled_figure(title='', height=450, **kwargs):
    """Create a Plotly figure with the education platform styling."""
    layout = {**DEFAULT_LAYOUT, 'title': title, 'height': height, **kwargs}
    return go.Figure(layout=layout)


def styled_subplots(rows=1, cols=2, titles=None, height=450, **kwargs):
    """Create styled subplots."""
    fig = make_subplots(rows=rows, cols=cols, subplot_titles=titles, **kwargs)
    fig.update_layout(**DEFAULT_LAYOUT, height=height)
    return fig


def add_histogram_with_kde(fig, data, n_bins=40, name='Data', color=None,
                           show_kde=True, row=None, col=None):
    """Add a histogram with optional KDE overlay to a figure."""
    color = color or VIZ_COLORS[0]
    kwargs = {}
    if row is not None:
        kwargs['row'] = row
        kwargs['col'] = col

    fig.add_trace(
        go.Histogram(
            x=data, nbinsx=n_bins, name=name,
            marker_color=color, opacity=0.6,
            histnorm='probability density',
        ),
        **kwargs,
    )

    if show_kde and len(data) > 1:
        from scipy.stats import gaussian_kde
        kde = gaussian_kde(data)
        x_range = np.linspace(np.min(data), np.max(data), 200)
        fig.add_trace(
            go.Scatter(
                x=x_range, y=kde(x_range), mode='lines',
                name=f'{name} KDE', line=dict(color=color, width=2),
            ),
            **kwargs,
        )


def add_multi_paths(fig, paths, x=None, names=None, colors=None):
    """Add multiple line paths (e.g., simulation trajectories) to a figure."""
    n_paths = len(paths)
    colors = colors or VIZ_COLORS
    for i, path in enumerate(paths):
        x_vals = x if x is not None else np.arange(len(path))
        name = names[i] if names else f'Path {i + 1}'
        fig.add_trace(
            go.Scatter(
                x=x_vals, y=path, mode='lines',
                name=name, line=dict(color=colors[i % len(colors)], width=1.5),
                opacity=0.7,
            )
        )


def add_normal_overlay(fig, x_range, mu=0.0, sigma=1.0, name='N(0,1)',
                       color=COLOR_ERROR, row=None, col=None):
    """Add a normal PDF curve overlay."""
    from .math_utils import normal_pdf
    x = np.linspace(x_range[0], x_range[1], 200)
    y = normal_pdf(x, mu, sigma)
    kwargs = {}
    if row is not None:
        kwargs['row'] = row
        kwargs['col'] = col
    fig.add_trace(
        go.Scatter(
            x=x, y=y, mode='lines', name=name,
            line=dict(color=color, width=2, dash='dash'),
        ),
        **kwargs,
    )
