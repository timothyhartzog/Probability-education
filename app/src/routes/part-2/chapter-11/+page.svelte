<script lang="ts">
  import ChapterLayout from '$lib/components/ChapterLayout.svelte';
  import LegacyModule from '$lib/components/LegacyModule.svelte';
  import { getChapter, getNext, getPrev } from '$lib/data/chapters';

  const ch = getChapter(2, 11)!;
</script>

<svelte:head><title>Chapter 11: Introduction to Stochastic Processes | Probability Education</title></svelte:head>

<ChapterLayout {ch} nextCh={getNext(ch)} prevCh={getPrev(ch)}>

<section class="ch-intro">
  <p class="ch-lead">Markov chains, random walks, and the Poisson process. This chapter covers: Markov chains, Stationary distributions, Gambler's ruin, Poisson process.</p>
</section>


<div class="sim-note">
  <span class="sim-note-icon">📊</span>
  <div>
    <strong>Interactive simulation below</strong> — this module is powered by the existing
    interactive visualization. Use the controls inside the panel to explore.
  </div>
</div>
<LegacyModule moduleId="6.1-markov-dashboard" title="Introduction to Stochastic Processes" height={700} />

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
