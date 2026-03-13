# Infectious Disease Modeling Research

Comprehensive research for building an educational simulation tool.

---

## 1. Compartmental Models

### 1.1 SIR Model (Susceptible-Infected-Recovered)

Introduced by Kermack & McKendrick (1927). The simplest compartmental model.

**Differential Equations (closed population, no vital dynamics):**

```
dS/dt = -beta * S * I / N
dI/dt =  beta * S * I / N - gamma * I
dR/dt =  gamma * I
```

Where:
- `N = S + I + R` (constant total population)
- `beta` = transmission rate (contact rate x probability of transmission per contact)
- `gamma` = recovery rate = `1 / D` where D is average infectious period
- `R0 = beta / gamma`

**Key threshold result:** An epidemic occurs only if `R0 > 1`, equivalently if `S(0)/N > gamma/beta`.

**Final size relation:** The fraction of the population ultimately infected satisfies:
```
ln(S_inf / S_0) = -R0 * (1 - S_inf / N)
```

### 1.2 SIS Model (Susceptible-Infected-Susceptible)

For diseases conferring no lasting immunity (e.g., common cold, gonorrhea, some bacterial infections).

```
dS/dt = -beta * S * I / N + gamma * I
dI/dt =  beta * S * I / N - gamma * I
```

- No recovered compartment; individuals return to S upon recovery.
- Endemic equilibrium: `I* = N * (1 - 1/R0)` when `R0 > 1`.
- Disease-free equilibrium is stable when `R0 <= 1`.

### 1.3 SEIR Model (Susceptible-Exposed-Infected-Recovered)

Adds a latent/exposed period where individuals are infected but not yet infectious.

```
dS/dt = -beta * S * I / N
dE/dt =  beta * S * I / N - sigma * E
dI/dt =  sigma * E - gamma * I
dR/dt =  gamma * I
```

Where:
- `sigma` = rate of progression from exposed to infectious = `1 / T_latent`
- `T_latent` = average latent (incubation) period
- `R0 = beta / gamma` (same as SIR; latency affects timing but not R0)

**Effect of latency:** The latent period delays the peak of the epidemic and slows initial growth, but does not change the final epidemic size in a closed population.

### 1.4 SEIRS Model (with Waning Immunity)

Recovered individuals lose immunity over time and return to S.

```
dS/dt = -beta * S * I / N + xi * R
dE/dt =  beta * S * I / N - sigma * E
dI/dt =  sigma * E - gamma * I
dR/dt =  gamma * I - xi * R
```

Where:
- `xi` = rate of immunity loss = `1 / T_immunity`
- `T_immunity` = average duration of immunity

This model can produce recurrent epidemic waves and endemic equilibria.

### 1.5 Models with Vital Dynamics (Births and Deaths)

Adding birth rate `mu` and death rate `nu` (often assumed equal for constant population):

```
dS/dt = mu * N - beta * S * I / N - nu * S
dE/dt = beta * S * I / N - sigma * E - nu * E
dI/dt = sigma * E - gamma * I - nu * I
dR/dt = gamma * I - nu * R
```

### 1.6 Parameter Summary Table

| Parameter | Symbol | Definition | Units |
|-----------|--------|------------|-------|
| Transmission rate | beta | Rate of infection spread | 1/time |
| Recovery rate | gamma | 1 / infectious period | 1/time |
| Incubation rate | sigma | 1 / latent period | 1/time |
| Immunity loss rate | xi | 1 / immunity duration | 1/time |
| Basic reproduction number | R0 | beta / gamma | dimensionless |
| Birth/death rate | mu, nu | Demographic turnover | 1/time |

### 1.7 Numerical Implementation Notes

All these ODE systems can be solved with standard methods:
- **Euler method**: Simple but requires small time steps for stability
- **RK4 (Runge-Kutta 4th order)**: Good balance of accuracy and simplicity
- **Adaptive step-size methods**: For stiff systems or long-time simulations

