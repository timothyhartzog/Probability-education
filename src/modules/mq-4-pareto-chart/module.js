// Pareto Chart — Hospital Quality Root Cause Analysis
import * as d3 from "d3";
import '../../lib/copy-code.js';

// ---------------------------------------------------------------------------
// Seedable PRNG — xoshiro128** with splitmix32 seeding
// ---------------------------------------------------------------------------
function splitmix32(a) {
  return function () {
    a |= 0;
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    t = t ^ (t >>> 15);
    return t >>> 0;
  };
}

function xoshiro128ss(a, b, c, d) {
  return function () {
    const t = (b * 5) | 0;
    let result = (((t << 7) | (t >>> 25)) * 9) | 0;
    const u = (b << 9) | 0;
    c = c ^ a;
    d = d ^ b;
    b = b ^ c;
    a = a ^ d;
    c = c ^ u;
    d = ((d << 11) | (d >>> 21)) | 0;
    return (result >>> 0) / 4294967296;
  };
}

function makeRng(seed) {
  const sm = splitmix32(seed);
  return xoshiro128ss(sm(), sm(), sm(), sm());
}

// ---------------------------------------------------------------------------
// Dataset definitions
// ---------------------------------------------------------------------------
const DATASETS = {
  "adverse-events": {
    label: "Adverse Events",
    categories: [
      { name: "Falls", pct: 28 },
      { name: "Medication Errors", pct: 22 },
      { name: "Pressure Injuries", pct: 14 },
      { name: "Hospital-Acquired Infections", pct: 12 },
      { name: "Wrong-Site Surgery", pct: 6 },
      { name: "Blood Transfusion Reactions", pct: 5 },
      { name: "Patient Elopement", pct: 4 },
      { name: "Equipment Failure", pct: 3 },
      { name: "Anesthesia Complications", pct: 3 },
      { name: "Other", pct: 3 },
    ],
  },
  "patient-complaints": {
    label: "Patient Complaints",
    categories: [
      { name: "Wait Times", pct: 25 },
      { name: "Communication", pct: 20 },
      { name: "Staff Attitude", pct: 15 },
      { name: "Pain Management", pct: 12 },
      { name: "Billing Issues", pct: 8 },
      { name: "Food Quality", pct: 6 },
      { name: "Noise Level", pct: 5 },
      { name: "Discharge Planning", pct: 4 },
      { name: "Parking", pct: 3 },
      { name: "Other", pct: 2 },
    ],
  },
  "medication-errors": {
    label: "Medication Errors",
    categories: [
      { name: "Wrong Dose", pct: 30 },
      { name: "Omission", pct: 20 },
      { name: "Wrong Time", pct: 15 },
      { name: "Wrong Drug", pct: 12 },
      { name: "Wrong Patient", pct: 8 },
      { name: "Wrong Route", pct: 6 },
      { name: "Duplicate Therapy", pct: 4 },
      { name: "Drug Interaction", pct: 3 },
      { name: "Expired Medication", pct: 1 },
      { name: "Other", pct: 1 },
    ],
  },
  "near-misses": {
    label: "Near-Miss Reports",
    categories: [
      { name: "Medication Near-Miss", pct: 26 },
      { name: "Fall Risk", pct: 18 },
      { name: "ID Verification", pct: 14 },
      { name: "Allergy Alert", pct: 12 },
      { name: "Lab Mislabel", pct: 10 },
      { name: "Wrong-Site Mark", pct: 7 },
      { name: "Equipment Check", pct: 5 },
      { name: "Blood Type Verify", pct: 4 },
      { name: "Consent Missing", pct: 2 },
      { name: "Other", pct: 2 },
    ],
  },
  "readmission-causes": {
    label: "Readmission Root Causes",
    categories: [
      { name: "Inadequate Discharge Plan", pct: 24 },
      { name: "Medication Non-Compliance", pct: 20 },
      { name: "Infection", pct: 16 },
      { name: "Premature Discharge", pct: 12 },
      { name: "Social Determinants", pct: 10 },
      { name: "Follow-Up Missed", pct: 8 },
      { name: "Comorbidity Exacerbation", pct: 5 },
      { name: "Caregiver Gap", pct: 3 },
      { name: "Other", pct: 2 },
    ],
  },
  "surgical-complications": {
    label: "Surgical Complications",
    categories: [
      { name: "Surgical Site Infection", pct: 22 },
      { name: "Hemorrhage", pct: 18 },
      { name: "DVT/PE", pct: 14 },
      { name: "Anastomotic Leak", pct: 10 },
      { name: "Wound Dehiscence", pct: 9 },
      { name: "Organ Injury", pct: 8 },
      { name: "Nerve Damage", pct: 7 },
      { name: "Respiratory Failure", pct: 6 },
      { name: "Cardiac Event", pct: 4 },
      { name: "Other", pct: 2 },
    ],
  },
};

