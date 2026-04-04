const CHAPTERS = [
  // ── Part I ──────────────────────────────────────────────────────
  {
    id: "p1c1",
    part: 1,
    num: 1,
    title: "What Is Probability?",
    subtitle: "Sample spaces, axioms, and the nature of uncertainty",
    difficulty: "high-school",
    minutes: 45,
    topics: ["Sample spaces", "Kolmogorov axioms", "Classical probability", "Frequentist interpretation"],
    hasNewSims: true,
    route: "/part-1/chapter-1"
  },
  {
    id: "p1c2",
    part: 1,
    num: 2,
    title: "Counting and Combinatorics",
    subtitle: "Permutations, combinations, and the inclusion-exclusion principle",
    difficulty: "high-school",
    minutes: 55,
    topics: ["Permutations", "Combinations", "Pascal's triangle", "Inclusion-exclusion"],
    hasNewSims: true,
    route: "/part-1/chapter-2"
  },
  {
    id: "p1c3",
    part: 1,
    num: 3,
    title: "Conditional Probability and Independence",
    subtitle: "Bayes' theorem, the Monty Hall problem, and updating beliefs",
    difficulty: "high-school",
    minutes: 60,
    topics: ["Bayes' theorem", "Conditional probability", "Independence", "Monty Hall", "Birthday paradox"],
    hasNewSims: true,
    route: "/part-1/chapter-3"
  },
  {
    id: "p1c4",
    part: 1,
    num: 4,
    title: "Discrete Random Variables",
    subtitle: "PMFs, expectation, variance, and the key discrete distributions",
    difficulty: "high-school",
    minutes: 70,
    topics: ["PMF", "Expected value", "Variance", "Binomial", "Poisson", "Geometric"],
    hasNewSims: true,
    route: "/part-1/chapter-4"
  },
  {
    id: "p1c5",
    part: 1,
    num: 5,
    title: "Continuous Random Variables",
    subtitle: "PDFs, the Normal distribution, and the empirical rule",
    difficulty: "high-school",
    minutes: 65,
    topics: ["PDF", "CDF", "Normal distribution", "Exponential", "Z-scores"],
    hasNewSims: true,
    route: "/part-1/chapter-5"
  },
  {
    id: "p1c6",
    part: 1,
    num: 6,
    title: "Joint Distributions",
    subtitle: "Covariance, correlation, and bivariate distributions",
    difficulty: "high-school",
    minutes: 60,
    topics: ["Joint PMF/PDF", "Marginals", "Covariance", "Correlation", "Bivariate Normal"],
    hasNewSims: true,
    route: "/part-1/chapter-6"
  },
  // ── Part II ─────────────────────────────────────────────────────
  {
    id: "p2c7",
    part: 2,
    num: 7,
    title: "Transforms and Generating Functions",
    subtitle: "MGFs, characteristic functions, and cumulants",
    difficulty: "undergrad",
    minutes: 75,
    topics: ["MGF", "PGF", "Characteristic functions", "Cumulants"],
    legacyModule: "3.1-characteristic-functions",
    hasNewSims: true,
    route: "/part-2/chapter-7"
  },
  {
    id: "p2c8",
    part: 2,
    num: 8,
    title: "Multivariate Distributions",
    subtitle: "Multinomial, multivariate Normal, order statistics, and copulas",
    difficulty: "undergrad",
    minutes: 80,
    topics: ["Multinomial", "Multivariate Normal", "Order statistics", "Convolution", "Copulas"],
    hasNewSims: true,
    route: "/part-2/chapter-8"
  },
  {
    id: "p2c9",
    part: 2,
    num: 9,
    title: "Conditional Expectation",
    subtitle: "Tower property, Eve's law, and the projection interpretation",
    difficulty: "undergrad",
    minutes: 70,
    topics: ["E[Y|X]", "Tower property", "Eve's law", "Variance decomposition"],
    legacyModule: "4.1-conditional-expectation",
    hasNewSims: true,
    route: "/part-2/chapter-9"
  },
  {
    id: "p2c10",
    part: 2,
    num: 10,
    title: "Limit Theorems",
    subtitle: "LLN, CLT, concentration inequalities, and large deviations",
    difficulty: "undergrad",
    minutes: 90,
    topics: ["WLLN", "SLLN", "CLT", "Chebyshev", "Chernoff", "Berry-Esseen"],
    legacyModule: "2.3-lln-lab",
    hasNewSims: true,
    route: "/part-2/chapter-10"
  },
  {
    id: "p2c11",
    part: 2,
    num: 11,
    title: "Introduction to Stochastic Processes",
    subtitle: "Markov chains, random walks, and the Poisson process",
    difficulty: "undergrad",
    minutes: 85,
    topics: ["Markov chains", "Stationary distributions", "Random walks", "Gambler's ruin", "Poisson process"],
    legacyModule: "6.1-markov-dashboard",
    hasNewSims: true,
    route: "/part-2/chapter-11"
  },
  // ── Part III ────────────────────────────────────────────────────
  {
    id: "p3c12",
    part: 3,
    num: 12,
    title: "Measure-Theoretic Probability",
    subtitle: "σ-algebras, Lebesgue integration, and Radon-Nikodým",
    difficulty: "graduate",
    minutes: 120,
    topics: ["σ-algebras", "Lebesgue integral", "MCT", "DCT", "Radon-Nikodým", "Kolmogorov's 0-1 law"],
    legacyModule: "1.1-sigma-algebra",
    hasNewSims: false,
    route: "/part-3/chapter-12"
  },
  {
    id: "p3c13",
    part: 3,
    num: 13,
    title: "Advanced Limit Theorems",
    subtitle: "Borel-Cantelli, weak convergence, and large deviation theory",
    difficulty: "graduate",
    minutes: 100,
    topics: ["Borel-Cantelli", "Weak convergence", "Portmanteau", "Cramér's theorem", "Donsker's theorem"],
    legacyModule: "2.1-convergence-modes",
    hasNewSims: false,
    route: "/part-3/chapter-13"
  },
  {
    id: "p3c14",
    part: 3,
    num: 14,
    title: "Martingales",
    subtitle: "Optional stopping, convergence theorems, and Azuma-Hoeffding",
    difficulty: "graduate",
    minutes: 110,
    topics: ["Martingales", "Optional stopping", "Doob inequalities", "Azuma-Hoeffding", "McDiarmid"],
    legacyModule: "4.2-martingale-explorer",
    hasNewSims: false,
    route: "/part-3/chapter-14"
  },
  {
    id: "p3c15",
    part: 3,
    num: 15,
    title: "Continuous-Time Stochastic Processes",
    subtitle: "Brownian motion, Gaussian processes, and CTMCs",
    difficulty: "graduate",
    minutes: 115,
    topics: ["Brownian motion", "Quadratic variation", "Gaussian processes", "OU process", "CTMC"],
    legacyModule: "5.2-brownian-properties",
    hasNewSims: false,
    route: "/part-3/chapter-15"
  },
  // ── Part IV ─────────────────────────────────────────────────────
  {
    id: "p4c16",
    part: 4,
    num: 16,
    title: "Stochastic Calculus",
    subtitle: "Itô integral, SDEs, Girsanov's theorem, and Feynman-Kac",
    difficulty: "graduate",
    minutes: 130,
    topics: ["Itô integral", "Itô's formula", "SDEs", "Girsanov", "Feynman-Kac", "Black-Scholes"],
    legacyModule: "7.1-ito-integral",
    hasNewSims: false,
    route: "/part-4/chapter-16"
  },
  {
    id: "p4c17",
    part: 4,
    num: 17,
    title: "Markov Processes and Potential Theory",
    subtitle: "Lévy processes, Gibbs measures, and harmonic functions",
    difficulty: "graduate",
    minutes: 120,
    topics: ["Lévy processes", "Lévy-Khintchine", "Gibbs measures", "Ising model", "Potential theory"],
    hasNewSims: false,
    route: "/part-4/chapter-17"
  },
  {
    id: "p4c18",
    part: 4,
    num: 18,
    title: "Ergodic Theory",
    subtitle: "Birkhoff's theorem, mixing, and Kolmogorov-Sinai entropy",
    difficulty: "graduate",
    minutes: 110,
    topics: ["Ergodicity", "Birkhoff's theorem", "Mixing", "KS entropy", "Spectral gap"],
    legacyModule: "6.2-ergodic-mixing",
    hasNewSims: false,
    route: "/part-4/chapter-18"
  },
  {
    id: "p4c19",
    part: 4,
    num: 19,
    title: "Information Theory and Probability",
    subtitle: "Entropy, KL divergence, mutual information, and Fisher information",
    difficulty: "graduate",
    minutes: 100,
    topics: ["Shannon entropy", "KL divergence", "Mutual information", "Fisher information", "Max entropy"],
    legacyModule: "9.1-entropy-kl",
    hasNewSims: false,
    route: "/part-4/chapter-19"
  },
  {
    id: "p4c20",
    part: 4,
    num: 20,
    title: "Bayesian Nonparametrics",
    subtitle: "Dirichlet processes, Gaussian process regression, and de Finetti",
    difficulty: "graduate",
    minutes: 125,
    topics: ["de Finetti", "Dirichlet process", "CRP", "GP regression", "Bernstein-von Mises"],
    hasNewSims: true,
    route: "/part-4/chapter-20"
  },
  {
    id: "p4c21",
    part: 4,
    num: 21,
    title: "Random Matrices",
    subtitle: "Wigner semicircle, Marchenko-Pastur, and universality",
    difficulty: "graduate",
    minutes: 120,
    topics: ["GOE/GUE", "Wigner semicircle", "Marchenko-Pastur", "Tracy-Widom", "Free probability"],
    hasNewSims: true,
    route: "/part-4/chapter-21"
  },
  {
    id: "p4c22",
    part: 4,
    num: 22,
    title: "Probabilistic Combinatorics",
    subtitle: "The probabilistic method, Lovász LLL, and random graphs",
    difficulty: "graduate",
    minutes: 110,
    topics: ["Probabilistic method", "Lovász LLL", "Erdős-Rényi", "Phase transitions", "Talagrand"],
    hasNewSims: true,
    route: "/part-4/chapter-22"
  },
  // ── Part V ──────────────────────────────────────────────────────
  {
    id: "p5c23",
    part: 5,
    num: 23,
    title: "Stochastic Analysis on Manifolds",
    subtitle: "Malliavin calculus, rough paths, and BM on Riemannian manifolds",
    difficulty: "research",
    minutes: 150,
    topics: ["Brownian motion on manifolds", "Malliavin calculus", "Rough paths", "Signatures"],
    hasNewSims: false,
    route: "/part-5/chapter-23"
  },
  {
    id: "p5c24",
    part: 5,
    num: 24,
    title: "Interacting Particle Systems",
    subtitle: "Voter model, TASEP, and hydrodynamic limits",
    difficulty: "research",
    minutes: 140,
    topics: ["Voter model", "Contact process", "TASEP", "Hydrodynamic limits", "Duality"],
    hasNewSims: true,
    route: "/part-5/chapter-24"
  },
  {
    id: "p5c25",
    part: 5,
    num: 25,
    title: "Optimal Transport",
    subtitle: "Wasserstein distances, Sinkhorn algorithm, and applications",
    difficulty: "research",
    minutes: 145,
    topics: ["Monge problem", "Kantorovich duality", "Wasserstein distance", "Sinkhorn", "Brenier theorem"],
    hasNewSims: true,
    route: "/part-5/chapter-25"
  },
  {
    id: "p5c26",
    part: 5,
    num: 26,
    title: "High-Dimensional Probability",
    subtitle: "Concentration of measure, VC theory, and compressed sensing",
    difficulty: "research",
    minutes: 140,
    topics: ["Sub-Gaussian RVs", "JL lemma", "VC dimension", "Rademacher complexity", "RIP"],
    hasNewSims: true,
    route: "/part-5/chapter-26"
  },
  {
    id: "p5c27",
    part: 5,
    num: 27,
    title: "Markov Chain Monte Carlo",
    subtitle: "HMC, particle filters, mixing times, and variational inference",
    difficulty: "research",
    minutes: 135,
    topics: ["Metropolis-Hastings", "HMC", "Gibbs sampler", "Mixing times", "Particle filter"],
    legacyModule: "8.2-mcmc-explorer",
    hasNewSims: true,
    route: "/part-5/chapter-27"
  },
  {
    id: "p5c28",
    part: 5,
    num: 28,
    title: "Probabilistic Graphical Models",
    subtitle: "Bayesian networks, belief propagation, and causal inference",
    difficulty: "research",
    minutes: 130,
    topics: ["Bayesian networks", "Belief propagation", "EM algorithm", "do-calculus", "Causal DAGs"],
    hasNewSims: true,
    route: "/part-5/chapter-28"
  }
];
const PARTS = [
  {
    num: 1,
    title: "Foundations",
    subtitle: "High School / Early College — Prerequisites: Algebra II",
    color: "var(--green)",
    chapters: CHAPTERS.filter((c) => c.part === 1)
  },
  {
    num: 2,
    title: "Intermediate Probability",
    subtitle: "Sophomore/Junior Undergraduate — Prerequisites: Calculus I–III",
    color: "var(--blue)",
    chapters: CHAPTERS.filter((c) => c.part === 2)
  },
  {
    num: 3,
    title: "Advanced Undergraduate",
    subtitle: "Senior/First-Year Graduate — Prerequisites: Real Analysis, Measure Theory",
    color: "var(--purple)",
    chapters: CHAPTERS.filter((c) => c.part === 3)
  },
  {
    num: 4,
    title: "Graduate Level",
    subtitle: "First/Second Year PhD — Prerequisites: Graduate Real Analysis, Functional Analysis",
    color: "var(--orange)",
    chapters: CHAPTERS.filter((c) => c.part === 4)
  },
  {
    num: 5,
    title: "Research Frontiers",
    subtitle: "Advanced PhD / Research — Prerequisites: All prior parts",
    color: "var(--red)",
    chapters: CHAPTERS.filter((c) => c.part === 5)
  }
];
function difficultyLabel(d) {
  return { "high-school": "High School", undergrad: "Undergraduate", graduate: "Graduate", research: "Research" }[d];
}
function difficultyClass(d) {
  return { "high-school": "badge-hs", undergrad: "badge-ug", graduate: "badge-grad", research: "badge-res" }[d];
}
function getChapter(partNum, chapterNum) {
  return CHAPTERS.find((c) => c.part === partNum && c.num === chapterNum);
}
function getNext(ch) {
  const idx = CHAPTERS.indexOf(ch);
  return CHAPTERS[idx + 1];
}
function getPrev(ch) {
  const idx = CHAPTERS.indexOf(ch);
  return CHAPTERS[idx - 1];
}
export {
  CHAPTERS as C,
  PARTS as P,
  difficultyLabel as a,
  getPrev as b,
  getNext as c,
  difficultyClass as d,
  getChapter as g
};