For a browser-based educational tool, RK4 with fixed time steps is recommended.

---

## 2. Agent-Based Modeling (ABM)

### 2.1 Core Concept

Unlike compartmental models (population-level ODEs), ABMs simulate individual agents with discrete states and behaviors. Each agent has:
- **State**: S, E, I, R (or more granular)
- **Location**: Position in space or on a network
- **Contacts**: Connections to other agents
- **Attributes**: Age, health status, behavior patterns

### 2.2 Contact Networks

Agents interact through networks. Key network types:

| Network Type | Description | Use Case |
|-------------|-------------|----------|
| **Fully connected (complete)** | Every agent contacts every other | Equivalent to ODE model; small populations |
| **Random (Erdos-Renyi)** | Each pair connected with probability p | Baseline comparison |
| **Small-world (Watts-Strogatz)** | Regular lattice + random rewiring | Social networks; clustering + short paths |
| **Scale-free (Barabasi-Albert)** | Power-law degree distribution | Superspreader hubs; realistic social networks |
| **Lattice/Grid** | Agents on 2D grid, contact with neighbors | Spatial spread visualization |
| **Household/workplace** | Hierarchical structure (household -> school/work -> community) | Realistic population structure |

### 2.3 Transmission Mechanics in ABMs

For each susceptible agent `i` in contact with infectious agent `j`:
```
P(infection) = 1 - (1 - p_transmit)^(contact_duration)
```

Or per time step:
```
P(infection per step) = 1 - product over all infectious contacts j of (1 - beta_ij)
```

Where `beta_ij` can vary by:
- Distance between agents (exponential decay)
- Duration of contact
- Agent attributes (mask wearing, vaccination status)
- Environmental factors (indoor/outdoor, ventilation)

### 2.4 Spatial Modeling

- **Grid-based**: Agents on a 2D lattice, infection spreads to neighbors within radius
- **Continuous space**: Agents at (x,y) coordinates, infection probability decays with distance
- **Geographic (GIS-based)**: Agents move between real locations (homes, workplaces, schools)
- **Gravity model**: Movement probability between locations proportional to populations, inversely proportional to distance

### 2.5 ABM vs. Compartmental Model Tradeoffs

| Aspect | Compartmental (ODE) | Agent-Based |
|--------|---------------------|-------------|
| Scale | Any population size | Limited by computation |
| Speed | Very fast | Slow for large N |
| Heterogeneity | Limited | Full individual variation |
| Stochasticity | Deterministic (by default) | Inherently stochastic |
| Spatial structure | None (well-mixed) | Explicit |
| Interventions | Parameter changes | Individual-level rules |
| Analysis | Analytical solutions possible | Requires Monte Carlo runs |

### 2.6 Hybrid Approaches

Recent research (JASSS, 2025) shows that coupling an ABM for local dynamics with an ODE model for population-level dynamics can capture infection spread effectively while reducing computational cost.

---

## 3. Key Epidemiological Parameters

### 3.1 Basic Reproduction Number (R0)

**Definition**: The expected number of secondary infections produced by a single infected individual in a fully susceptible population, with no interventions.

**Formula**: `R0 = beta * D` where beta is the transmission rate and D is the infectious period.

**Alternatively**: `R0 = (contact rate) * (transmission probability per contact) * (duration of infectiousness)`

**Interpretation**:
- `R0 < 1`: Disease dies out
- `R0 = 1`: Endemic steady state
- `R0 > 1`: Epidemic growth

**R0 is NOT a fixed biological constant.** It depends on:
- Pathogen biology (infectiousness, shedding)
- Host behavior (contact patterns, hygiene)
- Environment (population density, climate, indoor/outdoor)
- Demographics (age structure, prior immunity)

### 3.2 Effective Reproduction Number (Rt)

```
Rt = R0 * S(t) / N
```

