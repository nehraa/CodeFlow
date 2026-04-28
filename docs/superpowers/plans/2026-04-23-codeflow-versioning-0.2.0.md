# codeflow-versioning 0.2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract blueprint branching and diff into a standalone npm package `@abhinav2203/codeflow-versioning` that works in isolation — no Next.js app required — with deep CodeRAG integration for reasoning-enriched branch diffs and natural-language branch queries.

**Architecture:** The package exposes four sub-modules: `./branch` (create/snapshot/diff), `./store` (persistence), `./reasoning` (checkpoint snapshots), and `./coderag` (semantic branch search + diff explanation). The MCP server gains branch + CodeRAG tools via the package.

**Tech Stack:** TypeScript, Node.js, `zod`, `vitest`, `uuid`, `@abhinav2203/codeflow-core`, `@abhinav2203/codeflow-store`, `@abhinav2203/coderag`

---

## Source Map

| Source File | Package Destination |
|------------|---------------------|
| `src/lib/blueprint/branches.ts` | `packages/codeflow-versioning/src/branch.ts` |
| `src/lib/blueprint/branch-store.ts` | `packages/codeflow-versioning/src/store.ts` |
| `src/lib/blueprint/branches.test.ts` | `packages/codeflow-versioning/src/branch.test.ts` |
| `src/app/api/branches/route.ts` | `packages/codeflow-versioning/src/invoke.ts` |
| `src/app/api/branches/[id]/route.ts` | `packages/codeflow-versioning/src/invoke.ts` (merged) |
| `src/app/api/branches/diff/route.ts` | `packages/codeflow-versioning/src/diff.ts` |
| `src/lib/coderag.ts` | `packages/codeflow-versioning/src/coderag/index.ts` (adapted) |
| `src/lib/coderag-agent.ts` | `packages/codeflow-versioning/src/coderag/agent.ts` (adapted) |
| *(new)* | `packages/codeflow-versioning/src/reasoning/index.ts` |
| *(new)* | `packages/codeflow-versioning/src/coderag/search.ts` |

Shared utilities (import from `@abhinav2203/codeflow-core`, do not copy):
- `src/lib/blueprint/store-paths.ts` → `branchDirForProject`, `branchPath` (already in `codeflow-store/src/shared/`)
- `src/lib/blueprint/schema.ts` → `GraphBranch`, `BranchDiff`, `NodeDiff`, `EdgeDiff`, all related schemas

Shared from `@abhinav2203/codeflow-store` (do not copy):
- `./branch` → `saveBranch`, `loadBranch`, `loadBranches`, `deleteBranch`
- `./reasoning` → `loadReasoningForRun`, `loadReasoningForProject`, `deleteReasoningForRun`
- `./checkpoint/reasoning` → `saveTaskReasoningCheckpoint`, `loadTaskReasoningCheckpoint`, `recoverRun`
- `./observability` → `loadObservabilitySnapshot`, `mergeObservabilitySnapshot`
- `./risk` → `assessExportRisk`

---

## Directory Structure

