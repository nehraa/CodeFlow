# codeflow-versioning 0.3.0 Implementation Plan

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Steps use checkbox syntax for tracking.

**Goal:** Wire all codeflow-store modules into codeflow-versioning's branch metadata, expose them to CodeRAG for cross-artifact search, and make the full agentic memory queryable from a single interface.

**The core idea:** codeflow-store produces structured artifacts (reasoning checkpoints, observability spans/logs, risk reports, run records, sessions). codeflow-versioning creates branches. CodeRAG indexes all of it. The result: one semantic search interface across branches, agent reasoning, execution traces, and risk decisions.

---

## What each module contributes

| codeflow-store module | What it is | What it adds to versioning |
|----------------------|------------|---------------------------|
| `./reasoning` | `ReasoningCheckpoint[]` per run | Agent thinking at decision time |
| `./checkpoint/reasoning` | Fine-grained task-level checkpoints | Individual task reasoning |
| `./observability` | `ObservabilitySnapshot` (spans + logs) | Execution trace |
| `./risk` | `RiskReport` (score + factors) | What the agent flagged as risky |
| `./run` | `RunRecord` | Execution summary |
| `./approval` | `ApprovalRecord` | Human approval decisions |
| `./session` | `PersistedSession` (graph + plan + reports) | Full run state |

---

## Directory Structure (v0.3.0 additions)

```
packages/codeflow-versioning/
├── src/
│   ├── branch/index.ts        # createBranch + diffBranches (v0.1.0)
│   ├── store/index.ts          # re-exports from codeflow-store/branch
│   ├── reasoning/index.ts      # snapshotBranchReasoning + history (v0.2.0)
│   ├── invoke.ts               # list/create/get/remove (v0.1.0)
│   ├── diff.ts                 # computeDiff (v0.1.0)
│   ├── observability.ts        # NEW: attachObservabilitySnapshot
│   ├── risk.ts                 # NEW: attachRiskReport
│   ├── session.ts              # NEW: attachSessionSnapshot
│   ├── coderag/
│   │   ├── index.ts            # CodeRAG init (v0.2.0)
│   │   ├── agent.ts            # buildAgentRetrievalQuery (v0.2.0)
│   │   ├── search.ts           # searchBranches + explainBranchDiff (v0.2.0)
│   │   ├── observability.ts    # NEW: indexObservability + explainObservability
│   │   └── risk.ts             # NEW: indexRisk + explainRisk
│   ├── tools.ts                # MCP tool definitions
│   └── index.ts                # package barrel
```

---

## Step 0 — Update package exports

Add new sub-modules to `package.json` exports:

```json
{
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./branch": { "types": "./dist/branch/index.d.ts", "default": "./dist/branch/index.js" },
    "./store": { "types": "./dist/store/index.d.ts", "default": "./dist/store/index.js" },
    "./reasoning": { "types": "./dist/reasoning/index.d.ts", "default": "./dist/reasoning/index.js" },
    "./coderag": { "types": "./dist/coderag/index.d.ts", "default": "./dist/coderag/index.js" },
    "./observability": { "types": "./dist/observability/index.d.ts", "default": "./dist/observability/index.js" },   // NEW
    "./risk": { "types": "./dist/risk/index.d.ts", "default": "./dist/risk/index.js" }                                   // NEW
  }
}
```

---

## Step 1 — Wire observability to branch creation

### Step 1.1 — `src/observability.ts`

```typescript
import type { ObservabilitySnapshot } from "@abhinav2203/codeflow-core/schema";
import {
  loadObservabilitySnapshot,
  mergeObservabilitySnapshot
} from "@abhinav2203/codeflow-store/observability";

/**
 * Attach the current observability snapshot for a project to a branch.
 * Call this at branch creation time to preserve the execution trace.
 */
export const attachObservabilitySnapshot = async (
  branch: GraphBranch,
  projectName?: string
): Promise<GraphBranch> => {
  const effectiveProjectName = projectName ?? branch.projectName;
  const snapshot = await loadObservabilitySnapshot(effectiveProjectName);
  if (!snapshot) return branch;

  return {
    ...branch,
    metadata: {
      ...((branch as any).metadata ?? {}),
      observability: snapshot
    }
  } as GraphBranch;
};

/**
 * Merge a new observability snapshot into the branch's attached snapshot.
 * Used when an agent continues work on an existing branch.
 */
export const mergeBranchObservability = async (
  branch: GraphBranch,
  spans?: ObservabilitySnapshot["spans"],
  logs?: ObservabilitySnapshot["logs"],
  projectName?: string
): Promise<ObservabilitySnapshot> => {
  const effectiveProjectName = projectName ?? branch.projectName;
  return mergeObservabilitySnapshot({
    projectName: effectiveProjectName,
    spans,
    logs,
    graph: branch.graph
  });
};
```

