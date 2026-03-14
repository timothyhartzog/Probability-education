/* ============================================================
   Module MQ-8 — Evidence-Based Medicine Integration Hub
   ============================================================
   Interactive Venn diagram visualizing the three pillars of EBM:
   Best Evidence, Clinical Expertise, and Patient Values.
   Includes evidence pyramid, clinician profiles, patient personas,
   decision simulator, and the 5-step EBM process flow.
   ============================================================ */

import * as d3 from 'd3';
import katex from 'katex';

/* ============================================================
   DATA: Clinical Scenarios
   ============================================================ */
const SCENARIOS = {
  hypertension: {
    label: 'Hypertension Treatment',
    description: 'First-line antihypertensive therapy for newly diagnosed essential hypertension.',
    evidence: { level: 'SR/MA', grade: 'High', summary: 'Multiple large RCTs and meta-analyses show thiazide diuretics and ACE inhibitors reduce cardiovascular events by 20-25%. ALLHAT (n=33,357) found no difference between classes for primary outcome.' },
    expertise: { key: 'Assessing secondary causes, comorbidity-driven drug selection, monitoring for adverse effects, adjusting based on individual response.' },
    values: { considerations: 'Pill burden tolerance, concern about sexual side effects (beta-blockers), preference for once-daily dosing, cost sensitivity, cultural attitudes toward lifelong medication.' },
    recommendation: 'Strong recommendation for pharmacotherapy; drug choice should integrate comorbidities and patient preference.'
  },
  'cancer-screening': {
    label: 'Cancer Screening',
    description: 'Lung cancer screening with low-dose CT in high-risk adults.',
    evidence: { level: 'RCT', grade: 'Moderate', summary: 'NLST showed 20% relative reduction in lung cancer mortality with LDCT vs chest X-ray. NELSON trial confirmed benefit. High false-positive rate (~25% at first round) leads to invasive follow-up procedures.' },
    expertise: { key: 'Identifying truly high-risk patients (pack-year history), managing incidental findings, coordinating multidisciplinary follow-up, shared decision-making about screening trade-offs.' },
    values: { considerations: 'Anxiety from false positives, willingness to undergo invasive procedures if positive, smoking cessation motivation, life expectancy considerations, personal/family cancer history impact on risk perception.' },
    recommendation: 'Conditional recommendation; shared decision making essential given trade-off between mortality reduction and false-positive burden.'
  },
  anticoagulation: {
    label: 'Anticoagulation for AF',
    description: 'Oral anticoagulation for stroke prevention in non-valvular atrial fibrillation.',
    evidence: { level: 'SR/MA', grade: 'High', summary: 'DOACs reduce stroke by ~35% vs warfarin with lower intracranial hemorrhage risk. CHA₂DS₂-VASc score guides treatment threshold. HAS-BLED score estimates bleeding risk.' },
    expertise: { key: 'CHA₂DS₂-VASc and HAS-BLED scoring, renal dose adjustment, drug interaction awareness, recognizing high fall-risk patients, bridging decisions peri-procedure.' },
    values: { considerations: 'Fear of bleeding complications, dietary restrictions with warfarin, preference for no monitoring (DOACs) vs regular INR checks, cost (DOACs vs generic warfarin), concerns about reversal agents in emergencies.' },
    recommendation: 'Strong recommendation for anticoagulation if CHA₂DS₂-VASc ≥ 2; DOAC preferred over warfarin for most patients.'
  },
  depression: {
    label: 'Depression Management',
    description: 'First-line treatment for moderate major depressive disorder.',
    evidence: { level: 'SR/MA', grade: 'Moderate', summary: 'SSRIs show modest benefit over placebo (NNT ~7 for response). CBT has comparable efficacy. Combination therapy (SSRI + CBT) shows added benefit in moderate-severe depression. Exercise shows small-moderate effect.' },
    expertise: { key: 'Differentiating depression subtypes, suicide risk assessment, medication selection based on side-effect profile, therapy referral pathways, managing treatment-resistant cases.' },
    values: { considerations: 'Stigma around mental health treatment, preference for therapy vs medication, concerns about sexual side effects, fear of dependency, cultural views on mental illness, interest in lifestyle interventions.' },
    recommendation: 'Conditional recommendation; patient preference between medication and psychotherapy should drive initial choice.'
  }
};

/* ============================================================
   DATA: Evidence Hierarchy Pyramid
   ============================================================ */