Accounts for the depletion of susceptibles over time and interventions. The epidemic peaks when `Rt = 1`.

With vaccination fraction `v`:
```
Rt = R0 * (1 - v) * S(t) / N
```

### 3.3 Herd Immunity Threshold (HIT)

The fraction of the population that must be immune to drive `Rt < 1`:

```
HIT = 1 - 1/R0
```

| R0 | HIT |
|----|-----|
| 1.5 | 33% |
| 2.0 | 50% |
| 3.0 | 67% |
| 5.0 | 80% |
| 10 | 90% |
| 15 | 93% |
| 18 | 94% |

**Caveat**: This formula assumes homogeneous mixing. In structured populations, the effective HIT can be lower due to preferential immunization of high-contact individuals.

### 3.4 Generation Time and Serial Interval

- **Generation time (Tg)**: Time between infection of a primary case and infection of a secondary case
- **Serial interval**: Time between symptom onset in primary and secondary cases (easier to observe)
- **Incubation period**: Time from infection to symptom onset
- **Latent period**: Time from infection to becoming infectious

Relationship: `Serial interval ~ Latent period + (some fraction of) Infectious period`

### 3.5 Case Fatality Rate (CFR) vs. Infection Fatality Rate (IFR)

- **CFR** = deaths / confirmed cases (biased by testing)
- **IFR** = deaths / all infections (includes undetected cases; always <= CFR)
- **Note**: CFR is technically a proportion, not a rate (no time dimension)

### 3.6 Doubling Time

Time for cumulative cases to double during exponential growth:

```
T_double = ln(2) / r
```

Where `r` is the exponential growth rate. Related to R0:

```
r = (R0 - 1) / Tg    (for simple SIR)
r = (R0 - 1) * sigma * gamma / (sigma + gamma)    (for SEIR, approximate)
```

---

## 4. Real-World Disease Parameters

### 4.1 Comprehensive Parameter Table

| Disease | R0 | Incubation Period | Infectious Period | CFR | HIT |
|---------|-----|-------------------|-------------------|------|------|
| **Measles** | 12-18 | 10-14 days | 4-8 days (from prodrome) | 0.1-0.2% (developed); 1-5% (developing) | 92-95% |
| **COVID-19 (wild type)** | 2.5-3.5 | 4-6 days (mean ~5.8) | 7-10 days | ~1-2% (CFR); ~0.5-1% (IFR) | 60-71% |
| **COVID-19 (Omicron)** | 9.5-20+ | 2-4 days | 5-7 days | ~0.1-0.3% | 89-95% |
| **Seasonal Influenza** | 1.2-1.8 | 1-4 days (mean ~2) | 5-7 days | ~0.1% | 17-44% |
| **Pandemic Influenza (1918)** | 1.5-2.8 | 1-4 days | 5-7 days | 2-3% | 33-64% |
| **Ebola (Zaire)** | 1.5-2.7 | 2-21 days (mean ~8-11) | ~6-16 days | 50-90% (avg ~65%) | 33-63% |
| **Smallpox** | 4-10 | 7-19 days (mean ~12) | ~9 days (symptomatic) | 20-40% (variola major) | 75-90% |
| **SARS (2003)** | 2-4 | 2-10 days (mean ~5) | ~10-14 days | ~10% | 50-75% |
| **MERS** | 0.3-0.8 | 2-14 days (mean ~5.5) | ~13 days | ~35% | N/A (R0<1) |
| **Pertussis** | 12-17 | 7-10 days | 14-21 days | ~1% (infants) | 92-94% |
| **Mumps** | 10-12 | 12-25 days | 6-9 days | 0.01-0.02% | 90-92% |
| **Chickenpox** | 10-12 | 10-21 days | 5-7 days | 0.001% (children) | 90-92% |

### 4.2 COVID-19 Detailed Parameters

