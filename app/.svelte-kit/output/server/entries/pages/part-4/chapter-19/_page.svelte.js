import { h as head } from "../../../../chunks/root.js";
import { C as ChapterLayout } from "../../../../chunks/ChapterLayout.js";
import { L as LegacyModule } from "../../../../chunks/LegacyModule.js";
import { g as getChapter, b as getPrev, c as getNext } from "../../../../chunks/chapters.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const ch = getChapter(4, 19);
    head("1hraxng", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Chapter 19: Information Theory and Probability | Probability Education</title>`);
      });
    });
    ChapterLayout($$renderer2, {
      ch,
      nextCh: getNext(ch),
      prevCh: getPrev(ch),
      children: ($$renderer3) => {
        $$renderer3.push(`<section class="ch-intro svelte-1hraxng"><p class="ch-lead svelte-1hraxng">Entropy, KL divergence, and Fisher information. This chapter covers: Shannon entropy, KL divergence, Mutual information, Fisher information.</p></section> <div class="sim-note svelte-1hraxng"><span class="sim-note-icon svelte-1hraxng">📊</span> <div><strong>Interactive simulation below</strong> — this module is powered by the existing
    interactive visualization. Use the controls inside the panel to explore.</div></div> `);
        LegacyModule($$renderer3, {
          moduleId: "9.1-entropy-kl",
          title: "Information Theory and Probability",
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