const EVIDENCE_LEVELS = [
  {
    id: 'sr-ma',
    label: 'Systematic Reviews & Meta-Analyses',
    shortLabel: 'SR / MA',
    color: '#1e40af',
    description: 'Comprehensive synthesis of all available studies on a specific question. Uses rigorous search and quality assessment methods.',
    strengths: ['Highest level of evidence', 'Reduces bias through systematic methods', 'Increases statistical power by pooling data'],
    weaknesses: ['Garbage in, garbage out — depends on included study quality', 'Heterogeneity between studies can limit conclusions', 'Publication bias may skew results'],
    example: 'Cochrane Review of antihypertensives for primary prevention of cardiovascular disease'
  },
  {
    id: 'rct',
    label: 'Randomized Controlled Trials',
    shortLabel: 'RCTs',
    color: '#2563eb',
    description: 'Participants randomly assigned to intervention or control group. Gold standard for establishing causation.',
    strengths: ['Minimizes confounding through randomization', 'Allows causal inference', 'Blinding reduces observation bias'],
    weaknesses: ['Expensive and time-consuming', 'Strict inclusion criteria may limit generalizability', 'Ethical constraints on what can be randomized'],
    example: 'ALLHAT trial — 33,357 patients comparing antihypertensive drug classes'
  },
  {
    id: 'cohort',
    label: 'Cohort Studies',
    shortLabel: 'Cohort',
    color: '#3b82f6',
    description: 'Follow groups of people over time to see who develops outcomes. Can be prospective or retrospective.',
    strengths: ['Can study rare exposures', 'Establishes temporal sequence', 'Useful when RCTs are impractical or unethical'],
    weaknesses: ['Cannot prove causation (confounding)', 'Loss to follow-up can introduce bias', 'Expensive for prospective designs'],
    example: 'Framingham Heart Study — following cardiovascular risk factors since 1948'
  },
  {
    id: 'case-control',
    label: 'Case-Control Studies',
    shortLabel: 'Case-Control',
    color: '#60a5fa',
    description: 'Compare people with a condition (cases) to those without (controls) and look back at exposures.',
    strengths: ['Efficient for rare diseases', 'Relatively quick and inexpensive', 'Can examine multiple exposures'],
    weaknesses: ['Prone to recall bias', 'Difficult to establish temporal relationship', 'Selection of controls is challenging'],
    example: 'Studies linking thalidomide to birth defects'
  },
  {
    id: 'case-reports',
    label: 'Case Series & Case Reports',
    shortLabel: 'Cases',
    color: '#93c5fd',
    description: 'Detailed reports of individual patients or small groups. Hypothesis-generating, not hypothesis-testing.',
    strengths: ['Can identify novel conditions or drug reactions', 'Useful for rare diseases', 'No ethical constraints'],
    weaknesses: ['No control group', 'Cannot establish causation or prevalence', 'Selection and publication bias'],
    example: 'Initial reports of Pneumocystis pneumonia in young men (early HIV/AIDS recognition)'
  },
  {
    id: 'expert-opinion',
    label: 'Expert Opinion & Bench Research',
    shortLabel: 'Opinion',
    color: '#bfdbfe',
    description: 'Clinical experience, pathophysiological reasoning, and laboratory studies. Foundation for generating hypotheses.',
    strengths: ['Valuable when no other evidence exists', 'Integrates clinical experience', 'Guides initial research directions'],
    weaknesses: ['Most susceptible to bias', 'Based on individual experience, not systematic observation', 'Authority-based rather than evidence-based'],
    example: 'Historical practice of bloodletting based on humoral theory'
  }
];

/* ============================================================
   DATA: Clinician Profiles
   ============================================================ */
const CLINICIAN_PROFILES = [
  {
    id: 'junior',
    title: 'Junior Resident',
    icon: '\u{1F9D1}\u200D\u2695\uFE0F',
    years: 1,
    description: 'PGY-1, strong on textbook knowledge, limited clinical pattern recognition.',
    strengths: ['Up-to-date training', 'Familiar with latest guidelines', 'Systematic approach to workups'],
    limitations: ['Limited pattern recognition', 'Less comfort with diagnostic uncertainty', 'May over-investigate'],
    approach: 'Relies heavily on guidelines and protocols. Benefits from evidence-based algorithms. May need guidance on integrating patient preferences into complex decisions.'
  },
  {
    id: 'specialist',
    title: 'Experienced Specialist',
    icon: '\u{1F468}\u200D\u2695\uFE0F',
    years: 15,
    description: '15 years in cardiology, deep expertise in a narrow domain.',
    strengths: ['Expert pattern recognition', 'Procedural mastery', 'Deep knowledge of disease nuances'],
    limitations: ['May have anchoring bias', 'Narrow focus can miss comorbidities', 'May default to familiar treatments'],
    approach: 'Integrates evidence with extensive personal experience. Can identify when a patient deviates from typical trial populations. Key role in communicating nuanced risk-benefit to patients.'
  },
  {
    id: 'gp',
    title: 'General Practitioner',
    icon: '\u{1F469}\u200D\u2695\uFE0F',
    years: 10,
    description: '10 years in community practice, broad diagnostic experience.',
    strengths: ['Broad knowledge base', 'Understands patient context and family', 'Continuity of care relationships'],
    limitations: ['Cannot be expert in every domain', 'Resource constraints in community setting', 'May defer to specialist opinion too readily'],
    approach: 'Balances population-level evidence with individual patient knowledge. Excels at shared decision-making through long-term therapeutic relationships. First point of integration for EBM principles.'
  }
];

/* ============================================================
   DATA: Patient Personas
   ============================================================ */