const TIME_PERIODS = {
  "q4-2025": { label: "Q4 2025", seedOffset: 0, totalMul: 1.0 },
  "q3-2025": { label: "Q3 2025", seedOffset: 100, totalMul: 0.9 },
  "year-2025": { label: "Full Year 2025", seedOffset: 200, totalMul: 3.5 },
  "rolling-12": { label: "Rolling 12 Months", seedOffset: 300, totalMul: 3.8 },
};

const DEPARTMENTS = ["Emergency", "Surgery", "Medicine", "ICU"];
const QUARTERS = ["Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025"];

const CATEGORY_COLORS = d3.schemeTableau10;

// ---------------------------------------------------------------------------
// Data generation
// ---------------------------------------------------------------------------
let currentSeed = 42;

function generateData(datasetKey, periodKey, seed) {
  const ds = DATASETS[datasetKey];
  const tp = TIME_PERIODS[periodKey];
  const rng = makeRng(seed + tp.seedOffset + hashStr(datasetKey));

  const baseTotal = Math.round((800 + rng() * 1200) * tp.totalMul);

  // Generate counts with variation
  const rawCounts = ds.categories.map((c) => {
    const expected = (c.pct / 100) * baseTotal;
    const noise = (rng() - 0.5) * expected * 0.3;
    return Math.max(1, Math.round(expected + noise));
  });

  // Sort descending
  const indexed = ds.categories.map((c, i) => ({
    name: c.name,
    count: rawCounts[i],
  }));
  indexed.sort((a, b) => b.count - a.count);

  const total = d3.sum(indexed, (d) => d.count);
  let cumSum = 0;
  indexed.forEach((d) => {
    cumSum += d.count;
    d.pct = (d.count / total) * 100;
    d.cumPct = (cumSum / total) * 100;
  });

  return { categories: indexed, total };
}

function generateTrendData(datasetKey, seed) {
  const ds = DATASETS[datasetKey];
  const topCats = ds.categories.slice(0, 5);

  return QUARTERS.map((q, qi) => {
    const rng = makeRng(seed + qi * 73 + hashStr(datasetKey));
    const baseTotal = 300 + Math.round(rng() * 400);
    const row = { quarter: q };
    topCats.forEach((c) => {
      const expected = (c.pct / 100) * baseTotal;
      const noise = (rng() - 0.5) * expected * 0.4;
      row[c.name] = Math.max(1, Math.round(expected + noise));
    });
    return row;
  });
}

