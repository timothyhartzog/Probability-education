import { h as head, e as ensure_array_like, f as escape_html, a as attr, b as attr_class } from "../../../../chunks/root.js";
import "../../../../chunks/url.js";
import "@sveltejs/kit/internal/server";
import { C as ChapterLayout } from "../../../../chunks/ChapterLayout.js";
import { g as getChapter, b as getPrev, c as getNext } from "../../../../chunks/chapters.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let total, ax1ok, ax2ok, ax3ok;
    const ch = getChapter(1, 1);
    const next = getNext(ch);
    const prev = getPrev(ch);
    let flipN = 100;
    let flipResults = [];
    let flipping = false;
    let outcomes = [
      { name: "ω₁", p: 0.25 },
      { name: "ω₂", p: 0.25 },
      { name: "ω₃", p: 0.25 },
      { name: "ω₄", p: 0.25 }
    ];
    total = outcomes.reduce((s, o) => s + o.p, 0);
    ax1ok = outcomes.every((o) => o.p >= 0);
    ax2ok = Math.abs(total - 1) < 1e-3;
    ax3ok = ax1ok;
    head("njgxo", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Chapter 1: What Is Probability? | Probability Education</title>`);
      });
    });
    ChapterLayout($$renderer2, {
      ch,
      nextCh: next,
      prevCh: prev,
      children: ($$renderer3) => {
        $$renderer3.push(`<section class="svelte-njgxo"><h2 class="svelte-njgxo">1.1 The Nature of Uncertainty</h2> <p>Before we can calculate anything, we need to answer a deceptively simple question: <em>what is probability?</em> The word appears everywhere — weather forecasts give a
    "70% chance of rain," doctors quote survival rates, and casinos build entire businesses
    on it. But what does it actually mean to say an event has probability 0.7?</p> <p>Three great traditions have shaped the answer. The <strong>classical</strong> view,
    rooted in gambling and games of chance, defines probability by counting equally likely
    outcomes. The <strong>frequentist</strong> view says probability is the long-run relative
    frequency of an event over many identical trials. The <strong>Bayesian (subjective)</strong> view treats probability as a rational agent's degree of belief, updated via Bayes' theorem.
    All three coexist in modern probability, which is built on a single rigorous foundation —
    Kolmogorov's axioms.</p></section> <section class="svelte-njgxo"><h2 class="svelte-njgxo">1.2 Sample Spaces and Events</h2> <p>Every probability problem starts with an <strong>experiment</strong> — a process with
    uncertain outcomes. The <strong>sample space</strong> Ω is the set of all possible
    outcomes. An <strong>event</strong> is any subset A ⊆ Ω.</p> <div class="math-block"><span id="eq-ss"></span></div> <p>For a fair six-sided die: Ω = {1, 2, 3, 4, 5, 6}. The event "even number" is
    A = {2, 4, 6} ⊆ Ω. Events combine via set operations:
    union (A ∪ B), intersection (A ∩ B), and complement (Aᶜ = Ω \\ A).</p></section> <section class="svelte-njgxo"><h2 class="svelte-njgxo">1.3 Kolmogorov's Three Axioms</h2> <p>In 1933, Andrei Kolmogorov gave probability theory its rigorous foundation.
    A <strong>probability measure</strong> P on Ω is any function from events to [0, ∞)
    satisfying exactly three axioms:</p> <div class="math-block"><span id="eq-ax1"></span></div> <div class="math-block"><span id="eq-ax2"></span></div> <div class="math-block"><span id="eq-ax3"></span></div> <p>Everything else in probability — P(Aᶜ) = 1 − P(A), P(A ∪ B) = P(A) + P(B) − P(A ∩ B),
    monotonicity — follows from these three axioms alone.</p> <div class="sim-container"><div class="sim-header"><span class="sim-dot"></span> Kolmogorov Axiom Checker — Propose a Probability Function</div> <div class="axiom-checker svelte-njgxo"><div class="outcome-table"><div class="ot-head svelte-njgxo"><span>Outcome</span><span>P(ω)</span><span></span></div> <!--[-->`);
        const each_array = ensure_array_like(outcomes);
        for (let i = 0, $$length = each_array.length; i < $$length; i++) {
          let o = each_array[i];
          $$renderer3.push(`<div class="ot-row svelte-njgxo"><span class="ot-name svelte-njgxo">${escape_html(o.name)}</span> <input type="number" min="0" max="1" step="0.05"${attr("value", o.p)} class="ot-input svelte-njgxo"/> <button class="ot-del svelte-njgxo"${attr("disabled", outcomes.length <= 2, true)}>✕</button></div>`);
        }
        $$renderer3.push(`<!--]--> <div${attr_class("ot-row total svelte-njgxo", void 0, { "ok": ax2ok, "bad": !ax2ok })}><span>Total</span> <span class="total-val svelte-njgxo">${escape_html(total.toFixed(3))}</span> <span></span></div> <button class="add-outcome-btn svelte-njgxo"${attr("disabled", outcomes.length >= 6, true)}>+ Add outcome</button></div> <div class="axiom-status svelte-njgxo"><div${attr_class("axiom-row svelte-njgxo", void 0, { "ok": ax1ok, "bad": !ax1ok })}><span class="ax-icon svelte-njgxo">${escape_html(ax1ok ? "✓" : "✗")}</span> <div><strong>Axiom 1 — Non-negativity:</strong> P(A) ≥ 0 for all A <div class="ax-detail svelte-njgxo">${escape_html(ax1ok ? "All probabilities are ≥ 0" : "Some probability is negative!")}</div></div></div> <div${attr_class("axiom-row svelte-njgxo", void 0, { "ok": ax2ok, "bad": !ax2ok })}><span class="ax-icon svelte-njgxo">${escape_html(ax2ok ? "✓" : "✗")}</span> <div><strong>Axiom 2 — Normalization:</strong> P(Ω) = 1 <div class="ax-detail svelte-njgxo">Current total: ${escape_html(total.toFixed(4))} ${escape_html(ax2ok ? "✓" : "≠ 1")}</div></div></div> <div${attr_class("axiom-row svelte-njgxo", void 0, { "ok": ax3ok, "bad": !ax3ok })}><span class="ax-icon svelte-njgxo">${escape_html(ax3ok ? "✓" : "✗")}</span> <div><strong>Axiom 3 — Countable Additivity:</strong> P(A ∪ B) = P(A) + P(B) for disjoint A, B <div class="ax-detail svelte-njgxo">${escape_html(ax3ok ? "Follows from Axioms 1 & 2 for finite Ω" : "Violated")}</div></div></div> `);
        if (ax1ok && ax2ok && ax3ok) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<div class="valid-banner svelte-njgxo">✓ Valid probability measure!</div>`);
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<div class="invalid-banner svelte-njgxo">Adjust probabilities to satisfy all three axioms</div>`);
        }
        $$renderer3.push(`<!--]--></div></div></div></section> <section class="svelte-njgxo"><h2 class="svelte-njgxo">1.4 Frequentist Probability — The Long Run</h2> <p>The frequentist interpretation says: P(A) is the limit of the relative frequency of A
    over infinitely many independent trials. For a fair coin, P(Heads) = 0.5 because in
    the long run, exactly half the flips will be heads. But in the <em>short</em> run,
    anything can happen — and that tension is exactly what the Law of Large Numbers
    (Chapter 10) will make precise.</p> <div class="sim-container"><div class="sim-header"><span class="sim-dot"></span> Running Proportion of Heads — Frequentist Convergence</div> <div class="flip-controls svelte-njgxo"><label class="svelte-njgxo">Number of flips: <input type="range" min="50" max="5000" step="50"${attr("value", flipN)}${attr("disabled", flipping, true)} class="svelte-njgxo"/> <span class="param-val svelte-njgxo">${escape_html(flipN)}</span></label> <button class="run-btn svelte-njgxo"${attr("disabled", flipping, true)}>${escape_html("▶ Run Simulation")}</button></div> <div class="flip-chart-wrap svelte-njgxo"></div> `);
        if (flipResults.length > 0) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<div class="flip-stats svelte-njgxo">Final proportion: <strong>${escape_html(flipResults[flipResults.length - 1]?.toFixed(4))}</strong> · Deviation from 0.5: <strong>${escape_html(Math.abs((flipResults[flipResults.length - 1] ?? 0.5) - 0.5).toFixed(4))}</strong></div>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--></div></section> <section class="svelte-njgxo"><h2 class="svelte-njgxo">1.5 Derived Results from the Axioms</h2> <p>From just the three axioms, we can prove everything we'll ever need:</p> <ul class="result-list svelte-njgxo"><li class="svelte-njgxo"><strong>Complement rule:</strong> P(Aᶜ) = 1 − P(A)</li> <li class="svelte-njgxo"><strong>Impossible event:</strong> P(∅) = 0</li> <li class="svelte-njgxo"><strong>Monotonicity:</strong> A ⊆ B ⟹ P(A) ≤ P(B)</li> <li class="svelte-njgxo"><strong>Subadditivity:</strong> P(A ∪ B) ≤ P(A) + P(B)</li> <li class="svelte-njgxo"><strong>Addition rule:</strong> P(A ∪ B) = P(A) + P(B) − P(A ∩ B)</li></ul> <div class="math-block"><span id="eq-add"></span></div></section>`);
      },
      $$slots: { default: true }
    });
  });
}
export {
  _page as default
};
