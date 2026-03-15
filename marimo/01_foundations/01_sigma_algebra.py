import marimo

app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import numpy as np
    import plotly.graph_objects as go
    import sys
    sys.path.insert(0, "..")
    from shared.plotting import VIZ_COLORS, DEFAULT_LAYOUT, styled_figure
    return mo, np, go, VIZ_COLORS, DEFAULT_LAYOUT, styled_figure


@app.cell
def _(mo):
    mo.md(r"""
    # 1.1 Sigma-Algebra Explorer

    A **$\sigma$-algebra** $\mathcal{F}$ on a sample space $\Omega$ is a collection of subsets satisfying:

    1. $\Omega \in \mathcal{F}$
    2. If $A \in \mathcal{F}$, then $A^c \in \mathcal{F}$ (closed under complements)
    3. If $A_1, A_2, \ldots \in \mathcal{F}$, then $\bigcup_{i=1}^{\infty} A_i \in \mathcal{F}$ (closed under countable unions)

    These axioms also imply closure under **countable intersections** (by De Morgan's laws)
    and that $\emptyset \in \mathcal{F}$.

    Use the controls below to explore how a $\sigma$-algebra is generated from a set of
    **generator subsets** on a finite sample space.
    """)
    return


@app.cell
def _(mo):
    omega_slider = mo.ui.slider(
        start=2, stop=5, step=1, value=3,
        label="Size of Ω",
    )
    mo.md(f"**Sample space size:** {omega_slider}")
    return (omega_slider,)


@app.cell
def _(omega_slider, mo):
    n = omega_slider.value
    elements = list(range(1, n + 1))
    # Generate all non-trivial, non-full subsets as potential generators
    all_subsets = []
    for mask in range(1, (1 << n) - 1):
        subset = frozenset(i + 1 for i in range(n) if mask & (1 << i))
        all_subsets.append(subset)

    # Create checkboxes for each possible generator subset
    subset_labels = {
        str(sorted(s)): s for s in all_subsets
    }
    generator_checkboxes = mo.ui.array(
        [mo.ui.checkbox(label=f"{{{', '.join(str(x) for x in sorted(s))}}}") for s in all_subsets],
    )
    mo.md(f"""
    **Select generator subsets** (from Ω = {{{', '.join(str(e) for e in elements)}}}):

    {mo.hstack(list(generator_checkboxes), wrap=True)}
    """)
    return n, elements, all_subsets, generator_checkboxes


@app.cell
def _(n, all_subsets, generator_checkboxes):
    def subset_to_mask(s, n_val):
        """Convert a frozenset to a bitmask."""
        mask = 0
        for elem in s:
            mask |= (1 << (elem - 1))
        return mask

    def mask_to_subset(mask, n_val):
        """Convert a bitmask to a frozenset."""
        return frozenset(i + 1 for i in range(n_val) if mask & (1 << i))

    def generate_sigma_algebra(generators, n_val):
        """Generate the smallest sigma-algebra containing the given generator sets."""
        full_mask = (1 << n_val) - 1
        # Start with empty set, Omega, and all generators
        sigma = {0, full_mask}
        for g in generators:
            sigma.add(subset_to_mask(g, n_val))

        # Close under complement, union, intersection until stable
        changed = True
        while changed:
            changed = False
            current = list(sigma)
            # Complements
            for m in current:
                comp = full_mask ^ m
                if comp not in sigma:
                    sigma.add(comp)
                    changed = True
            # Pairwise unions and intersections
            current = list(sigma)
            for i in range(len(current)):
                for j in range(i + 1, len(current)):
                    union = current[i] | current[j]
                    inter = current[i] & current[j]
                    if union not in sigma:
                        sigma.add(union)
                        changed = True
                    if inter not in sigma:
                        sigma.add(inter)
                        changed = True
        return sigma

    def find_atoms(sigma_masks, n_val):
        """Find atoms of the sigma-algebra (minimal non-empty elements)."""
        non_empty = sorted(m for m in sigma_masks if m != 0)
        atoms = []
        for m in non_empty:
            is_atom = True
            for m2 in non_empty:
                if m2 != m and (m2 & m) == m2:
                    is_atom = False
                    break
            if is_atom:
                atoms.append(m)
        return atoms

    # Collect selected generators
    selected_generators = []
    for i, s in enumerate(all_subsets):
        if generator_checkboxes.value[i]:
            selected_generators.append(s)

    sigma_alg = generate_sigma_algebra(selected_generators, n)
    atoms = find_atoms(sigma_alg, n)
    return (
        subset_to_mask, mask_to_subset, generate_sigma_algebra,
        find_atoms, selected_generators, sigma_alg, atoms,
    )


