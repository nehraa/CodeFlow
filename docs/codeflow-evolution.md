# codeflow-evolution

Genetic algorithm for architecture evolution, plus an LLM-driven ghost node suggester. Given a base `BlueprintGraph`, evolve competing architecture variants (monolith, microservices, serverless) across multiple generations, rank them by a structural fitness function, and surface the winners. Separately, ask an LLM provider (OpenAI, Anthropic, NVIDIA, or local Ollama) what components the graph is missing.

## What it owns

- **Architecture variants.** `generateMonolithVariant`, `generateMicroservicesVariant`, `generateServerlessVariant` rewrite the base graph into each style.
- **Fitness scoring.** `benchmarkVariant` produces a 0–100 weighted score from four structural subscores.
- **GA loop.** `generateInitialPopulation`, `evolveArchitectures`, plus internal `crossover`, `mutate`, `selectSurvivors`, `rankVariants`.
- **Ghost nodes.** `suggestGhostNodes` + `runGhostNodes` invoke the configured LLM provider.
- **LLM providers.** OpenAI, Anthropic, NVIDIA, and Ollama implementations of the `GhostProvider` interface.
- **CLI.** `codeflow-evolution` with two subcommands: `ghost` and `evolve`.
- **HTTP route.** `POST /api/evolve` returns a `TournamentResult`.

## Subpath exports

| Subpath | Module |
| --- | --- |
| `.` | Barrel: GA functions, types, schemas, plus `getGhostProvider` / `suggestGhostNodes` re-exports. |
| `./ghost` | `getGhostProvider`, `suggestGhostNodes`, `GhostNode` / `BlueprintGraph` types. |
| `./providers` | `getGhostProvider` and the `GhostProvider` interface. |

## Public API

```typescript
import {
  generateInitialPopulation,
  evolveArchitectures,
  benchmarkVariant,
  BENCHMARK_WEIGHTS,
  TOURNAMENT_PROVENANCE,
  TOURNAMENT_MATURITY,
} from '@abhinav2203/codeflow-evolution';

import type {
  ArchitectureStyle,
  ArchitectureVariant,
  TournamentResult,
  VariantBenchmark,
  GhostNode,
} from '@abhinav2203/codeflow-evolution';

import { getGhostProvider, suggestGhostNodes } from '@abhinav2203/codeflow-evolution/ghost';
import type { GhostProvider } from '@abhinav2203/codeflow-evolution/providers';
```

## Key types

```typescript
type ArchitectureStyle = "monolith" | "microservices" | "serverless";

interface VariantBenchmark {
  scalability: number;         // 0–100
  estimatedCostScore: number;  // 0–100
  performance: number;         // 0–100
  maintainability: number;     // 0–100
  fitness: number;             // 0–100, weighted average
}

interface ArchitectureVariant {
  id: string;
  style: ArchitectureStyle;
  generation: number;
  graph: BlueprintGraph;
  benchmark: VariantBenchmark;
  provenance: "deterministic" | "ai" | "heuristic" | "simulated" | "observed";
  maturity: "production" | "preview" | "experimental" | "scaffold";
  rank: number;
}

interface TournamentResult {
  projectName: string;
  evolvedAt: string;
  provenance: OutputProvenance;
  maturity: FeatureMaturity;
  generationCount: number;
  populationSize: number;
  variants: ArchitectureVariant[];
  winnerId: string;
  summary: string;
}

interface GhostNode {
  id: string;
  kind: BlueprintNodeKind;
  name: string;
  summary: string;
  reason: string;
  provenance?: OutputProvenance;     // defaults to "heuristic"
  maturity?: FeatureMaturity;        // defaults to "preview"
  suggestedEdge?: {
    from: string;
    to: string;
    kind: BlueprintEdgeKind;
  };
}
```

## What an "individual" represents

An `ArchitectureVariant` — a full `BlueprintGraph` plus a benchmark, a `style` tag, a generation index, provenance, maturity, and a 1-based rank. Each individual is a *whole proposed architecture*, not a single node. The graph carries its own type contract (typed, edge-labeled, node-kind-tagged DAG).

## Initial population

`generateInitialPopulation(base, populationSize)` creates one variant per style by passing `base` to each generator:

