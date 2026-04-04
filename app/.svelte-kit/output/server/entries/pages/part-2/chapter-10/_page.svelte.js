import { h as head } from "../../../../chunks/root.js";
import { C as ChapterLayout } from "../../../../chunks/ChapterLayout.js";
import { L as LegacyModule } from "../../../../chunks/LegacyModule.js";
import { g as getChapter, b as getPrev, c as getNext } from "../../../../chunks/chapters.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const ch = getChapter(2, 10);
    head("pkqqpl", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Chapter 10: Limit Theorems | Probability Education</title>`);
      });
    });
    ChapterLayout($$renderer2, {
      ch,
      nextCh: getNext(ch),
      prevCh: getPrev(ch),
      children: ($$renderer3) => {
        $$renderer3.push(`<section class="ch-intro svelte-pkqqpl"><p class="ch-lead svelte-pkqqpl">LLN, CLT, concentration inequalities, and large deviations. This chapter covers: WLLN, SLLN, CLT, Chebyshev, and Chernoff, Berry-Esseen.</p></section> <div class="sim-note svelte-pkqqpl"><span class="sim-note-icon svelte-pkqqpl">📊</span> <div><strong>Interactive simulation below</strong> — this module is powered by the existing
    interactive visualization. Use the controls inside the panel to explore.</div></div> `);
        LegacyModule($$renderer3, {
          moduleId: "2.3-lln-lab",
          title: "Limit Theorems",
          height: 700
        });
        $$renderer3.push(`<!---->`);
      },
      $$slots: { default: true }
    });
  });
}
export {
  _page as default
};
