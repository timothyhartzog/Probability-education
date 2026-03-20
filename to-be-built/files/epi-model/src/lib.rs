/*!
# epi-model: SEIR/SEIRD Epidemic Model — WebAssembly Module

Compartmental infectious disease models for rural healthcare epidemiology.
Implements deterministic ODE integration (RK4) and stochastic simulation
(Gillespie direct method) for use in browser-based educational tools.

## Model Overview

```
S → E → I → R
              ↘ D  (SEIRD only)
```

- **S** Susceptible  
- **E** Exposed (infected, not yet infectious)
- **I** Infectious  
- **R** Recovered / Removed (immune)
- **D** Dead (case-fatality fraction μ)

## Usage (JavaScript/WASM)

```js
import init, { run_seird, herd_immunity_threshold, run_stochastic_seir } from './pkg/epi_model.js';

await init();

const result = run_seird({
    beta: 0.30,   // transmission rate
    sigma: 0.20,  // 1 / latent_period_days
    gamma: 0.10,  // 1 / infectious_period_days
    mu: 0.01,     // case fatality fraction
    n: 12000.0,   // population
}, 365);

console.log(result.r0, result.peak_day, result.final_attack_rate);
```
*/

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

// ─── Parameter and State Types ────────────────────────────────────────────────

/// Parameters for the SEIRD compartmental model.
///
/// All rates are in units of day⁻¹.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeirdParams {
    /// Transmission rate: contacts per day × probability of transmission per contact.
    /// Equivalent to β in the standard SIR formulation.
    pub beta: f64,

    /// Rate of progression from Exposed → Infectious (= 1 / mean latent period in days).
    /// For COVID-19 original strain, σ ≈ 1/5 = 0.20.
    pub sigma: f64,

    /// Recovery rate (= 1 / mean infectious period in days).
    /// For seasonal influenza, γ ≈ 1/5 = 0.20.
    pub gamma: f64,

    /// Case fatality fraction (0–1). Fraction of infectious individuals who die
    /// rather than recover. Note: this is CFR, not IFR.
    pub mu: f64,

    /// Total population size N = S + E + I + R + D.
    pub n: f64,
}

/// State of all compartments at a single time point.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelState {
    pub s: f64,
    pub e: f64,
    pub i: f64,
    pub r: f64,
    pub d: f64,
    pub day: u32,
}

/// Full result returned by `run_seird`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelResult {
    /// One state per day from day 0 to `days` (inclusive).
    pub states: Vec<ModelState>,

    /// Basic reproduction number R₀ = β / γ.
    pub r0: f64,

    /// Maximum value of I(t) over the simulation period.
    pub peak_infected: f64,

    /// Day at which I(t) is maximized.
    pub peak_day: u32,

    /// Fraction of population infected by simulation end: (N − S_final) / N.
    pub final_attack_rate: f64,

    /// Cumulative deaths at simulation end.
    pub total_deaths: f64,
}

// ─── Core RK4 Solver ─────────────────────────────────────────────────────────

/// Single RK4 step for the SEIRD ODE system.
///
/// Returns the updated (S, E, I, R, D) after one step of size `dt` days.
fn rk4_step(s: f64, e: f64, i: f64, r: f64, d: f64, p: &SeirdParams, dt: f64) -> (f64, f64, f64, f64, f64) {
    // Derivatives at (S, E, I)
    let deriv = |ss: f64, ee: f64, ii: f64| -> (f64, f64, f64, f64, f64) {
        let n = p.n;
        let infection = p.beta * ss * ii / n;
        let progression = p.sigma * ee;
        let removal = p.gamma * ii;
        (
            -infection,                         // dS/dt
            infection - progression,            // dE/dt
            progression - removal,              // dI/dt
            removal * (1.0 - p.mu),             // dR/dt
            removal * p.mu,                     // dD/dt
        )
    };

    let (ds1, de1, di1, dr1, dd1) = deriv(s, e, i);
    let (ds2, de2, di2, dr2, dd2) = deriv(
        s + 0.5 * dt * ds1,
        e + 0.5 * dt * de1,
        i + 0.5 * dt * di1,
    );
    let (ds3, de3, di3, dr3, dd3) = deriv(
        s + 0.5 * dt * ds2,
        e + 0.5 * dt * de2,
        i + 0.5 * dt * di2,
    );
    let (ds4, de4, di4, dr4, dd4) = deriv(
        s + dt * ds3,
        e + dt * de3,
        i + dt * di3,
    );

    let sixth = dt / 6.0;
    (
        (s + sixth * (ds1 + 2.0 * ds2 + 2.0 * ds3 + ds4)).max(0.0),
        (e + sixth * (de1 + 2.0 * de2 + 2.0 * de3 + de4)).max(0.0),
        (i + sixth * (di1 + 2.0 * di2 + 2.0 * di3 + di4)).max(0.0),
        (r + sixth * (dr1 + 2.0 * dr2 + 2.0 * dr3 + dr4)).max(0.0),
        (d + sixth * (dd1 + 2.0 * dd2 + 2.0 * dd3 + dd4)).max(0.0),
    )
}

