# codeflow-versioning

Treats the `BlueprintGraph` itself as a versioned artifact. Branches are full graphs with metadata. Diffs are structural. Search runs over branches via CodeRag.

## What it owns

- **Branches.** Create, load, list, delete. A branch is a full `BlueprintGraph` plus a slug, id, and provenance metadata.
- **Diffing.** Two branches go in, a `BranchDiff` comes out: added/removed/modified nodes and edges, plus the set of impacted node ids.
- **Reasoning snapshots.** Per-branch snapshots of task reasoning text, recovered from `codeflow-store`'s checkpoint subsystem.
- **Branch search and explain.** CodeRag-backed natural-language search over branch metadata and graph nodes. Falls back to a structural diff dump if CodeRag is not available.
- **MCP tool surface.** Twelve MCP tool definitions that wrap every public operation.

## Subpath exports

| Subpath | Module |
| --- | --- |
| `.` | The barrel. |
| `./branch` | `createBranch`, `diffBranches`, plus the slug/id helpers. |
| `./store` | Re-exports `saveBranch`/`loadBranch`/`loadBranches`/`deleteBranch` from `codeflow-store/branch`. |
| `./reasoning` | `snapshotBranchReasoning`, `loadBranchReasoningHistory`, `summarizeReasoningForBranch`. |
| `./coderag` | `initCodeRagForProject`, `getCodeRagInstance`, `closeCodeRagInstance`, `searchBranches`, `explainBranchDiff`. |
| `./observability` | `attachObservabilitySnapshot`, `mergeBranchObservability`. |
| `./risk` | `attachRiskReport`, `attachExistingRiskReport`. |
| `./diff` | `computeDiff`, a Zod-validated wrapper over `diffBranches`. |
| `./tools` | `VERSIONING_TOOLS: McpTool[]`. Twelve tool definitions. |

## Branches

```typescript
import { createBranch, createBranchId } from '@abhinav2203/codeflow-versioning/branch';

const branch = createBranch({
  projectName: 'auth',
  graph,
  baseBranchId?: 'br-...',
  author?: 'abhinav',
  message?: 'add profile page',
});
// {
//   id: 'br-<uuid>',
//   slug: 'auth',
//   projectName: 'auth',
//   baseBranchId?: 'br-...',
//   graph,
//   createdAt,
//   author,
//   message,
//   // attached by other modules: reasoning, observability, risk, session
// }
```

`createBranch` validates the graph through `blueprintGraphSchema` (from `codeflow-core/schema`) before persisting. The id format is `br-<uuid>` so it sorts and parses cleanly. The slug is the project name, lowercased and slugified.

Persistence happens through `codeflow-store/branch`:

```typescript
import { saveBranch, loadBranch, loadBranches, deleteBranch } from '@abhinav2203/codeflow-versioning/store';

saveBranch(branch);
const loaded = loadBranch('auth', 'br-<uuid>');
const all = loadBranches('auth');
deleteBranch('auth', 'br-<uuid>');
```

## Diffs

```typescript
import { diffBranches } from '@abhinav2203/codeflow-versioning/branch';

const diff = diffBranches(baseGraph, compareGraph, baseId, compareId);
// {
//   baseId, compareId,
//   nodeDiffs: Array<{ nodeId, kind: 'added'|'removed'|'modified', before?, after? }>,
//   edgeDiffs: Array<{ from, to, kind: 'added'|'removed'|'modified', before?, after? }>,
//   addedNodes, removedNodes, modifiedNodes,
//   addedEdges, removedEdges,
//   impactedNodeIds: string[],
// }
```

The diff uses SHA-256-hashed identifiers:

- `nodeKey` = hash of `kind|name|summary|path|status|signature|ownerId|contract`.
- `edgeKey` = `<fromNodeKey>-><toNodeKey>:<edgeKind>`.

A node is `modified` when its key matches but its body differs. The before/after payloads are full `BlueprintNode` and `BlueprintEdge` records, so the diff is lossless. `impactedNodeIds` is the union of all changed nodes plus the downstream neighborhood, useful for asking "what else might break?"

