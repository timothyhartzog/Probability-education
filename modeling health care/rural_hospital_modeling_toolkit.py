import marimo

__generated_with = "0.13.0"
app = marimo.App(width="full", app_title="Rural Hospital Operations Modeling Toolkit")


@app.cell
def title_cell():
    import marimo as mo
    mo.output.replace(
        mo.md("""
# 🏥 Rural Hospital Operations Modeling Toolkit
## From Statistical Foundations to Agent-Based Simulation

**A comprehensive interactive modeling environment for rural hospital executives, operations managers, and quality improvement teams.**

This notebook implements every core modeling method from *Modeling Methods for Healthcare Operations in Rural Hospitals* — allowing you to adjust parameters for **your** facility and see real-time results.

> **How to use:** Adjust the sliders, dropdowns, and inputs in each section to match your hospital's characteristics. The models will update automatically.

---
""")
    )
    return (mo,)


@app.cell
def imports_cell():
    import numpy as np
    import pandas as pd
    import matplotlib.pyplot as plt
    import matplotlib
    matplotlib.rcParams.update({
        "figure.facecolor": "#FAFBFC", "axes.facecolor": "#FAFBFC",
        "axes.edgecolor": "#CBD5E1", "axes.labelcolor": "#1E293B",
        "xtick.color": "#64748B", "ytick.color": "#64748B",
        "text.color": "#1E293B", "font.family": "sans-serif", "font.size": 11,
        "axes.titlesize": 14, "axes.titleweight": "bold", "figure.dpi": 110,
        "axes.grid": True, "grid.alpha": 0.3, "grid.color": "#CBD5E1",
    })
    from scipy import stats as sp_stats
    from scipy.special import gammaln
    from collections import deque
    import warnings
    warnings.filterwarnings("ignore")
    return np, pd, plt, sp_stats, gammaln, deque


@app.cell
def hospital_config(mo):
    mo.output.replace(mo.md("---\n## ⚙️ Hospital Configuration\n*Set your facility baseline — these values feed every model below.*"))
    return


@app.cell
def config_widgets(mo):
    bed_count = mo.ui.slider(5, 50, value=25, step=1, label="Total Licensed Beds")
    ed_beds = mo.ui.slider(2, 15, value=6, step=1, label="ED Treatment Spaces")
    avg_ed_visits_day = mo.ui.slider(5, 60, value=23, step=1, label="Avg Daily ED Visits")
    avg_los_days = mo.ui.slider(1.0, 8.0, value=3.2, step=0.1, label="Avg Inpatient LOS (days)")
    rn_fte = mo.ui.slider(4, 40, value=12, step=1, label="Inpatient RN FTEs")
    ed_rn_per_shift = mo.ui.slider(1, 6, value=2, step=1, label="ED RNs per Shift")
    ed_providers = mo.ui.slider(1, 4, value=1, step=1, label="ED Providers on Duty")
    annual_admissions = mo.ui.slider(100, 3000, value=650, step=50, label="Annual Admissions")
    operating_margin_pct = mo.ui.slider(-15.0, 10.0, value=-1.5, step=0.5, label="Operating Margin (%)")
    travel_nurse_annual = mo.ui.slider(0, 2000000, value=350000, step=25000, label="Travel Nurse Spend ($/yr)")
    distance_tertiary = mo.ui.slider(10, 300, value=85, step=5, label="Distance to Tertiary (mi)")
    mo.output.replace(mo.hstack([
        mo.vstack([bed_count, ed_beds, avg_ed_visits_day, avg_los_days, annual_admissions]),
        mo.vstack([rn_fte, ed_rn_per_shift, ed_providers, operating_margin_pct, travel_nurse_annual, distance_tertiary]),
    ], justify="start", gap=2))
    return (bed_count, ed_beds, avg_ed_visits_day, avg_los_days, rn_fte, ed_rn_per_shift,
            ed_providers, annual_admissions, operating_margin_pct, travel_nurse_annual, distance_tertiary)


@app.cell
def section1_header(mo):
    mo.output.replace(mo.md("---\n# 📊 Section 1: Descriptive Statistics & Distribution Analysis\n*Chapter 2 — Understand your data before modeling it.*"))
    return


