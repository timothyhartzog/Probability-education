<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import ChapterLayout from '$lib/components/ChapterLayout.svelte';
  import { getChapter, getNext, getPrev } from '$lib/data/chapters';

  const ch = getChapter(1, 1)!;
  const next = getNext(ch);
  const prev = getPrev(ch);

  // ── Simulation 1: Coin Flip Frequentist ──────────────────────
  let flipN = 100;
  let flipResults: number[] = [];
  let flipping = false;
  let flipChart: HTMLDivElement;

  async function runFlips() {
    flipping = true;
    flipResults = [];
    const d3 = (window as any).d3;
    const el = flipChart;
    el.innerHTML = '';

    const W = el.offsetWidth, H = 200;
    const margin = { top: 10, right: 20, bottom: 40, left: 50 };
    const iW = W - margin.left - margin.right;
    const iH = H - margin.top - margin.bottom;

    const svg = d3.select(el).append('svg')
      .attr('width', W).attr('height', H);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear().domain([1, flipN]).range([0, iW]);
    const yScale = d3.scaleLinear().domain([0, 1]).range([iH, 0]);

    g.append('g').attr('transform', `translate(0,${iH})`).call(d3.axisBottom(xScale).ticks(5));
    g.append('g').call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format('.2f')));

    // Reference line at 0.5
    g.append('line')
      .attr('x1', 0).attr('x2', iW)
      .attr('y1', yScale(0.5)).attr('y2', yScale(0.5))
      .attr('stroke', 'var(--green)').attr('stroke-dasharray', '4,3')
      .attr('stroke-width', 1.5).attr('opacity', 0.7);
    g.append('text')
      .attr('x', iW - 4).attr('y', yScale(0.5) - 6)
      .attr('text-anchor', 'end').attr('font-size', 11)
      .attr('fill', 'var(--green)').text('P(H) = 0.5');

    const line = d3.line<{i: number, p: number}>()
      .x(d => xScale(d.i)).y(d => yScale(d.p));

    const path = g.append('path')
      .attr('fill', 'none').attr('stroke', 'var(--accent)')
      .attr('stroke-width', 2);

    let heads = 0;
    const data: {i: number, p: number}[] = [];
    const BATCH = Math.max(1, Math.floor(flipN / 60));

    for (let i = 1; i <= flipN; i++) {
      if (Math.random() < 0.5) heads++;
      const p = heads / i;
      data.push({ i, p });
      flipResults = [...flipResults, p];

      if (i % BATCH === 0 || i === flipN) {
        path.attr('d', line(data));
        await new Promise(r => setTimeout(r, 16));
      }
    }
    flipping = false;
  }

  // ── Simulation 2: Kolmogorov Axiom Checker ──────────────────
  type Outcome = { name: string; p: number };
  let outcomes: Outcome[] = [
    { name: 'ω₁', p: 0.25 },
    { name: 'ω₂', p: 0.25 },
    { name: 'ω₃', p: 0.25 },
    { name: 'ω₄', p: 0.25 },
  ];

  $: total = outcomes.reduce((s, o) => s + o.p, 0);
  $: ax1ok = outcomes.every(o => o.p >= 0);
  $: ax2ok = Math.abs(total - 1) < 0.001;
  // For axiom 3: just check finite additivity (for disjoint events A,B: P(A∪B)=P(A)+P(B))
  $: ax3ok = ax1ok; // If non-negative and sums to 1, additivity holds for finite spaces

  function addOutcome() {
    if (outcomes.length >= 6) return;
    const share = 1 / (outcomes.length + 1);
    outcomes = outcomes.map(o => ({ ...o, p: share }));
    outcomes = [...outcomes, { name: `ω${outcomes.length + 1}`, p: share }];
  }
  function removeOutcome(i: number) {
    if (outcomes.length <= 2) return;
    outcomes = outcomes.filter((_, idx) => idx !== i);
  }

  onMount(() => {
    runFlips();
    setTimeout(() => {
      const K = (window as any).katex;
      if (!K) return;
      const r = (id: string, tex: string) => {
        const el = document.getElementById(id);
        if (el) K.render(tex, el, { displayMode: true, throwOnError: false });
      };
      r('eq-ss',  '\\Omega = \\{\\omega_1, \\omega_2, \\ldots, \\omega_n\\}, \\quad A \\subseteq \\Omega');
      r('eq-ax1', '\\textbf{Axiom 1:}\\quad P(A) \\geq 0 \\text{ for all events } A');
      r('eq-ax2', '\\textbf{Axiom 2:}\\quad P(\\Omega) = 1');
      r('eq-ax3', '\\textbf{Axiom 3:}\\quad A \\cap B = \\emptyset \\Rightarrow P(A \\cup B) = P(A) + P(B)');
      r('eq-add', 'P(A \\cup B) = P(A) + P(B) - P(A \\cap B)');
    }, 300);
  });
