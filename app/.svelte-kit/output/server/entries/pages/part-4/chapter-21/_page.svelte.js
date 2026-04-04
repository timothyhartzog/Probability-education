import { h as head } from "../../../../chunks/root.js";
import { C as ChapterLayout } from "../../../../chunks/ChapterLayout.js";
import "../../../../chunks/url.js";
import "@sveltejs/kit/internal/server";
/* empty css                                                            */
import { g as getChapter, b as getPrev, c as getNext } from "../../../../chunks/chapters.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const ch = getChapter(4, 21);
    head("18wbwfr", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Chapter 21: Random Matrices | Probability Education</title>`);
      });
    });
    ChapterLayout($$renderer2, {
      ch,
      nextCh: getNext(ch),
      prevCh: getPrev(ch),
      children: ($$renderer3) => {
        $$renderer3.push(`<section class="ch-intro svelte-18wbwfr"><p class="ch-lead svelte-18wbwfr">Wigner semicircle, Marchenko-Pastur, and universality. This chapter covers: GOE/GUE, Wigner semicircle, Marchenko-Pastur, Tracy-Widom.</p></section> <div class="coming-soon svelte-18wbwfr"><span class="cs-icon svelte-18wbwfr">🔬</span> <div><strong>New simulation coming soon</strong> Interactive D3.js + rust-sci-core WASM simulations for this chapter are under active development.</div></div>`);
      },
      $$slots: { default: true }
    });
  });
}
export {
  _page as default
};
