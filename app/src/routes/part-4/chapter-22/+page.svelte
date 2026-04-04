<script lang="ts">
  import ChapterLayout from '$lib/components/ChapterLayout.svelte';
  import LegacyModule from '$lib/components/LegacyModule.svelte';
  import { getChapter, getNext, getPrev } from '$lib/data/chapters';

  const ch = getChapter(4, 22)!;
</script>

<svelte:head><title>Chapter 22: Probabilistic Combinatorics | Probability Education</title></svelte:head>

<ChapterLayout {ch} nextCh={getNext(ch)} prevCh={getPrev(ch)}>

<section class="ch-intro">
  <p class="ch-lead">The probabilistic method, Lovász LLL, and random graphs. This chapter covers: Probabilistic method, Lovász LLL, Erdős-Rényi, Phase transitions.</p>
</section>


<div class="coming-soon">
  <span class="cs-icon">🔬</span>
  <div>
    <strong>New simulation coming soon</strong>
    Interactive D3.js + rust-sci-core WASM simulations for this chapter are under active development.
  </div>
</div>

</ChapterLayout>

<style>
  .ch-intro { margin-bottom: 2rem; }
  .ch-lead { font-size: 1.05rem; color: var(--text2); line-height: 1.7; }
  .sim-note {
    display: flex; align-items: flex-start; gap: 0.75rem;
    background: var(--bbg); border: 1px solid var(--blue);
    border-radius: 10px; padding: 1rem; margin-bottom: 1rem;
    font-size: 0.9rem;
  }
  .sim-note-icon { font-size: 1.25rem; }
  .coming-soon {
    display: flex; align-items: flex-start; gap: 0.75rem;
    background: var(--obg); border: 1px solid var(--orange);
    border-radius: 10px; padding: 1.25rem; margin: 1.5rem 0;
    font-size: 0.9rem;
  }
  .cs-icon { font-size: 1.5rem; }
</style>
