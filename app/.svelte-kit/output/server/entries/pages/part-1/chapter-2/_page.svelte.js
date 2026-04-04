import { h as head, a as attr, f as escape_html, e as ensure_array_like, b as attr_class, s as stringify } from "../../../../chunks/root.js";
import { C as ChapterLayout } from "../../../../chunks/ChapterLayout.js";
import { g as getChapter, b as getPrev, c as getNext } from "../../../../chunks/chapters.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let perm, comb, ieUnion, dn, dnProb;
    const ch = getChapter(1, 2);
    const ROWS = 12;
    let highlighted = { n: -1, r: -1 };
    function pascal(n, r) {
      if (r === 0 || r === n) return 1;
      if (r < 0 || r > n) return 0;
      let top = 1, bot = 1;
      for (let i = 0; i < Math.min(r, n - r); i++) {
        top *= n - i;
        bot *= i + 1;
      }
      return Math.round(top / bot);
    }
    const triangle = Array.from({ length: ROWS }, (_, n) => Array.from({ length: n + 1 }, (_2, r) => pascal(n, r)));
    function fmt(n) {
      return n >= 1e9 ? (n / 1e9).toFixed(1) + "B" : n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n.toLocaleString();
    }
    let calcN = 8;
    let calcR = 3;
    function fact(n) {
      let r = 1;
      for (let i = 2; i <= n; i++) r *= i;
      return r;
    }
    let ieA = 30;
    let ieB = 25;
    let ieC = 20;
    let ieAB = 10;
    let ieAC = 8;
    let ieBC = 9;
    let ieABC = 4;
    let derangeN = 4;
    function derangement(n) {
      if (n === 0) return 1;
      if (n === 1) return 0;
      return (n - 1) * (derangement(n - 1) + derangement(n - 2));
    }
    perm = fact(calcN) / fact(calcN - calcR);
    comb = fact(calcN) / (fact(calcR) * fact(calcN - calcR));
    ieUnion = ieA + ieB + ieC - ieAB - ieAC - ieBC + ieABC;
    dn = derangement(derangeN);
    dnProb = dn / fact(derangeN);
    head("r3cxiv", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Chapter 2: Counting and Combinatorics | Probability Education</title>`);
      });
    });
    ChapterLayout($$renderer2, {
      ch,
      nextCh: getNext(ch),
      prevCh: getPrev(ch),
      children: ($$renderer3) => {
        $$renderer3.push(`<section class="svelte-r3cxiv"><h2>2.1 Why Counting Matters</h2> <p>For equally likely outcomes, P(A) = |A| / |Ω|. So computing probabilities reduces to counting. This chapter builds the complete toolkit: the fundamental counting principle, permutations, combinations, and inclusion-exclusion.</p></section> <section class="svelte-r3cxiv"><h2>2.2 Permutations and Combinations</h2> <p>A <strong>permutation</strong> P(n,r) counts ordered selections of r items from n. A <strong>combination</strong> C(n,r) counts unordered selections — order doesn't matter.</p> <div class="math-block"><span id="eq-perm"></span></div> <div class="math-block"><span id="eq-comb"></span></div> <div class="sim-container"><div class="sim-header"><span class="sim-dot"></span>Permutation &amp; Combination Calculator</div> <div class="calc-body svelte-r3cxiv"><div class="calc-controls svelte-r3cxiv"><label class="svelte-r3cxiv">n (total items) <input type="range" min="1" max="20"${attr("value", calcN)} class="svelte-r3cxiv"/> <span class="param-val svelte-r3cxiv">${escape_html(calcN)}</span></label> <label class="svelte-r3cxiv">r (choosing) <input type="range" min="0"${attr("max", calcN)}${attr("value", calcR)} class="svelte-r3cxiv"/> <span class="param-val svelte-r3cxiv">${escape_html(calcR)}</span></label></div> <div class="calc-results svelte-r3cxiv"><div class="calc-card blue svelte-r3cxiv"><div class="calc-label svelte-r3cxiv">P(${escape_html(calcN)},${escape_html(calcR)}) — Permutations</div> <div class="calc-val svelte-r3cxiv">${escape_html(perm.toLocaleString())}</div> <div class="calc-sub svelte-r3cxiv">Ordered · ${escape_html(calcN)}! / (${escape_html(calcN - calcR)})!</div></div> <div class="calc-card purple svelte-r3cxiv"><div class="calc-label svelte-r3cxiv">C(${escape_html(calcN)},${escape_html(calcR)}) — Combinations</div> <div class="calc-val svelte-r3cxiv">${escape_html(comb.toLocaleString())}</div> <div class="calc-sub svelte-r3cxiv">Unordered · ${escape_html(calcN)}! / (${escape_html(calcR)}!×${escape_html(calcN - calcR)}!)</div></div> <div class="calc-card green svelte-r3cxiv"><div class="calc-label svelte-r3cxiv">Ratio P/C</div> <div class="calc-val svelte-r3cxiv">${escape_html(fact(calcR).toLocaleString())}</div> <div class="calc-sub svelte-r3cxiv">= r! = ${escape_html(calcR)}! arrangements</div></div></div></div></div></section> <section class="svelte-r3cxiv"><h2>2.3 Pascal's Triangle</h2> <p>Pascal's Triangle displays every binomial coefficient C(n,r). Row n gives the coefficients of (x+y)ⁿ. Hover any entry to see its value and formula.</p> <div class="sim-container"><div class="sim-header"><span class="sim-dot"></span>Interactive Pascal's Triangle — hover to explore</div> <div class="pascal-wrap svelte-r3cxiv"><div class="pascal svelte-r3cxiv"><!--[-->`);
        const each_array = ensure_array_like(triangle);
        for (let n = 0, $$length = each_array.length; n < $$length; n++) {
          let row = each_array[n];
          $$renderer3.push(`<div class="pascal-row svelte-r3cxiv"><!--[-->`);
          const each_array_1 = ensure_array_like(row);
          for (let r = 0, $$length2 = each_array_1.length; r < $$length2; r++) {
            let val = each_array_1[r];
            $$renderer3.push(`<button${attr_class("pascal-cell svelte-r3cxiv", void 0, {
              "active": highlighted.n === n && highlighted.r === r,
              "highlight-row": highlighted.n === n
            })}${attr("title", `C(${stringify(n)},${stringify(r)}) = ${stringify(fmt(val))}`)}>${escape_html(fmt(val))}</button>`);
          }
          $$renderer3.push(`<!--]--></div>`);
        }
        $$renderer3.push(`<!--]--></div> `);
        {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<div class="pascal-info muted svelte-r3cxiv">Hover over a cell to see its value and position</div>`);
        }
        $$renderer3.push(`<!--]--></div></div></section> <section class="svelte-r3cxiv"><h2>2.4 The Inclusion-Exclusion Principle</h2> <p>For three events A, B, C (not necessarily disjoint), the size of the union is:</p> <div class="math-block"><span id="eq-ie"></span></div> <div class="sim-container"><div class="sim-header"><span class="sim-dot"></span>Inclusion-Exclusion Calculator</div> <div class="ie-body svelte-r3cxiv"><div class="ie-controls svelte-r3cxiv"><!--[-->`);
        const each_array_2 = ensure_array_like([
          ["ieA", "|A|", ieA],
          ["ieB", "|B|", ieB],
          ["ieC", "|C|", ieC],
          ["ieAB", "|A∩B|", ieAB],
          ["ieAC", "|A∩C|", ieAC],
          ["ieBC", "|B∩C|", ieBC],
          ["ieABC", "|A∩B∩C|", ieABC]
        ]);
        for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
          let [key, label, val] = each_array_2[$$index_2];
          $$renderer3.push(`<label class="svelte-r3cxiv">${escape_html(label)} <input type="number" min="0" max="100"${attr("value", val)} class="ie-input svelte-r3cxiv"/></label>`);
        }
        $$renderer3.push(`<!--]--></div> <div class="ie-result svelte-r3cxiv"><div class="ie-steps svelte-r3cxiv"><div>|A| + |B| + |C| = <strong>${escape_html(ieA + ieB + ieC)}</strong></div> <div>− |A∩B| − |A∩C| − |B∩C| = <strong>− ${escape_html(ieAB + ieAC + ieBC)}</strong></div> <div>+ |A∩B∩C| = <strong>+ ${escape_html(ieABC)}</strong></div></div> <div class="ie-answer svelte-r3cxiv">|A ∪ B ∪ C| = <strong>${escape_html(ieUnion)}</strong></div></div></div></div></section> <section class="svelte-r3cxiv"><h2>2.5 Derangements</h2> <p>A <strong>derangement</strong> is a permutation where no element appears in its original position — like a secret Santa where nobody gets their own name. The count D_n satisfies:</p> <div class="math-block"><span id="eq-der"></span></div> <div class="sim-container"><div class="sim-header"><span class="sim-dot"></span>Derangement Calculator</div> <div class="der-body svelte-r3cxiv"><label class="svelte-r3cxiv">n items: <input type="range" min="1" max="10"${attr("value", derangeN)} class="svelte-r3cxiv"/> <span class="param-val svelte-r3cxiv">${escape_html(derangeN)}</span></label> <div class="der-results svelte-r3cxiv"><div class="der-stat svelte-r3cxiv"><span class="der-label svelte-r3cxiv">n!</span><span class="der-val svelte-r3cxiv">${escape_html(fact(derangeN).toLocaleString())}</span></div> <div class="der-stat svelte-r3cxiv"><span class="der-label svelte-r3cxiv">D_${escape_html(derangeN)}</span><span class="der-val svelte-r3cxiv">${escape_html(dn.toLocaleString())}</span></div> <div class="der-stat svelte-r3cxiv"><span class="der-label svelte-r3cxiv">P(derangement)</span><span class="der-val svelte-r3cxiv">${escape_html(dnProb.toFixed(6))}</span></div> <div class="der-stat svelte-r3cxiv"><span class="der-label svelte-r3cxiv">≈ 1/e</span><span class="der-val svelte-r3cxiv">${escape_html((1 / Math.E).toFixed(6))}</span></div></div> <p class="der-note svelte-r3cxiv">As n → ∞, the probability of a random permutation being a derangement converges to 1/e ≈ 0.3679 — remarkably, independent of n!</p></div></div></section>`);
      },
      $$slots: { default: true }
    });
  });
}
export {
  _page as default
};
