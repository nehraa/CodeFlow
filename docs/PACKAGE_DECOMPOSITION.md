# CodeFlow Package Decomposition

## Existing Packages

| Package | npm name | Description |
|---------|----------|-------------|
| `codeflow-core` | `@abhinav2203/codeflow-core` | Framework-agnostic core: schema, ts-morph repo analysis, export, conflict detection |
| `coderag` | `@abhinav2203/coderag` | Code retrieval & RAG: embeddings, indexing, retrieval, MCP server |

**`coderag` also appears in the dependency graph:**
```text
coderag → @abhinav2203/codeflow-core
```

### `codeflow-core` Source Files (not yet isolated — extracted from `src/lib/blueprint/`)

```
src/lib/blueprint/
  - schema.ts                 ← BlueprintGraph, BlueprintNode, BlueprintEdge, all type definitions
  - repo.ts
  - repo.test.ts
  - utils.ts                  ← slugify, createNodeId, mergeFields, dedupeEdges, toPosixPath, etc.
  - store-paths.ts            ← getStoreRoot, sessionDirForProject, latestSessionPath, etc.
  - export.ts
  - export.test.ts
```

> **Note:** `codeflow-core` is the foundation. `schema.ts` defines the entire type system used by every other package. `repo.ts` uses ts-morph for TypeScript repo analysis. `export.ts` handles blueprint artifact export. These are extracted first before any other package work begins.

## Proposed New Packages

| Package | Description |
|---------|-------------|
| `codeflow-canvas` | React Flow visual graph editor, node editing, trace/heatmap overlay |
| `codeflow-prd` | PRD markdown parser, workflow extraction, reverse mode (code → blueprint) |
| `codeflow-execution` | Execution runner, task planning, phases, VCR recording, runtime tests |
| `codeflow-analysis` | Cycle detection, architecture smells, graph metrics, refactor/heal |
| `codeflow-evolution` | Ghost nodes (AI-suggested components), genetic algorithm for architecture variants |
| `codeflow-agent` | Unified AI agent: OpenCode server + NVIDIA NIM + per-node codegen + TS validation |
| `codeflow-dtwin` | Digital twin simulation, active node highlighting from trace data |
| `codeflow-versioning` | Blueprint branching, branch diff/compare |
| `codeflow-mcp` | MCP server configuration and tool registry (stays separate — protocol interface for all packages) |
| `codeflow-store` | Local session storage, project-scoped state, checkpointing |

**Total: 11 packages (9 new + 2 existing)**

> **Note:** `codeflow-ai`, `codeflow-codegen`, and `codeflow-opencode` have been merged into `codeflow-agent`. `codeflow-mcp` is kept separate because it is a protocol-level interface (stdin/stdout JSON-RPC) that should be reusable by all packages, not just the agent.

---

## Recommended Build Order

### Phase 1 — Foundation (depends only on codeflow-core)

| # | Package | Why first |
|---|---------|-----------|
| 1 | `codeflow-store` | Session storage, checkpoints, project isolation — depends on core, can ship immediately |
| 2 | `codeflow-mcp` | MCP server config, tool registry — depends on core, can ship immediately |

### Phase 2 — Schema Producers (depend only on codeflow-core schema)

| # | Package | Why |
|---|---------|-----|
| 3 | `codeflow-versioning` | Branches + diff — produces/consumes graph metadata, minimal deps |
| 4 | `codeflow-prd` | PRD parsing → produces blueprint graph |
| 5 | `codeflow-analysis` | Cycles, smells, metrics, refactor/heal → analyze graph |

### Phase 3 — Agent Layer (depend on core + schema producers)

| # | Package | Why |
|---|---------|-----|
| 6 | `codeflow-execution` | Runner, task planning, phases, VCR — needs schema + analysis |
| 7 | `codeflow-agent` | OpenCode server + NVIDIA NIM + codegen + TS validation — needs core + execution |

### Phase 4 — High-Level (depend on multiple layers)

| # | Package | Why |
|---|---------|-----|
| 8 | `codeflow-evolution` | Ghost nodes + genetic algo — needs agent (for LLM calls) |

### Phase 5 — Top Layer (full stack)

| # | Package | Why |
|---|---------|-----|
| 9 | `codeflow-canvas` | React Flow UI — needs schema + execution traces |
| 10 | `codeflow-dtwin` | Digital twin simulation — needs execution + canvas |

### Dependency Graph

```text
codeflow-store
codeflow-mcp
       │
       ▼
codeflow-versioning   codeflow-prd   codeflow-analysis
       │                      │                │
       └──────────────────────┴────────────────┘
                               │
                          codeflow-execution
                               │
                          codeflow-agent
                               │
                     codeflow-evolution
                               │
                     codeflow-canvas
                               │
                     codeflow-dtwin
```

> **Merged note:** `codeflow-agent` replaces `codeflow-ai`, `codeflow-codegen`, and `codeflow-opencode`. These three were merged because they are not independently useful — `codeflow-opencode` already does code generation (which `codeflow-codegen` would duplicate), and `codeflow-ai` is a thin NVIDIA NIM wrapper that feeds into the same codegen pipeline. `codeflow-mcp` is kept separate because it is a protocol interface (stdin/stdout JSON-RPC) that all packages can use, not just the agent.

---

## Inter-Package Communication Architecture

**Core principle: packages communicate only via npm package dependencies, never via direct code imports.**

Every internal package dependency is declared as an `npm` dependency in `package.json` pointing to the published package name (`@abhinav2203/codeflow-<name>`). During development inside the monorepo, use `workspace:*` ranges (requires workspaces to be configured in the root `package.json`); a release tool (e.g. `npm publish` with changesets, or pnpm publish) must rewrite `workspace:*` to the actual published semver range before the package reaches consumers on npm. This means:

- Each package is **independently installable** — `npm install @abhinav2203/codeflow-prd` also pulls in `@abhinav2203/codeflow-core` as a transitive dep
- Each package is **independently versionable** — semver bumps happen per package
- Each package is **independently deployable** — you can run `codeflow-prd` CLI without any other codeflow package source present (except its npm deps)
- Integration testing (all packages working together end-to-end) is a **later phase** — for now, each package is tested only against its npm dependency surface

### Package Dependency Graph (npm deps)

