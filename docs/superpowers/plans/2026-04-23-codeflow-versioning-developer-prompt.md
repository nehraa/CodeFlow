# Developer Prompt — `codeflow-versioning` v0.2.0 Full Implementation

> This is the canonical prompt to hand to a developer agent (or run yourself) for the complete implementation of the `codeflow-versioning` npm package. Follow the phases in order. Fix the bugs noted in each phase before proceeding to the next.

---

## Context

You are building `@abhinav2203/codeflow-versioning` v0.2.0 — a standalone npm package that extracts blueprint branching, diff, and reasoning-snapshot functionality from a Next.js app into a reusable package with deep CodeRAG integration.

**Tech stack:** TypeScript, Node.js, `zod`, `vitest`, `uuid`, `@abhinav2203/codeflow-core`, `@abhinav2203/codeflow-store`, `@abhinav2203/coderag`

**Package location:** `packages/codeflow-versioning/`

**Key prior art (read these files first):**
- `src/lib/blueprint/branches.ts` — source for `createBranch` and `diffBranches`
- `src/lib/blueprint/branch-store.ts` — source for store persistence (already re-exported by `codeflow-store/branch`)
- `src/app/api/branches/route.ts` — source for invoke logic
- `src/app/api/branches/[id]/route.ts` — source for get/remove logic
- `src/app/api/branches/diff/route.ts` — source for diff logic
- `src/lib/coderag.ts` — source for CodeRAG initialization
- `src/lib/coderag-agent.ts` — source for CodeRAG agent utilities
- `packages/codeflow-store/src/branch/index.ts` — re-export from here
- `packages/codeflow-store/src/reasoning/index.ts` — re-export from here
- `packages/codeflow-store/src/checkpoint/reasoning.ts` — re-export from here
- `node_modules/@abhinav2203/coderag/dist/types.d.ts` — CodeRAG TypeScript types

**Schema sources (import from `@abhinav2203/codeflow-core/schema`, do not copy):**
- `GraphBranch`, `BranchDiff`, `NodeDiff`, `EdgeDiff`, `BlueprintGraph`, `BlueprintNode`, `ObservabilitySnapshot`, `ReasoningCheckpoint`

**Store paths (import from `@abhinav2203/codeflow-store/shared`, do not copy):**
- `branchDirForProject`, `branchPath`, `reasoningCheckpointDir`, `reasoningBasePath`

**Known bugs to fix during implementation:**
1. `formatStructuralDiff` in `coderag/search.ts` — duplicate condition: `if (focusOn === "edges" || focusOn === "edges")` — change second `"edges"` to `"nodes"`
2. Step 6.2 import path — `getBranch`/`removeBranch` live in `invoke.ts`, not `./branch.ts` — import from the barrel `index.ts`

---

## PHASE 0 — Scaffold

Create the package skeleton. All steps are sequential.

### Step 0.1 — Create directory structure

```bash
mkdir -p packages/codeflow-versioning/src/coderag
mkdir -p packages/codeflow-versioning/test-fixtures
```

### Step 0.2 — Create `packages/codeflow-versioning/package.json`

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

### Step 0.3 — Create `packages/codeflow-versioning/tsconfig.json`

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

### Step 0.4 — Create `packages/codeflow-versioning/vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
```

### Step 0.5 — Install dependencies

```bash
cd packages/codeflow-versioning && npm install
```

### Step 0.6 — Commit

```bash
cd packages/codeflow-versioning
git add package.json tsconfig.json vitest.config.ts
git commit -m "feat(versioning): scaffold package skeleton v0.2.0"
```

---

## PHASE 1 — Core modules (Steps 1, 2, 3 run in parallel)

### Step 1 — `src/branch/index.ts` — createBranch + diffBranches

**File:** `packages/codeflow-versioning/src/branch/index.ts`

Copy the logic from `src/lib/blueprint/branches.ts` with these changes:
- Replace `import crypto from "node:crypto"` with `import { v4 as uuidv4 } from "uuid"`
- Replace `createBranchId()` body: `return crypto.randomUUID()` → `return uuidv4()`
- Replace all `@/lib/blueprint/schema` imports with `@abhinav2203/codeflow-core/schema`
- Keep the Zod schemas (`blueprintGraphSchema`) from `@abhinav2203/codeflow-core/schema`
- The `edgeIncidenceCache` WeakMap and all helper functions (`nodeKey`, `edgeKey`, `getEdgeIncidenceMap`, `countImpactedEdges`) stay inline — they are private to this module
- Export: `createBranchId`, `createBranch`, `diffBranches`

**Signatures:**
```typescript
export const createBranchId = (): string => uuidv4();