### Step 1.2 — `src/risk.ts`

```typescript
import type { RiskReport } from "@abhinav2203/codeflow-core/schema";
import { assessExportRisk } from "@abhinav2203/codeflow-store/risk";
import type { BlueprintGraph, RunPlan } from "@abhinav2203/codeflow-core/schema";

/**
 * Compute and attach a risk report at branch creation time.
 * Call with the graph and runPlan that the branch was created from.
 */
export const attachRiskReport = async (
  branch: GraphBranch,
  runPlan: RunPlan,
  outputDir?: string
): Promise<GraphBranch> => {
  const { riskReport } = await assessExportRisk(
    branch.graph,
    runPlan,
    outputDir
  );

  return {
    ...branch,
    metadata: {
      ...((branch as any).metadata ?? {}),
      risk: riskReport
    }
  } as GraphBranch;
};

/**
 * Re-attach a provided RiskReport (e.g., from a previous run) to a branch.
 */
export const attachExistingRiskReport = (
  branch: GraphBranch,
  riskReport: RiskReport
): GraphBranch => {
  return {
    ...branch,
    metadata: {
      ...((branch as any).metadata ?? {}),
      risk: riskReport
    }
  } as GraphBranch;
};
```

### Step 1.3 — `src/session.ts`

```typescript
import type { PersistedSession } from "@abhinav2203/codeflow-core/schema";
import { loadLatestSession } from "@abhinav2203/codeflow-store/session";

/**
 * Attach the latest session snapshot to a branch.
 * This preserves the full run state (graph, plan, last risk/export/execution reports)
 * so the branch can be fully reconstructed from the session.
 */
export const attachSessionSnapshot = async (
  branch: GraphBranch,
  projectName?: string
): Promise<GraphBranch> => {
  const effectiveProjectName = projectName ?? branch.projectName;
  const session = await loadLatestSession(effectiveProjectName);
  if (!session) return branch;

  return {
    ...branch,
    metadata: {
      ...((branch as any).metadata ?? {}),
      session: {
        sessionId: session.sessionId,
        projectName: session.projectName,
        repoPath: session.repoPath,
        graph: session.graph,
        runPlan: session.runPlan,
        lastRiskReport: session.lastRiskReport,
        lastExportResult: session.lastExportResult,
        lastExecutionReport: session.lastExecutionReport,
        approvalIds: session.approvalIds,
        updatedAt: session.updatedAt
      }
    }
  } as GraphBranch;
};
```

### Step 1.4 — Update `src/invoke.ts`

Update `createBranch` to accept optional flags and attach all artifacts:

```typescript
export type CreateBranchOptions = {
  graph: BlueprintGraph;
  name: string;
  description?: string;
  parentBranchId?: string;
  runId?: string;           // snapshot reasoning (v0.2.0)
  attachObservability?: boolean;  // NEW v0.3.0: attach trace/spans/logs
  attachRisk?: boolean;            // NEW v0.3.0: compute + attach risk report
  attachSession?: boolean;         // NEW v0.3.0: attach latest session
  runPlan?: RunPlan;               // NEW v0.3.0: required if attachRisk is true
  outputDir?: string;              // NEW v0.3.0: used with attachRisk
};
```

Updated `createBranch` implementation:
```typescript
export const createBranch = async (options: CreateBranchOptions): Promise<GraphBranch> => {
  const {
    graph, name, description, parentBranchId,
    runId,
    attachObservability, attachRisk, attachSession,
    runPlan, outputDir
  } = options;

  const parsed = createBranchRequestSchema.parse({ graph, name, description, parentBranchId });
  let branch: GraphBranch = {
    id: createBranchId(),
    name: parsed.name,
    description: parsed.description,
    projectName: parsed.graph.projectName,
    parentBranchId: parsed.parentBranchId,
    createdAt: new Date().toISOString(),
    graph: parsed.graph
  };

  // v0.2.0: attach reasoning if runId provided
  if (runId) {
    const reasoning = await snapshotBranchReasoning(runId, branch.projectName);
    (branch as any).metadata = { ...((branch as any).metadata ?? {}), reasoning };
  }

  // v0.3.0: attach observability
  if (attachObservability) {
    branch = await attachObservabilitySnapshot(branch);
  }

  // v0.3.0: attach risk report
  if (attachRisk) {
    if (!runPlan) {
      throw new Error("attachRisk requires runPlan to be provided");
    }
    branch = await attachRiskReport(branch, runPlan, outputDir);
  }

  // v0.3.0: attach session
  if (attachSession) {
    branch = await attachSessionSnapshot(branch);
  }

  await saveBranch(branch);
  return branch;
};
```