- **R0 (wild-type)**: WHO initially estimated 1.4-2.4; later studies: 2.4-3.4 most common; some estimates up to 5.8
- **Incubation period**: Mean 5.8 days (95% CI: 5.3-6.2); asymptomatic: 7.7 days
- **Serial interval**: 4.0-7.5 days
- **Pre-symptomatic transmission**: Viral shedding begins 2-5 days before symptom onset
- **Epidemic doubling time**: 2.4-3.9 days (early pandemic)
- **Overdispersion parameter k**: ~0.1 (highly overdispersed; 10-20% of cases cause 80% of transmission)
- **Viral shedding duration**: 3-46 days after symptom onset

### 4.3 Ebola Detailed Parameters

- **R0**: 1.34-2.7 depending on outbreak and setting
- **Incubation period**: Mean 8.5-11.4 days; range 2-21 days
- **Serial interval**: ~15.3-15.4 days
- **Symptom-onset-to-death**: 9.3 days (mean)
- **Symptom-onset-to-recovery**: ~13.0 days
- **CFR by species**: Zaire 75%, Sudan 53%, Bundibugyo 34-42%

### 4.4 Smallpox Detailed Parameters

- **R0**: 4-10 (most estimates 4-6)
- **Generation time**: ~21 days (much longer than most respiratory diseases)
- **Uninfectious incubation**: ~12 days
- **Prodromal period**: 2-4 days (mild symptoms, low infectiousness)
- **Highly infectious symptomatic period**: ~9 days
- **Key insight**: Long incubation + lower R0 made ring vaccination and localized containment feasible, enabling eradication

### 4.5 SEIR Parameter Mappings for Implementation

For coding, convert literature values to model parameters:

| Disease | beta (per day) | sigma (per day) | gamma (per day) | R0 |
|---------|---------------|-----------------|-----------------|-----|
| Measles | ~2.14 | 0.1 (10d) | 0.143 (7d) | ~15 |
| COVID-19 (wild) | ~0.43 | 0.2 (5d) | 0.143 (7d) | ~3.0 |
| Influenza | ~0.24 | 0.5 (2d) | 0.167 (6d) | ~1.4 |
| Ebola | ~0.19 | 0.1 (10d) | 0.1 (10d) | ~1.9 |
| Smallpox | ~0.56 | 0.083 (12d) | 0.111 (9d) | ~5.0 |

**Calculation**: `beta = R0 * gamma`, `sigma = 1/incubation_period`, `gamma = 1/infectious_period`

---

## 5. Intervention Strategies

### 5.1 Vaccination

**Model modification** (SIRVD or similar):

Add vaccination rate `v(t)` moving people from S to a vaccinated compartment V:
```
dS/dt = -beta * S * I / N - v(t) * S
dV/dt = v(t) * S
```

With imperfect vaccine (efficacy `e`):
```
dS/dt = -beta * S * I / N - v(t) * S + beta * (1-e) * V * I / N
dV/dt = v(t) * S - beta * (1-e) * V * I / N
```

**Effect on R0**: `R_eff = R0 * (1 - e*v_coverage)`

**Critical vaccination coverage** for elimination: `v_c = (1 - 1/R0) / e`

| Disease | R0 | Vaccine Efficacy | Required Coverage |
|---------|-----|-----------------|-------------------|
| Measles | 15 | ~97% | ~96% |
| COVID-19 | 3 | ~90% | ~74% |
| Influenza | 1.4 | ~40-60% | ~48-67% |
| Smallpox | 5 | ~95% | ~84% |

### 5.2 Quarantine

**Model modification** (SIQR):

Add quarantine compartment Q with quarantine rate `q`:
```
dS/dt = -beta * S * I / N
dI/dt = beta * S * I / N - gamma * I - q * I
dQ/dt = q * I - gamma_q * Q
dR/dt = gamma * I + gamma_q * Q
```

**Effect**: Reduces the effective infectious period from `1/gamma` to `1/(gamma + q)`.
**Modified R0**: `R_eff = beta / (gamma + q)`

