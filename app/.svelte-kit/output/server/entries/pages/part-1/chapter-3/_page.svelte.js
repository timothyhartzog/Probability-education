import { h as head, f as escape_html, a as attr, d as attr_style, b as attr_class, e as ensure_array_like, s as stringify } from "../../../../chunks/root.js";
import { C as ChapterLayout } from "../../../../chunks/ChapterLayout.js";
import { g as getChapter, b as getPrev, c as getNext } from "../../../../chunks/chapters.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let prev, sens, spec, tp, fp, fn, tn, ppv, npv, bProb;
    const ch = getChapter(1, 3);
    let prevalence = 1;
    let sensitivity = 95;
    let specificity = 90;
    let mhN = 1e3;
    let mhRunning = false;
    let bGroup = 23;
    function birthdayProb(n) {
      let p = 1;
      for (let i = 0; i < n; i++) p *= (365 - i) / 365;
      return 1 - p;
    }
    prev = prevalence / 100;
    sens = sensitivity / 100;
    spec = specificity / 100;
    tp = prev * sens;
    fp = (1 - prev) * (1 - spec);
    fn = prev * (1 - sens);
    tn = (1 - prev) * spec;
    ppv = tp / (tp + fp);
    npv = tn / (tn + fn);
    bProb = birthdayProb(bGroup);
    head("613cuq", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Chapter 3: Conditional Probability | Probability Education</title>`);
      });
    });
    ChapterLayout($$renderer2, {
      ch,
      nextCh: getNext(ch),
      prevCh: getPrev(ch),
      children: ($$renderer3) => {
        $$renderer3.push(`<section class="svelte-613cuq"><h2>3.1 Conditional Probability</h2> <p>Knowing that B occurred changes our probability for A. This updated probability is called the <strong>conditional probability</strong> of A given B:</p> <div class="math-block"><span id="eq-cond"></span></div> <p>Geometrically, conditioning on B reduces the sample space from Ω to B, then re-normalizes. The fraction of B that falls inside A is exactly P(A|B).</p></section> <section class="svelte-613cuq"><h2>3.2 Bayes' Theorem</h2> <p>The most important formula in probability. It tells us how to update beliefs when new evidence arrives:</p> <div class="math-block"><span id="eq-bayes"></span></div> <div class="sim-container"><div class="sim-header"><span class="sim-dot"></span>Bayes' Theorem — Natural Frequency Visualizer</div> <div class="bayes-body svelte-613cuq"><div class="bayes-controls svelte-613cuq"><label class="svelte-613cuq">Disease prevalence: <strong>${escape_html(prevalence)}%</strong> <input type="range" min="0.1" max="20" step="0.1"${attr("value", prevalence)} class="svelte-613cuq"/></label> <label class="svelte-613cuq">Test sensitivity: <strong>${escape_html(sensitivity)}%</strong> <input type="range" min="50" max="100" step="1"${attr("value", sensitivity)} class="svelte-613cuq"/></label> <label class="svelte-613cuq">Test specificity: <strong>${escape_html(specificity)}%</strong> <input type="range" min="50" max="100" step="1"${attr("value", specificity)} class="svelte-613cuq"/></label></div> <div class="bayes-square-wrap svelte-613cuq"><div class="freq-square" style="position:relative; width:200px; height:200px; border:2px solid var(--border); border-radius:8px; overflow:hidden;"><div${attr_style(`position:absolute; left:0; top:0; width:${stringify(prev * 100)}%; height:${stringify(sens * 100)}%; background:var(--green); opacity:0.8;`)} title="True Positive"></div> <div${attr_style(`position:absolute; left:0; top:${stringify(sens * 100)}%; width:${stringify(prev * 100)}%; height:${stringify((1 - sens) * 100)}%; background:var(--orange); opacity:0.6;`)} title="False Negative"></div> <div${attr_style(`position:absolute; left:${stringify(prev * 100)}%; top:0; width:${stringify((1 - prev) * 100)}%; height:${stringify((1 - spec) * 100)}%; background:var(--red); opacity:0.5;`)} title="False Positive"></div> <div${attr_style(`position:absolute; left:${stringify(prev * 100)}%; top:${stringify((1 - spec) * 100)}%; width:${stringify((1 - prev) * 100)}%; height:${stringify(spec * 100)}%; background:var(--bg); opacity:0.9;`)} title="True Negative"></div></div> <div class="sq-legend svelte-613cuq"><div class="sq-leg green svelte-613cuq">■ True Positive: ${escape_html((tp * 100).toFixed(2))}%</div> <div class="sq-leg orange svelte-613cuq">■ False Negative: ${escape_html((fn * 100).toFixed(2))}%</div> <div class="sq-leg red svelte-613cuq">■ False Positive: ${escape_html((fp * 100).toFixed(2))}%</div> <div class="sq-leg gray svelte-613cuq">■ True Negative: ${escape_html((tn * 100).toFixed(2))}%</div></div></div> <div class="bayes-results svelte-613cuq"><div class="bres-card svelte-613cuq" style="border-color:var(--green)"><div class="bres-label svelte-613cuq">PPV — P(Disease | Positive)</div> <div class="bres-val svelte-613cuq" style="color:var(--green)">${escape_html((ppv * 100).toFixed(1))}%</div></div> <div class="bres-card svelte-613cuq" style="border-color:var(--blue)"><div class="bres-label svelte-613cuq">NPV — P(No Disease | Negative)</div> <div class="bres-val svelte-613cuq" style="color:var(--blue)">${escape_html((npv * 100).toFixed(1))}%</div></div></div> <p class="bayes-note svelte-613cuq">⚠️ With only ${escape_html(prevalence)}% prevalence, even a ${escape_html(sensitivity)}%/${escape_html(specificity)}% test gives PPV = ${escape_html((ppv * 100).toFixed(1))}%. Low prevalence decimates positive predictive value — this is base rate neglect!</p></div></div></section> <section class="svelte-613cuq"><h2>3.3 Independence</h2> <p>Events A and B are <strong>independent</strong> if knowing B gives no information about A:</p> <div class="math-block"><span id="eq-indep"></span></div> <p>Independence ≠ mutual exclusivity. Mutually exclusive events (P(A∩B)=0) are almost always <em>dependent</em> — if A occurred, B definitely didn't!</p></section> <section class="svelte-613cuq"><h2>3.4 The Monty Hall Problem</h2> <p>You pick door 1. The host (who knows where the car is) opens another door revealing a goat. Should you switch? Bayes' theorem says: <strong>yes — switching wins with probability 2/3</strong>. The simulation below proves it empirically.</p> <div class="sim-container"><div class="sim-header"><span class="sim-dot"></span>Monty Hall Simulator</div> <div class="mh-body svelte-613cuq"><div class="mh-controls svelte-613cuq"><label class="svelte-613cuq">Number of games: <input type="range" min="100" max="10000" step="100"${attr("value", mhN)}${attr("disabled", mhRunning, true)} class="svelte-613cuq"/> <span class="param-val svelte-613cuq">${escape_html(mhN.toLocaleString())}</span></label> <button class="run-btn svelte-613cuq"${attr("disabled", mhRunning, true)}>${escape_html("▶ Run")}</button></div> `);
        {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<p class="mh-prompt svelte-613cuq">Click Run to simulate the Monty Hall problem</p>`);
        }
        $$renderer3.push(`<!--]--></div></div></section> <section class="svelte-613cuq"><h2>3.5 The Birthday Paradox</h2> <p>In a group of n people, what's the probability that at least two share a birthday? The answer surprises most people.</p> <div class="sim-container"><div class="sim-header"><span class="sim-dot"></span>Birthday Paradox Calculator</div> <div class="bday-body svelte-613cuq"><label class="svelte-613cuq">Group size n: <input type="range" min="2" max="80"${attr("value", bGroup)} class="svelte-613cuq"/> <span class="param-val svelte-613cuq">${escape_html(bGroup)}</span></label> <div${attr_class("bday-result svelte-613cuq", void 0, { "over50": bProb >= 0.5 })}><div class="bday-prob svelte-613cuq">${escape_html((bProb * 100).toFixed(2))}%</div> <div class="bday-label svelte-613cuq">probability of a shared birthday</div> `);
        if (bProb >= 0.5) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<div class="bday-note svelte-613cuq">✓ More likely than not in a group of just ${escape_html(bGroup)}!</div>`);
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<div class="bday-note svelte-613cuq">Need ${escape_html(23 - bGroup)} more people to exceed 50%</div>`);
        }
        $$renderer3.push(`<!--]--></div> <div class="bday-bars svelte-613cuq"><!--[-->`);
        const each_array = ensure_array_like([5, 10, 15, 20, 23, 30, 40, 50, 60, 70]);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let n = each_array[$$index];
          $$renderer3.push(`<div class="bday-row svelte-613cuq"><span class="bday-n svelte-613cuq">n=${escape_html(n)}</span> <div class="bday-track svelte-613cuq"><div class="bday-fill svelte-613cuq"${attr_style(`width:${stringify((birthdayProb(n) * 100).toFixed(1))}%; background:${stringify(birthdayProb(n) >= 0.5 ? "var(--green)" : "var(--blue)")}`)}></div></div> <span class="bday-pct svelte-613cuq">${escape_html((birthdayProb(n) * 100).toFixed(1))}%</span></div>`);
        }
        $$renderer3.push(`<!--]--></div></div></div></section>`);
      },
      $$slots: { default: true }
    });
  });
}
export {
  _page as default
};