const PATIENT_PERSONAS = [
  {
    id: 'pragmatic',
    name: 'Pragmatic Pat',
    age: 58,
    description: 'Values efficiency and clear outcomes. Prefers taking medication if evidence supports it.',
    riskTolerance: 70,
    healthLiteracy: 80,
    treatmentPreference: 90,
    qualityVsLongevity: 50,
    traits: ['Trusts medical authority', 'Follows instructions closely', 'Cost-conscious', 'Wants minimal disruption to routine']
  },
  {
    id: 'cautious',
    name: 'Cautious Casey',
    age: 45,
    description: 'Risk-averse, prefers lifestyle changes over medication. Concerned about side effects.',
    riskTolerance: 25,
    healthLiteracy: 65,
    treatmentPreference: 30,
    qualityVsLongevity: 70,
    traits: ['Prefers natural approaches', 'Researches extensively online', 'Anxious about adverse effects', 'Values quality of life highly']
  },
  {
    id: 'informed',
    name: 'Informed Iman',
    age: 62,
    description: 'Retired scientist, highly health-literate, wants to see the data and co-decide.',
    riskTolerance: 55,
    healthLiteracy: 95,
    treatmentPreference: 60,
    qualityVsLongevity: 55,
    traits: ['Asks about NNT and NNH', 'Reads primary literature', 'Wants shared decision-making', 'Weighs trade-offs analytically']
  },
  {
    id: 'cultural',
    name: 'Cultural Carmen',
    age: 70,
    description: 'Strong cultural and family values influence healthcare decisions. Integrates traditional practices.',
    riskTolerance: 40,
    healthLiteracy: 45,
    treatmentPreference: 40,
    qualityVsLongevity: 75,
    traits: ['Family-centered decisions', 'Integrates traditional medicine', 'Language barriers may exist', 'Prioritizes family/community role']
  }
];

/* ============================================================
   DATA: 5-Step EBM Process
   ============================================================ */
const EBM_STEPS = [
  {
    id: 'ask',
    label: 'ASK',
    title: 'Formulate the Question',
    description: 'Translate clinical uncertainty into a structured, answerable question using the PICO framework.',
    details: '<h4>The PICO Framework</h4><p><strong>P</strong>atient/Problem — Who is the patient? What is the condition?</p><p><strong>I</strong>ntervention — What treatment or test are you considering?</p><p><strong>C</strong>omparison — What is the alternative (another treatment, placebo, no treatment)?</p><p><strong>O</strong>utcome — What do you hope to achieve or avoid?</p><p><em>Example:</em> In adults with newly diagnosed hypertension <strong>(P)</strong>, does starting an ACE inhibitor <strong>(I)</strong> compared to a thiazide diuretic <strong>(C)</strong> reduce cardiovascular events <strong>(O)</strong>?</p>'
  },
  {
    id: 'acquire',
    label: 'ACQUIRE',
    title: 'Search for Evidence',
    description: 'Efficiently locate the best available evidence from reliable sources.',
    details: '<h4>Key Resources</h4><ul><li><strong>Cochrane Library</strong> — gold standard for systematic reviews</li><li><strong>PubMed / MEDLINE</strong> — comprehensive biomedical literature database</li><li><strong>UpToDate / DynaMed</strong> — pre-appraised evidence summaries</li><li><strong>NICE / WHO Guidelines</strong> — evidence-based clinical guidelines</li></ul><p>Use MeSH terms and Boolean operators for efficient searching. Start with pre-appraised sources (systematic reviews, guidelines) before searching primary literature.</p>'
  },
  {
    id: 'appraise',
    label: 'APPRAISE',
    title: 'Critically Evaluate',
    description: 'Assess the validity, importance, and applicability of the evidence found.',
    details: '<h4>Critical Appraisal Questions</h4><ul><li><strong>Validity:</strong> Was the study well-designed? Was there randomization, blinding, adequate follow-up?</li><li><strong>Importance:</strong> How large is the effect? What are the confidence intervals? Is it clinically significant?</li><li><strong>Applicability:</strong> Is my patient similar to study participants? Are the outcomes relevant?</li></ul><p>Use structured appraisal tools like <strong>CASP checklists</strong> and the <strong>GRADE framework</strong> for systematic evaluation.</p>'
  },
  {
    id: 'apply',
    label: 'APPLY',
    title: 'Integrate & Decide',
    description: 'Combine evidence with clinical expertise and patient values to make a decision.',
    details: '<h4>The Integration Challenge</h4><p>This is the core of EBM — where evidence meets the real world. Consider:</p><ul><li>Does the evidence apply to <em>this specific</em> patient?</li><li>What does clinical experience suggest about likely outcomes?</li><li>What are the patient\'s values, preferences, and circumstances?</li><li>What are the available resources and feasibility constraints?</li></ul><p>Use <strong>shared decision-making</strong> tools and techniques to engage the patient in the process.</p>'
  },
  {
    id: 'assess',
    label: 'ASSESS',
    title: 'Evaluate Outcomes',
    description: 'Monitor results and refine the approach based on observed outcomes.',
    details: '<h4>Closing the Loop</h4><p>EBM is iterative. After applying the decision:</p><ul><li>Monitor the patient\'s response to treatment</li><li>Compare outcomes to what evidence predicted</li><li>Identify any discrepancies and adjust the plan</li><li>Reflect on the decision-making process itself</li></ul><p>This step feeds back into <strong>ASK</strong>, creating a continuous learning cycle that improves both individual patient care and the clinician\'s expertise over time.</p>'
  }
];

/* ============================================================
   STATE
   ============================================================ */
let state = {
  scenario: 'hypertension',
  evidenceWeight: 70,
  expertiseWeight: 60,
  valuesWeight: 50,
  showLabels: true,
  showProcess: true,
  activePanel: null,
  activeProfile: null,
  activePersona: null,
  activeStep: null,
  activeEvidenceLevel: null
};

/* ============================================================
   SPHERE TOOLTIP DATA
   ============================================================ */
