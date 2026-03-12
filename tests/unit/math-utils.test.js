import { describe, it, expect } from 'vitest';
import {
  lnGamma,
  lnFactorial,
  characteristicFunctions as cf,
  normalPdf,
  mulberry32,
} from '../../src/lib/math-utils.js';

describe('lnGamma', () => {
  it('Γ(1) = 0! = 1, so lnGamma(1) ≈ 0', () => {
    expect(lnGamma(1)).toBeCloseTo(0, 10);
  });

  it('Γ(2) = 1! = 1, so lnGamma(2) ≈ 0', () => {
    expect(lnGamma(2)).toBeCloseTo(0, 10);
  });

  it('Γ(5) = 4! = 24', () => {
    expect(Math.exp(lnGamma(5))).toBeCloseTo(24, 6);
  });

  it('Γ(0.5) = √π', () => {
    expect(Math.exp(lnGamma(0.5))).toBeCloseTo(Math.sqrt(Math.PI), 6);
  });

  it('Γ(10) = 9! = 362880', () => {
    expect(Math.exp(lnGamma(10))).toBeCloseTo(362880, 0);
  });
});

describe('lnFactorial', () => {
  it('0! = 1', () => {
    expect(lnFactorial(0)).toBe(0);
  });

  it('1! = 1', () => {
    expect(lnFactorial(1)).toBe(0);
  });

  it('5! = 120', () => {
    expect(Math.exp(lnFactorial(5))).toBeCloseTo(120, 6);
  });

  it('10! = 3628800', () => {
    expect(Math.exp(lnFactorial(10))).toBeCloseTo(3628800, 0);
  });
});

describe('characteristic functions', () => {
  // Property: φ(0) = 1 for all distributions
  describe('φ(0) = 1 for all distributions', () => {
    it('normal', () => {
      const [re, im] = cf.normal(0, 0, 1);
      expect(re).toBeCloseTo(1);
      expect(im).toBeCloseTo(0);
    });

    it('uniform', () => {
      const [re, im] = cf.uniform(0, -1, 1);
      expect(re).toBeCloseTo(1);
      expect(im).toBeCloseTo(0);
    });

    it('exponential', () => {
      const [re, im] = cf.exponential(0, 1);
      expect(re).toBeCloseTo(1);
      expect(im).toBeCloseTo(0);
    });

    it('poisson', () => {
      const [re, im] = cf.poisson(0, 3);
      expect(re).toBeCloseTo(1);
      expect(im).toBeCloseTo(0);
    });

    it('cauchy', () => {
      const [re, im] = cf.cauchy(0);
      expect(re).toBeCloseTo(1);
      expect(im).toBeCloseTo(0);
    });

    it('bernoulli', () => {
      const [re, im] = cf.bernoulli(0, 0.5);
      expect(re).toBeCloseTo(1);
      expect(im).toBeCloseTo(0);
    });
  });

  // Property: |φ(t)| ≤ 1 for all t
  describe('|φ(t)| ≤ 1 for all t', () => {
    const testValues = [-10, -1, -0.1, 0.1, 1, 5, 10];

    it('normal CF modulus ≤ 1', () => {
      for (const t of testValues) {
        const [re, im] = cf.normal(t, 0, 1);
        expect(re * re + im * im).toBeLessThanOrEqual(1 + 1e-10);
      }
    });

    it('exponential CF modulus ≤ 1', () => {
      for (const t of testValues) {
        const [re, im] = cf.exponential(t, 1);
        expect(re * re + im * im).toBeLessThanOrEqual(1 + 1e-10);
      }
    });

    it('poisson CF modulus ≤ 1', () => {
      for (const t of testValues) {
        const [re, im] = cf.poisson(t, 3);
        expect(re * re + im * im).toBeLessThanOrEqual(1 + 1e-10);
      }
    });

    it('cauchy CF modulus ≤ 1', () => {
      for (const t of testValues) {
        const [re, im] = cf.cauchy(t);
        expect(re * re + im * im).toBeLessThanOrEqual(1 + 1e-10);
      }
    });
  });

  // Specific known values
  describe('known values', () => {
    it('Normal(0,1) CF at t=1 → e^{-1/2}', () => {
      const [re, im] = cf.normal(1, 0, 1);
      expect(re).toBeCloseTo(Math.exp(-0.5), 10);
      expect(im).toBeCloseTo(0, 10);
    });

    it('Cauchy CF at t=1 → e^{-1}', () => {
      const [re, im] = cf.cauchy(1);
      expect(re).toBeCloseTo(Math.exp(-1), 10);
      expect(im).toBeCloseTo(0, 10);
    });

    it('Bernoulli(0.5) CF is symmetric: φ(t) = φ(-t)*', () => {
      const [re1, im1] = cf.bernoulli(1, 0.5);
      const [re2, im2] = cf.bernoulli(-1, 0.5);
      expect(re1).toBeCloseTo(re2, 10);
      expect(im1).toBeCloseTo(-im2, 10);
    });

    it('Exponential(1) CF at t=1 → (1+i)/2', () => {
      const [re, im] = cf.exponential(1, 1);
      expect(re).toBeCloseTo(0.5, 10);
      expect(im).toBeCloseTo(0.5, 10);
    });
  });

  // Property: symmetric real distributions have real CFs
  describe('symmetric distributions have real-valued CFs', () => {
    it('Normal(0, σ) CF is real for all t', () => {
      for (const t of [-5, -1, 0, 1, 5]) {
        const [, im] = cf.normal(t, 0, 2);
        expect(im).toBeCloseTo(0, 10);
      }
    });

    it('Cauchy CF is always real', () => {
      for (const t of [-5, -1, 0, 1, 5]) {
        const [, im] = cf.cauchy(t);
        expect(im).toBeCloseTo(0, 10);
      }
    });
  });
});

describe('normalPdf', () => {
  it('standard normal peak at x=0 is 1/√(2π)', () => {
    expect(normalPdf(0)).toBeCloseTo(1 / Math.sqrt(2 * Math.PI), 10);
  });

  it('symmetric about mean', () => {
    expect(normalPdf(1, 0, 1)).toBeCloseTo(normalPdf(-1, 0, 1), 10);
  });

  it('integrates approximately to 1 (trapezoidal)', () => {
    let sum = 0;
    const dx = 0.01;
    for (let x = -6; x <= 6; x += dx) {
      sum += normalPdf(x) * dx;
    }
    expect(sum).toBeCloseTo(1, 2);
  });

  it('respects custom mean and sigma', () => {
    expect(normalPdf(5, 5, 2)).toBeCloseTo(1 / (2 * Math.sqrt(2 * Math.PI)), 10);
  });
});

describe('mulberry32 PRNG', () => {
  it('produces deterministic output for same seed', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('different seeds produce different sequences', () => {
    const rng1 = mulberry32(1);
    const rng2 = mulberry32(2);
    let same = 0;
    for (let i = 0; i < 100; i++) {
      if (rng1() === rng2()) same++;
    }
    expect(same).toBeLessThan(5);
  });
});