@app.cell
def _(mo, n, sigma_alg, atoms, mask_to_subset, selected_generators):
    def fmt_set(s):
        if not s:
            return "∅"
        return "{" + ", ".join(str(x) for x in sorted(s)) + "}"

    gen_str = ", ".join(fmt_set(g) for g in selected_generators) if selected_generators else "(none)"
    sigma_sets = sorted(sigma_alg)
    sigma_str = ", ".join(fmt_set(mask_to_subset(m, n)) for m in sigma_sets)
    atom_str = ", ".join(fmt_set(mask_to_subset(a, n)) for a in atoms)

    mo.md(rf"""
    ## Generated $\sigma$-Algebra

    **Generators:** $\{{{gen_str}\}}$

    **$\sigma(\text{{generators}})$** has **{len(sigma_alg)}** elements:

    $$\mathcal{{F}} = \big\{{{sigma_str}\big\}}$$

    **Atoms** (minimal non-empty elements forming the partition):

    $${atom_str}$$

    > On a finite space with $|\Omega| = {n}$, every $\sigma$-algebra is generated by
    > a unique partition into atoms. The $\sigma$-algebra consists of all unions of atoms,
    > giving $2^k$ elements where $k$ is the number of atoms (here $k = {len(atoms)}$,
    > so $|\mathcal{{F}}| = {2**len(atoms)}$).
    """)
    return (fmt_set,)


@app.cell
def _(go, VIZ_COLORS, DEFAULT_LAYOUT, n, sigma_alg, mask_to_subset, atoms):
    def build_hasse_diagram(sigma_masks, n_val):
        """Build a Hasse diagram of the sigma-algebra ordered by inclusion."""
        sorted_masks = sorted(sigma_masks, key=lambda m: bin(m).count('1'))

        # Assign levels by cardinality of the subset
        levels = {}
        for m in sorted_masks:
            levels[m] = bin(m).count('1')

        # Find covering relations (edges in Hasse diagram)
        edges = []
        for m1 in sorted_masks:
            for m2 in sorted_masks:
                if m1 != m2 and (m1 & m2) == m1 and bin(m2).count('1') == bin(m1).count('1') + 1:
                    # m1 is covered by m2 if no m3 exists between them
                    is_cover = True
                    for m3 in sorted_masks:
                        if m3 != m1 and m3 != m2 and (m1 & m3) == m1 and (m3 & m2) == m3:
                            is_cover = False
                            break
                    if is_cover:
                        edges.append((m1, m2))

        # Position nodes: x spread by rank within level, y by level
        level_groups = {}
        for m in sorted_masks:
            lv = levels[m]
            level_groups.setdefault(lv, []).append(m)

        positions = {}
        for lv, members in level_groups.items():
            count = len(members)
            for i, m in enumerate(members):
                x = (i - (count - 1) / 2) * 1.5
                positions[m] = (x, lv)

        return sorted_masks, edges, positions

    sorted_masks, edges, positions = build_hasse_diagram(sigma_alg, n)
    atom_set = set(atoms)

    fig = go.Figure()
    fig.update_layout(
        **DEFAULT_LAYOUT,
        title="Hasse Diagram (Inclusion Lattice)",
        height=500,
        showlegend=False,
        xaxis=dict(visible=False),
        yaxis=dict(visible=False),
    )

    # Draw edges
    for m1, m2 in edges:
        x0, y0 = positions[m1]
        x1, y1 = positions[m2]
        fig.add_trace(go.Scatter(
            x=[x0, x1, None], y=[y0, y1, None],
            mode='lines',
            line=dict(color='#94a3b8', width=1.5),
            hoverinfo='skip',
        ))

    # Draw nodes
    for m in sorted_masks:
        x, y = positions[m]
        s = mask_to_subset(m, n)
        label = "∅" if not s else "{" + ",".join(str(x_) for x_ in sorted(s)) + "}"
        color = VIZ_COLORS[3] if m in atom_set else (
            VIZ_COLORS[0] if m != 0 and m != (1 << n) - 1 else VIZ_COLORS[1]
        )
        fig.add_trace(go.Scatter(
            x=[x], y=[y],
            mode='markers+text',
            marker=dict(size=28, color=color, line=dict(width=2, color='white')),
            text=[label],
            textposition='middle center',
            textfont=dict(size=10, color='white'),
            hovertext=f"Subset: {label}<br>Bitmask: {bin(m)}",
            hoverinfo='text',
        ))

    fig
    return (fig,)


@app.cell
def _(mo, VIZ_COLORS):
    mo.md(rf"""
    ## Understanding the Lattice

    In the Hasse diagram above:
    - <span style="color:{VIZ_COLORS[1]}">**Orange**</span> nodes mark $\emptyset$ and $\Omega$
      (always present in any $\sigma$-algebra)
    - <span style="color:{VIZ_COLORS[3]}">**Purple**</span> nodes are the **atoms** — the
      minimal non-empty elements
    - <span style="color:{VIZ_COLORS[0]}">**Blue**</span> nodes are all other elements
    - An edge from $A$ to $B$ means $A \subset B$ with no element between them

    ### Key Properties

    | Property | Description |
    |----------|-------------|
    | **Trivial** $\sigma$-algebra | $\{{\emptyset, \Omega\}}$ — the coarsest |
    | **Power set** $2^\Omega$ | All subsets — the finest |
    | **Generated** $\sigma(\mathcal{{G}})$ | Smallest $\sigma$-algebra containing $\mathcal{{G}}$ |

    Try selecting different generator subsets to see how the $\sigma$-algebra changes!
    """)
    return


@app.cell
def _(mo):
    mo.md(r"""
    ---
    *Module 1.1 — Sigma-Algebra Explorer*
    *Probability Education Platform*
    """)
    return


if __name__ == "__main__":
    app.run()