const SPHERE_INFO = {
  evidence: {
    title: 'Best External Evidence',
    text: 'High-quality clinical research from systematic reviews, meta-analyses, and randomized controlled trials that provides the scientific foundation for clinical decisions.'
  },
  expertise: {
    title: 'Clinical Expertise',
    text: 'The clinician\'s cumulative experience, education, and clinical skills — including diagnostic accuracy, therapeutic judgment, and procedural competence.'
  },
  values: {
    title: 'Patient Values & Expectations',
    text: 'The patient\'s unique preferences, concerns, cultural context, and expectations that must be integrated into every clinical decision.'
  },
  center: {
    title: 'Evidence-Based Decision',
    text: 'The optimal clinical decision emerges where strong evidence, expert judgment, and patient values converge. This is where the best care resides.'
  }
};

/* ============================================================
   INITIALIZATION
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  drawVennDiagram();
  buildProcessFlow();
  wireControls();
  updateStats();
});

/* ============================================================
   VENN DIAGRAM (D3.js)
   ============================================================ */
function drawVennDiagram() {
  const container = d3.select('#venn-chart');
  container.selectAll('svg').remove();

  const width = 600;
  const height = 420;
  const cx = width / 2;
  const cy = height / 2 - 10;
  const baseR = 130;

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // Sphere positions (equilateral triangle arrangement)
  const offset = 75;
  const spheres = [
    { id: 'evidence',  cx: cx,                 cy: cy - offset,        color: '#3b82f6', label: 'Best Evidence' },
    { id: 'expertise', cx: cx - offset * 0.95, cy: cy + offset * 0.6,  color: '#22c55e', label: 'Clinical Expertise' },
    { id: 'values',    cx: cx + offset * 0.95, cy: cy + offset * 0.6,  color: '#f59e0b', label: 'Patient Values' }
  ];

  // Compute radii from weights
  function getRadius(id) {
    const w = id === 'evidence' ? state.evidenceWeight
            : id === 'expertise' ? state.expertiseWeight
            : state.valuesWeight;
    return baseR * (0.6 + 0.4 * w / 100);
  }

  // Define blend mode for overlaps
  const defs = svg.append('defs');

  // Clip for center detection isn't needed, we use position

  // Draw spheres
  const sphereGroups = svg.selectAll('.sphere-group')
    .data(spheres)
    .enter()
    .append('g')
    .attr('class', 'sphere-group')
    .style('cursor', 'pointer');

  sphereGroups.append('circle')
    .attr('cx', d => d.cx)
    .attr('cy', d => d.cy)
    .attr('r', d => getRadius(d.id))
    .attr('fill', d => d.color)
    .attr('fill-opacity', 0.25)
    .attr('stroke', d => d.color)
    .attr('stroke-width', 2.5)
    .attr('class', 'sphere-circle');

  // Labels
  const labels = sphereGroups.append('text')
    .attr('x', d => {
      if (d.id === 'evidence') return d.cx;
      if (d.id === 'expertise') return d.cx - 30;
      return d.cx + 30;
    })
    .attr('y', d => {
      if (d.id === 'evidence') return d.cy - getRadius(d.id) * 0.55;
      return d.cy + getRadius(d.id) * 0.55;
    })
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', '14px')
    .attr('font-weight', '700')
    .attr('fill', d => d.color)
    .attr('class', 'sphere-label')
    .text(d => d.label);

  // Center label
  const centerLabel = svg.append('text')
    .attr('x', cx)
    .attr('y', cy + 5)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', '12px')
    .attr('font-weight', '700')
    .attr('fill', '#dc2626')
    .attr('class', 'sphere-label')
    .text('EBM Decision');

  // Center highlight circle
  const centerCircle = svg.append('circle')
    .attr('cx', cx)
    .attr('cy', cy)
    .attr('r', 28)
    .attr('fill', '#dc2626')
    .attr('fill-opacity', 0.15)
    .attr('stroke', '#dc2626')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '4,3')
    .style('cursor', 'pointer');

  // Tooltip element
  const tooltip = d3.select('#venn-tooltip');

  function showTooltip(info, event) {
    tooltip
      .style('display', 'block')
      .html(`<div class="tooltip-title">${info.title}</div><div>${info.text}</div>`);
    const rect = container.node().getBoundingClientRect();
    const x = event.clientX - rect.left + 15;
    const y = event.clientY - rect.top - 10;
    tooltip.style('left', x + 'px').style('top', y + 'px');
  }

  function hideTooltip() {
    tooltip.style('display', 'none');
  }

  // Sphere interactions
  sphereGroups
    .on('mouseenter', function (event, d) {
      d3.select(this).select('circle')
        .transition().duration(200)
        .attr('fill-opacity', 0.4)
        .attr('stroke-width', 3.5);
      showTooltip(SPHERE_INFO[d.id], event);
    })
    .on('mousemove', (event, d) => showTooltip(SPHERE_INFO[d.id], event))
    .on('mouseleave', function () {
      d3.select(this).select('circle')
        .transition().duration(200)
        .attr('fill-opacity', 0.25)
        .attr('stroke-width', 2.5);
      hideTooltip();
    })
    .on('click', (event, d) => {
      event.stopPropagation();
      hideTooltip();
      openPanel(d.id);
    });

  // Center interactions
  centerCircle
    .on('mouseenter', (event) => {
      centerCircle.transition().duration(200).attr('fill-opacity', 0.3);
      showTooltip(SPHERE_INFO.center, event);
    })
    .on('mousemove', (event) => showTooltip(SPHERE_INFO.center, event))
    .on('mouseleave', () => {
      centerCircle.transition().duration(200).attr('fill-opacity', 0.15);
      hideTooltip();
    })
    .on('click', (event) => {
      event.stopPropagation();
      hideTooltip();
      openPanel('decision');
    });

  // Store reference for updates
  window._ebmVenn = { svg, spheres, sphereGroups, labels, centerLabel, centerCircle, cx, cy, baseR, offset };

  updateVennSizes();
}

