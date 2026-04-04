<script lang="ts">
  import { base } from '$app/paths';
  import { difficultyClass, difficultyLabel } from '$lib/data/chapters';
  import type { Chapter } from '$lib/data/chapters';

  export let chapter: Chapter;
  export let nextCh: Chapter | undefined = undefined;
  export let prevCh: Chapter | undefined = undefined;
</script>

<article class="chapter-page">
  <!-- Breadcrumb -->
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="{base}/">Home</a>
    <span aria-hidden="true">›</span>
    <span>Part {chapter.part}</span>
    <span aria-hidden="true">›</span>
    <span>Chapter {chapter.num}</span>
  </nav>

  <!-- Chapter header -->
  <header class="ch-header">
    <div class="ch-meta">
      <span class="badge {difficultyClass(chapter.difficulty)}">{difficultyLabel(chapter.difficulty)}</span>
      <span class="ch-time">~{chapter.minutes} min</span>
    </div>
    <h1 class="ch-title">
      <span class="ch-num-label">Chapter {chapter.num}</span>
      {chapter.title}
    </h1>
    <p class="ch-subtitle">{chapter.subtitle}</p>
    <div class="ch-topics">
      {#each chapter.topics as topic}
        <span class="topic-pill">{topic}</span>
      {/each}
    </div>
  </header>

  <!-- Chapter body (slot) -->
  <div class="ch-body">
    <slot />
  </div>

  <!-- Prev / Next navigation -->
  <nav class="ch-nav" aria-label="Chapter navigation">
    {#if prevCh}
      <a href="{base}{prevCh.route}" class="ch-nav-link prev">
        <span class="ch-nav-dir">← Previous</span>
        <span class="ch-nav-title">Ch {prevCh.num}: {prevCh.title}</span>
      </a>
    {:else}
      <div></div>
    {/if}
    {#if nextCh}
      <a href="{base}{nextCh.route}" class="ch-nav-link next">
        <span class="ch-nav-dir">Next →</span>
        <span class="ch-nav-title">Ch {nextCh.num}: {nextCh.title}</span>
      </a>
    {/if}
  </nav>
</article>

<style>
  .chapter-page { max-width: 860px; }

  .breadcrumb {
    display: flex; align-items: center; gap: 0.4rem;
    font-size: 0.8rem; color: var(--text3);
    margin-bottom: 1.5rem;
  }
  .breadcrumb a { color: var(--text3); }
  .breadcrumb a:hover { color: var(--accent); }

  .ch-header { margin-bottom: 2rem; }
  .ch-meta { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
  .ch-time { font-family: var(--font-mono); font-size: 0.75rem; color: var(--text3); }
  .ch-num-label {
    display: block; font-family: var(--font-mono);
    font-size: 0.8rem; color: var(--text3);
    margin-bottom: 0.15rem;
  }
  .ch-title { font-size: clamp(1.75rem, 4vw, 2.4rem); margin: 0 0 0.4rem; }
  .ch-subtitle { color: var(--text2); font-size: 1.05rem; margin: 0 0 1rem; }
  .ch-topics { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .topic-pill {
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 999px; padding: 2px 10px;
    font-size: 0.75rem; color: var(--text3);
    font-family: var(--font-mono);
  }

  .ch-body { margin-bottom: 3rem; }

  .ch-nav {
    border-top: 1px solid var(--border);
    padding-top: 1.5rem;
    display: flex; justify-content: space-between; gap: 1rem;
  }
  .ch-nav-link {
    display: flex; flex-direction: column; gap: 0.2rem;
    text-decoration: none; color: var(--text2);
    max-width: 45%;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border); border-radius: 8px;
    transition: all 0.15s;
  }
  .ch-nav-link:hover { border-color: var(--accent); color: var(--text); text-decoration: none; }
  .ch-nav-link.next { text-align: right; margin-left: auto; }
  .ch-nav-dir { font-size: 0.75rem; color: var(--text3); }
  .ch-nav-title { font-size: 0.875rem; font-weight: 500; }
</style>
