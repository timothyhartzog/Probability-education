"""
Probability distribution classes for the education platform.

Every distribution exposes a uniform interface:
    sample(rng, n=1)   - draw n variates (rng is numpy Generator)
    pdf(x) / pmf(x)    - density / mass at x
    cdf(x)             - cumulative distribution function
    mean()             - expected value
    variance()         - variance
    cf(t)              - characteristic function, returns complex number
"""

import numpy as np
from scipy import stats, special


# ---------------------------------------------------------------------------
# Normal
# ---------------------------------------------------------------------------

class Normal:
    def __init__(self, mu=0.0, sigma=1.0):
        self.mu = mu
        self.sigma = sigma
        self._dist = stats.norm(loc=mu, scale=sigma)

    def sample(self, rng, n=1):
        return rng.normal(self.mu, self.sigma, size=n)

    def pdf(self, x):
        return self._dist.pdf(x)

    def cdf(self, x):
        return self._dist.cdf(x)

    def mean(self):
        return self.mu

    def variance(self):
        return self.sigma ** 2

    def cf(self, t):
        phase = self.mu * t
        decay = np.exp(-0.5 * self.sigma**2 * t**2)
        return decay * np.exp(1j * phase)


# ---------------------------------------------------------------------------
# Uniform
# ---------------------------------------------------------------------------

class Uniform:
    def __init__(self, a=0.0, b=1.0):
        self.a = a
        self.b = b
        self._dist = stats.uniform(loc=a, scale=b - a)

    def sample(self, rng, n=1):
        return rng.uniform(self.a, self.b, size=n)

    def pdf(self, x):
        return self._dist.pdf(x)

    def cdf(self, x):
        return self._dist.cdf(x)

    def mean(self):
        return (self.a + self.b) / 2

    def variance(self):
        return (self.b - self.a) ** 2 / 12

    def cf(self, t):
        if np.abs(t) < 1e-12:
            return 1.0 + 0j
        d = self.b - self.a
        return (np.exp(1j * self.b * t) - np.exp(1j * self.a * t)) / (1j * d * t)


# ---------------------------------------------------------------------------
# Exponential
# ---------------------------------------------------------------------------

class Exponential:
    def __init__(self, lam=1.0):
        self.lam = lam
        self._dist = stats.expon(scale=1.0 / lam)

    def sample(self, rng, n=1):
        return rng.exponential(1.0 / self.lam, size=n)

    def pdf(self, x):
        return self._dist.pdf(x)

    def cdf(self, x):
        return self._dist.cdf(x)

    def mean(self):
        return 1.0 / self.lam

    def variance(self):
        return 1.0 / self.lam**2

    def cf(self, t):
        return self.lam / (self.lam - 1j * t)


# ---------------------------------------------------------------------------
# Poisson (discrete)
# ---------------------------------------------------------------------------

class Poisson:
    def __init__(self, lam=1.0):
        self.lam = lam
        self._dist = stats.poisson(mu=lam)

    def sample(self, rng, n=1):
        return rng.poisson(self.lam, size=n)

    def pmf(self, x):
        return self._dist.pmf(x)

    def pdf(self, x):
        return self.pmf(x)

    def cdf(self, x):
        return self._dist.cdf(x)

    def mean(self):
        return self.lam

    def variance(self):
        return self.lam

    def cf(self, t):
        return np.exp(self.lam * (np.exp(1j * t) - 1))


# ---------------------------------------------------------------------------
# Binomial
# ---------------------------------------------------------------------------

class Binomial:
    def __init__(self, n=1, p=0.5):
        self.n = n
        self.p = p
        self._dist = stats.binom(n=n, p=p)

    def sample(self, rng, n=1):
        return rng.binomial(self.n, self.p, size=n)

    def pmf(self, k):
        return self._dist.pmf(k)

    def pdf(self, k):
        return self.pmf(k)

    def cdf(self, x):
        return self._dist.cdf(x)

    def mean(self):
        return self.n * self.p

    def variance(self):
        return self.n * self.p * (1 - self.p)

    def cf(self, t):
        return (1 - self.p + self.p * np.exp(1j * t)) ** self.n


