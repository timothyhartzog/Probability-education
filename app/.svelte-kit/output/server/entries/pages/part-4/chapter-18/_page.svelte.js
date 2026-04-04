import { h as head } from "../../../../chunks/root.js";
import { C as ChapterLayout } from "../../../../chunks/ChapterLayout.js";
import { L as LegacyModule } from "../../../../chunks/LegacyModule.js";
import { g as getChapter, b as getPrev, c as getNext } from "../../../../chunks/chapters.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const ch = getChapter(4, 18);
    head("1ne3mgf", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Chapter 18: Ergodic Theory | Probability Education</title>`);
      });
    });
    ChapterLayout($$renderer2, {
      ch,
      nextCh: getNext(ch),
      prevCh: getPrev(ch),
      children: ($$renderer3) => {
        $$renderer3.push(`<section class="ch-intro svelte-1ne3mgf"><p class="ch-lead svelte-1ne3mgf">Birkhoff's theorem, mixing, and KS entropy. This chapter covers: Ergodicity, Birkhoff's theorem, Mixing, KS entropy.</p></section> <div class="sim-note svelte-1ne3mgf"><span class="sim-note-icon svelte-1ne3mgf">📊</span> <div><strong>Interactive simulation below</strong> — this module is powered by the existing
    interactive visualization. Use the controls inside the panel to explore.</div></div> `);
        LegacyModule($$renderer3, {
          moduleId: "6.2-ergodic-mixing",
          title: "Ergodic Theory",
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
