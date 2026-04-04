import { k as fallback, f as escape_html, a as attr, d as attr_style, s as stringify, l as bind_props } from "./root.js";
import { b as base } from "./server.js";
import "./url.js";
import "@sveltejs/kit/internal/server";
/* empty css                                           */
function LegacyModule($$renderer, $$props) {
  let moduleId = $$props["moduleId"];
  let title = $$props["title"];
  let height = fallback($$props["height"], 640);
  const src = `${base}/../src/modules/${moduleId}/index.html`;
  $$renderer.push(`<div class="sim-container"><div class="sim-header"><span class="sim-dot"></span> <span>${escape_html(title)}</span> <a class="sim-open svelte-1fu8sih"${attr("href", src)} target="_blank" rel="noopener" title="Open in new tab">↗</a></div> <iframe class="legacy-frame"${attr("src", src)}${attr_style(`height: ${stringify(height)}px`)}${attr("title", `${stringify(title)} — Interactive Simulation`)} loading="lazy" sandbox="allow-scripts allow-same-origin"></iframe></div>`);
  bind_props($$props, { moduleId, title, height });
}
export {
  LegacyModule as L
};
