/**
 * Seedable PRNG using xoshiro128** algorithm.
 *
 * Provides reproducible pseudo-random numbers from a 32-bit seed,
 * suitable for educational simulations where repeatability matters.
 */

/**
 * Splitmix32 - used to expand a single 32-bit seed into the four
 * 32-bit words needed by xoshiro128**.
 */
function splitmix32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x9e3779b9) | 0;
    let t = seed ^ (seed >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    t ^= t >>> 15;
    return t >>> 0;
  };
}

export class SeedablePRNG {
  /** @param {number} seed - 32-bit integer seed */
  constructor(seed = Date.now()) {
    this.seed(seed);
    // Stash for Box-Muller spare value
    this._hasSpare = false;
    this._spare = 0;
  }

  /**
   * Re-seed the generator, resetting all internal state.
   * @param {number} s
   */
  seed(s) {
    const sm = splitmix32(s >>> 0);
    this._s = new Uint32Array([sm(), sm(), sm(), sm()]);
    this._hasSpare = false;
    this._spare = 0;
  }

  /**
   * Core xoshiro128** generator.
   * @returns {number} unsigned 32-bit integer
   */
  _next() {
    const s = this._s;
    const result = Math.imul(rotl(Math.imul(s[1], 5), 7), 9) >>> 0;

    const t = s[1] << 9;

    s[2] ^= s[0];
    s[3] ^= s[1];
    s[1] ^= s[2];
    s[0] ^= s[3];

    s[2] ^= t;
    s[3] = rotl(s[3], 11) >>> 0;

    return result;
  }

  /**
   * Returns a float uniformly distributed in [0, 1).
   * @returns {number}
   */
  random() {
    return (this._next() >>> 0) / 0x100000000;
  }

  /**
   * Returns a normally distributed float using the Box-Muller transform.
   * @param {number} mu    - mean (default 0)
   * @param {number} sigma - standard deviation (default 1)
   * @returns {number}
   */
  randomNormal(mu = 0, sigma = 1) {
    if (this._hasSpare) {
      this._hasSpare = false;
      return mu + sigma * this._spare;
    }

    let u, v, s;
    do {
      u = 2.0 * this.random() - 1.0;
      v = 2.0 * this.random() - 1.0;
      s = u * u + v * v;
    } while (s >= 1.0 || s === 0.0);

    const factor = Math.sqrt((-2.0 * Math.log(s)) / s);
    this._spare = v * factor;
    this._hasSpare = true;

    return mu + sigma * u * factor;
  }

  /**
   * Returns a random integer in [min, max] (inclusive on both ends).
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  randomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return min + Math.floor(this.random() * (max - min + 1));
  }
}

/** 32-bit left rotate */
function rotl(x, k) {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** Default shared instance seeded from the current time */
const defaultPRNG = new SeedablePRNG();

export default defaultPRNG;
