mod advanced;

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

// ============================================================================
// SECTION 1: SIR / SEIR EPIDEMIC MODELS
// Solves compartmental ODE systems using 4th-order Runge-Kutta
// ============================================================================

/// SIR model state: Susceptible, Infected, Recovered
#[derive(Clone, Copy, Serialize, Deserialize)]
struct SirState {
    s: f64,
    i: f64,
    r: f64,
}

/// SEIR model state: Susceptible, Exposed, Infected, Recovered
#[derive(Clone, Copy, Serialize, Deserialize)]
struct SeirState {
    s: f64,
    e: f64,
    i: f64,
    r: f64,
}

/// Full epidemic simulation result for a single time point
#[derive(Serialize)]
struct EpiPoint {
    t: f64,
    s: f64,
    e: f64,
    i: f64,
    r: f64,
    r0_effective: f64,
    daily_new_infections: f64,
    cumulative_infections: f64,
}

/// SIR derivatives: dS/dt = -beta*S*I/N, dI/dt = beta*S*I/N - gamma*I, dR/dt = gamma*I
fn sir_derivatives(state: &SirState, beta: f64, gamma: f64, n: f64) -> (f64, f64, f64) {
    let ds = -beta * state.s * state.i / n;
    let di = beta * state.s * state.i / n - gamma * state.i;
    let dr = gamma * state.i;
    (ds, di, dr)
}

/// SEIR derivatives with latent period sigma = 1/incubation_period
fn seir_derivatives(
    state: &SeirState,
    beta: f64,
    sigma: f64,
    gamma: f64,
    n: f64,
) -> (f64, f64, f64, f64) {
    let ds = -beta * state.s * state.i / n;
    let de = beta * state.s * state.i / n - sigma * state.e;
    let di = sigma * state.e - gamma * state.i;
    let dr = gamma * state.i;
    (ds, de, di, dr)
}

/// 4th-order Runge-Kutta integrator for SIR
fn rk4_sir(state: &SirState, beta: f64, gamma: f64, n: f64, dt: f64) -> SirState {
    let (k1s, k1i, k1r) = sir_derivatives(state, beta, gamma, n);

    let s2 = SirState {
        s: state.s + 0.5 * dt * k1s,
        i: state.i + 0.5 * dt * k1i,
        r: state.r + 0.5 * dt * k1r,
    };
    let (k2s, k2i, k2r) = sir_derivatives(&s2, beta, gamma, n);

    let s3 = SirState {
        s: state.s + 0.5 * dt * k2s,
        i: state.i + 0.5 * dt * k2i,
        r: state.r + 0.5 * dt * k2r,
    };
    let (k3s, k3i, k3r) = sir_derivatives(&s3, beta, gamma, n);

    let s4 = SirState {
        s: state.s + dt * k3s,
        i: state.i + dt * k3i,
        r: state.r + dt * k3r,
    };
    let (k4s, k4i, k4r) = sir_derivatives(&s4, beta, gamma, n);

    SirState {
        s: state.s + (dt / 6.0) * (k1s + 2.0 * k2s + 2.0 * k3s + k4s),
        i: state.i + (dt / 6.0) * (k1i + 2.0 * k2i + 2.0 * k3i + k4i),
        r: state.r + (dt / 6.0) * (k1r + 2.0 * k2r + 2.0 * k3r + k4r),
    }
}

/// 4th-order Runge-Kutta integrator for SEIR
fn rk4_seir(
    state: &SeirState,
    beta: f64,
    sigma: f64,
    gamma: f64,
    n: f64,
    dt: f64,
) -> SeirState {
    let (k1s, k1e, k1i, k1r) = seir_derivatives(state, beta, sigma, gamma, n);

    let s2 = SeirState {
        s: state.s + 0.5 * dt * k1s,
        e: state.e + 0.5 * dt * k1e,
        i: state.i + 0.5 * dt * k1i,
        r: state.r + 0.5 * dt * k1r,
    };
    let (k2s, k2e, k2i, k2r) = seir_derivatives(&s2, beta, sigma, gamma, n);

    let s3 = SeirState {
        s: state.s + 0.5 * dt * k2s,
        e: state.e + 0.5 * dt * k2e,
        i: state.i + 0.5 * dt * k2i,
        r: state.r + 0.5 * dt * k2r,
    };
    let (k3s, k3e, k3i, k3r) = seir_derivatives(&s3, beta, sigma, gamma, n);

    let s4 = SeirState {
        s: state.s + dt * k3s,
        e: state.e + dt * k3e,
        i: state.i + dt * k3i,
        r: state.r + dt * k3r,
    };
    let (k4s, k4e, k4i, k4r) = seir_derivatives(&s4, beta, sigma, gamma, n);

    SeirState {
        s: state.s + (dt / 6.0) * (k1s + 2.0 * k2s + 2.0 * k3s + k4s),
        e: state.e + (dt / 6.0) * (k1e + 2.0 * k2e + 2.0 * k3e + k4e),
        i: state.i + (dt / 6.0) * (k1i + 2.0 * k2i + 2.0 * k3i + k4i),
        r: state.r + (dt / 6.0) * (k1r + 2.0 * k2r + 2.0 * k3r + k4r),
    }
}

