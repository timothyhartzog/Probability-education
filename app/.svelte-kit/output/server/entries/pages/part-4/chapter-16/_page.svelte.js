import { h as head } from "../../../../chunks/root.js";
import { C as ChapterLayout } from "../../../../chunks/ChapterLayout.js";
import { L as LegacyModule } from "../../../../chunks/LegacyModule.js";
import { g as getChapter, b as getPrev, c as getNext } from "../../../../chunks/chapters.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const ch = getChapter(4, 16);
    head("egvhyd", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Chapter 16: Stochastic Calculus | Probability Education</title>`);
      });
    });
    ChapterLayout($$renderer2, {
      ch,
      nextCh: getNext(ch),
      prevCh: getPrev(ch),
      children: ($$renderer3) => {
        $$renderer3.push(`<section class="ch-intro svelte-egvhyd"><p class="ch-lead svelte-egvhyd">Itô integral, SDEs, Girsanov's theorem, and Feynman-Kac. This chapter covers: Itô integral, Itô's formula, SDEs, Girsanov, and Feynman-Kac.</p></section> <div class="sim-note svelte-egvhyd"><span class="sim-note-icon svelte-egvhyd">📊</span> <div><strong>Interactive simulation below</strong> — this module is powered by the existing
    interactive visualization. Use the controls inside the panel to explore.</div></div> `);
        LegacyModule($$renderer3, {
          moduleId: "7.1-ito-integral",
          title: "Stochastic Calculus",
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
