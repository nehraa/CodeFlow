# CodeFlow

Code-as-graph platform for AI-driven software development. You write a product requirements document in markdown. The parser lifts it into a typed `BlueprintGraph` of functions, classes, APIs, and UI screens. The other packages reason over that graph: analyze it for smells, execute it in a sandbox, snapshot it as a versioned branch, simulate user flows through it, evolve it with a genetic algorithm, render it on a React Flow canvas. CodeRag indexes the underlying source repository so the platform can answer questions about the actual code.

Fourteen packages, one Next.js IDE, one MCP server, one CLI.

## Why It Exists

Software work happens in two layers: the requirements ("the user can reset their password") and the code (`POST /auth/reset`). Most tooling forces you to maintain both as separate artifacts that drift apart. CodeFlow collapses the gap. The PRD is the source of truth. The graph is a derived, typed representation you can analyze, version, simulate, and execute. The code you write for each node is an implementation detail, not the primary artifact.

This changes what tools you can build. Once the structure is a graph you can run cycle detection, find god nodes, simulate traffic, evolve architectures, diff branches by their structural fingerprint rather than line-by-line, and answer "where is auth handled?" with retrieval over a semantic index.

## The Packages

Every package lives in `packages/` and publishes to npm under the `@abhinav2203` scope. The `codeflow-master` package is the Next.js IDE that ties them together. Per-package deep dives live in [`docs/`](./docs).

| Package | What It Does |
|---|---|
| [`codeflow-core`](./docs/codeflow-core.md) | Zod schemas, multi-language tree-sitter analyzer, conflict detection, artifact export. The graph data model. |
| [`codeflow-prd`](./docs/codeflow-prd.md) | Markdown PRD parser. Infers nodes and edges from headings, inline tags, HTTP patterns, and workflow lines. |
| [`codeflow-analysis`](./docs/codeflow-analysis.md) | Cycle detection (Tarjan SCC), smell detection (god nodes, hubs, tight coupling), structural metrics, drift healing, repo conflicts. |
| [`codeflow-execution`](./docs/codeflow-execution.md) | Run plans via topological batching, isolated TS workspaces, VCR recordings of trace spans, Mermaid export, sandbox diffs. |
| [`codeflow-versioning`](./docs/codeflow-versioning.md) | Branch creation, structural diff, reasoning snapshots, CodeRag-backed search and explain. |
| [`codeflow-store`](./docs/codeflow-store.md) | Local session storage, project-scoped state, checkpoints, approvals, observability, risk reports. |
| [`codeflow-mcp`](./docs/codeflow-mcp.md) | JSON-RPC MCP server and client for blueprint operations. Stdio and HTTP transports. |
| [`codeflow-canvas`](./docs/codeflow-canvas.md) | React Flow graph canvas, Monaco code editors, IDE layout components, blueprint store hook. |
| [`codeflow-dtwin`](./docs/codeflow-dtwin.md) | Digital twin simulation. Groups spans into user flows, computes active nodes, synthesizes simulated spans. |
| [`codeflow-evolution`](./docs/codeflow-evolution.md) | Genetic algorithm for architecture evolution. Monolith and microservices variants, tournament selection, four-dimension fitness. |
| [`codeflow-agent`](./docs/codeflow-agent.md) | Orchestrates subagent-driven development. Spawns Claude Code agents per task with skill, MCP, and plugin registries. |
| [`codeflow-master`](./docs/codeflow-master.md) | The unified Next.js IDE. Integrates the 12 packages above into a single canvas-centric environment. |
| [`CodeRag`](./docs/coderag.md) | Standalone repo RAG engine. Tree-sitter indexing, LanceDB storage, MCP tools for query, lookup, explain, impact. |
| `codeflow-prd-test-npm` | Placeholder package, no runtime code. Reserved for downstream test consumers. |

## Architecture

```
PRDs in markdown
    |
    v
[codeflow-prd]  parsePrd()  ──>  BlueprintGraph (spec)
    |                                  |
    |                                  v
    |                         [codeflow-core]  analyzer, schema, conflicts
    |                                  |
    |                                  v
    |                         [codeflow-execution]  runBlueprint() in sandbox
    |                                  |
    |                                  v
    |                         [codeflow-store]  checkpoints, runs, approvals
    |                                  |
    +───── [codeflow-analysis]  ◄──────┘  detect cycles, smells, metrics
    |
    +───── [codeflow-versioning]  ──>  branches, structural diff, CodeRag search
    |
    +───── [codeflow-dtwin]  ──>  simulate user flows, active nodes
    |
    +───── [codeflow-evolution]  ──>  genetic variants, fitness benchmark
    |
    v
[codeflow-canvas]  React Flow + Monaco  ──>  [codeflow-master] Next.js IDE
    |
    v
[codeflow-mcp]  JSON-RPC server  ◄───  [codeflow-agent]  subagent dispatch
    |
    v
[CodeRag]  LanceDB index of the actual source repo
```