/// Run a full SIR simulation, returns JSON array of EpiPoint
#[wasm_bindgen]
pub fn simulate_sir(
    population: f64,
    initial_infected: f64,
    r0: f64,
    infectious_period_days: f64,
    duration_days: f64,
    dt: f64,
) -> String {
    let gamma = 1.0 / infectious_period_days;
    let beta = r0 * gamma;
    let n = population;

    let mut state = SirState {
        s: n - initial_infected,
        i: initial_infected,
        r: 0.0,
    };

    let steps = (duration_days / dt) as usize;
    let mut results: Vec<EpiPoint> = Vec::with_capacity(steps + 1);
    let mut cumulative = initial_infected;
    let mut prev_i = initial_infected;

    results.push(EpiPoint {
        t: 0.0,
        s: state.s,
        e: 0.0,
        i: state.i,
        r: state.r,
        r0_effective: r0 * state.s / n,
        daily_new_infections: 0.0,
        cumulative_infections: cumulative,
    });

    for step in 1..=steps {
        let new_state = rk4_sir(&state, beta, gamma, n, dt);
        let new_infections = (state.s - new_state.s).max(0.0);
        cumulative += new_infections;

        state = new_state;
        let t = step as f64 * dt;

        // Only record at integer day boundaries to avoid massive JSON
        if (t % 1.0).abs() < dt * 0.5 || step == steps {
            results.push(EpiPoint {
                t,
                s: state.s,
                e: 0.0,
                i: state.i,
                r: state.r,
                r0_effective: r0 * state.s / n,
                daily_new_infections: new_infections / dt,
                cumulative_infections: cumulative,
            });
        }
        prev_i = state.i;
    }

    serde_json::to_string(&results).unwrap_or_else(|_| "[]".to_string())
}

/// Run a full SEIR simulation, returns JSON array of EpiPoint
#[wasm_bindgen]
pub fn simulate_seir(
    population: f64,
    initial_exposed: f64,
    initial_infected: f64,
    r0: f64,
    incubation_period_days: f64,
    infectious_period_days: f64,
    duration_days: f64,
    dt: f64,
) -> String {
    let gamma = 1.0 / infectious_period_days;
    let sigma = 1.0 / incubation_period_days;
    let beta = r0 * gamma;
    let n = population;

    let mut state = SeirState {
        s: n - initial_exposed - initial_infected,
        e: initial_exposed,
        i: initial_infected,
        r: 0.0,
    };

    let steps = (duration_days / dt) as usize;
    let mut results: Vec<EpiPoint> = Vec::with_capacity(steps + 1);
    let mut cumulative = initial_infected + initial_exposed;

    results.push(EpiPoint {
        t: 0.0,
        s: state.s,
        e: state.e,
        i: state.i,
        r: state.r,
        r0_effective: r0 * state.s / n,
        daily_new_infections: 0.0,
        cumulative_infections: cumulative,
    });

    for step in 1..=steps {
        let new_state = rk4_seir(&state, beta, sigma, gamma, n, dt);
        let new_infections = (state.s - new_state.s).max(0.0);
        cumulative += new_infections;

        state = new_state;
        let t = step as f64 * dt;

        if (t % 1.0).abs() < dt * 0.5 || step == steps {
            results.push(EpiPoint {
                t,
                s: state.s,
                e: state.e,
                i: state.i,
                r: state.r,
                r0_effective: r0 * state.s / n,
                daily_new_infections: new_infections / dt,
                cumulative_infections: cumulative,
            });
        }
    }

    serde_json::to_string(&results).unwrap_or_else(|_| "[]".to_string())
}

