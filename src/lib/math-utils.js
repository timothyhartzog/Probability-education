/**
 * Shared math utility functions used across visualization modules.
 * Extracted here so they can be unit-tested and reused.
 */

/**
 * Log-gamma function via Lanczos approximation.
 * @param {number} z
 * @returns {number} ln(Γ(z))
 */
export function lnGamma(z) {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Log-factorial via log-gamma.
 * @param {number} n - non-negative integer
 * @returns {number} ln(n!)
 */
export function lnFactorial(n) {
  if (n <= 1) return 0;
  return lnGamma(n + 1);
}

/**
 * Characteristic function definitions for common distributions.
 * Each returns [Re(φ(t)), Im(φ(t))].
 */
export const characteristicFunctions = {
  normal(t, mu = 0, sigma = 1) {
    const phase = mu * t;
    const decay = Math.exp(-sigma * sigma * t * t / 2);
    return [decay * Math.cos(phase), decay * Math.sin(phase)];
  },

  uniform(t, a = -1, b = 1) {
    if (Math.abs(t) < 1e-12) return [1, 0];
    const denom = t * (b - a);
    const rNum = Math.cos(t * b) - Math.cos(t * a);
    const iNum = Math.sin(t * b) - Math.sin(t * a);
    return [iNum / denom, -rNum / denom];
  },

  exponential(t, lam = 1) {
    const d = lam * lam + t * t;
    return [lam * lam / d, lam * t / d];
  },

  poisson(t, lam = 3) {
    const rInner = lam * (Math.cos(t) - 1);
    const iInner = lam * Math.sin(t);
    const mag = Math.exp(rInner);
    return [mag * Math.cos(iInner), mag * Math.sin(iInner)];
  },

  cauchy(t) {
    return [Math.exp(-Math.abs(t)), 0];
  },

  bernoulli(t, p = 0.5) {
    return [1 - p + p * Math.cos(t), p * Math.sin(t)];
  },
};

/**
 * Normal PDF.
 */
export function normalPdf(x, mu = 0, sigma = 1) {
  const z = (x - mu) / sigma;
  return Math.exp(-z * z / 2) / (sigma * Math.sqrt(2 * Math.PI));
}

/**
 * Seeded pseudo-random number generator (mulberry32).
 * @param {number} seed
 * @returns {() => number} random function returning [0, 1)
 */
export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