```text
codeflow-store        → @abhinav2203/codeflow-core
codeflow-mcp         → @abhinav2203/codeflow-core
                       → @abhinav2203/codeflow-store   (optional, resolved at build time)

codeflow-versioning  → @abhinav2203/codeflow-core
                     → @abhinav2203/codeflow-store

codeflow-prd         → @abhinav2203/codeflow-core
                     → @abhinav2203/codeflow-store

codeflow-analysis    → @abhinav2203/codeflow-core
                     → @abhinav2203/codeflow-store

codeflow-execution   → @abhinav2203/codeflow-core
                     → @abhinav2203/codeflow-analysis
                     → @abhinav2203/codeflow-store

codeflow-agent      → @abhinav2203/codeflow-core
                     → @abhinav2203/codeflow-execution
                     → @abhinav2203/codeflow-store

codeflow-evolution   → @abhinav2203/codeflow-core
                     → @abhinav2203/codeflow-agent

codeflow-canvas     → @abhinav2203/codeflow-core
                     → @abhinav2203/codeflow-store
                     → @abhinav2203/codeflow-execution
                     → react, @xyflow/react, @monaco-editor/react

codeflow-dtwin      → @abhinav2203/codeflow-core
                     → @abhinav2203/codeflow-execution
                     → @abhinav2203/codeflow-canvas
```

### How to Import Between Packages

**❌ WRONG — direct monorepo import:**
```typescript
import { buildBlueprintGraph } from "../../codeflow-core/src/analyzer/index.js";
```

**✅ CORRECT — npm package import:**
```typescript
import { buildBlueprintGraph } from "@abhinav2203/codeflow-core/analyzer.js";
```

During development within the monorepo, use workspace ranges (npm/yarn/pnpm workspaces). **Prerequisite:** declare a `workspaces` field in the root `package.json` listing all package paths. A release tool (e.g. changesets + `npm publish`, or `pnpm publish`) must rewrite `workspace:*` to the actual published semver version before the package is pushed to npm.

```json
{
  "dependencies": {
    "@abhinav2203/codeflow-core": "workspace:*",
    "@abhinav2203/codeflow-analysis": "workspace:*"
  }
}
```

Once published to npm, workspace ranges are replaced with the resolved published semver version.

---

## Package Isolation Instructions

Below are exact instructions for each package — what files to move, what to wire up, and what dependencies to set.

---

### 1. `codeflow-store`

**Package name:** `@abhinav2203/codeflow-store`

**Description:** Local session storage, project-scoped state, checkpointing, approvals.

**Source files to isolate:**

```text
FROM: src/lib/blueprint/
  - approval-store.ts
  - checkpoint-store.ts
  - branch-store.ts
  - run-store.ts
  - observability-store.ts
  - session-store.ts
  - store.ts
  - risk.ts

FROM: src/store/
  - blueprint-store.ts
  - blueprint-store.test.ts
```

**API routes to wire:**

```text
FROM: src/app/api/approvals/approve/route.ts
FROM: src/app/api/export/route.ts        (risk/export approval gating)
```

**Shared utilities (import from `@abhinav2203/codeflow-core`, do not copy):**

> These files must be moved into `@abhinav2203/codeflow-core` first. Once there, declare `@abhinav2203/codeflow-core` as a dependency and import from it. Do not duplicate business logic into `codeflow-store`.

```text
src/lib/blueprint/file-tree.ts         → move to @abhinav2203/codeflow-core
src/lib/server/run-command.ts          → move to @abhinav2203/codeflow-core
src/lib/server/terminal-sessions.ts   → move to @abhinav2203/codeflow-core
```

**`package.json` fields:**

```json
{
  "name": "@abhinav2203/codeflow-store",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./checkpoint": { "types": "./dist/checkpoint.d.ts", "default": "./dist/checkpoint.js" },
    "./approval": { "types": "./dist/approval.d.ts", "default": "./dist/approval.js" },
    "./run": { "types": "./dist/run.d.ts", "default": "./dist/run.js" },
    "./risk": { "types": "./dist/risk.d.ts", "default": "./dist/risk.js" },
    "./observability": { "types": "./dist/observability.d.ts", "default": "./dist/observability.js" },
    "./branch": { "types": "./dist/branch.d.ts", "default": "./dist/branch.js" },
    "./session": { "types": "./dist/session.d.ts", "default": "./dist/session.js" },
    "./store": { "types": "./dist/store.d.ts", "default": "./dist/store.js" }
  },
  "bin": {
    "codeflow-store": "./dist/bin/cli.js"
  },
  "dependencies": {
    "@abhinav2203/codeflow-core": "workspace:*"
  }
}
```

**Developer prompt:**
> "Extract the storage layer from the CodeFlow monorepo. Move `src/lib/blueprint/{approval-store,checkpoint-store,branch-store,run-store,observability-store,session-store,store,risk}.ts` and `src/store/blueprint-store.ts` into `packages/codeflow-store/src/`. Import shared utilities (`file-tree`, `run-command`, `terminal-sessions`) from `@abhinav2203/codeflow-core` — do not copy them into this package. Wire the API routes `src/app/api/approvals/approve/route.ts` and `src/app/api/export/route.ts` to import from the new package. Publish as `@abhinav2203/codeflow-store`. Tests stay next to source files."

---

### 2. `codeflow-mcp`

**Package name:** `@abhinav2203/codeflow-mcp`

**Description:** MCP server configuration and tool registry for blueprint operations.

**Source files to isolate:**

```text
FROM: src/lib/blueprint/
  - mcp.ts
  - mcp.test.ts
```

**API routes to wire:**

```text
FROM: src/app/api/mcp/invoke/route.ts
FROM: src/app/api/mcp/invoke/route.test.ts
FROM: src/app/api/mcp/tools/route.ts
FROM: src/app/api/mcp/tools/route.test.ts
```

**`package.json` fields:**

```json
{
  "name": "@abhinav2203/codeflow-mcp",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./invoke": { "types": "./dist/invoke.d.ts", "default": "./dist/invoke.js" },
    "./tools": { "types": "./dist/tools.d.ts", "default": "./dist/tools.js" }
  },
  "bin": {
    "codeflow-mcp": "./dist/bin/cli.js"
  },
  "dependencies": {
    "@abhinav2203/codeflow-core": "workspace:*"
  }
}
```

**Developer prompt:**
> "Extract the MCP layer. Move `src/lib/blueprint/{mcp,mcp.test}.ts` and `src/app/api/mcp/{invoke,tools}/route.ts` (with their tests) into `packages/codeflow-mcp/src/`. The MCP tools should wrap blueprint operations. Publish as `@abhinav2203/codeflow-mcp`. Follow the same pattern as `coderag` which exposes its own MCP server."

---

### 3. `codeflow-versioning`