// ============================================================================
// SECTION 2: KAPLAN-MEIER SURVIVAL ANALYSIS
// ============================================================================

#[derive(Serialize)]
struct KmPoint {
    time: f64,
    survival: f64,
    ci_lower: f64,
    ci_upper: f64,
    at_risk: usize,
    events: usize,
    censored: usize,
}

/// Compute Kaplan-Meier survival curve from event/censoring data
/// Input: JSON array of {time: f64, event: bool} sorted by time
/// Output: JSON array of KmPoint with Greenwood CI
#[wasm_bindgen]
pub fn kaplan_meier(data_json: &str) -> String {
    #[derive(Deserialize)]
    struct Observation {
        time: f64,
        event: bool,
    }

    let mut obs: Vec<Observation> = match serde_json::from_str(data_json) {
        Ok(v) => v,
        Err(_) => return "[]".to_string(),
    };

    obs.sort_by(|a, b| a.time.partial_cmp(&b.time).unwrap());

    let n = obs.len();
    let mut results: Vec<KmPoint> = Vec::new();
    let mut survival = 1.0;
    let mut var_sum = 0.0; // Greenwood variance accumulator
    let mut at_risk = n;

    // Add initial point
    results.push(KmPoint {
        time: 0.0,
        survival: 1.0,
        ci_lower: 1.0,
        ci_upper: 1.0,
        at_risk: n,
        events: 0,
        censored: 0,
    });

    let mut i = 0;
    while i < n {
        let t = obs[i].time;
        let mut events = 0usize;
        let mut censored = 0usize;

        // Count events and censored at this time
        while i < n && (obs[i].time - t).abs() < 1e-10 {
            if obs[i].event {
                events += 1;
            } else {
                censored += 1;
            }
            i += 1;
        }

        if events > 0 {
            let d = events as f64;
            let n_r = at_risk as f64;
            survival *= 1.0 - d / n_r;

            // Greenwood's formula for variance
            if n_r > d {
                var_sum += d / (n_r * (n_r - d));
            }

            let se = survival * var_sum.sqrt();
            let ci_lower = (survival - 1.96 * se).max(0.0);
            let ci_upper = (survival + 1.96 * se).min(1.0);

            results.push(KmPoint {
                time: t,
                survival,
                ci_lower,
                ci_upper,
                at_risk,
                events,
                censored,
            });
        }

        at_risk -= events + censored;
    }

    serde_json::to_string(&results).unwrap_or_else(|_| "[]".to_string())
}

// ============================================================================
// SECTION 3: SCREENING TEST CALCULATIONS
// ============================================================================

#[derive(Serialize)]
struct ScreeningResult {
    sensitivity: f64,
    specificity: f64,
    ppv: f64,
    npv: f64,
    accuracy: f64,
    lr_positive: f64,
    lr_negative: f64,
    prevalence: f64,
    tp: f64,
    fp: f64,
    tn: f64,
    fn_count: f64,
    youden_index: f64,
    dor: f64, // diagnostic odds ratio
}

