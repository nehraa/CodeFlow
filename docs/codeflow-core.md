# codeflow-core

The graph data model. Owns the Zod schemas every other package validates against, the multi-language tree-sitter analyzer, conflict detection, and artifact export. Nothing else in the monorepo defines a `BlueprintNode` or `BlueprintGraph`. Every package that touches the graph imports these schemas.

## Version

`1.1.5`. Stable. Used by every other CodeFlow package.

## Public API

The package exposes five subpath exports from its `package.json`:

```
@abhinav2203/codeflow-core            (root barrel)
@abhinav2203/codeflow-core/schema     (Zod schemas + inferred types)
@abhinav2203/codeflow-core/analyzer   (tree-sitter repo analysis)
@abhinav2203/codeflow-core/conflicts  (graph-vs-repo conflict detection)
@abhinav2203/codeflow-core/export     (artifact export to disk)
@abhinav2203/codeflow-core/storage    (filesystem path helpers)
```

Most consumers import the root barrel. Reach for a subpath when you need to trim bundle size or avoid pulling in tree-sitter.

## The Schemas

The graph is a union of nodes, edges, workflows, and provenance. Defined in `schema/index.ts` as Zod schemas with inferred TypeScript types.

### Node kinds

Five kinds cover the full surface of a typical application:

```typescript
type BlueprintNodeKind = 'function' | 'module' | 'api' | 'class' | 'ui-screen';
```

`function` is the leaf (a pure or near-pure transform). `class` carries state. `api` represents an HTTP endpoint. `ui-screen` is a route-level page or view. `module` groups related nodes.

### Node status

```typescript
type NodeStatus = 'spec_only' | 'implemented' | 'verified' | 'connected';
```

A node starts at `spec_only` after PRD parsing. `withSpecDrafts` from `codeflow-execution` backfills placeholder code. You advance a node to `implemented` when real code lives at the target path. `verified` means tests pass. `connected` means wiring to its neighbors is complete.

### Edge kinds

Eight kinds. The most used:

- `calls` - one node invokes another
- `reads-state` - one node reads from another's state
- `writes-state` - one node mutates another's state
- `depends-on` - topological dependency
- `renders` - a UI node displays another node
- `implements` - a node implements a contract
- `extends` - inheritance
- `triggers` - one event causes another

### Contracts

Each node carries a `CodeContract`:

```typescript
type CodeContract = {
  attributes: ContractField[];
  methods: MethodSpec[];
  inputs: ContractField[];
  outputs: ContractField[];
};
```

`ContractField` has a name, type, optionality, and description. `MethodSpec` has a signature, parameter list, return type, and side effects flag. Contracts are the unit of structural diff in `codeflow-versioning`.

### The graph itself

```typescript
type BlueprintGraph = {
  projectName: string;
  mode: 'spec' | 'runtime';
  phase: BlueprintPhase;
  generatedAt: string;            // ISO 8601
  nodes: BlueprintNode[];
  edges: BlueprintEdge[];
  workflows: Workflow[];
  sourceRefs?: SourceRef[];
};
```

`mode` distinguishes a spec-only graph (PRD output) from a runtime graph (execution output). `phase` carries the lifecycle position.

## The Analyzer

`analyzer/index.ts` ships two entry points.

### `analyzeTypeScriptRepo(repoPath)`

TypeScript-only. Walks the repo, parses files with the TypeScript compiler API, extracts functions, classes, methods, calls, imports, and exports. Returns a partial `BlueprintGraph` (no `projectName`, `mode`, or `generatedAt` because the caller fills those in).

This is the fast path. Use it when you know the target is a TS/JS monorepo and you want a quick structural snapshot.

### `analyzeRepo(repoPath, options?)`

Multi-language. Backed by `web-tree-sitter` with grammars for `go`, `python`, `c`, `cpp`, `rust`, `typescript`, `javascript`. Returns a `RepoAnalysisResult` with two new fields beyond the TS analyzer:

- `sourceSpans`: per-node `{ filePath, startLine, endLine }` for editor navigation.
- `callSites`: per-edge `{ fromNodeId, toNodeId, callExpression, filePath, line }` for impact analysis.

The analyzer loads tree-sitter lazily on first use. Call `tree-sitter-loader.ts` to preload grammars.

### `buildBlueprintGraph(request)`

