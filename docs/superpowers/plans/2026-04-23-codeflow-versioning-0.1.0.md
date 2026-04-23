# codeflow-versioning 0.1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract blueprint branching and diff into a standalone npm package `@abhinav2203/codeflow-versioning` that works in isolation — no Next.js app required.

**Architecture:** The package exposes two sub-modules: `./branch` (create/snapshot/diff) and `./store` (persistence to filesystem). API routes in the Next.js app are replaced with thin re-exports from the package. The MCP server gains branch tools via the package.

**Tech Stack:** TypeScript, Node.js, `zod`, `vitest`, `uuid`, `@abhinav2203/codeflow-core`

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

Shared utilities (import from `@abhinav2203/codeflow-core`, do not copy):
- `src/lib/blueprint/store-paths.ts` → `branchDirForProject`, `branchPath` (already moved to `codeflow-store/src/shared/`)
- `src/lib/blueprint/schema.ts` → `GraphBranch`, `BranchDiff`, `NodeDiff`, `EdgeDiff`, all related schemas

---

## Step 0 — Scaffold Package Skeleton

- [ ] **Step 0.1: Create directory structure**

```bash
mkdir -p packages/codeflow-versioning/src/{bin,invoke}
mkdir -p packages/codeflow-versioning/test-fixtures
```

- [ ] **Step 0.2: Create `packages/codeflow-versioning/package.json`**

```json
{
  "name": "@abhinav2203/codeflow-versioning",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./branch": { "types": "./dist/branch/index.d.ts", "default": "./dist/branch/index.js" },
    "./store": { "types": "./dist/store/index.d.ts", "default": "./dist/store/index.js" }
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
git commit -m "feat(versioning): scaffold package skeleton v0.1.0"
```

---

## Step 1 — Move `branches.ts` → `./branch`

- [ ] **Step 1.1: Create `packages/codeflow-versioning/src/branch/index.ts`**

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
git add src/branch/index.ts
git commit -m "feat(versioning): move createBranch and diffBranches to branch module"
```

---

## Step 2 — Move `branch-store.ts` → `./store`

- [ ] **Step 2.1: Create `packages/codeflow-versioning/src/store/index.ts`**

Copy `src/lib/blueprint/branch-store.ts` content, with these changes:
- Remove `import type { GraphBranch } from "@/lib/blueprint/schema"` → import from `@abhinav2203/codeflow-core/schema`
- Remove `import { branchDirForProject, branchPath } from "@/lib/blueprint/store-paths"` → import from `@abhinav2203/codeflow-store/shared`
- Re-export `saveBranch`, `loadBranch`, `loadBranches`, `deleteBranch`

Key functions to export:
```typescript
export const saveBranch = async (branch: GraphBranch): Promise<void>
export const loadBranch = async (projectName: string, branchId: string): Promise<GraphBranch | null>
export const loadBranches = async (projectName: string): Promise<GraphBranch[]>
export const deleteBranch = async (projectName: string, branchId: string): Promise<void>
```

> **Note:** `branchDirForProject` and `branchPath` already exist in `codeflow-store/src/shared/utils.ts`. The package reuses them by importing from `@abhinav2203/codeflow-store` — no duplication needed.

- [ ] **Step 2.2: Run check and tests**

Run: `cd packages/codeflow-versioning && npm run check`
Expected: No TypeScript errors

- [ ] **Step 2.3: Commit**

```bash
cd packages/codeflow-versioning
git add src/store/index.ts
git commit -m "feat(versioning): move branch store persistence to store module"
```

---

## Step 3 — Move API routes → `./invoke`

- [ ] **Step 3.1: Create `packages/codeflow-versioning/src/invoke.ts`**

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
- Call `createBranch` from `./branch/index.js`
- Call `saveBranch` from `./store/index.js`
- Return the created `GraphBranch`

For `listBranches`:
- Accept `projectName: string`
- Call `loadBranches` from `./store/index.js`
- Return `GraphBranch[]`

For `getBranch`:
- Accept `projectName` and `branchId` (validate with same regex as original route)
- Call `loadBranch` from `./store/index.js`
- Return `null` if not found

For `removeBranch`:
- Accept `projectName` and `branchId` (validate with same regex)
- Call `deleteBranch` from `./store/index.js`

- [ ] **Step 3.2: Create `packages/codeflow-versioning/src/diff.ts`**

```typescript
export const computeDiff = async (payload: {
  baseGraph: BlueprintGraph
  compareGraph: BlueprintGraph
  baseId?: string
  compareId?: string
}): Promise<BranchDiff>
```

- Call `diffBranches` from `./branch/index.js`
- Return the `BranchDiff` result

- [ ] **Step 3.3: Run check**

Run: `cd packages/codeflow-versioning && npm run check`
Expected: No TypeScript errors

- [ ] **Step 3.4: Commit**

```bash
cd packages/codeflow-versioning
git add src/invoke.ts src/diff.ts
git commit -m "feat(versioning): move API routes to invoke module"
```

---

## Step 4 — Wire Next.js app to import from package

- [ ] **Step 4.1: Replace `src/app/api/branches/route.ts`** with:

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
    const { graph, name, description, parentBranchId } = await request.json();
    const branch = await createBranch({ graph, name, description, parentBranchId });
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

- [ ] **Step 4.2: Replace `src/app/api/branches/[id]/route.ts`** with:

```typescript
import { getBranch, removeBranch } from "@abhinav2203/codeflow-versioning/branch";
import { loadBranch, deleteBranch } from "@abhinav2203/codeflow-versioning/store";