function generateDeptData(datasetKey, seed) {
  const ds = DATASETS[datasetKey];
  const topCats = ds.categories.slice(0, 5);
  const deptWeights = [
    [0.35, 0.25, 0.25, 0.15],
    [0.2, 0.35, 0.3, 0.15],
    [0.25, 0.2, 0.35, 0.2],
    [0.15, 0.3, 0.2, 0.35],
    [0.3, 0.2, 0.3, 0.2],
  ];

  return DEPARTMENTS.map((dept, di) => {
    const rng = makeRng(seed + di * 37 + hashStr(datasetKey));
    const row = { department: dept };
    topCats.forEach((c, ci) => {
      const w = deptWeights[ci][di];
      const base = Math.round((c.pct / 100) * 200 * w);
      const noise = (rng() - 0.5) * base * 0.3;
      row[c.name] = Math.max(0, Math.round(base + noise));
    });
    return row;
  });
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ---------------------------------------------------------------------------
// Tooltip helper
// ---------------------------------------------------------------------------
function createTooltip() {
  let tip = d3.select(".pareto-tooltip");
  if (tip.empty()) {
    tip = d3
      .select("body")
      .append("div")
      .attr("class", "pareto-tooltip");
  }
  return tip;
}

function showTooltip(tip, html, event) {
  tip.html(html).classed("visible", true);
  const x = event.pageX + 12;
  const y = event.pageY - 28;
  tip.style("left", x + "px").style("top", y + "px");
}

function hideTooltip(tip) {
  tip.classed("visible", false);
}

// ---------------------------------------------------------------------------
// Main Pareto chart
// ---------------------------------------------------------------------------
function drawParetoChart(data, { threshold, maxCats, show80Line, highlightVital }) {
  const container = d3.select("#pareto-chart");
  container.selectAll("*").remove();

  const cats = data.categories.slice(0, maxCats);
  const total = data.total;

  // Recompute cumulative for sliced data
  let cumSum = 0;
  cats.forEach((d) => {
    cumSum += d.count;
    d.cumPct = (cumSum / total) * 100;
  });

  const margin = { top: 20, right: 60, bottom: 100, left: 55 };
  const width = 960;
  const height = 450;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // Scales
  const x = d3
    .scaleBand()
    .domain(cats.map((d) => d.name))
    .range([0, innerW])
    .padding(0.2);

  const yMax = d3.max(cats, (d) => d.count) * 1.1;
  const yLeft = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);
  const yRight = d3.scaleLinear().domain([0, 100]).range([innerH, 0]);

  // Axes
  g.append("g")
    .attr("class", "axis x-axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickSizeOuter(0));

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(yLeft).ticks(6));

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(${innerW},0)`)
    .call(
      d3
        .axisRight(yRight)
        .ticks(5)
        .tickFormat((d) => d + "%")
    );

  // Axis labels
  g.append("text")
    .attr("class", "axis-label")
    .attr("x", -innerH / 2)
    .attr("y", -42)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .text("Count");

  g.append("text")
    .attr("class", "axis-label")
    .attr("x", innerW + 45)
    .attr("y", innerH / 2)
    .attr("transform", `rotate(90, ${innerW + 45}, ${innerH / 2})`)
    .attr("text-anchor", "middle")
    .text("Cumulative %");

  // Threshold line
  if (show80Line) {
    g.append("line")
      .attr("class", "threshold-80")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", yRight(threshold))
      .attr("y2", yRight(threshold));

    g.append("text")
      .attr("class", "threshold-label")
      .attr("x", innerW - 4)
      .attr("y", yRight(threshold) - 5)
      .attr("text-anchor", "end")
      .text(`${threshold}%`);
  }

  const tip = createTooltip();

  // Bars
  const bars = g
    .selectAll(".pareto-bar")
    .data(cats)
    .enter()
    .append("rect")
    .attr("class", (d) => {
      if (!highlightVital) return "pareto-bar";
      return d.cumPct <= threshold ? "pareto-bar vital" : "pareto-bar trivial";
    })
    .attr("x", (d) => x(d.name))
    .attr("width", x.bandwidth())
    .attr("y", innerH)
    .attr("height", 0)
    .on("mouseover", (event, d) => {
      showTooltip(
        tip,
        `<strong>${d.name}</strong><br/>
         Count: ${d.count}<br/>
         Percentage: ${d.pct.toFixed(1)}%<br/>
         Cumulative: ${d.cumPct.toFixed(1)}%`,
        event
      );
    })
    .on("mousemove", (event) => {
      tip.style("left", event.pageX + 12 + "px").style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", () => hideTooltip(tip));

  // If not using vital/trivial highlight, apply a default fill
  if (!highlightVital) {
    bars.style("fill", "var(--color-primary)").style("opacity", 0.85);
  }

  // Animate bars
  bars
    .transition()
    .duration(600)
    .delay((_, i) => i * 40)
    .attr("y", (d) => yLeft(d.count))
    .attr("height", (d) => innerH - yLeft(d.count));

  // Count labels on bars
  g.selectAll(".bar-count-label")
    .data(cats)
    .enter()
    .append("text")
    .attr("class", "bar-count-label")
    .attr("x", (d) => x(d.name) + x.bandwidth() / 2)
    .attr("y", (d) => yLeft(d.count) - 4)
    .attr("opacity", 0)
    .text((d) => d.count)
    .transition()
    .duration(600)
    .delay((_, i) => i * 40)
    .attr("opacity", 1);

  // Cumulative line
  const lineGen = d3
    .line()
    .x((d) => x(d.name) + x.bandwidth() / 2)
    .y((d) => yRight(d.cumPct));

  const path = g
    .append("path")
    .datum(cats)
    .attr("class", "cumulative-line")
    .attr("d", lineGen);

  // Animate line
  const pathLen = path.node().getTotalLength();
  path
    .attr("stroke-dasharray", pathLen)
    .attr("stroke-dashoffset", pathLen)
    .transition()
    .duration(800)
    .delay(200)
    .attr("stroke-dashoffset", 0);

  // Dots on cumulative line
  g.selectAll(".cumulative-dot")
    .data(cats)
    .enter()
    .append("circle")
    .attr("class", "cumulative-dot")
    .attr("cx", (d) => x(d.name) + x.bandwidth() / 2)
    .attr("cy", (d) => yRight(d.cumPct))
    .attr("opacity", 0)
    .on("mouseover", (event, d) => {
      showTooltip(
        tip,
        `<strong>${d.name}</strong><br/>Cumulative: ${d.cumPct.toFixed(1)}%`,
        event
      );
    })
    .on("mousemove", (event) => {
      tip.style("left", event.pageX + 12 + "px").style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", () => hideTooltip(tip))
    .transition()
    .duration(400)
    .delay(800)
    .attr("opacity", 1);

  // Legend
  const legend = d3.select("#pareto-legend");
  legend.selectAll("*").remove();
  legend.html(
    `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:16px;">
       <span style="width:12px;height:12px;background:var(--color-error);border-radius:2px;display:inline-block;"></span>
       Vital Few
     </span>
     <span style="display:inline-flex;align-items:center;gap:4px;margin-right:16px;">
       <span style="width:12px;height:12px;background:var(--color-primary);opacity:0.5;border-radius:2px;display:inline-block;"></span>
       Trivial Many
     </span>
     <span style="display:inline-flex;align-items:center;gap:4px;">
       <span style="width:20px;height:2px;background:var(--color-secondary);display:inline-block;"></span>
       Cumulative %
     </span>`
  );
}

// ---------------------------------------------------------------------------
// Trend chart
// ---------------------------------------------------------------------------
function drawTrendChart(trendData, datasetKey) {
  const container = d3.select("#trend-chart");
  container.selectAll("*").remove();

  const ds = DATASETS[datasetKey];
  const catNames = ds.categories.slice(0, 5).map((c) => c.name);

  const margin = { top: 15, right: 120, bottom: 35, left: 45 };
  const width = 480;
  const height = 260;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scalePoint()
    .domain(QUARTERS)
    .range([0, innerW])
    .padding(0.3);

  const allVals = trendData.flatMap((row) => catNames.map((c) => row[c]));
  const yMax = d3.max(allVals) * 1.1;
  const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickSizeOuter(0));

  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5));

  const tip = createTooltip();

  catNames.forEach((cat, ci) => {
    const color = CATEGORY_COLORS[ci];
    const lineData = trendData.map((row) => ({ quarter: row.quarter, value: row[cat] }));

    const lineGen = d3
      .line()
      .x((d) => x(d.quarter))
      .y((d) => y(d.value));

    g.append("path")
      .datum(lineData)
      .attr("class", "trend-line")
      .attr("d", lineGen)
      .attr("stroke", color);

    g.selectAll(`.trend-dot-${ci}`)
      .data(lineData)
      .enter()
      .append("circle")
      .attr("class", "trend-dot")
      .attr("cx", (d) => x(d.quarter))
      .attr("cy", (d) => y(d.value))
      .attr("fill", color)
      .on("mouseover", (event, d) => {
        showTooltip(tip, `<strong>${cat}</strong><br/>${d.quarter}: ${d.value}`, event);
      })
      .on("mousemove", (event) => {
        tip.style("left", event.pageX + 12 + "px").style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", () => hideTooltip(tip));

    // Legend entry
    const ly = ci * 18;
    g.append("line")
      .attr("x1", innerW + 10)
      .attr("x2", innerW + 28)
      .attr("y1", ly + 8)
      .attr("y2", ly + 8)
      .attr("stroke", color)
      .attr("stroke-width", 2);

    g.append("text")
      .attr("x", innerW + 32)
      .attr("y", ly + 12)
      .attr("font-size", "9px")
      .attr("fill", "var(--color-text-secondary)")
      .text(cat.length > 16 ? cat.slice(0, 15) + "\u2026" : cat);
  });
}

// ---------------------------------------------------------------------------
// Department comparison (stacked bar chart)
// ---------------------------------------------------------------------------
function drawComparisonChart(deptData, datasetKey) {
  const container = d3.select("#comparison-chart");
  container.selectAll("*").remove();

  const ds = DATASETS[datasetKey];
  const catNames = ds.categories.slice(0, 5).map((c) => c.name);

  const margin = { top: 15, right: 120, bottom: 35, left: 45 };
  const width = 480;
  const height = 260;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const stack = d3.stack().keys(catNames);
  const series = stack(deptData);

  const x = d3
    .scaleBand()
    .domain(DEPARTMENTS)
    .range([0, innerW])
    .padding(0.25);

  const yMax = d3.max(deptData, (row) => d3.sum(catNames, (c) => row[c])) * 1.1;
  const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickSizeOuter(0));

  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5));

  const tip = createTooltip();

  series.forEach((s, si) => {
    const color = CATEGORY_COLORS[si];
    g.selectAll(`.dept-bar-${si}`)
      .data(s)
      .enter()
      .append("rect")
      .attr("class", "dept-bar")
      .attr("x", (d) => x(d.data.department))
      .attr("width", x.bandwidth())
      .attr("y", (d) => y(d[1]))
      .attr("height", (d) => y(d[0]) - y(d[1]))
      .attr("fill", color)
      .on("mouseover", (event, d) => {
        const val = d[1] - d[0];
        showTooltip(
          tip,
          `<strong>${d.data.department}</strong><br/>${s.key}: ${val}`,
          event
        );
      })
      .on("mousemove", (event) => {
        tip.style("left", event.pageX + 12 + "px").style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", () => hideTooltip(tip));

    // Legend
    const ly = si * 18;
    g.append("rect")
      .attr("x", innerW + 10)
      .attr("y", ly + 2)
      .attr("width", 12)
      .attr("height", 12)
      .attr("rx", 2)
      .attr("fill", color);

    g.append("text")
      .attr("x", innerW + 26)
      .attr("y", ly + 12)
      .attr("font-size", "9px")
      .attr("fill", "var(--color-text-secondary)")
      .text(s.key.length > 16 ? s.key.slice(0, 15) + "\u2026" : s.key);
  });
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
function updateStats(data, threshold) {
  const vitalFew = data.categories.filter((d) => d.cumPct <= threshold).length;
  const topPct = data.categories[0] ? data.categories[0].pct : 0;

  d3.select("#stat-total").text(data.total.toLocaleString());
  d3.select("#stat-vital-few").text(vitalFew);
  d3.select("#stat-top-pct").text(topPct.toFixed(1) + "%");
  d3.select("#stat-categories").text(data.categories.length);
}

// ---------------------------------------------------------------------------
// Main controller
// ---------------------------------------------------------------------------
function getSettings() {
  return {
    dataset: d3.select("#dataset-select").property("value"),
    period: d3.select("#time-period").property("value"),
    threshold: +d3.select("#threshold-pct").property("value"),
    maxCats: +d3.select("#top-n").property("value"),
    show80Line: d3.select("#toggle-80-line").property("checked"),
    highlightVital: d3.select("#toggle-highlight").property("checked"),
  };
}

function updateAll() {
  const s = getSettings();

  // Update display labels
  d3.select("#threshold-pct-val").text(s.threshold + "%");
  d3.select("#top-n-val").text(s.maxCats);

  // Generate data
  const data = generateData(s.dataset, s.period, currentSeed);
  const trendData = generateTrendData(s.dataset, currentSeed);
  const deptData = generateDeptData(s.dataset, currentSeed);

  // Update subtitle
  const dsLabel = DATASETS[s.dataset].label;
  const tpLabel = TIME_PERIODS[s.period].label;
  d3.select("#pareto-subtitle").text(`${dsLabel} — ${tpLabel}`);
  d3.select("#trend-subtitle").text(`Top categories for ${dsLabel} across quarters`);
  d3.select("#comparison-subtitle").text(`${dsLabel} distribution across departments`);

  // Draw charts
  drawParetoChart(data, {
    threshold: s.threshold,
    maxCats: s.maxCats,
    show80Line: s.show80Line,
    highlightVital: s.highlightVital,
  });

  drawTrendChart(trendData, s.dataset);
  drawComparisonChart(deptData, s.dataset);
  updateStats(data, s.threshold);
}

// ---------------------------------------------------------------------------
// Wire controls
// ---------------------------------------------------------------------------
function init() {
  d3.select("#dataset-select").on("change", updateAll);
  d3.select("#time-period").on("change", updateAll);
  d3.select("#threshold-pct").on("input", updateAll);
  d3.select("#top-n").on("input", updateAll);
  d3.select("#toggle-80-line").on("change", updateAll);
  d3.select("#toggle-highlight").on("change", updateAll);

  d3.select("#regenerate-btn").on("click", () => {
    currentSeed = Date.now() % 100000;
    updateAll();
  });

  updateAll();
}

init();
