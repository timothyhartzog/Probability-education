<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { PARTS, CHAPTERS, difficultyClass, difficultyLabel } from '$lib/data/chapters';

  let heroCanvas: HTMLCanvasElement;
  let mounted = false;

  // Simple animated ball-drop (Galton board → Normal) using Canvas
  onMount(() => {
    mounted = true;
    const canvas = heroCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = 220;
    const BINS = 20;
    const counts = new Array(BINS).fill(0);
    let totalBalls = 0;
    const MAX_BALLS = 800;

    function dropBall() {
      if (totalBalls >= MAX_BALLS) return;
      let pos = BINS / 2;
      for (let i = 0; i < 10; i++) pos += Math.random() < 0.5 ? 0.5 : -0.5;
      const bin = Math.max(0, Math.min(BINS - 1, Math.round(pos)));
      counts[bin]++;
      totalBalls++;
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const maxCount = Math.max(...counts, 1);
      const binW = W / BINS;
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2563eb';
      const bbg    = getComputedStyle(document.documentElement).getPropertyValue('--bbg').trim() || '#eff6ff';

      for (let i = 0; i < BINS; i++) {
        const barH = (counts[i] / maxCount) * (H - 20);
        ctx.fillStyle = bbg;
        ctx.fillRect(i * binW + 1, H - barH, binW - 2, barH);
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(i * binW + 2, H - barH + 1, binW - 4, barH - 2);
        ctx.globalAlpha = 1;
      }

      // Normal curve overlay
      ctx.beginPath();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.5;
      const mu = (BINS - 1) / 2;
      const sig = BINS / 5;
      for (let x = 0; x < W; x++) {
        const bin = x / binW;
        const y = Math.exp(-0.5 * ((bin - mu) / sig) ** 2);
        const cy = H - y * (H - 20);
        x === 0 ? ctx.moveTo(x, cy) : ctx.lineTo(x, cy);
      }
      ctx.stroke();
    }

    let frame = 0;
    function loop() {
      for (let i = 0; i < 4; i++) dropBall();
      draw();
      if (totalBalls < MAX_BALLS) frame = requestAnimationFrame(loop);
      else { setTimeout(() => { counts.fill(0); totalBalls = 0; loop(); }, 2000); }
    }
    loop();
    return () => cancelAnimationFrame(frame);
  });

  const prereqs = [
    { part: 'Part I', label: 'High School', req: 'Algebra II', color: 'var(--green)' },
    { part: 'Part II', label: 'Undergrad', req: 'Calculus I–III', color: 'var(--blue)' },
    { part: 'Part III', label: 'Early Grad', req: 'Real Analysis + Measure Theory', color: 'var(--purple)' },
    { part: 'Parts IV–V', label: 'PhD', req: 'Graduate Analysis + Functional Analysis', color: 'var(--red)' }
  ];
</script>

<svelte:head>
  <title>Probability: Foundations to Research Frontiers</title>
  <meta name="description" content="An interactive probability textbook from coin flips to stochastic calculus. {CHAPTERS.length} chapters, hundreds of live D3 simulations." />
</svelte:head>

<!-- ── Hero ───────────────────────────────────────────────────── -->
<section class="hero">
  <div class="hero-text">
    <h1 class="hero-title">Probability</h1>
    <p class="hero-sub">Foundations to Research Frontiers</p>
    <p class="hero-desc">
      {CHAPTERS.length} chapters · Live D3 simulations · From coin flips to stochastic calculus
    </p>
    <div class="hero-cta">
      <a href="{base}/part-1/chapter-1" class="btn-primary">Start from the Beginning →</a>
      <a href="{base}/part-3/chapter-12" class="btn-ghost">Jump to Measure Theory</a>
    </div>
  </div>
  <div class="hero-viz">
    <canvas bind:this={heroCanvas} class="galton-canvas" aria-label="Animated Galton board showing Central Limit Theorem"></canvas>
    <p class="viz-label">Central Limit Theorem — {CHAPTERS.find(c=>c.num===10)?.title}</p>
  </div>
</section>

