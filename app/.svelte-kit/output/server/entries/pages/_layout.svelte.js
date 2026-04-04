import { g as getContext, h as head, a as attr, e as ensure_array_like, s as stringify, b as attr_class, c as store_get, d as attr_style, f as escape_html, i as slot, u as unsubscribe_stores } from "../../chunks/root.js";
import "clsx";
import "@sveltejs/kit/internal";
import "../../chunks/url.js";
import "../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../chunks/exports.js";
import "../../chunks/state.svelte.js";
import { b as base } from "../../chunks/server.js";
import { P as PARTS, C as CHAPTERS } from "../../chunks/chapters.js";
const getStores = () => {
  const stores$1 = getContext("__svelte__");
  return {
    /** @type {typeof page} */
    page: {
      subscribe: stores$1.page.subscribe
    },
    /** @type {typeof navigating} */
    navigating: {
      subscribe: stores$1.navigating.subscribe
    },
    /** @type {typeof updated} */
    updated: stores$1.updated
  };
};
const page = {
  subscribe(fn) {
    const store = getStores().page;
    return store.subscribe(fn);
  }
};
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let menuOpen = false;
    let theme = "light";
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme") ?? "light";
      theme = saved;
      document.documentElement.setAttribute("data-theme", saved);
    }
    head("12qhfyh", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Probability: Foundations to Research Frontiers</title>`);
      });
    });
    $$renderer2.push(`<a class="skip-link svelte-12qhfyh" href="#main">Skip to content</a> <nav class="topnav svelte-12qhfyh" aria-label="Main navigation"><div class="nav-inner svelte-12qhfyh"><a class="nav-brand svelte-12qhfyh"${attr("href", `${stringify(base)}/`)}><span class="nav-pi svelte-12qhfyh">π</span> <span class="nav-title svelte-12qhfyh">Probability</span></a> <ul class="nav-parts svelte-12qhfyh" role="list"><!--[-->`);
    const each_array = ensure_array_like(PARTS);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let part = each_array[$$index];
      $$renderer2.push(`<li><a${attr("href", `${stringify(base)}/part-${stringify(part.num)}/chapter-${stringify(part.chapters[0].num)}`)}${attr_class("nav-part-link svelte-12qhfyh", void 0, {
        "active": store_get($$store_subs ??= {}, "$page", page).url.pathname.includes(`/part-${part.num}/`)
      })}${attr_style(`--part-color: ${stringify(part.color)}`)}>Part ${escape_html(part.num)}</a></li>`);
    }
    $$renderer2.push(`<!--]--> <li><a${attr("href", `${stringify(base)}/appendix/distributions`)}${attr_class("nav-part-link svelte-12qhfyh", void 0, {
      "active": store_get($$store_subs ??= {}, "$page", page).url.pathname.includes("/appendix/")
    })}>Reference</a></li></ul> <div class="nav-actions svelte-12qhfyh"><button class="theme-btn svelte-12qhfyh" aria-label="Toggle dark mode">${escape_html(theme === "light" ? "🌙" : "☀️")}</button> <button class="menu-btn svelte-12qhfyh"${attr("aria-expanded", menuOpen)} aria-label="Toggle chapter menu"><span${attr_class("ham svelte-12qhfyh", void 0, { "open": menuOpen })}></span></button></div></div></nav> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <aside${attr_class("sidebar svelte-12qhfyh", void 0, { "open": menuOpen })} aria-label="Chapter navigation"><div class="sidebar-header svelte-12qhfyh"><span class="sidebar-title svelte-12qhfyh">Chapters</span> <button class="close-btn svelte-12qhfyh" aria-label="Close">✕</button></div> <nav class="sidebar-nav svelte-12qhfyh"><!--[-->`);
    const each_array_1 = ensure_array_like(PARTS);
    for (let $$index_2 = 0, $$length = each_array_1.length; $$index_2 < $$length; $$index_2++) {
      let part = each_array_1[$$index_2];
      $$renderer2.push(`<div class="sidebar-part svelte-12qhfyh"><div class="sidebar-part-header svelte-12qhfyh"${attr_style(`color: ${stringify(part.color)}`)}>Part ${escape_html(part.num)} — ${escape_html(part.title)}</div> <!--[-->`);
      const each_array_2 = ensure_array_like(part.chapters);
      for (let $$index_1 = 0, $$length2 = each_array_2.length; $$index_1 < $$length2; $$index_1++) {
        let ch = each_array_2[$$index_1];
        $$renderer2.push(`<a${attr("href", `${stringify(base)}${stringify(ch.route)}`)}${attr_class("sidebar-link svelte-12qhfyh", void 0, {
          "active": store_get($$store_subs ??= {}, "$page", page).url.pathname === ch.route || store_get($$store_subs ??= {}, "$page", page).url.pathname.startsWith(ch.route + "/")
        })}><span class="ch-num svelte-12qhfyh">${escape_html(ch.num)}</span> <span class="ch-title">${escape_html(ch.title)}</span></a>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></nav></aside> <main id="main" class="main-content svelte-12qhfyh"><!--[-->`);
    slot($$renderer2, $$props, "default", {});
    $$renderer2.push(`<!--]--></main> <footer class="site-footer svelte-12qhfyh"><div class="footer-inner svelte-12qhfyh"><span>Probability Education Platform v2</span> <span class="footer-sep svelte-12qhfyh">·</span> <span>SvelteKit + D3.js 7.8.5</span> <span class="footer-sep svelte-12qhfyh">·</span> <a href="https://github.com/timothyhartzog/Probability-education" target="_blank" rel="noopener" class="svelte-12qhfyh">GitHub ↗</a> <span class="footer-sep svelte-12qhfyh">·</span> <span>${escape_html(CHAPTERS.length)} chapters</span></div></footer>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _layout as default
};
