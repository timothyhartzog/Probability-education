<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { PARTS, CHAPTERS } from '$lib/data/chapters';

  let menuOpen = false;
  let theme = 'light';

  function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }

  function closeMenu() { menuOpen = false; }

  // Restore theme on mount
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('theme') ?? 'light';
    theme = saved;
    document.documentElement.setAttribute('data-theme', saved);
  }
</script>

<svelte:head>
  <title>Probability: Foundations to Research Frontiers</title>
</svelte:head>

<!-- Skip link -->
<a class="skip-link" href="#main">Skip to content</a>

<!-- ── Top Navigation ──────────────────────────────────────────── -->
<nav class="topnav" aria-label="Main navigation">
  <div class="nav-inner">
    <a class="nav-brand" href="{base}/">
      <span class="nav-pi">π</span>
      <span class="nav-title">Probability</span>
    </a>

    <!-- Desktop part links -->
    <ul class="nav-parts" role="list">
      {#each PARTS as part}
        <li>
          <a href="{base}/part-{part.num}/chapter-{part.chapters[0].num}"
             class="nav-part-link"
             class:active={$page.url.pathname.includes(`/part-${part.num}/`)}
             style="--part-color: {part.color}">
            Part {part.num}
          </a>
        </li>
      {/each}
      <li>
        <a href="{base}/appendix/distributions" class="nav-part-link"
           class:active={$page.url.pathname.includes('/appendix/')}>
          Reference
        </a>
      </li>
    </ul>

    <div class="nav-actions">
      <button class="theme-btn" on:click={toggleTheme} aria-label="Toggle dark mode">
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
      <button class="menu-btn" on:click={() => menuOpen = !menuOpen}
              aria-expanded={menuOpen} aria-label="Toggle chapter menu">
        <span class="ham" class:open={menuOpen}></span>
      </button>
    </div>
  </div>
</nav>

<!-- ── Mobile Sidebar ──────────────────────────────────────────── -->
{#if menuOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="overlay" on:click={closeMenu}></div>
{/if}

<aside class="sidebar" class:open={menuOpen} aria-label="Chapter navigation">
  <div class="sidebar-header">
    <span class="sidebar-title">Chapters</span>
    <button class="close-btn" on:click={closeMenu} aria-label="Close">✕</button>
  </div>
  <nav class="sidebar-nav">
    {#each PARTS as part}
      <div class="sidebar-part">
        <div class="sidebar-part-header" style="color: {part.color}">
          Part {part.num} — {part.title}
        </div>
        {#each part.chapters as ch}
          <a href="{base}{ch.route}" class="sidebar-link"
             class:active={$page.url.pathname === ch.route || $page.url.pathname.startsWith(ch.route + '/')}
             on:click={closeMenu}>
            <span class="ch-num">{ch.num}</span>
            <span class="ch-title">{ch.title}</span>
          </a>
        {/each}
      </div>
    {/each}
  </nav>
</aside>

<!-- ── Main Content ────────────────────────────────────────────── -->
<main id="main" class="main-content">
  <slot />
</main>

<!-- ── Footer ─────────────────────────────────────────────────── -->
<footer class="site-footer">
  <div class="footer-inner">
    <span>Probability Education Platform v2</span>
    <span class="footer-sep">·</span>
    <span>SvelteKit + D3.js 7.8.5</span>
    <span class="footer-sep">·</span>
    <a href="https://github.com/timothyhartzog/Probability-education" target="_blank" rel="noopener">
      GitHub ↗
    </a>
    <span class="footer-sep">·</span>
    <span>{CHAPTERS.length} chapters</span>
  </div>
</footer>

<style>
  .skip-link {
    position: absolute; top: -100px; left: 0;
    background: var(--accent); color: #fff;
    padding: 0.5rem 1rem; z-index: 999;
    transition: top 0.2s;
  }
  .skip-link:focus { top: 0; }

  /* ── Nav ── */
  .topnav {
    position: sticky; top: 0; z-index: 100;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    box-shadow: 0 1px 8px rgba(0,0,0,0.06);
  }
  .nav-inner {
    max-width: 1200px; margin: 0 auto;
    padding: 0 1.5rem;
    display: flex; align-items: center; gap: 1rem;
    height: 56px;
  }
  .nav-brand {
    display: flex; align-items: center; gap: 0.4rem;
    text-decoration: none; color: var(--text);
    flex-shrink: 0;
  }
  .nav-pi {
    font-family: var(--font-heading);
    font-size: 1.5rem;
    color: var(--accent);
    line-height: 1;
  }
  .nav-title {
    font-family: var(--font-heading);
    font-size: 1.1rem;
    color: var(--text);
  }
  .nav-parts {
    display: flex; list-style: none;
    margin: 0; padding: 0; gap: 0.25rem;
    flex: 1;
  }
  .nav-part-link {
    display: block; padding: 0.35rem 0.65rem;
    border-radius: 6px; font-size: 0.875rem;
    font-weight: 500; color: var(--text2);
    text-decoration: none; transition: all 0.15s;
  }
  .nav-part-link:hover { color: var(--text); background: var(--border); }
  .nav-part-link.active { color: var(--part-color, var(--accent)); background: var(--bbg); }
  .nav-actions { display: flex; align-items: center; gap: 0.5rem; margin-left: auto; }

  .theme-btn {
    background: none; border: 1px solid var(--border);
    border-radius: 6px; padding: 0.3rem 0.5rem;
    cursor: pointer; font-size: 1rem; line-height: 1;
  }
  .menu-btn {
    background: none; border: 1px solid var(--border);
    border-radius: 6px; padding: 0.4rem 0.6rem;
    cursor: pointer; display: flex; align-items: center;
  }
  .ham, .ham::before, .ham::after {
    display: block; width: 18px; height: 2px;
    background: var(--text); border-radius: 2px;
    transition: transform 0.2s;
    position: relative;
  }
  .ham::before, .ham::after {
    content: ''; position: absolute;
  }
  .ham::before { top: -5px; }
  .ham::after  { top: 5px; }
  .ham.open { background: transparent; }
  .ham.open::before { transform: rotate(45deg) translate(4px, 4px); }
  .ham.open::after  { transform: rotate(-45deg) translate(4px, -4px); }

  /* ── Sidebar ── */
  .overlay {
    position: fixed; inset: 0; z-index: 150;
    background: rgba(0,0,0,0.4);
  }
  .sidebar {
    position: fixed; top: 56px; right: -360px;
    width: 340px; bottom: 0; z-index: 200;
    background: var(--surface); border-left: 1px solid var(--border);
    overflow-y: auto; transition: right 0.3s ease;
    display: flex; flex-direction: column;
  }
  .sidebar.open { right: 0; }

  .sidebar-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1rem 1.25rem; border-bottom: 1px solid var(--border);
    position: sticky; top: 0; background: var(--surface);
  }
  .sidebar-title { font-weight: 600; font-size: 0.875rem; color: var(--text2); }
  .close-btn {
    background: none; border: none; cursor: pointer;
    color: var(--text3); font-size: 1rem; padding: 0.25rem;
  }
  .sidebar-nav { padding: 0.5rem 0 2rem; }
  .sidebar-part { margin-bottom: 0.5rem; }
  .sidebar-part-header {
    padding: 0.5rem 1.25rem 0.25rem;
    font-size: 0.7rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .sidebar-link {
    display: flex; align-items: baseline; gap: 0.5rem;
    padding: 0.4rem 1.25rem;
    text-decoration: none; color: var(--text2);
    font-size: 0.875rem; transition: all 0.1s;
    border-left: 3px solid transparent;
  }
  .sidebar-link:hover { color: var(--text); background: var(--bg); }
  .sidebar-link.active { color: var(--accent); border-left-color: var(--accent); background: var(--bbg); }
  .ch-num { color: var(--text3); font-family: var(--font-mono); font-size: 0.75rem; min-width: 1.5rem; }

  /* ── Main ── */
  .main-content {
    min-height: calc(100vh - 56px - 48px);
    max-width: 960px; margin: 0 auto;
    padding: 2rem 1.5rem;
  }

  /* ── Footer ── */
  .site-footer {
    border-top: 1px solid var(--border);
    background: var(--surface);
  }
  .footer-inner {
    max-width: 1200px; margin: 0 auto;
    padding: 0.85rem 1.5rem;
    display: flex; align-items: center; gap: 0.5rem;
    font-size: 0.8rem; color: var(--text3);
    flex-wrap: wrap;
  }
  .footer-sep { opacity: 0.4; }
  .footer-inner a { color: var(--text3); }
  .footer-inner a:hover { color: var(--accent); }

  @media (max-width: 768px) {
    .nav-parts { display: none; }
  }
</style>