### 5.3 Social Distancing

Reduces the contact rate, thereby reducing beta:

```
beta_effective = beta * (1 - d)
```

Where `d` is the fraction reduction in contacts (0 = no distancing, 1 = complete isolation).

**Effect on R0**: `R_eff = R0 * (1 - d)`

Can also be modeled as time-dependent: `d(t)` changes based on policy decisions.

### 5.4 Contact Tracing

Modeled as an enhanced quarantine that targets exposed individuals:

```
dE/dt = beta * S * I / N - sigma * E - tau * E
dQ_e/dt = tau * E - sigma_q * Q_e    (quarantined exposed)
```

Where `tau` is the contact tracing rate. Key findings:
- When 40%+ of contacts of detected cases are traced and quarantined, second waves can be substantially reduced
- Digital contact tracing is faster but requires high adoption rates
- Manual contact tracing may be too slow for diseases with short serial intervals (like COVID-19)

### 5.5 Combined Interventions

The most realistic models combine multiple interventions:

```
R_eff = R0 * (1 - d) * (1 - e*v) * gamma / (gamma + q)
```

Where:
- `d` = social distancing effectiveness
- `e` = vaccine efficacy
- `v` = vaccination coverage
- `q` = quarantine rate

### 5.6 Intervention Timing

The timing of interventions critically affects outcomes:
- Early intervention with moderate measures can be more effective than late intervention with strong measures
- "Flatten the curve": Reducing peak infections below healthcare capacity even if total infections are similar
- Premature relaxation can cause secondary waves, especially without sufficient immunity

---

## 6. Advanced Concepts

### 6.1 Superspreader Events and Overdispersion

**The dispersion parameter k**: Individual variation in transmission is modeled with a negative binomial distribution for secondary cases:
- Mean = R0
- Dispersion parameter = k
- Variance = R0 * (1 + R0/k)

**Interpretation of k values**:
- `k -> infinity`: Poisson distribution (homogeneous transmission, no superspreading)
- `k = 1`: Geometric distribution
- `k < 1`: High overdispersion, significant superspreading
- `k << 1`: Most transmission from a few individuals

**Measured k values from Lloyd-Smith et al. (2005) and subsequent studies**:

| Disease | R0 | k | % causing 80% of transmission |
|---------|-----|---|-------------------------------|
| SARS | ~3 | 0.16 | ~6% |
| COVID-19 | ~3 | 0.1-0.2 | 10-20% |
| Measles | ~15 | 0.16 | ~6% |
| Smallpox | ~5 | 0.32 | ~11% |
| 1918 Influenza | ~2 | 1.0 | ~28% |

**Implications for control**:
- Low k means most infected individuals transmit to 0 or 1 others
- Superspreading events (SSEs) drive epidemic growth
- Targeting SSEs (e.g., limiting large gatherings, improving ventilation) can be highly effective
- Backward contact tracing (finding who infected the case) is more valuable than forward tracing when k is small

### 6.2 Network Topology Effects

**Scale-free networks** (power-law degree distribution `P(k) ~ k^(-gamma_net)`):
- In scale-free networks, the epidemic threshold can vanish (R0_critical -> 0) meaning any disease can spread
- Hubs (high-degree nodes) act as superspreaders
- Targeted vaccination of hubs is much more efficient than random vaccination

**Small-world networks** (Watts-Strogatz model):
- High clustering coefficient + short average path length
- Disease spreads faster than on regular lattices but slower than in well-mixed populations
- Captures real social network properties

**Community structure**:
- Populations have natural community structure (households, schools, workplaces)
- Disease dynamics within communities vs. between communities differ
- "Metapopulation" models: SEIR within patches, movement between patches

### 6.3 Stochastic vs. Deterministic Models

