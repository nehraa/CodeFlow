# Backlog

## Remaining product work
- Safe conflict remediation: apply selected drift fixes back into the blueprint or generated files instead of only reporting them.
- Persistent store hardening: replace the file-backed store with SQLite if concurrent access or richer querying becomes necessary.
- Remote sandbox support: add true git worktrees or remote sandboxes beyond the current local `.codeflow-sandboxes/` flow.

## Recently shipped
- **Dependency cycle detection** (`cycles.ts`): Iterative Tarjan's SCC algorithm detects circular dependencies across blueprint nodes.
- **Architecture smell detection** (`smells.ts`): Six detectors (god-node, hub-node, orphan-node, tight-coupling, unstable-dependency, scattered-responsibility) with composite health scoring (0–100).
- **Blueprint graph metrics** (`metrics.ts`): Graph analytics including density, degree distribution, connected components, complexity scores, and node/edge breakdowns.
- **Mermaid diagram export** (`mermaid.ts`): Export blueprint as Mermaid flowchart or class diagram for embedding in markdown, GitHub, Obsidian, or Notion.
- **Analysis API routes**: `/api/analysis/cycles`, `/api/analysis/smells`, `/api/analysis/metrics`, `/api/export/mermaid`.
- **Analysis panel in workbench UI**: Integrated architecture analysis with one-click "Analyze" button showing metrics, smells, cycles, and Mermaid output.

## R&D / future scope
- Memory-level tracing: sandboxed Node support for stack and memory snapshots mapped to blueprint nodes.
- Multi-language ingestion: extend analysis beyond TypeScript once the TS pipeline is stable enough to generalize.
- Collaboration/sharing: invite links or import/export bundles for multi-user workflows.
- Architecture fitness functions: define and track architectural constraints as automated checks that run on every blueprint change.
- Graph diffing / version comparison: side-by-side comparison of two blueprint versions to visualize architectural evolution.
- Dependency impact analysis: predict the blast radius of changing a specific node by tracing transitive dependents.
- Blueprint templates: pre-built architecture templates for common patterns (microservices, hexagonal, event-driven, etc.).