// GET /branches/:id
export async function GET(...) { ... }

// DELETE /branches/:id
export async function DELETE(...) { ... }
```

- [ ] **Step 4.3: Replace `src/app/api/branches/diff/route.ts`** with:

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

- [ ] **Step 4.4: Run full app type check**

Run: `cd /Users/abhinavnehra/git/CodeFlow && npm run check`
Expected: No TypeScript errors

- [ ] **Step 4.5: Commit**

```bash
cd /Users/abhinavnehra/git/CodeFlow
git add src/app/api/branches/route.ts src/app/api/branches/\[id\]/route.ts src/app/api/branches/diff/route.ts
git commit -m "feat(versioning): wire branches API routes to @abhinav2203/codeflow-versioning"
```

---

## Step 5 — Add MCP tools

- [ ] **Step 5.1: Create `packages/codeflow-versioning/src/tools.ts`**

Register these tools in the MCP registry:

```typescript
// tool: versioning_branch_list
// args: { projectName: string }
// returns: { branches: GraphBranch[] }

// tool: versioning_branch_create
// args: { projectName: string, graph: BlueprintGraph, name: string, description?: string, parentBranchId?: string }
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
```

- [ ] **Step 5.2: Register tools in `codeflow-mcp`**

In `packages/codeflow-mcp/src/tools.ts`, add:

```typescript
import { versioningTools } from "@abhinav2203/codeflow-versioning/tools";

// Merge into existing tools registry
export const allTools = [...baseTools, ...versioningTools];
```

- [ ] **Step 5.3: Run check and tests**

Run: `cd packages/codeflow-versioning && npm run check && npm run test`
Expected: Both pass

- [ ] **Step 5.4: Commit**

```bash
cd packages/codeflow-versioning
git add src/tools.ts
git commit -m "feat(versioning): add MCP tools for branch and diff operations"
```

---

## Step 6 — Final verification

- [ ] **Step 6.1: Run all package checks**

Run: `cd packages/codeflow-versioning && npm run check && npm run test && npm run build`
Expected: `tsc --noEmit` passes, `vitest run` passes, build produces `dist/` with all entry points

- [ ] **Step 6.2: Verify app still works**

Run: `cd /Users/abhinavnehra/git/CodeFlow && npm run check`
Expected: App type-checks with the rewired routes

---

## Summary of all changes

| File | Action |
|------|--------|
| `packages/codeflow-versioning/` | Created — all package source lives here |
| `src/lib/blueprint/branches.ts` | Stays (used by workspace dependency) |
| `src/lib/blueprint/branch-store.ts` | Stays (used by workspace dependency) |
| `src/app/api/branches/route.ts` | Replaced with re-export from package |
| `src/app/api/branches/[id]/route.ts` | Replaced with re-export from package |
| `src/app/api/branches/diff/route.ts` | Replaced with re-export from package |
