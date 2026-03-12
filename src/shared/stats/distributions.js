/**
 * Probability distribution classes for the education platform.
 *
 * Every distribution exposes a uniform interface:
 *   sample(rng)        - draw one variate (rng must have .random() and .randomNormal())
 *   pdf(x) / pmf(x)   - density / mass at x
 *   cdf(x)             - cumulative distribution function
 *   mean()             - expected value
 *   variance()         - variance
 *   cf(t)              - characteristic function, returns {re, im}
 */

import jStat from 'jstat';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Lanczos-based log-gamma (used where jStat is overkill). */
const lnGamma = (x) => jStat.gammaln(x);

/** Regularised lower incomplete gamma P(a,x). */
const gammaPLower = (a, x) => jStat.lowRegGamma(a, x);

/** Regularised incomplete beta I_x(a,b). */
const incompleteBeta = (x, a, b) => jStat.ibeta(x, a, b);

/** Beta function B(a,b). */
const betaFn = (a, b) => Math.exp(lnGamma(a) + lnGamma(b) - lnGamma(a + b));

/** Factorial (small n only, used by Poisson / Binomial). */
function lnFactorial(n) {
  return lnGamma(n + 1);
}

/** Binomial coefficient ln(C(n,k)). */
function lnBinom(n, k) {
  return lnFactorial(n) - lnFactorial(k) - lnFactorial(n - k);
}

// ---------------------------------------------------------------------------
// Normal
// ---------------------------------------------------------------------------

export class Normal {
  constructor(mu = 0, sigma = 1) {
    this.mu = mu;
    this.sigma = sigma;
  }

  sample(rng) {
    return rng.randomNormal(this.mu, this.sigma);
  }

  pdf(x) {
    const z = (x - this.mu) / this.sigma;
    return Math.exp(-0.5 * z * z) / (this.sigma * Math.sqrt(2 * Math.PI));
  }

  cdf(x) {
    return 0.5 * (1 + jStat.erf((x - this.mu) / (this.sigma * Math.SQRT2)));
  }

  mean() {
    return this.mu;
  }

  variance() {
    return this.sigma * this.sigma;
  }

  cf(t) {
    // exp(i*mu*t - sigma^2*t^2/2)
    const phase = this.mu * t;
    const decay = Math.exp(-0.5 * this.sigma * this.sigma * t * t);
    return { re: decay * Math.cos(phase), im: decay * Math.sin(phase) };
  }
}

// ---------------------------------------------------------------------------
// Uniform
// ---------------------------------------------------------------------------

export class Uniform {
  constructor(a = 0, b = 1) {
    this.a = a;
    this.b = b;
  }

  sample(rng) {
    return this.a + rng.random() * (this.b - this.a);
  }

  pdf(x) {
    return x >= this.a && x <= this.b ? 1 / (this.b - this.a) : 0;
  }

  cdf(x) {
    if (x < this.a) return 0;
    if (x > this.b) return 1;
    return (x - this.a) / (this.b - this.a);
  }

  mean() {
    return (this.a + this.b) / 2;
  }

  variance() {
    const d = this.b - this.a;
    return (d * d) / 12;
  }

  cf(t) {
    // (exp(i*b*t) - exp(i*a*t)) / (i*(b-a)*t)
    if (Math.abs(t) < 1e-12) return { re: 1, im: 0 };
    const d = this.b - this.a;
    const rNum = Math.sin(this.b * t) - Math.sin(this.a * t);
    const iNum = -(Math.cos(this.b * t) - Math.cos(this.a * t));
    const denom = d * t;
    return { re: rNum / denom, im: iNum / denom };
  }
}

// ---------------------------------------------------------------------------
// Exponential
// ---------------------------------------------------------------------------

export class Exponential {
  constructor(lambda = 1) {
    this.lambda = lambda;
  }

  sample(rng) {
    return -Math.log(1 - rng.random()) / this.lambda;
  }

  pdf(x) {
    return x < 0 ? 0 : this.lambda * Math.exp(-this.lambda * x);
  }

  cdf(x) {
    return x < 0 ? 0 : 1 - Math.exp(-this.lambda * x);
  }

  mean() {
    return 1 / this.lambda;
  }

  variance() {
    return 1 / (this.lambda * this.lambda);
  }

  cf(t) {
    // lambda / (lambda - i*t)
    const lam = this.lambda;
    const denom = lam * lam + t * t;
    return { re: (lam * lam) / denom, im: (lam * t) / denom };
  }
}

// ---------------------------------------------------------------------------
// Poisson (discrete)
// ---------------------------------------------------------------------------

