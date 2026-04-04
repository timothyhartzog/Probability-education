import { h as head } from "../../../../chunks/root.js";
import { C as ChapterLayout } from "../../../../chunks/ChapterLayout.js";
import { L as LegacyModule } from "../../../../chunks/LegacyModule.js";
import { g as getChapter, b as getPrev, c as getNext } from "../../../../chunks/chapters.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const ch = getChapter(3, 14);
    head("dep8bk", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Chapter 14: Martingales | Probability Education</title>`);
      });
    });
    ChapterLayout($$renderer2, {
      ch,
      nextCh: getNext(ch),
      prevCh: getPrev(ch),
      children: ($$renderer3) => {
        $$renderer3.push(`<section class="ch-intro svelte-dep8bk"><p class="ch-lead svelte-dep8bk">Optional stopping, Doob's inequalities, and Azuma-Hoeffding. This chapter covers: Martingales, Optional stopping, Azuma-Hoeffding, McDiarmid.</p></section> <div class="sim-note svelte-dep8bk"><span class="sim-note-icon svelte-dep8bk">📊</span> <div><strong>Interactive simulation below</strong> — this module is powered by the existing
    interactive visualization. Use the controls inside the panel to explore.</div></div> `);
        LegacyModule($$renderer3, {
          moduleId: "4.2-martingale-explorer",
          title: "Martingales",
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
