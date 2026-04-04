<script lang="ts">
  import { base } from '$app/paths';
  export let moduleId: string;
  export let title: string;
  export let height: number = 640;

  // Legacy modules are served from the existing build at /Probability-education/src/modules/
  // In dev, they're at relative path ../../src/modules/ (served by the root Vite instance)
  // In production (GitHub Pages), they live at /Probability-education/src/modules/
  const src = `${base}/../src/modules/${moduleId}/index.html`;
</script>

<div class="sim-container">
  <div class="sim-header">
    <span class="sim-dot"></span>
    <span>{title}</span>
    <a class="sim-open" href="{src}" target="_blank" rel="noopener" title="Open in new tab">↗</a>
  </div>
  <iframe
    class="legacy-frame"
    {src}
    style="height: {height}px"
    title="{title} — Interactive Simulation"
    loading="lazy"
    sandbox="allow-scripts allow-same-origin"
  ></iframe>
</div>

<style>
  .sim-open {
    margin-left: auto;
    font-size: 0.75rem;
    color: var(--blue);
    text-decoration: none;
    padding: 0.1rem 0.3rem;
    border-radius: 4px;
    border: 1px solid var(--border);
  }
  .sim-open:hover { background: var(--bbg); }
</style>