/// Compute screening test performance from 2x2 table or from sens/spec/prevalence
#[wasm_bindgen]
pub fn screening_from_table(tp: f64, fp: f64, fn_count: f64, tn: f64) -> String {
    let total = tp + fp + fn_count + tn;
    let sensitivity = if tp + fn_count > 0.0 { tp / (tp + fn_count) } else { 0.0 };
    let specificity = if tn + fp > 0.0 { tn / (tn + fp) } else { 0.0 };
    let ppv = if tp + fp > 0.0 { tp / (tp + fp) } else { 0.0 };
    let npv = if tn + fn_count > 0.0 { tn / (tn + fn_count) } else { 0.0 };
    let accuracy = if total > 0.0 { (tp + tn) / total } else { 0.0 };
    let lr_positive = if specificity < 1.0 { sensitivity / (1.0 - specificity) } else { f64::INFINITY };
    let lr_negative = if sensitivity < 1.0 { (1.0 - sensitivity) / specificity } else { 0.0 };
    let prevalence = if total > 0.0 { (tp + fn_count) / total } else { 0.0 };
    let youden = sensitivity + specificity - 1.0;
    let dor = if fp > 0.0 && fn_count > 0.0 { (tp * tn) / (fp * fn_count) } else { f64::INFINITY };

    let result = ScreeningResult {
        sensitivity,
        specificity,
        ppv,
        npv,
        accuracy,
        lr_positive,
        lr_negative,
        prevalence,
        tp,
        fp,
        tn,
        fn_count,
        youden_index: youden,
        dor,
    };

    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

/// Compute PPV/NPV across a range of prevalences for given sensitivity/specificity
/// Returns JSON array for ROC-like visualization
#[wasm_bindgen]
pub fn ppv_npv_by_prevalence(sensitivity: f64, specificity: f64) -> String {
    #[derive(Serialize)]
    struct PpvNpvPoint {
        prevalence: f64,
        ppv: f64,
        npv: f64,
    }

    let mut results: Vec<PpvNpvPoint> = Vec::new();

    // 0.1% to 99% prevalence
    let prevalences = [
        0.001, 0.005, 0.01, 0.02, 0.03, 0.05, 0.07, 0.10, 0.15, 0.20, 0.25,
        0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80,
        0.85, 0.90, 0.95, 0.99,
    ];

    for &prev in &prevalences {
        let ppv = (sensitivity * prev)
            / (sensitivity * prev + (1.0 - specificity) * (1.0 - prev));
        let npv = (specificity * (1.0 - prev))
            / (specificity * (1.0 - prev) + (1.0 - sensitivity) * prev);

        results.push(PpvNpvPoint {
            prevalence: prev,
            ppv,
            npv,
        });
    }

    serde_json::to_string(&results).unwrap_or_else(|_| "[]".to_string())
}

// ============================================================================
// SECTION 4: MEASURES OF ASSOCIATION (2x2 TABLE)
// ============================================================================

#[derive(Serialize)]
struct AssociationResult {
    risk_exposed: f64,
    risk_unexposed: f64,
    relative_risk: f64,
    rr_ci_lower: f64,
    rr_ci_upper: f64,
    odds_ratio: f64,
    or_ci_lower: f64,
    or_ci_upper: f64,
    attributable_risk: f64,
    ar_ci_lower: f64,
    ar_ci_upper: f64,
    attributable_risk_percent: f64,
    nnt: f64,
    nnh: f64,
    population_attributable_risk: f64,
    population_attributable_fraction: f64,
    chi_square: f64,
    p_value_approx: f64,
}

/// Compute measures of association from a 2x2 cohort table
/// a = exposed+disease, b = exposed+no disease, c = unexposed+disease, d = unexposed+no disease
#[wasm_bindgen]
pub fn measures_of_association(a: f64, b: f64, c: f64, d: f64) -> String {
    let n = a + b + c + d;

    let risk_exposed = if a + b > 0.0 { a / (a + b) } else { 0.0 };
    let risk_unexposed = if c + d > 0.0 { c / (c + d) } else { 0.0 };

    // Relative Risk
    let rr = if risk_unexposed > 0.0 { risk_exposed / risk_unexposed } else { f64::INFINITY };
    let ln_rr = rr.ln();
    let se_ln_rr = (b / (a * (a + b)) + d / (c * (c + d))).sqrt();
    let rr_ci_lower = (ln_rr - 1.96 * se_ln_rr).exp();
    let rr_ci_upper = (ln_rr + 1.96 * se_ln_rr).exp();

    // Odds Ratio
    let or = if b * c > 0.0 { (a * d) / (b * c) } else { f64::INFINITY };
    let ln_or = or.ln();
    let se_ln_or = (1.0 / a + 1.0 / b + 1.0 / c + 1.0 / d).sqrt();
    let or_ci_lower = (ln_or - 1.96 * se_ln_or).exp();
    let or_ci_upper = (ln_or + 1.96 * se_ln_or).exp();

    // Attributable Risk
    let ar = risk_exposed - risk_unexposed;
    let se_ar = (risk_exposed * (1.0 - risk_exposed) / (a + b)
        + risk_unexposed * (1.0 - risk_unexposed) / (c + d))
        .sqrt();
    let ar_ci_lower = ar - 1.96 * se_ar;
    let ar_ci_upper = ar + 1.96 * se_ar;

    let ar_percent = if risk_exposed > 0.0 { ar / risk_exposed * 100.0 } else { 0.0 };

    // NNT / NNH
    let nnt = if ar > 0.0 { 1.0 / ar } else { f64::INFINITY };
    let nnh = if ar < 0.0 { -1.0 / ar } else { f64::INFINITY };

    // Population measures
    let p_exposure = (a + b) / n;
    let overall_risk = (a + c) / n;
    let par = overall_risk - risk_unexposed;
    let paf = if overall_risk > 0.0 { par / overall_risk } else { 0.0 };

    // Chi-square (Yates corrected)
    let expected_a = (a + b) * (a + c) / n;
    let expected_b = (a + b) * (b + d) / n;
    let expected_c = (c + d) * (a + c) / n;
    let expected_d = (c + d) * (b + d) / n;

    let chi2 = ((a - expected_a).abs() - 0.5).powi(2) / expected_a
        + ((b - expected_b).abs() - 0.5).powi(2) / expected_b
        + ((c - expected_c).abs() - 0.5).powi(2) / expected_c
        + ((d - expected_d).abs() - 0.5).powi(2) / expected_d;

    // Approximate p-value from chi-square with 1 df
    let p_value = chi_square_p_value(chi2, 1);

    let result = AssociationResult {
        risk_exposed,
        risk_unexposed,
        relative_risk: rr,
        rr_ci_lower,
        rr_ci_upper,
        odds_ratio: or,
        or_ci_lower,
        or_ci_upper,
        attributable_risk: ar,
        ar_ci_lower,
        ar_ci_upper,
        attributable_risk_percent: ar_percent,
        nnt,
        nnh,
        population_attributable_risk: par,
        population_attributable_fraction: paf,
        chi_square: chi2,
        p_value_approx: p_value,
    };

    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

// ============================================================================
// SECTION 5: SAMPLE SIZE & POWER CALCULATIONS
// ============================================================================

#[derive(Serialize)]
struct SampleSizeResult {
    n_per_group: usize,
    total_n: usize,
    alpha: f64,
    power: f64,
    effect_size: f64,
    design_type: String,
}

/// Sample size for comparing two proportions (two-sided)
#[wasm_bindgen]
pub fn sample_size_two_proportions(p1: f64, p2: f64, alpha: f64, power: f64) -> String {
    let z_alpha = z_score(1.0 - alpha / 2.0);
    let z_beta = z_score(power);

    let p_bar = (p1 + p2) / 2.0;
    let n = ((z_alpha * (2.0 * p_bar * (1.0 - p_bar)).sqrt()
        + z_beta * (p1 * (1.0 - p1) + p2 * (1.0 - p2)).sqrt())
        / (p1 - p2))
        .powi(2);

    let n_per_group = n.ceil() as usize;
    let result = SampleSizeResult {
        n_per_group,
        total_n: n_per_group * 2,
        alpha,
        power,
        effect_size: (p1 - p2).abs(),
        design_type: "Two proportions (two-sided)".to_string(),
    };

    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

/// Power curve: compute power for a range of sample sizes
#[wasm_bindgen]
pub fn power_curve(p1: f64, p2: f64, alpha: f64, min_n: usize, max_n: usize) -> String {
    #[derive(Serialize)]
    struct PowerPoint {
        n: usize,
        power: f64,
    }

    let z_alpha = z_score(1.0 - alpha / 2.0);
    let mut results: Vec<PowerPoint> = Vec::new();

    let step = ((max_n - min_n) / 50).max(1);
    let mut n = min_n;
    while n <= max_n {
        let nf = n as f64;
        let se_0 = ((p1 + p2) / 2.0 * (1.0 - (p1 + p2) / 2.0) * 2.0 / nf).sqrt();
        let se_1 = (p1 * (1.0 - p1) / nf + p2 * (1.0 - p2) / nf).sqrt();
        let z = ((p1 - p2).abs() - z_alpha * se_0) / se_1;
        let power = normal_cdf(z);

        results.push(PowerPoint { n, power });
        n += step;
    }

    serde_json::to_string(&results).unwrap_or_else(|_| "[]".to_string())
}

// ============================================================================
// SECTION 6: INCIDENCE & PREVALENCE CALCULATIONS
// ============================================================================

#[derive(Serialize)]
struct IncidenceResult {
    cumulative_incidence: f64,
    incidence_rate: f64,
    person_time: f64,
    prevalence: f64,
    ci_lower_incidence: f64,
    ci_upper_incidence: f64,
    ci_lower_prevalence: f64,
    ci_upper_prevalence: f64,
}

/// Compute incidence and prevalence with 95% CIs
#[wasm_bindgen]
pub fn compute_incidence(
    new_cases: f64,
    population_at_risk: f64,
    person_time: f64,
    existing_cases: f64,
    total_population: f64,
) -> String {
    let ci = if population_at_risk > 0.0 {
        new_cases / population_at_risk
    } else {
        0.0
    };

    let ir = if person_time > 0.0 {
        new_cases / person_time
    } else {
        0.0
    };

    let prev = if total_population > 0.0 {
        (new_cases + existing_cases) / total_population
    } else {
        0.0
    };

    // Wilson score CI for incidence
    let (ci_lo_i, ci_hi_i) = wilson_ci(new_cases as usize, population_at_risk as usize);
    let (ci_lo_p, ci_hi_p) =
        wilson_ci((new_cases + existing_cases) as usize, total_population as usize);

    let result = IncidenceResult {
        cumulative_incidence: ci,
        incidence_rate: ir,
        person_time,
        prevalence: prev,
        ci_lower_incidence: ci_lo_i,
        ci_upper_incidence: ci_hi_i,
        ci_lower_prevalence: ci_lo_p,
        ci_upper_prevalence: ci_hi_p,
    };

    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

// ============================================================================
// HELPER FUNCTIONS: Statistical distributions
// ============================================================================

/// Standard normal CDF using Abramowitz & Stegun approximation
fn normal_cdf(x: f64) -> f64 {
    if x < -8.0 {
        return 0.0;
    }
    if x > 8.0 {
        return 1.0;
    }

    let a1 = 0.254829592;
    let a2 = -0.284496736;
    let a3 = 1.421413741;
    let a4 = -1.453152027;
    let a5 = 1.061405429;
    let p = 0.3275911;

    let sign = if x < 0.0 { -1.0 } else { 1.0 };
    let x_abs = x.abs() / std::f64::consts::SQRT_2;
    let t = 1.0 / (1.0 + p * x_abs);
    let y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * (-x_abs * x_abs).exp();

    0.5 * (1.0 + sign * y)
}

/// Inverse normal CDF (quantile function) using rational approximation
fn z_score(p: f64) -> f64 {
    if p <= 0.0 {
        return f64::NEG_INFINITY;
    }
    if p >= 1.0 {
        return f64::INFINITY;
    }

    // Rational approximation (Beasley-Springer-Moro)
    let a = [
        -3.969683028665376e1,
        2.209460984245205e2,
        -2.759285104469687e2,
        1.383577518672690e2,
        -3.066479806614716e1,
        2.506628277459239e0,
    ];
    let b = [
        -5.447609879822406e1,
        1.615858368580409e2,
        -1.556989798598866e2,
        6.680131188771972e1,
        -1.328068155288572e1,
    ];
    let c = [
        -7.784894002430293e-3,
        -3.223964580411365e-1,
        -2.400758277161838e0,
        -2.549732539343734e0,
        4.374664141464968e0,
        2.938163982698783e0,
    ];
    let d = [
        7.784695709041462e-3,
        3.224671290700398e-1,
        2.445134137142996e0,
        3.754408661907416e0,
    ];

    let p_low = 0.02425;
    let p_high = 1.0 - p_low;

    if p < p_low {
        let q = (-2.0 * p.ln()).sqrt();
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
            / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1.0)
    } else if p <= p_high {
        let q = p - 0.5;
        let r = q * q;
        (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
            / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1.0)
    } else {
        let q = (-2.0 * (1.0 - p).ln()).sqrt();
        -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
            / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1.0)
    }
}

/// Approximate chi-square p-value using Wilson-Hilferty transformation
fn chi_square_p_value(x: f64, df: usize) -> f64 {
    if x <= 0.0 {
        return 1.0;
    }
    let k = df as f64;
    let z = ((x / k).powf(1.0 / 3.0) - (1.0 - 2.0 / (9.0 * k))) / (2.0 / (9.0 * k)).sqrt();
    1.0 - normal_cdf(z)
}

/// Wilson score confidence interval for a proportion
fn wilson_ci(x: usize, n: usize) -> (f64, f64) {
    if n == 0 {
        return (0.0, 0.0);
    }
    let p = x as f64 / n as f64;
    let z = 1.96;
    let z2 = z * z;
    let nf = n as f64;

    let denom = 1.0 + z2 / nf;
    let center = p + z2 / (2.0 * nf);
    let margin = z * (p * (1.0 - p) / nf + z2 / (4.0 * nf * nf)).sqrt();

    let lower = ((center - margin) / denom).max(0.0);
    let upper = ((center + margin) / denom).min(1.0);

    (lower, upper)
}

// ============================================================================
// SECTION 7: HERD IMMUNITY THRESHOLD
// ============================================================================

#[derive(Serialize)]
struct HerdImmunityResult {
    r0: f64,
    herd_immunity_threshold: f64,
    vaccine_coverage_needed: f64,
    critical_vaccination_fraction: f64,
}

/// Compute herd immunity threshold for given R0 and vaccine efficacy
#[wasm_bindgen]
pub fn herd_immunity_threshold(r0: f64, vaccine_efficacy: f64) -> String {
    let hit = 1.0 - 1.0 / r0;
    let vc = if vaccine_efficacy > 0.0 {
        hit / vaccine_efficacy
    } else {
        f64::INFINITY
    };

    let result = HerdImmunityResult {
        r0,
        herd_immunity_threshold: hit,
        vaccine_coverage_needed: vc.min(1.0),
        critical_vaccination_fraction: vc,
    };

    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

// ============================================================================
// SECTION 8: LIFE TABLE CALCULATIONS
// ============================================================================

#[derive(Serialize)]
struct LifeTableRow {
    age_group: String,
    n_alive: f64,
    n_dying: f64,
    probability_death: f64,
    probability_survival: f64,
    person_years: f64,
    total_person_years_remaining: f64,
    life_expectancy: f64,
}

/// Compute an abridged life table from age-specific mortality rates
/// Input: JSON array of {age_start: f64, age_end: f64, deaths: f64, population: f64}
#[wasm_bindgen]
pub fn life_table(data_json: &str) -> String {
    #[derive(Deserialize)]
    struct AgeGroup {
        age_start: f64,
        age_end: f64,
        deaths: f64,
        population: f64,
    }

    let groups: Vec<AgeGroup> = match serde_json::from_str(data_json) {
        Ok(v) => v,
        Err(_) => return "[]".to_string(),
    };

    let radix = 100_000.0; // standard life table radix
    let mut l_x = radix;
    let mut results: Vec<LifeTableRow> = Vec::new();

    // First pass: compute all rows
    let mut person_years_vec: Vec<f64> = Vec::new();

    for group in &groups {
        let n = group.age_end - group.age_start;
        let m_x = if group.population > 0.0 {
            group.deaths / group.population
        } else {
            0.0
        };

        // Convert mortality rate to probability of death (Chiang method)
        let a_x = 0.5; // fraction of interval lived by those dying
        let q_x = if 1.0 + (1.0 - a_x) * n * m_x > 0.0 {
            (n * m_x / (1.0 + (1.0 - a_x) * n * m_x)).min(1.0)
        } else {
            1.0
        };

        let d_x = l_x * q_x;
        let big_l = n * (l_x - d_x) + a_x * n * d_x;

        results.push(LifeTableRow {
            age_group: format!("{}-{}", group.age_start as u32, group.age_end as u32),
            n_alive: l_x,
            n_dying: d_x,
            probability_death: q_x,
            probability_survival: 1.0 - q_x,
            person_years: big_l,
            total_person_years_remaining: 0.0, // filled in second pass
            life_expectancy: 0.0,              // filled in second pass
        });

        person_years_vec.push(big_l);
        l_x -= d_x;
    }

    // Second pass: compute T_x and e_x from bottom up
    let n_rows = results.len();
    let mut t_x = 0.0;
    for i in (0..n_rows).rev() {
        t_x += person_years_vec[i];
        results[i].total_person_years_remaining = t_x;
        results[i].life_expectancy = if results[i].n_alive > 0.0 {
            t_x / results[i].n_alive
        } else {
            0.0
        };
    }

    serde_json::to_string(&results).unwrap_or_else(|_| "[]".to_string())
}
