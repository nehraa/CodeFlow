# codeflow-prd

Markdown PRD parser. The entry point for turning product requirements into a typed `BlueprintGraph`. The rest of the pipeline (analysis, execution, versioning) operates on the graph this package produces.

## Version

`0.1.3`. Active development.

## Public API

```
@abhinav2203/codeflow-prd          (parsePrd, buildBlueprintGraph)
@abhinav2203/codeflow-prd/build    (buildBlueprintGraph)
```

The root barrel re-exports both `parsePrd` and `buildBlueprintGraph`. Most consumers use the root.

## How It Works

`parsePrd(prdText: string): { nodes, edges, workflows, warnings }` walks the markdown line by line. The parser recognizes five patterns:

1. **Headings** become `module` nodes (`#`) or subnodes (`##`/`###`). Subheading text drives the node kind via keyword matching.
2. **Inline tags** like `api: POST /users/:id` or `function validateEmail(email: string): boolean` become typed nodes with inferred contracts.
3. **HTTP method patterns** (`GET /path`, `POST /path`, `PUT /path`, `DELETE /path`) become `api` nodes.
4. **Signature lines** (`name(params): returnType`) become method specs on the most recent node.
5. **Workflow lines** (`a -> b -> c` or `a ->> b -> c`) become `calls` edges with `confidence: 0.7`.

Each detected line becomes a `BlueprintNode` with:

- An `emptyContract()` (zero attributes, zero methods, zero I/O)
- An inferred contract built from the tag/signature, if applicable
- A `sourceRefs: [{ kind: 'prd', section, detail }]` pointing back to the line

Warnings are emitted when the parser detects ambiguity (a heading matches multiple kind keywords, a signature has an unrecognized type, a workflow references an unknown node).

## Node Kind Inference

Keyword matching on heading text drives the kind:

| Keywords in heading | Kind |
|---|---|
| `screen`, `page`, `ui`, `frontend` | `ui-screen` |
| `api`, `endpoint`, `route`, `backend` | `api` |
| `class`, `service`, `controller`, `manager` | `class` |
| `function`, `method` | `function` |
| `module`, `component`, `domain` | `module` |
| (no match) | inherits from parent heading |

Inline tags override heading inference. If a heading says "API" and a line under it says `function foo()`, the function wins for that line.

## buildBlueprintGraph

`buildBlueprintGraph(request: BuildBlueprintRequest)` is the higher-level entry point. Currently consumes only `request.prdText`. The signature reserves space for future inputs:

```typescript
type BuildBlueprintRequest = {
  projectName: string;
  prdText: string;
  repoPath?: string;     // reserved: triggers PRD + repo analysis merge
  docsPath?: string;     // reserved: triggers PRD + CodeRag merge
};
```

The function:

1. Runs `parsePrd` on the text
2. Wraps the partial graph with `projectName`, `mode: 'spec'`, `phase: 'spec'`, `generatedAt`
3. Calls `withSpecDrafts` from `codeflow-execution` to backfill `specDraft` placeholders for any code-bearing node missing one
4. Returns the wrapped graph

`mode: 'spec'` flags the graph as a spec-only artifact. Callers can validate the graph passes the analyzer's `parseBlueprintGraph` before passing it downstream.

## Merge Helpers

`utils.ts` ships pure helpers used during graph composition:

- `mergeContracts(a, b)` - merge two contracts (fields, methods, I/O) into one. Used when the PRD and the repo define overlapping nodes.
- `mergeSourceRefs(a, b)` - concatenate and dedupe source provenance.
- `mergeMethodSpecs(a, b)` - merge two method spec lists.
- `mergeFields(a, b)` - merge two field lists, deduping by name.
- `mergeStringLists(a, b)` - concatenate and dedupe string arrays.
- `dedupeEdges(edges)` - remove duplicate edges by `{from, to, kind}`.

All merge helpers are deterministic and order-preserving. Two runs of the same merge over the same inputs produce identical output.

## Source Layout

```
src/
├── index.ts            # parsePrd, buildBlueprintGraph
├── prd.ts              # parsePrd implementation
├── build.ts            # buildBlueprintGraph
├── invoke.ts           # barrel (alias of index)
├── utils.ts            # merge helpers, slugify, createNodeId
├── prd.test.ts         # parser tests
└── build.test.ts       # build tests
```

## PRD Style Guide

To get the cleanest graph, follow these conventions in your PRD:

- Use one `#` per top-level domain (e.g. `# Auth Service`).
- Use `##` for the next layer (e.g. `## Login Flow`).
- Use a single inline tag per code line: `api: POST /path`, `function name(): type`, `screen: Name`.
- Put signatures on their own line, indented under the node.
- For workflows, use `a -> b -> c` for sync flows and `a ->> b` for async.

A well-formed PRD gives you a graph that needs no manual repair.

## Known Limitations

- The parser is line-oriented. Multi-line signatures or block-level tags are not detected.
- Workflow lines use `confidence: 0.7`. Downstream consumers should treat them as suggestions, not ground truth.
- The parser does not validate referenced symbols. A workflow `auth -> billing` produces an edge even if no `auth` or `billing` node exists. The validator runs at `buildBlueprintGraph` time and emits warnings.

## Extension Points

### Adding a new pattern

1. Add a regex/keyword matcher in `prd.ts`.
2. Emit a node or edge with the right kind and contract.
3. Add a test in `prd.test.ts` that covers the new pattern.
4. Add a section to the PRD style guide above.

### Custom keyword aliases

The keyword map in `prd.ts` is a frozen object. To add a domain-specific alias, fork the map and pass a custom parser config (a planned API, not yet shipped). For now, work around with inline tags.
