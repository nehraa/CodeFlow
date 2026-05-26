# CodeFlow Phase 2 Decomposition Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose 3 remaining packages from the CodeFlow monorepo into standalone npm packages that work independently outside the monorepo.

**Architecture:** Three independent npm packages (`@abhinav2203/codeflow-evolution`, `@abhinav2203/codeflow-canvas`, `@abhinav2203/codeflow-dtwin`) with npm dependencies on each other and on `@abhinav2203/codeflow-core`. No monorepo imports, no git imports. Each package has CLI and/or React component + API surface.

**Tech Stack:** TypeScript, Vitest, React 18, @xyflow/react, @monaco-editor/react

---

## Package Implementation Order

```
1. codeflow-evolution  (no dependencies on canvas or dtwin)
2. codeflow-canvas     (depends on core, optional store/execution)
3. codeflow-dtwin       (depends on canvas + execution)
```

---

## Package 1: `@abhinav2203/codeflow-evolution`

### Task 1.1: Create Package Structure

- [ ] Create `packages/codeflow-evolution/` directory
- [ ] Create `src/genetic/`, `src/ghost/`, `src/cli/`, `src/types/` subdirectories
- [ ] Create `test-fixtures/` directory

**Files to create:**
- `packages/codeflow-evolution/package.json`
- `packages/codeflow-evolution/tsconfig.json`
- `packages/codeflow-evolution/tsconfig.build.json`
- `packages/codeflow-evolution/vitest.config.ts`
- `packages/codeflow-evolution/README.md`
- `packages/codeflow-evolution/CHANGELOG.md`

### Task 1.2: Extract Types

- [ ] Create `src/types/index.ts` — export GhostNode, SuggestedEdge, FitnessConfig, GeneticConfig types
- [ ] Reference `@abhinav2203/codeflow-core` for BlueprintGraph type
- [ ] Write `src/types/index.test.ts`

### Task 1.3: Implement Genetic Algorithm

- [ ] Write `src/genetic/genetic.ts` — main genetic algorithm orchestrator
- [ ] Write `src/genetic/crossover.ts` — blueprint graph crossover operations
- [ ] Write `src/genetic/mutation.ts` — mutation operations (add/remove/reconnect nodes)
- [ ] Write `src/genetic/fitness.ts` — fitness scoring using codeflow-analysis metrics
- [ ] Write `src/genetic/population.ts` — population management
- [ ] Write `src/genetic/genetic.test.ts`
- [ ] Create test-fixtures `minimal-blueprint.json`, `sample-blueprint.json`

### Task 1.4: Implement Ghost Nodes

- [ ] Write `src/ghost/ghost-nodes.ts` — LLM-powered suggestion engine
- [ ] Write `src/ghost/suggestion.ts` — node suggestion logic
- [ ] Write `src/ghost/ghost-nodes.test.ts`
- [ ] Integrate with `@abhinav2203/codeflow-agent` for LLM calls

### Task 1.5: Wire CLI and API

- [ ] Write `src/cli/bin.ts` — CLI entry point with ghost, evolve, inspect, validate commands
- [ ] Write `src/index.ts` — main exports for all modules

### Task 1.6: Test and Verify

- [ ] Run `npm run check` — TypeScript type check
- [ ] Run `npm test` — All tests pass
- [ ] Run `npm run build` — Build succeeds
- [ ] Verify CLI works: `codeflow-evolution ghost ./test-fixtures/sample-blueprint.json`
- [ ] Verify CLI works: `codeflow-evolution evolve ./test-fixtures/sample-blueprint.json --generations 5`
- [ ] Commit all changes

---

## Package 2: `@abhinav2203/codeflow-canvas`

### Task 2.1: Create Package Structure

- [ ] Create `packages/codeflow-canvas/` directory
- [ ] Create `src/components/`, `src/flow-view/`, `src/edit/`, `src/traces/`, `src/heatmap/`, `src/observability/`, `src/cli/`, `src/types/` subdirectories
- [ ] Create `test-fixtures/` directory

**Files to create:**
- `packages/codeflow-canvas/package.json`
- `packages/codeflow-canvas/tsconfig.json`
- `packages/codeflow-canvas/tsconfig.build.json` (React JSX)
- `packages/codeflow-canvas/vitest.config.ts`
- `packages/codeflow-canvas/README.md`
- `packages/codeflow-canvas/CHANGELOG.md`

### Task 2.2: Extract Types

- [ ] Create `src/types/index.ts` — shared types for canvas package
- [ ] Reference `@abhinav2203/codeflow-core` for BlueprintGraph type

### Task 2.3: Implement TypeScript Modules (No React Dependencies)