export const createBranch = ({
  graph,
  name,
  description,
  parentBranchId
}: {
  graph: BlueprintGraph;
  name: string;
  description?: string;
  parentBranchId?: string;
}): GraphBranch

export const diffBranches = (
  base: BlueprintGraph,
  compare: BlueprintGraph,
  baseId?: string,
  compareId?: string
): BranchDiff
```

**Run check:** `cd packages/codeflow-versioning && npm run check`
**Run tests:** `cd packages/codeflow-versioning && npm run test`

**Commit:**
```bash
cd packages/codeflow-versioning
git add src/branch/index.ts
git commit -m "feat(versioning): move createBranch and diffBranches to branch module"
```

---

### Step 2 — `src/store/index.ts` — re-export from codeflow-store

**File:** `packages/codeflow-versioning/src/store/index.ts`

This module re-exports persistence functions from `codeflow-store/branch`. No copy needed.

```typescript
// Re-export save/load/delete from @abhinav2203/codeflow-store/branch
export {
  saveBranch,
  loadBranch,
  loadBranches,
  deleteBranch
} from "@abhinav2203/codeflow-store/branch";
```

**Run check:** `cd packages/codeflow-versioning && npm run check`

**Commit:**
```bash
cd packages/codeflow-versioning
git add src/store/index.ts
git commit -m "feat(versioning): re-export branch store from codeflow-store"
```

---

### Step 3 — `src/reasoning/index.ts` — reasoning checkpoint snapshots (NEW)

**File:** `packages/codeflow-versioning/src/reasoning/index.ts`

This module attaches reasoning checkpoint context to branches at creation time. It imports from `codeflow-store/reasoning` and `codeflow-store/checkpoint/reasoning`.

```typescript
import type { ReasoningCheckpoint } from "@abhinav2203/codeflow-store/checkpoint/reasoning";
import {
  loadReasoningForRun,
  loadReasoningForProject
} from "@abhinav2203/codeflow-store/reasoning";

/**
 * A reasoning snapshot captured at branch creation time.
 */
export type BranchReasoningSnapshot = {
  runId: string;
  projectName: string;
  checkpoints: ReasoningCheckpoint[];
  savedAt: string;
};

/**
 * Snapshot all reasoning checkpoints for a given run and project.
 * Call this when creating a branch to preserve the agent's decision context.
 *
 * @example
 * const reasoning = await snapshotBranchReasoning(runId, projectName);
 * // attach reasoning to branch.metadata.reasoning
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
 * Returns summaries sorted by save time, newest last.
 */
export const loadBranchReasoningHistory = async (
  projectName: string
): Promise<BranchReasoningSnapshot[]> => {
  const summaries = await loadReasoningForProject(projectName);
  return summaries.map(({ runId, projectName: pn, checkpoints }) => ({
    runId,
    projectName: pn,
    checkpoints,
    savedAt:
      checkpoints.length > 0
        ? checkpoints[checkpoints.length - 1]!.savedAt
        : new Date().toISOString()
  }));
};

/**
 * Format a reasoning snapshot as a readable string for CodeRAG queries.
 */
export const summarizeReasoningForBranch = (
  snapshot: BranchReasoningSnapshot
): string => {
  if (snapshot.checkpoints.length === 0) {
    return `Branch ${snapshot.runId}: No reasoning checkpoints recorded.`;
  }
  const lines: string[] = [
    `Reasoning snapshot for run ${snapshot.runId} (${snapshot.checkpoints.length} checkpoints):`
  ];
  for (const cp of snapshot.checkpoints) {
    lines.push(`\n--- Task: ${cp.taskId} ---`);
    lines.push(cp.content.slice(0, 500));
  }
  return lines.join("\n");
};
```

**Run check:** `cd packages/codeflow-versioning && npm run check`

**Commit:**
```bash
cd packages/codeflow-versioning
git add src/reasoning/index.ts
git commit -m "feat(versioning): add reasoning checkpoint snapshot integration"
```

---

## PHASE 2 — Invoke/diff layer (Steps 4 and 5 run in parallel)

### Step 4 — `src/invoke.ts` + `src/diff.ts`

#### `packages/codeflow-versioning/src/invoke.ts`

Consolidates all three Next.js route handlers into plain async functions. The Zod schema for request validation comes from `@abhinav2203/codeflow-core/schema` (`blueprintGraphSchema`).

```typescript
import { z } from "zod";
import { createBranchId } from "./branch/index.js";
import { diffBranches } from "./branch/index.js";
import { saveBranch, loadBranch, loadBranches, deleteBranch } from "./store/index.js";
import {
  blueprintGraphSchema,
  type BlueprintGraph,
  type GraphBranch
} from "@abhinav2203/codeflow-core/schema";
import { snapshotBranchReasoning } from "./reasoning/index.js";