- **`generateMonolithVariant`** — groups nodes by `kind`, builds one aggregate node per kind (e.g. `monolith:api`), remaps edges to the aggregates, drops self-loops and duplicates. The result is a smaller, denser graph where intra-group edges become implicit.
- **`generateMicroservicesVariant`** — turns every non-`ui-screen` node into a `svc:<id>` service with a paired `api:<id>` gateway, preserves ui-screens, and rewires edges as `api→api` "calls" (confidence 0.9) plus `ui-screen→api` "calls".
- **`generateServerlessVariant`** — wraps every node in a `fn:<id>` lambda and rewires edges: `calls` → `emits`, `imports` → `consumes`, others unchanged.

If `populationSize` exceeds 3, the function fills out the population by repeatedly calling `mutate` on the existing variants in a round-robin fashion. The result ranks by fitness descending. The minimum population is 3 (one per style) — smaller requests still produce 3.

## Fitness function

`benchmarkVariant(graph, style)` computes four 0–100 subscores from structural graph metrics only. No external AI calls. Per style, the algorithm applies a different base value, then nudges by density, edge-count ratio, average degree, leaf nodes, isolated nodes, and method-per-node averages:

| Subscore | Monolith | Microservices | Serverless | Modifier |
| --- | --- | --- | --- | --- |
| `scalability` | 40 | 70 | 80 | + (components/nodes) × 20 − density × 15 |
| `estimatedCostScore` | 80 | 55 | 45 | − min(edges/nodes, 5) × 3 |
| `performance` | 75 | 60 | 65 | − min(avgDegree × 2, 20) + leafNodes × 0.5 |
| `maintainability` | 55 | 75 | 70 | − density × 20 − isolatedNodes × 2 + avgMethodsPerNode × 0.5 |

`fitness` is the weighted average:

```typescript
const BENCHMARK_WEIGHTS = {
  scalability: 0.30,
  estimatedCostScore: 0.20,
  performance: 0.25,
  maintainability: 0.25,    // sums to 1.0
} as const;
```

Each value gets clamped to [0, 100] after rounding.

`★ Insight ─────────────────────────────────────`
The fitness function is deterministic and free of `Math.random()`. Re-running the same `BlueprintGraph` with the same `generations` and `populationSize` produces identical results. The GA is a *profiler* of structural trade-offs, not a stochastic optimizer.
`─────────────────────────────────────────────────`

## Selection, crossover, mutation

**Selection** is truncation. `selectSurvivors(variants, k)` returns the top `k` by fitness. Inside the generation loop, `k = max(2, floor(populationSize / 2))`. The bottom half is discarded.

**Crossover** (`crossover(a, b, generation, idx)`) takes all nodes from parent A and the edges of parent B that have both endpoints in A's node set, then adds any A-edges that aren't already there. The child inherits the style of the fitter parent, gets re-benchmarked, and is tagged `provenance = "heuristic"`, `maturity = "experimental"`. The id format is `variant-gen<N>-cross-<i>`.

**Mutation** (`mutate(variant, generation, idx)`) branches on `idx % 3`:

| `idx % 3` | Behavior |
| --- | --- |
| 0 | **Leaf pruning** — find the lowest-degree node (≤ 1), remove it and all incident edges. |
| 1 | **Lowest-confidence edge pruning** — sort edges by `confidence` ascending, drop the first. |
| 2 | **No-op** — same structure, re-benchmarked in the same style. Used to fill out the population. |

Mutations are deterministic given `idx` — no `Math.random()` anywhere.

## Termination

Fixed-generation. The loop runs exactly `options.generations` iterations (1 to N inclusive) and returns the final ranked population. There is no early stopping on fitness plateau, no convergence threshold, no max-time check.

## Main loop

```typescript
let population = generateInitialPopulation(base, populationSize);
for (let gen = 1; gen <= generations; gen++) {
  const survivors = selectSurvivors(population, max(2, floor(populationSize / 2)));
  const offspring: ArchitectureVariant[] = [];
  for (let i = 0; i < survivors.length - 1 && offspring.length < floor(populationSize / 2); i++) {
    offspring.push(crossover(survivors[i], survivors[i + 1], gen, i));
  }
  let mutIdx = 0;
  while (survivors.length + offspring.length < populationSize) {
    const source = survivors[mutIdx % survivors.length];
    offspring.push(mutate(source, gen, mutIdx));
    mutIdx++;
  }
  population = rankVariants([...survivors, ...offspring]);
}
const winner = rankVariants(population)[0];
```

