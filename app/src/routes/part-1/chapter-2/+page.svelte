<script lang="ts">
  import { onMount } from 'svelte';
  import ChapterLayout from '$lib/components/ChapterLayout.svelte';
  import { getChapter, getNext, getPrev } from '$lib/data/chapters';

  const ch = getChapter(1, 2)!;

  // ── Pascal's Triangle ──────────────────────────────────────────
  const ROWS = 12;
  let highlighted = { n: -1, r: -1 };

  function pascal(n: number, r: number): number {
    if (r === 0 || r === n) return 1;
    if (r < 0 || r > n) return 0;
    let top = 1, bot = 1;
    for (let i = 0; i < Math.min(r, n - r); i++) {
      top *= (n - i); bot *= (i + 1);
    }
    return Math.round(top / bot);
  }

  const triangle = Array.from({ length: ROWS }, (_, n) =>
    Array.from({ length: n + 1 }, (_, r) => pascal(n, r))
  );

  function fmt(n: number): string {
    return n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n.toLocaleString();
  }

  // ── Permutation / Combination Calculator ──────────────────────
  let calcN = 8, calcR = 3;
  function fact(n: number): number { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
  $: perm = calcR > calcN ? 0 : fact(calcN) / fact(calcN - calcR);
  $: comb = calcR > calcN ? 0 : fact(calcN) / (fact(calcR) * fact(calcN - calcR));

  // ── Inclusion-Exclusion ────────────────────────────────────────
  let ieA = 30, ieB = 25, ieC = 20, ieAB = 10, ieAC = 8, ieBC = 9, ieABC = 4;
  $: ieUnion = ieA + ieB + ieC - ieAB - ieAC - ieBC + ieABC;

  // ── Derangements ──────────────────────────────────────────────
  let derangeN = 4;
  function derangement(n: number): number {
    if (n === 0) return 1; if (n === 1) return 0;
    return (n - 1) * (derangement(n - 1) + derangement(n - 2));
  }
  $: dn = derangement(derangeN);
  $: dnProb = dn / fact(derangeN);

  onMount(() => {
    const K = (window as any).katex;
    if (!K) return;
    setTimeout(() => {
      const r = (id: string, tex: string) => {
        const el = document.getElementById(id); if (!el) return;
        K.render(tex, el, { displayMode: true, throwOnError: false });
      };
      r('eq-perm', 'P(n,r) = \\frac{n!}{(n-r)!}');
      r('eq-comb', 'C(n,r) = \\binom{n}{r} = \\frac{n!}{r!(n-r)!}');
      r('eq-ie',   '|A \\cup B \\cup C| = |A|+|B|+|C| - |A\\cap B| - |A\\cap C| - |B\\cap C| + |A\\cap B\\cap C|');
      r('eq-der',  'D_n = n! \\sum_{k=0}^{n} \\frac{(-1)^k}{k!} \\approx \\frac{n!}{e}');
    }, 300);
  });
</script>

<svelte:head><title>Chapter 2: Counting and Combinatorics | Probability Education</title></svelte:head>

<ChapterLayout {ch} nextCh={getNext(ch)} prevCh={getPrev(ch)}>

<section>
  <h2>2.1 Why Counting Matters</h2>
  <p>For equally likely outcomes, P(A) = |A| / |Ω|. So computing probabilities reduces to counting. This chapter builds the complete toolkit: the fundamental counting principle, permutations, combinations, and inclusion-exclusion.</p>
</section>

<section>
  <h2>2.2 Permutations and Combinations</h2>
  <p>A <strong>permutation</strong> P(n,r) counts ordered selections of r items from n. A <strong>combination</strong> C(n,r) counts unordered selections — order doesn't matter.</p>
  <div class="math-block"><span id="eq-perm"></span></div>
  <div class="math-block"><span id="eq-comb"></span></div>

  <div class="sim-container">
    <div class="sim-header"><span class="sim-dot"></span>Permutation &amp; Combination Calculator</div>
    <div class="calc-body">
      <div class="calc-controls">
        <label>n (total items)
          <input type="range" min="1" max="20" bind:value={calcN} />
          <span class="param-val">{calcN}</span>
        </label>
        <label>r (choosing)
          <input type="range" min="0" max={calcN} bind:value={calcR} />
          <span class="param-val">{calcR}</span>
        </label>
      </div>
      <div class="calc-results">
        <div class="calc-card blue">
          <div class="calc-label">P({calcN},{calcR}) — Permutations</div>
          <div class="calc-val">{perm.toLocaleString()}</div>
          <div class="calc-sub">Ordered · {calcN}! / ({calcN - calcR})!</div>
        </div>
        <div class="calc-card purple">
          <div class="calc-label">C({calcN},{calcR}) — Combinations</div>
          <div class="calc-val">{comb.toLocaleString()}</div>
          <div class="calc-sub">Unordered · {calcN}! / ({calcR}!×{calcN - calcR}!)</div>
        </div>
        <div class="calc-card green">
          <div class="calc-label">Ratio P/C</div>
          <div class="calc-val">{calcR <= calcN ? fact(calcR).toLocaleString() : '—'}</div>
          <div class="calc-sub">= r! = {calcR}! arrangements</div>
        </div>
      </div>
    </div>
  </div>
</section>

<section>
  <h2>2.3 Pascal's Triangle</h2>
  <p>Pascal's Triangle displays every binomial coefficient C(n,r). Row n gives the coefficients of (x+y)ⁿ. Hover any entry to see its value and formula.</p>

  <div class="sim-container">
    <div class="sim-header"><span class="sim-dot"></span>Interactive Pascal's Triangle — hover to explore</div>
    <div class="pascal-wrap">
      <div class="pascal">
        {#each triangle as row, n}
          <div class="pascal-row">
            {#each row as val, r}
              <button
                class="pascal-cell"
                class:active={highlighted.n === n && highlighted.r === r}
                class:highlight-row={highlighted.n === n}
                on:mouseenter={() => highlighted = { n, r }}
                on:mouseleave={() => highlighted = { n: -1, r: -1 }}
                on:focus={() => highlighted = { n, r }}
                on:blur={() => highlighted = { n: -1, r: -1 }}
                title="C({n},{r}) = {fmt(val)}"
              >{fmt(val)}</button>
            {/each}
          </div>
        {/each}
      </div>
      {#if highlighted.n >= 0}
        <div class="pascal-info">
          <strong>C({highlighted.n}, {highlighted.r})</strong> = {pascal(highlighted.n, highlighted.r).toLocaleString()}
          <br/>Row {highlighted.n} of Pascal's Triangle
        </div>
      {:else}
        <div class="pascal-info muted">Hover over a cell to see its value and position</div>
      {/if}
    </div>
  </div>
</section>

<section>
  <h2>2.4 The Inclusion-Exclusion Principle</h2>
  <p>For three events A, B, C (not necessarily disjoint), the size of the union is:</p>
  <div class="math-block"><span id="eq-ie"></span></div>

  <div class="sim-container">
    <div class="sim-header"><span class="sim-dot"></span>Inclusion-Exclusion Calculator</div>
    <div class="ie-body">
      <div class="ie-controls">
        {#each [['ieA','|A|',ieA],['ieB','|B|',ieB],['ieC','|C|',ieC],['ieAB','|A∩B|',ieAB],['ieAC','|A∩C|',ieAC],['ieBC','|B∩C|',ieBC],['ieABC','|A∩B∩C|',ieABC]] as [key,label,val]}
          <label>{label}
            <input type="number" min="0" max="100"
              value={val}
              on:input={(e) => {
                const v = parseInt((e.target as HTMLInputElement).value)||0;
                if(key==='ieA') ieA=v; else if(key==='ieB') ieB=v;
                else if(key==='ieC') ieC=v; else if(key==='ieAB') ieAB=v;
                else if(key==='ieAC') ieAC=v; else if(key==='ieBC') ieBC=v;
                else ieABC=v;
              }}
              class="ie-input"
            />
          </label>
        {/each}
      </div>
      <div class="ie-result">
        <div class="ie-steps">
          <div>|A| + |B| + |C| = <strong>{ieA + ieB + ieC}</strong></div>
          <div>− |A∩B| − |A∩C| − |B∩C| = <strong>− {ieAB + ieAC + ieBC}</strong></div>
          <div>+ |A∩B∩C| = <strong>+ {ieABC}</strong></div>
        </div>
        <div class="ie-answer">|A ∪ B ∪ C| = <strong>{ieUnion}</strong></div>
      </div>
    </div>
  </div>
</section>

<section>
  <h2>2.5 Derangements</h2>
  <p>A <strong>derangement</strong> is a permutation where no element appears in its original position — like a secret Santa where nobody gets their own name. The count D_n satisfies:</p>
  <div class="math-block"><span id="eq-der"></span></div>

  <div class="sim-container">
    <div class="sim-header"><span class="sim-dot"></span>Derangement Calculator</div>
    <div class="der-body">
      <label>n items: <input type="range" min="1" max="10" bind:value={derangeN} />
        <span class="param-val">{derangeN}</span>
      </label>
      <div class="der-results">
        <div class="der-stat"><span class="der-label">n!</span><span class="der-val">{fact(derangeN).toLocaleString()}</span></div>
        <div class="der-stat"><span class="der-label">D_{derangeN}</span><span class="der-val">{dn.toLocaleString()}</span></div>
        <div class="der-stat"><span class="der-label">P(derangement)</span><span class="der-val">{dnProb.toFixed(6)}</span></div>
        <div class="der-stat"><span class="der-label">≈ 1/e</span><span class="der-val">{(1/Math.E).toFixed(6)}</span></div>
      </div>
      <p class="der-note">As n → ∞, the probability of a random permutation being a derangement converges to 1/e ≈ 0.3679 — remarkably, independent of n!</p>
    </div>
  </div>
</section>

</ChapterLayout>

<style>
  section { margin-bottom: 2.5rem; }
  .calc-body { padding: 1.25rem; }
  .calc-controls { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.25rem; }
  .calc-controls label { display: flex; align-items: center; gap: 0.75rem; font-size: 0.9rem; }
  .calc-controls input[type=range] { flex: 1; max-width: 200px; }
  .param-val { font-family: var(--font-mono); font-weight: 700; min-width: 2rem; }
  .calc-results { display: grid; grid-template-columns: repeat(3,1fr); gap: 0.75rem; }
  .calc-card { padding: 1rem; border-radius: 10px; border: 1px solid var(--border); text-align: center; }
  .calc-card.blue { background: var(--bbg); border-color: var(--blue); }
  .calc-card.purple { background: var(--pbg); border-color: var(--purple); }
  .calc-card.green { background: var(--gbg); border-color: var(--green); }
  .calc-label { font-size: 0.75rem; color: var(--text3); margin-bottom: 0.3rem; font-family: var(--font-mono); }
  .calc-val { font-size: 1.6rem; font-weight: 700; font-family: var(--font-mono); }
  .calc-sub { font-size: 0.7rem; color: var(--text3); margin-top: 0.2rem; }

  /* Pascal */
  .pascal-wrap { padding: 1rem; overflow-x: auto; }
  .pascal { display: flex; flex-direction: column; align-items: center; gap: 3px; }
  .pascal-row { display: flex; gap: 3px; }
  .pascal-cell {
    min-width: 52px; padding: 4px 2px; border-radius: 6px;
    border: 1px solid var(--border); background: var(--bg);
    font-size: 0.72rem; font-family: var(--font-mono); cursor: pointer;
    transition: all 0.12s; color: var(--text2); text-align: center;
  }
  .pascal-cell:hover, .pascal-cell.active {
    background: var(--accent); color: #fff; border-color: var(--accent); transform: scale(1.1);
  }
  .pascal-cell.highlight-row { background: var(--bbg); border-color: var(--blue); }
  .pascal-info {
    margin-top: 0.75rem; padding: 0.6rem 1rem;
    background: var(--bbg); border-radius: 8px;
    font-size: 0.9rem; text-align: center;
  }
  .pascal-info.muted { color: var(--text3); }

  /* IE */
  .ie-body { padding: 1.25rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
  .ie-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
  .ie-controls label { display: flex; flex-direction: column; font-size: 0.8rem; gap: 0.2rem; font-weight: 600; }
  .ie-input { padding: 0.3rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); font-family: var(--font-mono); width: 100%; }
  .ie-result { display: flex; flex-direction: column; gap: 0.5rem; }
  .ie-steps { background: var(--bg); padding: 0.75rem; border-radius: 8px; font-size: 0.875rem; line-height: 1.8; font-family: var(--font-mono); }
  .ie-answer { background: var(--bbg); color: var(--blue); padding: 0.75rem 1rem; border-radius: 8px; font-size: 1.1rem; font-family: var(--font-mono); border: 1px solid var(--blue); }

  /* Derangements */
  .der-body { padding: 1.25rem; }
  .der-body label { display: flex; align-items: center; gap: 0.75rem; font-size: 0.9rem; margin-bottom: 1rem; }
  .der-body input[type=range] { width: 200px; }
  .der-results { display: grid; grid-template-columns: repeat(4,1fr); gap: 0.75rem; margin-bottom: 1rem; }
  .der-stat { text-align: center; background: var(--bg); padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border); }
  .der-label { font-size: 0.75rem; color: var(--text3); font-family: var(--font-mono); }
  .der-val { font-size: 1.1rem; font-weight: 700; font-family: var(--font-mono); color: var(--purple); }
  .der-note { font-size: 0.85rem; color: var(--text2); background: var(--pbg); padding: 0.75rem; border-radius: 8px; }
  @media(max-width:640px){ .calc-results,.der-results{ grid-template-columns:1fr 1fr; } .ie-body{ grid-template-columns:1fr; } }
</style>
