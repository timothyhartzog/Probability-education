/**
 * chapters.js
 * The 18-chapter text and simulation map for Rural Healthcare Nexus.
 */

export const chapters = [
  {
    id: 1,
    title: "The Rural Hospital Landscape and the Case for Modeling",
    summary: "Defining the unique regulatory and operational environment of CAHs, REHs, and rural PPS facilities.",
    content: `
      <h2>1.1 Defining Rural Healthcare in the United States</h2>
      <p>The classification of hospitals as rural is not merely a geographic designation but encompasses a complex web of regulatory, financial, and operational characteristics. Rural healthcare delivery is fundamentally shaped by the Paradox of Proximity—the inverse relationship between the density of population and the volume of available healthcare infrastructure.</p>
      <h3>1.2 The Failure of the Law of Large Numbers (LLN)</h3>
      <p>In urban hospitals with 500 beds, the average daily census is stable. In a 25-bed Critical Access Hospital (CAH), $n$ is too small for the LLN to wash out the variance of individual events. A single trauma call or a local viral spike can represent 500% of the daily mean demand, leading to operational saturation in minutes.</p>
    `,
    simulation: "/src/modules/rh-7-patient-flow/index.html",
    module_id: "CH-7 (Patient Flow)"
  },
  {
    id: 2,
    title: "Descriptive Statistics and Distribution Analysis",
    summary: "Understanding variation and skew in small-sample healthcare settings.",
    content: `
      <h2>2.1 Operations Data and Skew</h2>
      <p>Healthcare data like Patient Length of Stay (LOS) is rarely normal. It typically follows a <strong>Gamma</strong> or <strong>Log-Normal</strong> distribution, characterized by a 'long tail' of complex cases. In rural settings, this skewness is magnified by the small total $n$.</p>
      <h3>2.2 The Coefficient of Variation (CV)</h3>
      <p>The CV ($σ/μ$) is the primary metric for operational vulnerability. A CV > 0.4 implies significant 'lumpy' demand, requiring different staffing strategies than stable urban environments.</p>
    `,
    simulation: "/src/modules/rh-14-modeling-toolkit/index.html",
    module_id: "CH-14 (Analytics Toolkit)"
  },
  {
    id: 3,
    title: "Regression Models for Healthcare Operations",
    summary: "Modeling the drivers of wait times, costs, and clinical outcomes.",
    content: `
      <h2>3.1 Beyond Ordinary Least Squares (OLS)</h2>
      <p>Linear models often fail in healthcare due to non-normal residuals and heteroscedasticity. We explore <strong>Generalized Linear Models (GLM)</strong> with Poisson or Gamma links to accurately model count data like ED arrivals or cost per encounter.</p>
    `,
    simulation: "/src/modules/rh-14-modeling-toolkit/index.html",
    module_id: "CH-14 (Analytics Toolkit)"
  },
  {
    id: 4,
    title: "Time Series Forecasting: Predicting the Surge",
    summary: "Forecasting ED volume and inpatient census for staffing and supply planning.",
    content: `
      <h2>4.1 Forecasting in Local Contexts</h2>
      <p>Rural volume is often highly seasonal, driven by local industry (harvests, tourism) or weather. We use <strong>Exponential Smoothing</strong> and <strong>ARIMA</strong> models to generate 30-day forecasts with confidence intervals to drive resilient nurse scheduling.</p>
    `,
    simulation: "/src/modules/rh-14-modeling-toolkit/index.html",
    module_id: "CH-14 (Analytics Toolkit)"
  },
  {
    id: 5,
    title: "Survival Analysis: Staff Retention and Patient LOS",
    summary: "Using Kaplan-Meier and Cox PH models to understand time-to-event data.",
    content: `
      <h2>5.1 Modeling Nurse Burnout</h2>
      <p>In rural hospitals, staff retention is a survival problem. We model the hazard rate of nurse departure to identify the '2-year cliff' and develop intervention strategies before departure cascades occur.</p>
    `,
    simulation: "/src/modules/rh-14-modeling-toolkit/index.html",
    module_id: "CH-14 (Analytics Toolkit)"
  },
  {
    id: 6,
    title: "Queuing Theory: Erlang-C for Bed and Staff Planning",
    summary: "Stochastic modeling of wait times and system utilization.",
    content: `
      <h2>6.1 The Erlang-C Congestion Model</h2>
      <p>Predicting how many ED treatment slots or inpatient beds are needed. Rural hospitals must staff to the '90th percentile' rather than the mean to avoid frequent saturation due to low capacity depth.</p>
    `,
    simulation: "/src/modules/rh-5-occupancy-calculator/index.html",
    module_id: "CH-6 (Queue Lab)"
  },
  {
    id: 7,
    title: "Discrete Event Simulation (DES)",
    summary: "High-fidelity digital twins of hospital workflows.",
    content: `
      <h2>7.1 Building the Hospital Digital Twin</h2>
      <p>DES allows us to model complex, step-dependent processes like Patient Flow. From Lab turnaround times to Imaging bottlenecks, we simulate thousands of independent events to find the 'Critical Path' bottleneck.</p>
    `,
    simulation: "/src/modules/rh-11-digital-twin/index.html",
    module_id: "CH-11 (Digital Twin)"
  },
  {
    id: 8,
    title: "System Dynamics: The Long-Term View",
    summary: "Modeling feedback loops in workforce, finance, and quality.",
    content: `
      <h2>8.1 Causal Loops in Rural Recruitment</h2>
      <p>Recruitment lead times and burnout create feedback loops. System dynamics mapping helps us visualize how a short-term cut in retention spend can lead to a 5-year explosion in locum tenens costs.</p>
    `,
    simulation: "/src/modules/rh-8-workforce-optimization/index.html",
    module_id: "CH-8 (Dynamics Lab)"
  },
  {
    id: 9,
    title: "Agent-Based Modeling (ABM) and Emergence",
    summary: "Simulating emergent behavior from patient and staff agent interactions.",
    content: `
      <h2>9.1 The Cascade Effect</h2>
      <p>ABM allows us to see how a single critical trauma patient (the 'Agent') impacts the flow of all other 'Standard' patients, creating a cascade of wait-time increases throughout the facility.</p>
    `,
    simulation: "/src/modules/rh-7-patient-flow/index.html",
    module_id: "CH-7 (Patient Flow)"
  },
  {
    id: 10,
    title: "Network Analysis: Regional Referring & Catchments",
    summary: "Visualizing travel times, GIS accessibility, and medical deserts.",
    content: `
      <h2>10.1 The Referral Network Graph</h2>
      <p>Rural hospitals are not islands. We model them as nodes in a regional transfer network, analyzing 'Betweenness' centrality to see how your facility acts as a critical triage hub for even more remote clinics.</p>
    `,
    simulation: "/src/modules/rh-1-catchment-accessibility/index.html",
    module_id: "CH-5 (Accessibility)"
  },
  {
    id: 11,
    title: "Machine Learning (ML) in Hospital Operations",
    summary: "Supervised and unsupervised models for readmission and risk prediction.",
    content: `
      <h2>11.1 Predictive Analytics at the Bedside</h2>
      <p>Using Random Forests and Logistic Regression to identify patients at high risk of readmission before they leave the hospital, enabling targeted care transition interventions.</p>
    `,
    simulation: "/src/modules/rh-14-modeling-toolkit/index.html",
    module_id: "CH-14 (Analytics Toolkit)"
  },
  {
    id: 12,
    title: "Optimization: Linear and Integer Programming",
    summary: "Solving for the lowest cost nurse schedules and supply chain routes.",
    content: `
      <h2>12.1 The Nurse Scheduling Problem</h2>
      <p>How to minimize labor costs while meeting 100% of nurse-to-patient coverage ratios. We optimize for constraints like OT limits, seniority preferences, and shift-equity.</p>
    `,
    simulation: "/src/modules/rh-8-workforce-optimization/index.html",
    module_id: "CH-8 (Workforce Lab)"
  },
  {
    id: 13,
    title: "Decision Analysis: Capital and ROI Planning",
    summary: "Modeling NPV, payback periods, and multi-objective trade-offs.",
    content: `
      <h2>13.1 Capital Investment Modeling</h2>
      <p>Should we buy a new MRI or hire another RN? Decision analysis models help finance teams prioritize projects by modeling Net Present Value (NPV) and staff satisfaction simultaneously.</p>
    `,
    simulation: "/src/modules/rh-14-modeling-toolkit/index.html",
    module_id: "CH-14 (Analytics Toolkit)"
  },
  {
    id: 14,
    title: "Bayesian Methods for Small-Sample Certainty",
    summary: "Informing local data with national benchmarks for better decision making.",
    content: `
      <h2>14.1 The Power of Priors</h2>
      <p>When you only have 10 data points, frequencies are unreliable. Bayesian methods allow us to combine national surgery benchmarks (the 'Prior') with local data to get a stable, credible estimate of current performance.</p>
    `,
    simulation: "/src/modules/rh-14-modeling-toolkit/index.html",
    module_id: "CH-14 (Analytics Toolkit)"
  },
  {
    id: 15,
    title: "Hybrid Modeling: The Synthesis Chapter",
    summary: "Combining DES, ABM, and Queuing into unified operations labs.",
    content: `
      <h2>15.1 The Nexus Operations Dashboard</h2>
      <p>True operational control comes from synthesis. This chapter demonstrates how to link population demographics to hospital beds, and logistics to financial margins in a single 3-sigma surveillance system.</p>
    `,
    simulation: "/src/modules/rh-14-modeling-toolkit/index.html",
    module_id: "CH-14+ (Nexus Toolkit)"
  },
  {
    id: 16,
    title: "Model implementation, Validation, and Governance",
    summary: "Ensuring models are accurate, fair, and actionable in a clinical setting.",
    content: `
      <h2>16.1 Moving from Math to Workflow</h2>
      <p>A perfect model that nobody uses provides zero value. We discuss the human factors of model implementation, clinical validity testing, and the ethical governance of AI in rural health.</p>
    `,
    simulation: null,
    module_id: "Conceptual Reference"
  },
  {
    id: 17,
    title: "Rural Hospital Case Studies: Success Stories",
    summary: "Real-world ROI results from 3-sigma operations modeling.",
    content: `
      <h2>17.1 Case Study: The 15-Bed Stabilizer</h2>
      <p>How one hospital reduced wait times by 40% using DES-driven staffing changes without increasing total labor spend.</p>
    `,
    simulation: null,
    module_id: "Conceptual Reference"
  },
  {
    id: 18,
    title: "Future Horizons: Digital Twins & Federated Learning",
    summary: "The roadmap for AI-driven precision operations in regional health.",
    content: `
      <h2>18.1 The Remote Monitoring Frontier</h2>
      <p>Modeling the 'Hospital at Home' model using IoT and RPM data, effectively extending the hospital walls into the community to alleviate inpatient bed pressure.</p>
    `,
    simulation: "/src/modules/rh-13-future-tech/index.html",
    module_id: "CH-13 (Future Lab)"
  }
];
