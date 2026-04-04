<script lang="ts">
  import { base } from '$app/paths';

  interface Dist {
    name: string; type: 'discrete'|'continuous'; params: string;
    support: string; mean: string; variance: string; mgf: string;
    chapter: number; part: number;
  }

  const dists: Dist[] = [
    { name: 'Bernoulli(p)', type:'discrete', params:'p ∈ [0,1]', support:'{0,1}', mean:'p', variance:'p(1−p)', mgf:'1−p+pe^t', chapter:4, part:1 },
    { name: 'Binomial(n,p)', type:'discrete', params:'n∈ℕ, p∈[0,1]', support:'{0,…,n}', mean:'np', variance:'np(1−p)', mgf:'(1−p+pe^t)ⁿ', chapter:4, part:1 },
    { name: 'Geometric(p)', type:'discrete', params:'p∈(0,1]', support:'{1,2,…}', mean:'1/p', variance:'(1−p)/p²', mgf:'pe^t/(1−(1−p)e^t)', chapter:4, part:1 },
    { name: 'Negative Binomial(r,p)', type:'discrete', params:'r∈ℕ, p∈(0,1]', support:'{r,r+1,…}', mean:'r/p', variance:'r(1−p)/p²', mgf:'(pe^t/(1−(1−p)e^t))^r', chapter:4, part:1 },
    { name: 'Poisson(λ)', type:'discrete', params:'λ > 0', support:'{0,1,2,…}', mean:'λ', variance:'λ', mgf:'exp(λ(e^t−1))', chapter:4, part:1 },
    { name: 'Hypergeometric(N,K,n)', type:'discrete', params:'N,K,n∈ℕ', support:'{max(0,n+K−N),…,min(n,K)}', mean:'nK/N', variance:'nK(N−K)(N−n)/N²(N−1)', mgf:'—', chapter:4, part:1 },
    { name: 'Uniform(a,b)', type:'continuous', params:'a<b', support:'[a,b]', mean:'(a+b)/2', variance:'(b−a)²/12', mgf:'(e^(tb)−e^(ta))/(t(b−a))', chapter:5, part:1 },
    { name: 'Exponential(λ)', type:'continuous', params:'λ > 0', support:'[0,∞)', mean:'1/λ', variance:'1/λ²', mgf:'λ/(λ−t), t<λ', chapter:5, part:1 },
    { name: 'Normal(μ,σ²)', type:'continuous', params:'μ∈ℝ, σ²>0', support:'(−∞,∞)', mean:'μ', variance:'σ²', mgf:'exp(μt + σ²t²/2)', chapter:5, part:1 },
    { name: 'Gamma(α,β)', type:'continuous', params:'α,β > 0', support:'(0,∞)', mean:'α/β', variance:'α/β²', mgf:'(β/(β−t))^α, t<β', chapter:5, part:1 },
    { name: 'Beta(α,β)', type:'continuous', params:'α,β > 0', support:'[0,1]', mean:'α/(α+β)', variance:'αβ/((α+β)²(α+β+1))', mgf:'—', chapter:5, part:1 },
    { name: 'Cauchy(x₀,γ)', type:'continuous', params:'x₀∈ℝ, γ>0', support:'(−∞,∞)', mean:'undefined', variance:'undefined', mgf:'undefined', chapter:7, part:2 },
    { name: 'Student-t(ν)', type:'continuous', params:'ν > 0 (dof)', support:'(−∞,∞)', mean:'0 (ν>1)', variance:'ν/(ν−2) (ν>2)', mgf:'undefined', chapter:7, part:2 },
    { name: 'Chi-squared(k)', type:'continuous', params:'k∈ℕ (dof)', support:'[0,∞)', mean:'k', variance:'2k', mgf:'(1−2t)^(−k/2), t<½', chapter:7, part:2 },
    { name: 'Log-Normal(μ,σ²)', type:'continuous', params:'μ∈ℝ, σ²>0', support:'(0,∞)', mean:'e^(μ+σ²/2)', variance:'(e^σ²−1)e^(2μ+σ²)', mgf:'—', chapter:8, part:2 },
    { name: 'Pareto(α,xₘ)', type:'continuous', params:'α>0, xₘ>0', support:'[xₘ,∞)', mean:'αxₘ/(α−1) (α>1)', variance:'xₘ²α/((α−1)²(α−2)) (α>2)', mgf:'undefined', chapter:8, part:2 },
  ];

  let filter: 'all'|'discrete'|'continuous' = 'all';
  let search = '';
  $: filtered = dists.filter(d =>
    (filter === 'all' || d.type === filter) &&
    (search === '' || d.name.toLowerCase().includes(search.toLowerCase()))
  );