function updateVennSizes() {
  if (!window._ebmVenn) return;
  const { sphereGroups, baseR } = window._ebmVenn;

  function getRadius(id) {
    const w = id === 'evidence' ? state.evidenceWeight
            : id === 'expertise' ? state.expertiseWeight
            : state.valuesWeight;
    return baseR * (0.6 + 0.4 * w / 100);
  }

  sphereGroups.select('circle')
    .transition().duration(400)
    .attr('r', d => getRadius(d.id));

  // Update label positions
  sphereGroups.select('text')
    .transition().duration(400)
    .attr('y', d => {
      if (d.id === 'evidence') return d.cy - getRadius(d.id) * 0.55;
      return d.cy + getRadius(d.id) * 0.55;
    });
}

/* ============================================================
   PANEL MANAGEMENT
   ============================================================ */
function openPanel(panelId) {
  // Close all panels first
  document.querySelectorAll('.module-panel').forEach(p => p.style.display = 'none');

  const mapping = {
    evidence: 'evidence-panel',
    expertise: 'expertise-panel',
    values: 'values-panel',
    decision: 'decision-panel'
  };

  const el = document.getElementById(mapping[panelId]);
  if (el) {
    el.style.display = 'block';
    state.activePanel = panelId;

    // Build panel content on open
    if (panelId === 'evidence') buildEvidencePyramid();
    if (panelId === 'expertise') buildExpertiseProfiles();
    if (panelId === 'values') buildPatientValues();
    if (panelId === 'decision') buildDecisionSimulator();

    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// Wire close buttons
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('panel-close')) {
    e.target.closest('.module-panel').style.display = 'none';
    state.activePanel = null;
  }
});

/* ============================================================
   MODULE A: Evidence Pyramid
   ============================================================ */
function buildEvidencePyramid() {
  const container = d3.select('#pyramid-chart');
  container.selectAll('*').remove();

  const width = 500;
  const height = 360;
  const padding = 20;
  const levelH = (height - padding * 2) / EVIDENCE_LEVELS.length;

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const levels = svg.selectAll('.pyramid-level')
    .data(EVIDENCE_LEVELS)
    .enter()
    .append('g')
    .attr('class', d => `pyramid-level ${state.activeEvidenceLevel === d.id ? 'active' : ''}`)
    .style('cursor', 'pointer');

  // Draw trapezoids (pyramid shape)
  levels.append('path')
    .attr('d', (d, i) => {
      const y1 = padding + i * levelH;
      const y2 = y1 + levelH - 3;
      const topRatio = 0.15 + (i / EVIDENCE_LEVELS.length) * 0.7;
      const botRatio = 0.15 + ((i + 1) / EVIDENCE_LEVELS.length) * 0.7;
      const x1t = width / 2 - (width * topRatio) / 2;
      const x2t = width / 2 + (width * topRatio) / 2;
      const x1b = width / 2 - (width * botRatio) / 2;
      const x2b = width / 2 + (width * botRatio) / 2;
      return `M${x1t},${y1} L${x2t},${y1} L${x2b},${y2} L${x1b},${y2} Z`;
    })
    .attr('fill', d => d.color)
    .attr('fill-opacity', 0.7)
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5);

  // Labels
  levels.append('text')
    .attr('x', width / 2)
    .attr('y', (d, i) => padding + i * levelH + levelH / 2)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', (d, i) => i < 3 ? '#fff' : '#1e293b')
    .attr('font-size', '12px')
    .attr('font-weight', '600')
    .text(d => d.shortLabel);

  // Click to show details
  levels.on('click', (event, d) => {
    state.activeEvidenceLevel = d.id;
    levels.classed('active', dd => dd.id === d.id);
    showEvidenceDetail(d);
  });

  // Show first level by default
  showEvidenceDetail(EVIDENCE_LEVELS[0]);
  state.activeEvidenceLevel = EVIDENCE_LEVELS[0].id;
}

function showEvidenceDetail(level) {
  const detail = document.getElementById('evidence-detail');
  detail.innerHTML = `
    <h4>${level.label}</h4>
    <p>${level.description}</p>
    <p><strong>Strengths:</strong></p>
    <ul>${level.strengths.map(s => `<li>${s}</li>`).join('')}</ul>
    <p><strong>Weaknesses:</strong></p>
    <ul>${level.weaknesses.map(w => `<li>${w}</li>`).join('')}</ul>
    <p><em>Example: ${level.example}</em></p>
  `;
}

/* ============================================================
   MODULE B: Clinical Expertise Profiles
   ============================================================ */