The returned `TournamentResult` is always tagged `TOURNAMENT_PROVENANCE = "heuristic"` and `TOURNAMENT_MATURITY = "experimental"`. No AI involvement in the GA itself — only in the ghost-node subsystem.

## Ghost nodes

`getGhostProvider()` returns a `GhostProvider` based on the `GHOST_PROVIDER` env var (defaults to `openai`). All four implementations expose the same interface:

```typescript
type GhostProvider = {
  suggestGhostNodes(graph: BlueprintGraph): Promise<GhostNode[]>;
};
```

| Provider | Env vars | Endpoint | Model |
| --- | --- | --- | --- |
| OpenAI | `OPENAI_API_KEY` | `https://api.openai.com/v1/chat/completions` | `gpt-4o` |
| Anthropic | `ANTHROPIC_API_KEY` | `https://api.anthropic.com/v1/messages` | `claude-sonnet-4-20250514` |
| NVIDIA | `NVIDIA_API_KEY` | `https://integrate.api.nvidia.com/v1/chat/completions` | `nvidia/llama-4-mega` |
| Ollama | `OLLAMA_BASE_URL` (optional) | `${baseUrl}/api/chat` (default `http://localhost:11434`) | `llama3.2` |

All four use raw `fetch()`. There is no `openai` SDK, no `@anthropic-ai/sdk`, no streaming. The prompt is identical across providers — a request to return 1–3 ghost nodes as a JSON array with `id, kind, name, summary, reason, suggestedEdge`. Each provider strips optional ` ```json ``` ` fences before parsing. A missing key for the selected provider throws. An *unknown* `GHOST_PROVIDER` value falls through to OpenAI.

`★ Insight ─────────────────────────────────────`
Raw `fetch()` keeps the dependency surface tiny. The trade-off is that each provider hand-codes the response shape and JSON extraction. The seam is small enough that the four implementations are almost line-for-line identical, which is a deliberate choice — when the LLM API changes, you change one place.
`─────────────────────────────────────────────────`

## CLI

```
codeflow-evolution ghost <blueprint.json> [--provider openai|anthropic|nvidia|ollama]
codeflow-evolution evolve <blueprint.json> --generations <N> --population <M>
```

`ghost` prints a JSON array of suggestions to stdout. `evolve` prints a `TournamentResult` JSON. Both read a `BlueprintGraph` from disk and parse flags inline (no `commander` or `yargs`). `generations` defaults to 3, `populationSize` defaults to 6.

## HTTP route

`POST /api/evolve` accepts `{ graph, generations?, populationSize? }` and returns `{ result: TournamentResult }`. The route is a Next-style handler that the host app mounts under `app/api/evolve/route.ts`.

## File layout

```
codeflow-evolution/
├── package.json
├── tsconfig.json, tsconfig.build.json
├── vitest.config.ts
├── scripts/wrap-cli.mjs
├── test-fixtures/
│   ├── minimal-blueprint.json
│   └── sample-blueprint.json
└── src/
    ├── index.ts                    public barrel
    ├── schema.ts                   Zod schemas + inferred TS types
    ├── genetic.ts                  GA core (variants, fitness, crossover, mutation, loop)
    ├── genetic.test.ts             vitest unit tests
    ├── api/
    │   └── evolve/
    │       └── route.ts            POST /api/evolve
    ├── bin/
    │   └── cli.ts                  codeflow-evolution CLI
    ├── ghost/
    │   ├── index.ts                suggestGhostNodes
    │   ├── ghost-nodes.ts          runGhostNodes wrapper
    │   └── ghost-nodes.test.ts
    └── providers/
        ├── index.ts                getGhostProvider() factory + GhostProvider interface
        ├── openai.ts
        ├── anthropic.ts
        ├── nvidia.ts
        └── ollama.ts
```

## Limits and known gaps

- The GA has no early stopping and no convergence detection. If you need a fixed-time budget, cap generations manually.
- The fitness function is structural only. It will not catch semantic problems (e.g. two modules that should be merged).
- The four ghost-node providers throw on missing keys, but an unknown provider name falls through to OpenAI silently.
- `zod` is used throughout but does not appear in `package.json` `dependencies` — it is pulled in transitively via `@abhinav2203/codeflow-core`. This is a packaging quirk worth knowing about if you add new schemas.