</script>

<svelte:head>
  <title>Chapter 1: What Is Probability? | Probability Education</title>
</svelte:head>

<ChapterLayout {ch} nextCh={next} prevCh={prev}>

<!-- ── Section 1.1 ──────────────────────────────────────────── -->
<section>
  <h2>1.1 The Nature of Uncertainty</h2>
  <p>
    Before we can calculate anything, we need to answer a deceptively simple question:
    <em>what is probability?</em> The word appears everywhere — weather forecasts give a
    "70% chance of rain," doctors quote survival rates, and casinos build entire businesses
    on it. But what does it actually mean to say an event has probability 0.7?
  </p>
  <p>
    Three great traditions have shaped the answer. The <strong>classical</strong> view,
    rooted in gambling and games of chance, defines probability by counting equally likely
    outcomes. The <strong>frequentist</strong> view says probability is the long-run relative
    frequency of an event over many identical trials. The <strong>Bayesian (subjective)</strong>
    view treats probability as a rational agent's degree of belief, updated via Bayes' theorem.
    All three coexist in modern probability, which is built on a single rigorous foundation —
    Kolmogorov's axioms.
  </p>
</section>

<!-- ── Section 1.2 ──────────────────────────────────────────── -->
<section>
  <h2>1.2 Sample Spaces and Events</h2>
  <p>
    Every probability problem starts with an <strong>experiment</strong> — a process with
    uncertain outcomes. The <strong>sample space</strong> Ω is the set of all possible
    outcomes. An <strong>event</strong> is any subset A ⊆ Ω.
  </p>
  <div class="math-block">
    <span id="eq-ss"></span>
  </div>
  <p>
    For a fair six-sided die: Ω = {"{"}1, 2, 3, 4, 5, 6{"}"}. The event "even number" is
    A = {"{"}2, 4, 6{"}"} ⊆ Ω. Events combine via set operations:
    union (A ∪ B), intersection (A ∩ B), and complement (Aᶜ = Ω \ A).
  </p>
</section>