// ─── WASM-Exported Functions ──────────────────────────────────────────────────

/// Run a deterministic SEIRD simulation using 4th-order Runge-Kutta.
///
/// # Arguments
/// * `params_js` - JSON-serialized `SeirdParams`
/// * `days` - simulation horizon in days
///
/// # Returns
/// JSON-serialized `ModelResult` with daily state vectors and summary statistics.
///
/// # Initial Conditions
/// Starts with 1 exposed individual; S₀ = N − 1; E₀ = 1; I₀ = R₀ = D₀ = 0.
#[wasm_bindgen]
pub fn run_seird(params_js: JsValue, days: u32) -> JsValue {
    let params: SeirdParams = serde_wasm_bindgen::from_value(params_js)
        .expect("Invalid SeirdParams");

    let dt = 0.5_f64; // half-day integration steps
    let steps_per_day = (1.0 / dt) as u32;

    let mut s = params.n - 1.0;
    let mut e = 1.0_f64;
    let mut i = 0.0_f64;
    let mut r = 0.0_f64;
    let mut d = 0.0_f64;

    let mut states = Vec::with_capacity((days + 1) as usize);
    states.push(ModelState { s, e, i, r, d, day: 0 });

    let mut peak_infected = 0.0_f64;
    let mut peak_day = 0u32;

    for day in 1..=days {
        for _ in 0..steps_per_day {
            (s, e, i, r, d) = rk4_step(s, e, i, r, d, &params, dt);
        }
        if i > peak_infected {
            peak_infected = i;
            peak_day = day;
        }
        states.push(ModelState { s, e, i, r, d, day });
    }

    let result = ModelResult {
        r0: params.beta / params.gamma,
        peak_infected,
        peak_day,
        final_attack_rate: (params.n - s) / params.n,
        total_deaths: d,
        states,
    };

    serde_wasm_bindgen::to_value(&result).unwrap()
}

/// Run a stochastic SEIR simulation using Gillespie's direct method.
///
/// Appropriate for small rural populations (N < 50,000) where stochastic
/// extinction and demographic noise are epidemiologically significant.
///
/// Returns a Vec<f64> of the I(t) compartment sampled at integer day boundaries.
///
/// Uses a linear congruential generator (LCG) seeded by `seed` — suitable for
/// reproducible WASM-based simulations without external RNG dependencies.
#[wasm_bindgen]
pub fn run_stochastic_seir(params_js: JsValue, days: u32, seed: u32) -> JsValue {
    let params: SeirdParams = serde_wasm_bindgen::from_value(params_js)
        .expect("Invalid SeirdParams");

    // LCG PRNG (Knuth multiplicative)
    let mut rng_state = seed as u64;
    let mut rng = move || -> f64 {
        rng_state = rng_state
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1_442_695_040_888_963_407);
        (rng_state >> 33) as f64 / (u32::MAX as f64)
    };

    let mut s = params.n as u64 - 1;
    let mut e = 1u64;
    let mut i = 0u64;
    let mut r = 0u64;

    let n = params.n;
    let mut t = 0.0_f64;
    let t_end = days as f64;

    // Sample I(t) at each integer day boundary
    let mut daily_i: Vec<f64> = vec![1.0]; // day 0: 1 exposed (not yet I, but seed)
    let mut next_day = 1usize;

    loop {
        // Event rates
        let r1 = params.beta * s as f64 * i as f64 / n; // S → E
        let r2 = params.sigma * e as f64;                // E → I
        let r3 = params.gamma * i as f64;                // I → R
        let r_total = r1 + r2 + r3;

        if r_total < 1e-12 || t >= t_end {
            // Fill remaining days
            while daily_i.len() <= days as usize {
                daily_i.push(i as f64);
            }
            break;
        }

        // Time to next event (exponential waiting time)
        let dt = -(rng().max(1e-15).ln()) / r_total;
        t += dt;

        // Record daily snapshots at integer boundaries
        while next_day as f64 <= t && next_day <= days as usize {
            daily_i.push(i as f64);
            next_day += 1;
        }

        if t >= t_end { break; }

        // Select which event occurred
        let u = rng() * r_total;
        if u < r1 {
            s -= 1; e += 1;          // S → E
        } else if u < r1 + r2 {
            e -= 1; i += 1;          // E → I
        } else {
            i -= 1; r += 1;          // I → R
        }
    }

    // Ensure output length = days + 1
    while daily_i.len() <= days as usize {
        daily_i.push(i as f64);
    }
    daily_i.truncate((days + 1) as usize);

    serde_wasm_bindgen::to_value(&daily_i).unwrap()
}