### Step 1.5 — Commit

```bash
cd packages/codeflow-versioning
git add src/observability.ts src/risk.ts src/session.ts src/invoke.ts
git commit -m "feat(versioning): wire observability, risk, and session snapshots to branch creation"
```

---

## Step 2 — CodeRAG integration for observability and risk

### Step 2.1 — `src/coderag/observability.ts`

Indexes observability data in CodeRAG and provides search/explain.

```typescript
import type { ObservabilitySnapshot, TraceSpan, ObservabilityLog } from "@abhinav2203/codeflow-core/schema";
import { getCodeRagInstance } from "./index.js";
import { formatAgentRetrievalPrompt } from "./agent.js";

export interface ObservabilitySearchResult {
  branchId: string;
  branchName: string;
  matchedSpans: TraceSpan[];
  matchedLogs: ObservabilityLog[];
  explanation: string;
}

/**
 * Format an observability snapshot as a searchable text document for CodeRAG.
 * Indexed by branch so CodeRAG can find execution traces.
 */
export const formatObservabilityForIndex = (
  branch: GraphBranch,
  snapshot: ObservabilitySnapshot
): string => {
  const lines: string[] = [
    `Observability for branch "${branch.name}" (${branch.id}):`,
    `Project: ${branch.projectName}`,
    `Created: ${branch.createdAt}`,
    `Span count: ${snapshot.spans.length}`,
    `Log count: ${snapshot.logs.length}`,
    ""
  ];

  if (snapshot.spans.length > 0) {
    lines.push("Execution spans:");
    for (const span of snapshot.spans) {
      lines.push(`  - ${span.name}: ${span.status} (${span.durationMs ?? "?"}ms)`);
      if (span.error) lines.push(`    ERROR: ${span.error}`);
    }
  }

  if (snapshot.logs.length > 0) {
    lines.push("\nLogs:");
    for (const log of snapshot.logs.slice(0, 20)) {
      lines.push(`  [${log.level}] ${log.message}`);
    }
  }

  return lines.join("\n");
};

/**
 * Search observability data across branches.
 * Uses CodeRAG if available, otherwise filters by keyword.
 *
 * @example
 * const results = await searchObservability({
 *   projectName: "my-app",
 *   query: "error during auth module execution",
 *   limit: 5
 * });
 */
export const searchObservability = async ({
  projectName,
  query,
  limit = 5
}: {
  projectName: string;
  query: string;
  limit?: number;
}): Promise<ObservabilitySearchResult[]> => {
  const codeRag = getCodeRagInstance();

  if (!codeRag) {
    // Fallback: no CodeRAG — return empty
    return [];
  }

  try {
    const result = await codeRag.query(
      `Observability search for "${query}" in project ${projectName}`,
      { depth: 2 }
    );

    // Parse CodeRAG result to extract branch context
    // CodeRAG returns primaryNode and relatedNodes from its code index
    // We need to cross-reference with branch metadata
    return result.answer
      ? [{
          branchId: "",
          branchName: result.context.primaryNode?.name ?? "unknown",
          matchedSpans: [],
          matchedLogs: [],
          explanation: result.answer
        }]
      : [];
  } catch {
    return [];
  }
};

/**
 * Explain observability data for a specific branch in natural language.
 */
export const explainBranchObservability = async (
  branch: GraphBranch,
  focusOn: "spans" | "logs" | "errors" = "spans"
): Promise<string> => {
  const codeRag = getCodeRagInstance();
  const snapshot = (branch as any).metadata?.observability as ObservabilitySnapshot | undefined;

  if (!snapshot) {
    return `Branch "${branch.name}" has no observability snapshot attached.`;
  }

  const context = formatObservabilityForIndex(branch, snapshot);

  if (!codeRag) {
    return context;
  }

  try {
    const result = await codeRag.query(
      `Explain the observability for branch "${branch.name}":\n${context}`,
      { depth: 2 }
    );
    return formatAgentRetrievalPrompt(result);
  } catch {
    return context;
  }
};
```

### Step 2.2 — `src/coderag/risk.ts`

Indexes and explains risk data.