`★ Insight ─────────────────────────────────────`
Hashing the key (not the id) means a node that gets renamed still matches across versions. The diff stays focused on structural change, not label churn.
`─────────────────────────────────────────────────`

## Reasoning snapshots

```typescript
import {
  snapshotBranchReasoning,
  loadBranchReasoningHistory,
  summarizeReasoningForBranch,
} from '@abhinav2203/codeflow-versioning/reasoning';

const snapshot = snapshotBranchReasoning('run-2026-06-02-001', 'auth');
const history = loadBranchReasoningHistory('auth');
const summary = summarizeReasoningForBranch(snapshot);
```

These wrap `codeflow-store/checkpoint` and `codeflow-store/reasoning`. A snapshot packages the per-task reasoning text (loaded from disk) into a `BranchReasoningSnapshot` keyed by `runId` and `projectName`. The history aggregates snapshots per branch.

## CodeRag-backed search

```typescript
import {
  initCodeRagForProject,
  searchBranches,
  explainBranchDiff,
} from '@abhinav2203/codeflow-versioning/coderag';

await initCodeRagForProject({
  projectName: 'auth',
  repoPath: '/abs/path/to/repo',
  docsPath: '/abs/path/to/docs',     // optional
  embeddingProvider: 'onnx',         // 'onnx' | 'gemini' | 'local-hash'
});

const hits = await searchBranches('auth', 'which branch added the profile page?');
const explanation = await explainBranchDiff('br-base', 'br-feature');
```

`initCodeRagForProject` builds a per-project `CodeRag` instance and stores it under `<storeRoot>/branches/<slug>/.coderag/`. `getCodeRagInstance` returns the cached instance, `closeCodeRagInstance` releases it.

`searchBranches` runs a natural-language query against the indexed branches. If CodeRag is unavailable, it falls back to a `formatStructuralDiff` text dump over the most recent branches.

`explainBranchDiff` does the same for a diff. Pass two branch ids; get back a summary of what changed and (when CodeRag is online) a natural-language explanation grounded in the diff content.

## MCP tool surface

`./tools` exports `VERSIONING_TOOLS: McpTool[]`, twelve MCP tool definitions:

| Tool | Purpose |
| --- | --- |
| `versioning_branch_list` | List branches for a project. |
| `versioning_branch_create` | Create a branch. |
| `versioning_branch_get` | Get a branch by id. |
| `versioning_branch_delete` | Delete a branch. |
| `versioning_diff` | Compute a diff between two branches or two graphs. |
| `versioning_reasoning_snapshot` | Snapshot per-task reasoning for a run. |
| `versioning_branch_search` | Natural-language branch search via CodeRag. |
| `versioning_explain_diff` | Natural-language explanation of a diff. |
| `versioning_observability_explain` | Explain the observability snapshot attached to a branch. |
| `versioning_risk_search` | Search risk reports. |
| `versioning_risk_explain` | Explain a risk report. |
| `versioning_create_with_full_context` | Create a branch with reasoning, observability, risk, and session all attached. |

The tool definitions are wire-format objects; the dispatch lives in whichever MCP server mounts them. The `codeflow-mcp` package's transport handles the JSON-RPC envelope.

## File layout

```
codeflow-versioning/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── brutal-test.ts          developer-facing test runner
├── test-e2e-runner.ts      end-to-end test harness
└── src/
    ├── index.ts            barrel
    ├── branch/             createBranch, diffBranches
    ├── store/              thin re-export of codeflow-store/branch
    ├── reasoning/          snapshot/load/summarize
    ├── coderag/            init/get/close + search/explain
    ├── invoke/             high-level invoke helpers
    ├── bin/                CLI entry
    ├── diff.ts             computeDiff
    ├── invoke.ts
    ├── observability.ts
    ├── risk.ts
    ├── session.ts
    ├── tools.ts            VERSIONING_TOOLS
    └── *.test.ts
```
