# CodeFlow Package Documentation

One document per package. Each covers purpose, public API surface, internal architecture, key types, and extension points. Read in any order. The [architecture overview](#architecture) at the bottom of this file shows how the packages fit together.

## Foundation

- [codeflow-core](./codeflow-core.md) - The graph data model. Zod schemas, multi-language tree-sitter analyzer, conflict detection, artifact export.
- [codeflow-prd](./codeflow-prd.md) - Markdown PRD parser. The entry point that turns requirements into a typed graph.

## Reasoning and Execution

- [codeflow-analysis](./codeflow-analysis.md) - Cycle detection, smell detection, structural metrics, drift healing, repo conflict reporting.
- [codeflow-execution](./codeflow-execution.md) - Run plans, isolated TypeScript workspaces, VCR recordings, Mermaid export, sandbox diffs.
- [codeflow-versioning](./codeflow-versioning.md) - Branch lifecycle, structural diff, reasoning snapshots, CodeRag-backed branch search.

## Storage and Surfaces

- [codeflow-store](./codeflow-store.md) - Local persistence. Sessions, runs, branches, checkpoints, approvals, observability, risk.
- [codeflow-mcp](./codeflow-mcp.md) - JSON-RPC server and client. Stdio and HTTP transports, tool registry.
- [codeflow-canvas](./codeflow-canvas.md) - React Flow canvas, Monaco editors, blueprint store hook, file tree, heatmap.

## Simulation and Evolution

- [codeflow-dtwin](./codeflow-dtwin.md) - Digital twin engine. Spans into user flows, active node computation, simulated span generation.
- [codeflow-evolution](./codeflow-evolution.md) - Genetic algorithm for architecture variants. Tournament selection, four-dimension fitness, ghost node suggestions.

## Orchestration and Indexing

- [codeflow-agent](./codeflow-agent.md) - Subagent dispatch. Skill, MCP, and plugin registries. Task queue with dependency resolution.
- [coderag](./coderag.md) - Standalone repo RAG. Tree-sitter indexing, LanceDB, MCP tools, local or Gemini embeddings.

## The IDE

- [codeflow-master](./codeflow-master.md) - The Next.js IDE that integrates the 12 packages above into a single canvas-centric environment.

## Architecture

The data flow is acyclic. The `BlueprintGraph` is the spine. Every package either reads the graph, writes to it, or produces artifacts derived from it.

```
[codeflow-prd]        parsePrd(text) ──> BlueprintGraph
[codeflow-core]       analyzer, schema, conflicts, export
[codeflow-analysis]   read graph ──> CycleReport, SmellReport, metrics
[codeflow-execution]  read graph ──> runBlueprint() in sandbox
[codeflow-store]      persist sessions, runs, branches, checkpoints
[codeflow-versioning] read graph ──> branches, structural diff, CodeRag search
[codeflow-dtwin]      read graph + spans ──> DigitalTwinSnapshot
[codeflow-evolution]  mutate graph ──> architecture variants
[codeflow-canvas]     render graph ──> React Flow + Monaco UI
[codeflow-mcp]        expose tools over JSON-RPC
[codeflow-agent]      dispatch subagents with skills, MCP, plugins
[coderag]             index source repo ──> LanceDB for semantic search
[codeflow-master]     tie it all together in Next.js
```

Build order: `codeflow-core` first, then everything that depends only on it, then transitive dependents. The full build graph is in the [root README](../README.md).