export class Poisson {
  constructor(lambda = 1) {
    this.lambda = lambda;
  }

  /** Knuth algorithm for small lambda, rejection for large. */
  sample(rng) {
    if (this.lambda < 30) {
      const L = Math.exp(-this.lambda);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= rng.random();
      } while (p > L);
      return k - 1;
    }
    // For large lambda use normal approximation rounded to integer
    const x = rng.randomNormal(this.lambda, Math.sqrt(this.lambda));
    return Math.max(0, Math.round(x));
  }

  pmf(x) {
    const k = Math.round(x);
    if (k < 0) return 0;
    return Math.exp(k * Math.log(this.lambda) - this.lambda - lnFactorial(k));
  }

  /** Alias so callers using pdf() still work. */
  pdf(x) {
    return this.pmf(x);
  }

  cdf(x) {
    if (x < 0) return 0;
    const k = Math.floor(x);
    // CDF = 1 - P(k+1, lambda)  where P is the regularised lower gamma
    return 1 - gammaPLower(k + 1, this.lambda);
  }

  mean() {
    return this.lambda;
  }

  variance() {
    return this.lambda;
  }

  cf(t) {
    // exp(lambda * (exp(i*t) - 1))
    const cosT = Math.cos(t);
    const sinT = Math.sin(t);
    const rePart = this.lambda * (cosT - 1);
    const imPart = this.lambda * sinT;
    const mag = Math.exp(rePart);
    return { re: mag * Math.cos(imPart), im: mag * Math.sin(imPart) };
  }
}

// ---------------------------------------------------------------------------
// Binomial
// ---------------------------------------------------------------------------

export class Binomial {
  constructor(n = 1, p = 0.5) {
    this.n = n;
    this.p = p;
  }

  sample(rng) {
    let successes = 0;
    for (let i = 0; i < this.n; i++) {
      if (rng.random() < this.p) successes++;
    }
    return successes;
  }

  pmf(k) {
    k = Math.round(k);
    if (k < 0 || k > this.n) return 0;
    return Math.exp(
      lnBinom(this.n, k) +
        k * Math.log(this.p) +
        (this.n - k) * Math.log(1 - this.p),
    );
  }

  pdf(k) {
    return this.pmf(k);
  }

  cdf(x) {
    const k = Math.floor(x);
    if (k < 0) return 0;
    if (k >= this.n) return 1;
    // I_{1-p}(n-k, k+1)
    return incompleteBeta(1 - this.p, this.n - k, k + 1);
  }

  mean() {
    return this.n * this.p;
  }

  variance() {
    return this.n * this.p * (1 - this.p);
  }

  cf(t) {
    // (1 - p + p*exp(i*t))^n
    const cosT = Math.cos(t);
    const sinT = Math.sin(t);
    const re0 = 1 - this.p + this.p * cosT;
    const im0 = this.p * sinT;
    // Complex power via polar form
    const r = Math.sqrt(re0 * re0 + im0 * im0);
    const theta = Math.atan2(im0, re0);
    const rn = Math.pow(r, this.n);
    return { re: rn * Math.cos(this.n * theta), im: rn * Math.sin(this.n * theta) };
  }
}

// ---------------------------------------------------------------------------
// Beta
// ---------------------------------------------------------------------------

export class Beta {
  constructor(alpha = 1, beta = 1) {
    this.alpha = alpha;
    this.beta = beta;
  }

  /** Sample via two Gamma variates: X~Gamma(a), Y~Gamma(b) => X/(X+Y)~Beta(a,b). */
  sample(rng) {
    const gammaA = new Gamma(this.alpha, 1);
    const gammaB = new Gamma(this.beta, 1);
    const x = gammaA.sample(rng);
    const y = gammaB.sample(rng);
    return x / (x + y);
  }

  pdf(x) {
    if (x < 0 || x > 1) return 0;
    if (x === 0) {
      if (this.alpha < 1) return Infinity;
      if (this.alpha === 1) return 1 / betaFn(this.alpha, this.beta);
      return 0;
    }
    if (x === 1) {
      if (this.beta < 1) return Infinity;
      if (this.beta === 1) return 1 / betaFn(this.alpha, this.beta);
      return 0;
    }
    return (
      Math.exp(
        (this.alpha - 1) * Math.log(x) +
          (this.beta - 1) * Math.log(1 - x) -
          lnGamma(this.alpha) -
          lnGamma(this.beta) +
          lnGamma(this.alpha + this.beta),
      )
    );
  }

  cdf(x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return incompleteBeta(x, this.alpha, this.beta);
  }

