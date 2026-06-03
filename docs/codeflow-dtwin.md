# codeflow-dtwin

Digital twin simulation engine. Rolls trace spans into a point-in-time snapshot of which nodes are active, groups spans into user flows, synthesizes "what-if" trace spans for planned runs, and overlays active-node state back onto the graph for visualization.

## What it owns

- **Snapshot computation.** `computeDigitalTwinSnapshot` derives active nodes and user flows from a graph + trace spans over a rolling time window.
- **User-flow grouping.** `buildUserFlows` buckets spans by `traceId`, sorts each bucket chronologically, and computes worst-case status.
- **Span synthesis.** `buildSimulationSpans` produces a single `UserFlow`-shaped sequence of synthetic trace spans for an ordered list of node ids.
- **Active-node overlay.** `overlayActiveNodes` marks a graph's active nodes with `traceState.status = "success"` (without downgrading an existing `error`).
- **Store-backed API helpers.** `getDigitalTwin` (read) and `simulateAction` (write) wrap the engine with `codeflow-store` reads and observability merges.
- **CLI.** `codeflow-dtwin` with four subcommands.

## Subpath exports

| Subpath | Module |
| --- | --- |
| `.` | `buildUserFlows`, `computeDigitalTwinSnapshot`, `buildSimulationSpans`, `overlayActiveNodes`, `idleTraceState`, and the type set. |
| `./simulate` | The `simulateAction` handler plus the `SimulateRequest` / `SimulateResponse` types. |

The CLI binary `codeflow-dtwin` ships under `bin/`.

## Public API

```typescript
import {
  buildUserFlows,
  computeDigitalTwinSnapshot,
  buildSimulationSpans,
  overlayActiveNodes,
  idleTraceState,
} from '@abhinav2203/codeflow-dtwin';

import type {
  BlueprintGraph,
  TraceSpan,
  UserFlow,
  DigitalTwinSnapshot,
  NodeTraceState,
  SimulationResult,
} from '@abhinav2203/codeflow-dtwin';
```

`★ Insight ─────────────────────────────────────`
The engine is a pure compute layer. The four core functions take a graph and spans in, return data out, and never touch the filesystem. I/O lives in `api/route.ts` (store reads + observability merges) and the CLI (file reads). The split keeps the math testable in isolation.
`─────────────────────────────────────────────────`

## Key types

```typescript
type OutputProvenance =
  | "deterministic" | "ai" | "heuristic" | "simulated" | "observed";

interface NodeTraceState {
  status: "idle" | "success" | "warning" | "error";
  count: number;
  errors: number;
  totalDurationMs: number;
  lastSpanIds: string[];
}

interface DigitalTwinSnapshot {
  projectName: string;
  computedAt: string;                    // ISO timestamp
  maturity: "production" | "preview" | "experimental" | "scaffold";
  activeNodeIds: string[];
  flows: UserFlow[];
  observedSpanCount: number;
  simulatedSpanCount: number;
  observedFlowCount: number;
  simulatedFlowCount: number;
  activeWindowSecs: number;
}

interface SimulationConfig {
  iterations: number;
  activeWindowSecs?: number;
}

interface SimulationResult {
  snapshot: DigitalTwinSnapshot;
  spans: TraceSpan[];
  flows: UserFlow[];
}
```

`UserFlow` and `TraceSpan` come from `codeflow-core`. `UserFlow` carries a worst-case `status`, summed `totalDurationMs`, and a `provenance` resolved by majority vote over its member spans.

## The engine

### `computeDigitalTwinSnapshot(graph, spans, activeWindowSecs = 60)`

Walks every span and keeps its resolved blueprint node id if the span's `timestamp` falls within `activeWindowSecs * 1000` ms of `Date.now()`. Spans without a timestamp count as always active (an intentional fallback for stored snapshots and tests). The active set deduplicates in first-seen order.

The returned snapshot also tallies observed vs simulated flow counts and the `activeWindowSecs` used for the computation, so the consumer can reconstruct what window produced these numbers.

### `buildUserFlows(graph, spans)`

Buckets spans by `traceId`. Within each bucket it sorts timestamped spans first (insertion order for the rest), walks the sequence, dedupes `nodeIds` in traversal order, and picks a worst-case status from the priority `success=1, warning=2, error=3`. `provenance` resolves by majority vote in the order `observed > simulated > deterministic > heuristic > ai`. The final list sorts most-recent first by `startedAt`.

### `buildSimulationSpans(graph, nodeIds, label = "Simulated flow", runtime = "simulation")`

Synthesizes a single trace for a planned run. Every span gets a shared `traceId = "sim-" + Date.now()`, `status: "success"`, `durationMs: 1`, `provenance: "simulated"`, and a `timestamp` that steps +10 ms per node. Unknown node ids drop out silently.

