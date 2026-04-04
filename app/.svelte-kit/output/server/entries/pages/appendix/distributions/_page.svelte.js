import { h as head, a as attr, e as ensure_array_like, b as attr_class, f as escape_html, s as stringify } from "../../../../chunks/root.js";
import { b as base } from "../../../../chunks/server.js";
import "../../../../chunks/url.js";
import "@sveltejs/kit/internal/server";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let filtered;
    const dists = [
      {
        name: "Bernoulli(p)",
        type: "discrete",
        params: "p ∈ [0,1]",
        support: "{0,1}",
        mean: "p",
        variance: "p(1−p)",
        mgf: "1−p+pe^t",
        chapter: 4,
        part: 1
      },
      {
        name: "Binomial(n,p)",
        type: "discrete",
        params: "n∈ℕ, p∈[0,1]",
        support: "{0,…,n}",
        mean: "np",
        variance: "np(1−p)",
        mgf: "(1−p+pe^t)ⁿ",
        chapter: 4,
        part: 1
      },
      {
        name: "Geometric(p)",
        type: "discrete",
        params: "p∈(0,1]",
        support: "{1,2,…}",
        mean: "1/p",
        variance: "(1−p)/p²",
        mgf: "pe^t/(1−(1−p)e^t)",
        chapter: 4,
        part: 1
      },
      {
        name: "Negative Binomial(r,p)",
        type: "discrete",
        params: "r∈ℕ, p∈(0,1]",
        support: "{r,r+1,…}",
        mean: "r/p",
        variance: "r(1−p)/p²",
        mgf: "(pe^t/(1−(1−p)e^t))^r",
        chapter: 4,
        part: 1
      },
      {
        name: "Poisson(λ)",
        type: "discrete",
        params: "λ > 0",
        support: "{0,1,2,…}",
        mean: "λ",
        variance: "λ",
        mgf: "exp(λ(e^t−1))",
        chapter: 4,
        part: 1
      },
      {
        name: "Hypergeometric(N,K,n)",
        type: "discrete",
        params: "N,K,n∈ℕ",
        support: "{max(0,n+K−N),…,min(n,K)}",
        mean: "nK/N",
        variance: "nK(N−K)(N−n)/N²(N−1)",
        mgf: "—",
        chapter: 4,
        part: 1
      },
      {
        name: "Uniform(a,b)",
        type: "continuous",
        params: "a<b",
        support: "[a,b]",
        mean: "(a+b)/2",
        variance: "(b−a)²/12",
        mgf: "(e^(tb)−e^(ta))/(t(b−a))",
        chapter: 5,
        part: 1
      },
      {
        name: "Exponential(λ)",
        type: "continuous",
        params: "λ > 0",
        support: "[0,∞)",
        mean: "1/λ",
        variance: "1/λ²",
        mgf: "λ/(λ−t), t<λ",
        chapter: 5,
        part: 1
      },
      {
        name: "Normal(μ,σ²)",
        type: "continuous",
        params: "μ∈ℝ, σ²>0",
        support: "(−∞,∞)",
        mean: "μ",
        variance: "σ²",
        mgf: "exp(μt + σ²t²/2)",
        chapter: 5,
        part: 1
      },
      {
        name: "Gamma(α,β)",
        type: "continuous",
        params: "α,β > 0",
        support: "(0,∞)",
        mean: "α/β",
        variance: "α/β²",
        mgf: "(β/(β−t))^α, t<β",
        chapter: 5,
        part: 1
      },
      {
        name: "Beta(α,β)",
        type: "continuous",
        params: "α,β > 0",
        support: "[0,1]",
        mean: "α/(α+β)",
        variance: "αβ/((α+β)²(α+β+1))",
        mgf: "—",
        chapter: 5,
        part: 1
      },
      {
        name: "Cauchy(x₀,γ)",
        type: "continuous",
        params: "x₀∈ℝ, γ>0",
        support: "(−∞,∞)",
        mean: "undefined",
        variance: "undefined",
        mgf: "undefined",
        chapter: 7,
        part: 2
      },
      {
        name: "Student-t(ν)",
        type: "continuous",
        params: "ν > 0 (dof)",
        support: "(−∞,∞)",
        mean: "0 (ν>1)",
        variance: "ν/(ν−2) (ν>2)",
        mgf: "undefined",
        chapter: 7,
        part: 2
      },
      {
        name: "Chi-squared(k)",
        type: "continuous",
        params: "k∈ℕ (dof)",
        support: "[0,∞)",
        mean: "k",
        variance: "2k",
        mgf: "(1−2t)^(−k/2), t<½",
        chapter: 7,
        part: 2
      },
      {
        name: "Log-Normal(μ,σ²)",
        type: "continuous",
        params: "μ∈ℝ, σ²>0",
        support: "(0,∞)",
        mean: "e^(μ+σ²/2)",
        variance: "(e^σ²−1)e^(2μ+σ²)",
        mgf: "—",
        chapter: 8,
        part: 2
      },
      {
        name: "Pareto(α,xₘ)",
        type: "continuous",
        params: "α>0, xₘ>0",
        support: "[xₘ,∞)",
        mean: "αxₘ/(α−1) (α>1)",
        variance: "xₘ²α/((α−1)²(α−2)) (α>2)",
        mgf: "undefined",
        chapter: 8,
        part: 2
      }
    ];
    let filter = "all";
    let search = "";
    filtered = dists.filter((d) => search === "");
    head("d9or7u", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Distribution Reference | Probability Education</title>`);
      });
    });
    $$renderer2.push(`<div class="appendix-page svelte-d9or7u"><h1 class="svelte-d9or7u">Distribution Reference</h1> <p class="lead svelte-d9or7u">Complete reference for all named probability distributions in this textbook. Click a distribution name to jump to the chapter where it is introduced.</p> <div class="toolbar svelte-d9or7u"><input class="search-input svelte-d9or7u" type="search" placeholder="Search distributions…"${attr("value", search)}/> <div class="filter-tabs svelte-d9or7u"><!--[-->`);
    const each_array = ensure_array_like(["all", "discrete", "continuous"]);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let f = each_array[$$index];
      $$renderer2.push(`<button${attr_class("ftab svelte-d9or7u", void 0, { "active": filter === f })}>${escape_html(f.charAt(0).toUpperCase() + f.slice(1))}</button>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="dist-table-wrap svelte-d9or7u"><table class="dist-table svelte-d9or7u"><thead><tr><th class="svelte-d9or7u">Distribution</th><th class="svelte-d9or7u">Type</th><th class="svelte-d9or7u">Parameters</th><th class="svelte-d9or7u">Support</th><th class="svelte-d9or7u">Mean</th><th class="svelte-d9or7u">Variance</th><th class="svelte-d9or7u">MGF</th><th class="svelte-d9or7u">Chapter</th></tr></thead><tbody><!--[-->`);
    const each_array_1 = ensure_array_like(filtered);
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let d = each_array_1[$$index_1];
      $$renderer2.push(`<tr class="svelte-d9or7u"><td class="dist-name svelte-d9or7u"><a${attr("href", `${stringify(base)}/part-${stringify(d.part)}/chapter-${stringify(d.chapter)}`)} class="svelte-d9or7u">${escape_html(d.name)}</a></td><td class="svelte-d9or7u"><span${attr_class(`badge ${stringify(d.type === "discrete" ? "badge-hs" : "badge-ug")}`)}>${escape_html(d.type)}</span></td><td class="mono svelte-d9or7u">${escape_html(d.params)}</td><td class="mono svelte-d9or7u">${escape_html(d.support)}</td><td class="mono svelte-d9or7u">${escape_html(d.mean)}</td><td class="mono svelte-d9or7u">${escape_html(d.variance)}</td><td class="mono small svelte-d9or7u">${escape_html(d.mgf)}</td><td class="svelte-d9or7u"><a${attr("href", `${stringify(base)}/part-${stringify(d.part)}/chapter-${stringify(d.chapter)}`)} class="ch-link svelte-d9or7u">Ch ${escape_html(d.chapter)}</a></td></tr>`);
    }
    $$renderer2.push(`<!--]--></tbody></table></div> `);
    if (filtered.length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="no-results svelte-d9or7u">No distributions match your search.</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
