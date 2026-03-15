"""
Shared math utility functions used across Marimo visualization notebooks.
"""

import numpy as np
from scipy import special


def ln_gamma(z):
    """Log-gamma function."""
    return special.gammaln(z)


def ln_factorial(n):
    """Log-factorial via log-gamma."""
    if n <= 1:
        return 0.0
    return special.gammaln(n + 1)


def normal_pdf(x, mu=0.0, sigma=1.0):
    """Normal probability density function."""
    z = (x - mu) / sigma
    return np.exp(-z * z / 2) / (sigma * np.sqrt(2 * np.pi))


# ---------------------------------------------------------------------------
# Characteristic function definitions
# ---------------------------------------------------------------------------

def cf_normal(t, mu=0.0, sigma=1.0):
    """CF of Normal(mu, sigma)."""
    return np.exp(1j * mu * t - 0.5 * sigma**2 * t**2)


def cf_uniform(t, a=-1.0, b=1.0):
    """CF of Uniform(a, b)."""
    if np.abs(t) < 1e-12:
        return 1.0 + 0j
    return (np.exp(1j * b * t) - np.exp(1j * a * t)) / (1j * (b - a) * t)


def cf_exponential(t, lam=1.0):
    """CF of Exponential(lam)."""
    return lam / (lam - 1j * t)


def cf_poisson(t, lam=3.0):
    """CF of Poisson(lam)."""
    return np.exp(lam * (np.exp(1j * t) - 1))


def cf_cauchy(t, x0=0.0, gamma=1.0):
    """CF of Cauchy(x0, gamma)."""
    return np.exp(1j * x0 * t - gamma * np.abs(t))


def cf_bernoulli(t, p=0.5):
    """CF of Bernoulli(p)."""
    return (1 - p) + p * np.exp(1j * t)


CHARACTERISTIC_FUNCTIONS = {
    'normal': cf_normal,
    'uniform': cf_uniform,
    'exponential': cf_exponential,
    'poisson': cf_poisson,
    'cauchy': cf_cauchy,
    'bernoulli': cf_bernoulli,
}


# ---------------------------------------------------------------------------
# Seedable RNG helper
# ---------------------------------------------------------------------------

def create_rng(seed=42):
    """Create a NumPy random Generator with the given seed."""
    return np.random.default_rng(seed)
