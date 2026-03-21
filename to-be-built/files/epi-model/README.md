# epi-model

**SEIR/SEIRD Epidemic Compartmental Model — Rust/WebAssembly**

Designed for the companion interactive application to *Epidemiology for Rural Healthcare Providers*. Implements high-performance, browser-deployable epidemic simulation compiled to WebAssembly.

---

## Models Implemented

| Model | Compartments | Use Case |
|-------|-------------|----------|
| **SEIRD (deterministic)** | S → E → I → R / D | Large populations, scenario planning, parameter sweep |
| **SEIR (stochastic)** | S → E → I → R | Small rural populations N < 50,000, extinction probability |

---

## Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install wasm-pack
cargo install wasm-pack
```

---

## Build

```bash
# Build for web (ES module output)
wasm-pack build --target web --release

# Output in pkg/:
#   epi_model_bg.wasm  — compiled WebAssembly binary
#   epi_model.js       — JavaScript bindings (ES module)
#   epi_model.d.ts     — TypeScript type definitions
#   package.json       — npm package descriptor
```

---

## Run Tests

```bash
cargo test
```

---

## API Reference

### `run_seird(params, days) → ModelResult`

Deterministic 4th-order Runge-Kutta integration of the SEIRD ODE system.

**Parameters** (JSON object):
```json
{
  "beta":  0.30,    // transmission rate (day⁻¹)
  "sigma": 0.20,    // E→I progression rate = 1/latent_days
  "gamma": 0.10,    // recovery rate = 1/infectious_days
  "mu":    0.01,    // case fatality fraction (0–1)
  "n":   10000.0    // total population
}
```

**Returns** `ModelResult`:
```typescript
{
  states: Array<{ s, e, i, r, d, day }>;  // daily compartment values
  r0: number;                              // β / γ
  peak_infected: number;                   // max I(t)
  peak_day: number;                        // day of peak
  final_attack_rate: number;               // (N − S_final) / N
  total_deaths: number;                    // D at end
}
```

### `run_stochastic_seir(params, days, seed) → number[]`

Gillespie direct method stochastic simulation. Returns daily I(t) values.
Appropriate when population N < 50,000 (rural counties).

### `compute_r0(beta, gamma) → number`

Returns β / γ.

### `herd_immunity_threshold(r0) → number`

Returns 1 − 1/R₀ (or 0 if R₀ ≤ 1).

### `effective_r(r0, susceptible_fraction) → number`

Returns R₀ × S/N — the current effective reproduction number.

---

## Integration with HTML Application

```html
<script type="module">
import init, { run_seird, herd_immunity_threshold } from './pkg/epi_model.js';

await init();  // loads the .wasm binary

const result = run_seird(
  { beta: 0.3, sigma: 0.2, gamma: 0.1, mu: 0.01, n: 12000 },
  365
);

console.log(`R₀: ${result.r0}`);
console.log(`Peak day: ${result.peak_day} (${Math.round(result.peak_infected)} infectious)`);
console.log(`Final attack rate: ${(result.final_attack_rate * 100).toFixed(1)}%`);
console.log(`Total deaths: ${Math.round(result.total_deaths)}`);
</script>
```

---

## Epidemiological Parameters — Quick Reference

| Pathogen | β | γ | σ | R₀ |
|---------|-----|-----|-----|-----|
| Measles | ~3.0 | 0.07 | 0.25 | ~15–18 |
| COVID-19 original | 0.25 | 0.10 | 0.20 | ~2.5 |
| COVID-19 Omicron | 1.0 | 0.10 | 0.33 | ~10 |
| Influenza seasonal | 0.20 | 0.20 | 0.50 | ~1.2 |
| Influenza H1N1 2009 | 0.30 | 0.20 | 0.33 | ~1.5 |
| Ebola | 0.20 | 0.10 | 0.14 | ~2.0 |

---

## Reference

Keeling MJ, Rohani P. *Modeling Infectious Diseases in Humans and Animals.* Princeton University Press; 2008.

Anderson RM, May RM. *Infectious Diseases of Humans: Dynamics and Control.* Oxford University Press; 1991.

van den Driessche P. Reproduction numbers of infectious disease models. *Infect Dis Model.* 2017;2(3):288-303.
