# codeflow-analysis

Five analyzers over a `BlueprintGraph`. Cycle detection, smell detection, structural metrics, drift healing, repo conflict reporting. Each ships as a subpath export so you can pull in just what you need.

## Version

`0.1.2`. Active development.

## Public API

```
@abhinav2203/codeflow-analysis            (barrel: all five)
@abhinav2203/codeflow-analysis/cycles     (Tarjan SCC)
@abhinav2203/codeflow-analysis/smells     (god nodes, hubs, coupling)
@abhinav2203/codeflow-analysis/metrics    (degree, density, components)
@abhinav2203/codeflow-analysis/refactor   (drift detection + healing)
@abhinav2203/codeflow-analysis/conflicts  (graph-vs-repo)
```

CLI: `codeflow-analysis` binary at `dist/bin/cli.js`. Subcommands mirror the subpath exports.

## Cycle Detection

`detectCycles(graph): CycleReport`

Iterative Tarjan's strongly-connected-components algorithm over the edge adjacency map. Recursive Tarjan blows the stack on dense graphs with 1000+ nodes; the iterative variant handles graphs in the tens of thousands without trouble.

```typescript
type CycleReport = {
  totalCycles: number;
  maxCycleLength: number;
  cycles: Array<{ nodeIds: string[]; edges: BlueprintEdge[] }>;
  affectedNodeIds: string[];
};
```

Each cycle includes both the node IDs and the edge records (so callers can render a sub-graph or highlight specific edges in the UI). `hasCycles(graph)` is a boolean shortcut.

## Smell Detection

`detectSmells(graph): SmellReport`

Heuristic smell detection with configurable thresholds. Each smell has a `severity` (`critical | warning | info`) and a `rationale` string.

| Smell | Trigger | Severity |
|---|---|---|
| `god-node` | ≥7 methods AND ≥5 distinct responsibilities | critical |
| `hub-node` | total degree (in + out) ≥8 | warning |
| `tight-coupling` | a node has more than 3 callers that each also depend on a sibling | warning |
| `unstable-dependency` | a node's `instability` (out-degree / total-degree) > 0.8 | warning |
| `scattered` | a node has ≥4 distinct side effects (writes, mutates, triggers) | info |

The report includes a `healthScore: 0-100`. Subtract `15 × critical + 8 × warning + 3 × info` from 100, clamped to `[0, 100]`. A graph with three god-nodes and five hubs scores `100 - 45 - 40 = 15`.

```typescript
type SmellReport = {
  smells: Array<{ kind: SmellKind; nodeId: string; severity: Severity; rationale: string }>;
  totalSmells: number;
  healthScore: number;
};
```

## Metrics

`computeGraphMetrics(graph): GraphMetrics`

Full structural stats. Useful for dashboarding and for tuning smell thresholds over time.

```typescript
type GraphMetrics = {
  nodeCount: number;
  edgeCount: number;
  nodeCountByKind: Record<BlueprintNodeKind, number>;
  nodeCountByStatus: Record<NodeStatus, number>;
  edgeCountByKind: Record<BlueprintEdgeKind, number>;
  density: number;          // edgeCount / (nodeCount × (nodeCount - 1))
  avgDegree: number;
  maxInDegree: number;
  maxOutDegree: number;
  avgMethodsPerNode: number;
  avgResponsibilitiesPerNode: number;
  connectedComponents: number;     // via Union-Find
  isolatedNodes: string[];
  leafNodes: string[];
};
```

Connected components uses iterative Union-Find with path compression, so the call handles deep, fragmented graphs without recursion depth issues.

## Refactor / Drift Healing

`detectDrift(graph): RefactorReport`

Finds three classes of architectural drift:

- `broken-edge` - an edge references a `from` or `to` node ID that no longer exists in the graph (after a node was deleted elsewhere)
- `missing-edge` - a contract's `methods[].calls` list contains a target that has no corresponding graph edge
- `signature-drift` - a node's top-level `signature` field differs from the first method's signature (suggests the contract was updated but the summary wasn't)

`healGraph(graph): HealResult` returns a fixed graph. Healing rules:

- Drops broken edges
- Adds missing edges with `confidence: 0.5` (caller should verify)
- Updates the top-level `signature` to match the first method

The heal function never deletes nodes, never mutates contracts, and never touches `sourceRefs`. The fixed graph is a copy.

## Repo Conflicts

`detectGraphConflicts(graph, repoPath): ConflictReport`

Runs the TypeScript repo analyzer from `codeflow-core` and diffs each graph node against what the analyzer found. Same `ConflictReport` shape as `codeflow-core/conflicts` (`missing-in-repo`, `missing-in-blueprint`, `signature-mismatch`, `summary-mismatch`).

Useful for catching the case where the graph and the actual code have drifted because someone edited the code without updating the PRD.

## Source Layout

```
src/
├── index.ts              # barrel
├── cycles.ts             # iterative Tarjan
├── smells.ts             # heuristic smell rules
├── metrics.ts            # structural stats
├── refactor.ts           # drift detection + healing
├── conflicts.ts          # re-exports codeflow-core/conflicts
├── invoke.ts             # barrel alias
├── handlers/             # CLI subcommand handlers
├── app/                  # app-level composition
├── bin/cli.ts            # codeflow-analysis CLI
└── *.test.ts             # one per analyzer
```

## Extension Points

### Adding a new smell

1. Add the kind literal to the `SmellKind` union in `smells.ts`.
2. Add the detection function with a clear name (`detectXxx`).
3. Add it to the `detectSmells` orchestrator.
4. Add a test fixture graph in `smells.test.ts`.

### Tuning thresholds

The thresholds (god-node at 7 methods, hub at 8 degree, etc.) live as module-level constants. Lift them to a config object if you need per-project tuning. The current shape is fine for one-tenant graphs.

## Performance Notes

All five analyzers are O(V + E) or O(V × E) at worst. A 5000-node graph with 12,000 edges runs cycle detection in under 200ms, smells in under 100ms, metrics in under 50ms on a modern laptop. Drift healing copies the graph (O(V + E)).

If you need to analyze graphs with 50k+ nodes, run each analyzer in a worker thread. The current implementation is single-threaded and synchronous.