- [ ] Write `src/flow-view/flow-view.ts` — FlowView data structures
- [ ] Write `src/flow-view/flow-view.test.ts`
- [ ] Write `src/edit/edit.ts` — graph editing operations (add/remove/update nodes/edges)
- [ ] Write `src/edit/node-operations.ts` — node-specific operations
- [ ] Write `src/edit/edge-operations.ts` — edge-specific operations
- [ ] Write `src/edit/edit.test.ts`
- [ ] Write `src/traces/traces.ts` — trace data processing
- [ ] Write `src/traces/trace-overlay.ts` — overlay generation for canvas
- [ ] Write `src/traces/traces.test.ts`
- [ ] Write `src/heatmap/heatmap.ts` — heatmap color computation
- [ ] Write `src/heatmap/heatmap.test.ts`
- [ ] Write `src/observability/observability.ts` — observability data processing
- [ ] Write `src/observability/observability.test.ts`
- [ ] Create test-fixtures `minimal-blueprint.json`, `sample-blueprint.json`, `trace-spans.json`

### Task 2.4: Implement React Components

- [ ] Write `src/components/code-editor.tsx` — Monaco wrapper (no dependencies)
- [ ] Write `src/components/code-editor.test.tsx`
- [ ] Write `src/components/monaco-setup.ts` — Monaco configuration
- [ ] Write `src/components/monaco-setup.test.ts`
- [ ] Write `src/components/ts-language-service.ts` — TS language service
- [ ] Write `src/components/file-tabs.tsx` — tab bar
- [ ] Write `src/components/file-tree.tsx` — file tree
- [ ] Write `src/components/graph-canvas.tsx` — React Flow wrapper (depends on flow-view)
- [ ] Write `src/components/graph-canvas.test.tsx`
- [ ] Write `src/components/blueprint-workbench.tsx` — full workbench (composes all above)
- [ ] Write `src/components/blueprint-workbench.test.tsx`
- [ ] Write `src/components/ide-layout.tsx` — IDE layout shell
- [ ] Write `src/components/ide-workbench.tsx` — IDE content area
- [ ] Write `src/components/code-diff-editor.tsx` — diff view
- [ ] Write `src/components/opencode-settings.tsx` — OpenCode settings
- [ ] Write `src/components/codeflow-brand.tsx` — brand components
- [ ] Write `src/components/codeflow-cat-showcase.tsx` — decorative

### Task 2.5: Wire CLI and Exports

- [ ] Write `src/cli/bin.ts` — CLI with render, edit, traces, heatmap, layout commands
- [ ] Write `src/index.ts` — export all components and utilities with named exports
- [ ] Write `src/components/index.ts` — component barrel export
- [ ] Write `src/flow-view/index.ts` — flow-view barrel export
- [ ] Write `src/edit/index.ts` — edit barrel export
- [ ] Write `src/traces/index.ts` — traces barrel export
- [ ] Write `src/heatmap/index.ts` — heatmap barrel export
- [ ] Write `src/observability/index.ts` — observability barrel export

### Task 2.6: Test and Verify

- [ ] Run `npm run check` — TypeScript type check (no implicit any)
- [ ] Run `npm test` — All tests pass
- [ ] Run `npm run build` — Build succeeds with correct React output
- [ ] Verify React component tree-shakeable (named exports only)
- [ ] Verify CLI works: `codeflow-canvas heatmap ./test-fixtures/sample-blueprint.json ./test-fixtures/trace-spans.json`
- [ ] Commit all changes

---

## Package 3: `@abhinav2203/codeflow-dtwin`

### Task 3.1: Create Package Structure

- [ ] Create `packages/codeflow-dtwin/` directory
- [ ] Create `src/digital-twin/`, `src/active-nodes/`, `src/simulate/`, `src/snapshot/`, `src/cli/`, `src/types/` subdirectories
- [ ] Create `test-fixtures/` directory

**Files to create:**
- `packages/codeflow-dtwin/package.json`
- `packages/codeflow-dtwin/tsconfig.json`
- `packages/codeflow-dtwin/tsconfig.build.json`
- `packages/codeflow-dtwin/vitest.config.ts`
- `packages/codeflow-dtwin/README.md`
- `packages/codeflow-dtwin/CHANGELOG.md`

### Task 3.2: Extract Types

- [ ] Create `src/types/index.ts` — SimulationConfig, SimulationResult, ActiveNode, SimulationMetrics types
- [ ] Reference `@abhinav2203/codeflow-core` for BlueprintGraph type
- [ ] Reference `@abhinav2203/codeflow-execution` for trace span types

### Task 3.3: Implement Digital Twin Core