**Deterministic (ODE) models**:
- Continuous, smooth trajectories
- Same initial conditions -> same outcome
- Sharp epidemic threshold at R0 = 1
- Good approximation for large populations
- Cannot capture extinction or fade-out

**Stochastic models**:
- Integer individuals, probabilistic transitions
- Different runs give different outcomes
- Disease may die out even when R0 > 1 (probability of extinction ~(1/R0)^I0 for small I0)
- Critical for small populations, early epidemics, and near-threshold dynamics
- Can capture fade-out between epidemic waves

**Implementation approaches**:
- **Gillespie algorithm (exact)**: Simulates each event; exact but slow for large N
- **Tau-leaping**: Approximate; groups events in time intervals; faster
- **Binomial chain**: Each time step, draw number of new infections from Binomial(S, 1-(1-beta*I/N)^dt)

**When stochastic effects matter most**:
- Small populations (N < ~10,000)
- Early epidemic (few infected individuals)
- Near epidemic threshold (R0 close to 1)
- When k is small (superspreading dynamics)
- Modeling probability of establishment vs. extinction

### 6.4 Age-Structured Models

Contact patterns vary strongly by age (POLYMOD study). Age-structured models use:
- Contact matrix `C_ij` giving average contacts between age group i and j
- Age-specific susceptibility, severity, and mortality
- Force of infection on age group i: `lambda_i = sum_j (beta * C_ij * I_j / N_j)`

### 6.5 Spatial Models and Metapopulations

- **Reaction-diffusion**: Add diffusion terms to ODEs for spatial spread
- **Gravity model**: Movement between locations i,j proportional to `N_i * N_j / d_ij^alpha`
- **Radiation model**: Alternative to gravity model based on intervening opportunities
- **Patch models**: SEIR within each patch, migration between patches

---

## 7. Key Literature References

### 7.1 Foundational Works

1. **Kermack, W.O. & McKendrick, A.G. (1927)**. "A Contribution to the Mathematical Theory of Epidemics." *Proceedings of the Royal Society of London, Series A*, 115(772), 700-721.
   - Introduced the SIR model and the epidemic threshold theorem
   - Actually presented a much more general age-of-infection model; the ODE SIR is a special case
   - Established that an epidemic requires a critical density of susceptibles

2. **Anderson, R.M. & May, R.M. (1991)**. *Infectious Diseases of Humans: Dynamics and Control*. Oxford University Press.
   - The definitive textbook on mathematical epidemiology
   - Comprehensive treatment of R0, epidemic thresholds, vaccination strategies
   - Covers age-structured models, vector-borne diseases, STIs

3. **Hethcote, H.W. (2000)**. "The Mathematics of Infectious Diseases." *SIAM Review*, 42(4), 599-653.
   - Comprehensive review of compartmental models (SIR, SEIR, SIRS, MSEIR, etc.)
   - Taxonomy of models based on flow patterns between compartments
   - Analysis of equilibria, stability, and epidemic thresholds

### 7.2 Superspreading and Heterogeneity

4. **Lloyd-Smith, J.O. et al. (2005)**. "Superspreading and the Effect of Individual Variation on Disease Emergence." *Nature*, 438, 355-359.
   - Introduced the negative binomial framework with dispersion parameter k
   - Fitted k to data from 8 pathogens (SARS k=0.16, measles k=0.16, smallpox k=0.32)
   - Showed superspreading is the norm, not the exception

5. **Endo, A. et al. (2020)**. "Estimating the Overdispersion in COVID-19 Transmission Using Outbreak Sizes Outside China." *Wellcome Open Research*, 5, 67.
   - Estimated k ~ 0.1 for COVID-19
   - Showed 10% of cases responsible for 80% of transmission

### 7.3 Network Epidemiology

6. **Pastor-Satorras, R. & Vespignani, A. (2001)**. "Epidemic Spreading in Scale-Free Networks." *Physical Review Letters*, 86(14), 3200.
   - Showed vanishing epidemic threshold in scale-free networks
   - Foundation for network epidemiology