The data flow is acyclic. The graph is the spine. Every other package either reads the graph, writes to it, or produces artifacts derived from it.

## The BlueprintGraph

The central type. A `BlueprintGraph` has:

- `nodes`: `BlueprintNode[]` where each node carries a `kind` (`function | module | api | class | ui-screen`), a `status` (`spec_only | implemented | verified | connected`), a `contract` with methods, fields, and I/O, and a `specDraft` placeholder for code generation.
- `edges`: `BlueprintEdge[]` with eight kinds including `calls`, `reads-state`, `writes-state`, `depends-on`, `renders`.
- `workflows`: named sequences of node references, the user-visible flows.
- `sourceRefs`: provenance pointing back to the PRD section, repo file span, or branch that produced each node.

Every package operates on this shape. Analysis diffs two graphs. Versioning hashes nodes and edges into stable `nodeKey`/`edgeKey` fingerprints. Evolution mutates the graph with crossover and mutation operators. Execution walks it in topological batches.

## Quick Start

Install the IDE:

```bash
git clone https://github.com/nehraa/CodeFlow.git
cd CodeFlow
npm install
cd packages/Codeflow_master
npm run dev
```

The IDE opens at `http://localhost:3000` with the canvas, file tree, and Monaco editor in a single workbench.

Install CodeRag into a target repo:

```bash
cd your-project
npm install @abhinav2203/coderag
npx coderag init
npx coderag query "where is auth handled?"
npx coderag serve-mcp
```

CodeRag installs a `post-commit` hook that reindexes after each commit. It supports TypeScript, JavaScript, Go, Python, C, C++, and Rust. Embeddings run locally with ONNX (`Xenova/gte-small`, 384-dim) or remotely with Gemini.

Use the MCP server from Claude Code or Cursor by adding to your MCP config:

```json
{
  "mcpServers": {
    "codeflow": {
      "command": "npx",
      "args": ["-y", "@abhinav2203/codeflow-mcp"]
    }
  }
}
```

## Writing a PRD

PRDs are markdown. The parser recognizes:

- Headings become `module` nodes. Subheadings become `function`/`class`/`api`/`ui-screen` based on keywords.
- Inline tags like `api: POST /users/:id` and `function validateEmail(email: string): boolean` become typed nodes with inferred contracts.
- HTTP method patterns (`GET /path`, `POST /path`) become `api` nodes.
- Signature lines (`name(params): returnType`) become method specs.
- Workflow lines (`a -> b -> c`) become `calls` edges with `confidence: 0.7`.

A minimal PRD:

```markdown
# Auth Service

## API
api: POST /auth/login
  body: { email: string, password: string }
  returns: { token: string, user: User }

## Function
function validateEmail(email: string): boolean
  returns: email matches RFC 5322

## UI
screen: LoginPage
  form: [email, password]
  submit: POST /auth/login
```

The parser turns this into a graph with three nodes and one edge.

## Per-Package Documentation

Every package has a deep dive in [`docs/`](./docs). Each one covers purpose, public API, internal architecture, key types, and extension points.

- [docs/codeflow-core.md](./docs/codeflow-core.md)
- [docs/codeflow-prd.md](./docs/codeflow-prd.md)
- [docs/codeflow-analysis.md](./docs/codeflow-analysis.md)
- [docs/codeflow-execution.md](./docs/codeflow-execution.md)
- [docs/codeflow-versioning.md](./docs/codeflow-versioning.md)
- [docs/codeflow-store.md](./docs/codeflow-store.md)
- [docs/codeflow-mcp.md](./docs/codeflow-mcp.md)
- [docs/codeflow-canvas.md](./docs/codeflow-canvas.md)
- [docs/codeflow-dtwin.md](./docs/codeflow-dtwin.md)
- [docs/codeflow-evolution.md](./docs/codeflow-evolution.md)
- [docs/codeflow-agent.md](./docs/codeflow-agent.md)
- [docs/codeflow-master.md](./docs/codeflow-master.md)
- [docs/coderag.md](./docs/coderag.md)

## Development

Each package has the same script surface:

```bash
npm run check    # tsc --noEmit
npm run test     # vitest run
npm run build    # tsc emit + dist
```

The monorepo uses local `node_modules` per package. To work on a single package:

```bash
cd packages/codeflow-prd
npm install
npm test
```

Build order matters because of inter-package dependencies. The graph:

```
codeflow-core
    ├── codeflow-store
    │       ├── codeflow-prd
    │       ├── codeflow-analysis
    │       ├── codeflow-versioning
    │       └── codeflow-agent
    ├── codeflow-mcp
    ├── codeflow-execution
    │       └── codeflow-dtwin
    ├── codeflow-canvas
    ├── codeflow-evolution
    └── codeflow-master (consumes all of the above + CodeRag)
```

Build `codeflow-core` first. Then everything that depends only on it. Then transitive dependents.

## License

Apache-2.0. See each package's `LICENSE` file.