function buildExpertiseProfiles() {
  const container = document.getElementById('expertise-profiles');
  container.innerHTML = '';

  CLINICIAN_PROFILES.forEach(profile => {
    const card = document.createElement('div');
    card.className = `profile-card ${state.activeProfile === profile.id ? 'active' : ''}`;
    card.innerHTML = `
      <div class="profile-icon">${profile.icon}</div>
      <h4>${profile.title}</h4>
      <p>${profile.years} years experience</p>
    `;
    card.addEventListener('click', () => {
      state.activeProfile = profile.id;
      container.querySelectorAll('.profile-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      showExpertiseDetail(profile);
    });
    container.appendChild(card);
  });

  // Show first profile by default
  const firstProfile = CLINICIAN_PROFILES[0];
  state.activeProfile = firstProfile.id;
  container.querySelector('.profile-card').classList.add('active');
  showExpertiseDetail(firstProfile);
}

function showExpertiseDetail(profile) {
  const scenario = SCENARIOS[state.scenario];
  const detail = document.getElementById('expertise-case');
  detail.innerHTML = `
    <h4>${profile.title} — ${profile.description}</h4>
    <p><strong>Key Strengths:</strong></p>
    <ul>${profile.strengths.map(s => `<li>${s}</li>`).join('')}</ul>
    <p><strong>Limitations:</strong></p>
    <ul>${profile.limitations.map(l => `<li>${l}</li>`).join('')}</ul>
    <p><strong>Approach to "${scenario.label}":</strong></p>
    <p>${profile.approach}</p>
    <p><strong>Relevant expertise for this scenario:</strong> ${scenario.expertise.key}</p>
  `;
}

/* ============================================================
   MODULE C: Patient Values & Preferences
   ============================================================ */
function buildPatientValues() {
  // Persona cards
  const cardContainer = document.getElementById('persona-cards');
  cardContainer.innerHTML = '';

  PATIENT_PERSONAS.forEach(persona => {
    const card = document.createElement('div');
    card.className = `persona-card ${state.activePersona === persona.id ? 'active' : ''}`;
    card.innerHTML = `
      <h4>${persona.name}, ${persona.age}</h4>
      <p class="persona-desc">${persona.description}</p>
    `;
    card.addEventListener('click', () => {
      state.activePersona = persona.id;
      cardContainer.querySelectorAll('.persona-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      applyPersonaToSliders(persona);
      showValuesDetail(persona);
    });
    cardContainer.appendChild(card);
  });

  // Value sliders
  const sliderContainer = document.getElementById('values-sliders');
  sliderContainer.innerHTML = '';

  const dims = [
    { key: 'riskTolerance', label: 'Risk Tolerance', low: 'Risk-averse', high: 'Risk-tolerant' },
    { key: 'healthLiteracy', label: 'Health Literacy', low: 'Low', high: 'High' },
    { key: 'treatmentPreference', label: 'Preference for Medication', low: 'Lifestyle changes', high: 'Medication' },
    { key: 'qualityVsLongevity', label: 'Quality vs Longevity', low: 'Longevity', high: 'Quality of life' }
  ];

  dims.forEach(dim => {
    const group = document.createElement('div');
    group.className = 'value-slider-group';
    group.innerHTML = `
      <label>${dim.label} <span id="persona-${dim.key}-val">50%</span></label>
      <input type="range" id="persona-${dim.key}" min="0" max="100" step="1" value="50" />
      <div class="slider-range-labels"><span>${dim.low}</span><span>${dim.high}</span></div>
    `;
    group.querySelector('input').addEventListener('input', () => {
      const val = group.querySelector('input').value;
      group.querySelector('span[id]').textContent = val + '%';
      updateValuesDetail();
    });
    sliderContainer.appendChild(group);
  });

  // Select first persona
  const first = PATIENT_PERSONAS[0];
  state.activePersona = first.id;
  cardContainer.querySelector('.persona-card').classList.add('active');
  applyPersonaToSliders(first);
  showValuesDetail(first);
}

function applyPersonaToSliders(persona) {
  const dims = ['riskTolerance', 'healthLiteracy', 'treatmentPreference', 'qualityVsLongevity'];
  dims.forEach(dim => {
    const slider = document.getElementById(`persona-${dim}`);
    const valSpan = document.getElementById(`persona-${dim}-val`);
    if (slider && valSpan) {
      slider.value = persona[dim];
      valSpan.textContent = persona[dim] + '%';
    }
  });
}

function showValuesDetail(persona) {
  const scenario = SCENARIOS[state.scenario];
  const detail = document.getElementById('values-detail');
  detail.innerHTML = `
    <h4>${persona.name}'s Profile</h4>
    <p>${persona.description}</p>
    <p><strong>Key Traits:</strong></p>
    <ul>${persona.traits.map(t => `<li>${t}</li>`).join('')}</ul>
    <p><strong>Relevant considerations for "${scenario.label}":</strong></p>
    <p>${scenario.values.considerations}</p>
  `;
}

function updateValuesDetail() {
  const persona = PATIENT_PERSONAS.find(p => p.id === state.activePersona);
  if (persona) showValuesDetail(persona);
}

/* ============================================================
   MODULE D: Decision Simulator
   ============================================================ */
function buildDecisionSimulator() {
  const scenario = SCENARIOS[state.scenario];

  // Config display
  const config = document.getElementById('decision-config');
  config.innerHTML = `
    <div>
      <strong>Scenario:</strong> ${scenario.label}
      <p style="font-size:0.8rem;color:var(--text-muted,#64748b);margin:4px 0 0">${scenario.description}</p>
    </div>
    <div>
      <strong>Evidence Level:</strong> ${scenario.evidence.level}<br/>
      <strong>GRADE:</strong> ${scenario.evidence.grade}
    </div>
  `;

  // Build weight bars
  const vizContainer = document.getElementById('decision-viz');
  vizContainer.innerHTML = '';

  const weights = [
    { label: 'Evidence', value: state.evidenceWeight, color: '#3b82f6' },
    { label: 'Expertise', value: state.expertiseWeight, color: '#22c55e' },
    { label: 'Values', value: state.valuesWeight, color: '#f59e0b' }
  ];

  const total = weights.reduce((s, w) => s + w.value, 0);

  weights.forEach(w => {
    const pct = total > 0 ? Math.round(w.value / total * 100) : 33;
    const bar = document.createElement('div');
    bar.className = 'decision-bar';
    bar.innerHTML = `
      <span class="decision-bar-label">${w.label}</span>
      <div class="decision-bar-track">
        <div class="decision-bar-fill" style="width:${pct}%;background:${w.color};"></div>
      </div>
      <span class="decision-bar-value">${pct}%</span>
    `;
    vizContainer.appendChild(bar);
  });

  // Build integration triangle using D3
  const svgW = 300;
  const svgH = 220;
  const svg = d3.select(vizContainer).append('svg')
    .attr('viewBox', `0 0 ${svgW} ${svgH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('max-width', '300px')
    .style('margin', '16px auto')
    .style('display', 'block');

  // Normalize weights to triangle coordinates
  const normE = state.evidenceWeight / total;
  const normX = state.expertiseWeight / total;
  const normV = state.valuesWeight / total;

  // Triangle vertices
  const triTop = { x: svgW / 2, y: 20 };
  const triLeft = { x: 30, y: svgH - 20 };
  const triRight = { x: svgW - 30, y: svgH - 20 };

  // Draw triangle
  svg.append('polygon')
    .attr('points', `${triTop.x},${triTop.y} ${triLeft.x},${triLeft.y} ${triRight.x},${triRight.y}`)
    .attr('fill', 'none')
    .attr('stroke', '#94a3b8')
    .attr('stroke-width', 1.5);

  // Vertex labels
  svg.append('text').attr('x', triTop.x).attr('y', triTop.y - 6).attr('text-anchor', 'middle').attr('font-size', '11px').attr('font-weight', '600').attr('fill', '#3b82f6').text('Evidence');
  svg.append('text').attr('x', triLeft.x - 4).attr('y', triLeft.y + 14).attr('text-anchor', 'middle').attr('font-size', '11px').attr('font-weight', '600').attr('fill', '#22c55e').text('Expertise');
  svg.append('text').attr('x', triRight.x + 4).attr('y', triRight.y + 14).attr('text-anchor', 'middle').attr('font-size', '11px').attr('font-weight', '600').attr('fill', '#f59e0b').text('Values');

  // Decision point (barycentric coordinates)
  const decX = normE * triTop.x + normX * triLeft.x + normV * triRight.x;
  const decY = normE * triTop.y + normX * triLeft.y + normV * triRight.y;

  svg.append('circle')
    .attr('cx', decX)
    .attr('cy', decY)
    .attr('r', 8)
    .attr('fill', '#dc2626')
    .attr('stroke', '#fff')
    .attr('stroke-width', 2);

  svg.append('text')
    .attr('x', decX)
    .attr('y', decY - 14)
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .attr('font-weight', '700')
    .attr('fill', '#dc2626')
    .text('Decision');

  // Output
  buildDecisionOutput(scenario, weights, total);
}

function buildDecisionOutput(scenario, weights, total) {
  const output = document.getElementById('decision-output');

  // Determine dominant factor
  const sorted = [...weights].sort((a, b) => b.value - a.value);
  const dominant = sorted[0];

  // Compute decision confidence
  const balance = 1 - (Math.max(...weights.map(w => w.value)) - Math.min(...weights.map(w => w.value))) / 100;
  const gradeMultiplier = scenario.evidence.grade === 'High' ? 1.0 : scenario.evidence.grade === 'Moderate' ? 0.75 : 0.5;
  const confidence = Math.round((state.evidenceWeight * gradeMultiplier * 0.5 + state.expertiseWeight * 0.3 + state.valuesWeight * 0.2) * balance);

  // Decision narrative
  let narrative = '';
  if (state.evidenceWeight >= 70 && scenario.evidence.grade === 'High') {
    narrative = `<strong>Evidence-driven decision:</strong> Strong, high-quality evidence supports a clear course of action. ${scenario.recommendation}`;
  } else if (state.valuesWeight > state.evidenceWeight && state.valuesWeight > state.expertiseWeight) {
    narrative = `<strong>Values-centered decision:</strong> Patient preferences are the dominant factor. Clinical equipoise or moderate evidence means patient values should carry significant weight. ${scenario.recommendation}`;
  } else if (state.expertiseWeight > state.evidenceWeight) {
    narrative = `<strong>Expertise-guided decision:</strong> Clinical judgment plays a central role, particularly important when evidence is limited or the patient's situation differs from study populations. ${scenario.recommendation}`;
  } else {
    narrative = `<strong>Balanced integration:</strong> All three EBM components contribute meaningfully. ${scenario.recommendation}`;
  }

  output.innerHTML = `
    <h4>Decision Analysis</h4>
    <p>${narrative}</p>
    <p><strong>Evidence summary:</strong> ${scenario.evidence.summary}</p>
    <p style="font-size:0.8rem;color:var(--text-muted,#64748b);">
      Dominant factor: <strong>${dominant.label}</strong> (${Math.round(dominant.value / total * 100)}%) |
      Decision confidence: <strong>${confidence}%</strong> |
      Evidence grade: <strong>${scenario.evidence.grade}</strong>
    </p>
  `;

  // Update stats
  document.getElementById('stat-confidence').textContent = confidence + '%';
  document.getElementById('stat-dominant').textContent = dominant.label;
  document.getElementById('stat-grade').textContent = scenario.evidence.grade;

  // Recommendation strength
  const recStrength = confidence >= 60 ? 'Strong' : confidence >= 40 ? 'Conditional' : 'Weak';
  document.getElementById('stat-recommendation').textContent = recStrength;
}

/* ============================================================
   EBM PROCESS FLOW
   ============================================================ */
function buildProcessFlow() {
  const container = document.getElementById('process-flow');
  container.innerHTML = '';

  EBM_STEPS.forEach((step, i) => {
    if (i > 0) {
      const arrow = document.createElement('span');
      arrow.className = 'process-arrow';
      arrow.textContent = '\u2192';
      container.appendChild(arrow);
    }

    const el = document.createElement('div');
    el.className = `process-step ${state.activeStep === step.id ? 'active' : ''}`;
    el.innerHTML = `
      <div class="step-number">${i + 1}</div>
      <div class="step-label">${step.label}</div>
    `;
    el.addEventListener('click', () => {
      container.querySelectorAll('.process-step').forEach(s => s.classList.remove('active'));
      el.classList.add('active');
      state.activeStep = step.id;
      showProcessDetail(step);
    });
    container.appendChild(el);
  });

  // Show first step
  showProcessDetail(EBM_STEPS[0]);
  state.activeStep = EBM_STEPS[0].id;
  container.querySelector('.process-step').classList.add('active');
}

function showProcessDetail(step) {
  const detail = document.getElementById('process-detail');
  detail.innerHTML = `
    <h4>Step: ${step.label} — ${step.title}</h4>
    <p>${step.description}</p>
    ${step.details}
  `;
}

/* ============================================================
   CONTROLS
   ============================================================ */
function wireControls() {
  // Scenario selector
  const scenarioSelect = document.getElementById('scenario-select');
  scenarioSelect.addEventListener('change', () => {
    state.scenario = scenarioSelect.value;
    updateStats();
    if (state.activePanel) openPanel(state.activePanel);
  });

  // Weight sliders
  const sliders = [
    { id: 'evidence-slider', valId: 'evidence-val', key: 'evidenceWeight' },
    { id: 'expertise-slider', valId: 'expertise-val', key: 'expertiseWeight' },
    { id: 'values-slider', valId: 'values-val', key: 'valuesWeight' }
  ];

  sliders.forEach(({ id, valId, key }) => {
    const slider = document.getElementById(id);
    const display = document.getElementById(valId);
    slider.addEventListener('input', () => {
      state[key] = parseInt(slider.value, 10);
      display.textContent = slider.value + '%';
      updateVennSizes();
      updateStats();
      if (state.activePanel === 'decision') buildDecisionSimulator();
    });
  });

  // Toggle labels
  document.getElementById('toggle-labels').addEventListener('change', (e) => {
    state.showLabels = e.target.checked;
    d3.selectAll('.sphere-label').style('display', state.showLabels ? null : 'none');
  });

  // Toggle process flow
  document.getElementById('toggle-process').addEventListener('change', (e) => {
    state.showProcess = e.target.checked;
    document.getElementById('process-panel').style.display = state.showProcess ? 'block' : 'none';
  });

  // Simulate button
  document.getElementById('simulate-btn').addEventListener('click', () => {
    openPanel('decision');
  });
}

/* ============================================================
   STATS UPDATE
   ============================================================ */
function updateStats() {
  const scenario = SCENARIOS[state.scenario];
  const weights = [
    { label: 'Evidence', value: state.evidenceWeight },
    { label: 'Expertise', value: state.expertiseWeight },
    { label: 'Values', value: state.valuesWeight }
  ];
  const total = weights.reduce((s, w) => s + w.value, 0);
  const sorted = [...weights].sort((a, b) => b.value - a.value);

  const balance = 1 - (Math.max(...weights.map(w => w.value)) - Math.min(...weights.map(w => w.value))) / 100;
  const gradeMultiplier = scenario.evidence.grade === 'High' ? 1.0 : scenario.evidence.grade === 'Moderate' ? 0.75 : 0.5;
  const confidence = Math.round((state.evidenceWeight * gradeMultiplier * 0.5 + state.expertiseWeight * 0.3 + state.valuesWeight * 0.2) * balance);

  document.getElementById('stat-confidence').textContent = confidence + '%';
  document.getElementById('stat-dominant').textContent = sorted[0].label;
  document.getElementById('stat-grade').textContent = scenario.evidence.grade;

  const recStrength = confidence >= 60 ? 'Strong' : confidence >= 40 ? 'Conditional' : 'Weak';
  document.getElementById('stat-recommendation').textContent = recStrength;
}
