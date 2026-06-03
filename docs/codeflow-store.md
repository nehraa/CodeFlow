# codeflow-store

Local persistence for everything in CodeFlow. Sessions, branches, approvals, checkpoints, observability, run records, risk reports, and the Zustand-backed React store. Lives under `~/.codeflow-store/` by default.

## What it owns

- **Sessions.** Latest-session cache per project, with the full `BlueprintGraph` plus the most recent `RunPlan`, `RiskReport`, `ExportResult`, and `ExecutionReport`.
- **Branches.** JSON files at `branches/<slug>/<branchId>.json` (the schema and CRUD are re-exported; `codeflow-versioning/branch` is the writer).
- **Approvals.** `ApprovalRecord` keyed by `approvalId`, embedding the `RunPlan` and `RiskReport` that need sign-off.
- **Run records.** `RunRecord` keyed by `runId`.
- **Checkpoints.** Per-task reasoning text, written before execution so a crash can recover the run.
- **Observability.** Per-project `ObservabilitySnapshot` rolling up trace spans and logs by node.
- **Risk.** `ExportRiskAssessment` (fingerprint, outputDir, `RiskReport`, `hasExistingOutput`).
- **Reasoning journal.** Pull API: `loadReasoningForRun`, `loadReasoningForProject`. CodeRag reindexes from this.
- **React store.** `useBlueprintStore` (Zustand). The same store interface the canvas package uses.

## Subpath exports

| Subpath | Module |
| --- | --- |
| `.` | Barrel. |
| `./checkpoint` | `createCheckpointIfNeeded` and re-exports of the per-task reasoning checkpoint API. |
| `./approval` | `createApprovalId`, `createApprovalRecord`, `getApprovalRecord`, `approveRecord`. |
| `./run` | `createRunId`, `saveRunRecord`. |
| `./risk` | `assessExportRisk`. |
| `./observability` | `loadObservabilitySnapshot`, `mergeObservabilitySnapshot`. |
| `./branch` | `saveBranch`, `loadBranch`, `loadBranches`, `deleteBranch`. |
| `./session` | `createSessionId`, `saveSession`, `loadLatestSession`, `upsertSession`. |
| `./store` and `./store/react` | `useBlueprintStore` (Zustand hook). |
| `./reasoning` | `loadReasoningForRun`, `loadReasoningForProject`, `deleteReasoningForRun`. |

The CLI binary `codeflow-store` exposes read/write helpers for ops work.

## Store root

Everything lives under a single root, configured by env var or default:

```typescript
import { getStoreRoot } from '@abhinav2203/codeflow-core/storage';

const root = getStoreRoot();
// Default: ~/.codeflow-store/
// Override: process.env.CODEFLOW_STORE_ROOT
```

Layout (relative to the root):

```
.codeflow-store/
├── branches/<slug>/<branchId>.json
├── sessions/<slug>/<sessionId>.json
├── runs/<runId>.json
├── approvals/<approvalId>.json
├── checkpoints/reasoning/<runId>/<slug>/<taskId>.json
├── observability/<slug>/snapshot.json
├── observability-config/<slug>.json
└── ring-buffer state (per-project)
```

`★ Insight ─────────────────────────────────────`
The store is a directory of JSON files on purpose. It is grep-able, rsync-able, and version-controllable in an emergency. No SQLite, no daemon. The cost is atomicity; the writer helpers use a temp-file rename to avoid half-written files.
`─────────────────────────────────────────────────`

## Sessions

```typescript
import {
  createSessionId,
  saveSession,
  loadLatestSession,
  upsertSession,
} from '@abhinav2203/codeflow-store/session';

const sessionId = createSessionId();
const session = upsertSession({
  projectName: 'auth',
  sessionId,
  graph,
  runPlan,
  repoPath: '/abs/path',
  lastRiskReport?,
  lastExportResult?,
  lastExecutionReport?,
  approvalId?,
});
```

`upsertSession` writes through to disk and updates the latest-session cache for the project. `loadLatestSession(projectName)` returns the most recent session. The IDE calls it on startup to restore the previous view.

## Branches (storage)

The storage module is intentionally thin. The graph and metadata live in `codeflow-versioning/branch`; this package just owns the I/O:

```typescript
import { saveBranch, loadBranch, loadBranches, deleteBranch } from '@abhinav2203/codeflow-store/branch';

saveBranch(branch);
const branch = loadBranch('auth', 'br-<uuid>');
const branches = loadBranches('auth');
deleteBranch('auth', 'br-<uuid>');
```

`loadBranches` reads the whole project directory. Fine for hundreds of branches; not for tens of thousands. Add an index file if you cross that threshold.

## Approvals

```typescript
import {
  createApprovalId,
  createApprovalRecord,
  getApprovalRecord,
  approveRecord,
} from '@abhinav2203/codeflow-store/approval';

const approvalId = createApprovalId();
createApprovalRecord({ approvalId, runPlan, riskReport });
// later
const record = getApprovalRecord(approvalId);
approveRecord(approvalId, 'abhinav');
```

`ApprovalRecord` embeds the `RunPlan` and `RiskReport` that need sign-off. Once approved, the agent or runtime proceeds. The store is the system of record; the approval UI is in the IDE.

## Checkpoints