<!-- ── Prerequisites ──────────────────────────────────────────── -->
<section class="prereq-section">
  <h2 class="section-title">Prerequisites by Level</h2>
  <div class="prereq-grid">
    {#each prereqs as p}
      <div class="prereq-card" style="border-top: 3px solid {p.color}">
        <div class="prereq-part" style="color: {p.color}">{p.part}</div>
        <div class="prereq-level">{p.label}</div>
        <div class="prereq-req">{p.req}</div>
      </div>
    {/each}
  </div>
</section>

<!-- ── Chapter Grid ────────────────────────────────────────────── -->
<section class="chapter-section">
  <h2 class="section-title">All Chapters</h2>

  {#each PARTS as part}
    <div class="part-block">
      <div class="part-header" style="border-left: 4px solid {part.color}">
        <span class="part-label" style="color: {part.color}">Part {part.num}</span>
        <span class="part-title">{part.title}</span>
        <span class="part-sub">{part.subtitle}</span>
      </div>

      <div class="chapter-grid">
        {#each part.chapters as ch}
          <a href="{base}{ch.route}" class="chapter-card">
            <div class="ch-card-top">
              <span class="ch-card-num" style="color: {part.color}">Ch {ch.num}</span>
              <span class="badge {difficultyClass(ch.difficulty)}">{difficultyLabel(ch.difficulty)}</span>
            </div>
            <div class="ch-card-title">{ch.title}</div>
            <div class="ch-card-sub">{ch.subtitle}</div>
            <div class="ch-card-footer">
              <span class="ch-time">~{ch.minutes} min</span>
              {#if ch.hasNewSims}
                <span class="ch-sim-badge">🔬 Simulations</span>
              {/if}
              {#if ch.legacyModule}
                <span class="ch-sim-badge legacy">📊 Interactive</span>
              {/if}
            </div>
          </a>
        {/each}
      </div>
    </div>
  {/each}
</section>

<style>
  /* ── Hero ── */
  .hero {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    align-items: center;
    padding: 3rem 0 2rem;
  }
  .hero-title {
    font-size: clamp(2.5rem, 6vw, 4rem);
    margin: 0 0 0.1em;
    background: linear-gradient(135deg, var(--accent), var(--purple));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .hero-sub {
    font-family: var(--font-heading);
    font-size: clamp(1rem, 2.5vw, 1.5rem);
    color: var(--text2);
    margin: 0 0 0.75rem;
  }
  .hero-desc { color: var(--text3); margin: 0 0 1.5rem; font-size: 0.95rem; }
  .hero-cta { display: flex; gap: 0.75rem; flex-wrap: wrap; }

  .btn-primary {
    display: inline-block;
    background: var(--accent); color: #fff;
    padding: 0.65rem 1.25rem; border-radius: 8px;
    font-weight: 600; font-size: 0.95rem;
    text-decoration: none; transition: opacity 0.2s;
  }
  .btn-primary:hover { opacity: 0.9; text-decoration: none; }

  .btn-ghost {
    display: inline-block;
    border: 1px solid var(--border); color: var(--text2);
    padding: 0.65rem 1.25rem; border-radius: 8px;
    font-weight: 500; font-size: 0.95rem;
    text-decoration: none; transition: all 0.2s;
  }
  .btn-ghost:hover { border-color: var(--accent); color: var(--accent); text-decoration: none; }

  .hero-viz { text-align: center; }
  .galton-canvas {
    width: 100%; max-width: 420px; height: 220px;
    border-radius: 12px;
    background: var(--surface);
    border: 1px solid var(--border);
  }
  .viz-label { font-size: 0.75rem; color: var(--text3); margin-top: 0.5rem; }

  /* ── Prerequisites ── */
  .prereq-section { margin: 2rem 0; }
  .section-title {
    font-size: 1.4rem;
    color: var(--text);
    margin: 0 0 1rem;
  }
  .prereq-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }
  .prereq-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1rem;
  }
  .prereq-part { font-weight: 700; font-size: 0.8rem; margin-bottom: 0.2rem; }
  .prereq-level { font-size: 1rem; font-weight: 600; color: var(--text); }
  .prereq-req { font-size: 0.8rem; color: var(--text3); margin-top: 0.25rem; }

  /* ── Chapter Grid ── */
  .chapter-section { margin: 2rem 0; }
  .part-block { margin-bottom: 2.5rem; }
  .part-header {
    display: flex; align-items: baseline; gap: 0.75rem;
    padding: 0.5rem 1rem; margin-bottom: 1rem;
    background: var(--bg);
    border-radius: 0 8px 8px 0;
  }
  .part-label { font-weight: 700; font-size: 0.875rem; font-family: var(--font-mono); }
  .part-title { font-family: var(--font-heading); font-size: 1.1rem; }
  .part-sub { font-size: 0.8rem; color: var(--text3); }

  .chapter-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 0.75rem;
  }
  .chapter-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1rem;
    text-decoration: none;
    color: var(--text);
    display: flex; flex-direction: column; gap: 0.35rem;
    transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s;
  }
  .chapter-card:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.08);
    transform: translateY(-1px);
    border-color: var(--accent);
    text-decoration: none;
  }
  .ch-card-top { display: flex; align-items: center; justify-content: space-between; }
  .ch-card-num { font-family: var(--font-mono); font-size: 0.8rem; font-weight: 600; }
  .ch-card-title { font-weight: 600; font-size: 0.95rem; line-height: 1.3; }
  .ch-card-sub { font-size: 0.8rem; color: var(--text3); line-height: 1.4; flex: 1; }
  .ch-card-footer {
    display: flex; align-items: center; gap: 0.5rem;
    margin-top: 0.25rem;
  }
  .ch-time { font-size: 0.75rem; color: var(--text3); font-family: var(--font-mono); }
  .ch-sim-badge {
    font-size: 0.7rem; padding: 1px 6px;
    border-radius: 4px; background: var(--gbg); color: var(--green);
  }
  .ch-sim-badge.legacy { background: var(--bbg); color: var(--blue); }

  @media (max-width: 680px) {
    .hero { grid-template-columns: 1fr; }
    .hero-viz { order: -1; }
    .galton-canvas { max-width: 100%; }
    .part-header { flex-direction: column; gap: 0.2rem; }
  }
</style>