  mean() {
    return this.alpha / (this.alpha + this.beta);
  }

  variance() {
    const ab = this.alpha + this.beta;
    return (this.alpha * this.beta) / (ab * ab * (ab + 1));
  }

  cf(t) {
    // 1F1(alpha; alpha+beta; i*t)  -  compute via series expansion
    return confluent1F1(this.alpha, this.alpha + this.beta, t);
  }
}

/**
 * Kummer's confluent hypergeometric 1F1(a; b; i*t) computed via series.
 * Returns {re, im}.
 */
function confluent1F1(a, b, t) {
  let re = 1;
  let im = 0;
  let termRe = 1;
  let termIm = 0;
  for (let n = 1; n <= 300; n++) {
    const factor = a + n - 1;
    const denom = (b + n - 1) * n;
    // Multiply term by (i*t * factor / denom)
    // (termRe + i*termIm) * (i*t*factor/denom)
    const c = (t * factor) / denom;
    const newRe = -termIm * c;
    const newIm = termRe * c;
    termRe = newRe;
    termIm = newIm;
    re += termRe;
    im += termIm;
    if (Math.abs(termRe) + Math.abs(termIm) < 1e-15 * (Math.abs(re) + Math.abs(im))) {
      break;
    }
  }
  return { re, im };
}

// ---------------------------------------------------------------------------
// Gamma
// ---------------------------------------------------------------------------

export class Gamma {
  /**
   * @param {number} alpha - shape (k)
   * @param {number} beta  - rate (1/theta)
   */
  constructor(alpha = 1, beta = 1) {
    this.alpha = alpha;
    this.beta = beta;
  }

  /**
   * Marsaglia & Tsang's method for alpha >= 1.
   * For alpha < 1 use Ahrens-Dieter: Gamma(a) = Gamma(a+1)*U^(1/a).
   */
  sample(rng) {
    let a = this.alpha;
    let boost = 1;
    if (a < 1) {
      boost = Math.pow(rng.random(), 1 / a);
      a = a + 1;
    }

    const d = a - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);

    for (;;) {
      let x, v;
      do {
        x = rng.randomNormal();
        v = 1 + c * x;
      } while (v <= 0);

      v = v * v * v;
      const u = rng.random();
      const x2 = x * x;

      if (u < 1 - 0.0331 * x2 * x2) {
        return (d * v * boost) / this.beta;
      }
      if (Math.log(u) < 0.5 * x2 + d * (1 - v + Math.log(v))) {
        return (d * v * boost) / this.beta;
      }
    }
  }

  pdf(x) {
    if (x < 0) return 0;
    if (x === 0) {
      if (this.alpha < 1) return Infinity;
      if (this.alpha === 1) return this.beta;
      return 0;
    }
    return Math.exp(
      this.alpha * Math.log(this.beta) +
        (this.alpha - 1) * Math.log(x) -
        this.beta * x -
        lnGamma(this.alpha),
    );
  }

  cdf(x) {
    if (x <= 0) return 0;
    return gammaPLower(this.alpha, this.beta * x);
  }

  mean() {
    return this.alpha / this.beta;
  }

  variance() {
    return this.alpha / (this.beta * this.beta);
  }

  cf(t) {
    // (beta / (beta - i*t))^alpha
    const b = this.beta;
    const r2 = b * b + t * t;
    const r = Math.sqrt(r2);
    const theta = Math.atan2(t, b); // angle of (beta - i*t) is -theta, so angle of 1/(beta-it) is +theta
    const rPow = Math.pow(b / r, this.alpha); // |beta/(beta - it)|^alpha = (b/r)^alpha
    // wait: beta/(beta - it). Let w = beta - it = b - it, |w| = r, arg(w) = -atan2(t,b)
    // beta/w has magnitude b/r, angle +atan2(t,b)
    // Raise to alpha:
    const mag = Math.pow(b / r, this.alpha);
    const phase = this.alpha * theta;
    return { re: mag * Math.cos(phase), im: mag * Math.sin(phase) };
  }
}

// ---------------------------------------------------------------------------
// Cauchy
// ---------------------------------------------------------------------------

export class Cauchy {
  constructor(x0 = 0, gamma = 1) {
    this.x0 = x0;
    this.gamma = gamma;
  }

  sample(rng) {
    // Inverse CDF: x0 + gamma * tan(pi*(U - 0.5))
    return this.x0 + this.gamma * Math.tan(Math.PI * (rng.random() - 0.5));
  }

