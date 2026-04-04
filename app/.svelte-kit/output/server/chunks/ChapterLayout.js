import { k as fallback, a as attr, f as escape_html, b as attr_class, s as stringify, e as ensure_array_like, i as slot, l as bind_props } from "./root.js";
import { b as base } from "./server.js";
import "./url.js";
import "@sveltejs/kit/internal/server";
import { d as difficultyClass, a as difficultyLabel } from "./chapters.js";
function ChapterLayout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let chapter = $$props["chapter"];
    let nextCh = fallback($$props["nextCh"], void 0);
    let prevCh = fallback($$props["prevCh"], void 0);
    $$renderer2.push(`<article class="chapter-page svelte-1gv465j"><nav class="breadcrumb svelte-1gv465j" aria-label="Breadcrumb"><a${attr("href", `${stringify(base)}/`)} class="svelte-1gv465j">Home</a> <span aria-hidden="true">›</span> <span>Part ${escape_html(chapter.part)}</span> <span aria-hidden="true">›</span> <span>Chapter ${escape_html(chapter.num)}</span></nav> <header class="ch-header svelte-1gv465j"><div class="ch-meta svelte-1gv465j"><span${attr_class(`badge ${stringify(difficultyClass(chapter.difficulty))}`, "svelte-1gv465j")}>${escape_html(difficultyLabel(chapter.difficulty))}</span> <span class="ch-time svelte-1gv465j">~${escape_html(chapter.minutes)} min</span></div> <h1 class="ch-title svelte-1gv465j"><span class="ch-num-label svelte-1gv465j">Chapter ${escape_html(chapter.num)}</span> ${escape_html(chapter.title)}</h1> <p class="ch-subtitle svelte-1gv465j">${escape_html(chapter.subtitle)}</p> <div class="ch-topics svelte-1gv465j"><!--[-->`);
    const each_array = ensure_array_like(chapter.topics);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let topic = each_array[$$index];
      $$renderer2.push(`<span class="topic-pill svelte-1gv465j">${escape_html(topic)}</span>`);
    }
    $$renderer2.push(`<!--]--></div></header> <div class="ch-body svelte-1gv465j"><!--[-->`);
    slot($$renderer2, $$props, "default", {});
    $$renderer2.push(`<!--]--></div> <nav class="ch-nav svelte-1gv465j" aria-label="Chapter navigation">`);
    if (prevCh) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<a${attr("href", `${stringify(base)}${stringify(prevCh.route)}`)} class="ch-nav-link prev svelte-1gv465j"><span class="ch-nav-dir svelte-1gv465j">← Previous</span> <span class="ch-nav-title svelte-1gv465j">Ch ${escape_html(prevCh.num)}: ${escape_html(prevCh.title)}</span></a>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div></div>`);
    }
    $$renderer2.push(`<!--]--> `);
    if (nextCh) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<a${attr("href", `${stringify(base)}${stringify(nextCh.route)}`)} class="ch-nav-link next svelte-1gv465j"><span class="ch-nav-dir svelte-1gv465j">Next →</span> <span class="ch-nav-title svelte-1gv465j">Ch ${escape_html(nextCh.num)}: ${escape_html(nextCh.title)}</span></a>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></nav></article>`);
    bind_props($$props, { chapter, nextCh, prevCh });
  });
}
export {
  ChapterLayout as C
};
