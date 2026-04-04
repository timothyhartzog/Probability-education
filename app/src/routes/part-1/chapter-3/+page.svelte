<script lang="ts">
  import { onMount } from 'svelte';
  import ChapterLayout from '$lib/components/ChapterLayout.svelte';
  import { getChapter, getNext, getPrev } from '$lib/data/chapters';

  const ch = getChapter(1, 3)!;

  // ── Bayes Natural Frequency Square ───────────────────────────
  let prevalence = 1;    // %
  let sensitivity = 95;  // %
  let specificity = 90;  // %

  $: prev = prevalence / 100;
  $: sens = sensitivity / 100;
  $: spec = specificity / 100;
  $: tp = prev * sens;
  $: fp = (1 - prev) * (1 - spec);
  $: fn = prev * (1 - sens);
  $: tn = (1 - prev) * spec;
  $: ppv = tp / (tp + fp);
  $: npv = tn / (tn + fn);

  // ── Monty Hall Simulator ───────────────────────────────────────
  let mhN = 1000;
  let mhRunning = false;
  let mhStayWins = 0, mhSwitchWins = 0, mhRuns = 0;

  async function runMontyHall() {
    mhRunning = true;
    mhStayWins = 0; mhSwitchWins = 0; mhRuns = 0;
    const BATCH = 50;
    for (let i = 0; i < mhN; i++) {
      const car = Math.floor(Math.random() * 3);
      const pick = Math.floor(Math.random() * 3);
      // Host opens a goat door ≠ pick and ≠ car
      let host: number;
      do { host = Math.floor(Math.random() * 3); } while (host === pick || host === car);
      const switched = [0, 1, 2].find(d => d !== pick && d !== host)!;
      if (pick === car) mhStayWins++;
      if (switched === car) mhSwitchWins++;
      mhRuns++;
      if (i % BATCH === 0) await new Promise(r => setTimeout(r, 0));
    }
    mhRunning = false;
  }

  // ── Birthday Paradox ──────────────────────────────────────────
  let bGroup = 23;
  function birthdayProb(n: number): number {
    let p = 1;
    for (let i = 0; i < n; i++) p *= (365 - i) / 365;
    return 1 - p;
  }
  $: bProb = birthdayProb(bGroup);

  onMount(() => {
    const K = (window as any).katex;
    if (!K) return;
    setTimeout(() => {
      const r = (id: string, tex: string) => {
        const el = document.getElementById(id); if (!el) return;
        K.render(tex, el, { displayMode: true, throwOnError: false });
      };
      r('eq-cond', 'P(A \\mid B) = \\frac{P(A \\cap B)}{P(B)}, \\quad P(B) > 0');
      r('eq-bayes', 'P(A \\mid B) = \\frac{P(B \\mid A)\\, P(A)}{P(B)} = \\frac{P(B \\mid A)\\, P(A)}{P(B \\mid A)P(A) + P(B \\mid A^c)P(A^c)}');
      r('eq-indep', 'A \\perp B \\iff P(A \\cap B) = P(A) \\cdot P(B) \\iff P(A \\mid B) = P(A)');
    }, 300);
  });
</script>

<svelte:head><title>Chapter 3: Conditional Probability | Probability Education</title></svelte:head>

<ChapterLayout {ch} nextCh={getNext(ch)} prevCh={getPrev(ch)}>

<section>
  <h2>3.1 Conditional Probability</h2>
  <p>Knowing that B occurred changes our probability for A. This updated probability is called the <strong>conditional probability</strong> of A given B:</p>
  <div class="math-block"><span id="eq-cond"></span></div>
  <p>Geometrically, conditioning on B reduces the sample space from Ω to B, then re-normalizes. The fraction of B that falls inside A is exactly P(A|B).</p>
</section>