const createBranchRequestSchema = z.object({
  graph: blueprintGraphSchema,
  name: z.string().trim().min(1),
  description: z.string().optional(),
  parentBranchId: z.string().optional(),
  runId: z.string().optional()  // NEW v0.2.0: optionally snapshot reasoning
});

/**
 * List all branches for a project.
 */
export const listBranches = async (projectName: string): Promise<GraphBranch[]> => {
  if (!projectName || typeof projectName !== "string" || !projectName.trim()) {
    throw new Error("projectName must be a non-empty string");
  }
  return loadBranches(projectName);
};

/**
 * Create a new branch. Optionally snapshots reasoning if runId is provided.
 */
export const createBranch = async (payload: {
  graph: BlueprintGraph;
  name: string;
  description?: string;
  parentBranchId?: string;
  runId?: string;
}): Promise<GraphBranch> => {
  const parsed = createBranchRequestSchema.parse(payload);
  const branch: GraphBranch = {
    id: createBranchId(),
    name: parsed.name,
    description: parsed.description,
    projectName: parsed.graph.projectName,
    parentBranchId: parsed.parentBranchId,
    createdAt: new Date().toISOString(),
    graph: parsed.graph
  };

  // v0.2.0: attach reasoning snapshot if runId provided
  if (parsed.runId) {
    const reasoning = await snapshotBranchReasoning(parsed.runId, branch.projectName);
    (branch as any).metadata = {
      ...((branch as any).metadata ?? {}),
      reasoning
    };
  }

  await saveBranch(branch);
  return branch;
};

/**
 * Get a single branch by ID.
 */
export const getBranch = async (
  projectName: string,
  branchId: string
): Promise<GraphBranch | null> => {
  if (!projectName || typeof projectName !== "string" || !projectName.trim()) {
    throw new Error("projectName must be a non-empty string");
  }
  if (!branchId || typeof branchId !== "string" || !/^[A-Za-z0-9_-]+$/.test(branchId)) {
    throw new Error("Invalid branch id");
  }
  return loadBranch(projectName, branchId);
};

/**
 * Delete a branch by ID.
 */
export const removeBranch = async (projectName: string, branchId: string): Promise<void> => {
  if (!projectName || typeof projectName !== "string" || !projectName.trim()) {
    throw new Error("projectName must be a non-empty string");
  }
  if (!branchId || typeof branchId !== "string" || !/^[A-Za-z0-9_-]+$/.test(branchId)) {
    throw new Error("Invalid branch id");
  }
  await deleteBranch(projectName, branchId);
};
```

#### `packages/codeflow-versioning/src/diff.ts`

```typescript
import { z } from "zod";
import { diffBranches } from "./branch/index.js";
import {
  blueprintGraphSchema,
  type BlueprintGraph,
  type BranchDiff
} from "@abhinav2203/codeflow-core/schema";

const diffRequestSchema = z.object({
  baseGraph: blueprintGraphSchema,
  compareGraph: blueprintGraphSchema,
  baseId: z.string().optional(),
  compareId: z.string().optional()
});

/**
 * Compute the structural diff between two blueprint graphs.
 */