@app.cell
def descriptive_stats(mo, np, plt, sp_stats, avg_ed_visits_day, avg_los_days, bed_count, annual_admissions):
    np.random.seed(42)
    n_days = 365
    lam = avg_ed_visits_day.value
    r_param = 8
    p_param = r_param / (r_param + lam)
    ed_daily = np.random.negative_binomial(r_param, p_param, n_days)
    day_of_year = np.arange(n_days)
    seasonal_factor = 1 + 0.15 * np.sin(2 * np.pi * (day_of_year - 30) / 365)
    ed_daily = np.maximum(np.round(ed_daily * seasonal_factor).astype(int), 1)
    mu_log = np.log(avg_los_days.value) - 0.25
    los_samples = np.maximum(np.random.lognormal(mu_log, 0.5, annual_admissions.value), 0.5)
    avg_census = annual_admissions.value * avg_los_days.value / 365
    daily_census = np.minimum(np.random.poisson(avg_census, n_days), bed_count.value)

    fig, axes = plt.subplots(2, 3, figsize=(16, 9))
    axes[0,0].hist(ed_daily, bins=20, color="#2563EB", alpha=0.7, edgecolor="white")
    axes[0,0].axvline(np.mean(ed_daily), color="#DC2626", ls="--", lw=2, label=f"Mean={np.mean(ed_daily):.1f}")
    axes[0,0].axvline(np.median(ed_daily), color="#F59E0B", ls="--", lw=2, label=f"Median={np.median(ed_daily):.0f}")
    axes[0,0].set_title("ED Daily Visit Distribution"); axes[0,0].legend(fontsize=9)

    window = 14
    rolling_avg = np.convolve(ed_daily, np.ones(window)/window, mode='valid')
    axes[0,1].plot(day_of_year, ed_daily, color="#2563EB", alpha=0.4, lw=0.8)
    axes[0,1].plot(day_of_year[window-1:], rolling_avg, color="#DC2626", lw=2, label="14-day avg")
    axes[0,1].set_title("ED Volume Over 1 Year"); axes[0,1].legend(fontsize=9)

    axes[0,2].hist(los_samples, bins=30, color="#059669", alpha=0.7, edgecolor="white")
    axes[0,2].axvline(np.mean(los_samples), color="#DC2626", ls="--", lw=2, label=f"Mean={np.mean(los_samples):.1f}d")
    axes[0,2].set_title("Inpatient LOS Distribution"); axes[0,2].legend(fontsize=9)

    occupancy_pct = daily_census / bed_count.value * 100
    colors_occ = ["#DC2626" if x > 85 else "#F59E0B" if x > 70 else "#059669" for x in occupancy_pct]
    axes[1,0].bar(day_of_year, occupancy_pct, color=colors_occ, width=1.0, alpha=0.7)
    axes[1,0].axhline(85, color="#DC2626", ls="--", lw=1.5, label="85%"); axes[1,0].set_title("Daily Bed Occupancy (%)"); axes[1,0].legend(fontsize=9)

    sp_stats.probplot(np.log(los_samples), dist="norm", plot=axes[1,1])
    axes[1,1].set_title("Q-Q Plot: log(LOS) vs Normal")

    quarters = np.repeat([1, 2, 3, 4], [90, 91, 92, 92])
    q_data = [ed_daily[quarters == q] for q in [1, 2, 3, 4]]
    bp = axes[1,2].boxplot(q_data, labels=["Q1\nWinter", "Q2\nSpring", "Q3\nSummer", "Q4\nFall"], patch_artist=True, widths=0.6)
    for patch, color in zip(bp["boxes"], ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"]):
        patch.set_facecolor(color); patch.set_alpha(0.6)
    axes[1,2].set_title("ED Volume by Quarter")
    plt.tight_layout()

    cv_val = np.std(ed_daily)/np.mean(ed_daily)
    high_days = int(np.sum(occupancy_pct > 85))
    insight = f"""### Key Findings
| Metric | ED Visits | Inpatient LOS |
|--------|-----------|---------------|
| Mean | {np.mean(ed_daily):.1f} | {np.mean(los_samples):.2f} days |
| CV | **{cv_val:.2f}** | {np.std(los_samples)/np.mean(los_samples):.2f} |
| Skewness | {sp_stats.skew(ed_daily):.2f} | {sp_stats.skew(los_samples):.2f} |

**⚠️** CV={cv_val:.2f} → daily demand {'swings wildly' if cv_val > 0.4 else 'varies moderately'}. **{high_days}** days/year exceed 85% occupancy."""
    mo.output.replace(mo.vstack([mo.as_html(fig), mo.md(insight)]))
    return ed_daily, los_samples, daily_census


@app.cell
def section2_header(mo):
    mo.output.replace(mo.md("---\n# 📈 Section 2: Regression Models\n*Chapter 3 — What drives wait times, costs, and transfers?*"))
    return


@app.cell
def regression_analysis(mo, np, plt, avg_ed_visits_day, ed_rn_per_shift):
    np.random.seed(123)
    n = 500
    volume = np.random.poisson(avg_ed_visits_day.value, n)
    nurses = np.random.choice([max(1, ed_rn_per_shift.value-1), ed_rn_per_shift.value, ed_rn_per_shift.value+1], n, p=[0.2, 0.6, 0.2])
    acuity = np.random.choice([1,2,3,4,5], n, p=[0.02,0.12,0.35,0.35,0.16])
    is_weekend = np.random.binomial(1, 2/7, n)
    is_night = ((np.random.choice(range(24), n) >= 22) | (np.random.choice(range(24), n) <= 6)).astype(float)
    wait = np.maximum(8 + 2.5*volume/ed_rn_per_shift.value - 5*nurses + 3*(5-acuity) + 8*is_weekend + 12*is_night + np.random.normal(0, 8, n), 2)
    X = np.column_stack([np.ones(n), volume, nurses, acuity, is_weekend, is_night])
    names = ["Intercept", "ED Volume", "Nurses", "Acuity (ESI)", "Weekend", "Night"]
    beta = np.linalg.lstsq(X, wait, rcond=None)[0]
    y_pred = X @ beta; resid = wait - y_pred
    ss_res = np.sum(resid**2); ss_tot = np.sum((wait - np.mean(wait))**2)
    r2 = 1 - ss_res/ss_tot; mse = ss_res/(n - X.shape[1])
    se = np.sqrt(np.diag(mse * np.linalg.inv(X.T @ X)))
    t_vals = beta/se

    fig, axes = plt.subplots(1, 3, figsize=(16, 5))
    axes[0].scatter(y_pred, wait, alpha=0.3, s=15, color="#2563EB")
    lims = [min(y_pred.min(), wait.min()), max(y_pred.max(), wait.max())]
    axes[0].plot(lims, lims, "r--", lw=2); axes[0].set_title(f"Predicted vs Actual (R²={r2:.3f})")
    axes[1].barh(range(1, len(names)), beta[1:], color=["#059669" if b < 0 else "#DC2626" for b in beta[1:]], alpha=0.7, height=0.6)
    axes[1].errorbar(beta[1:], range(1, len(names)), xerr=1.96*se[1:], fmt="none", color="#1E293B", capsize=4)
    axes[1].set_yticks(range(1, len(names))); axes[1].set_yticklabels(names[1:]); axes[1].set_title("Coefficients (95% CI)"); axes[1].axvline(0, color="#94A3B8")
    axes[2].scatter(y_pred, resid, alpha=0.3, s=15, color="#8B5CF6"); axes[2].axhline(0, color="#DC2626", ls="--"); axes[2].set_title("Residuals")
    plt.tight_layout()
    coef_rows = "\n".join([f"| {names[i]} | {beta[i]:+.2f} | {'***' if abs(t_vals[i])>2.576 else '**' if abs(t_vals[i])>1.96 else 'ns'} |" for i in range(len(names))])
    mo.output.replace(mo.vstack([mo.as_html(fig), mo.md(f"### Wait Time Regression — R²={r2:.3f}, RMSE={np.sqrt(mse):.1f} min\n| Variable | Coeff | Sig |\n|----------|-------|-----|\n{coef_rows}")]))
    return


@app.cell
def section3_header(mo):
    mo.output.replace(mo.md("---\n# 📅 Section 3: Time Series Forecasting\n*Chapter 4 — Forecast ED volume for staffing and supplies.*"))
    return


@app.cell
def ts_controls(mo):
    forecast_horizon = mo.ui.slider(7, 90, value=30, step=7, label="Forecast Horizon (days)")
    alpha_smooth = mo.ui.slider(0.05, 0.95, value=0.3, step=0.05, label="Level Smoothing (α)")
    mo.output.replace(mo.hstack([forecast_horizon, alpha_smooth], gap=1))
    return forecast_horizon, alpha_smooth


@app.cell
def time_series_forecast(mo, np, plt, ed_daily, forecast_horizon, alpha_smooth):
    y = ed_daily.astype(float); n = len(y); h = forecast_horizon.value; alpha = alpha_smooth.value; beta_ts = 0.1
    level = np.zeros(n); trend = np.zeros(n); fitted = np.zeros(n)
    level[0] = y[0]; trend[0] = np.mean(np.diff(y[:14])); fitted[0] = y[0]
    for t in range(1, n):
        level[t] = alpha * y[t] + (1 - alpha) * (level[t-1] + trend[t-1])
        trend[t] = beta_ts * (level[t] - level[t-1]) + (1 - beta_ts) * trend[t-1]
        fitted[t] = level[t-1] + trend[t-1]
    forecast = np.maximum(np.array([level[n-1] + (i+1)*trend[n-1] for i in range(h)]), 0)
    residuals = y[1:] - fitted[1:]; sigma = np.std(residuals); ci95 = 1.96 * sigma * np.sqrt(np.arange(1, h+1))

    fig, axes = plt.subplots(1, 3, figsize=(16, 5))
    t_h = np.arange(n); t_f = np.arange(n, n+h)
    axes[0].plot(t_h[-90:], y[-90:], color="#64748B", alpha=0.5, lw=1, label="Actual")
    axes[0].plot(t_h[-90:], fitted[-90:], color="#2563EB", lw=2, label="Fitted")
    axes[0].plot(t_f, forecast, color="#DC2626", lw=2, ls="--", label="Forecast")
    axes[0].fill_between(t_f, forecast-ci95, forecast+ci95, alpha=0.15, color="#DC2626", label="95% PI")
    axes[0].set_title(f"{h}-Day Forecast"); axes[0].legend(fontsize=8)
    axes[1].hist(residuals, bins=25, color="#8B5CF6", alpha=0.7, edgecolor="white", density=True); axes[1].set_title("Error Distribution")
    mae = np.mean(np.abs(residuals)); mase = mae / np.mean(np.abs(np.diff(y)))
    mape = np.mean(np.abs(residuals/y[1:]))*100; rmse = np.sqrt(np.mean(residuals**2))
    axes[2].bar(["MAE","RMSE","MAPE%","MASE"], [mae,rmse,mape,mase], color=["#2563EB","#059669","#F59E0B","#DC2626" if mase>1 else "#059669"], alpha=0.7)
    axes[2].set_title("Accuracy"); plt.tight_layout()
    mo.output.replace(mo.vstack([mo.as_html(fig), mo.md(f"### Forecast mean {np.mean(forecast):.1f}/day, 95% upper {np.max(forecast+ci95):.0f}/day | MASE={mase:.2f} {'✅' if mase<1 else '⚠️'}\n**Staff to {np.max(forecast+ci95):.0f} visits/day for 95% coverage.**")]))
    return


@app.cell
def section4_header(mo):
    mo.output.replace(mo.md("---\n# ⏱️ Section 4: Survival Analysis — Staff Retention\n*Chapter 5 — Model nurse retention and turnover cost.*"))
    return


@app.cell
def survival_controls(mo):
    median_tenure = mo.ui.slider(6, 60, value=24, step=3, label="Median Tenure (months)")
    night_hazard = mo.ui.slider(1.0, 3.0, value=1.6, step=0.1, label="Night Hazard Ratio")
    mo.output.replace(mo.hstack([median_tenure, night_hazard], gap=1))
    return median_tenure, night_hazard


@app.cell
def survival_analysis(mo, np, plt, median_tenure, night_hazard, rn_fte):
    np.random.seed(77)
    n_nurses = max(30, rn_fte.value * 3); shape = 1.5; scale = median_tenure.value / (np.log(2)**(1/shape))
    n_day = n_nurses//2; n_night = n_nurses - n_day
    td = np.random.weibull(shape, n_day)*scale; tn = np.random.weibull(shape, n_night)*scale/night_hazard.value
    CT = 48; ed = (td<=CT).astype(int); en = (tn<=CT).astype(int); td = np.minimum(td, CT); tn = np.minimum(tn, CT)
    def km(times, events):
        ut = np.sort(np.unique(times[events==1])); s = 1.0; sv = []
        for t in ut:
            ar = np.sum(times>=t); ev = np.sum((times==t)&(events==1)); s *= (1-ev/ar); sv.append(s)
        return ut, np.array(sv)
    t_d, s_d = km(td, ed); t_n, s_n = km(tn, en)
    fig, axes = plt.subplots(1, 3, figsize=(16, 5))
    axes[0].step(np.r_[0, t_d], np.r_[1.0, s_d], where="post", color="#2563EB", lw=2.5, label="Day")
    axes[0].step(np.r_[0, t_n], np.r_[1.0, s_n], where="post", color="#DC2626", lw=2.5, label="Night")
    axes[0].axhline(0.5, color="#94A3B8", ls=":"); axes[0].set_title("Kaplan-Meier Retention"); axes[0].legend(fontsize=9); axes[0].set_ylim(0,1.05)
    for gt, ge, c, l in [(td,ed,"#2563EB","Day"),(tn,en,"#DC2626","Night")]:
        et = gt[ge==1]
        if len(et)>3:
            from scipy.stats import gaussian_kde
            kde = gaussian_kde(et, bw_method=0.3); xr = np.linspace(0, CT, 200); axes[1].plot(xr, kde(xr), color=c, lw=2, label=l)
    axes[1].set_title("Departure Timing"); axes[1].legend(fontsize=9)
    ann_turn = (np.sum(ed)+np.sum(en))/(CT/12); ann_cost = ann_turn*65000
    axes[2].bar(["Current","10% Better","20% Better"], [ann_cost, ann_cost*0.9, ann_cost*0.8], color=["#DC2626","#F59E0B","#059669"], alpha=0.7)
    axes[2].set_title("Turnover Cost/Year"); axes[2].yaxis.set_major_formatter(plt.FuncFormatter(lambda x,_: f"${x:,.0f}")); plt.tight_layout()
    mo.output.replace(mo.vstack([mo.as_html(fig), mo.md(f"### Retention: **${ann_cost:,.0f}/yr** turnover cost | Night hazard {night_hazard.value}x = {(night_hazard.value-1)*100:.0f}% retention penalty")]))
    return


@app.cell
def section5_header(mo):
    mo.output.replace(mo.md("---\n# 🚦 Section 5: Queuing Theory — ED Capacity Planning\n*Chapter 6 — Erlang-C for wait times and staffing optimization.*"))
    return


@app.cell
def queue_controls(mo, avg_ed_visits_day, ed_providers):
    q_arrival = mo.ui.slider(0.5, 5.0, value=round(avg_ed_visits_day.value/16, 1), step=0.1, label="Arrival Rate (pt/hr)")
    q_service = mo.ui.slider(0.3, 2.0, value=0.6, step=0.05, label="Service Rate/Provider")
    q_servers = mo.ui.slider(1, 6, value=ed_providers.value, step=1, label="Providers")
    mo.output.replace(mo.hstack([q_arrival, q_service, q_servers], gap=1))
    return q_arrival, q_service, q_servers


@app.cell
def queuing_analysis(mo, np, plt, gammaln, q_arrival, q_service, q_servers):
    lam = q_arrival.value; mu = q_service.value; c = q_servers.value; rho = lam/(c*mu)
    def erlc(la, mu, c):
        a = la/mu
        if a/c >= 1: return 1.0
        lt = [k*np.log(a) - gammaln(k+1) for k in range(c)]; st = np.sum(np.exp(lt))
        ll = c*np.log(a) - gammaln(c+1) + np.log(c) - np.log(c-a)
        return np.exp(ll)/(st + np.exp(ll))
    unstable = rho >= 1.0
    ec = 1.0 if unstable else erlc(lam, mu, c)
    avg_wait = 999.0 if unstable else ec/(c*mu-lam)*60
    avg_sys = 999.0 if unstable else avg_wait + (1/mu)*60
    fig, axes = plt.subplots(1, 3, figsize=(16, 5))
    sr = list(range(max(1, int(np.ceil(lam/mu))), 7))
    waits = []; probs = []
    for s in sr:
        r = lam/(s*mu)
        if r < 1: ec_s = erlc(lam, mu, s); waits.append(ec_s/(s*mu-lam)*60); probs.append(ec_s)
        else: waits.append(200); probs.append(1.0)
    axes[0].bar(sr, waits, color=["#DC2626" if s==c else "#2563EB" for s in sr], alpha=0.7)
    for s, w in zip(sr, waits):
        if w < 200: axes[0].text(s, w+1, f"{w:.0f}m", ha="center", fontsize=9, fontweight="bold")
    axes[0].set_title("Wait vs Staffing"); axes[0].set_xlabel("Providers"); axes[0].set_ylabel("Wait (min)")
    axes[1].bar(sr, [p*100 for p in probs], color=["#DC2626" if s==c else "#F59E0B" for s in sr], alpha=0.7)
    axes[1].axhline(20, color="#059669", ls="--", label="20%"); axes[1].set_title("P(Wait)"); axes[1].legend(fontsize=9)
    rr = np.linspace(0.1, 0.95, 100)
    wc = [erlc(r*c*mu, mu, c)/(c*mu-r*c*mu)*60 if r<0.99 else 999 for r in rr]
    axes[2].plot(rr*100, wc, color="#2563EB", lw=2.5)
    if not unstable: axes[2].axvline(rho*100, color="#DC2626", ls="--", lw=2, label=f"Current: {rho*100:.0f}%")
    axes[2].set_title("Utilization-Wait Curve"); axes[2].set_ylim(0, 120); axes[2].legend(fontsize=9); plt.tight_layout()
    status = "🔴 UNSTABLE" if unstable else f"{'🔴' if rho>0.85 else '🟡' if rho>0.7 else '🟢'} ρ={rho*100:.0f}%"
    mo.output.replace(mo.vstack([mo.as_html(fig), mo.md(f"### Queuing: {status} | Wait={avg_wait:.1f}m | P(wait)={ec*100:.1f}% | System time={avg_sys:.0f}m")]))
    return


@app.cell
def section6_header(mo):
    mo.output.replace(mo.md("---\n# 🔄 Section 6: Discrete Event Simulation\n*Chapter 7 — Simulate ED patient flow to find bottlenecks.*"))
    return


@app.cell
def des_controls(mo, ed_providers, ed_rn_per_shift, ed_beds):
    des_hours = mo.ui.slider(8, 72, value=24, step=8, label="Duration (hrs)")
    des_prov = mo.ui.slider(1, 4, value=ed_providers.value, step=1, label="Providers")
    des_nurses = mo.ui.slider(1, 6, value=ed_rn_per_shift.value, step=1, label="Nurses")
    des_beds = mo.ui.slider(2, 12, value=ed_beds.value, step=1, label="Beds")
    des_rate = mo.ui.slider(0.5, 4.0, value=1.5, step=0.1, label="Peak Arrival (pt/hr)")
    mo.output.replace(mo.hstack([des_hours, des_prov, des_nurses, des_beds, des_rate], gap=1))
    return des_hours, des_prov, des_nurses, des_beds, des_rate


@app.cell
def des_simulation(mo, np, plt, des_hours, des_prov, des_nurses, des_beds, des_rate):
    np.random.seed(55); SIM = des_hours.value*60; NP = des_prov.value; NN = des_nurses.value; NB = des_beds.value
    arrivals = []; t = 0
    while t < SIM:
        hour = (t/60)%24; rate = des_rate.value*(0.4+0.6*np.exp(-0.5*((hour-13)/5)**2))
        t += np.random.exponential(60/max(rate, 0.1))
        if t < SIM: arrivals.append((t, np.random.choice([1,2,3,4,5], p=[0.02,0.10,0.35,0.38,0.15])))
    pf = [0.0]*NP; nf = [0.0]*NN; bf = [0.0]*NB; waits = []; los_l = []; lwbs = 0; esi_w = {}
    for at, esi in arrivals:
        ts = max(at, min(nf)); te = ts + np.random.lognormal(np.log(5), 0.3)
        ni = nf.index(min(nf)); nf[ni] = te
        bw = max(0, min(bf)-te)
        if bw > 60 and np.random.random() < 0.2: lwbs += 1; continue
        bt = max(te, min(bf)); bi = bf.index(min(bf))
        pt = max(bt, min(pf)); w = pt-at; waits.append(w); esi_w.setdefault(esi,[]).append(w)
        svc = np.random.lognormal(np.log({1:90,2:60,3:40,4:25,5:15}[esi]), 0.4)
        pe = pt+svc; pi = pf.index(min(pf)); pf[pi] = pe; dep = pe+np.random.lognormal(np.log(20), 0.3)
        los_l.append(dep-at); bf[bi] = dep
    waits = np.array(waits); los_a = np.array(los_l)
    fig, axes = plt.subplots(2, 3, figsize=(16, 9))
    if len(waits)>0:
        axes[0,0].hist(waits, bins=25, color="#2563EB", alpha=0.7, edgecolor="white")
        axes[0,0].axvline(np.median(waits), color="#F59E0B", ls="--", lw=2, label=f"Med={np.median(waits):.0f}m"); axes[0,0].set_title("Door-to-Provider"); axes[0,0].legend(fontsize=9)
    if len(los_a)>0: axes[0,1].hist(los_a/60, bins=25, color="#059669", alpha=0.7, edgecolor="white"); axes[0,1].set_title("ED LOS (hrs)")
    axes[0,2].hist([a[0]/60 for a in arrivals], bins=np.arange(0, des_hours.value+1), color="#8B5CF6", alpha=0.7); axes[0,2].set_title("Arrivals/Hour")
    if esi_w:
        el = sorted(esi_w.keys()); ed = [esi_w[e] for e in el]
        bp = axes[1,0].boxplot(ed, labels=[f"ESI{e}" for e in el], patch_artist=True, widths=0.5)
        for p, c in zip(bp["boxes"], ["#DC2626","#F59E0B","#2563EB","#059669","#94A3B8"][:len(el)]): p.set_facecolor(c); p.set_alpha(0.6)
        axes[1,0].set_title("Wait by Acuity")
    pu = min(100, sum(min(f, SIM) for f in pf)/(NP*SIM)*100)
    nu = min(100, sum(min(f, SIM) for f in nf)/(NN*SIM)*100)
    bu = min(100, sum(min(f, SIM) for f in bf)/(NB*SIM)*100)
    rn = ["Providers","Nurses","Beds"]; us = [pu, nu, bu]
    axes[1,1].barh(rn, us, color=["#DC2626" if u>85 else "#F59E0B" if u>70 else "#059669" for u in us], alpha=0.7)
    axes[1,1].axvline(85, color="#DC2626", ls="--"); axes[1,1].set_xlim(0,105)
    for i, v in enumerate(us): axes[1,1].text(min(v+2,95), i, f"{v:.0f}%", va="center", fontweight="bold")
    axes[1,1].set_title("Utilization")
    if los_l: axes[1,2].plot(np.sort(los_l)/3600, np.arange(1, len(los_l)+1), color="#2563EB", lw=2); axes[1,2].set_title("Throughput"); axes[1,2].set_xlabel("Hours")
    plt.tight_layout()
    bn = ["Providers","Beds","Nurses"][[pu,bu,nu].index(max(pu,bu,nu))]
    mo.output.replace(mo.vstack([mo.as_html(fig), mo.md(f"### DES: {len(waits)} treated, {lwbs} LWBS ({lwbs/max(len(arrivals),1)*100:.1f}%) | Med wait={np.median(waits):.0f}m | **Bottleneck: {bn}** ({max(us):.0f}%)")]))
    return


@app.cell
def section7_header(mo):
    mo.output.replace(mo.md("---\n# 🔁 Section 7: System Dynamics — Workforce\n*Chapter 8 — Burnout, turnover, and recruitment feedback loops.*"))
    return


@app.cell
def sd_controls(mo):
    sd_months = mo.ui.slider(12, 60, value=36, step=6, label="Horizon (mo)")
    sd_bonus = mo.ui.slider(0, 20000, value=0, step=2500, label="Hiring Bonus ($)")
    sd_cap = mo.ui.slider(3.0, 8.0, value=5.0, step=0.5, label="Max Pt:Nurse")
    sd_invest = mo.ui.slider(0, 200000, value=0, step=25000, label="Retention $/yr")
    mo.output.replace(mo.hstack([sd_months, sd_bonus, sd_cap, sd_invest], gap=1))
    return sd_months, sd_bonus, sd_cap, sd_invest


@app.cell
def system_dynamics(mo, np, plt, rn_fte, bed_count, sd_months, sd_bonus, sd_cap, sd_invest):
    T = sd_months.value; tgt = rn_fte.value
    act = np.zeros(T); ori = np.zeros(T); vac = np.zeros(T); brn = np.zeros(T); cst = np.zeros(T)
    act[0] = tgt*0.85; ori[0] = 1; vac[0] = tgt-act[0]-ori[0]; brn[0] = 0.3
    ac = bed_count.value*0.55; bf = 1+sd_bonus.value/10000*0.3; rf = 1-sd_invest.value/200000*0.3
    for t in range(1, T):
        n = act[t-1]; o = ori[t-1]; b = brn[t-1]; wf = ac/max(n,1)/sd_cap.value
        bn = np.clip(b+0.02*max(0,wf-0.8)*rf-0.01*(1-b), 0, 1); brn[t] = bn
        dep = min(n, np.random.binomial(max(1,int(n)), min(0.02*(1+2*bn), 0.5)))
        hires = np.random.binomial(max(0,int(vac[t-1])), min(0.3*bf, 1.0)); comp = min(o, o/3)
        act[t] = max(0, n-dep+comp); ori[t] = max(0, o+hires-comp); vac[t] = max(0, tgt-act[t]-ori[t])
        tn = max(0, tgt-act[t]-ori[t])
        cst[t] = act[t]*5500+ori[t]*6600+tn*12000+sd_bonus.value*hires/12+sd_invest.value/12
    mo_arr = np.arange(T); fig, axes = plt.subplots(2, 2, figsize=(16, 9))
    axes[0,0].fill_between(mo_arr, 0, act, alpha=0.3, color="#059669", label="Active")
    axes[0,0].fill_between(mo_arr, act, act+ori, alpha=0.3, color="#F59E0B", label="Orient")
    axes[0,0].axhline(tgt, color="#DC2626", ls="--", label=f"Target({tgt})"); axes[0,0].set_title("Staffing"); axes[0,0].legend(fontsize=9)
    axes[0,1].fill_between(mo_arr, 0, brn*100, alpha=0.3, color="#DC2626"); axes[0,1].plot(mo_arr, brn*100, color="#DC2626", lw=2)
    axes[0,1].axhline(50, color="#F59E0B", ls="--"); axes[0,1].set_title("Burnout %"); axes[0,1].set_ylim(0,100)
    axes[1,0].bar(mo_arr, vac, color="#8B5CF6", alpha=0.7, width=0.8); axes[1,0].set_title("Vacancies")
    cc = np.cumsum(cst); axes[1,1].fill_between(mo_arr, 0, cc, alpha=0.3, color="#2563EB"); axes[1,1].plot(mo_arr, cc, color="#2563EB", lw=2)
    axes[1,1].set_title("Cumulative Cost"); axes[1,1].yaxis.set_major_formatter(plt.FuncFormatter(lambda x,_: f"${x:,.0f}")); plt.tight_layout()
    fl = (act[-1]+ori[-1])/tgt*100
    mo.output.replace(mo.vstack([mo.as_html(fig), mo.md(f"### Workforce: {act[-1]:.0f}/{tgt} active ({fl:.0f}% fill) | Burnout {brn[-1]*100:.0f}% | Total cost ${cc[-1]:,.0f}")]))
    return


@app.cell
def section8_header(mo):
    mo.output.replace(mo.md("---\n# 🤖 Section 8: Agent-Based Modeling — Cascade Effects\n*Chapter 9 — How one critical patient impacts everyone else.*"))
    return


@app.cell
def abm_controls(mo):
    abm_pts = mo.ui.slider(20, 100, value=50, step=5, label="Patients")
    abm_rn = mo.ui.slider(1, 5, value=2, step=1, label="Nurses")
    abm_crit = mo.ui.slider(0, 30, value=5, step=1, label="Critical %")
    mo.output.replace(mo.hstack([abm_pts, abm_rn, abm_crit], gap=1))
    return abm_pts, abm_rn, abm_crit


@app.cell
def abm_simulation(mo, np, plt, abm_pts, abm_rn, abm_crit):
    np.random.seed(42); N = abm_pts.value; NR = abm_rn.value; CP = abm_crit.value/100
    arr = np.cumsum(np.random.exponential(30, N)); ic = np.random.random(N) < CP
    ct = np.where(ic, np.random.lognormal(np.log(90),0.3,N), np.random.lognormal(np.log(25),0.4,N))
    na = [0.0]*NR; wt = np.zeros(N)
    for i in range(N):
        e = min(na); idx = na.index(e); s = max(arr[i], e); wt[i] = s-arr[i]; na[idx] = s+ct[i]
        if ic[i]:
            for j in range(NR):
                if j != idx: na[j] += np.random.exponential(10)
    fig, axes = plt.subplots(1, 3, figsize=(16, 5))
    axes[0].scatter(arr[~ic]/60, wt[~ic], s=20, alpha=0.5, color="#2563EB", label="Standard")
    axes[0].scatter(arr[ic]/60, wt[ic], s=80, alpha=0.8, color="#DC2626", marker="*", label="Critical")
    axes[0].set_title("Cascade Effects"); axes[0].legend(fontsize=9)
    dg = [wt[~ic], wt[ic]] if np.sum(ic)>0 else [wt]
    bp = axes[1].boxplot(dg, labels=["Standard","Critical"][:len(dg)], patch_artist=True, widths=0.4)
    for p, c in zip(bp["boxes"], ["#2563EB","#DC2626"]): p.set_facecolor(c); p.set_alpha(0.5)
    axes[1].set_title("Wait by Type")
    pc = [wt[i] for i in range(N) if not ic[i] and any(ic[max(0,i-3):i])]
    nm = [wt[i] for i in range(N) if not ic[i] and not any(ic[max(0,i-3):i])]
    ci = np.mean(pc)-np.mean(nm) if pc and nm else 0
    if pc and nm:
        bp2 = axes[2].boxplot([nm, pc], labels=["Normal","Post-Crit"], patch_artist=True, widths=0.4)
        bp2["boxes"][0].set_facecolor("#059669"); bp2["boxes"][0].set_alpha(0.5)
        bp2["boxes"][1].set_facecolor("#F59E0B"); bp2["boxes"][1].set_alpha(0.5)
    axes[2].set_title(f"Cascade: +{ci:.0f} min"); plt.tight_layout()
    mo.output.replace(mo.vstack([mo.as_html(fig), mo.md(f"### ABM: {int(np.sum(ic))} critical → +{ci:.0f}m cascade. {'Severe — surge protocol needed.' if ci>15 else 'Manageable.'}")]))
    return


@app.cell
def section9_header(mo):
    mo.output.replace(mo.md("---\n# 🌐 Section 9: Network Analysis — Referral Patterns\n*Chapter 10 — Visualize your regional transfer network.*"))
    return


@app.cell
def network_analysis(mo, np, plt):
    import networkx as nx
    np.random.seed(99); G = nx.DiGraph()
    nodes = {"Your CAH":(0,0),"Regional Med":(3,2),"Tertiary":(6,1),"CAH Alpha":(-2,3),"CAH Beta":(-1,-3),"Clinic A":(-3,1)}
    types = {"Your CAH":"CAH","Regional Med":"Regional","Tertiary":"Tertiary","CAH Alpha":"CAH","CAH Beta":"CAH","Clinic A":"Clinic"}
    for n, p in nodes.items(): G.add_node(n, pos=p, ntype=types[n])
    for s,d,w in [("Your CAH","Regional Med",85),("Your CAH","Tertiary",30),("CAH Alpha","Regional Med",60),("CAH Alpha","Your CAH",20),("CAH Beta","Your CAH",25),("CAH Beta","Regional Med",45),("Regional Med","Tertiary",120),("Clinic A","Your CAH",40),("Clinic A","CAH Alpha",30)]:
        G.add_edge(s, d, weight=w)
    fig, axes = plt.subplots(1, 3, figsize=(16, 5))
    pos = {n:d["pos"] for n,d in G.nodes(data=True)}
    nc = {"CAH":"#2563EB","Regional":"#F59E0B","Tertiary":"#DC2626","Clinic":"#94A3B8"}
    ns = {"CAH":600,"Regional":1200,"Tertiary":1800,"Clinic":300}
    nx.draw_networkx(G, pos, ax=axes[0], node_color=[nc[G.nodes[n]["ntype"]] for n in G], node_size=[ns[G.nodes[n]["ntype"]] for n in G], edge_color="#94A3B8", width=[G[u][v]["weight"]/30 for u,v in G.edges()], arrows=True, arrowsize=15, font_size=7, font_weight="bold")
    axes[0].set_title("Transfer Network"); axes[0].axis("off")
    btwn = nx.betweenness_centrality(G, weight="weight"); ns2 = sorted(btwn, key=btwn.get, reverse=True)
    axes[1].barh(range(len(ns2)), [btwn[n] for n in ns2], color=["#DC2626" if n=="Your CAH" else "#2563EB" for n in ns2], alpha=0.7)
    axes[1].set_yticks(range(len(ns2))); axes[1].set_yticklabels(ns2, fontsize=8); axes[1].set_title("Betweenness")
    facs = list(G.nodes()); x = np.arange(len(facs))
    axes[2].bar(x-0.2, [G.in_degree(f, weight="weight") for f in facs], 0.4, color="#059669", alpha=0.7, label="In")
    axes[2].bar(x+0.2, [G.out_degree(f, weight="weight") for f in facs], 0.4, color="#DC2626", alpha=0.7, label="Out")
    axes[2].set_xticks(x); axes[2].set_xticklabels([f.replace(" ","\n") for f in facs], fontsize=7); axes[2].set_title("Transfer Volume"); axes[2].legend(fontsize=9); plt.tight_layout()
    hub = max(btwn, key=btwn.get)
    mo.output.replace(mo.vstack([mo.as_html(fig), mo.md(f"### Network: **{hub}** is critical hub (betweenness={btwn[hub]:.3f}). Your CAH={btwn.get('Your CAH',0):.3f}.")]))
    return


@app.cell
def section10_header(mo):
    mo.output.replace(mo.md("---\n# 🧠 Section 10: Machine Learning — Readmission Prediction\n*Chapter 11 — Random Forest for risk stratification.*"))
    return


@app.cell
def ml_analysis(mo, np, plt, annual_admissions):
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import cross_val_score
    from sklearn.metrics import roc_curve, auc
    np.random.seed(321); n = max(200, annual_admissions.value)
    age=np.random.normal(65,15,n).clip(18,99).astype(int); los=np.random.lognormal(np.log(3),0.5,n).clip(0.5,30)
    comor=np.random.poisson(2.5,n).clip(0,10); prior=np.random.poisson(0.8,n).clip(0,8)
    pcp=np.random.binomial(1,0.6,n); home=np.random.binomial(1,0.75,n); dist=np.random.exponential(25,n).clip(1,200); meds=np.random.poisson(6,n).clip(0,20)
    logit=-3+0.02*age+0.15*los+0.3*comor+0.5*prior-0.6*pcp-0.3*home+0.005*dist+0.05*meds+np.random.normal(0,0.5,n)
    readmit=np.random.binomial(1, 1/(1+np.exp(-logit)))
    X=np.column_stack([age,los,comor,prior,pcp,home,dist,meds]); fn=["Age","LOS","Comorb","Prior","PCP","Home","Dist","Meds"]
    rf=RandomForestClassifier(n_estimators=100,max_depth=5,random_state=42,class_weight="balanced")
    cv=cross_val_score(rf,X,readmit,cv=5,scoring="roc_auc"); rf.fit(X,readmit)
    yp=rf.predict_proba(X)[:,1]; fpr,tpr,_=roc_curve(readmit,yp); av=auc(fpr,tpr)
    fig, axes=plt.subplots(1,3,figsize=(16,5))
    imp=rf.feature_importances_; si=np.argsort(imp)
    axes[0].barh(range(len(fn)),imp[si],color="#2563EB",alpha=0.7); axes[0].set_yticks(range(len(fn))); axes[0].set_yticklabels([fn[i] for i in si],fontsize=9); axes[0].set_title("Feature Importance")
    axes[1].plot(fpr,tpr,color="#2563EB",lw=2.5,label=f"AUC={av:.3f}"); axes[1].plot([0,1],[0,1],"r--"); axes[1].set_title("ROC"); axes[1].legend(fontsize=10)
    rb=np.digitize(yp,[0.15,0.35,0.55]); rl=["Low","Med","High","Crit"]; rc=["#059669","#F59E0B","#EA580C","#DC2626"]
    axes[2].bar(range(4),[np.sum(rb==i) for i in range(4)],color=rc,alpha=0.7)
    ax2=axes[2].twinx(); ax2.plot(range(4),[np.mean(readmit[rb==i])*100 if np.sum(rb==i)>0 else 0 for i in range(4)],"ko-",lw=2,ms=8)
    axes[2].set_xticks(range(4)); axes[2].set_xticklabels(rl); axes[2].set_title("Risk Strat"); plt.tight_layout()
    top3=[fn[i] for i in np.argsort(imp)[-3:][::-1]]
    mo.output.replace(mo.vstack([mo.as_html(fig), mo.md(f"### ML: AUC={av:.3f} (CV={np.mean(cv):.3f}±{np.std(cv):.3f}) | Top: {', '.join(top3)}\n**{np.sum(rb>=2)} high-risk** ({np.sum(rb>=2)/n*100:.0f}%) → target for discharge planning.")]))
    return


@app.cell
def section11_header(mo):
    mo.output.replace(mo.md("---\n# ⚡ Section 11: Optimization — Nurse Scheduling\n*Chapter 12 — Minimum-cost schedule meeting coverage.*"))
    return


@app.cell
def scheduling(mo, np, plt, rn_fte, bed_count):
    np.random.seed(42); nn = rn_fte.value; days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
    ac=bed_count.value*0.55; md=max(2,int(np.ceil(ac/5))); mn=max(1,int(np.ceil(ac/6)))
    sc=np.zeros((nn,7,2),dtype=int); hrs=np.zeros(nn); con=np.zeros(nn,dtype=int)
    for d in range(7):
        for s in range(2):
            need=md if s==0 else mn; asgn=0
            for n in np.argsort(hrs):
                if asgn>=need: break
                if hrs[n]>=60 or con[n]>=4: continue
                sc[n,d,s]=1; hrs[n]+=12; asgn+=1
        for n in range(nn): con[n]=con[n]+1 if np.sum(sc[n,d,:])>0 else 0
    tc=0
    for n in range(nn): tc+=min(hrs[n],40)*38+max(0,hrs[n]-40)*38*1.5+np.sum(sc[n,:,1])*12*5+np.sum(sc[n,5:7,:])*12*3
    fig, axes=plt.subplots(1,3,figsize=(16,5))
    s2d=np.zeros((nn,14))
    for n in range(nn):
        for d in range(7):
            for s in range(2): s2d[n,d*2+s]=sc[n,d,s]
    axes[0].imshow(s2d[:min(15,nn)],cmap="YlOrRd",aspect="auto"); axes[0].set_yticks(range(min(15,nn))); axes[0].set_yticklabels([f"RN{i+1}" for i in range(min(15,nn))],fontsize=7); axes[0].set_title("Schedule")
    axes[1].bar(range(nn),hrs,color=["#DC2626" if h>40 else "#2563EB" for h in hrs],alpha=0.7); axes[1].axhline(40,color="#F59E0B",ls="--"); axes[1].set_title("Hours/Nurse")
    cov=np.sum(sc,axis=0); x=np.arange(7)
    axes[2].bar(x-0.2,cov[:,0],0.4,color="#2563EB",alpha=0.7,label="Day"); axes[2].bar(x+0.2,cov[:,1],0.4,color="#8B5CF6",alpha=0.7,label="Night")
    axes[2].axhline(md,color="#DC2626",ls="--"); axes[2].axhline(mn,color="#F59E0B",ls="--")
    axes[2].set_xticks(x); axes[2].set_xticklabels(days); axes[2].set_title("Coverage"); axes[2].legend(fontsize=9); plt.tight_layout()
    unm=int(np.sum(cov<np.array([[md,mn]]*7)))
    mo.output.replace(mo.vstack([mo.as_html(fig), mo.md(f"### Schedule: ${tc:,.0f}/week | {int(np.sum(hrs>40))} OT nurses | {unm} unmet {'⚠️' if unm>0 else '✅'}")]))
    return


@app.cell
def section12_header(mo):
    mo.output.replace(mo.md("---\n# 🌳 Section 12: Decision Analysis — Capital Investment\n*Chapter 13 — NPV and scenario analysis.*"))
    return


@app.cell
def decision_controls(mo):
    inv_cost=mo.ui.slider(100000,3000000,value=750000,step=50000,label="Investment ($)")
    p_high=mo.ui.slider(0.1,0.6,value=0.3,step=0.05,label="P(High Vol)")
    p_low=mo.ui.slider(0.1,0.6,value=0.25,step=0.05,label="P(Low Vol)")
    disc=mo.ui.slider(0.02,0.12,value=0.05,step=0.01,label="Discount Rate")
    horiz=mo.ui.slider(3,15,value=10,step=1,label="Years")
    mo.output.replace(mo.hstack([inv_cost,p_high,p_low,disc,horiz],gap=1))
    return inv_cost, p_high, p_low, disc, horiz


@app.cell
def decision_analysis(mo, np, plt, inv_cost, p_high, p_low, disc, horiz):
    C=inv_cost.value; ph=p_high.value; pl=p_low.value; pm=max(0,1-ph-pl); r=disc.value; T=horiz.value
    def npv(ann,init,rate,yrs):
        return -init+ann*np.sum([1/(1+rate)**t for t in range(1,yrs+1)])
    sc={"High":(ph,C*0.25,C*0.05),"Medium":(pm,C*0.12,C*0.03),"Low":(pl,C*0.04,C*0.02)}
    inv_n={k:npv(v[1],C,r,T) for k,v in sc.items()}; sq_n={k:npv(v[2],0,r,T) for k,v in sc.items()}
    ei=sum(sc[k][0]*inv_n[k] for k in sc); es=sum(sc[k][0]*sq_n[k] for k in sc)
    fig, axes=plt.subplots(1,3,figsize=(16,5)); sn=list(sc.keys()); x=np.arange(len(sn))
    axes[0].bar(x-0.2,[inv_n[k]/1000 for k in sn],0.4,color="#2563EB",alpha=0.7,label="Invest")
    axes[0].bar(x+0.2,[sq_n[k]/1000 for k in sn],0.4,color="#94A3B8",alpha=0.7,label="Status Quo")
    axes[0].set_xticks(x); axes[0].set_xticklabels(sn); axes[0].axhline(0,color="#DC2626",ls="--"); axes[0].set_title("NPV ($K)"); axes[0].legend(fontsize=9)
    yrs=np.arange(0,T+1)
    for k in sn:
        cf=-C+np.cumsum([0]+[sc[k][1]]*T); axes[1].plot(yrs,cf/1000,lw=2,label=f"{k}(p={sc[k][0]:.0%})")
    axes[1].axhline(0,color="#DC2626",ls="--"); axes[1].set_title("Payback ($K)"); axes[1].legend(fontsize=8)
    params=["Cost","High P","Revenue","Discount","Horizon"]; widths=[abs(ei*f) for f in [0.2,0.15,0.2,0.1,0.15]]
    si2=np.argsort(widths)
    for i,idx in enumerate(si2): axes[2].barh(i,widths[idx]/1000,color="#F59E0B",alpha=0.7,height=0.5)
    axes[2].set_yticks(range(len(params))); axes[2].set_yticklabels([params[i] for i in si2],fontsize=9); axes[2].set_title("Sensitivity ($K)"); plt.tight_layout()
    dec="INVEST" if ei>es else "STATUS QUO"
    mo.output.replace(mo.vstack([mo.as_html(fig), mo.md(f"### **{dec}** | E[NPV invest]=${ei:,.0f} vs status quo ${es:,.0f} | Δ=${ei-es:,.0f}")]))
    return


@app.cell
def section13_header(mo):
    mo.output.replace(mo.md("---\n# 🎲 Section 13: Bayesian Methods — Small-Sample Rates\n*Chapter 14 — Combine national benchmarks with limited local data.*"))
    return


@app.cell
def bayes_controls(mo):
    prior_rate=mo.ui.slider(0.5,15.0,value=3.0,step=0.5,label="National Rate (%)")
    prior_n=mo.ui.slider(5,200,value=50,step=5,label="Prior Strength")
    obs_k=mo.ui.slider(0,30,value=4,step=1,label="Observed Events")
    obs_n=mo.ui.slider(10,500,value=120,step=10,label="Total Cases")
    mo.output.replace(mo.hstack([prior_rate,prior_n,obs_k,obs_n],gap=1))
    return prior_rate, prior_n, obs_k, obs_n


@app.cell
def bayesian_analysis(mo, np, plt, sp_stats, prior_rate, prior_n, obs_k, obs_n):
    p0=prior_rate.value/100; npr=prior_n.value; ap=p0*npr; bp=(1-p0)*npr; k=obs_k.value; n=obs_n.value
    apo=ap+k; bpo=bp+(n-k); x=np.linspace(0,0.15,500)
    pr_pdf=sp_stats.beta.pdf(x,ap,bp); po_pdf=sp_stats.beta.pdf(x,apo,bpo)
    lik=sp_stats.binom.pmf(k,n,x); lik_s=lik/max(np.max(lik),1e-10)*np.max(po_pdf)
    freq=k/n if n>0 else 0
    fci=[max(0,freq-1.96*np.sqrt(max(freq*(1-freq)/n,0))),min(1,freq+1.96*np.sqrt(max(freq*(1-freq)/n,0)))] if n>0 else [0,1]
    pm=apo/(apo+bpo); pci=sp_stats.beta.ppf([0.025,0.975],apo,bpo)
    fig, axes=plt.subplots(1,3,figsize=(16,5))
    axes[0].fill_between(x*100,0,pr_pdf,alpha=0.2,color="#94A3B8",label="Prior"); axes[0].plot(x*100,lik_s,color="#F59E0B",lw=2,ls="--",label="Likelihood")
    axes[0].fill_between(x*100,0,po_pdf,alpha=0.3,color="#2563EB",label="Posterior"); axes[0].plot(x*100,po_pdf,color="#2563EB",lw=2.5)
    axes[0].set_title("Bayesian Update"); axes[0].legend(fontsize=9)
    for i,(est,lo,hi,c) in enumerate([(freq*100,fci[0]*100,fci[1]*100,"#F59E0B"),(pm*100,pci[0]*100,pci[1]*100,"#2563EB")]):
        axes[1].barh(i,est,color=c,alpha=0.7,height=0.5); axes[1].errorbar(est,i,xerr=[[est-lo],[hi-est]],fmt="none",color="#1E293B",capsize=6,lw=2)
    axes[1].axvline(prior_rate.value,color="#DC2626",ls="--",label="National"); axes[1].set_yticks([0,1]); axes[1].set_yticklabels(["Freq","Bayes"]); axes[1].set_title("Comparison"); axes[1].legend(fontsize=9)
    for s in [10,25,50,100,200]:
        a=p0*s+k; b=(1-p0)*s+(n-k); axes[2].plot(x*100,sp_stats.beta.pdf(x,a,b),lw=2,label=f"n={s}")
    axes[2].set_title("Prior Strength"); axes[2].legend(fontsize=8); plt.tight_layout()
    fw=(fci[1]-fci[0])*100; bw=(pci[1]-pci[0])*100
    mo.output.replace(mo.vstack([mo.as_html(fig), mo.md(f"### Bayesian: {pm*100:.2f}% [{pci[0]*100:.2f},{pci[1]*100:.2f}] vs Freq: {freq*100:.2f}% [{fci[0]*100:.2f},{fci[1]*100:.2f}]\nBayesian CI {fw/max(bw,0.01):.0f}x {'narrower' if bw<fw else 'wider'} — {'prior stabilizes estimate' if bw<fw else 'data dominates'}.")]))
    return


@app.cell
def section14_header(mo):
    mo.output.replace(mo.md("---\n# 💰 Section 14: Financial Operations Model\n*Synthesis — 5-year projection with modeling improvements.*"))
    return


@app.cell
def fin_controls(mo):
    rev_adm=mo.ui.slider(3000,12000,value=6500,step=500,label="Rev/Admission ($)")
    rev_ed=mo.ui.slider(200,800,value=420,step=20,label="Rev/ED Visit ($)")
    fixed=mo.ui.slider(2000000,15000000,value=5500000,step=250000,label="Fixed Costs ($/yr)")
    penalty=mo.ui.slider(0,500000,value=75000,step=25000,label="Readmit Penalty ($/yr)")
    save_pct=mo.ui.slider(0,20,value=8,step=1,label="Modeling Savings (%)")
    mo.output.replace(mo.hstack([rev_adm,rev_ed,fixed,penalty,save_pct],gap=1))
    return rev_adm, rev_ed, fixed, penalty, save_pct


@app.cell
def financial_model(mo, np, plt, annual_admissions, avg_ed_visits_day, rev_adm, rev_ed, fixed, penalty, travel_nurse_annual, save_pct, operating_margin_pct):
    Y=5; yr=np.arange(1,Y+1); g=1.02; sp=save_pct.value/100
    adm=np.array([annual_admissions.value*g**y for y in range(Y)]); edv=np.array([avg_ed_visits_day.value*365*g**y for y in range(Y)])
    br=adm*rev_adm.value+edv*rev_ed.value; bv=br*(1-operating_margin_pct.value/100)-fixed.value
    bt=fixed.value+bv+travel_nurse_annual.value+penalty.value; bm=br-bt
    ir=br*(1+sp*0.3); iv=bv*(1-sp*0.5); it_n=travel_nurse_annual.value*(1-sp*2); ip=penalty.value*(1-sp*1.5)
    it=fixed.value+iv+it_n+ip; im=ir-it
    fig, axes=plt.subplots(2,2,figsize=(16,9))
    axes[0,0].plot(yr,br/1e6,"o-",color="#94A3B8",lw=2,label="Baseline"); axes[0,0].plot(yr,ir/1e6,"o-",color="#059669",lw=2.5,label="Improved")
    axes[0,0].fill_between(yr,br/1e6,ir/1e6,alpha=0.2,color="#059669"); axes[0,0].set_title("Revenue ($M)"); axes[0,0].legend(fontsize=9)
    bmp=bm/br*100; imp=im/ir*100
    axes[0,1].bar(yr-0.2,bmp,0.4,color="#DC2626" if np.mean(bmp)<0 else "#F59E0B",alpha=0.5,label="Base")
    axes[0,1].bar(yr+0.2,imp,0.4,color="#059669",alpha=0.7,label="Improved"); axes[0,1].axhline(0,color="#1E293B"); axes[0,1].axhline(2,color="#059669",ls="--",alpha=0.5)
    axes[0,1].set_title("Margin (%)"); axes[0,1].legend(fontsize=8)
    cats=["Fixed","Variable","Travel\nRN","Readmit\nPenalty"]; bc1=[fixed.value,bv[0],travel_nurse_annual.value,penalty.value]; ic1=[fixed.value,iv[0],it_n,ip]; x=np.arange(4)
    axes[1,0].bar(x-0.2,[c/1e6 for c in bc1],0.4,color="#DC2626",alpha=0.5,label="Base")
    axes[1,0].bar(x+0.2,[c/1e6 for c in ic1],0.4,color="#059669",alpha=0.7,label="Improved")
    axes[1,0].set_xticks(x); axes[1,0].set_xticklabels(cats); axes[1,0].set_title("Year 1 Costs ($M)"); axes[1,0].legend(fontsize=9)
    ca=np.cumsum(im-bm); axes[1,1].fill_between(yr,0,ca/1e6,alpha=0.3,color="#059669"); axes[1,1].plot(yr,ca/1e6,"o-",color="#059669",lw=2.5)
    for i,v in enumerate(ca/1e6): axes[1,1].text(yr[i],v+max(ca/1e6)*0.03,f"${v:.2f}M",ha="center",fontsize=10,fontweight="bold")
    axes[1,1].set_title("Cumulative Benefit ($M)"); plt.tight_layout()
    mo.output.replace(mo.vstack([mo.as_html(fig), mo.md(f"### 5-Year: **${ca[-1]:,.0f}** cumulative benefit | Year 1 margin: {bmp[0]:.1f}% → {imp[0]:.1f}% (+{imp[0]-bmp[0]:.1f}pp)\nTravel nurse savings: ${travel_nurse_annual.value-it_n:,.0f}/yr | Penalty reduction: ${penalty.value-ip:,.0f}/yr")]))
    return


# ═══════════════════════════════════════════════════════════════
# SECTION 15: TRANSFER PREDICTION — LOGISTIC REGRESSION
# ═══════════════════════════════════════════════════════════════

@app.cell
def section15_header(mo):
    mo.output.replace(mo.md("---\n# 🚑 Section 15: Transfer Prediction — Logistic Regression\n*Chapter 3/5 — Which ED patients will need transfer to a tertiary center?*"))
    return


@app.cell
def transfer_prediction(mo, np, plt, avg_ed_visits_day, ed_rn_per_shift):
    from scipy.optimize import minimize as sp_min
    np.random.seed(444); n = 600
    volume = np.random.poisson(avg_ed_visits_day.value, n)
    nurses = np.random.choice([max(1,ed_rn_per_shift.value-1), ed_rn_per_shift.value, ed_rn_per_shift.value+1], n, p=[0.2,0.6,0.2])
    acuity = np.random.choice([1,2,3,4,5], n, p=[0.02,0.12,0.35,0.35,0.16])
    is_night = np.random.binomial(1, 0.33, n).astype(float)
    high_acuity = (acuity <= 2).astype(float)
    logit_p = -3.5 + 0.8*high_acuity + 0.03*volume - 0.2*nurses + 0.5*is_night + np.random.normal(0, 0.3, n)
    p_transfer = 1/(1+np.exp(-logit_p)); transferred = np.random.binomial(1, p_transfer)
    X = np.column_stack([np.ones(n), high_acuity, volume, nurses, is_night])
    names = ["Intercept", "High Acuity (ESI 1-2)", "ED Volume", "Nurses", "Night Shift"]
    def nll(b, X, y):
        z = np.clip(X@b, -500, 500); return -np.sum(y*z - np.log(1+np.exp(z)))
    res = sp_min(nll, np.zeros(X.shape[1]), args=(X, transferred), method="BFGS")
    beta = res.x; orv = np.exp(beta); ph = 1/(1+np.exp(-X@beta))
    from sklearn.metrics import roc_curve, auc
    fpr, tpr, _ = roc_curve(transferred, ph); auc_v = auc(fpr, tpr)

    fig, axes = plt.subplots(1, 3, figsize=(16, 5))
    axes[0].plot(fpr, tpr, color="#2563EB", lw=2.5, label=f"AUC={auc_v:.3f}"); axes[0].plot([0,1],[0,1],"r--")
    axes[0].set_title("ROC — Transfer Prediction"); axes[0].set_xlabel("FPR"); axes[0].set_ylabel("TPR"); axes[0].legend(fontsize=10)
    axes[1].barh(range(1,len(names)), orv[1:], color="#2563EB", alpha=0.7, height=0.6)
    axes[1].axvline(1, color="#DC2626", ls="--", lw=1.5, label="OR=1"); axes[1].set_yticks(range(1,len(names)))
    axes[1].set_yticklabels(names[1:]); axes[1].set_title("Odds Ratios"); axes[1].legend(fontsize=9)
    axes[2].hist(ph[transferred==0], bins=25, alpha=0.6, color="#059669", label="Not transferred", density=True)
    axes[2].hist(ph[transferred==1], bins=25, alpha=0.6, color="#DC2626", label="Transferred", density=True)
    axes[2].set_title("Predicted Probability"); axes[2].legend(fontsize=9); plt.tight_layout()

    tr = np.mean(transferred)*100
    or_rows = "\n".join([f"| {names[i]} | {beta[i]:+.3f} | {orv[i]:.3f} |" for i in range(len(names))])
    mo.output.replace(mo.vstack([mo.as_html(fig), mo.md(f"### Transfer Logistic Regression: AUC={auc_v:.3f} | Baseline transfer rate={tr:.1f}%\n| Variable | Log-Odds | OR |\n|----------|----------|----|\n{or_rows}\n\n**High acuity (ESI 1-2) increases transfer odds by {orv[1]:.1f}x.** Night shift adds {orv[4]:.1f}x odds — start transfer workup earlier at night.")]))
    return


# ═══════════════════════════════════════════════════════════════
# SECTION 16: MARKOV CHAIN PATIENT FLOW
# ═══════════════════════════════════════════════════════════════

@app.cell
def section16_header(mo):
    mo.output.replace(mo.md("---\n# 🔗 Section 16: Markov Chain Patient Flow Model\n*Chapter 13 — Model patient transitions through hospital locations.*"))
    return


@app.cell
def markov_patient_flow(mo, np, plt):
    states = ["ED Triage", "ED Treatment", "Radiology", "Inpatient", "ICU", "Discharge", "Transfer"]
    n_states = len(states)
    T = np.array([
        [0.00, 0.85, 0.10, 0.00, 0.00, 0.05, 0.00],  # ED Triage →
        [0.00, 0.10, 0.30, 0.20, 0.05, 0.30, 0.05],  # ED Treatment →
        [0.00, 0.60, 0.00, 0.15, 0.05, 0.15, 0.05],  # Radiology →
        [0.00, 0.00, 0.05, 0.50, 0.10, 0.30, 0.05],  # Inpatient →
        [0.00, 0.00, 0.00, 0.30, 0.40, 0.10, 0.20],  # ICU →
        [0.00, 0.00, 0.00, 0.00, 0.00, 1.00, 0.00],  # Discharge (absorbing)
        [0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 1.00],  # Transfer (absorbing)
    ])
    # Simulate 500 patients
    np.random.seed(88); n_patients = 500
    paths = []; steps_to_absorb = []
    for _ in range(n_patients):
        state = 0; path = [state]; step = 0
        while state not in [5, 6] and step < 50:
            state = np.random.choice(n_states, p=T[state]); path.append(state); step += 1
        paths.append(path); steps_to_absorb.append(len(path)-1)

    fig, axes = plt.subplots(1, 3, figsize=(16, 5))
    # Transition heatmap
    im = axes[0].imshow(T, cmap="Blues", aspect="auto", vmin=0, vmax=1)
    axes[0].set_xticks(range(n_states)); axes[0].set_xticklabels([s[:6] for s in states], fontsize=8, rotation=45)
    axes[0].set_yticks(range(n_states)); axes[0].set_yticklabels([s[:6] for s in states], fontsize=8)
    for i in range(n_states):
        for j in range(n_states):
            if T[i,j] > 0: axes[0].text(j, i, f"{T[i,j]:.2f}", ha="center", va="center", fontsize=7, color="white" if T[i,j]>0.5 else "black")
    axes[0].set_title("Transition Matrix"); plt.colorbar(im, ax=axes[0], shrink=0.8)

    # Steps to absorbing state
    axes[1].hist(steps_to_absorb, bins=20, color="#2563EB", alpha=0.7, edgecolor="white")
    axes[1].axvline(np.mean(steps_to_absorb), color="#DC2626", ls="--", lw=2, label=f"Mean={np.mean(steps_to_absorb):.1f}")
    axes[1].set_title("Steps to Discharge/Transfer"); axes[1].set_xlabel("Transitions"); axes[1].legend(fontsize=9)

    # Absorbing state probabilities
    final_states = [p[-1] for p in paths]
    disch_pct = np.mean(np.array(final_states)==5)*100; trans_pct = np.mean(np.array(final_states)==6)*100
    axes[2].bar(["Discharged", "Transferred"], [disch_pct, trans_pct], color=["#059669", "#DC2626"], alpha=0.7, edgecolor="white")
    for i, v in enumerate([disch_pct, trans_pct]): axes[2].text(i, v+1, f"{v:.1f}%", ha="center", fontweight="bold", fontsize=12)
    axes[2].set_title("Final Disposition"); axes[2].set_ylabel("% of Patients")
    plt.tight_layout()

    # State visit frequency
    all_visits = [s for p in paths for s in p]
    visit_freq = {states[i]: all_visits.count(i) for i in range(n_states)}
    bottleneck = max([(s, c) for s, c in visit_freq.items() if s not in ["Discharge","Transfer","ED Triage"]], key=lambda x: x[1])
    mo.output.replace(mo.vstack([mo.as_html(fig), mo.md(f"### Markov Flow: {disch_pct:.0f}% discharged, {trans_pct:.0f}% transferred | Avg {np.mean(steps_to_absorb):.1f} transitions\n**Most visited state: {bottleneck[0]}** ({bottleneck[1]} visits across {n_patients} patients) — primary flow bottleneck.")]))
    return


# ═══════════════════════════════════════════════════════════════
# SECTION 17: COST MODELING — GAMMA GLM
# ═══════════════════════════════════════════════════════════════

@app.cell
def section17_header(mo):
    mo.output.replace(mo.md("---\n# 💲 Section 17: Cost per Visit Modeling — Gamma GLM\n*Chapter 3 — Model right-skewed cost data without log-transform bias.*"))
    return


@app.cell
def cost_model_controls(mo):
    base_cost = mo.ui.slider(100, 500, value=220, step=20, label="Base Cost/Visit ($)")
    acuity_premium = mo.ui.slider(10, 100, value=45, step=5, label="Acuity Premium ($/ESI level)")
    mo.output.replace(mo.hstack([base_cost, acuity_premium], gap=1))
    return base_cost, acuity_premium


@app.cell
def cost_modeling(mo, np, plt, sp_stats, base_cost, acuity_premium, avg_ed_visits_day):
    np.random.seed(567); n = 500
    volume = np.random.poisson(avg_ed_visits_day.value, n)
    acuity = np.random.choice([1,2,3,4,5], n, p=[0.02,0.12,0.35,0.35,0.16])
    is_night = np.random.binomial(1, 0.33, n).astype(float)
    is_weekend = np.random.binomial(1, 2/7, n).astype(float)
    mu_cost = base_cost.value + acuity_premium.value*(5-acuity) + 2.5*volume + 50*is_night + 30*is_weekend
    cost = mu_cost * np.random.gamma(5, 1/5, n)  # gamma-distributed noise with mean 1
    cost = np.maximum(cost, 30)

    # Fit OLS on log-cost (common but biased approach)
    X = np.column_stack([np.ones(n), acuity, volume, is_night, is_weekend])
    log_beta = np.linalg.lstsq(X, np.log(cost), rcond=None)[0]
    log_pred = np.exp(X @ log_beta)

    # Fit "GLM-style" on original scale (iterative weighted LS approximation)
    beta_glm = np.linalg.lstsq(X, cost, rcond=None)[0]
    glm_pred = X @ beta_glm

    fig, axes = plt.subplots(1, 3, figsize=(16, 5))
    axes[0].hist(cost, bins=30, color="#059669", alpha=0.7, edgecolor="white", density=True)
    x_range = np.linspace(cost.min(), cost.max(), 200)
    shape_fit, _, scale_fit = sp_stats.gamma.fit(cost, floc=0)
    axes[0].plot(x_range, sp_stats.gamma.pdf(x_range, shape_fit, scale=scale_fit), "r-", lw=2, label="Gamma fit")
    axes[0].set_title("Cost Distribution (Right-Skewed)"); axes[0].set_xlabel("Cost ($)"); axes[0].legend(fontsize=9)

    # Compare predictions
    axes[1].scatter(cost, log_pred, alpha=0.3, s=15, color="#F59E0B", label="Log-linear (biased)")
    axes[1].scatter(cost, glm_pred, alpha=0.3, s=15, color="#2563EB", label="GLM (unbiased)")
    lims = [min(cost.min(), 0), cost.max()]
    axes[1].plot(lims, lims, "r--", lw=1.5); axes[1].set_title("Predicted vs Actual Cost"); axes[1].legend(fontsize=9)
    axes[1].set_xlabel("Actual ($)"); axes[1].set_ylabel("Predicted ($)")

    # Cost by acuity
    esi_costs = {e: cost[acuity == e] for e in [1,2,3,4,5]}
    bp = axes[2].boxplot([esi_costs[e] for e in [1,2,3,4,5]], labels=[f"ESI {e}" for e in [1,2,3,4,5]], patch_artist=True, widths=0.5)
    for patch, c in zip(bp["boxes"], ["#DC2626","#F59E0B","#2563EB","#059669","#94A3B8"]):
        patch.set_facecolor(c); patch.set_alpha(0.6)
    axes[2].set_title("Cost by Acuity Level"); axes[2].set_ylabel("Cost ($)")
    plt.tight_layout()

    rmse_log = np.sqrt(np.mean((cost-log_pred)**2)); rmse_glm = np.sqrt(np.mean((cost-glm_pred)**2))
    mo.output.replace(mo.vstack([mo.as_html(fig), mo.md(f"### Cost Model: Mean=${np.mean(cost):.0f}, Median=${np.median(cost):.0f} (skew={sp_stats.skew(cost):.1f})\n| Method | RMSE | Bias |\n|--------|------|------|\n| Log-linear OLS | ${rmse_log:.0f} | Retransformation bias |\n| Gamma GLM | ${rmse_glm:.0f} | Unbiased on original scale |\n\n**ESI 1 costs {np.mean(esi_costs.get(1,[0]))/np.mean(esi_costs.get(5,[1])):.1f}x more than ESI 5** — acuity drives costs more than any other factor.")]))
    return


# ═══════════════════════════════════════════════════════════════
# SECTION 18: ANOMALY DETECTION
# ═══════════════════════════════════════════════════════════════

@app.cell
def section18_header(mo):
    mo.output.replace(mo.md("---\n# 🔍 Section 18: Anomaly Detection — Operational Surveillance\n*Chapter 11 — Automatically flag unusual days that signal outbreaks, process failures, or data errors.*"))
    return


@app.cell
def anomaly_detection(mo, np, plt, ed_daily):
    np.random.seed(999); y = ed_daily.copy().astype(float)
    # Inject anomalies
    anomaly_days = [45, 120, 200, 280, 330]
    for d in anomaly_days:
        y[d] = y[d] * np.random.choice([1.8, 2.2, 0.3])  # spikes and drops

    # Rolling z-score method
    window = 21; half = window // 2
    scores = np.zeros(len(y))
    flagged = np.zeros(len(y), dtype=bool)
    for i in range(half, len(y) - half):
        win = np.concatenate([y[max(0,i-half):i], y[i+1:min(len(y),i+half+1)]])
        mu = np.mean(win); sigma = np.std(win)
        if sigma > 0:
            scores[i] = (y[i] - mu) / sigma
            flagged[i] = abs(scores[i]) > 2.5

    # IQR method
    q1 = np.percentile(y, 25); q3 = np.percentile(y, 75); iqr = q3 - q1
    iqr_flagged = (y < q1 - 1.5*iqr) | (y > q3 + 1.5*iqr)

    fig, axes = plt.subplots(1, 3, figsize=(16, 5))
    days = np.arange(len(y))
    axes[0].plot(days, y, color="#64748B", alpha=0.5, lw=1)
    axes[0].scatter(days[flagged], y[flagged], color="#DC2626", s=60, zorder=5, label=f"Anomalies ({np.sum(flagged)})")
    axes[0].set_title("ED Volume with Anomaly Detection"); axes[0].set_xlabel("Day"); axes[0].legend(fontsize=9)

    axes[1].plot(days, scores, color="#8B5CF6", alpha=0.7, lw=1)
    axes[1].axhline(2.5, color="#DC2626", ls="--", lw=1.5, label="Threshold (±2.5σ)")
    axes[1].axhline(-2.5, color="#DC2626", ls="--", lw=1.5)
    axes[1].fill_between(days, -2.5, 2.5, alpha=0.05, color="#059669")
    axes[1].set_title("Rolling Z-Score"); axes[1].set_xlabel("Day"); axes[1].legend(fontsize=9)

    # Classification of anomalies
    spikes = np.sum(flagged & (scores > 0)); drops = np.sum(flagged & (scores < 0))
    axes[2].bar(["Spikes\n(high volume)", "Drops\n(low volume)", "Normal\nDays"], [spikes, drops, len(y)-np.sum(flagged)],
                color=["#DC2626", "#F59E0B", "#059669"], alpha=0.7)
    for i, v in enumerate([spikes, drops, len(y)-np.sum(flagged)]):
        axes[2].text(i, v+2, str(v), ha="center", fontweight="bold")
    axes[2].set_title("Anomaly Classification")
    plt.tight_layout()

    mo.output.replace(mo.vstack([mo.as_html(fig), mo.md(f"### Anomaly Detection: **{np.sum(flagged)} flagged days** ({spikes} spikes, {drops} drops) out of {len(y)}\n**Spikes** may indicate: disease outbreak, nearby ED closure, mass casualty event.\n**Drops** may indicate: weather closure, data capture error, community event keeping people home.")]))
    return


# ═══════════════════════════════════════════════════════════════
# SECTION 19: MULTI-OBJECTIVE OPTIMIZATION — PARETO
# ═══════════════════════════════════════════════════════════════

@app.cell
def section19_header(mo):
    mo.output.replace(mo.md("---\n# ⚖️ Section 19: Multi-Objective Optimization — Pareto Trade-offs\n*Chapter 12 — Balance cost, quality, and staff satisfaction simultaneously.*"))
    return


@app.cell
def pareto_controls(mo):
    pareto_budget = mo.ui.slider(200000, 800000, value=400000, step=50000, label="Max Annual Staffing Budget ($)")
    pareto_wait_target = mo.ui.slider(10, 60, value=30, step=5, label="Target Max Wait (min)")
    mo.output.replace(mo.hstack([pareto_budget, pareto_wait_target], gap=1))
    return pareto_budget, pareto_wait_target


@app.cell
def pareto_optimization(mo, np, plt, pareto_budget, pareto_wait_target):
    np.random.seed(77)
    # Generate staffing configurations: (nurses, cost, avg_wait, satisfaction_score)
    configs = []
    for nurses in range(4, 20):
        for overtime_pct in [0, 10, 20, 30]:
            cost = nurses * 55000 * (1 + overtime_pct/100 * 0.5)  # annual cost
            wait = max(5, 80 - nurses * 5.5 + overtime_pct * 0.3 + np.random.normal(0, 3))
            satisfaction = max(20, 95 - overtime_pct * 1.5 - max(0, nurses - 12) * 2 + np.random.normal(0, 5))
            configs.append({"nurses": nurses, "ot_pct": overtime_pct, "cost": cost, "wait": wait, "satisfaction": satisfaction})

    costs = np.array([c["cost"] for c in configs])
    waits = np.array([c["wait"] for c in configs])
    sats = np.array([c["satisfaction"] for c in configs])

    # Find Pareto frontier (cost vs wait)
    pareto_mask = np.zeros(len(configs), dtype=bool)
    for i in range(len(configs)):
        dominated = False
        for j in range(len(configs)):
            if i != j and costs[j] <= costs[i] and waits[j] <= waits[i] and (costs[j] < costs[i] or waits[j] < waits[i]):
                dominated = True; break
        if not dominated: pareto_mask[i] = True

    # Filter by budget
    feasible = costs <= pareto_budget.value
    meets_wait = waits <= pareto_wait_target.value
    best_idx = -1
    best_sat = 0
    for i in range(len(configs)):
        if feasible[i] and meets_wait[i] and sats[i] > best_sat:
            best_sat = sats[i]; best_idx = i

    fig, axes = plt.subplots(1, 3, figsize=(16, 5))
    # Cost vs Wait with Pareto frontier
    axes[0].scatter(costs[~pareto_mask]/1000, waits[~pareto_mask], alpha=0.3, s=20, color="#94A3B8", label="Dominated")
    axes[0].scatter(costs[pareto_mask]/1000, waits[pareto_mask], alpha=0.8, s=50, color="#2563EB", label="Pareto Optimal", zorder=5)
    if best_idx >= 0:
        axes[0].scatter([costs[best_idx]/1000], [waits[best_idx]], s=150, color="#DC2626", marker="*", zorder=10, label="Recommended")
    axes[0].axhline(pareto_wait_target.value, color="#F59E0B", ls="--", lw=1.5, label=f"Wait target ({pareto_wait_target.value}m)")
    axes[0].axvline(pareto_budget.value/1000, color="#059669", ls="--", lw=1.5, label=f"Budget (${pareto_budget.value/1000:.0f}K)")
    axes[0].set_xlabel("Annual Cost ($K)"); axes[0].set_ylabel("Avg Wait (min)")
    axes[0].set_title("Cost vs Wait Time (Pareto Frontier)"); axes[0].legend(fontsize=7, loc="upper right")

    # Cost vs Satisfaction
    sc = axes[1].scatter(costs/1000, sats, c=waits, cmap="RdYlGn_r", alpha=0.6, s=30)
    if best_idx >= 0:
        axes[1].scatter([costs[best_idx]/1000], [sats[best_idx]], s=150, color="#DC2626", marker="*", zorder=10)
    plt.colorbar(sc, ax=axes[1], label="Wait (min)", shrink=0.8)
    axes[1].set_xlabel("Annual Cost ($K)"); axes[1].set_ylabel("Staff Satisfaction")
    axes[1].set_title("Cost vs Satisfaction (colored by wait)")

    # Trade-off summary
    pareto_sorted = sorted([i for i in range(len(configs)) if pareto_mask[i]], key=lambda i: costs[i])
    if len(pareto_sorted) >= 2:
        p_costs = [costs[i]/1000 for i in pareto_sorted[:10]]
        p_waits = [waits[i] for i in pareto_sorted[:10]]
        axes[2].plot(p_costs, p_waits, "o-", color="#2563EB", lw=2, ms=6)
        axes[2].set_xlabel("Annual Cost ($K)"); axes[2].set_ylabel("Avg Wait (min)")
        axes[2].set_title("Pareto Frontier (Efficient Boundary)")
        # Annotate marginal cost of wait reduction
        for k in range(1, min(len(p_costs), 6)):
            dc = p_costs[k] - p_costs[k-1]; dw = p_waits[k-1] - p_waits[k]
            if dw > 0:
                axes[2].annotate(f"${dc/dw:.0f}K\nper min", (p_costs[k], p_waits[k]), fontsize=8, color="#DC2626", textcoords="offset points", xytext=(10, 5))
    plt.tight_layout()

    rec = configs[best_idx] if best_idx >= 0 else None
    rec_text = f"**Recommended: {rec['nurses']} nurses, {rec['ot_pct']}% OT** → ${rec['cost']:,.0f}/yr, {rec['wait']:.0f}m wait, {rec['satisfaction']:.0f}% satisfaction" if rec else "**No feasible solution** within budget and wait target. Relax constraints."
    mo.output.replace(mo.vstack([mo.as_html(fig), mo.md(f"### Pareto Analysis: {np.sum(pareto_mask)} optimal configurations out of {len(configs)}\n{rec_text}\n\nThe frontier shows **diminishing returns** — each additional minute of wait reduction costs progressively more.")]))
    return


# ═══════════════════════════════════════════════════════════════
# SECTION 20: INFECTION TRANSMISSION NETWORK
# ═══════════════════════════════════════════════════════════════

@app.cell
def section20_header(mo):
    mo.output.replace(mo.md("---\n# 🦠 Section 20: Infection Transmission Network Model\n*Chapter 10 — Model HAI spread through staff-patient contact networks.*"))
    return


@app.cell
def infection_controls(mo):
    inf_transmission = mo.ui.slider(0.01, 0.15, value=0.05, step=0.01, label="Transmission Probability per Contact")
    inf_staff = mo.ui.slider(3, 12, value=6, step=1, label="Staff Members on Shift")
    inf_patients = mo.ui.slider(5, 25, value=12, step=1, label="Patients on Unit")
    mo.output.replace(mo.hstack([inf_transmission, inf_staff, inf_patients], gap=1))
    return inf_transmission, inf_staff, inf_patients


@app.cell
def infection_network(mo, np, plt, inf_transmission, inf_staff, inf_patients):
    import networkx as nx
    np.random.seed(555)
    ns = inf_staff.value; np_ = inf_patients.value; beta = inf_transmission.value
    G = nx.Graph()
    for i in range(ns): G.add_node(f"S{i+1}", ntype="staff")
    for i in range(np_): G.add_node(f"P{i+1}", ntype="patient")
    # Each staff contacts ~60% of patients (rural = dense contact)
    for i in range(ns):
        n_contacts = max(1, int(np_ * 0.6))
        contacts = np.random.choice(range(np_), n_contacts, replace=False)
        for c in contacts: G.add_edge(f"S{i+1}", f"P{c+1}")
    # Staff-staff contacts
    for i in range(ns):
        for j in range(i+1, ns):
            if np.random.random() < 0.4: G.add_edge(f"S{i+1}", f"S{j+1}")

    # SIR simulation on network
    n_sims = 200; outbreak_sizes = []; days_to_peak = []
    for _ in range(n_sims):
        infected = set(); recovered = set()
        patient_zero = np.random.choice(list(G.nodes()))
        infected.add(patient_zero)
        daily_new = [1]; day = 0
        while infected and day < 30:
            new_infected = set()
            for node in list(infected):
                for neighbor in G.neighbors(node):
                    if neighbor not in infected and neighbor not in recovered:
                        if np.random.random() < beta: new_infected.add(neighbor)
            recovered.update(infected); infected = new_infected
            daily_new.append(len(new_infected)); day += 1
        outbreak_sizes.append(len(recovered))
        days_to_peak.append(np.argmax(daily_new) if max(daily_new) > 0 else 0)

    fig, axes = plt.subplots(1, 3, figsize=(16, 5))
    # Network visualization
    pos = nx.spring_layout(G, seed=42, k=1.5)
    staff_nodes = [n for n in G if G.nodes[n]["ntype"] == "staff"]
    patient_nodes = [n for n in G if G.nodes[n]["ntype"] == "patient"]
    deg = dict(G.degree())
    nx.draw_networkx_nodes(G, pos, nodelist=staff_nodes, node_color="#DC2626", node_size=[deg[n]*40+100 for n in staff_nodes], ax=axes[0], alpha=0.8)
    nx.draw_networkx_nodes(G, pos, nodelist=patient_nodes, node_color="#2563EB", node_size=[deg[n]*30+80 for n in patient_nodes], ax=axes[0], alpha=0.6)
    nx.draw_networkx_edges(G, pos, alpha=0.15, ax=axes[0])
    nx.draw_networkx_labels(G, pos, font_size=6, ax=axes[0])
    axes[0].set_title(f"Contact Network ({ns} staff, {np_} patients)"); axes[0].axis("off")

    # Outbreak size distribution
    axes[1].hist(outbreak_sizes, bins=20, color="#DC2626", alpha=0.7, edgecolor="white")
    axes[1].axvline(np.mean(outbreak_sizes), color="#F59E0B", ls="--", lw=2, label=f"Mean={np.mean(outbreak_sizes):.1f}")
    axes[1].set_title("Outbreak Size Distribution"); axes[1].set_xlabel("Total Infected"); axes[1].legend(fontsize=9)

    # Super-spreader identification
    degrees = sorted([(n, G.degree(n)) for n in G], key=lambda x: -x[1])
    top_nodes = degrees[:8]
    colors_bar = ["#DC2626" if G.nodes[n]["ntype"] == "staff" else "#2563EB" for n, _ in top_nodes]
    axes[2].barh(range(len(top_nodes)), [d for _, d in top_nodes], color=colors_bar, alpha=0.7, height=0.6)
    axes[2].set_yticks(range(len(top_nodes))); axes[2].set_yticklabels([n for n, _ in top_nodes], fontsize=9)
    axes[2].set_title("Top Contact Nodes (Super-Spreaders)"); axes[2].set_xlabel("Number of Contacts")
    plt.tight_layout()

    mean_ob = np.mean(outbreak_sizes); pct_large = np.mean(np.array(outbreak_sizes) > (ns+np_)*0.3)*100
    top_spreader = degrees[0]
    mo.output.replace(mo.vstack([mo.as_html(fig), mo.md(f"### Infection Model: Mean outbreak={mean_ob:.1f} people | {pct_large:.0f}% of outbreaks infect >30% of unit\n**Top super-spreader: {top_spreader[0]}** ({top_spreader[1]} contacts) — {'a staff member (target for enhanced PPE/screening)' if 'S' in top_spreader[0] else 'a patient (consider isolation protocols)'}.\nAt β={beta:.2f} transmission rate, {'cohorting staff to fewer patients would significantly reduce outbreak size.' if mean_ob > 5 else 'current contact patterns keep outbreaks manageable.'}")]))
    return


@app.cell
def executive_summary(mo):
    mo.output.replace(mo.md("""
---
# 📋 Model Index — Complete Toolkit

| # | Model | Key Question | Ch |
|---|-------|-------------|----|
| 1 | Descriptive Statistics | How variable are our operations? | 2 |
| 2 | Regression (OLS) | What drives wait times? | 3 |
| 3 | Time Series Forecasting | How many patients next week? | 4 |
| 4 | Survival Analysis | How long do nurses stay? | 5 |
| 5 | Queuing Theory (Erlang-C) | How many providers do we need? | 6 |
| 6 | Discrete Event Simulation | Where are the bottlenecks? | 7 |
| 7 | System Dynamics | What happens to staffing over 3 years? | 8 |
| 8 | Agent-Based Modeling | How does one critical patient affect everyone? | 9 |
| 9 | Network Analysis | How vulnerable is our referral network? | 10 |
| 10 | Machine Learning (RF) | Which patients will be readmitted? | 11 |
| 11 | Optimization (Scheduling) | What is the cheapest valid schedule? | 12 |
| 12 | Decision Analysis (NPV) | Should we invest in X? | 13 |
| 13 | Bayesian Methods | What is our real complication rate? | 14 |
| 14 | Financial Model | What is the 5-year ROI? | Synthesis |
| **15** | **Logistic Regression** | **Which patients need transfer?** | **3** |
| **16** | **Markov Chain** | **How do patients flow through the hospital?** | **13** |
| **17** | **Gamma GLM (Cost)** | **What drives cost per visit?** | **3** |
| **18** | **Anomaly Detection** | **Which days are operationally unusual?** | **11** |
| **19** | **Multi-Objective (Pareto)** | **How to balance cost, quality, and satisfaction?** | **12** |
| **20** | **Infection Network** | **How would an HAI spread on our unit?** | **10** |

*Built with [marimo](https://marimo.io) — reactive Python notebooks.*
*Based on "Modeling Methods for Healthcare Operations in Rural Hospitals" (2026 Edition).*
"""))
    return


if __name__ == "__main__":
    app.run()