<!-- ── Section 1.3 ──────────────────────────────────────────── -->
<section>
  <h2>1.3 Kolmogorov's Three Axioms</h2>
  <p>
    In 1933, Andrei Kolmogorov gave probability theory its rigorous foundation.
    A <strong>probability measure</strong> P on Ω is any function from events to [0, ∞)
    satisfying exactly three axioms:
  </p>
  <div class="math-block">
    <span id="eq-ax1"></span>
  </div>
  <div class="math-block">
    <span id="eq-ax2"></span>
  </div>
  <div class="math-block">
    <span id="eq-ax3"></span>
  </div>
  <p>
    Everything else in probability — P(Aᶜ) = 1 − P(A), P(A ∪ B) = P(A) + P(B) − P(A ∩ B),
    monotonicity — follows from these three axioms alone.
  </p>

  <!-- Axiom Checker Simulation -->
  <div class="sim-container">
    <div class="sim-header">
      <span class="sim-dot"></span>
      Kolmogorov Axiom Checker — Propose a Probability Function
    </div>
    <div class="axiom-checker">
      <div class="outcome-table">
        <div class="ot-head">
          <span>Outcome</span><span>P(ω)</span><span></span>
        </div>
        {#each outcomes as o, i}
          <div class="ot-row">
            <span class="ot-name">{o.name}</span>
            <input type="number" min="0" max="1" step="0.05"
                   bind:value={o.p} class="ot-input" />
            <button class="ot-del" on:click={() => removeOutcome(i)} disabled={outcomes.length <= 2}>✕</button>
          </div>
        {/each}
        <div class="ot-row total" class:ok={ax2ok} class:bad={!ax2ok}>
          <span>Total</span>
          <span class="total-val">{total.toFixed(3)}</span>
          <span></span>
        </div>
        <button class="add-outcome-btn" on:click={addOutcome} disabled={outcomes.length >= 6}>
          + Add outcome
        </button>
      </div>

      <div class="axiom-status">
        <div class="axiom-row" class:ok={ax1ok} class:bad={!ax1ok}>
          <span class="ax-icon">{ax1ok ? '✓' : '✗'}</span>
          <div>
            <strong>Axiom 1 — Non-negativity:</strong>
            P(A) ≥ 0 for all A
            <div class="ax-detail">{ax1ok ? 'All probabilities are ≥ 0' : 'Some probability is negative!'}</div>
          </div>
        </div>
        <div class="axiom-row" class:ok={ax2ok} class:bad={!ax2ok}>
          <span class="ax-icon">{ax2ok ? '✓' : '✗'}</span>
          <div>
            <strong>Axiom 2 — Normalization:</strong>
            P(Ω) = 1
            <div class="ax-detail">Current total: {total.toFixed(4)} {ax2ok ? '✓' : '≠ 1'}</div>
          </div>
        </div>
        <div class="axiom-row" class:ok={ax3ok} class:bad={!ax3ok}>
          <span class="ax-icon">{ax3ok ? '✓' : '✗'}</span>
          <div>
            <strong>Axiom 3 — Countable Additivity:</strong>
            P(A ∪ B) = P(A) + P(B) for disjoint A, B
            <div class="ax-detail">{ax3ok ? 'Follows from Axioms 1 & 2 for finite Ω' : 'Violated'}</div>
          </div>
        </div>
        {#if ax1ok && ax2ok && ax3ok}
          <div class="valid-banner">✓ Valid probability measure!</div>
        {:else}
          <div class="invalid-banner">Adjust probabilities to satisfy all three axioms</div>
        {/if}
      </div>
    </div>
  </div>
</section>

<!-- ── Section 1.4 ──────────────────────────────────────────── -->
<section>
  <h2>1.4 Frequentist Probability — The Long Run</h2>
  <p>
    The frequentist interpretation says: P(A) is the limit of the relative frequency of A
    over infinitely many independent trials. For a fair coin, P(Heads) = 0.5 because in
    the long run, exactly half the flips will be heads. But in the <em>short</em> run,
    anything can happen — and that tension is exactly what the Law of Large Numbers
    (Chapter 10) will make precise.
  </p>

  <!-- Coin Flip Simulation -->
  <div class="sim-container">
    <div class="sim-header">
      <span class="sim-dot"></span>
      Running Proportion of Heads — Frequentist Convergence
    </div>
    <div class="flip-controls">
      <label>
        Number of flips:
        <input type="range" min="50" max="5000" step="50" bind:value={flipN} disabled={flipping} />
        <span class="param-val">{flipN}</span>
      </label>
      <button class="run-btn" on:click={runFlips} disabled={flipping}>
        {flipping ? 'Running…' : '▶ Run Simulation'}
      </button>
    </div>
    <div class="flip-chart-wrap" bind:this={flipChart}></div>
    {#if flipResults.length > 0}
      <div class="flip-stats">
        Final proportion: <strong>{flipResults[flipResults.length-1]?.toFixed(4)}</strong>
        · Deviation from 0.5: <strong>{Math.abs((flipResults[flipResults.length-1] ?? 0.5) - 0.5).toFixed(4)}</strong>
      </div>
    {/if}
  </div>
</section>

<!-- ── Section 1.5 ──────────────────────────────────────────── -->
<section>
  <h2>1.5 Derived Results from the Axioms</h2>
  <p>From just the three axioms, we can prove everything we'll ever need:</p>
  <ul class="result-list">
    <li><strong>Complement rule:</strong> P(Aᶜ) = 1 − P(A)</li>
    <li><strong>Impossible event:</strong> P(∅) = 0</li>
    <li><strong>Monotonicity:</strong> A ⊆ B ⟹ P(A) ≤ P(B)</li>
    <li><strong>Subadditivity:</strong> P(A ∪ B) ≤ P(A) + P(B)</li>
    <li><strong>Addition rule:</strong> P(A ∪ B) = P(A) + P(B) − P(A ∩ B)</li>
  </ul>
  <div class="math-block">
    <span id="eq-add"></span>
  </div>
</section>

</ChapterLayout>

<style>
  section { margin-bottom: 2.5rem; }
  section h2 { margin-top: 0.5rem; }

  /* Axiom checker */
  .axiom-checker {
    padding: 1.25rem;
    display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;
  }
  .ot-head, .ot-row {
    display: grid; grid-template-columns: 2fr 2fr 1fr;
    align-items: center; gap: 0.5rem;
    padding: 0.3rem 0;
  }
  .ot-head { font-weight: 600; font-size: 0.8rem; color: var(--text3); border-bottom: 1px solid var(--border); }
  .ot-name { font-family: var(--font-mono); font-size: 0.9rem; }
  .ot-input {
    width: 100%; padding: 0.3rem 0.5rem;
    border: 1px solid var(--border); border-radius: 6px;
    background: var(--bg); color: var(--text);
    font-family: var(--font-mono); font-size: 0.9rem;
  }
  .ot-del {
    background: none; border: 1px solid var(--border);
    border-radius: 4px; cursor: pointer;
    color: var(--red); font-size: 0.75rem; padding: 0.2rem 0.4rem;
  }
  .ot-del:disabled { opacity: 0.3; cursor: not-allowed; }
  .ot-row.total { border-top: 1px solid var(--border); font-weight: 600; }
  .ot-row.ok .total-val { color: var(--green); }
  .ot-row.bad .total-val { color: var(--red); }
  .add-outcome-btn {
    margin-top: 0.5rem; width: 100%;
    background: var(--bbg); border: 1px dashed var(--border);
    border-radius: 6px; padding: 0.4rem; cursor: pointer;
    color: var(--blue); font-size: 0.8rem;
  }
  .add-outcome-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .axiom-status { display: flex; flex-direction: column; gap: 0.75rem; }
  .axiom-row {
    display: flex; align-items: flex-start; gap: 0.75rem;
    padding: 0.75rem; border-radius: 8px;
    border: 1px solid var(--border); background: var(--bg);
    font-size: 0.875rem;
  }
  .axiom-row.ok { border-color: var(--green); background: var(--gbg); }
  .axiom-row.bad { border-color: var(--red); background: var(--rbg); }
  .ax-icon { font-size: 1.1rem; font-weight: 700; line-height: 1.4; }
  .axiom-row.ok .ax-icon { color: var(--green); }
  .axiom-row.bad .ax-icon { color: var(--red); }
  .ax-detail { font-size: 0.8rem; color: var(--text3); margin-top: 0.2rem; }

  .valid-banner {
    background: var(--gbg); color: var(--green);
    border: 1px solid var(--green); border-radius: 8px;
    padding: 0.65rem 1rem; font-weight: 600; font-size: 0.9rem;
    text-align: center;
  }
  .invalid-banner {
    background: var(--obg); color: var(--orange);
    border: 1px solid var(--orange); border-radius: 8px;
    padding: 0.65rem 1rem; font-size: 0.85rem;
    text-align: center;
  }

  /* Coin flip */
  .flip-controls {
    display: flex; align-items: center; gap: 1rem;
    padding: 0.75rem 1.25rem; flex-wrap: wrap;
    border-bottom: 1px solid var(--border);
  }
  .flip-controls label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
  .flip-controls input[type=range] { width: 160px; }
  .param-val { font-family: var(--font-mono); font-size: 0.875rem; min-width: 3rem; }
  .run-btn {
    background: var(--accent); color: #fff;
    border: none; border-radius: 6px;
    padding: 0.4rem 1rem; cursor: pointer;
    font-size: 0.875rem; font-weight: 600;
  }
  .run-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .flip-chart-wrap { padding: 0.75rem 1rem; min-height: 210px; }
  .flip-stats {
    padding: 0.5rem 1.25rem; border-top: 1px solid var(--border);
    font-size: 0.825rem; color: var(--text3);
    font-family: var(--font-mono);
  }

  /* Results list */
  .result-list { padding-left: 1.25rem; }
  .result-list li { margin-bottom: 0.4rem; font-size: 0.95rem; }

  @media (max-width: 640px) {
    .axiom-checker { grid-template-columns: 1fr; }
  }
</style>
