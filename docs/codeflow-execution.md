# codeflow-execution

Runtime execution engine for `BlueprintGraph`. Walks a graph in topological batches, runs each task in an isolated TypeScript workspace, captures trace spans, exports to Mermaid, and isolates runs in sandboxes. The bridge between the static graph and the live runtime.

## Version

`1.0.0`. Stable.

## Public API

Seventeen subpath exports, each a focused module:

```
@abhinav2203/codeflow-execution                  (barrel)
@abhinav2203/codeflow-execution/plan              (createRunPlan, topological batching)
@abhinav2203/codeflow-execution/phases            (withSpecDrafts, placeholder skeletons)
@abhinav2203/codeflow-execution/execute           (runBlueprint, runtime contracts)
@abhinav2203/codeflow-execution/vcr               (buildVcrRecording, scrub bar)
@abhinav2203/codeflow-execution/mermaid           (graphToMermaid, diagram export)
@abhinav2203/codeflow-execution/sandbox           (createSandboxDir, writeDiffManifest)
@abhinav2203/codeflow-execution/runner            (createExecutionReport)
@abhinav2203/codeflow-execution/runtime-contracts (input validation, output serialization)
@abhinav2203/codeflow-execution/runtime-tests     (generated test cases)
@abhinav2203/codeflow-execution/runtime-workspace (the orchestrator)
@abhinav2203/codeflow-execution/runtime-workspace-local (local variant)
@abhinav2203/codeflow-execution/utils             (shared helpers)
@abhinav2203/codeflow-execution/heatmap           (per-node execution heatmap)
@abhinav2203/codeflow-execution/ghostnodes        (synthesized shadow nodes)
@abhinav2203/codeflow-execution/execution-span    (span model)
@abhinav2203/codeflow-execution/node-state-timeline (cumulative state across time)
@abhinav2203/codeflow-execution/sandbox-diff      (sandbox-vs-target diff)
@abhinav2203/codeflow-execution/error-localization (pinpoint errors to nodes)
```

CLI: `codeflow-execution` binary at `dist/bin/cli.js`.

## The Pipeline

A typical run follows five steps:

```
BlueprintGraph
    |
    v
[plan.ts] createRunPlan(graph) ──> RunPlan (topological batches)
    |
    v
[phases.ts] withSpecDrafts(graph) ──> graph with placeholder code
    |
    v
[execute.ts / runtime-workspace.ts] runBlueprint(graph, options)
    |  for each batch:
    |    for each task:
    |      validate inputs, run code, capture spans, validate outputs
    |
    v
[runner.ts] createExecutionReport(graph, runPlan) ──> ExecutionReport
    |
    v
[vcr.ts] buildVcrRecording(graph, spans) ──> VcrRecording
    |
    v
[mermaid.ts] graphToMermaid(graph) ──> Mermaid source string
```

## Plan Generation

`createRunPlan(graph): RunPlan` walks the graph's edges and groups nodes into topological batches. A node in batch `N` can only depend on nodes in batches `< N`.

```typescript
type RunPlan = {
  batches: ExecutionBatch[];
  warnings: string[];
  totalTasks: number;
};

type ExecutionBatch = {
  index: number;
  taskIds: string[];
};

type ExecutionTask = {
  id: string;              // "task:<nodeId>"
  nodeId: string;
  ownerPath: string;       // defaults to stubs/<kind>-<name>.ts
  batchIndex: number;
  dependsOn: string[];
};
```

If a cycle is detected, the planner forces one node per batch and emits a warning per forced node. The plan still executes, but the cycle becomes visible in the report.

## Spec Phases

`phases.ts` exports:

- `withSpecDrafts(graph)` - backfills `status: 'spec_only'` and a placeholder `specDraft` for any code-bearing node missing one. The placeholder is a TODO class/function/api/UI body synthesized from the node's contract.
- `getCodeBearingNodes(graph)` - the subset of nodes that need real code (everything except pure-`module` grouping nodes).
- `getDefaultExecutionTarget(node)` - returns the path the executor should write to (`stubs/<kind>-<name>.ts` or `.tsx` for `ui-screen`).

The `placeholderSpecDraft` function generates a code skeleton:

```typescript
// For a function node with signature validateEmail(email: string): boolean
export function validateEmail(email: string): boolean {
  // TODO: implement
  throw new Error('Not implemented');
}
```

The placeholder is enough for the executor to import and call. It throws at runtime, which the executor catches and reports as a `NodeStatus.implemented` failure that should be fixed before advancing to `verified`.

## Runtime Workspace

`runtime-workspace.ts` is the orchestrator. `runBlueprint(graph, options)`:

1. Calls `createRunPlan` to get the batched task list
2. For each batch in order:
   - For each task in the batch (in parallel within a batch):
     - Validates inputs against the node's contract
     - Spawns a TypeScript subprocess for the task's owner path
     - Captures stdout, stderr, and trace spans
     - Validates outputs against the contract
     - Records the result
3. Aggregates results into an `ExecutionReport`

The runtime uses the local TypeScript compiler at the version pinned in `dependencies`. No remote service. The workspace is created under `.codeflow-sandboxes/<runId>/`.

## VCR Recording

`vcr.ts` turns trace spans into a `VcrRecording` for playback. Each span maps to a `VcrFrame` that captures the cumulative node state at the span's timestamp. The frame includes:

- The active node's `traceState` (status, count, errors, totalDurationMs, lastSpanIds)
- The node's current contract binding
- The active node ID
- A monotonic frame index

`sortSpans` orders chronologically. `resolveNodeId` falls back to name or path matching when a span's `blueprintNodeId` is missing. `mergeSpanIntoState` rolls counts/errors/durations with `statusPriority: idle < success < warning < error` (a `warning` span does not downgrade an `error` state).

The recording is a flat list of frames. The UI can scrub to any frame and render the graph at that moment without replaying spans.

## Mermaid Export

`graphToMermaid(graph, options?)` emits a Mermaid `flowchart` (or `classDiagram` if you pass `kind: 'class'`). Each node kind maps to a Mermaid shape:

| Node kind | Mermaid shape |
|---|---|
| `module` | `[]` (rectangle) |
| `function` | `()` (rounded) |
| `class` | `{}` (diamond) |
| `api` | `>]` (asymmetric) |
| `ui-screen` | `[[]]` (subroutine) |

The exporter HTML-entity-escapes every reserved Mermaid character (`;`, `<`, `>`, `|`, `[`, `]`, `{`, `}`, `(`, `)`, `` ` ``). This prevents label injection from a malicious PRD that puts Mermaid syntax in a node name.

## Sandbox and Diff

`createSandboxDir(runId)` returns `.codeflow-sandboxes/<runId>/`. `writeDiffManifest({ sandboxResult, targetDir })` walks the sandbox, hashes each file with SHA-256, and produces a `DiffEntry { path, status: 'added' | 'modified' | 'deleted' }` per file. The user reviews the manifest before the executor applies the sandbox to the target.

`runtime-workspace-local.ts` is the local-filesystem variant of the workspace. It runs TypeScript in a child process and captures its file writes. Use it for local development. Replace it with a Docker or Firecracker variant for untrusted PRDs.

## Heatmap, Ghost Nodes, Error Localization

Three smaller modules round out the runtime:

- `heatmap.ts` - computes per-node execution metrics (count, error rate, p50/p95 duration) for the canvas heatmap layer.
- `ghostnodes.ts` - synthesizes shadow nodes for spans that arrived without a `blueprintNodeId`. The ghost node gets a name like `ghost:<span-name>` and the runtime attempts to resolve it to a real node via name/path matching on subsequent runs.
- `error-localization.ts` - pinpoints a runtime error to the specific node that produced it, even when the error message is generic. Uses stack trace path matching plus contract shape diffing.

## Source Layout

```
src/
├── index.ts                  # barrel
├── plan.ts                   # createRunPlan
├── phases.ts                 # withSpecDrafts
├── execute.ts                # runBlueprint
├── runner.ts                 # createExecutionReport
├── vcr.ts                    # buildVcrRecording
├── mermaid.ts                # graphToMermaid
├── sandbox.ts                # createSandboxDir
├── runtime-contracts.ts      # input/output validation
├── runtime-tests.ts          # generated test cases
├── runtime-workspace.ts      # orchestrator
├── runtime-workspace-local.ts # local FS variant
├── utils.ts                  # shared helpers
├── heatmap.ts                # per-node heatmap data
├── ghostnodes.ts             # shadow node synthesis
├── execution-span.ts         # span model
├── node-state-timeline.ts    # cumulative state
├── sandbox-diff.ts           # sandbox vs target
├── error-localization.ts     # error to node pinning
└── bin/cli.ts                # codeflow-execution CLI
```

## Extension Points

### Adding a new node kind to the executor

1. Add the kind to `getCodeBearingNodes` if it needs real code.
2. Add a default owner path in `getDefaultExecutionTarget`.
3. Add a Mermaid shape in `mermaid.ts`.
4. Add a placeholder spec draft in `placeholderSpecDraft`.

### Replacing the local workspace with a sandboxed one

Implement the same interface as `runtime-workspace-local.ts` and pass it to `runBlueprint` via `options.workspace`. The orchestrator is workspace-agnostic.

### Custom runtime validation

The runtime uses `runtime-contracts.ts` for input/output validation. Pass a custom contract validator via `options.contractValidator` to plug in Zod, Valibot, or your own schema library.