</script>

<svelte:head><title>Distribution Reference | Probability Education</title></svelte:head>

<div class="appendix-page">
  <h1>Distribution Reference</h1>
  <p class="lead">Complete reference for all named probability distributions in this textbook. Click a distribution name to jump to the chapter where it is introduced.</p>

  <div class="toolbar">
    <input class="search-input" type="search" placeholder="Search distributions…" bind:value={search} />
    <div class="filter-tabs">
      {#each ['all','discrete','continuous'] as f}
        <button class="ftab" class:active={filter===f} on:click={() => filter=f as typeof filter}>
          {f.charAt(0).toUpperCase()+f.slice(1)}
        </button>
      {/each}
    </div>
  </div>

  <div class="dist-table-wrap">
    <table class="dist-table">
      <thead>
        <tr>
          <th>Distribution</th><th>Type</th><th>Parameters</th>
          <th>Support</th><th>Mean</th><th>Variance</th><th>MGF</th><th>Chapter</th>
        </tr>
      </thead>
      <tbody>
        {#each filtered as d}
          <tr>
            <td class="dist-name">
              <a href="{base}/part-{d.part}/chapter-{d.chapter}">{d.name}</a>
            </td>
            <td>
              <span class="badge {d.type==='discrete'?'badge-hs':'badge-ug'}">{d.type}</span>
            </td>
            <td class="mono">{d.params}</td>
            <td class="mono">{d.support}</td>
            <td class="mono">{d.mean}</td>
            <td class="mono">{d.variance}</td>
            <td class="mono small">{d.mgf}</td>
            <td><a href="{base}/part-{d.part}/chapter-{d.chapter}" class="ch-link">Ch {d.chapter}</a></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if filtered.length === 0}
    <p class="no-results">No distributions match your search.</p>
  {/if}
</div>

<style>
  .appendix-page { max-width: 1000px; }
  h1 { font-size: 2rem; margin-bottom: 0.5rem; }
  .lead { color: var(--text2); margin-bottom: 1.5rem; }
  .toolbar { display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; }
  .search-input {
    padding: 0.4rem 0.75rem; border: 1px solid var(--border);
    border-radius: 8px; background: var(--bg); color: var(--text);
    font-size: 0.9rem; flex: 1; min-width: 200px;
  }
  .filter-tabs { display: flex; gap: 0.25rem; }
  .ftab {
    padding: 0.35rem 0.75rem; border: 1px solid var(--border);
    border-radius: 6px; background: var(--bg); color: var(--text2);
    cursor: pointer; font-size: 0.875rem;
  }
  .ftab.active { background: var(--accent); color: #fff; border-color: var(--accent); }
  .dist-table-wrap { overflow-x: auto; }
  .dist-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  .dist-table th {
    text-align: left; padding: 0.6rem 0.75rem;
    border-bottom: 2px solid var(--border);
    font-size: 0.75rem; font-weight: 700; color: var(--text3);
    text-transform: uppercase; letter-spacing: 0.05em;
    white-space: nowrap;
  }
  .dist-table td { padding: 0.55rem 0.75rem; border-bottom: 1px solid var(--border); vertical-align: top; }
  .dist-table tr:hover td { background: var(--bg); }
  .dist-name a { font-weight: 600; color: var(--accent); font-family: var(--font-mono); font-size: 0.8rem; }
  .mono { font-family: var(--font-mono); font-size: 0.8rem; color: var(--text2); }
  .small { font-size: 0.72rem; }
  .ch-link { color: var(--text3); font-family: var(--font-mono); font-size: 0.8rem; }
  .ch-link:hover { color: var(--accent); }
  .no-results { color: var(--text3); text-align: center; padding: 2rem; }
</style>