export const computeDiff = async (payload: {
  baseGraph: BlueprintGraph;
  compareGraph: BlueprintGraph;
  baseId?: string;
  compareId?: string;
}): Promise<BranchDiff> => {
  const parsed = diffRequestSchema.parse(payload);
  return diffBranches(
    parsed.baseGraph,
    parsed.compareGraph,
    parsed.baseId ?? "base",
    parsed.compareId ?? "compare"
  );
};
```

**Run check:** `cd packages/codeflow-versioning && npm run check`

**Commit:**
```bash
cd packages/codeflow-versioning
git add src/invoke.ts src/diff.ts
git commit -m "feat(versioning): consolidate API routes into invoke module"
```

---

### Step 5 — CodeRAG Integration (three files)

#### Step 5.1 — `src/coderag/index.ts` — CodeRAG init + singleton

**File:** `packages/codeflow-versioning/src/coderag/index.ts`

Adapts `src/lib/coderag.ts` for the versioning package. Key change: uses `branchDirForProject` from `codeflow-store/shared` as the storage root.

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
  embeddingProvider?: "local-hash" | "gemini";
}

/**
 * Initialize CodeRAG for a project. Call once before using search/explain.
 */
export const initCodeRagForProject = async (config: CodeRagConfig): Promise<CodeRag> => {
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
};

export const getCodeRagInstance = (): CodeRag | null => instance;

export const closeCodeRagInstance = async (): Promise<void> => {
  if (instance) {
    await instance.close();
    instance = null;
  }
};
```

#### Step 5.2 — `src/coderag/agent.ts` — CodeRAG agent utilities

**File:** `packages/codeflow-versioning/src/coderag/agent.ts`

Copy from `src/lib/coderag-agent.ts` with **one change**: replace `import { getCodeRag } from "@/lib/coderag"` with `import { getCodeRagInstance } from "./index.js"`.

Also replace the function name `getCodeRag` → `getCodeRagInstance` throughout the body wherever it appears (the `resolveAgentRetrievalContext` function calls it).

All other logic remains identical:
- `buildAgentRetrievalQuery` — builds a query string from node + related nodes + instruction
- `formatAgentRetrievalPrompt` — formats a QueryResult as a readable prompt string
- `formatAgentRetrievalNote` — formats retrieval context as a short note string
- `resolveAgentRetrievalContext` — performs the actual CodeRAG query and returns context
- `AgentRetrievalContext` type
- All helper functions: `clampDepth`, `compactList`, `lineRangeLabel`, `createExcerpt`, `formatRetrievedNode`

#### Step 5.3 — `src/coderag/search.ts` — Semantic branch search + diff explanation (NEW)

**File:** `packages/codeflow-versioning/src/coderag/search.ts`

This is the killer feature. Two public functions:

**`searchBranches`** — natural language search across all branches:
```typescript
export const searchBranches = async ({
  projectName,
  query,
  limit = 5
}: {
  projectName: string;
  query: string;
  limit?: number;
}): Promise<BranchSearchResult[]>
```

**`explainBranchDiff`** — CodeRAG-powered natural language diff explanation:
```typescript
export const explainBranchDiff = async ({
  baseBranch,
  compareBranch,
  focusOn = "nodes"
}: {
  baseBranch: GraphBranch;
  compareBranch: GraphBranch;
  focusOn?: "nodes" | "edges" | "reasoning";
}): Promise<string>
```

Full implementation:

```typescript
import type { QueryResult } from "@abhinav2203/coderag";
import type { GraphBranch, BranchDiff, BlueprintNode } from "@abhinav2203/codeflow-core/schema";
import { getCodeRagInstance } from "./index.js";
import { loadBranches } from "../store/index.js";
import { diffBranches } from "../branch/index.js";
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
 * Falls back to keyword matching if CodeRAG is not initialized.
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
    const lower = query.toLowerCase();
    return allBranches
      .filter(
        (b) =>
          b.name.toLowerCase().includes(lower) ||
          b.description?.toLowerCase().includes(lower)
      )
      .slice(0, limit)
      .map((branch) => ({
        branch,
        query,
        relevanceScore: 1,
        explanation: `Keyword match for "${query}" in branch name/description`
      }));
  }

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
    .map((s) => ({
      branch: s.branch,
      query,
      relevanceScore: s.score,
      explanation: s.explanation
    }));
};

/**
 * Explain a branch diff in natural language using CodeRAG.
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
  const structuralDiff = diffBranches(
    baseBranch.graph,
    compareBranch.graph,
    baseBranch.id,
    compareBranch.id
  );

  if (!codeRag) {
    return formatStructuralDiff(structuralDiff, focusOn);
  }

  const baseReasoning = (baseBranch as any).metadata?.reasoning;
  const compareReasoning = (compareBranch as any).metadata?.reasoning;

  const contextParts = [
    `Comparing branch "${baseBranch.name}" (${baseBranch.id}) to branch "${compareBranch.name}" (${compareBranch.id}).`,
    focusOn === "reasoning"
      ? "Focus: reasoning differences between the two branches."
      : `Focus: ${focusOn} changes.`,
    baseReasoning
      ? summarizeReasoningForBranch(baseReasoning)
      : "No reasoning snapshot for base branch.",
    compareReasoning
      ? summarizeReasoningForBranch(compareReasoning)
      : "No reasoning snapshot for compare branch.",
    `Structural diff: ${formatStructuralDiff(structuralDiff, focusOn)}`
  ];

  try {
    const result = await codeRag.query(contextParts.join("\n"), { depth: 3 });
    return formatAgentRetrievalPrompt(result);
  } catch {
    return formatStructuralDiff(structuralDiff, focusOn);
  }
};

// ─── Internal helpers ──────────────────────────────────────────────────────────

const buildBranchSearchQuery = (branch: GraphBranch): string => {
  const nodeNames = branch.graph.nodes.map((n) => n.name).join(", ");
  const purposes = branch.graph.nodes
    .filter((n) => n.contract?.responsibilities?.length)
    .flatMap((n) => n.contract!.responsibilities!)
    .join("; ");
  return `Branch "${branch.name}": ${branch.description ?? ""}. Nodes: ${nodeNames}. Responsibilities: ${purposes}.`;
};

const formatBranchSummary = (branch: GraphBranch): string => {
  return `Branch "${branch.name}" created ${branch.createdAt}: ${branch.graph.nodes.length} nodes, ${branch.graph.edges.length} edges.`;
};

const formatStructuralDiff = (
  diff: BranchDiff,
  focusOn: "nodes" | "edges" | "reasoning"
): string => {
  const lines: string[] = [
    `Diff: ${diff.baseId ?? "base"} → ${diff.compareId ?? "compare"}`
  ];

  if (focusOn === "nodes" || focusOn === "edges") {
    if (diff.nodes.added.length)
      lines.push(`+ ${diff.nodes.added.length} nodes added`);
    if (diff.nodes.removed.length)
      lines.push(`- ${diff.nodes.removed.length} nodes removed`);
    if (diff.nodes.modified.length)
      lines.push(`~ ${diff.nodes.modified.length} nodes modified`);
  }

  if (focusOn === "edges" || focusOn === "nodes") {
    if (diff.edges.added.length)
      lines.push(`+ ${diff.edges.added.length} edges added`);
    if (diff.edges.removed.length)
      lines.push(`- ${diff.edges.removed.length} edges removed`);
  }

  return lines.join("\n");
};
```

**IMPORTANT bug fix:** The last conditional in `formatStructuralDiff` has `|| focusOn === "edges"` duplicated — change the second one to `|| focusOn === "nodes"`. The corrected line is:
```typescript
if (focusOn === "edges" || focusOn === "nodes") {
```

**Run check:** `cd packages/codeflow-versioning && npm run check`

**Commit:**
```bash
cd packages/codeflow-versioning
git add src/coderag/index.ts src/coderag/agent.ts src/coderag/search.ts
git commit -m "feat(versioning): add CodeRAG integration for semantic branch search and diff explanation"
```

---

## PHASE 3 — Wiring (Steps 6 and 7 are sequential)

### Step 6 — Wire Next.js app to import from package

Replace the three route files with thin re-exports from the package. **Note:** `getBranch` and `removeBranch` must be imported from the package root (`@abhinav2203/codeflow-versioning`) or from `invoke.ts` — NOT from `./branch`. The Project Shepherd identified this as a bug in the original plan.

#### `src/app/api/branches/route.ts`

```typescript
import { NextResponse } from "next/server";
import { createBranch, listBranches } from "@abhinav2203/codeflow-versioning/branch";
import { saveBranch, loadBranches } from "@abhinav2203/codeflow-versioning/store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectName = searchParams.get("projectName");
  if (!projectName) {
    return NextResponse.json({ error: "projectName query param is required." }, { status: 400 });
  }
  try {
    const branches = await listBranches(projectName);
    return NextResponse.json({ branches });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list branches." },
      { status: 500 }
    );
  }
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

#### `src/app/api/branches/[id]/route.ts`

**CRITICAL:** `getBranch` and `removeBranch` come from `@abhinav2203/codeflow-versioning` (the invoke layer), NOT from `./branch`:

```typescript
import { NextResponse } from "next/server";
import { getBranch, removeBranch } from "@abhinav2203/codeflow-versioning";  // NOT from ./branch
import { loadBranch, deleteBranch } from "@abhinav2203/codeflow-versioning/store";