### `overlayActiveNodes(graph, activeNodeIds)`

Returns a shallow-cloned graph whose matching nodes get `traceState = { ...(existing or default), status: "success" }`. An existing `error` or `warning` status survives; the overlay never downgrades a real signal. Nodes outside the active set stay untouched.

`★ Insight ─────────────────────────────────────`
The "never downgrade" rule on `overlayActiveNodes` is the load-bearing detail. The digital twin reflects what the system *says* is active, but it does not paper over failure. A node that errored in the last window stays red even if it's in the active set.
`─────────────────────────────────────────────────`

### `idleTraceState()`

Factory for an empty `NodeTraceState`. Use it when initializing a node that has not yet been touched by a span.

## API helpers

### `getDigitalTwin(projectName, activeWindowSecs = 60)`

Parallel-loads `loadObservabilitySnapshot(projectName)` and `loadLatestSession(projectName)` from `codeflow-store`, then returns:

```typescript
interface DigitalTwinResponse {
  snapshot: DigitalTwinSnapshot | null;
  graph: BlueprintGraph | null;          // return type of overlayActiveNodes
  activeWindowSecs: number;
}
```

If no session exists, `snapshot` and `graph` come back `null`. Mount this in a Next.js `app/api/dtwin/route.ts` as a `GET` handler that reads `?projectName=...&window=...` from the query string.

### `simulateAction(request: SimulateRequest)`

Loads the latest session, generates synthetic spans, persists them via `mergeObservabilitySnapshot({ projectName, spans, logs: [], graph })`, and returns:

```typescript
interface SimulateResponse extends SimulationResult {
  latestSpans: TraceSpan[];              // last 100 merged spans
  latestLogs: unknown[];
}
```

Throws `"No session found for project: <name>"` if the project has no session on disk.

## CLI

```
codeflow-dtwin simulate <blueprint.json> [trace-data.json]
codeflow-dtwin snapshot <blueprint.json> [--trace-latest]
codeflow-dtwin active-nodes <blueprint.json> [trace-data.json]
codeflow-dtwin build-flows <blueprint.json> <trace-data.json>
```

The CLI is built on `node:util`'s `parseArgs`. Global flags: `--help`, `--trace-latest`, `--iterations <n>`, `--json`.

`simulate` reads a blueprint, picks the first 5 nodes, and calls `buildSimulationSpans` + `computeDigitalTwinSnapshot` with the default 60-second window. `snapshot` runs the snapshot with empty spans. `active-nodes` prints the comma-separated active node ids. `build-flows` prints one line per flow with span count and status.

## Constants worth knowing

| Constant | Value | Why |
| --- | --- | --- |
| Default `activeWindowSecs` | 60 | Rolling window for the "active" calculation. |
| `worstStatus` priority | `success=1, warning=2, error=3` | A flow's status is the worst of its spans. |
| Simulation span stride | 10 ms | Spans within a synthesized flow step +10 ms each. |
| Simulation `durationMs` | 1 | Synthetic spans run "instantly". |
| Provenance priority | `observed > simulated > deterministic > heuristic > ai` | Order in which `buildUserFlows` picks the majority. |

## Build quirk

Like `codeflow-execution`, the build script uses `tsc --build` and `scripts/wrap-cli.mjs` re-injects the shebang into `dist/bin/cli.js` (TSC strips it from source). The published output mirrors `src/` exactly so subpath exports resolve to the right files.

## File layout

```
codeflow-dtwin/
├── package.json
├── tsconfig.json, tsconfig.build.json
├── vitest.config.ts
├── scripts/wrap-cli.mjs
└── src/
    ├── index.ts                       barrel
    ├── types.ts                       local types + idleTraceState / emptyContract factories
    ├── digital-twin.ts                engine: buildUserFlows, computeDigitalTwinSnapshot, buildSimulationSpans, overlayActiveNodes
    ├── digital-twin.test.ts           vitest unit tests
    ├── api/
    │   ├── route.ts                   getDigitalTwin() + DigitalTwinResponse
    │   └── simulate/
    │       └── route.ts               simulateAction() + SimulateRequest/Response
    └── bin/
        └── cli.ts                     simulate | snapshot | active-nodes | build-flows
```

## Limits and known gaps

- The CLI's `simulate` command always picks the first 5 nodes. For targeted runs use `simulateAction` from `./simulate`.
- The default 60-second window is hard-coded at the call site, not derived from project config. Pass a custom value at the API boundary.
- The `--iterations` global flag is parsed but not used by any current subcommand. It exists as a forward-looking knob.
- `codeflow-execution` is declared as a dependency but not yet imported anywhere in `src/`. The seam is reserved for future expansion.