**Package name:** `@abhinav2203/codeflow-versioning`

**Description:** Blueprint branching, branch diff/compare.

**Source files to isolate:**

```text
FROM: src/lib/blueprint/
  - branches.ts               (includes branch diff logic)
  - branches.test.ts
```

**API routes to wire:**

```text
FROM: src/app/api/branches/route.ts
FROM: src/app/api/branches/route.test.ts
FROM: src/app/api/branches/[id]/route.ts
FROM: src/app/api/branches/[id]/route.test.ts
FROM: src/app/api/branches/diff/route.ts
FROM: src/app/api/branches/diff/route.test.ts
```

**`package.json` fields:**

```json
{
  "name": "@abhinav2203/codeflow-versioning",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./diff": { "types": "./dist/diff.d.ts", "default": "./dist/diff.js" }
  },
  "bin": {
    "codeflow-versioning": "./dist/bin/cli.js"
  },
  "dependencies": {
    "@abhinav2203/codeflow-core": "workspace:*",
    "@abhinav2203/codeflow-store": "workspace:*"
  }
}
```

**Developer prompt:**
> "Extract blueprint versioning. Move `src/lib/blueprint/{branches,branches.test}.ts` and all `src/app/api/branches/` route files into `packages/codeflow-versioning/src/`. The branches logic handles creating, listing, and comparing named blueprint branches. Publish as `@abhinav2203/codeflow-versioning`."

---

### 4. `codeflow-prd`

**Package name:** `@abhinav2203/codeflow-prd`

**Description:** PRD markdown parser, workflow extraction, reverse mode (code → blueprint).

**Source files to isolate:**

```text
FROM: src/lib/blueprint/
  - prd.ts
  - prd.test.ts
  - build.ts
  - build.test.ts
  - file-tree.ts               (used by build for file scanning)
  - typescript-workspace.ts     (used by build.ts for reverse-mode ts-morph analysis)
```

**API routes to wire:**

```text
FROM: src/app/api/blueprint/route.ts
FROM: src/app/api/blueprint/route.test.ts
FROM: src/app/api/generate-blueprint/route.ts
FROM: src/app/api/generate-blueprint/route.test.ts
```

**`package.json` fields:**

```json
{
  "name": "@abhinav2203/codeflow-prd",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./build": { "types": "./dist/build.d.ts", "default": "./dist/build.js" },
    "./typescript-workspace": { "types": "./dist/typescript-workspace.d.ts", "default": "./dist/typescript-workspace.js" }
  },
  "bin": {
    "codeflow-prd": "./dist/bin/cli.js"
  },
  "dependencies": {
    "@abhinav2203/codeflow-core": "workspace:*",
    "@abhinav2203/codeflow-store": "workspace:*"
  }
}
```

**Developer prompt:**
> "Extract the PRD ingestion layer. Move `src/lib/blueprint/{prd,prd.test,build,build.test,file-tree,typescript-workspace}.ts` and `src/app/api/blueprint/route.ts`, `src/app/api/generate-blueprint/route.ts` into `packages/codeflow-prd/src/`. The PRD parser extracts screens, APIs, classes, functions, modules, and workflows (with `->` syntax) from markdown. The build step turns parsed PRD into a BlueprintGraph. Publish as `@abhinav2203/codeflow-prd`."

---

### 5. `codeflow-analysis`

**Package name:** `@abhinav2203/codeflow-analysis`

**Description:** Cycle detection, architecture smells, graph metrics, refactor/heal.

**Source files to isolate:**

```text
FROM: src/lib/blueprint/
  - cycles.ts
  - cycles.test.ts
  - smells.ts
  - smells.test.ts
  - metrics.ts
  - metrics.test.ts
  - refactor.ts
  - refactor.test.ts
  - conflicts.ts              ← detectGraphConflicts: repo vs blueprint conflict analysis (imports analyzeTypeScriptRepo from repo.ts in codeflow-core)
  - conflicts.test.ts
```

**API routes to wire:**

```text
FROM: src/app/api/analysis/cycles/route.ts
FROM: src/app/api/analysis/cycles/route.test.ts
FROM: src/app/api/analysis/metrics/route.ts
FROM: src/app/api/analysis/metrics/route.test.ts
FROM: src/app/api/analysis/smells/route.ts
FROM: src/app/api/analysis/smells/route.test.ts
FROM: src/app/api/refactor/detect/route.ts
FROM: src/app/api/refactor/detect/route.test.ts
FROM: src/app/api/refactor/heal/route.ts
FROM: src/app/api/refactor/heal/route.test.ts
FROM: src/app/api/conflicts/route.ts
FROM: src/app/api/conflicts/route.test.ts
```

**`package.json` fields:**

```json
{
  "name": "@abhinav2203/codeflow-analysis",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./cycles": { "types": "./dist/cycles.d.ts", "default": "./dist/cycles.js" },
    "./smells": { "types": "./dist/smells.d.ts", "default": "./dist/smells.js" },
    "./metrics": { "types": "./dist/metrics.d.ts", "default": "./dist/metrics.js" },
    "./refactor": { "types": "./dist/refactor.d.ts", "default": "./dist/refactor.js" },
    "./conflicts": { "types": "./dist/conflicts.d.ts", "default": "./dist/conflicts.js" }
  },
  "bin": {
    "codeflow-analysis": "./dist/bin/cli.js"
  },
  "dependencies": {
    "@abhinav2203/codeflow-core": "workspace:*",
    "@abhinav2203/codeflow-store": "workspace:*"
  }
}
```

**Developer prompt:**
> "Extract the graph analysis layer. Move all `src/lib/blueprint/{cycles,smells,metrics,refactor,conflicts}*.ts` files and their corresponding `src/app/api/analysis/{cycles,metrics,smells}/route.ts`, `src/app/api/refactor/{detect,heal}/route.ts`, and `src/app/api/conflicts/route.ts` (with all tests) into `packages/codeflow-analysis/src/`. Each sub-module exposes a focused analysis function. Publish as `@abhinav2203/codeflow-analysis`."

---

### 6. `codeflow-execution`

**Package name:** `@abhinav2203/codeflow-execution`

**Description:** Execution runner, task planning, phases, VCR recording, runtime tests.

**Source files to isolate:**