<section>
  <h2>3.2 Bayes' Theorem</h2>
  <p>The most important formula in probability. It tells us how to update beliefs when new evidence arrives:</p>
  <div class="math-block"><span id="eq-bayes"></span></div>

  <!-- Natural Frequency Square -->
  <div class="sim-container">
    <div class="sim-header"><span class="sim-dot"></span>Bayes' Theorem — Natural Frequency Visualizer</div>
    <div class="bayes-body">
      <div class="bayes-controls">
        <label>Disease prevalence: <strong>{prevalence}%</strong>
          <input type="range" min="0.1" max="20" step="0.1" bind:value={prevalence} />
        </label>
        <label>Test sensitivity: <strong>{sensitivity}%</strong>
          <input type="range" min="50" max="100" step="1" bind:value={sensitivity} />
        </label>
        <label>Test specificity: <strong>{specificity}%</strong>
          <input type="range" min="50" max="100" step="1" bind:value={specificity} />
        </label>
      </div>

      <div class="bayes-square-wrap">
        <div class="freq-square" style="position:relative; width:200px; height:200px; border:2px solid var(--border); border-radius:8px; overflow:hidden;">
          <!-- TP -->
          <div style="position:absolute; left:0; top:0; width:{prev*100}%; height:{sens*100}%; background:var(--green); opacity:0.8;" title="True Positive"></div>
          <!-- FN -->
          <div style="position:absolute; left:0; top:{sens*100}%; width:{prev*100}%; height:{(1-sens)*100}%; background:var(--orange); opacity:0.6;" title="False Negative"></div>
          <!-- FP -->
          <div style="position:absolute; left:{prev*100}%; top:0; width:{(1-prev)*100}%; height:{(1-spec)*100}%; background:var(--red); opacity:0.5;" title="False Positive"></div>
          <!-- TN -->
          <div style="position:absolute; left:{prev*100}%; top:{(1-spec)*100}%; width:{(1-prev)*100}%; height:{spec*100}%; background:var(--bg); opacity:0.9;" title="True Negative"></div>
        </div>
        <div class="sq-legend">
          <div class="sq-leg green">■ True Positive: {(tp*100).toFixed(2)}%</div>
          <div class="sq-leg orange">■ False Negative: {(fn*100).toFixed(2)}%</div>
          <div class="sq-leg red">■ False Positive: {(fp*100).toFixed(2)}%</div>
          <div class="sq-leg gray">■ True Negative: {(tn*100).toFixed(2)}%</div>
        </div>
      </div>

      <div class="bayes-results">
        <div class="bres-card" style="border-color:var(--green)">
          <div class="bres-label">PPV — P(Disease | Positive)</div>
          <div class="bres-val" style="color:var(--green)">{(ppv*100).toFixed(1)}%</div>
        </div>
        <div class="bres-card" style="border-color:var(--blue)">
          <div class="bres-label">NPV — P(No Disease | Negative)</div>
          <div class="bres-val" style="color:var(--blue)">{(npv*100).toFixed(1)}%</div>
        </div>
      </div>
      <p class="bayes-note">⚠️ With only {prevalence}% prevalence, even a {sensitivity}%/{specificity}% test gives PPV = {(ppv*100).toFixed(1)}%. Low prevalence decimates positive predictive value — this is base rate neglect!</p>
    </div>
  </div>
</section>

<section>
  <h2>3.3 Independence</h2>
  <p>Events A and B are <strong>independent</strong> if knowing B gives no information about A:</p>
  <div class="math-block"><span id="eq-indep"></span></div>
  <p>Independence ≠ mutual exclusivity. Mutually exclusive events (P(A∩B)=0) are almost always <em>dependent</em> — if A occurred, B definitely didn't!</p>
</section>

