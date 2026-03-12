/**
 * Statistics library - seedable PRNG and probability distributions.
 *
 * Usage:
 *   import { SeedablePRNG, Normal, Gamma } from '../shared/stats';
 *   const rng = new SeedablePRNG(42);
 *   const dist = new Normal(0, 1);
 *   dist.sample(rng);  // reproducible draw
 */

export { default as defaultPRNG, SeedablePRNG } from './prng.js';

export {
  Normal,
  Uniform,
  Exponential,
  Poisson,
  Binomial,
  Beta,
  Gamma,
  Cauchy,
  Pareto,
  StudentT,
  ChiSquared,
} from './distributions.js';
