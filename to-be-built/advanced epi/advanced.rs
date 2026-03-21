use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

// ============================================================================
// ADVANCED MODULE 1: MANTEL-HAENSZEL STRATIFIED ANALYSIS
// Controls for confounding by computing pooled OR/RR across strata
// ============================================================================

#[derive(Serialize)]
struct MantelHaenszelResult {
    strata_count: usize,
    crude_or: f64,
    mh_or: f64,
    mh_or_ci_lower: f64,
    mh_or_ci_upper: f64,
    mh_rr: f64,
    mh_rr_ci_lower: f64,
    mh_rr_ci_upper: f64,
    mh_chi_square: f64,
    mh_p_value: f64,
    breslow_day_chi2: f64,
    breslow_day_p: f64,
    confounding_present: bool,
    confounding_percent_change: f64,
    strata_details: Vec<StratumDetail>,
}

#[derive(Serialize)]
struct StratumDetail {
    stratum_label: String,
    a: f64, b: f64, c: f64, d: f64,
    or_stratum: f64,
    rr_stratum: f64,
    weight_mh: f64,
}

/// Mantel-Haenszel stratified analysis
/// Input: JSON array of {label: String, a, b, c, d} strata
#[wasm_bindgen]
pub fn mantel_haenszel(strata_json: &str) -> String {
    #[derive(Deserialize)]
    struct Stratum {
        label: String,
        a: f64, b: f64, c: f64, d: f64,
    }

    let strata: Vec<Stratum> = match serde_json::from_str(strata_json) {
        Ok(v) => v,
        Err(_) => return "{}".to_string(),
    };

    // Crude totals
    let total_a: f64 = strata.iter().map(|s| s.a).sum();
    let total_b: f64 = strata.iter().map(|s| s.b).sum();
    let total_c: f64 = strata.iter().map(|s| s.c).sum();
    let total_d: f64 = strata.iter().map(|s| s.d).sum();
    let crude_or = if total_b * total_c > 0.0 { (total_a * total_d) / (total_b * total_c) } else { f64::INFINITY };

    // MH Odds Ratio: OR_MH = Σ(a*d/n) / Σ(b*c/n)
    let mut num_or = 0.0;
    let mut den_or = 0.0;
    // MH Risk Ratio: RR_MH = Σ[a*(c+d)/n] / Σ[c*(a+b)/n]
    let mut num_rr = 0.0;
    let mut den_rr = 0.0;
    // MH Chi-square components
    let mut mh_num_chi = 0.0;
    let mut mh_den_chi = 0.0;

    let mut details: Vec<StratumDetail> = Vec::new();

    for s in &strata {
        let n = s.a + s.b + s.c + s.d;
        if n == 0.0 { continue; }

        let ad_n = s.a * s.d / n;
        let bc_n = s.b * s.c / n;
        num_or += ad_n;
        den_or += bc_n;

        num_rr += s.a * (s.c + s.d) / n;
        den_rr += s.c * (s.a + s.b) / n;

        // MH chi-square: [Σ(a - E(a))]² / Σ Var(a)
        let e_a = (s.a + s.b) * (s.a + s.c) / n;
        let var_a = (s.a + s.b) * (s.c + s.d) * (s.a + s.c) * (s.b + s.d) / (n * n * (n - 1.0).max(1.0));
        mh_num_chi += s.a - e_a;
        mh_den_chi += var_a;

        let or_s = if s.b * s.c > 0.0 { (s.a * s.d) / (s.b * s.c) } else { f64::INFINITY };
        let re = if s.a + s.b > 0.0 { s.a / (s.a + s.b) } else { 0.0 };
        let ru = if s.c + s.d > 0.0 { s.c / (s.c + s.d) } else { 0.0 };
        let rr_s = if ru > 0.0 { re / ru } else { f64::INFINITY };

        details.push(StratumDetail {
            stratum_label: s.label.clone(),
            a: s.a, b: s.b, c: s.c, d: s.d,
            or_stratum: or_s,
            rr_stratum: rr_s,
            weight_mh: ad_n,
        });
    }

    let mh_or = if den_or > 0.0 { num_or / den_or } else { f64::INFINITY };
    let mh_rr = if den_rr > 0.0 { num_rr / den_rr } else { f64::INFINITY };
    let mh_chi2 = if mh_den_chi > 0.0 { mh_num_chi * mh_num_chi / mh_den_chi } else { 0.0 };
    let mh_p = chi_square_p_value(mh_chi2, 1);

    // Robins-Breslow-Greenland variance for ln(OR_MH)
    let ln_mh_or = mh_or.ln();
    let mut var_ln_or = 0.0;
    for s in &strata {
        let n = s.a + s.b + s.c + s.d;
        if n == 0.0 { continue; }
        let p = (s.a * s.d) / n;
        let q = (s.b * s.c) / n;
        let r = (s.a + s.d) / n;
        let ss = (s.b + s.c) / n;
        var_ln_or += r * p / (2.0 * num_or * num_or)
            + (r * q + ss * p) / (2.0 * num_or * den_or)
            + ss * q / (2.0 * den_or * den_or);
    }
    let se_ln_or = var_ln_or.sqrt();

    // Greenland-Robins variance for ln(RR_MH)
    let ln_mh_rr = mh_rr.ln();
    let mut var_ln_rr = 0.0;
    for s in &strata {
        let n = s.a + s.b + s.c + s.d;
        if n == 0.0 { continue; }
        let m1 = s.a + s.b;
        let m0 = s.c + s.d;
        let n1 = s.a + s.c;
        let p = (m1 * m0 * n1 / n - s.a * s.c) / (n * n);
        var_ln_rr += p / (num_rr * den_rr);
    }
    let se_ln_rr = (var_ln_rr.abs()).sqrt();

    // Breslow-Day test for homogeneity of ORs
    let mut bd_chi2 = 0.0;
    for s in &strata {
        let n = s.a + s.b + s.c + s.d;
        if n == 0.0 { continue; }
        // Solve quadratic for expected 'a' under MH OR
        let m1 = s.a + s.b;
        let n1 = s.a + s.c;
        // Under H0: OR = mh_or, solve for a_hat
        let aa = mh_or - 1.0;
        let bb = -(m1 + n1 + (mh_or - 1.0) * n + mh_or * (s.c + s.d - m1));
        // Simplified Newton approach
        let mut a_hat = s.a;
        if aa.abs() > 1e-10 {
            let bb2 = n1 * mh_or - n + m1 + m1 * mh_or;
            let cc = -m1 * n1 * mh_or;
            let disc = bb2 * bb2 - 4.0 * aa * cc;
            if disc >= 0.0 {
                a_hat = (-bb2 + disc.sqrt()) / (2.0 * aa);
                a_hat = a_hat.max(0.0).min(m1.min(n1));
            }
        }
        let b_hat = m1 - a_hat;
        let c_hat = n1 - a_hat;
        let d_hat = n - m1 - n1 + a_hat;

        let var_a = if a_hat > 0.0 && b_hat > 0.0 && c_hat > 0.0 && d_hat > 0.0 {
            1.0 / (1.0/a_hat + 1.0/b_hat + 1.0/c_hat + 1.0/d_hat)
        } else { 1.0 };
        bd_chi2 += (s.a - a_hat).powi(2) / var_a.max(0.001);
    }
    let bd_p = if strata.len() > 1 { chi_square_p_value(bd_chi2, strata.len() - 1) } else { 1.0 };

    // Confounding assessment
    let pct_change = if mh_or > 0.0 && crude_or.is_finite() {
        ((crude_or - mh_or) / mh_or * 100.0).abs()
    } else { 0.0 };

    let result = MantelHaenszelResult {
        strata_count: strata.len(),
        crude_or,
        mh_or,
        mh_or_ci_lower: (ln_mh_or - 1.96 * se_ln_or).exp(),
        mh_or_ci_upper: (ln_mh_or + 1.96 * se_ln_or).exp(),
        mh_rr,
        mh_rr_ci_lower: (ln_mh_rr - 1.96 * se_ln_rr).exp(),
        mh_rr_ci_upper: (ln_mh_rr + 1.96 * se_ln_rr).exp(),
        mh_chi_square: mh_chi2,
        mh_p_value: mh_p,
        breslow_day_chi2: bd_chi2,
        breslow_day_p: bd_p,
        confounding_present: pct_change > 10.0,
        confounding_percent_change: pct_change,
        strata_details: details,
    };

    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

// ============================================================================
// ADVANCED MODULE 2: META-ANALYSIS (FIXED & RANDOM EFFECTS)
// ============================================================================

#[derive(Serialize)]
struct MetaAnalysisResult {
    n_studies: usize,
    fixed_effect: f64,
    fixed_ci_lower: f64,
    fixed_ci_upper: f64,
    fixed_z: f64,
    fixed_p: f64,
    random_effect: f64,
    random_ci_lower: f64,
    random_ci_upper: f64,
    random_z: f64,
    random_p: f64,
    tau_squared: f64,
    i_squared: f64,
    q_statistic: f64,
    q_p_value: f64,
    study_details: Vec<MetaStudyDetail>,
}

#[derive(Serialize)]
struct MetaStudyDetail {
    label: String,
    effect: f64,
    se: f64,
    ci_lower: f64,
    ci_upper: f64,
    weight_fixed: f64,
    weight_random: f64,
}

/// Fixed and random effects meta-analysis
/// Input: JSON array of {label, effect, se} or {label, effect, ci_lower, ci_upper}
#[wasm_bindgen]
pub fn meta_analysis(studies_json: &str) -> String {
    #[derive(Deserialize)]
    struct StudyInput {
        label: String,
        effect: f64,
        se: Option<f64>,
        ci_lower: Option<f64>,
        ci_upper: Option<f64>,
    }

    let studies: Vec<StudyInput> = match serde_json::from_str(studies_json) {
        Ok(v) => v,
        Err(_) => return "{}".to_string(),
    };

    let k = studies.len();
    if k == 0 { return "{}".to_string(); }

    // Compute SE from CI if not provided
    let effects: Vec<(String, f64, f64)> = studies.iter().map(|s| {
        let se = s.se.unwrap_or_else(|| {
            let lo = s.ci_lower.unwrap_or(s.effect - 0.1);
            let hi = s.ci_upper.unwrap_or(s.effect + 0.1);
            (hi - lo) / (2.0 * 1.96)
        });
        (s.label.clone(), s.effect, se.max(0.001))
    }).collect();

    // Fixed-effect (inverse variance)
    let weights_fixed: Vec<f64> = effects.iter().map(|(_, _, se)| 1.0 / (se * se)).collect();
    let w_total: f64 = weights_fixed.iter().sum();
    let fe = effects.iter().zip(weights_fixed.iter())
        .map(|((_, eff, _), w)| eff * w).sum::<f64>() / w_total;
    let se_fe = (1.0 / w_total).sqrt();

    // Cochran's Q
    let q: f64 = effects.iter().zip(weights_fixed.iter())
        .map(|((_, eff, _), w)| w * (eff - fe).powi(2)).sum();
    let q_df = (k as f64 - 1.0).max(1.0);
    let q_p = chi_square_p_value(q, k.saturating_sub(1).max(1));

    // I² = max(0, (Q - df) / Q × 100)
    let i_sq = ((q - q_df) / q * 100.0).max(0.0);

    // DerSimonian-Laird tau²
    let c = w_total - effects.iter().zip(weights_fixed.iter())
        .map(|(_, w)| w * w).sum::<f64>() / w_total;
    let tau2 = ((q - q_df) / c).max(0.0);

    // Random-effect weights
    let weights_random: Vec<f64> = effects.iter().map(|(_, _, se)| {
        1.0 / (se * se + tau2)
    }).collect();
    let wr_total: f64 = weights_random.iter().sum();
    let re = effects.iter().zip(weights_random.iter())
        .map(|((_, eff, _), w)| eff * w).sum::<f64>() / wr_total;
    let se_re = (1.0 / wr_total).sqrt();

    let z_fe = fe / se_fe;
    let p_fe = 2.0 * (1.0 - normal_cdf(z_fe.abs()));
    let z_re = re / se_re;
    let p_re = 2.0 * (1.0 - normal_cdf(z_re.abs()));

    // Normalize weights to percentages
    let w_fixed_sum: f64 = weights_fixed.iter().sum();
    let w_random_sum: f64 = weights_random.iter().sum();

    let details: Vec<MetaStudyDetail> = effects.iter().enumerate().map(|(i, (label, eff, se))| {
        MetaStudyDetail {
            label: label.clone(),
            effect: *eff,
            se: *se,
            ci_lower: eff - 1.96 * se,
            ci_upper: eff + 1.96 * se,
            weight_fixed: weights_fixed[i] / w_fixed_sum * 100.0,
            weight_random: weights_random[i] / w_random_sum * 100.0,
        }
    }).collect();

    let result = MetaAnalysisResult {
        n_studies: k,
        fixed_effect: fe,
        fixed_ci_lower: fe - 1.96 * se_fe,
        fixed_ci_upper: fe + 1.96 * se_fe,
        fixed_z: z_fe,
        fixed_p: p_fe,
        random_effect: re,
        random_ci_lower: re - 1.96 * se_re,
        random_ci_upper: re + 1.96 * se_re,
        random_z: z_re,
        random_p: p_re,
        tau_squared: tau2,
        i_squared: i_sq,
        q_statistic: q,
        q_p_value: q_p,
        study_details: details,
    };

    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

// ============================================================================
// ADVANCED MODULE 3: AGE STANDARDIZATION (DIRECT & INDIRECT)
// ============================================================================

#[derive(Serialize)]
struct StandardizationResult {
    method: String,
    crude_rate_study: f64,
    crude_rate_standard: f64,
    adjusted_rate: f64,
    sir: f64,  // Standardized Incidence/Mortality Ratio (indirect)
    sir_ci_lower: f64,
    sir_ci_upper: f64,
    smr: f64,
    smr_ci_lower: f64,
    smr_ci_upper: f64,
    strata_details: Vec<StdStratumDetail>,
}

#[derive(Serialize)]
struct StdStratumDetail {
    age_group: String,
    study_pop: f64,
    study_events: f64,
    study_rate: f64,
    standard_pop: f64,
    standard_rate: f64,
    expected_direct: f64,
    expected_indirect: f64,
}

/// Direct and indirect age standardization
/// Input: JSON with study_strata and standard_strata arrays
#[wasm_bindgen]
pub fn age_standardization(data_json: &str) -> String {
    #[derive(Deserialize)]
    struct StdInput {
        study_strata: Vec<AgeStratum>,
        standard_strata: Vec<AgeStratum>,
    }
    #[derive(Deserialize)]
    struct AgeStratum {
        age_group: String,
        population: f64,
        events: f64,
    }

    let data: StdInput = match serde_json::from_str(data_json) {
        Ok(v) => v,
        Err(_) => return "{}".to_string(),
    };

    let k = data.study_strata.len().min(data.standard_strata.len());
    let mut details: Vec<StdStratumDetail> = Vec::new();

    // Direct: apply study rates to standard population
    let mut direct_expected = 0.0;
    let total_std_pop: f64 = data.standard_strata.iter().take(k).map(|s| s.population).sum();

    // Indirect: apply standard rates to study population
    let mut indirect_expected = 0.0;
    let total_study_events: f64 = data.study_strata.iter().take(k).map(|s| s.events).sum();
    let total_study_pop: f64 = data.study_strata.iter().take(k).map(|s| s.population).sum();
    let total_std_events: f64 = data.standard_strata.iter().take(k).map(|s| s.events).sum();
    let total_std_pop_sum: f64 = data.standard_strata.iter().take(k).map(|s| s.population).sum();

    for i in 0..k {
        let study_rate = if data.study_strata[i].population > 0.0 {
            data.study_strata[i].events / data.study_strata[i].population
        } else { 0.0 };
        let std_rate = if data.standard_strata[i].population > 0.0 {
            data.standard_strata[i].events / data.standard_strata[i].population
        } else { 0.0 };

        let exp_direct = study_rate * data.standard_strata[i].population;
        let exp_indirect = std_rate * data.study_strata[i].population;

        direct_expected += exp_direct;
        indirect_expected += exp_indirect;

        details.push(StdStratumDetail {
            age_group: data.study_strata[i].age_group.clone(),
            study_pop: data.study_strata[i].population,
            study_events: data.study_strata[i].events,
            study_rate: study_rate * 1000.0,
            standard_pop: data.standard_strata[i].population,
            standard_rate: std_rate * 1000.0,
            expected_direct: exp_direct,
            expected_indirect: exp_indirect,
        });
    }

    let adjusted_rate_direct = if total_std_pop > 0.0 { direct_expected / total_std_pop } else { 0.0 };
    let crude_study = if total_study_pop > 0.0 { total_study_events / total_study_pop } else { 0.0 };
    let crude_std = if total_std_pop_sum > 0.0 { total_std_events / total_std_pop_sum } else { 0.0 };

    // SMR/SIR = Observed / Expected (indirect)
    let smr = if indirect_expected > 0.0 { total_study_events / indirect_expected } else { 0.0 };
    // Byar's approximation for SMR CI
    let o = total_study_events;
    let lo_byar = o * (1.0 - 1.0/(9.0*o) - 1.96/(3.0*o.sqrt())).powi(3) / indirect_expected;
    let hi_byar = (o+1.0) * (1.0 - 1.0/(9.0*(o+1.0)) + 1.96/(3.0*(o+1.0).sqrt())).powi(3) / indirect_expected;

    let result = StandardizationResult {
        method: "Direct & Indirect".to_string(),
        crude_rate_study: crude_study * 1000.0,
        crude_rate_standard: crude_std * 1000.0,
        adjusted_rate: adjusted_rate_direct * 1000.0,
        sir: smr,
        sir_ci_lower: lo_byar.max(0.0),
        sir_ci_upper: hi_byar,
        smr,
        smr_ci_lower: lo_byar.max(0.0),
        smr_ci_upper: hi_byar,
        strata_details: details,
    };

    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

// ============================================================================
// ADVANCED MODULE 4: ROC CURVE ANALYSIS
// ============================================================================

#[derive(Serialize)]
struct RocResult {
    auc: f64,
    auc_se: f64,
    auc_ci_lower: f64,
    auc_ci_upper: f64,
    optimal_cutpoint: f64,
    optimal_sensitivity: f64,
    optimal_specificity: f64,
    optimal_youden: f64,
    curve_points: Vec<RocPoint>,
}

#[derive(Serialize)]
struct RocPoint {
    cutpoint: f64,
    sensitivity: f64,
    specificity: f64,
    fpr: f64, // 1 - specificity
    youden: f64,
    lr_positive: f64,
}

/// Compute ROC curve from continuous test data
/// Input: JSON array of {value: f64, disease: bool}
#[wasm_bindgen]
pub fn roc_analysis(data_json: &str) -> String {
    #[derive(Deserialize)]
    struct Observation {
        value: f64,
        disease: bool,
    }

    let mut obs: Vec<Observation> = match serde_json::from_str(data_json) {
        Ok(v) => v,
        Err(_) => return "{}".to_string(),
    };

    obs.sort_by(|a, b| a.value.partial_cmp(&b.value).unwrap());

    let n_pos = obs.iter().filter(|o| o.disease).count() as f64;
    let n_neg = obs.iter().filter(|o| !o.disease).count() as f64;

    if n_pos == 0.0 || n_neg == 0.0 {
        return "{}".to_string();
    }

    // Collect unique cutpoints
    let mut cutpoints: Vec<f64> = obs.iter().map(|o| o.value).collect();
    cutpoints.sort_by(|a, b| a.partial_cmp(b).unwrap());
    cutpoints.dedup();

    let mut points: Vec<RocPoint> = Vec::new();
    let mut best_youden = -1.0f64;
    let mut optimal_idx = 0;

    // Add (0,0) point
    points.push(RocPoint { cutpoint: f64::INFINITY, sensitivity: 0.0, specificity: 1.0, fpr: 0.0, youden: -1.0, lr_positive: 0.0 });

    for (i, &cut) in cutpoints.iter().enumerate() {
        let tp = obs.iter().filter(|o| o.value >= cut && o.disease).count() as f64;
        let fp = obs.iter().filter(|o| o.value >= cut && !o.disease).count() as f64;
        let fn_count = n_pos - tp;
        let tn = n_neg - fp;

        let sens = tp / n_pos;
        let spec = tn / n_neg;
        let fpr = 1.0 - spec;
        let youden = sens + spec - 1.0;
        let lr_pos = if spec < 1.0 { sens / (1.0 - spec) } else { f64::INFINITY };

        if youden > best_youden {
            best_youden = youden;
            optimal_idx = points.len();
        }

        points.push(RocPoint { cutpoint: cut, sensitivity: sens, specificity: spec, fpr, youden, lr_positive: lr_pos });
    }

    // Add (1,1) point
    points.push(RocPoint { cutpoint: f64::NEG_INFINITY, sensitivity: 1.0, specificity: 0.0, fpr: 1.0, youden: 0.0, lr_positive: 1.0 });

    // Sort by FPR for AUC computation
    points.sort_by(|a, b| a.fpr.partial_cmp(&b.fpr).unwrap());

    // AUC by trapezoidal rule
    let mut auc = 0.0;
    for i in 1..points.len() {
        let dx = points[i].fpr - points[i-1].fpr;
        let avg_y = (points[i].sensitivity + points[i-1].sensitivity) / 2.0;
        auc += dx * avg_y;
    }

    // Hanley-McNeil SE approximation
    let q1 = auc / (2.0 - auc);
    let q2 = 2.0 * auc * auc / (1.0 + auc);
    let se = ((auc * (1.0 - auc) + (n_pos - 1.0) * (q1 - auc * auc) + (n_neg - 1.0) * (q2 - auc * auc)) / (n_pos * n_neg)).sqrt();

    let optimal = &points[optimal_idx.min(points.len()-1)];

    let result = RocResult {
        auc,
        auc_se: se,
        auc_ci_lower: (auc - 1.96 * se).max(0.0),
        auc_ci_upper: (auc + 1.96 * se).min(1.0),
        optimal_cutpoint: optimal.cutpoint,
        optimal_sensitivity: optimal.sensitivity,
        optimal_specificity: optimal.specificity,
        optimal_youden: optimal.youden,
        curve_points: points,
    };

    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

// ============================================================================
// ADVANCED MODULE 5: MONTE CARLO EPIDEMIC SIMULATION
// ============================================================================

#[derive(Serialize)]
struct MonteCarloResult {
    n_simulations: usize,
    median_peak_infected: f64,
    p5_peak_infected: f64,
    p95_peak_infected: f64,
    median_peak_day: f64,
    median_total_infected: f64,
    p5_total_infected: f64,
    p95_total_infected: f64,
    median_attack_rate: f64,
    trajectories: Vec<Vec<f64>>, // subset for plotting
}

/// Monte Carlo SIR simulation with parameter uncertainty
/// R0 sampled from Normal(r0_mean, r0_sd), infectious period from Normal(ip_mean, ip_sd)
#[wasm_bindgen]
pub fn monte_carlo_sir(
    population: f64,
    initial_infected: f64,
    r0_mean: f64,
    r0_sd: f64,
    inf_period_mean: f64,
    inf_period_sd: f64,
    duration_days: f64,
    n_simulations: usize,
    seed: u64,
) -> String {
    let mut rng = SimpleRng::new(seed);
    let dt = 0.1;
    let steps = (duration_days / dt) as usize;
    let day_steps = (1.0 / dt) as usize;

    let mut peak_infecteds: Vec<f64> = Vec::with_capacity(n_simulations);
    let mut peak_days: Vec<f64> = Vec::with_capacity(n_simulations);
    let mut total_infecteds: Vec<f64> = Vec::with_capacity(n_simulations);
    let mut trajectories: Vec<Vec<f64>> = Vec::new();
    let n_trajectories = 50.min(n_simulations);

    for sim in 0..n_simulations {
        let r0 = (r0_mean + r0_sd * rng.normal()).max(0.1);
        let inf_period = (inf_period_mean + inf_period_sd * rng.normal()).max(1.0);
        let gamma = 1.0 / inf_period;
        let beta = r0 * gamma;
        let n = population;

        let mut s = n - initial_infected;
        let mut i = initial_infected;
        let mut r = 0.0;
        let mut peak_i = i;
        let mut peak_d = 0.0;
        let mut cumul = initial_infected;

        let mut traj = Vec::new();
        if sim < n_trajectories { traj.push(i); }

        for step in 1..=steps {
            // RK4
            let ds1 = -beta*s*i/n; let di1 = beta*s*i/n - gamma*i; let dr1 = gamma*i;
            let s2=s+0.5*dt*ds1; let i2=i+0.5*dt*di1;
            let ds2 = -beta*s2*i2/n; let di2 = beta*s2*i2/n - gamma*i2;
            let s3=s+0.5*dt*ds2; let i3=i+0.5*dt*di2;
            let ds3 = -beta*s3*i3/n; let di3 = beta*s3*i3/n - gamma*i3;
            let s4=s+dt*ds3; let i4=i+dt*di3;
            let ds4 = -beta*s4*i4/n; let di4 = beta*s4*i4/n - gamma*i4;

            let prev_s = s;
            s += dt/6.0*(ds1+2.0*ds2+2.0*ds3+ds4);
            i += dt/6.0*(di1+2.0*di2+2.0*di3+di4);
            r = n - s - i;
            cumul += (prev_s - s).max(0.0);

            if i > peak_i { peak_i = i; peak_d = step as f64 * dt; }

            if sim < n_trajectories && step % day_steps == 0 {
                traj.push(i);
            }
        }

        peak_infecteds.push(peak_i);
        peak_days.push(peak_d);
        total_infecteds.push(cumul);
        if sim < n_trajectories { trajectories.push(traj); }
    }

    peak_infecteds.sort_by(|a,b| a.partial_cmp(b).unwrap());
    peak_days.sort_by(|a,b| a.partial_cmp(b).unwrap());
    total_infecteds.sort_by(|a,b| a.partial_cmp(b).unwrap());

    let percentile = |v: &[f64], p: f64| -> f64 {
        let idx = ((v.len() as f64 - 1.0) * p).round() as usize;
        v[idx.min(v.len()-1)]
    };

    let result = MonteCarloResult {
        n_simulations,
        median_peak_infected: percentile(&peak_infecteds, 0.5),
        p5_peak_infected: percentile(&peak_infecteds, 0.05),
        p95_peak_infected: percentile(&peak_infecteds, 0.95),
        median_peak_day: percentile(&peak_days, 0.5),
        median_total_infected: percentile(&total_infecteds, 0.5),
        p5_total_infected: percentile(&total_infecteds, 0.05),
        p95_total_infected: percentile(&total_infecteds, 0.95),
        median_attack_rate: percentile(&total_infecteds, 0.5) / population,
        trajectories,
    };

    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

// ============================================================================
// ADVANCED MODULE 6: DOSE-RESPONSE ANALYSIS (LOGISTIC MODEL)
// ============================================================================

#[derive(Serialize)]
struct DoseResponseResult {
    beta0: f64,    // intercept
    beta1: f64,    // slope
    ld50: f64,     // dose for 50% response
    ld10: f64,
    ld90: f64,
    chi_square_gof: f64,
    p_gof: f64,
    curve_points: Vec<DoseResponsePoint>,
}

#[derive(Serialize)]
struct DoseResponsePoint {
    dose: f64,
    predicted: f64,
    observed: f64,
}

/// Fit logistic dose-response model using iteratively reweighted least squares
/// Input: JSON array of {dose, n_subjects, n_responding}
#[wasm_bindgen]
pub fn dose_response(data_json: &str) -> String {
    #[derive(Deserialize)]
    struct DoseGroup {
        dose: f64,
        n_subjects: f64,
        n_responding: f64,
    }

    let groups: Vec<DoseGroup> = match serde_json::from_str(data_json) {
        Ok(v) => v,
        Err(_) => return "{}".to_string(),
    };

    if groups.len() < 2 { return "{}".to_string(); }

    // IRLS for logistic regression: logit(p) = beta0 + beta1 * dose
    let mut b0 = 0.0f64;
    let mut b1 = 0.01f64;

    for _iter in 0..50 {
        let mut xtx00 = 0.0; let mut xtx01 = 0.0; let mut xtx11 = 0.0;
        let mut xty0 = 0.0; let mut xty1 = 0.0;

        for g in &groups {
            let eta = b0 + b1 * g.dose;
            let p = 1.0 / (1.0 + (-eta).exp());
            let p_clamped = p.max(0.001).min(0.999);
            let w = g.n_subjects * p_clamped * (1.0 - p_clamped);
            let z = eta + (g.n_responding - g.n_subjects * p_clamped) / w.max(0.001) * g.n_subjects * p_clamped * (1.0 - p_clamped);
            let residual = g.n_responding / g.n_subjects.max(1.0) - p_clamped;

            xtx00 += w;
            xtx01 += w * g.dose;
            xtx11 += w * g.dose * g.dose;
            xty0 += w * (eta + residual / p_clamped.max(0.001) / (1.0 - p_clamped).max(0.001));
            xty1 += w * g.dose * (eta + residual / p_clamped.max(0.001) / (1.0 - p_clamped).max(0.001));
        }

        // Newton-Raphson update using score and information
        let mut s0 = 0.0; let mut s1 = 0.0;
        let mut i00 = 0.0; let mut i01 = 0.0; let mut i11 = 0.0;

        for g in &groups {
            let eta = b0 + b1 * g.dose;
            let p = 1.0 / (1.0 + (-eta).exp());
            let p_c = p.max(0.001).min(0.999);
            s0 += g.n_responding - g.n_subjects * p_c;
            s1 += g.dose * (g.n_responding - g.n_subjects * p_c);
            let w = g.n_subjects * p_c * (1.0 - p_c);
            i00 += w;
            i01 += w * g.dose;
            i11 += w * g.dose * g.dose;
        }

        let det = i00 * i11 - i01 * i01;
        if det.abs() < 1e-15 { break; }
        let db0 = (i11 * s0 - i01 * s1) / det;
        let db1 = (-i01 * s0 + i00 * s1) / det;

        b0 += db0;
        b1 += db1;

        if db0.abs() < 1e-8 && db1.abs() < 1e-8 { break; }
    }

    let ld50 = if b1.abs() > 1e-10 { -b0 / b1 } else { f64::NAN };
    let ld10 = if b1.abs() > 1e-10 { -(b0 + (-9.0f64).ln().copysign(1.0) * 2.197) / b1 } else { f64::NAN };
    let ld90 = if b1.abs() > 1e-10 { -(b0 - 2.197) / b1 } else { f64::NAN };

    // Goodness of fit
    let mut chi2 = 0.0;
    let mut curve_points = Vec::new();

    for g in &groups {
        let eta = b0 + b1 * g.dose;
        let p = 1.0 / (1.0 + (-eta).exp());
        let expected = g.n_subjects * p;
        let observed = g.n_responding / g.n_subjects.max(1.0);
        if expected > 0.0 && g.n_subjects - expected > 0.0 {
            chi2 += (g.n_responding - expected).powi(2) / expected
                + (g.n_subjects - g.n_responding - (g.n_subjects - expected)).powi(2) / (g.n_subjects - expected);
        }
        curve_points.push(DoseResponsePoint { dose: g.dose, predicted: p, observed });
    }

    // Add interpolated curve
    let min_dose = groups.iter().map(|g| g.dose).fold(f64::INFINITY, f64::min);
    let max_dose = groups.iter().map(|g| g.dose).fold(f64::NEG_INFINITY, f64::max);
    let range = max_dose - min_dose;
    for i in 0..=50 {
        let d = min_dose - range*0.1 + (range * 1.2) * i as f64 / 50.0;
        let p = 1.0 / (1.0 + (-(b0 + b1 * d)).exp());
        curve_points.push(DoseResponsePoint { dose: d, predicted: p, observed: f64::NAN });
    }
    curve_points.sort_by(|a,b| a.dose.partial_cmp(&b.dose).unwrap());

    let gof_df = (groups.len() as i32 - 2).max(1) as usize;
    let p_gof = chi_square_p_value(chi2, gof_df);

    let result = DoseResponseResult {
        beta0: b0, beta1: b1, ld50, ld10, ld90,
        chi_square_gof: chi2, p_gof,
        curve_points,
    };

    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

// ============================================================================
// ADVANCED MODULE 7: INTERRUPTED TIME SERIES (SEGMENTED REGRESSION)
// ============================================================================

#[derive(Serialize)]
struct ItsResult {
    intercept: f64,
    pre_slope: f64,
    level_change: f64,
    slope_change: f64,
    post_slope: f64,
    r_squared: f64,
    residual_se: f64,
    predicted: Vec<ItsPoint>,
    counterfactual: Vec<ItsPoint>,
}

#[derive(Serialize)]
struct ItsPoint {
    time: f64,
    value: f64,
}

/// Segmented regression for interrupted time series
/// Input: JSON {values: [f64], intervention_point: usize}
#[wasm_bindgen]
pub fn interrupted_time_series(data_json: &str) -> String {
    #[derive(Deserialize)]
    struct ItsInput {
        values: Vec<f64>,
        intervention_point: usize,
    }

    let input: ItsInput = match serde_json::from_str(data_json) {
        Ok(v) => v,
        Err(_) => return "{}".to_string(),
    };

    let n = input.values.len();
    if n < 4 { return "{}".to_string(); }
    let ip = input.intervention_point.min(n-1);

    // Y = β0 + β1*T + β2*D + β3*P
    // T = time (1..n), D = 0 pre / 1 post, P = 0 pre / (T - ip) post
    let mut xtx = [[0.0f64; 4]; 4];
    let mut xty = [0.0f64; 4];

    for i in 0..n {
        let t = (i + 1) as f64;
        let d = if i >= ip { 1.0 } else { 0.0 };
        let p = if i >= ip { (i - ip + 1) as f64 } else { 0.0 };
        let x = [1.0, t, d, p];
        let y = input.values[i];

        for r in 0..4 {
            for c in 0..4 {
                xtx[r][c] += x[r] * x[c];
            }
            xty[r] += x[r] * y;
        }
    }

    // Solve 4x4 system via Gaussian elimination
    let mut aug = [[0.0f64; 5]; 4];
    for r in 0..4 { for c in 0..4 { aug[r][c] = xtx[r][c]; } aug[r][4] = xty[r]; }
    for col in 0..4 {
        let mut max_row = col;
        for row in col+1..4 { if aug[row][col].abs() > aug[max_row][col].abs() { max_row = row; } }
        aug.swap(col, max_row);
        if aug[col][col].abs() < 1e-15 { continue; }
        let pivot = aug[col][col];
        for j in col..5 { aug[col][j] /= pivot; }
        for row in 0..4 {
            if row == col { continue; }
            let factor = aug[row][col];
            for j in col..5 { aug[row][j] -= factor * aug[col][j]; }
        }
    }

    let b0 = aug[0][4]; let b1 = aug[1][4]; let b2 = aug[2][4]; let b3 = aug[3][4];

    // Compute predicted and counterfactual
    let mut predicted = Vec::new();
    let mut counterfactual = Vec::new();
    let mut ss_res = 0.0;
    let mean_y: f64 = input.values.iter().sum::<f64>() / n as f64;
    let mut ss_tot = 0.0;

    for i in 0..n {
        let t = (i + 1) as f64;
        let d = if i >= ip { 1.0 } else { 0.0 };
        let p = if i >= ip { (i - ip + 1) as f64 } else { 0.0 };
        let yhat = b0 + b1 * t + b2 * d + b3 * p;
        let cf = b0 + b1 * t; // counterfactual: no intervention

        predicted.push(ItsPoint { time: t, value: yhat });
        counterfactual.push(ItsPoint { time: t, value: cf });

        ss_res += (input.values[i] - yhat).powi(2);
        ss_tot += (input.values[i] - mean_y).powi(2);
    }

    let r2 = if ss_tot > 0.0 { 1.0 - ss_res / ss_tot } else { 0.0 };
    let se = (ss_res / (n as f64 - 4.0).max(1.0)).sqrt();

    let result = ItsResult {
        intercept: b0,
        pre_slope: b1,
        level_change: b2,
        slope_change: b3,
        post_slope: b1 + b3,
        r_squared: r2,
        residual_se: se,
        predicted,
        counterfactual,
    };

    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

// ============================================================================
// HELPER: Simple PRNG for Monte Carlo (xoshiro128+)
// ============================================================================

struct SimpleRng { state: [u64; 4] }
impl SimpleRng {
    fn new(seed: u64) -> Self {
        let mut s = [seed, seed ^ 0x6a09e667, seed ^ 0xbb67ae85, seed ^ 0x3c6ef372];
        for i in 0..4 { s[i] = s[i].wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407); }
        SimpleRng { state: s }
    }
    fn next_u64(&mut self) -> u64 {
        let result = self.state[0].wrapping_add(self.state[3]);
        let t = self.state[1] << 17;
        self.state[2] ^= self.state[0];
        self.state[3] ^= self.state[1];
        self.state[1] ^= self.state[2];
        self.state[0] ^= self.state[3];
        self.state[2] ^= t;
        self.state[3] = self.state[3].rotate_left(45);
        result
    }
    fn uniform(&mut self) -> f64 { (self.next_u64() >> 11) as f64 / (1u64 << 53) as f64 }
    fn normal(&mut self) -> f64 {
        // Box-Muller
        let u1 = self.uniform().max(1e-15);
        let u2 = self.uniform();
        (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos()
    }
}

// ============================================================================
// RE-EXPORT HELPERS (same as base module)
// ============================================================================

fn normal_cdf(x: f64) -> f64 {
    if x < -8.0 { return 0.0; } if x > 8.0 { return 1.0; }
    let a1=0.254829592; let a2=-0.284496736; let a3=1.421413741; let a4=-1.453152027; let a5=1.061405429; let p=0.3275911;
    let sign = if x < 0.0 { -1.0 } else { 1.0 };
    let xa = x.abs() / std::f64::consts::SQRT_2;
    let t = 1.0 / (1.0 + p * xa);
    let y = 1.0 - (((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*(-xa*xa).exp();
    0.5 * (1.0 + sign * y)
}

fn chi_square_p_value(x: f64, df: usize) -> f64 {
    if x <= 0.0 { return 1.0; }
    let k = df as f64;
    let z = ((x/k).powf(1.0/3.0) - (1.0 - 2.0/(9.0*k))) / (2.0/(9.0*k)).sqrt();
    1.0 - normal_cdf(z)
}