```typescript
import {
  createCheckpointIfNeeded,
  saveTaskReasoningCheckpoint,
  loadTaskReasoningCheckpoint,
  recoverRun,
  clearTaskReasoningCheckpoint,
} from '@abhinav2203/codeflow-store/checkpoint';

createCheckpointIfNeeded(targetDir, checkpointId);
saveTaskReasoningCheckpoint({
  runId: 'r-...',
  projectName: 'auth',
  taskId: 'task:<nodeId>',
  reasoning: '...',
});
clearTaskReasoningCheckpoint({ runId, projectName, taskId });
```

The agent calls `saveTaskReasoningCheckpoint` **before** it starts a task and `clearTaskReasoningCheckpoint` after `saveRunRecord` succeeds. If the process crashes, `recoverRun(runId, projectName)` walks the checkpoint directory and rebuilds the run record from disk.

## Observability

```typescript
import {
  loadObservabilitySnapshot,
  mergeObservabilitySnapshot,
} from '@abhinav2203/codeflow-store/observability';

const snapshot = loadObservabilitySnapshot('auth');
mergeObservabilitySnapshot({
  projectName: 'auth',
  spans: [...newSpans],
  logs: [...newLogs],
  graph, // optional, for rollup-by-node
});
```

`ObservabilitySnapshot` is a per-project rollup of trace spans and logs. The merge helper applies the configurable ring buffer (Phase 2 of the store): default 500 spans, 2000 logs, overridable per project via `<storeRoot>/observability-config/<slug>.json`.

`★ Insight ─────────────────────────────────────`
The ring buffer cap is per-project, not global. A small project gets a tighter cap automatically; a noisy one can be raised. The previous behavior (a hardcoded `.slice(-500)` for both) silently dropped data on busy agents.
`─────────────────────────────────────────────────`

## Risk

```typescript
import { assessExportRisk } from '@abhinav2203/codeflow-store/risk';

const assessment = assessExportRisk(graph, runPlan, outputDir);
// {
//   fingerprint,
//   outputDir,
//   riskReport: { level, factors[] },
//   hasExistingOutput: boolean,
// }
```

Fingerprints the graph and run plan (SHA-256) so re-runs of the same input can be detected. `hasExistingOutput` is the gate the approval flow checks before letting a run touch the filesystem.

## Reasoning journal

```typescript
import {
  loadReasoningForRun,
  loadReasoningForProject,
  deleteReasoningForRun,
} from '@abhinav2203/codeflow-store/reasoning';

const perRun = loadReasoningForRun('r-...', 'auth');
const perProject = loadReasoningForProject('auth');
deleteReasoningForRun('r-...', 'auth');
```

CodeRag calls these on reindex. The pull model keeps the store decoupled from CodeRag: the store doesn't know who reads its data.

## React store

```typescript
import { useBlueprintStore } from '@abhinav2203/codeflow-store/store';

const graph = useBlueprintStore((s) => s.graph);
const openFiles = useBlueprintStore((s) => s.openFiles);
const setMode = useBlueprintStore((s) => s.setMode);
```

The Zustand-backed store carries:

- `graph`, `repoPath`
- `openFiles`, `activeFile`, `dirtyFiles`
- `mode: "graph" | "ide"`
- `floatingGraph` panel state
- `selectedNodeId`
- setters for all of the above

The same interface lives in `codeflow-canvas/src/store/blueprint-store.ts` so consumers can import from either path.

`★ Insight ─────────────────────────────────────`
The store is shared across packages. The canvas package re-declares the interface so React apps don't need to depend on `codeflow-store` directly. The IDE mounts the store once at the app root.
`─────────────────────────────────────────────────`

## File layout

```
codeflow-store/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── PHASE2_ROADMAP.md
├── TESTING.md
└── src/
    ├── index.ts             barrel
    ├── approval/            createApproval*, getApproval*, approveRecord
    ├── branch/              save/load/list/deleteBranch
    ├── checkpoint/          createCheckpointIfNeeded, save/load/clearTaskReasoningCheckpoint, recoverRun
    ├── observability/       loadObservabilitySnapshot, mergeObservabilitySnapshot
    ├── reasoning/           loadReasoningForRun, loadReasoningForProject, deleteReasoningForRun
    ├── risk/                assessExportRisk
    ├── run/                 createRunId, saveRunRecord
    ├── session/             createSessionId, saveSession, loadLatestSession, upsertSession
    ├── store/               useBlueprintStore (Zustand)
    ├── shared/              file-tree, run-command, terminal-sessions, utils
    ├── bin/cli.ts
    └── session.test.ts
```

## Phase 2 status

`docs/PHASE2.md` (in the package) describes the four Phase 2 features that have shipped:

- **P2-1.** `taskId` on trace spans (one line in `codeflow-core`'s `traceSpanSchema`).
- **P2-2.** Configurable ring buffer for spans and logs, with per-project overrides.
- **P2-4.** Crash-recovery checkpoints via `saveTaskReasoningCheckpoint` / `clearTaskReasoningCheckpoint`.
- **P2-5.** Reasoning journal pull API so CodeRag can reindex without coupling.

Token tracking (P2-3) and LLM output storage (P2-6) are explicitly deferred. The store treats them as YAGNI until a real consumer asks.