  pdf(x) {
    const d = x - this.x0;
    return (
      1 /
      (Math.PI * this.gamma * (1 + (d * d) / (this.gamma * this.gamma)))
    );
  }

  cdf(x) {
    return 0.5 + Math.atan((x - this.x0) / this.gamma) / Math.PI;
  }

  mean() {
    return NaN; // undefined
  }

  variance() {
    return NaN; // undefined
  }

  cf(t) {
    // exp(i*x0*t - gamma*|t|)
    const decay = Math.exp(-this.gamma * Math.abs(t));
    const phase = this.x0 * t;
    return { re: decay * Math.cos(phase), im: decay * Math.sin(phase) };
  }
}

// ---------------------------------------------------------------------------
// Pareto
// ---------------------------------------------------------------------------

export class Pareto {
  constructor(alpha = 1, xm = 1) {
    this.alpha = alpha;
    this.xm = xm;
  }

  sample(rng) {
    // Inverse CDF: xm / U^(1/alpha)
    return this.xm / Math.pow(rng.random(), 1 / this.alpha);
  }

  pdf(x) {
    if (x < this.xm) return 0;
    return (
      (this.alpha * Math.pow(this.xm, this.alpha)) /
      Math.pow(x, this.alpha + 1)
    );
  }

  cdf(x) {
    if (x < this.xm) return 0;
    return 1 - Math.pow(this.xm / x, this.alpha);
  }

  mean() {
    if (this.alpha <= 1) return Infinity;
    return (this.alpha * this.xm) / (this.alpha - 1);
  }

  variance() {
    if (this.alpha <= 2) return Infinity;
    const a = this.alpha;
    return (this.xm * this.xm * a) / ((a - 1) * (a - 1) * (a - 2));
  }

  cf(t) {
    // alpha * (-i*xm*t)^alpha * Gamma(-alpha, -i*xm*t)
    // No nice closed form; use the integral representation approximation
    // For educational purposes we compute numerically via series for small |t|
    // cf(t) = alpha * E_alpha(i*xm*t) where we use direct numerical quadrature
    // is complex. We'll use the representation:
    // cf(t) = alpha * (-i*xm*t)^alpha * upperIncGamma(-alpha, -i*xm*t)
    // For practical purposes, use numerical approach via partial sums.
    // We approximate using the known formula for integer-like alpha or
    // fall back to numerical integration.
    return paretoCF(this.alpha, this.xm, t);
  }
}

/**
 * Numerical CF for Pareto via direct integration of exp(i*t*x) * pdf(x).
 * Uses adaptive Simpson on [xm, cutoff].
 */
function paretoCF(alpha, xm, t) {
  if (Math.abs(t) < 1e-14) return { re: 1, im: 0 };

  // Integration limits: integrate f(x)*exp(itx) from xm to large cutoff
  // The pdf decays as x^{-(alpha+1)}, so we pick cutoff where pdf < eps
  const eps = 1e-10;
  const cutoff = xm * Math.pow(eps, -1 / (alpha + 1));
  const maxCutoff = xm + 1e6; // safety cap
  const upper = Math.min(cutoff, maxCutoff);

  // Simpson's rule with enough points
  const n = 2000; // must be even
  const h = (upper - xm) / n;
  let reSum = 0;
  let imSum = 0;

  for (let i = 0; i <= n; i++) {
    const x = xm + i * h;
    const fx = (alpha * Math.pow(xm, alpha)) / Math.pow(x, alpha + 1);
    const phase = t * x;
    const w = i === 0 || i === n ? 1 : i % 2 === 1 ? 4 : 2;
    reSum += w * fx * Math.cos(phase);
    imSum += w * fx * Math.sin(phase);
  }

  return { re: (reSum * h) / 3, im: (imSum * h) / 3 };
}

// ---------------------------------------------------------------------------
// Student's t
// ---------------------------------------------------------------------------

export class StudentT {
  constructor(nu = 1) {
    this.nu = nu;
  }

  /** Sample via ratio of Normal and Chi-squared. */
  sample(rng) {
    const z = rng.randomNormal();
    const chi2 = new ChiSquared(this.nu);
    const v = chi2.sample(rng);
    return z / Math.sqrt(v / this.nu);
  }

  pdf(x) {
    const nu = this.nu;
    return (
      Math.exp(
        lnGamma((nu + 1) / 2) -
          lnGamma(nu / 2) -
          0.5 * Math.log(nu * Math.PI) -
          ((nu + 1) / 2) * Math.log(1 + (x * x) / nu),
      )
    );
  }