- [ ] Write `src/digital-twin/digital-twin.ts` — main simulation engine
- [ ] Write `src/digital-twin/pathfinder.ts` — path finding through graph (BFS/DFS)
- [ ] Write `src/digital-twin/simulator.ts` — simulation execution with configurable iterations
- [ ] Write `src/digital-twin/metrics.ts` — simulation metrics computation
- [ ] Write `src/digital-twin/digital-twin.test.ts`
- [ ] Create test-fixtures `minimal-blueprint.json`, `sample-blueprint.json`, `simulation-result.json`

### Task 3.4: Implement Active Nodes

- [ ] Write `src/active-nodes/active-nodes.ts` — compute active nodes from trace data
- [ ] Write `src/active-nodes/overlay.ts` — canvas overlay generation for active nodes
- [ ] Write `src/active-nodes/active-nodes.test.ts`

### Task 3.5: Implement Simulation and Snapshot

- [ ] Write `src/simulate/simulate.ts` — simulation API endpoint
- [ ] Write `src/simulate/simulate.test.ts`
- [ ] Write `src/snapshot/snapshot.ts` — current state snapshot from traces
- [ ] Write `src/snapshot/snapshot.test.ts`

### Task 3.6: Wire CLI and Exports

- [ ] Write `src/cli/bin.ts` — CLI with simulate, active-nodes, snapshot, overlay commands
- [ ] Write `src/index.ts` — main exports for all modules
- [ ] Write barrel exports for each sub-module

### Task 3.7: Test and Verify

- [ ] Run `npm run check` — TypeScript type check
- [ ] Run `npm test` — All tests pass
- [ ] Run `npm run build` — Build succeeds
- [ ] Verify CLI works: `codeflow-dtwin simulate ./test-fixtures/sample-blueprint.json`
- [ ] Verify CLI works: `codeflow-dtwin active-nodes ./test-fixtures/sample-blueprint.json --trace-latest`
- [ ] Commit all changes

---

## Final Update: docs/PACKAGE_DECOMPOSITION.md

After all 3 packages are complete:

- [ ] Update `docs/PACKAGE_DECOMPOSITION.md` — mark codeflow-evolution as COMPLETE (Phase 4)
- [ ] Update `docs/PACKAGE_DECOMPOSITION.md` — mark codeflow-canvas as COMPLETE (Phase 5)
- [ ] Update `docs/PACKAGE_DECOMPOSITION.md` — mark codeflow-dtwin as COMPLETE (Phase 5)
- [ ] Add "Published Packages" section listing all 11 packages with version numbers
- [ ] Commit the update

---

## Skills to Use per Task

| Task | Primary Skill | Secondary Skills |
|------|---------------|------------------|
| Genetic algorithm | `sparc:tdd` | `pr-review-toolkit:code-reviewer`, `simplify` |
| Ghost nodes | `sparc:coder` | `sparc:documenter`, `pr-review-toolkit:code-reviewer` |
| React components | `sparc:tester` | `frontend-design@claude-plugins-official`, `pr-review-toolkit:code-reviewer` |
| TypeScript modules | `sparc:tdd` | `simplify`, `pr-review-toolkit:code-reviewer` |
| Simulation engine | `sparc:tdd` | `sparc:coder`, `pr-review-toolkit:code-reviewer` |

---

## Verification Commands (Run After Each Package)

```bash
# 1. Type check
cd packages/codeflow-evolution && npm run check
cd packages/codeflow-canvas && npm run check
cd packages/codeflow-dtwin && npm run check

# 2. Tests
cd packages/codeflow-evolution && npm test
cd packages/codeflow-canvas && npm test
cd packages/codeflow-dtwin && npm test

# 3. Build
cd packages/codeflow-evolution && npm run build
cd packages/codeflow-canvas && npm run build
cd packages/codeflow-dtwin && npm run build

# 4. Isolation test (in empty dir)
cd /tmp && mkdir test-isolation && cd test-isolation
npm install @abhinav2203/codeflow-evolution
npx codeflow-evolution ghost ./blueprint.json  # test actual CLI
```

---

## Critical Constraints

1. **NO MONOREPO IMPORTS** — All imports use `@abhinav2203/codeflow-*` npm packages only
2. **NO `any` TYPES** — Full TypeScript strict mode
3. **TESTS NEXT TO SOURCE** — Every `.ts`/`.tsx` has co-located `.test.ts`/`.test.tsx`
4. **COMMIT AFTER EACH TASK** — Use conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
5. **NO PLACEHOLDERS** — Every step has complete code, no "TODO", no "TBD"
6. **CLI AS CONTRACT** — If CLI works standalone, the package is correctly decomposed