```typescript
import type { RiskReport, RiskFactor } from "@abhinav2203/codeflow-core/schema";
import type { GraphBranch } from "@abhinav2203/codeflow-core/schema";
import { getCodeRagInstance } from "./index.js";
import { formatAgentRetrievalPrompt } from "./agent.js";

export interface RiskSearchResult {
  branch: GraphBranch;
  riskReport: RiskReport;
  relevanceScore: number;
  explanation: string;
}

/**
 * Format a risk report as searchable text for CodeRAG.
 */
export const formatRiskReportForIndex = (branch: GraphBranch): string => {
  const risk = (branch as any).metadata?.risk as RiskReport | undefined;
  if (!risk) {
    return `Branch "${branch.name}" has no risk report.`;
  }

  const lines: string[] = [
    `Risk report for branch "${branch.name}" (${branch.id}):`,
    `Score: ${risk.score} (${risk.level})`,
    `Requires approval: ${risk.requiresApproval}`,
    `Factors (${risk.factors.length}):`
  ];

  for (const factor of risk.factors) {
    lines.push(`  - [${factor.code}] score=${factor.score}: ${factor.message}`);
  }

  return lines.join("\n");
};

/**
 * Search branches by risk profile using CodeRAG.
 *
 * @example
 * const results = await searchBranchesByRisk({
 *   projectName: "my-app",
 *   query: "high risk of overwriting existing output with yolo mode",
 *   minScore: 3
 * });
 */
export const searchBranchesByRisk = async ({
  projectName,
  query,
  minScore,
  limit = 5
}: {
  projectName: string;
  query: string;
  minScore?: number;
  limit?: number;
}): Promise<RiskSearchResult[]> => {
  const { loadBranches } = await import("../store/index.js");
  const allBranches = await loadBranches(projectName);
  const codeRag = getCodeRagInstance();

  const scored = await Promise.all(
    allBranches.map(async (branch) => {
      const risk = (branch as any).metadata?.risk as RiskReport | undefined;
      if (!risk) return null;
      if (minScore !== undefined && risk.score < minScore) return null;

      if (!codeRag) {
        return { branch, riskReport: risk, score: risk.score, explanation: formatRiskReportForIndex(branch) };
      }

      try {
        const result = await codeRag.query(
          `Risk profile for branch "${branch.name}": ${formatRiskReportForIndex(branch)}. Query: ${query}`,
          { depth: 1 }
        );
        return {
          branch,
          riskReport: risk,
          score: risk.score,
          explanation: result.answer ?? formatRiskReportForIndex(branch)
        };
      } catch {
        return null;
      }
    })
  );

  return scored
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => ({
      branch: s.branch,
      riskReport: s.riskReport,
      relevanceScore: s.score,
      explanation: s.explanation
    }));
};

/**
 * Explain the risk profile of a branch in natural language.
 */
export const explainBranchRisk = async (branch: GraphBranch): Promise<string> => {
  const codeRag = getCodeRagInstance();
  const risk = (branch as any).metadata?.risk as RiskReport | undefined;

  if (!risk) {
    return `Branch "${branch.name}" has no risk report attached.`;
  }

  const base = formatRiskReportForIndex(branch);

  if (!codeRag) {
    return base;
  }

  try {
    const result = await codeRag.query(
      `Explain the risk profile of branch "${branch.name}":\n${base}`,
      { depth: 2 }
    );
    return formatAgentRetrievalPrompt(result);
  } catch {
    return base;
  }
};
```

### Step 2.3 — Commit

```bash
cd packages/codeflow-versioning
git add src/coderag/observability.ts src/coderag/risk.ts
git commit -m "feat(versioning): add CodeRAG-powered observability and risk search"
```

---

## Step 3 — Update MCP tools

Add new tools to `src/tools.ts`:

```typescript
// NEW v0.3.0 tools
baseTool(
  "versioning_observability_explain",
  "Explain the execution observability attached to a branch.",
  {
    type: "object",
    properties: {
      projectName: { type: "string" },
      branchId: { type: "string" },
      focusOn: { type: "string", enum: ["spans", "logs", "errors"] }
    },
    required: ["projectName", "branchId"]
  }
),
baseTool(
  "versioning_risk_search",
  "Search branches by risk profile using natural language.",
  {
    type: "object",
    properties: {
      projectName: { type: "string" },
      query: { type: "string" },
      minScore: { type: "number" },
      limit: { type: "number" }
    },
    required: ["projectName", "query"]
  }
),
baseTool(
  "versioning_risk_explain",
  "Explain the risk report for a specific branch.",
  {
    type: "object",
    properties: {
      projectName: { type: "string" },
      branchId: { type: "string" }
    },
    required: ["projectName", "branchId"]
  }
),
baseTool(
  "versioning_create_with_full_context",
  "Create a branch with all available context snapshots attached.",
  {
    type: "object",
    properties: {
      projectName: { type: "string" },
      graph: { type: "object" },
      name: { type: "string" },
      description: { type: "string" },
      parentBranchId: { type: "string" },
      runId: { type: "string" },
      attachObservability: { type: "boolean" },
      attachRisk: { type: "boolean" },
      attachSession: { type: "boolean" },
      runPlan: { type: "object" },
      outputDir: { type: "string" }
    },
    required: ["projectName", "graph", "name"]
  }
)
```

Also update `versioning_branch_create` tool description to reflect the new options.

### Step 3.2 — Commit

```bash
cd packages/codeflow-versioning
git add src/tools.ts
git commit -m "feat(versioning): add observability and risk MCP tools"
```

---

## Step 4 — Final verification

```bash
cd packages/codeflow-versioning && npm run check && npm run test && npm run build
cd /Users/abhinavnehra/git/CodeFlow && npm run check
```

---

## Full capability inventory after v0.3.0

### Query by...

| What | How |
|------|-----|
| Branch name/description | `searchBranches` (keyword or CodeRAG) |
| What nodes/responsibilities a branch handles | CodeRAG semantic over branch graph |
| Agent reasoning at branch creation | `loadBranchReasoningHistory` |
| Full execution trace (spans + logs) | `explainBranchObservability` |
| Which branches had execution errors | `searchObservability` |
| Risk profile of a branch | `explainBranchRisk` |
| Branches by risk score/factors | `searchBranchesByRisk` |
| Which branches got human approval | stored in `branch.metadata.session.approvalIds` |
| Diff between two branches | `computeDiff` + `explainBranchDiff` |
| Natural language about any branch | `explainBranchDiff` with CodeRAG |

### Agent workflow with v0.3.0

```
Agent starts work
  → createBranch({ attachObservability: true, attachRisk: true, attachSession: true, runId, runPlan })
  → Branch created with:
      - graph snapshot
      - reasoning checkpoints from this run
      - observability snapshot (spans + logs)
      - risk report
      - session snapshot
  → Agent works, periodically snapshots reasoning via saveTaskReasoningCheckpoint
  → Agent calls explainBranchDiff or searchBranchesByRisk to review work
  → User approves → branch merged + approval record attached
  → Later: searchBranches("auth refactor with security concerns and low risk")
      → CodeRAG finds branches matching description + reasoning content + risk profile
      → Returns ranked results with full context
```

---

## What CodeRAG indexes that it didn't before

| Content | Indexed by | Used for |
|---------|-----------|---------|
| `branch.metadata.reasoning` | Text in branch doc | "which branch had reasoning about X" |
| `branch.metadata.observability` | Text in observability doc | "which branch had errors during execution" |
| `branch.metadata.risk` | Text in risk doc | "which branch was flagged as high risk for X" |
| `branch.metadata.session` | Text in session doc | "which branch was created from a session with Y characteristics" |

Each of these is serialized as a text document (or set of docs) and indexed alongside the codebase. CodeRAG's existing `index()` method handles this — we just call it with the right content.

---

## Key design decisions

1. **`attachObservability/Risk/Session` are all opt-in** — No new behavior unless explicitly requested in `createBranch`. Existing callers are unaffected.

2. **Observability is stored as a snapshot, not streamed** — `ObservabilitySnapshot` is a point-in-time capture. Branch receives whatever was in the snapshot at creation time. Future executions aren't automatically merged — use `mergeBranchObservability` to update.

3. **Risk requires `runPlan`** — Can't compute a risk report without knowing the execution plan. `runPlan` is passed alongside `attachRisk: true`. The risk is computed fresh at branch creation time (from `assessExportRisk`), so it reflects the plan that was used to create the branch.

4. **CodeRAG graceful degradation** — All search functions check `getCodeRagInstance()` and fall back to filtered in-memory search or return empty results if CodeRAG is not initialized. No hard failures.

5. **Metadata shape** — All attached data lives in `branch.metadata.{reasoning, observability, risk, session}`. The `GraphBranch` type in `codeflow-core` doesn't have a `metadata` field — we cast with `as any`. In a future `codeflow-core` schema update, `metadata` should be formally typed as `Record<string, unknown>`.