  cdf(x) {
    const nu = this.nu;
    const t2 = x * x;
    const ib = incompleteBeta(nu / (nu + t2), nu / 2, 0.5);
    return x >= 0 ? 1 - 0.5 * ib : 0.5 * ib;
  }

  mean() {
    return this.nu > 1 ? 0 : NaN;
  }

  variance() {
    if (this.nu <= 1) return NaN;
    if (this.nu <= 2) return Infinity;
    return this.nu / (this.nu - 2);
  }

  cf(t) {
    // |t|^{nu/2} * K_{nu/2}(sqrt(nu)*|t|) * 2^{1-nu/2} / Gamma(nu/2)
    // where K is the modified Bessel function of the second kind.
    // Compute numerically via integration for practical use.
    return studentTCF(this.nu, t);
  }
}

/**
 * Numerical CF for Student-t via direct integration.
 */
function studentTCF(nu, t) {
  if (Math.abs(t) < 1e-14) return { re: 1, im: 0 };

  // Integrate exp(i*t*x) * pdf(x) over [-R, R] with Simpson's rule
  // pdf is symmetric, so re = 2*integral_0^R pdf(x)*cos(tx) dx, im = 0 (symmetric dist)
  // Actually im = 0 for symmetric distributions centered at 0.
  const R = 100 * Math.sqrt(nu > 2 ? nu / (nu - 2) : 10); // ~100 std devs
  const n = 4000;
  const h = R / n;
  const logCoeff =
    lnGamma((nu + 1) / 2) - lnGamma(nu / 2) - 0.5 * Math.log(nu * Math.PI);

  let reSum = 0;
  // f(0) * cos(0) = f(0)
  const f0 = Math.exp(logCoeff);
  reSum += f0; // weight 1 at i=0

  for (let i = 1; i <= n; i++) {
    const x = i * h;
    const fx = Math.exp(logCoeff - ((nu + 1) / 2) * Math.log(1 + (x * x) / nu));
    const w = i === n ? 1 : i % 2 === 1 ? 4 : 2;
    reSum += w * fx * Math.cos(t * x);
  }

  // Multiply by 2 (symmetry) and subtract the double-counted f(0) term
  // Actually: integral from -R to R = 2 * integral from 0 to R for even part
  // But Simpson from 0 to R gives integral of pdf(x)*cos(tx) from 0 to R
  // Full integral = pdf(0)*cos(0) [at x=0, counted once] + 2*sum for x>0
  // Let me just do it properly with Simpson from -R to R.
  // Re-do cleanly:
  reSum = 0;
  let imSum = 0;
  const n2 = 4000; // even
  const h2 = (2 * R) / n2;
  for (let i = 0; i <= n2; i++) {
    const x = -R + i * h2;
    const fx = Math.exp(logCoeff - ((nu + 1) / 2) * Math.log(1 + (x * x) / nu));
    const phase = t * x;
    const w = i === 0 || i === n2 ? 1 : i % 2 === 1 ? 4 : 2;
    reSum += w * fx * Math.cos(phase);
    imSum += w * fx * Math.sin(phase);
  }

  return { re: (reSum * h2) / 3, im: (imSum * h2) / 3 };
}

// ---------------------------------------------------------------------------
// Chi-Squared
// ---------------------------------------------------------------------------

export class ChiSquared {
  constructor(k = 1) {
    this.k = k;
  }

  /** Chi-squared(k) = Gamma(k/2, 1/2) where 1/2 is the rate. */
  sample(rng) {
    const g = new Gamma(this.k / 2, 0.5);
    return g.sample(rng);
  }

  pdf(x) {
    if (x < 0) return 0;
    if (x === 0) {
      if (this.k < 2) return Infinity;
      if (this.k === 2) return 0.5;
      return 0;
    }
    const k2 = this.k / 2;
    return Math.exp(
      (k2 - 1) * Math.log(x) - x / 2 - k2 * Math.LN2 - lnGamma(k2),
    );
  }

  cdf(x) {
    if (x <= 0) return 0;
    return gammaPLower(this.k / 2, x / 2);
  }

  mean() {
    return this.k;
  }

  variance() {
    return 2 * this.k;
  }

  cf(t) {
    // (1 - 2*i*t)^{-k/2}
    const k2 = this.k / 2;
    const r2 = 1 + 4 * t * t; // |1 - 2it|^2
    const r = Math.sqrt(r2);
    const theta = Math.atan2(-2 * t, 1); // arg(1 - 2it)
    const mag = Math.pow(r, -k2);
    const phase = -k2 * theta;
    return { re: mag * Math.cos(phase), im: mag * Math.sin(phase) };
  }
}