Composes a PRD and a repo analysis into a full graph. PRD nodes get `sourceRefs: [{ kind: 'prd', section, detail }]`. Repo-discovered nodes get `sourceRefs: [{ kind: 'repo', filePath, span }]`. Conflicts between the two surface in the `warnings` array.

## Conflicts

`conflicts/index.ts` exports `detectGraphConflicts(graph, repoPath)`. Runs the TS analyzer over the repo, then compares each graph node against what the analyzer found. Returns a `ConflictReport` of:

- `missing-in-repo`: graph claims a node exists at a path, but the file is gone or the symbol is missing
- `missing-in-blueprint`: repo has a symbol with no corresponding graph node (potentially undocumented code)
- `signature-mismatch`: node's `signature` field disagrees with the actual function signature in source
- `summary-mismatch`: node's `summary` field disagrees with the function's doc comment

Each record carries `suggestedAction` (one of: keep-graph, update-graph, drop-node, add-node, regenerate-spec).

## Export

`export/index.ts` exports `exportBlueprintArtifacts(graph, outputDir?, executionReport?, codeDrafts?)`. Writes:

- A scaffolded file per code-bearing node to `outputDir/stubs/<kind>-<name>.ts`
- A `graph.json` snapshot for re-import
- An `execution-report.json` if you pass one
- A `code-drafts.json` if you pass drafts

Returns an `ExportResult` with the list of paths written and any I/O errors. The exporter will not overwrite a file unless you pass `force: true` (a flag on the second arg in the options bag).

## Storage

`storage/store-paths.ts` ships pure path helpers. The store root lives at `~/.codeflow-store/` by default. Override with the `CODEFLOW_STORE_ROOT` env var. Helpers include:

- `getStoreRoot()`
- `sessionDirForProject(projectName)`
- `branchDirForProject(projectName, slug)`
- `approvalPath(projectName, approvalId)`
- `runPath(projectName, runId)`
- `checkpointPath(projectName, runId, taskId)`
- `observabilityPath(projectName)`

These are used by `codeflow-store`, `codeflow-versioning`, and the IDE.

## Source Layout

```
src/
├── index.ts                    # root barrel
├── schema/
│   ├── index.ts                # barrel
│   ├── blueprint-graph.ts      # BlueprintGraph, BlueprintNode, BlueprintEdge
│   ├── contracts.ts            # CodeContract, MethodSpec, ContractField
│   ├── lifecycle.ts            # NodeStatus, BlueprintPhase, TraceStatus
│   └── provenance.ts           # OutputProvenance, FeatureMaturity
├── analyzer/
│   ├── index.ts                # analyzeRepo, analyzeTypeScriptRepo, buildBlueprintGraph
│   ├── tree-sitter-loader.ts   # grammar registry
│   ├── tree-sitter-queries.ts  # per-language queries
│   └── tree-sitter-analyzer.ts # QUERIES_BY_LANGUAGE map
├── conflicts/
│   └── index.ts                # detectGraphConflicts
├── export/
│   └── index.ts                # exportBlueprintArtifacts
└── storage/
    └── store-paths.ts          # path helpers
```

## Extension Points

### Adding a new node kind

1. Add the literal to `BlueprintNodeKind` in `schema/blueprint-graph.ts`.
2. Add a default `placeholderSpecDraft` in `codeflow-execution/phases.ts`.
3. Update `codeflow-canvas` shape rendering (the `[]`/`()`/`{}` mapping lives in `codeflow-execution/mermaid.ts` too).
4. Add an icon in the canvas component layer.

### Adding a new edge kind

1. Add the literal to `BlueprintEdgeKind`.
2. Update `codeflow-versioning/diff.ts` to handle the new key in `edgeKey` hashing.
3. Update `codeflow-analysis/smells.ts` if the new edge has its own smell (for example, `unstable-dependency` uses `calls`).

### Adding a new language

1. Add the tree-sitter grammar to `tree-sitter-loader.ts`.
2. Map the file extensions in `extensionToLanguage`.
3. Write queries in `tree-sitter-queries.ts` to extract functions, classes, methods, calls, imports, and inheritance.
4. Register the language in `QUERIES_BY_LANGUAGE`.

## Why It Matters

Every other CodeFlow package depends on this one. When you add a feature to the graph, you add it here first. The schemas are the contract. If the contract changes, you bump the major version and every downstream package rebuilds.