```text
FROM: src/lib/blueprint/
  - runner.ts
  - runner.test.ts
  - plan.ts
  - plan.test.ts
  - phases.ts
  - phases.test.ts
  - execute.ts
  - execute.test.ts
  - vcr.ts                ← VCR recording/replay of trace spans
  - vcr.test.ts
  - runtime-contracts.ts
  - runtime-tests.ts
  - runtime-tests.test.ts
  - runtime-workspace.ts
  - sandbox.ts
  - mermaid.ts            ← toMermaid / toMermaidClassDiagram (used by export/mermaid API route)
  - mermaid.test.ts
```

**API routes to wire:**

```text
FROM: src/app/api/executions/run/route.ts
FROM: src/app/api/executions/run/route.test.ts
FROM: src/app/api/vcr/route.ts
FROM: src/app/api/vcr/route.test.ts
FROM: src/app/api/export/mermaid/route.ts
FROM: src/app/api/export/mermaid/route.test.ts
FROM: src/app/api/code-completions/route.ts
```

**`package.json` fields:**

```json
{
  "name": "@abhinav2203/codeflow-execution",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./plan": { "types": "./dist/plan.d.ts", "default": "./dist/plan.js" },
    "./phases": { "types": "./dist/phases.d.ts", "default": "./dist/phases.js" },
    "./execute": { "types": "./dist/execute.d.ts", "default": "./dist/execute.js" },
    "./vcr": { "types": "./dist/vcr.d.ts", "default": "./dist/vcr.js" },
    "./runtime-tests": { "types": "./dist/runtime-tests.d.ts", "default": "./dist/runtime-tests.js" },
    "./mermaid": { "types": "./dist/mermaid.d.ts", "default": "./dist/mermaid.js" },
    "./sandbox": { "types": "./dist/sandbox.d.ts", "default": "./dist/sandbox.js" }
  },
  "bin": {
    "codeflow-execution": "./dist/bin/cli.js"
  },
  "dependencies": {
    "@abhinav2203/codeflow-core": "workspace:*",
    "@abhinav2203/codeflow-analysis": "workspace:*",
    "@abhinav2203/codeflow-store": "workspace:*"
  }
}
```

**Developer prompt:**
> "Extract the execution engine. Move `src/lib/blueprint/{runner,plan,phases,execute,vcr,runtime-contracts,runtime-tests,runtime-workspace,sandbox,mermaid}*.ts` (all files with these prefixes, with tests) and `src/app/api/executions/run/route.ts`, `src/app/api/vcr/route.ts`, `src/app/api/export/mermaid/route.ts`, `src/app/api/code-completions/route.ts` into `packages/codeflow-execution/src/`. The runner orchestrates task plans with phases. VCR records trace spans for replay. Mermaid exports generate diagrams from blueprints. Publish as `@abhinav2203/codeflow-execution`."

---

### 7. `codeflow-agent`

**Package name:** `@abhinav2203/codeflow-agent`

**Description:** Unified AI agent — OpenCode agent server + NVIDIA NIM wrapper + per-node codegen + TS validation + prompt governance. This is the "heavy lifting" layer: it runs code models, generates blueprint-adherent code stubs, validates them with TypeScript, and exposes everything via an API server and MCP tools.

**Source files to isolate:**

```text
FROM: src/lib/blueprint/
  - nvidia.ts              ← NVIDIA NIM wrapper (blueprint → prompt for Llama 3.1 405B)
  - prompt-governance.ts   ← prompt sanitization, size limits, rate limiting
  - prompt-governance.test.ts
  - codegen.ts             ← per-node TS/TSX code generation (wraps opencode)
  - compile-validation.ts  ← TypeScript compiler validation of generated code
  - compile-validation.test.ts
  - code-assist.ts         ← AI-powered code improvement suggestions

FROM: src/lib/opencode/
  - index.ts
  - agent.ts
  - agent.test.ts
  - client.ts
  - server.ts
  - server.test.ts
  - config.ts
  - config.test.ts
  - modelFetcher.ts
  - modelFetcher.test.ts
  - types.ts               ← OpencodeProvider, OpencodeConfig, McpServerConfig types
  - api-key-validator.tsx
```

**API routes to wire:**

```text
FROM: src/app/api/generate-blueprint/route.ts   (NVIDIA AI generation — merged handler)
FROM: src/app/api/code-suggestions/route.ts
FROM: src/app/api/implement-node/route.ts
FROM: src/app/api/opencode/status/route.ts
FROM: src/app/api/opencode/start/route.ts
FROM: src/app/api/opencode/stop/route.ts
FROM: src/app/api/opencode/restart/route.ts
FROM: src/app/api/opencode/agent/route.ts
FROM: src/app/api/opencode/sessions/route.ts
FROM: src/app/api/opencode/sessions/[id]/route.ts
FROM: src/app/api/opencode/permissions/route.ts
(all corresponding .test.ts files too)
```

**`package.json` fields:**

```json
{
  "name": "@abhinav2203/codeflow-agent",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./opencode": { "types": "./dist/opencode.d.ts", "default": "./dist/opencode.js" },
    "./nvidia": { "types": "./dist/nvidia.d.ts", "default": "./dist/nvidia.js" },
    "./prompt-governance": { "types": "./dist/prompt-governance.d.ts", "default": "./dist/prompt-governance.js" },
    "./codegen": { "types": "./dist/codegen.d.ts", "default": "./dist/codegen.js" },
    "./compile": { "types": "./dist/compile.d.ts", "default": "./dist/compile.js" },
    "./code-assist": { "types": "./dist/code-assist.d.ts", "default": "./dist/code-assist.js" }
  },
  "bin": {
    "codeflow-agent": "./dist/bin/cli.js"
  },
  "dependencies": {
    "@abhinav2203/codeflow-core": "workspace:*",
    "@abhinav2203/codeflow-execution": "workspace:*",
    "@abhinav2203/codeflow-store": "workspace:*"
  }
}
```

> **Why does `codeflow-agent` depend on `codeflow-store`?** Because agent **reasoning** (session context, tool-use history, generated artifacts, agent logs) needs to be persisted and replayable. Rather than inventing its own storage layer, `codeflow-agent` uses `codeflow-store` as its persistence backend. Reasoning is stored as structured session data in `codeflow-store`, enabling checkpointing and replay without a separate storage mechanism.

**Developer prompt:**
> "Extract and merge the AI layer. Move `src/lib/opencode/` (entire directory), `src/lib/blueprint/{nvidia,prompt-governance,codegen,compile-validation,compile-validation.test,code-assist}.ts` (with all tests), and all `src/app/api/opencode/` + `src/app/api/generate-blueprint/` + `src/app/api/code-suggestions/` + `src/app/api/implement-node/` routes into `packages/codeflow-agent/src/`. This package is the unified AI agent: OpenCode server (multi-model: Anthropic, OpenAI, NVIDIA, etc.), NVIDIA NIM wrapper (Llama 3.1 405B), per-node code generation, TypeScript validation, and prompt governance. Wire `src/app/api/generate-blueprint/route.ts` to call `nvidia.ts` within this package. Publish as `@abhinav2203/codeflow-agent`."

