import { h as head, f as escape_html, a as attr, e as ensure_array_like, d as attr_style, s as stringify, b as attr_class } from "../../chunks/root.js";
import { b as base } from "../../chunks/server.js";
import "../../chunks/url.js";
import "@sveltejs/kit/internal/server";
import { C as CHAPTERS, d as difficultyClass, a as difficultyLabel, P as PARTS } from "../../chunks/chapters.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const prereqs = [
      {
        part: "Part I",
        label: "High School",
        req: "Algebra II",
        color: "var(--green)"
      },
      {
        part: "Part II",
        label: "Undergrad",
        req: "Calculus I–III",
        color: "var(--blue)"
      },
      {
        part: "Part III",
        label: "Early Grad",
        req: "Real Analysis + Measure Theory",
        color: "var(--purple)"
      },
      {
        part: "Parts IV–V",
        label: "PhD",
        req: "Graduate Analysis + Functional Analysis",
        color: "var(--red)"
      }
    ];
    head("1uha8ag", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Probability: Foundations to Research Frontiers</title>`);
      });
      $$renderer3.push(`<meta name="description"${attr("content", `An interactive probability textbook from coin flips to stochastic calculus. ${stringify(CHAPTERS.length)} chapters, hundreds of live D3 simulations.`)}/>`);
    });
    $$renderer2.push(`<section class="hero svelte-1uha8ag"><div class="hero-text"><h1 class="hero-title svelte-1uha8ag">Probability</h1> <p class="hero-sub svelte-1uha8ag">Foundations to Research Frontiers</p> <p class="hero-desc svelte-1uha8ag">${escape_html(CHAPTERS.length)} chapters · Live D3 simulations · From coin flips to stochastic calculus</p> <div class="hero-cta svelte-1uha8ag"><a${attr("href", `${stringify(base)}/part-1/chapter-1`)} class="btn-primary svelte-1uha8ag">Start from the Beginning →</a> <a${attr("href", `${stringify(base)}/part-3/chapter-12`)} class="btn-ghost svelte-1uha8ag">Jump to Measure Theory</a></div></div> <div class="hero-viz svelte-1uha8ag"><canvas class="galton-canvas svelte-1uha8ag" aria-label="Animated Galton board showing Central Limit Theorem"></canvas> <p class="viz-label svelte-1uha8ag">Central Limit Theorem — ${escape_html(CHAPTERS.find((c) => c.num === 10)?.title)}</p></div></section> <section class="prereq-section svelte-1uha8ag"><h2 class="section-title svelte-1uha8ag">Prerequisites by Level</h2> <div class="prereq-grid svelte-1uha8ag"><!--[-->`);
    const each_array = ensure_array_like(prereqs);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let p = each_array[$$index];
      $$renderer2.push(`<div class="prereq-card svelte-1uha8ag"${attr_style(`border-top: 3px solid ${stringify(p.color)}`)}><div class="prereq-part svelte-1uha8ag"${attr_style(`color: ${stringify(p.color)}`)}>${escape_html(p.part)}</div> <div class="prereq-level svelte-1uha8ag">${escape_html(p.label)}</div> <div class="prereq-req svelte-1uha8ag">${escape_html(p.req)}</div></div>`);
    }
    $$renderer2.push(`<!--]--></div></section> <section class="chapter-section svelte-1uha8ag"><h2 class="section-title svelte-1uha8ag">All Chapters</h2> <!--[-->`);
    const each_array_1 = ensure_array_like(PARTS);
    for (let $$index_2 = 0, $$length = each_array_1.length; $$index_2 < $$length; $$index_2++) {
      let part = each_array_1[$$index_2];
      $$renderer2.push(`<div class="part-block svelte-1uha8ag"><div class="part-header svelte-1uha8ag"${attr_style(`border-left: 4px solid ${stringify(part.color)}`)}><span class="part-label svelte-1uha8ag"${attr_style(`color: ${stringify(part.color)}`)}>Part ${escape_html(part.num)}</span> <span class="part-title svelte-1uha8ag">${escape_html(part.title)}</span> <span class="part-sub svelte-1uha8ag">${escape_html(part.subtitle)}</span></div> <div class="chapter-grid svelte-1uha8ag"><!--[-->`);
      const each_array_2 = ensure_array_like(part.chapters);
      for (let $$index_1 = 0, $$length2 = each_array_2.length; $$index_1 < $$length2; $$index_1++) {
        let ch = each_array_2[$$index_1];
        $$renderer2.push(`<a${attr("href", `${stringify(base)}${stringify(ch.route)}`)} class="chapter-card svelte-1uha8ag"><div class="ch-card-top svelte-1uha8ag"><span class="ch-card-num svelte-1uha8ag"${attr_style(`color: ${stringify(part.color)}`)}>Ch ${escape_html(ch.num)}</span> <span${attr_class(`badge ${stringify(difficultyClass(ch.difficulty))}`, "svelte-1uha8ag")}>${escape_html(difficultyLabel(ch.difficulty))}</span></div> <div class="ch-card-title svelte-1uha8ag">${escape_html(ch.title)}</div> <div class="ch-card-sub svelte-1uha8ag">${escape_html(ch.subtitle)}</div> <div class="ch-card-footer svelte-1uha8ag"><span class="ch-time svelte-1uha8ag">~${escape_html(ch.minutes)} min</span> `);
        if (ch.hasNewSims) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="ch-sim-badge svelte-1uha8ag">🔬 Simulations</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (ch.legacyModule) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="ch-sim-badge legacy svelte-1uha8ag">📊 Interactive</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div></a>`);
      }
      $$renderer2.push(`<!--]--></div></div>`);
    }
    $$renderer2.push(`<!--]--></section>`);
  });
}
export {
  _page as default
};