function isValidBranchId(id: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(id);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const projectName = searchParams.get("projectName");
    const { id } = await params;

    if (!projectName) {
      return NextResponse.json({ error: "projectName query param is required." }, { status: 400 });
    }
    if (!id || !isValidBranchId(id)) {
      return NextResponse.json({ error: "Invalid branch id." }, { status: 400 });
    }

    const branch = await getBranch(projectName, id);
    if (!branch) {
      return NextResponse.json({ error: "Branch not found." }, { status: 404 });
    }
    return NextResponse.json({ branch });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load branch." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const projectName = searchParams.get("projectName");
    const { id } = await params;

    if (!projectName) {
      return NextResponse.json({ error: "projectName query param is required." }, { status: 400 });
    }
    if (!id || !isValidBranchId(id)) {
      return NextResponse.json({ error: "Invalid branch id." }, { status: 400 });
    }

    await removeBranch(projectName, id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete branch." },
      { status: 500 }
    );
  }
}
```

#### `src/app/api/branches/diff/route.ts`

```typescript
import { NextResponse } from "next/server";
import { computeDiff } from "@abhinav2203/codeflow-versioning/diff";

export async function POST(request: Request) {
  try {
    const diff = await computeDiff(await request.json());
    return NextResponse.json({ diff });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute branch diff." },
      { status: 400 }
    );
  }
}
```

**Run check:** `cd /Users/abhinavnehra/git/CodeFlow && npm run check`

**Commit:**
```bash
cd /Users/abhinavnehra/git/CodeFlow
git add src/app/api/branches/route.ts src/app/api/branches/\[id\]/route.ts src/app/api/branches/diff/route.ts
git commit -m "feat(versioning): wire branches API routes to @abhinav2203/codeflow-versioning"
```

---

### Step 7 — MCP tools

#### `packages/codeflow-versioning/src/tools.ts`

```typescript
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { GraphBranch, BranchDiff, BlueprintGraph } from "@abhinav2203/codeflow-core/schema";
import {
  createBranch,
  listBranches,
  getBranch,
  removeBranch
} from "./invoke.js";
import { computeDiff } from "./diff.js";
import {
  snapshotBranchReasoning,
  loadBranchReasoningHistory
} from "./reasoning/index.js";
import {
  searchBranches,
  explainBranchDiff,
  type BranchSearchResult
} from "./coderag/search.js";

const baseTool = (
  name: string,
  description: string,
  inputSchema: object
): Tool => ({ name, description, inputSchema });

export const versioningTools: Tool[] = [
  baseTool(
    "versioning_branch_list",
    "List all branches for a project.",
    {
      type: "object",
      properties: { projectName: { type: "string" } },
      required: ["projectName"]
    }
  ),
  baseTool(
    "versioning_branch_create",
    "Create a new named branch snapshot.",
    {
      type: "object",
      properties: {
        projectName: { type: "string" },
        graph: { type: "object" },
        name: { type: "string" },
        description: { type: "string" },
        parentBranchId: { type: "string" },
        runId: { type: "string" }
      },
      required: ["projectName", "graph", "name"]
    }
  ),
  baseTool(
    "versioning_branch_get",
    "Get a single branch by ID.",
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
    "versioning_branch_delete",
    "Delete a branch by ID.",
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
    "versioning_diff",
    "Compute the structural diff between two blueprint graphs.",
    {
      type: "object",
      properties: {
        baseGraph: { type: "object" },
        compareGraph: { type: "object" },
        baseId: { type: "string" },
        compareId: { type: "string" }
      },
      required: ["baseGraph", "compareGraph"]
    }
  ),
  baseTool(
    "versioning_reasoning_snapshot",
    "Snapshot reasoning checkpoints for a run.",
    {
      type: "object",
      properties: {
        projectName: { type: "string" },
        runId: { type: "string" }
      },
      required: ["projectName", "runId"]
    }
  ),
  baseTool(
    "versioning_branch_search",
    "Search branches using natural language.",
    {
      type: "object",
      properties: {
        projectName: { type: "string" },
        query: { type: "string" },
        limit: { type: "number" }
      },
      required: ["projectName", "query"]
    }
  ),
  baseTool(
    "versioning_explain_diff",
    "Explain a branch diff in natural language using CodeRAG.",
    {
      type: "object",
      properties: {
        baseBranch: { type: "object" },
        compareBranch: { type: "object" },
        focusOn: {
          type: "string",
          enum: ["nodes", "edges", "reasoning"]
        }
      },
      required: ["baseBranch", "compareBranch"]
    }
  )
];
```

#### Register in `packages/codeflow-mcp/src/tools.ts`:

```typescript
import { versioningTools } from "@abhinav2203/codeflow-versioning/tools";