# ---------------------------------------------------------------------------
# Beta
# ---------------------------------------------------------------------------

class Beta:
    def __init__(self, alpha=1.0, beta=1.0):
        self.alpha = alpha
        self.beta_ = beta
        self._dist = stats.beta(a=alpha, b=beta)

    def sample(self, rng, n=1):
        return rng.beta(self.alpha, self.beta_, size=n)

    def pdf(self, x):
        return self._dist.pdf(x)

    def cdf(self, x):
        return self._dist.cdf(x)

    def mean(self):
        return self.alpha / (self.alpha + self.beta_)

    def variance(self):
        ab = self.alpha + self.beta_
        return (self.alpha * self.beta_) / (ab**2 * (ab + 1))

    def cf(self, t):
        # 1F1(alpha; alpha+beta; i*t) via series
        a, b = self.alpha, self.alpha + self.beta_
        result = 1.0 + 0j
        term = 1.0 + 0j
        for n in range(1, 301):
            term *= (1j * t * (a + n - 1)) / ((b + n - 1) * n)
            result += term
            if abs(term) < 1e-15 * abs(result):
                break
        return result


# ---------------------------------------------------------------------------
# Gamma
# ---------------------------------------------------------------------------

class GammaDist:
    """Gamma distribution with shape alpha and rate beta."""
    def __init__(self, alpha=1.0, beta=1.0):
        self.alpha = alpha
        self.beta = beta
        self._dist = stats.gamma(a=alpha, scale=1.0 / beta)

    def sample(self, rng, n=1):
        return rng.gamma(self.alpha, 1.0 / self.beta, size=n)

    def pdf(self, x):
        return self._dist.pdf(x)

    def cdf(self, x):
        return self._dist.cdf(x)

    def mean(self):
        return self.alpha / self.beta

    def variance(self):
        return self.alpha / self.beta**2

    def cf(self, t):
        return (self.beta / (self.beta - 1j * t)) ** self.alpha


# ---------------------------------------------------------------------------
# Geometric
# ---------------------------------------------------------------------------

class Geometric:
    def __init__(self, p=0.5):
        self.p = p
        self._dist = stats.geom(p=p)

    def sample(self, rng, n=1):
        return rng.geometric(self.p, size=n)

    def pmf(self, k):
        return self._dist.pmf(k)

    def pdf(self, k):
        return self.pmf(k)

    def cdf(self, x):
        return self._dist.cdf(x)

    def mean(self):
        return 1.0 / self.p

    def variance(self):
        return (1 - self.p) / self.p**2

    def cf(self, t):
        return self.p * np.exp(1j * t) / (1 - (1 - self.p) * np.exp(1j * t))


# ---------------------------------------------------------------------------
# Cauchy
# ---------------------------------------------------------------------------

class Cauchy:
    def __init__(self, x0=0.0, gamma=1.0):
        self.x0 = x0
        self.gamma = gamma
        self._dist = stats.cauchy(loc=x0, scale=gamma)

    def sample(self, rng, n=1):
        return self.x0 + self.gamma * np.tan(np.pi * (rng.random(size=n) - 0.5))

    def pdf(self, x):
        return self._dist.pdf(x)

    def cdf(self, x):
        return self._dist.cdf(x)

    def mean(self):
        return float('nan')

    def variance(self):
        return float('nan')

    def cf(self, t):
        return np.exp(1j * self.x0 * t - self.gamma * np.abs(t))


# ---------------------------------------------------------------------------
# Laplace
# ---------------------------------------------------------------------------