7. **Keeling, M.J. & Eames, K.T.D. (2005)**. "Networks and Epidemic Models." *Journal of the Royal Society Interface*, 2(4), 295-307.
   - Review of how network structure affects epidemic dynamics
   - Pair approximation methods for analytical tractability

### 7.4 Stochastic Methods

8. **Allen, L.J.S. (2008)**. "An Introduction to Stochastic Epidemic Models." *Lecture Notes in Mathematics*, 1945, 81-130. Springer.
   - Comprehensive introduction to stochastic formulations of epidemic models
   - Continuous-time Markov chain (CTMC) and branching process approaches

9. **Dangerfield, C.E., Ross, J.V. & Keeling, M.J. (2009)**. "Integrating Stochasticity and Network Structure into an Epidemic Model." *Journal of the Royal Society Interface*, 6(38), 761-774.
   - Combined network structure with stochastic dynamics
   - Pairwise approximations for analytical understanding

### 7.5 Modern COVID-era References

10. **Sneppen, K. et al. (2021)**. "Overdispersion in COVID-19 Increases the Effectiveness of Limiting Nonrepetitive Contacts for Transmission Control." *PNAS*, 118(14).
    - Agent-based model showing that reducing random contacts controls superspreading outbreaks
    - Practical implications for intervention design

11. **Wegehaupt, O. et al. (2023)**. "Superspreading, Overdispersion and Their Implications in the SARS-CoV-2 Pandemic." *BMC Public Health*, 23, 1032.
    - Systematic review and meta-analysis of superspreading in COVID-19

### 7.6 Textbooks for Further Study

12. **Keeling, M.J. & Rohani, P. (2008)**. *Modeling Infectious Diseases in Humans and Animals*. Princeton University Press.
    - Modern treatment with code examples
    - Covers deterministic, stochastic, network, and spatial models

13. **Diekmann, O., Heesterbeek, J.A.P. & Britton, T. (2012)**. *Mathematical Tools for Understanding Infectious Disease Dynamics*. Princeton University Press.
    - Rigorous mathematical treatment
    - Next-generation matrix method for R0 computation

14. **Brauer, F. & Castillo-Chavez, C. (2012)**. *Mathematical Models in Population Biology and Epidemiology*. Springer.
    - Accessible introduction connecting population biology and epidemiology

---

## 8. Implementation Recommendations for Educational Tool

### 8.1 Suggested Simulation Modes

1. **Compartmental ODE Simulator**: Let users adjust R0, gamma, sigma, xi and see SIR/SEIR/SEIRS curves in real-time. Use RK4 integration.

2. **Agent-Based Simulator**: Grid or network-based with visual agents. Let users choose network topology, set transmission probability, and watch spread. Limit to ~1000-5000 agents for browser performance.

3. **Parameter Explorer**: Pre-loaded disease profiles (measles, COVID, influenza, etc.) that populate parameters and show resulting dynamics.

4. **Intervention Playground**: Toggle vaccination, quarantine, social distancing on/off and see effect on epidemic curve. Show R_eff changing in real-time.

5. **Stochastic vs. Deterministic Comparison**: Run ODE and stochastic side-by-side for same parameters; show divergence for small populations.

### 8.2 Key Visualizations

- Epidemic curves (S, E, I, R over time)
- Phase plane diagrams (S vs I)
- R_eff over time
- Network visualization with agent states
- Herd immunity threshold diagram
- Parameter sensitivity (tornado/spider diagrams)
- Comparison of diseases on same axes

### 8.3 Educational Learning Objectives

- Understand what R0 means and why it matters
- See how interventions flatten the curve
- Compare deterministic vs. stochastic outcomes
- Explore why some diseases are harder to control than others
- Understand herd immunity thresholds
- Visualize how network structure affects spread
- Learn why superspreading makes diseases both more dangerous and more controllable