```
packages/codeflow-versioning/
├── src/
│   ├── branch.ts          # createBranch + diffBranches (from src/lib/blueprint/branches.ts)
│   ├── store.ts           # re-exports from codeflow-store/branch
│   ├── reasoning.ts       # reasoning checkpoint snapshot integration (NEW)
│   ├── invoke.ts          # async functions replacing Next.js route handlers
│   ├── diff.ts            # computeDiff replacement
│   ├── coderag/
│   │   ├── index.ts       # CodeRAG init + singleton manager for versioning context
│   │   ├── agent.ts       # buildAgentRetrievalQuery, formatAgentRetrievalPrompt (from src/lib/coderag-agent.ts)
│   │   └── search.ts      # queryBranches, explainBranchDiff (NEW)
│   ├── tools.ts           # MCP tool registrations
│   └── index.ts           # package barrel
├── test-fixtures/
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Step 0 — Scaffold Package Skeleton

- [ ] **Step 0.1: Create directory structure**

```bash
mkdir -p packages/codeflow-versioning/src/coderag
mkdir -p packages/codeflow-versioning/test-fixtures
```

- [ ] **Step 0.2: Create `packages/codeflow-versioning/package.json`**

```json
{
  "name": "@abhinav2203/codeflow-versioning",
  "version": "0.2.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./branch": { "types": "./dist/branch/index.d.ts", "default": "./dist/branch/index.js" },
    "./store": { "types": "./dist/store/index.d.ts", "default": "./dist/store/index.js" },
    "./reasoning": { "types": "./dist/reasoning/index.d.ts", "default": "./dist/reasoning/index.js" },
    "./coderag": { "types": "./dist/coderag/index.d.ts", "default": "./dist/coderag/index.js" }
  },
  "scripts": {
    "check": "tsc --noEmit",
    "test": "vitest run",
    "build": "tsc --outDir dist --declaration --declarationMap",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@abhinav2203/codeflow-core": "workspace:*",
    "@abhinav2203/codeflow-store": "workspace:*",
    "@abhinav2203/coderag": "^0.2.1",
    "uuid": "^11.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/uuid": "^10.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 0.3: Create `packages/codeflow-versioning/tsconfig.json`**

```json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 0.4: Create `packages/codeflow-versioning/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
```

- [ ] **Step 0.5: Run `npm install` in the package**

Run: `cd packages/codeflow-versioning && npm install`
Expected: Dependencies resolved without errors

- [ ] **Step 0.6: Commit**

```bash
cd packages/codeflow-versioning
git add package.json tsconfig.json vitest.config.ts
git commit -m "feat(versioning): scaffold package skeleton v0.2.0"
```

---

## Step 1 — Move `branches.ts` → `./branch`

- [ ] **Step 1.1: Create `packages/codeflow-versioning/src/branch.ts`**

Copy `src/lib/blueprint/branches.ts` content, with these changes:
- Remove `import type { ... } from "@/lib/blueprint/schema"` → import from `@abhinav2203/codeflow-core/schema`
- Remove `import { blueprintGraphSchema } from "@/lib/blueprint/schema"` → same
- Remove `import crypto from "node:crypto"` → use `uuid` package instead (`import { v4 as uuidv4 } from "uuid"`)
- `createBranchId` function: replace `crypto.randomUUID()` with `uuidv4()`
- Export both `createBranch` and `diffBranches`
- Export `createBranchId` for internal use

Key functions to export:
```typescript
export const createBranchId = (): string => uuidv4();
export const createBranch = ({ graph, name, description?, parentBranchId? }: { ... }): GraphBranch
export const diffBranches = (base: BlueprintGraph, compare: BlueprintGraph, baseId?, compareId?): BranchDiff
```

- [ ] **Step 1.2: Run check**

Run: `cd packages/codeflow-versioning && npm run check`
Expected: No TypeScript errors

- [ ] **Step 1.3: Run tests**

Run: `cd packages/codeflow-versioning && npm run test`
Expected: All tests pass

- [ ] **Step 1.4: Commit**

```bash
cd packages/codeflow-versioning
git add src/branch.ts
git commit -m "feat(versioning): move createBranch and diffBranches to branch module"
```

---

## Step 2 — Move `branch-store.ts` → `./store`

- [ ] **Step 2.1: Create `packages/codeflow-versioning/src/store.ts`**

Re-export from `@abhinav2203/codeflow-store/branch` — no copy needed, just re-export for package API surface:

```typescript
export { saveBranch, loadBranch, loadBranches, deleteBranch } from "@abhinav2203/codeflow-store/branch";
```

> **Note:** `branchDirForProject` and `branchPath` already exist in `codeflow-store/src/shared/utils.ts`. The package reuses them by importing from `@abhinav2203/codeflow-store` — no duplication needed.

- [ ] **Step 2.2: Run check and tests**

Run: `cd packages/codeflow-versioning && npm run check`
Expected: No TypeScript errors

- [ ] **Step 2.3: Commit**

```bash
cd packages/codeflow-versioning
git add src/store.ts
git commit -m "feat(versioning): re-export branch store from codeflow-store"
```

---

## Step 3 — Reasoning Integration (NEW)

This is the key v0.2.0 addition. When creating a branch, optionally snapshot reasoning checkpoints so the branch retains the full decision-making context.

- [ ] **Step 3.1: Create `packages/codeflow-versioning/src/reasoning/index.ts`**

```typescript
import type { ReasoningCheckpoint } from "@abhinav2203/codeflow-store/checkpoint/reasoning";
import { loadReasoningForRun, loadReasoningForProject } from "@abhinav2203/codeflow-store/reasoning";

export type BranchReasoningSnapshot = {
  runId: string;
  projectName: string;
  checkpoints: ReasoningCheckpoint[];
  savedAt: string;
};

/**
 * Snapshot reasoning checkpoints at branch creation time.
 * Call this when creating a branch to preserve the agent's decision context.
 *
 * Usage:
 *   const reasoning = await snapshotBranchReasoning(runId, projectName);
 *   // reasoning attached to GraphBranch.metadata.reasoning
 */
export const snapshotBranchReasoning = async (
  runId: string,
  projectName: string
): Promise<BranchReasoningSnapshot> => {
  const checkpoints = await loadReasoningForRun(runId, projectName);
  return {
    runId,
    projectName,
    checkpoints,
    savedAt: new Date().toISOString()
  };
};

/**
 * Load all reasoning snapshots across all runs for a project.
 * Useful for auditing which runs influenced which branches.
 */
export const loadBranchReasoningHistory = async (
  projectName: string
): Promise<BranchReasoningSnapshot[]> => {
  const summaries = await loadReasoningForProject(projectName);
  return summaries.map(({ runId, projectName: pn, checkpoints }) => ({
    runId,
    projectName: pn,
    checkpoints,
    savedAt: checkpoints[checkpoints.length - 1]?.savedAt ?? new Date().toISOString()
  }));
};

/**
 * Summarize reasoning content for a branch as a readable string.
 * Used by the CodeRAG search module to build retrieval queries.
 */
export const summarizeReasoningForBranch = (
  snapshot: BranchReasoningSnapshot
): string => {
  if (!snapshot.checkpoints.length) {
    return `Branch ${snapshot.runId}: No reasoning checkpoints recorded.`;
  }
  const lines = [
    `Reasoning snapshot for run ${snapshot.runId} (${snapshot.checkpoints.length} checkpoints):`
  ];
  for (const cp of snapshot.checkpoints) {
    lines.push(`\n--- Task: ${cp.taskId} ---`);
    lines.push(cp.content.slice(0, 500));
  }
  return lines.join("\n");
};
```

- [ ] **Step 3.2: Run check**

Run: `cd packages/codeflow-versioning && npm run check`
Expected: No TypeScript errors

- [ ] **Step 3.3: Commit**

```bash
cd packages/codeflow-versioning
git add src/reasoning/index.ts
git commit -m "feat(versioning): add reasoning checkpoint snapshot integration"
```

---

## Step 4 — Move API routes → `./invoke`

- [ ] **Step 4.1: Create `packages/codeflow-versioning/src/invoke.ts`**

Consolidate all three route files into a single invoke module. This replaces the Next.js route handlers with plain async functions callable without Next.js.

```typescript
// GET /branches?projectName=xxx
export const listBranches = async (projectName: string): Promise<GraphBranch[]>

// POST /branches
export const createBranch = async (payload: {
  graph: BlueprintGraph
  name: string
  description?: string
  parentBranchId?: string
  runId?: string          // NEW in v0.2.0: optionally snapshot reasoning
}): Promise<GraphBranch>

// GET /branches/:id?projectName=xxx
export const getBranch = async (
  projectName: string,
  branchId: string
): Promise<GraphBranch | null>

// DELETE /branches/:id?projectName=xxx
export const removeBranch = async (projectName: string, branchId: string): Promise<void>
```

For `createBranch`:
- Accept the same Zod schema as `src/app/api/branches/route.ts`
- Call `createBranch` from `./branch.ts`
- Call `saveBranch` from `./store.ts`
- **NEW in v0.2.0**: If `runId` is provided, call `snapshotBranchReasoning(runId, projectName)` and attach the snapshot to `branch.metadata.reasoning`
- Return the created `GraphBranch`

For `listBranches`:
- Accept `projectName: string`
- Call `loadBranches` from `./store.ts`
- Return `GraphBranch[]`

For `getBranch`:
- Accept `projectName` and `branchId` (validate with same regex as original route)
- Call `loadBranch` from `./store.ts`
- Return `null` if not found

For `removeBranch`:
- Accept `projectName` and `branchId` (validate with same regex)
- Call `deleteBranch` from `./store.ts`

- [ ] **Step 4.2: Create `packages/codeflow-versioning/src/diff.ts`**

```typescript
export const computeDiff = async (payload: {
  baseGraph: BlueprintGraph
  compareGraph: BlueprintGraph
  baseId?: string
  compareId?: string
}): Promise<BranchDiff>
```

- Call `diffBranches` from `./branch.ts`
- Return the `BranchDiff` result

- [ ] **Step 4.3: Run check**

Run: `cd packages/codeflow-versioning && npm run check`
Expected: No TypeScript errors

- [ ] **Step 4.4: Commit**

```bash
cd packages/codeflow-versioning
git add src/invoke.ts src/diff.ts
git commit -m "feat(versioning): move API routes to invoke module"
```

---

## Step 5 — CodeRAG Integration (NEW)

This is the core differentiator. CodeRAG lets you query branches by *what they do*, not just by name/date, and explains diffs in natural language.

### Step 5.1 — Core CodeRAG wrapper

- [ ] **Create `packages/codeflow-versioning/src/coderag/index.ts`**

Adapts `src/lib/coderag.ts` for use in the versioning package. Since `@abhinav2203/coderag` is a runtime dependency, not just a dev dependency, we wrap it here.

```typescript
import path from "node:path";
import {
  CodeRag,
  createCodeRag,
  loadSerializableConfig,
  resolveRuntimeConfig
} from "@abhinav2203/coderag";
import { branchDirForProject } from "@abhinav2203/codeflow-store/shared";

let instance: CodeRag | null = null;

export interface CodeRagConfig {
  projectName: string;
  repoPath: string;
  docsPath?: string;
  embeddingProvider?: "local-hash" | "openai" | "gemini";
}

export async function initCodeRagForProject(config: CodeRagConfig): Promise<CodeRag> {
  const { projectName, repoPath, docsPath, embeddingProvider = "local-hash" } = config;
  const resolvedRepoPath = path.resolve(repoPath);
  const resolvedDocsPath = docsPath ? path.resolve(docsPath) : undefined;
  const storageRoot = path.join(branchDirForProject(projectName), ".coderag");
  const serializableConfig = await loadSerializableConfig(process.cwd(), undefined);

  serializableConfig.repoPath = resolvedRepoPath;
  serializableConfig.storageRoot = storageRoot;
  serializableConfig.docsPath = resolvedDocsPath;
  serializableConfig.embedding.provider = embeddingProvider;

  const runtimeConfig = resolveRuntimeConfig(serializableConfig, process.cwd());

  if (instance) {
    await instance.close().catch(() => undefined);
  }

  instance = createCodeRag(runtimeConfig);
  await instance.index({ docsPath: resolvedDocsPath });
  return instance;
}

export function getCodeRagInstance(): CodeRag | null {
  return instance;
}

export async function closeCodeRagInstance(): Promise<void> {
  if (instance) {
    await instance.close();
    instance = null;
  }
}
```

### Step 5.2 — Agent retrieval utilities

- [ ] **Create `packages/codeflow-versioning/src/coderag/agent.ts`**

Adapts `src/lib/coderag-agent.ts`. Key changes:
- Import `getCodeRagInstance` from `./index.ts` instead of `getCodeRag` from `@/lib/coderag`
- Remove any Next.js-specific references

```typescript
import type { QueryResult, RetrievedNodeContext } from "@abhinav2203/coderag";
import type { BlueprintNode } from "@abhinav2203/codeflow-core/schema";
import { getCodeRagInstance } from "./index.js";

export const buildAgentRetrievalQuery = ({ node, relatedNodes, instruction }: ...) => { ... }
export const formatAgentRetrievalPrompt = (result: QueryResult) => { ... }
export const resolveAgentRetrievalContext = async ({ node, relatedNodes, ... }: ...) => { ... }
```

See `src/lib/coderag-agent.ts` for full implementation — copy verbatim with the single import swap noted above.

### Step 5.3 — Semantic branch search and diff explanation (NEW)

> **Bug fix required:** In `formatStructuralDiff`, the last conditional reads `if (focusOn === "edges" || focusOn === "edges")` — change the second `"edges"` to `"nodes"`.

This is the killer feature: use CodeRAG to search branches semantically and explain diffs.

- [ ] **Create `packages/codeflow-versioning/src/coderag/search.ts`**

```typescript
import type { QueryResult } from "@abhinav2203/coderag";
import type { GraphBranch, BranchDiff, BlueprintNode } from "@abhinav2203/codeflow-core/schema";
import { getCodeRagInstance } from "./index.js";
import { loadBranches } from "../store.js";
import { diffBranches } from "../branch.js";
import { summarizeReasoningForBranch } from "../reasoning/index.js";
import { buildAgentRetrievalQuery, formatAgentRetrievalPrompt } from "./agent.js";

export interface BranchSearchResult {
  branch: GraphBranch;
  query: string;
  relevanceScore: number;
  explanation: string;
}

/**
 * Search all branches for a project using natural language.
 * Uses CodeRAG to find branches whose names, descriptions, or graph context
 * match the query, then falls back to keyword matching if CodeRAG is not initialized.
 *
 * Usage:
 *   const results = await searchBranches({ projectName: "my-app", query: "authentication refactor" });
 */
export const searchBranches = async ({
  projectName,
  query,
  limit = 5
}: {
  projectName: string;
  query: string;
  limit?: number;
}): Promise<BranchSearchResult[]> => {
  const codeRag = getCodeRagInstance();
  const allBranches = await loadBranches(projectName);

  if (!codeRag) {
    // Fallback: simple keyword search
    const lower = query.toLowerCase();
    return allBranches
      .filter(b => b.name.toLowerCase().includes(lower) || b.description?.toLowerCase().includes(lower))
      .slice(0, limit)
      .map(branch => ({
        branch,
        query,
        relevanceScore: 1,
        explanation: `Keyword match for "${query}" in branch name/description`
      }));
  }

  // Score branches by CodeRAG relevance
  const scored = await Promise.all(
    allBranches.map(async (branch) => {
      try {
        const branchQuery = buildBranchSearchQuery(branch);
        const result = await codeRag.query(`${query} ${branchQuery}`, { depth: 2 });
        return {
          branch,
          score: result.context.primaryNode ? 0.8 : 0.3,
          explanation: result.answer ?? formatBranchSummary(branch)
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
    .map(s => ({ branch: s.branch, query, relevanceScore: s.score, explanation: s.explanation }));
};

/**
 * Explain a branch diff in natural language using CodeRAG.
 * Instead of just structural changes, provides a semantic explanation of what changed and why.
 *
 * Usage:
 *   const explanation = await explainBranchDiff({
 *     baseBranch,
 *     compareBranch,
 *     focusOn?: "nodes" | "edges" | "reasoning"
 *   });
 */
export const explainBranchDiff = async ({
  baseBranch,
  compareBranch,
  focusOn = "nodes"
}: {
  baseBranch: GraphBranch;
  compareBranch: GraphBranch;
  focusOn?: "nodes" | "edges" | "reasoning";
}): Promise<string> => {
  const codeRag = getCodeRagInstance();
  const structuralDiff = diffBranches(baseBranch.graph, compareBranch.graph, baseBranch.id, compareBranch.id);

  if (!codeRag) {
    return formatStructuralDiff(structuralDiff, focusOn);
  }

  // Build a context-rich query for CodeRAG
  const contextParts = [
    `Comparing branch "${baseBranch.name}" (${baseBranch.id}) to branch "${compareBranch.name}" (${compareBranch.id}).`,
    focusOn === "reasoning"
      ? `Focus: reasoning differences between the two branches.`
      : `Focus: ${focusOn} changes.`,
    summarizeReasoningForBranch(baseBranch.metadata?.reasoning ?? { runId: "", projectName: "", checkpoints: [], savedAt: "" }),
    `Structural diff summary: ${formatStructuralDiff(structuralDiff, focusOn)}`
  ];

  try {
    const result = await codeRag.query(contextParts.join("\n"), { depth: 3 });
    return formatAgentRetrievalPrompt(result);
  } catch {
    return formatStructuralDiff(structuralDiff, focusOn);
  }
};

// ─── Internal helpers ───────────────────────────────────────────────────────────

const buildBranchSearchQuery = (branch: GraphBranch): string => {
  const nodeNames = branch.graph.nodes.map(n => n.name).join(", ");
  const purposes = branch.graph.nodes
    .filter(n => n.contract?.responsibilities?.length)
    .flatMap(n => n.contract!.responsibilities!)
    .join("; ");
  return `Branch "${branch.name}": ${branch.description ?? ""}. Nodes: ${nodeNames}. Responsibilities: ${purposes}.`;
};

const formatBranchSummary = (branch: GraphBranch): string => {
  const nodeCount = branch.graph.nodes.length;
  const edgeCount = branch.graph.edges.length;
  return `Branch "${branch.name}" created ${branch.createdAt}: ${nodeCount} nodes, ${edgeCount} edges.`;
};

const formatStructuralDiff = (diff: BranchDiff, focusOn: "nodes" | "edges" | "reasoning"): string => {
  const lines = [`Diff: ${diff.baseId ?? "base"} → ${diff.compareId ?? "compare"}`];
  if (focusOn === "nodes" || focusOn === "edges") {
    if (diff.nodes.added.length) lines.push(`+ ${diff.nodes.added.length} nodes added`);
    if (diff.nodes.removed.length) lines.push(`- ${diff.nodes.removed.length} nodes removed`);
    if (diff.nodes.modified.length) lines.push(`~ ${diff.nodes.modified.length} nodes modified`);
  }
  if (focusOn === "edges" || focusOn === "nodes") {
    if (diff.edges.added.length) lines.push(`+ ${diff.edges.added.length} edges added`);
    if (diff.edges.removed.length) lines.push(`- ${diff.edges.removed.length} edges removed`);
  }
  return lines.join("\n");
};
```

- [ ] **Step 5.4: Run check**

Run: `cd packages/codeflow-versioning && npm run check`
Expected: No TypeScript errors

- [ ] **Step 5.5: Commit**

```bash
cd packages/codeflow-versioning
git add src/coderag/index.ts src/coderag/agent.ts src/coderag/search.ts
git commit -m "feat(versioning): add CodeRAG integration for semantic branch search and diff explanation"
```

---

## Step 6 — Wire Next.js app to import from package

> **Bug fix required:** Step 6.2 (`[id]/route.ts`) — `getBranch` and `removeBranch` are in `invoke.ts`, NOT `./branch.ts`. The import must be from `@abhinav2203/codeflow-versioning` (barrel) or from `./invoke`. Do NOT import from `./branch`.

- [ ] **Step 6.1: Replace `src/app/api/branches/route.ts`** with:

```typescript
import { createBranch, listBranches } from "@abhinav2203/codeflow-versioning/branch";
import { saveBranch, loadBranches } from "@abhinav2203/codeflow-versioning/store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectName = searchParams.get("projectName");
  if (!projectName) {
    return NextResponse.json({ error: "projectName required" }, { status: 400 });
  }
  const branches = await listBranches(projectName);
  return NextResponse.json({ branches });
}

export async function POST(request: Request) {
  try {
    const { graph, name, description, parentBranchId, runId } = await request.json();
    const branch = await createBranch({ graph, name, description, parentBranchId, runId });
    await saveBranch(branch);
    return NextResponse.json({ branch });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create branch." },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 6.2: Replace `src/app/api/branches/[id]/route.ts`** with:

```typescript
import { getBranch, removeBranch } from "@abhinav2203/codeflow-versioning/branch";
import { loadBranch, deleteBranch } from "@abhinav2203/codeflow-versioning/store";

// GET /branches/:id
export async function GET(...) { ... }

// DELETE /branches/:id
export async function DELETE(...) { ... }
```

- [ ] **Step 6.3: Replace `src/app/api/branches/diff/route.ts`** with:

```typescript
import { computeDiff } from "@abhinav2203/codeflow-versioning/diff";

export async function POST(request: Request) {
  try {
    const diff = await computeDiff(await request.json());
    return NextResponse.json({ diff });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute diff." },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 6.4: Run full app type check**

Run: `cd /Users/abhinavnehra/git/CodeFlow && npm run check`
Expected: No TypeScript errors

- [ ] **Step 6.5: Commit**

```bash
cd /Users/abhinavnehra/git/CodeFlow
git add src/app/api/branches/route.ts src/app/api/branches/\[id\]/route.ts src/app/api/branches/diff/route.ts
git commit -m "feat(versioning): wire branches API routes to @abhinav2203/codeflow-versioning"
```

---

## Step 7 — Add MCP tools

- [ ] **Step 7.1: Create `packages/codeflow-versioning/src/tools.ts`**

Register these tools in the MCP registry:

```typescript
// tool: versioning_branch_list
// args: { projectName: string }
// returns: { branches: GraphBranch[] }

// tool: versioning_branch_create
// args: { projectName: string, graph: BlueprintGraph, name: string, description?: string, parentBranchId?: string, runId?: string }
// returns: { branch: GraphBranch }

// tool: versioning_branch_get
// args: { projectName: string, branchId: string }
// returns: { branch: GraphBranch } | { error: string }

// tool: versioning_branch_delete
// args: { projectName: string, branchId: string }
// returns: { deleted: true }

// tool: versioning_diff
// args: { baseGraph: BlueprintGraph, compareGraph: BlueprintGraph, baseId?: string, compareId?: string }
// returns: { diff: BranchDiff }

// tool: versioning_reasoning_snapshot
// args: { projectName: string, runId: string }
// returns: { snapshot: BranchReasoningSnapshot }

// tool: versioning_branch_search   // NEW v0.2.0
// args: { projectName: string, query: string, limit?: number }
// returns: { results: BranchSearchResult[] }

// tool: versioning_explain_diff     // NEW v0.2.0
// args: { baseBranch: GraphBranch, compareBranch: GraphBranch, focusOn?: "nodes" | "edges" | "reasoning" }
// returns: { explanation: string }
```

- [ ] **Step 7.2: Register tools in `codeflow-mcp`**

In `packages/codeflow-mcp/src/tools.ts`, add:

```typescript
import { versioningTools } from "@abhinav2203/codeflow-versioning/tools";

// Merge into existing tools registry
export const allTools = [...baseTools, ...versioningTools];
```

- [ ] **Step 7.3: Run check and tests**

Run: `cd packages/codeflow-versioning && npm run check && npm run test`
Expected: Both pass

- [ ] **Step 7.4: Commit**

```bash
cd packages/codeflow-versioning
git add src/tools.ts
git commit -m "feat(versioning): add MCP tools for branch and diff operations"
```

---

## Step 8 — Final verification

- [ ] **Step 8.1: Run all package checks**

Run: `cd packages/codeflow-versioning && npm run check && npm run test && npm run build`
Expected: `tsc --noEmit` passes, `vitest run` passes, build produces `dist/` with all entry points

- [ ] **Step 8.2: Verify app still works**

Run: `cd /Users/abhinavnehra/git/CodeFlow && npm run check`
Expected: App type-checks with the rewired routes

---

## Summary of all changes

| File | Action |
|------|--------|
| `packages/codeflow-versioning/` | Created — all package source lives here |
| `src/lib/blueprint/branches.ts` | Stays (used by workspace dependency) |
| `src/lib/blueprint/branch-store.ts` | Stays (used by workspace dependency) |
| `src/lib/coderag.ts` | Adapted → `src/coderag/index.ts` |
| `src/lib/coderag-agent.ts` | Adapted → `src/coderag/agent.ts` |
| `src/app/api/branches/route.ts` | Replaced with re-export from package |
| `src/app/api/branches/[id]/route.ts` | Replaced with re-export from package |
| `src/app/api/branches/diff/route.ts` | Replaced with re-export from package |

---

## What each codeflow-store module contributes to versioning

| Module | Used in versioning for |
|--------|-----------------------|
| `./branch` | Persistence for `GraphBranch` JSON files |
| `./reasoning` | Snapshot and load reasoning checkpoints at branch time |
| `./checkpoint/reasoning` | Fine-grained checkpoint save/load within reasoning snapshots |
| `./observability` | Optionally attach observability snapshot to branch metadata |
| `./risk` | Optionally attach risk report to branch metadata |

---

## Bug register — fix during implementation

| # | File | Bug | Fix |
|---|------|-----|-----|
| 1 | `coderag/search.ts` (`formatStructuralDiff`) | `if (focusOn === "edges" \|\| focusOn === "edges")` — second operand is redundant | Change second `"edges"` to `"nodes"` |
| 2 | `src/app/api/branches/[id]/route.ts` (Step 6.2) | Imports `getBranch`/`removeBranch` from `"./branch"` | Import from `@abhinav2203/codeflow-versioning` (barrel) or from `./invoke` |

---

## Key design decisions

1. **`coderag` is a runtime dependency, not just dev** — The package actually calls `createCodeRag()` and `codeRag.query()`. It's listed in `dependencies` (with a version ceiling).

2. **CodeRAG singleton is scoped to the versioning package** — `getCodeRagInstance()` is a module-level singleton. The app initializes it via `initCodeRagForProject()` before using search/explain tools.

3. **Graceful degradation** — If CodeRAG is not initialized, `searchBranches` falls back to keyword matching and `explainBranchDiff` returns a structural diff. No hard failures.

4. **`runId` is optional in `createBranch`** — Reasoning snapshots are only captured if `runId` is provided. This avoids breaking existing callers that don't pass `runId`.

5. **No new schema types** — `BranchReasoningSnapshot` is defined in TypeScript only; it doesn't need a Zod schema because it's an internal shape constructed by the package, not parsed from external input.