// Merge into existing tools registry
export const allTools = [...baseTools, ...versioningTools];
```

**Run check:** `cd packages/codeflow-versioning && npm run check && npm run test`

**Commit:**
```bash
cd packages/codeflow-versioning
git add src/tools.ts
git commit -m "feat(versioning): add MCP tools for branch, diff, reasoning, and CodeRAG operations"
```

---

## PHASE 4 — Final verification

### Step 8.1 — Run all package checks

```bash
cd packages/codeflow-versioning && npm run check && npm run test && npm run build
```
Expected: `tsc --noEmit` passes, `vitest run` passes, build produces `dist/` with all entry points.

### Step 8.2 — Verify app still type-checks

```bash
cd /Users/abhinavnehra/git/CodeFlow && npm run check
```
Expected: App type-checks with rewired routes.

---

## Package barrel — `src/index.ts`

**File:** `packages/codeflow-versioning/src/index.ts`

```typescript
// Branch operations
export { createBranchId, createBranch, diffBranches } from "./branch/index.js";

// Persistence
export { saveBranch, loadBranch, loadBranches, deleteBranch } from "./store/index.js";

// Reasoning snapshots
export {
  snapshotBranchReasoning,
  loadBranchReasoningHistory,
  summarizeReasoningForBranch
} from "./reasoning/index.js";
export type { BranchReasoningSnapshot } from "./reasoning/index.js";

// Invoke layer
export { listBranches, createBranch, getBranch, removeBranch } from "./invoke.js";
export { computeDiff } from "./diff.js";

// CodeRAG
export { initCodeRagForProject, getCodeRagInstance, closeCodeRagInstance } from "./coderag/index.js";
export type { CodeRagConfig } from "./coderag/index.js";
export { searchBranches, explainBranchDiff } from "./coderag/search.js";
export type { BranchSearchResult } from "./coderag/search.js";
```

---

## Architecture diagram

```
@abhinav2203/codeflow-versioning
│
├── branch/index.ts       createBranch() + diffBranches()
│                       (from src/lib/blueprint/branches.ts)
│
├── store/index.ts       saveBranch / loadBranch / loadBranches / deleteBranch
│                       (re-exports from @abhinav2203/codeflow-store/branch)
│
├── reasoning/index.ts   snapshotBranchReasoning() + loadBranchReasoningHistory()
│                       (from @abhinav2203/codeflow-store/reasoning)
│
├── invoke.ts           listBranches / createBranch / getBranch / removeBranch
│                       (consolidated from 3 Next.js route handlers)
│
├── diff.ts             computeDiff()
│
├── coderag/
│   ├── index.ts        initCodeRagForProject() + getCodeRagInstance()
│   ├── agent.ts       buildAgentRetrievalQuery / formatAgentRetrievalPrompt
│   │                 resolveAgentRetrievalContext (from src/lib/coderag-agent.ts)
│   └── search.ts       searchBranches() + explainBranchDiff()  ← NEW
│
└── tools.ts           MCP tool definitions

Next.js rewired routes → thin re-exports from package
codeflow-mcp → imports tools from package
```

---

## What each codeflow-store module contributes

| Module | Used for |
|--------|----------|
| `./branch` | `GraphBranch` JSON persistence |
| `./reasoning` | Loading checkpoint history at branch time |
| `./checkpoint/reasoning` | Fine-grained `ReasoningCheckpoint` save/load |
| `./observability` (optional) | Attach `ObservabilitySnapshot` to branch metadata |
| `./risk` (optional) | Attach `RiskReport` to branch metadata |

---

## Bug reference (fix during implementation)

| # | File | Bug | Fix |
|---|------|-----|-----|
| 1 | `coderag/search.ts` | `formatStructuralDiff`: duplicate `focusOn === "edges"` condition | Change second `"edges"` to `"nodes"` |
| 2 | `[id]/route.ts` | Imports `getBranch`/`removeBranch` from `./branch` | Import from `@abhinav2203/codeflow-versioning` (barrel) or `./invoke` |