/// Compute the basic reproduction number R₀ = β / γ.
#[wasm_bindgen]
pub fn compute_r0(beta: f64, gamma: f64) -> f64 {
    if gamma <= 0.0 { return f64::INFINITY; }
    beta / gamma
}

/// Compute the herd immunity threshold HIT = 1 − 1/R₀.
///
/// Returns 0 if R₀ ≤ 1 (epidemic cannot sustain; no threshold required).
#[wasm_bindgen]
pub fn herd_immunity_threshold(r0: f64) -> f64 {
    if r0 <= 1.0 { 0.0 } else { 1.0 - 1.0 / r0 }
}

/// Compute the effective reproduction number Rₑ = R₀ × (S / N).
///
/// When Rₑ < 1, the epidemic is declining even without additional intervention.
#[wasm_bindgen]
pub fn effective_r(r0: f64, susceptible_fraction: f64) -> f64 {
    r0 * susceptible_fraction.max(0.0).min(1.0)
}

// ─── Unit Tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_relative_eq;

    fn test_params() -> SeirdParams {
        SeirdParams { beta: 0.3, sigma: 0.2, gamma: 0.1, mu: 0.01, n: 10_000.0 }
    }

    #[test]
    fn test_r0_calculation() {
        let p = test_params();
        assert_relative_eq!(p.beta / p.gamma, 3.0, epsilon = 1e-10);
    }

    #[test]
    fn test_hit_zero_when_r0_below_one() {
        assert_eq!(herd_immunity_threshold(0.8), 0.0);
        assert_eq!(herd_immunity_threshold(1.0), 0.0);
    }

    #[test]
    fn test_hit_measles() {
        // R₀ = 15 → HIT ≈ 93.3%
        let hit = herd_immunity_threshold(15.0);
        assert_relative_eq!(hit, 14.0 / 15.0, epsilon = 1e-10);
    }

    #[test]
    fn test_rk4_conservation_of_population() {
        let p = test_params();
        let (s, e, i, r, d) = rk4_step(9999.0, 1.0, 0.0, 0.0, 0.0, &p, 0.5);
        let total = s + e + i + r + d;
        assert_relative_eq!(total, p.n, epsilon = 1e-6);
    }

    #[test]
    fn test_epidemic_grows_with_high_r0() {
        // With R₀ = 3, epidemic should peak well above initial infectious count
        let p = test_params();
        let mut s = p.n - 1.0;
        let mut e = 1.0_f64;
        let mut i = 0.0_f64;
        let mut r = 0.0_f64;
        let mut d = 0.0_f64;
        let mut max_i = 0.0_f64;
        for _ in 0..365 {
            for _ in 0..2 { // 2 half-day steps per day
                (s, e, i, r, d) = rk4_step(s, e, i, r, d, &p, 0.5);
            }
            if i > max_i { max_i = i; }
        }
        assert!(max_i > 100.0, "Peak infectious should exceed 100 for R₀=3, N=10000");
        let _ = (s, e, r, d); // suppress warnings
    }

    #[test]
    fn test_epidemic_dies_when_r0_below_one() {
        let p = SeirdParams { beta: 0.05, sigma: 0.2, gamma: 0.1, mu: 0.0, n: 10_000.0 };
        // R₀ = 0.5 → epidemic should extinguish
        let mut s = p.n - 1.0;
        let mut e = 1.0_f64;
        let mut i = 0.0_f64;
        let mut r = 0.0_f64;
        let mut d = 0.0_f64;
        for _ in 0..365 {
            for _ in 0..2 {
                (s, e, i, r, d) = rk4_step(s, e, i, r, d, &p, 0.5);
            }
        }
        assert!(i < 1.0, "Epidemic should be extinct with R₀ = 0.5");
        let _ = (s, e, r, d);
    }

    #[test]
    fn test_effective_r_clamped() {
        assert_eq!(effective_r(3.0, 1.5), 3.0); // clamped to 1.0
        assert_eq!(effective_r(3.0, -0.1), 0.0); // clamped to 0.0
    }
}