<section>
  <h2>3.4 The Monty Hall Problem</h2>
  <p>You pick door 1. The host (who knows where the car is) opens another door revealing a goat. Should you switch? Bayes' theorem says: <strong>yes — switching wins with probability 2/3</strong>. The simulation below proves it empirically.</p>

  <div class="sim-container">
    <div class="sim-header"><span class="sim-dot"></span>Monty Hall Simulator</div>
    <div class="mh-body">
      <div class="mh-controls">
        <label>Number of games: <input type="range" min="100" max="10000" step="100" bind:value={mhN} disabled={mhRunning} /> <span class="param-val">{mhN.toLocaleString()}</span></label>
        <button class="run-btn" on:click={runMontyHall} disabled={mhRunning}>{mhRunning ? 'Running…' : '▶ Run'}</button>
      </div>
      {#if mhRuns > 0}
        <div class="mh-results">
          <div class="mh-bar-wrap">
            <div class="mh-strategy">Stay</div>
            <div class="mh-bar-track">
              <div class="mh-bar" style="width:{(mhStayWins/mhRuns*100).toFixed(1)}%; background:var(--orange)"></div>
            </div>
            <div class="mh-pct">{(mhStayWins/mhRuns*100).toFixed(1)}%</div>
            <div class="mh-theory">Theory: 33.3%</div>
          </div>
          <div class="mh-bar-wrap">
            <div class="mh-strategy">Switch</div>
            <div class="mh-bar-track">
              <div class="mh-bar" style="width:{(mhSwitchWins/mhRuns*100).toFixed(1)}%; background:var(--green)"></div>
            </div>
            <div class="mh-pct">{(mhSwitchWins/mhRuns*100).toFixed(1)}%</div>
            <div class="mh-theory">Theory: 66.7%</div>
          </div>
          <p class="mh-runs">Based on {mhRuns.toLocaleString()} games</p>
        </div>
      {:else}
        <p class="mh-prompt">Click Run to simulate the Monty Hall problem</p>
      {/if}
    </div>
  </div>
</section>

<section>
  <h2>3.5 The Birthday Paradox</h2>
  <p>In a group of n people, what's the probability that at least two share a birthday? The answer surprises most people.</p>

  <div class="sim-container">
    <div class="sim-header"><span class="sim-dot"></span>Birthday Paradox Calculator</div>
    <div class="bday-body">
      <label>Group size n: <input type="range" min="2" max="80" bind:value={bGroup} /> <span class="param-val">{bGroup}</span></label>
      <div class="bday-result" class:over50={bProb >= 0.5}>
        <div class="bday-prob">{(bProb * 100).toFixed(2)}%</div>
        <div class="bday-label">probability of a shared birthday</div>
        {#if bProb >= 0.5}
          <div class="bday-note">✓ More likely than not in a group of just {bGroup}!</div>
        {:else}
          <div class="bday-note">Need {23 - bGroup} more people to exceed 50%</div>
        {/if}
      </div>
      <div class="bday-bars">
        {#each [5,10,15,20,23,30,40,50,60,70] as n}
          <div class="bday-row">
            <span class="bday-n">n={n}</span>
            <div class="bday-track"><div class="bday-fill" style="width:{(birthdayProb(n)*100).toFixed(1)}%; background:{birthdayProb(n)>=0.5?'var(--green)':'var(--blue)'}"></div></div>
            <span class="bday-pct">{(birthdayProb(n)*100).toFixed(1)}%</span>
          </div>
        {/each}
      </div>
    </div>
  </div>
</section>

</ChapterLayout>

<style>
  section { margin-bottom: 2.5rem; }
  /* Bayes */
  .bayes-body { padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
  .bayes-controls { display: flex; flex-direction: column; gap: 0.5rem; }
  .bayes-controls label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; flex-wrap: wrap; }
  .bayes-controls input { flex: 1; max-width: 200px; }
  .bayes-square-wrap { display: flex; align-items: flex-start; gap: 1.5rem; flex-wrap: wrap; }
  .sq-legend { display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.8rem; font-family: var(--font-mono); }
  .sq-leg.green { color: var(--green); } .sq-leg.orange { color: var(--orange); }
  .sq-leg.red { color: var(--red); } .sq-leg.gray { color: var(--text3); }
  .bayes-results { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .bres-card { padding: 1rem; border-radius: 10px; border: 2px solid; background: var(--surface); text-align: center; }
  .bres-label { font-size: 0.8rem; color: var(--text3); margin-bottom: 0.3rem; }
  .bres-val { font-size: 2rem; font-weight: 700; font-family: var(--font-mono); }
  .bayes-note { font-size: 0.85rem; background: var(--ybg); padding: 0.75rem; border-radius: 8px; border-left: 3px solid var(--yellow); }
  /* MH */
  .mh-body { padding: 1.25rem; }
  .mh-controls { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
  .mh-controls label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
  .mh-controls input { max-width: 180px; }
  .run-btn { background: var(--accent); color: #fff; border: none; border-radius: 6px; padding: 0.4rem 1rem; cursor: pointer; font-weight: 600; font-size: 0.875rem; }
  .run-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .param-val { font-family: var(--font-mono); font-weight: 700; }
  .mh-results { display: flex; flex-direction: column; gap: 0.75rem; }
  .mh-bar-wrap { display: grid; grid-template-columns: 60px 1fr 60px 80px; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
  .mh-strategy { font-weight: 600; }
  .mh-bar-track { height: 24px; background: var(--bg); border-radius: 4px; border: 1px solid var(--border); overflow: hidden; }
  .mh-bar { height: 100%; border-radius: 4px; transition: width 0.3s; }
  .mh-pct { font-family: var(--font-mono); font-weight: 700; }
  .mh-theory { font-size: 0.75rem; color: var(--text3); font-family: var(--font-mono); }
  .mh-runs { font-size: 0.8rem; color: var(--text3); font-family: var(--font-mono); }
  .mh-prompt { color: var(--text3); font-style: italic; font-size: 0.9rem; }
  /* Birthday */
  .bday-body { padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
  .bday-body label { display: flex; align-items: center; gap: 0.75rem; font-size: 0.9rem; }
  .bday-body input { max-width: 200px; }
  .bday-result { text-align: center; padding: 1.5rem; background: var(--bbg); border-radius: 12px; border: 2px solid var(--blue); }
  .bday-result.over50 { background: var(--gbg); border-color: var(--green); }
  .bday-prob { font-size: 3rem; font-weight: 700; font-family: var(--font-mono); color: var(--accent); }
  .bday-result.over50 .bday-prob { color: var(--green); }
  .bday-label { color: var(--text2); font-size: 0.9rem; }
  .bday-note { margin-top: 0.5rem; font-size: 0.85rem; color: var(--text3); }
  .bday-bars { display: flex; flex-direction: column; gap: 0.3rem; }
  .bday-row { display: grid; grid-template-columns: 50px 1fr 50px; align-items: center; gap: 0.5rem; font-size: 0.8rem; }
  .bday-n { font-family: var(--font-mono); color: var(--text3); }
  .bday-track { height: 18px; background: var(--bg); border-radius: 4px; border: 1px solid var(--border); overflow: hidden; }
  .bday-fill { height: 100%; border-radius: 4px; transition: width 0.2s; }
  .bday-pct { font-family: var(--font-mono); }
</style>