class Laplace:
    def __init__(self, mu=0.0, b=1.0):
        self.mu = mu
        self.b = b
        self._dist = stats.laplace(loc=mu, scale=b)

    def sample(self, rng, n=1):
        return rng.laplace(self.mu, self.b, size=n)

    def pdf(self, x):
        return self._dist.pdf(x)

    def cdf(self, x):
        return self._dist.cdf(x)

    def mean(self):
        return self.mu

    def variance(self):
        return 2 * self.b**2

    def cf(self, t):
        return np.exp(1j * self.mu * t) / (1 + self.b**2 * t**2)


# ---------------------------------------------------------------------------
# LogNormal
# ---------------------------------------------------------------------------

class LogNormal:
    def __init__(self, mu=0.0, sigma=1.0):
        self.mu = mu
        self.sigma = sigma
        self._dist = stats.lognorm(s=sigma, scale=np.exp(mu))

    def sample(self, rng, n=1):
        return rng.lognormal(self.mu, self.sigma, size=n)

    def pdf(self, x):
        return self._dist.pdf(x)

    def cdf(self, x):
        return self._dist.cdf(x)

    def mean(self):
        return np.exp(self.mu + self.sigma**2 / 2)

    def variance(self):
        return (np.exp(self.sigma**2) - 1) * np.exp(2 * self.mu + self.sigma**2)

    def cf(self, t):
        # No closed-form; numerical integration
        from scipy.integrate import quad
        def integrand_re(x):
            return self.pdf(x) * np.cos(t * x)
        def integrand_im(x):
            return self.pdf(x) * np.sin(t * x)
        re, _ = quad(integrand_re, 0, np.inf, limit=200)
        im, _ = quad(integrand_im, 0, np.inf, limit=200)
        return re + 1j * im


# ---------------------------------------------------------------------------
# Chi-Squared
# ---------------------------------------------------------------------------

class ChiSquared:
    def __init__(self, k=1):
        self.k = k
        self._dist = stats.chi2(df=k)

    def sample(self, rng, n=1):
        return rng.chisquare(self.k, size=n)

    def pdf(self, x):
        return self._dist.pdf(x)

    def cdf(self, x):
        return self._dist.cdf(x)

    def mean(self):
        return float(self.k)

    def variance(self):
        return 2.0 * self.k

    def cf(self, t):
        return (1 - 2j * t) ** (-self.k / 2)


# ---------------------------------------------------------------------------
# Student's t
# ---------------------------------------------------------------------------

class StudentT:
    def __init__(self, nu=1):
        self.nu = nu
        self._dist = stats.t(df=nu)

    def sample(self, rng, n=1):
        return rng.standard_t(self.nu, size=n)

    def pdf(self, x):
        return self._dist.pdf(x)

    def cdf(self, x):
        return self._dist.cdf(x)

    def mean(self):
        return 0.0 if self.nu > 1 else float('nan')

    def variance(self):
        if self.nu <= 1:
            return float('nan')
        if self.nu <= 2:
            return float('inf')
        return self.nu / (self.nu - 2)

    def cf(self, t):
        return self._dist.cf(t) if hasattr(self._dist, 'cf') else _student_t_cf(self.nu, t)


def _student_t_cf(nu, t):
    """Numerical CF for Student-t via modified Bessel function."""
    if np.abs(t) < 1e-14:
        return 1.0 + 0j
    at = np.abs(t)
    s = np.sqrt(nu) * at
    log_val = (np.log(2) + (nu / 2) * np.log(s) - special.gammaln(nu / 2)
               - (nu / 2 - 1) * np.log(2) + np.log(special.kv(nu / 2, s)))
    return np.exp(log_val) + 0j


# ---------------------------------------------------------------------------
# Convenience registry
# ---------------------------------------------------------------------------

DISTRIBUTIONS = {
    'normal': Normal,
    'uniform': Uniform,
    'exponential': Exponential,
    'poisson': Poisson,
    'binomial': Binomial,
    'beta': Beta,
    'gamma': GammaDist,
    'geometric': Geometric,
    'cauchy': Cauchy,
    'laplace': Laplace,
    'lognormal': LogNormal,
    'chi_squared': ChiSquared,
    'student_t': StudentT,
}
