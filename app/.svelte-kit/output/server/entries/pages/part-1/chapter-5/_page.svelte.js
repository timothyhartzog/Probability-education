import { h as head } from "../../../../chunks/root.js";
import { C as ChapterLayout } from "../../../../chunks/ChapterLayout.js";
import "../../../../chunks/url.js";
import "@sveltejs/kit/internal/server";
/* empty css                                                            */
import { g as getChapter, b as getPrev, c as getNext } from "../../../../chunks/chapters.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const ch = getChapter(1, 5);
    head("f42lww", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Chapter 5: Continuous Random Variables | Probability Education</title>`);
      });
    });
    ChapterLayout($$renderer2, {
      ch,
      nextCh: getNext(ch),
      prevCh: getPrev(ch),
      children: ($$renderer3) => {
        $$renderer3.push(`<section class="ch-intro svelte-f42lww"><p class="ch-lead svelte-f42lww">PDFs, the Normal distribution, and the empirical rule. This chapter covers: PDF, CDF, Normal distribution, Exponential, and Z-scores.</p></section> <div class="coming-soon svelte-f42lww"><span class="cs-icon svelte-f42lww">🔬</span> <div><strong>New simulation coming soon</strong> Interactive D3.js + rust-sci-core WASM simulations for this chapter are under active development.</div></div>`);
      },
      $$slots: { default: true }
    });
  });
}
export {
  _page as default
};