---

### 8. `codeflow-evolution`

**Package name:** `@abhinav2203/codeflow-evolution`

**Description:** Ghost nodes (AI-suggested components), genetic algorithm for architecture variants.

**Source files to isolate:**

```text
FROM: src/lib/blueprint/
  - genetic.ts
  - genetic.test.ts

FROM: src/app/api/ghost-nodes/route.ts
```

> **Note:** `heatmap.ts` is shared between `codeflow-evolution` and `codeflow-canvas`. Both packages copy this file (it's not a separate package). The heatmap CLI in `codeflow-evolution` and the heatmap overlay in `codeflow-canvas` both use this same file.

**API routes to wire:**

```text
FROM: src/app/api/genetic/evolve/route.ts
FROM: src/app/api/genetic/evolve/route.test.ts
FROM: src/app/api/ghost-nodes/route.ts
```

**`package.json` fields:**

```json
{
  "name": "@abhinav2203/codeflow-evolution",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./genetic": { "types": "./dist/genetic.d.ts", "default": "./dist/genetic.js" },
    "./ghost": { "types": "./dist/ghost.d.ts", "default": "./dist/ghost.js" }
  },
  "bin": {
    "codeflow-evolution": "./dist/bin/cli.js"
  },
  "dependencies": {
    "@abhinav2203/codeflow-core": "workspace:*",
    "@abhinav2203/codeflow-agent": "workspace:*"
  }
}
```

**Developer prompt:**
> "Extract the evolution layer. Move `src/lib/blueprint/genetic*.ts` and `src/app/api/genetic/evolve/route.ts`, `src/app/api/ghost-nodes/route.ts` into `packages/codeflow-evolution/src/`. Genetic algorithms evolve architecture variants. Ghost nodes are AI-suggested next components (powered by `codeflow-agent`'s LLM). Heatmap lives in `codeflow-canvas` — do not copy it here. Publish as `@abhinav2203/codeflow-evolution`."

---

### 9. `codeflow-canvas`

**Package name:** `@abhinav2203/codeflow-canvas`

**Description:** React Flow visual graph editor, node editing, trace/heatmap overlay.

**Source files to isolate:**

```text
FROM: src/components/
  - graph-canvas.tsx
  - blueprint-workbench.tsx
  - blueprint-workbench.test.tsx
  - file-tabs.tsx
  - file-tree.tsx
  - ide-layout.tsx
  - ide-workbench.tsx
  - code-diff-editor.tsx
  - code-editor.tsx
  - code-editor.test.tsx
  - monaco-setup.ts
  - monaco-setup.test.ts
  - ts-language-service.ts
  - opencode-settings.tsx

FROM: src/lib/blueprint/
  - flow-view.ts
  - flow-view.test.ts
  - edit.ts
  - edit.test.ts
  - traces.ts
  - traces.test.ts
  - node-navigation.ts
  - heatmap.ts            (heatmap color computation — used by canvas overlay)
  - heatmap.test.ts
```

**Note on heatmap:** `heatmap.ts` computes colors (used by canvas). Recommendation: keep both the computation and its tests in `codeflow-canvas` to maintain package isolation.

**API routes to wire:** (canvas is primarily UI — most logic is in the lib files above)

```text
FROM: src/app/api/observability/ingest/route.ts   (trace overlay data)
FROM: src/app/api/observability/latest/route.ts
```

> **Note:** Observability data storage routes (`observability/ingest`, `observability/latest`) persist to `codeflow-store`. The `observability.ts` lib file (display/compute logic) lives in `codeflow-canvas` alongside traces and heatmap for graph overlay rendering.

**`package.json` fields:**

```json
{
  "name": "@abhinav2203/codeflow-canvas",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./flow-view": { "types": "./dist/flow-view.d.ts", "default": "./dist/flow-view.js" },
    "./edit": { "types": "./dist/edit.d.ts", "default": "./dist/edit.js" },
    "./traces": { "types": "./dist/traces.d.ts", "default": "./dist/traces.js" },
    "./editor": { "types": "./dist/editor.d.ts", "default": "./dist/editor.js" },
    "./heatmap": { "types": "./dist/heatmap.d.ts", "default": "./dist/heatmap.js" },
    "./observability": { "types": "./dist/observability.d.ts", "default": "./dist/observability.js" }
  },
  "bin": {
    "codeflow-canvas": "./dist/bin/cli.js"
  },
  "dependencies": {
    "@abhinav2203/codeflow-core": "workspace:*",
    "@abhinav2203/codeflow-store": "workspace:*",
    "@abhinav2203/codeflow-execution": "workspace:*",
    "react": "^18.0",
    "@monaco-editor/react": "^4.0"
  },
  "peerDependencies": {
    "react": "^18.0",
    "@xyflow/react": "^12.0"
  }
}
```

**Developer prompt:**
> "Extract the React Flow canvas UI. Move `src/components/{graph-canvas,blueprint-workbench,file-tabs,file-tree,ide-layout,ide-workbench,code-diff-editor,code-editor,monaco-setup,ts-language-service,opencode-settings}*.ts*` and `src/lib/blueprint/{flow-view,edit,traces,node-navigation,heatmap,heatmap.test}.ts` into `packages/codeflow-canvas/src/`. Wire `src/app/api/observability/{ingest,latest}/route.ts` to import from `codeflow-store` for trace data. This is a React component package — publish as `@abhinav2203/codeflow-canvas`. Monaco editor setup and TS language service are part of this package. `@xyflow/react` should be a peer dependency."

---

### 10. `codeflow-dtwin`

**Package name:** `@abhinav2203/codeflow-dtwin`

**Description:** Digital twin simulation, active node highlighting from trace data.

**Source files to isolate:**

```text
FROM: src/lib/blueprint/
  - digital-twin.ts
  - digital-twin.test.ts
```

**API routes to wire:**

```text
FROM: src/app/api/digital-twin/route.ts
FROM: src/app/api/digital-twin/route.test.ts
FROM: src/app/api/digital-twin/simulate/route.ts
FROM: src/app/api/digital-twin/simulate/route.test.ts
```

**`package.json` fields:**

```json
{
  "name": "@abhinav2203/codeflow-dtwin",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./simulate": { "types": "./dist/simulate.d.ts", "default": "./dist/simulate.js" }
  },
  "bin": {
    "codeflow-dtwin": "./dist/bin/cli.js"
  },
  "dependencies": {
    "@abhinav2203/codeflow-core": "workspace:*",
    "@abhinav2203/codeflow-execution": "workspace:*",
    "@abhinav2203/codeflow-canvas": "workspace:*"
  }
}
```

**Developer prompt:**
> "Extract the Digital Twin layer. Move `src/lib/blueprint/{digital-twin,digital-twin.test}.ts` and `src/app/api/digital-twin/{route,simulate/route}.ts` (with tests) into `packages/codeflow-dtwin/src/`. This package simulates user flows and highlights active nodes on the canvas based on observability data. Publish as `@abhinav2203/codeflow-dtwin`."

---

## Unaccounted API Routes

The following API routes exist in `src/app/api/` but are NOT assigned to any package in this decomposition. They may belong to an existing package, a future package, or may need to be reassigned:

| Route | Likely Owner | Notes |
|-------|-------------|-------|
| `src/app/api/coderag/route.ts` | `coderag` (existing) | RAG embedding + retrieval |
| `src/app/api/files/get/route.ts` | TBD | File retrieval |
| `src/app/api/files/list/route.ts` | TBD | File listing |
| `src/app/api/files/post/route.ts` | TBD | File upload |
| `src/app/api/terminal/sessions/route.ts` | TBD | Terminal session management |
| `src/app/api/terminal/sessions/[sessionId]/route.ts` | TBD | Individual terminal session |

> **Action needed:** Assign these routes to appropriate packages before extraction begins. `coderag` is an existing package and should take its own route. The file and terminal routes may belong to `codeflow-store` or a new `codeflow-fs` package.

---

These files are used by multiple packages. They should be moved to `@abhinav2203/codeflow-core` (or a dedicated utility package) to avoid code duplication and logic drift. Each consuming package should import them as a normal package dependency rather than copying the source:

| File | Move to | Used by |
|-------|---------|---------|
| `src/lib/blueprint/file-tree.ts` | `@abhinav2203/codeflow-core` | `codeflow-prd`, `codeflow-store` |
| `src/lib/server/run-command.ts` | `@abhinav2203/codeflow-core` | `codeflow-store` |
| `src/lib/server/terminal-sessions.ts` | `@abhinav2203/codeflow-core` | `codeflow-store` |
| `src/lib/blueprint/typescript-workspace.ts` | `@abhinav2203/codeflow-core` | `codeflow-execution`, `codeflow-agent` |
| `src/lib/blueprint/sandbox.ts` | `@abhinav2203/codeflow-core` | `codeflow-execution`, `codeflow-store` |

---

## Summary: All Source Files by Package

```text
codeflow-store:
  src/lib/blueprint/{approval-store,checkpoint-store,branch-store,run-store,observability-store,session-store,store,risk}.ts
  src/store/{blueprint-store,blueprint-store.test}.ts

codeflow-mcp:
  src/lib/blueprint/{mcp,mcp.test}.ts
  src/app/api/mcp/{invoke,tools}/route.ts

codeflow-versioning:
  src/lib/blueprint/{branches,branches.test}.ts
  src/app/api/branches/{route,[id]/route,diff/route}.ts

codeflow-prd:
  src/lib/blueprint/{prd,prd.test,build,build.test,file-tree,typescript-workspace}.ts
  src/app/api/{blueprint,generate-blueprint}/route.ts

codeflow-analysis:
  src/lib/blueprint/{cycles,smells,metrics,refactor,conflicts}*.ts
  src/app/api/analysis/{cycles,metrics,smells}/route.ts
  src/app/api/{refactor/{detect,heal},conflicts}/route.ts

codeflow-execution:
  src/lib/blueprint/{runner,plan,phases,execute,vcr,runtime-contracts,runtime-tests,runtime-workspace,sandbox,mermaid}*.ts
  src/app/api/{executions/run,vcr,export/mermaid,code-completions}/route.ts

codeflow-agent:
  src/lib/blueprint/{nvidia,prompt-governance,codegen,compile-validation,code-assist}*.ts
  src/lib/opencode/*.ts
  src/app/api/{generate-blueprint,code-suggestions,implement-node}/route.ts
  src/app/api/opencode/{status,start,stop,restart,agent,sessions,sessions/[id],permissions}/route.ts

codeflow-evolution:
  src/lib/blueprint/genetic*.ts
  src/app/api/{genetic/evolve,ghost-nodes}/route.ts

codeflow-canvas:
  src/components/{graph-canvas,blueprint-workbench,file-tabs,file-tree,ide-layout,ide-workbench,code-diff-editor,code-editor,monaco-setup,ts-language-service,opencode-settings}*.ts*
  src/lib/blueprint/{flow-view,edit,traces,node-navigation,heatmap,heatmap.test}.ts
  src/app/api/observability/{ingest,latest}/route.ts

codeflow-dtwin:
  src/lib/blueprint/{digital-twin,digital-twin.test}.ts
  src/app/api/digital-twin/{route,simulate/route}.ts
```

---

## Isolation Testing Strategy

Each package should be testable in isolation — no full monorepo, no Next.js app needed. The testing surface is a **CLI** exposed via each package's `bin` field, plus an **MCP server** where noted. Run the command → assert on output/behavior → that's the signal the package works.

**General pattern for each package:**

```json
// package.json
{
  "bin": {
    "codeflow-<name>": "./dist/bin/cli.js"
  }
}
```

---

### `codeflow-store`

**CLI surface:**

```bash
# Sessions
codeflow-store session init <project-path>
codeflow-store session list
codeflow-store session current

# Checkpoints
codeflow-store checkpoint create <session-id> --message "before refactor"
codeflow-store checkpoint list <session-id>
codeflow-store checkpoint restore <checkpoint-id>

# Approvals
codeflow-store approval list
codeflow-store approval approve <approval-id>
codeflow-store approval reject <approval-id> --reason "..."

# Risk
codeflow-store risk assess <export-path>
```

**Isolation test:** Run against a temp project dir → verify checkpoint files created in `~/.codeflow-store/` → restore → assert files match original state.

**Success signal:** Checkpoint files exist at correct paths, approval state transitions correctly, risk assessment returns a score.

---

### `codeflow-mcp`

**CLI surface:**

```bash
codeflow-mcp tool list
codeflow-mcp tool invoke <tool-name> --args '{"blueprint": "path.json"}'
codeflow-mcp server start --port 3100
```

**MCP server surface:** Connect to any MCP-compatible AI client (Claude Desktop, Cursor, etc.) and call tools directly.

**Isolation test:** Start the MCP server → connect with an MCP client → call `tool list` → assert tools are registered. Call `tool invoke analyze-cycles` with a sample blueprint JSON → assert a cycles result comes back.

**Success signal:** MCP protocol handshake succeeds, tool calls return structured JSON responses.

---

### `codeflow-versioning`

**CLI surface:**

```bash
codeflow-versioning branch create <blueprint.json> --name "feature-auth"
codeflow-versioning branch list <blueprint.json>
codeflow-versioning branch checkout <blueprint.json> --name "feature-auth"
codeflow-versioning branch diff <blueprint.json> --a main --b feature-auth
codeflow-versioning branch delete <blueprint.json> --name "feature-auth"
```

**Isolation test:** Take a sample `blueprint.json` → create 2 branches → list → diff → assert diff shows nodes added in branch B. Delete branch → list → assert it's gone.

**Success signal:** Branch files created at correct paths, diff output shows node-level changes.

---

### `codeflow-prd`

**CLI surface:**

```bash
codeflow-prd parse ./FEATURES.md
codeflow-prd build ./FEATURES.md --output blueprint.json
codeflow-prd reverse ./src --output blueprint.json
codeflow-prd validate ./blueprint.json
```

**Isolation test:** Point at `docs/PACKAGE_DECOMPOSITION.md` (this doc) → `parse` → assert it extracts screens, APIs, modules. Point at `src/` of this repo → `reverse` → assert it produces a valid BlueprintGraph JSON with nodes and edges.

**Success signal:** Parsed output has `nodes[]`, `workflows[]`, `edges[]` matching the source content. Reverse mode produces a graph from real code.

---

### `codeflow-analysis`

**CLI surface:**

```bash
codeflow-analysis cycles ./blueprint.json
codeflow-analysis smells ./blueprint.json
codeflow-analysis metrics ./blueprint.json
codeflow-analysis conflicts ./blueprint.json ./src --threshold 0.7
codeflow-analysis refactor detect ./blueprint.json ./src
codeflow-analysis refactor heal ./blueprint.json ./src --auto
```

**Isolation test:** Use `docs/PACKAGE_DECOMPOSITION.md` (or any sample blueprint) → `cycles` → assert no cycles found on a clean graph. Inject a fake cycle → `cycles` → assert it detects the cycle. Run `smells` → assert god-module/hub-and-spoke detected on a poorly structured graph.

**Success signal:** Each command returns structured JSON with findings. `--json` flag outputs machine-readable results for CI.

---

### `codeflow-execution`

**CLI surface:**

```bash
codeflow-execution plan ./blueprint.json
codeflow-execution phases ./blueprint.json
codeflow-execution run <plan-id> --blueprint ./blueprint.json
codeflow-execution vcr record ./trace-spans.json --name "login-flow"
codeflow-execution vcr replay <recording-id>
codeflow-execution mermaid ./blueprint.json
codeflow-execution sandbox exec ./blueprint.json --node <node-id> --input '{}'
```

**Isolation test:** Take a real blueprint → `plan` → assert batches are topologically sorted. `phases` → assert phase order respects dependencies. `mermaid` → assert valid Mermaid syntax output. `vcr record` + `vcr replay` → assert replay matches original execution order.

**Success signal:** Task batches are valid, phases ordered correctly, VCR recording can be replayed, Mermaid is syntactically valid.

---

### `codeflow-agent`

**CLI surface:**

```bash
# Agent server
codeflow-agent start --port 3101
codeflow-agent stop
codeflow-agent restart
codeflow-agent sessions list
codeflow-agent sessions create --model claude-sonnet
codeflow-agent config list-models

# AI generation (NVIDIA NIM / Llama)
codeflow-agent generate "build a user authentication module with login and signup" --output blueprint.json
codeflow-agent status

# Mock/test mode (no API key needed)
codeflow-agent generate "test prompt" --mock --output blueprint.json

# Per-node code generation + TS validation
codeflow-agent codegen generate ./blueprint.json --node <node-id> --output ./generated/
codeflow-agent codegen validate ./generated/auth-module.ts

# Code improvement suggestions
codeflow-agent codegen suggest ./blueprint.json --node <node-id>

# Agent reasoning (persisted to codeflow-store)
codeflow-agent sessions reasoning <session-id>   # view reasoning trace
codeflow-agent sessions replay <session-id>      # replay reasoning + tool calls
```

**Reasoning persistence:** Agent reasoning (thoughts, tool calls, generated artifacts, session context) is stored in `codeflow-store`. This means reasoning survives restarts and can be checkpointed alongside codeflow execution. `codeflow-versioning` can version reasoning traces — you can `git diff` the reasoning from branch A vs branch B. See [Interaction Model: Reasoning → Store → Versioning](#interaction-model-reasoning--store--versioning) below.

**Isolation test:** `start` → wait for daemon → `agent send "hello"` → assert response. `sessions list` → assert at least one session. `stop` → assert daemon is down. With `--mock`, assert deterministic output. `codegen generate` → assert `.ts`/`.tsx` files created. `codegen validate` → assert TypeScript compiler returns zero errors.

**Success signal:** Daemon starts and responds to agent messages. Sessions persist across restarts. Generated code passes `tsc --noEmit`. Reasoning traces are stored and retrievable from `codeflow-store`.

---

### `codeflow-evolution`

**CLI surface:**

```bash
codeflow-evolution ghost ./blueprint.json
codeflow-evolution ghost ./blueprint.json --model <model-name>
codeflow-evolution evolve ./blueprint.json --generations 20 --population 10
```

**Isolation test:** `ghost` → assert ghost nodes are returned with `suggestedEdges[]`. `evolve` → assert a ranked list of architecture variants is returned after N generations.

**Success signal:** Ghost nodes have `name`, `kind`, `reason`, and `suggestedEdges`. Evolved variants are ranked by fitness score.

---

### `codeflow-canvas`

**Note:** This is primarily a React component package — the CLI tests the **non-React logic** only.

**CLI surface (tests the TypeScript modules):**

```bash
codeflow-canvas render ./blueprint.json --format json
codeflow-canvas edit ./blueprint.json --node <node-id> --summary "updated summary"
codeflow-canvas traces overlay ./blueprint.json ./trace-spans.json
codeflow-canvas heatmap ./blueprint.json ./trace-data.json
codeflow-canvas layout ./blueprint.json --algorithm dot
```

**Isolation test:** `render` → assert valid React Flow JSON (nodes + edges). `edit` → modify a node → assert the JSON is updated. `heatmap` → assert each node gets a `color` field. `traces overlay` → assert each span maps to a node with status.

**React component test:** The `.test.tsx` files test the actual React components with `@testing-library/react`. Run `vitest` in the package — assert components render, node click opens editor, trace overlay colors nodes.

**Success signal:** TypeScript modules produce correct data structures. React components render without errors. Node editing persists changes.

---

### `codeflow-dtwin`

**CLI surface:**

```bash
codeflow-dtwin simulate ./blueprint.json ./trace-data.json
codeflow-dtwin snapshot ./blueprint.json --trace-latest
codeflow-dtwin active-nodes ./blueprint.json ./trace-data.json
```

**Isolation test:** `simulate` → assert it returns a simulation with `activeNodes[]`, `path[]`, `duration`. `active-nodes` → assert each node has `isActive`, `lastCallTime`, `callCount`. `snapshot` → assert it returns current graph state with heatmap data.

**Success signal:** Simulation output describes a plausible user flow. Active nodes match trace data. Snapshot is a valid BlueprintGraph with overlay data.

---

## Interaction Model: Reasoning → Store → Versioning

This section answers the question: **does `codeflow-agent` save reasoning on its own, and does it sync with `codeflow-store` or `codeflow-versioning`?**

### How Reasoning Is Stored

`codeflow-agent` does **not** invent its own storage layer. It uses `codeflow-store` as its persistence backend:

```
codeflow-agent session
    │
    ├── reasoning trace    →  stored in codeflow-store (session-store)
    ├── tool-use history   →  stored in codeflow-store (session-store)
    ├── generated artifacts →  stored in codeflow-store (run-store / checkpoint-store)
    └── LLM context window  →  stored in codeflow-store (session-store)
```

Specifically, every `codeflow-agent` session has a corresponding `session` entry in `codeflow-store`. The agent's reasoning (thought process, tool calls, intermediate results) is serialized as structured JSON and stored as part of the session record. This makes reasoning **checkpointable** — you can snapshot the entire agent state before a risky operation and restore it if something goes wrong.

### How Versioning Syncs With Reasoning

`codeflow-store` and `codeflow-versioning` are designed to be used together:

```
codeflow-versioning
    │
    ├── branch metadata     →  stored in codeflow-versioning (branch-store)
    ├── blueprint diffs    →  stored in codeflow-versioning
    └── reasoning traces   →  references to codeflow-store session records
```

When you create a branch in `codeflow-versioning`, the agent's reasoning for that branch is stored as a session in `codeflow-store` with a `branchId` tag. Switching branches (`checkout`) can restore both the blueprint state **and** the agent's reasoning context for that branch — so if you check out `feature-auth` branch, the agent resumes with the reasoning it had when working on that branch.

### Sync Flow

```
1. codeflow-agent does work → reasoning stored in codeflow-store (session)
2. User creates a branch    → codeflow-versioning snapshots branch
                            → codeflow-store session tagged with branchId
3. User switches branches   → codeflow-versioning restores blueprint
                            → codeflow-agent reasoning context = session from that branch
4. Checkpoint created       → codeflow-store captures run + reasoning checkpoint
                            → codeflow-versioning captures branch state
```

This means **reasoning is versioned by proxy** — there's no separate versioning mechanism for reasoning. A branch contains everything (blueprint + agent sessions + checkpoints) through the combined use of `codeflow-versioning` and `codeflow-store`.

### Key Design Decisions

| Question | Answer |
|----------|--------|
| Does `codeflow-agent` have its own storage? | **No.** It uses `codeflow-store` as its persistence backend. |
| Is reasoning versioned? | **By proxy.** `codeflow-store` sessions are tagged with `branchId`. Branch switching restores both blueprint + reasoning context. |
| Can I replay an agent reasoning trace? | **Yes.** `codeflow-store` sessions are replayable. Use `codeflow-agent sessions replay <session-id>`. |
| Is reasoning checkpointed? | **Yes.** `codeflow-store` checkpoint captures agent session state alongside execution state. |

---

## Test Fixtures

Each package should ship with a `test-fixtures/` directory containing minimal inputs to run the CLI tests without needing the full monorepo:

```
<codeflow-package>/
  test-fixtures/
    minimal-blueprint.json      # smallest valid BlueprintGraph
    sample-blueprint.json       # realistic 5-node graph
    trace-spans.json           # sample trace span data
    prd-sample.md              # sample PRD for parsing tests
    repo-sample/               # mini TypeScript repo for reverse mode
```

This way: `codeflow-analysis cycles ./test-fixtures/sample-blueprint.json` Just Works — no setup required.

---

## CI Signal Per Package

Each package's CI should run (in order):

1. `npm run check` — TypeScript type check (`tsc --noEmit`)
2. `npm run test` — Unit tests (`vitest run`)
3. **Isolation CLI test** — Run the CLI commands above against `test-fixtures/` and assert expected outputs
4. `npm run build` — TypeScript compile to `dist/`

All four must pass for the package to be considered working.

---

## Post-Decomposition Follow-Up: `openflow-guard` (deferred)

After the backend package extraction is complete (including `codeflow-agent`), add a guard package that enforces commit gates before allowing `git commit` to proceed.

### Purpose

`openflow-guard` is a policy/hook orchestration layer. It does not replace analyzers; it composes existing package capabilities into one pre-commit quality gate.

### Proposed Pre-Commit Gate Order

1. Lint gate (`npm run lint` or package-scoped equivalent)
2. Test gate (`npm test` or package-scoped equivalent)
3. Security/diff gate (change-aware checks, security-focused rules, and high-risk findings)
4. Documentation gate (required doc updates/sync for changed behavior)

Commit is blocked until all gates pass.

### Integration points

- `codeflow-analysis`: cycles/smells/metrics/refactor/conflict and risk-oriented checks
- `codeflow-versioning` + `codeflow-store`: persist gate reports, failure reasons, and reasoning checkpoints
- `codeflow-agent`: optional auto-remediation loop that attempts to fix failing gates

### Prompt Packs

Ship prebuilt system prompts for:
- security review/remediation
- documentation sync/update
- optional fix-plan generation for failed gates

### Scope note

This is intentionally deferred until the package backend and OpenCode surfaces are stable, so the guard can reuse package APIs instead of hardcoding monolith paths.
