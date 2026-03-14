# CodeFlow

CodeFlow is a blueprint-first coding workbench. It ingests a PRD and/or a local JavaScript or TypeScript repo, builds an architecture graph, lets you inspect and edit node contracts in a visual map, applies runtime trace overlays, and exports markdown docs plus generated code stubs and a JSON Canvas file that can be opened in Obsidian-compatible tools.

## What is implemented

- **AI blueprint generation** - Generate architecture blueprints from natural language prompts using NVIDIA API (Llama 3.1 405B)
- PRD ingestion with deterministic extraction of screens, APIs, classes, functions, modules, and workflows
- JavaScript/TypeScript repo analysis with `ts-morph` for modules, imports, classes, methods, functions, API routes, page screens, inheritance, and discovered call edges
- React Flow workbench for graph visualization and node inspection/editing
- Workbench graph editing for adding/removing nodes and edges without rebuilding from the PRD
- Execution planning with dependency batches and per-node task ownership paths
- Local persistence under `.codeflow-store/` for sessions, runs, approvals, and checkpoints
- Risk-aware export flow with approval gating in `essential` mode and checkpoint creation before overwriting exports
- Local sandboxed `yolo` export runs with diff manifests before syncing to the target directory
- Conflict/drift analysis against a live TypeScript repo snapshot
- Observability ingestion and retrieval APIs for spans/logs with graph overlay
- Trace overlay support from pasted JSON spans
- Disk export for:
  - `blueprint.json`
  - markdown docs per node
  - `system.canvas`
  - generated TypeScript and TSX stubs
  - `ownership.json`
  - `obsidian-index.md`

## Run it

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Test and verify

```bash
npm test
npm run check
npm run build
```

Run `npm run check` separately from `npm run build`; they both touch Next type generation and should not be launched in parallel.

## How to use

### AI Blueprint Generation (Recommended)

1. Enter a project name.
2. Select **AI Prompt (NVIDIA)** mode.
3. Enter your NVIDIA API key (saved to localStorage) or set `NVIDIA_API_KEY` environment variable.
4. Describe your project in natural language (e.g., "A task management app with React frontend and Node.js backend..." or "A Rails monolith with Sidekiq jobs and a React admin panel...").
5. Choose `essential` or `yolo` mode.
6. Click `Build blueprint`.

AI prompt mode is stack-agnostic. Today the legacy repo analyzer reads JavaScript/TypeScript repos, and exported starter stubs are still generated as TS/TSX files.

### Legacy PRD/Repo Mode

1. Enter a project name.
2. Select **PRD / Repo (legacy)** mode.
3. Optionally enter an absolute path to a local JavaScript or TypeScript repo.
4. Paste PRD markdown.
5. Choose `essential` or `yolo` mode.
6. Click `Build blueprint`.

### After Building

7. Click nodes in the graph to inspect and edit their summary and notes.
8. Paste trace spans JSON if you want to overlay runtime status.
9. Click `Run plan` to execute the current task plan and persist execution ownership metadata.
10. Click `Load observability` to reload stored spans/logs for the project and overlay them on the graph.
11. Click `Analyze drift` to compare the current blueprint to the repo snapshot.
12. Click `Export artifacts` to write docs, canvas, ownership metadata, and code stubs to disk.
13. If `essential` mode flags the export as risky, approve the pending export and rerun it from the UI.

## Trace JSON format

```json
[
  {
    "spanId": "span-1",
    "traceId": "trace-1",
    "name": "TaskService.saveTask",
    "status": "error",
    "durationMs": 12,
    "runtime": "node"
  }
]
```

You can also set `blueprintNodeId` directly for exact matching.

## Output layout

By default exports go to:

```text
artifacts/<project-name>/
```

With these files:

```text
blueprint.json
docs/
stubs/
system.canvas
ownership.json
obsidian-index.md
```

Local state is stored in:

```text
.codeflow-store/
```

This includes latest sessions, run records, approval records, and checkpoints for overwritten export directories.

## API routes

- `POST /api/blueprint`
- `POST /api/generate-blueprint`
- `POST /api/executions/run`
- `POST /api/export`
- `POST /api/approvals/approve`
- `POST /api/observability/ingest`
- `GET /api/observability/latest`
- `POST /api/conflicts`
