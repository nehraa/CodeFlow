# codeflow-canvas

The reusable workbench UI. React Flow for the graph, Monaco for the code, Zustand for state. Mount it in a Next.js app and you have a CodeFlow IDE. The `codeflow-master` package does exactly that.

## What it owns

- **IDE layout components.** `IdeLayout`, `IdeWorkbench`, `BlueprintWorkbench`, `PolicyWorkbench`. The shells.
- **Graph canvas.** `GraphCanvas` (the React Flow renderer), with flow data builders in `lib/flow-view.ts`.
- **Code editor.** `CodeEditor`, `CodeDiffEditor` (Monaco-backed).
- **File navigation.** `FileTree`, `FileTabs`.
- **Settings UI.** `OpencodeSettings` (config for the `opencode` CLI).
- **Monaco setup.** `prepareMonaco`, `toMonacoPath`, plus a TypeScript language service bridge (`getTypeScriptLanguageService`).
- **State.** `useBlueprintStore` (the same Zustand-backed store the canvas and store packages share).
- **Logic libraries.** Heatmap, trace overlay, node navigation, edit operations, flow view builders.

## Subpath exports

| Subpath | Module |
| --- | --- |
| `.` | The barrel: components + the workbench. |
| `./flow-view` | `buildFlowNodes`, `buildFlowEdges`, `buildGhostFlowNodes`, `buildDetailFlow`, `indexRuntimeExecutionResult`, `buildExecutionProjection`. |
| `./edit` | `addNodeToGraph`, `addEdgeToGraph`, `deleteNodeFromGraph`. |
| `./traces` | `applyTraceOverlay`. |
| `./heatmap` | `computeHeatmap`, `heatColor`, `heatGlow`. |
| `./store` | `useBlueprintStore` (re-exported for app-level mounting). |

Peer dependencies: `react ^18`, `react-dom ^18`, `next ^16`. The Next.js peer is required because some components read from `next/router`.

## Components

### `IdeLayout`

The top-level shell. Three regions: left rail (file tree), center (graph or editor), right rail (inspector). Pure layout; takes a `children` prop and renders the workbench inside.

### `IdeWorkbench`

The actual workbench: file tabs, code editor, status bar. Drives the `mode: "graph" | "ide"` state on the store. Used inside `IdeLayout`.

### `BlueprintWorkbench`

The mode where the graph and the editor coexist. The graph renders on the canvas; double-clicking a node opens it in Monaco. Edits flow back into the graph via `applyEdit`.

### `PolicyWorkbench`

A specialized workbench for editing policy files (permissions, MCP server config). Same shape as `IdeWorkbench`, different defaults.

### `GraphCanvas`

The React Flow renderer. Accepts `nodes` and `edges` arrays and renders the graph with custom node types per `kind` (function, class, api, ui-screen, module). Supports:

- Pan and zoom.
- Click to select; double-click to open in the editor.
- Drag to add a new edge (with a connect handler that calls `addEdgeToGraph`).
- Ghost node rendering for AI-suggested nodes (`buildGhostFlowNodes`).

### `CodeEditor` and `CodeDiffEditor`

Monaco-based. `CodeEditor` is a single-file editor with TS language service integration. `CodeDiffEditor` shows a before/after diff using Monaco's diff editor.

`monaco-setup.ts` exports `prepareMonaco()` (call once at app startup) and `toMonacoPath(fsPath)` (path normalization). `ts-language-service.ts` exposes `TypeScriptLanguageService` for type-checking on every keystroke.

### `FileTree` and `FileTabs`

`FileTree` renders the project file tree from a path. `FileTabs` renders the open-file tabs above the editor. Both read and write `openFiles` and `activeFile` on the store.

### `OpencodeSettings`

A form for configuring the `opencode` CLI (model, base URL, API key). Saves to `.codeflow/settings.json` in the project root.

## Logic libraries

### `flow-view.ts`

The data builders that turn a `BlueprintGraph` into React Flow's `nodes` and `edges`:

- `buildFlowNodes(graph)`: one React Flow node per `BlueprintNode`. Custom node components per kind.
- `buildFlowEdges(graph)`: one React Flow edge per `BlueprintEdge`.
- `buildGhostFlowNodes(graph)`: ghost nodes for AI-suggested additions.
- `buildDetailFlow(graph, focusNodeId)`: subgraph around a focus node, used by the inspector.
- `indexRuntimeExecutionResult(graph, executionReport)`: roll execution state onto the graph.
- `buildExecutionProjection(graph, executionReport)`: a projection of which nodes are running, completed, failed.

### `heatmap.ts`

- `computeHeatmap(graph)`: derive `HeatmapData` (per-node heat score from trace state).
- `heatColor(score)`: map score to a color.
- `heatGlow(score)`: map score to a glow opacity.

### `traces.ts`

- `applyTraceOverlay(graph, spans)`: roll trace spans onto `traceState` on each node. The result lights up the canvas as runs happen.

### `node-navigation.ts`

- `getNavigationTarget(nodeId, graph)`: resolve a node id to a navigable target (file path, line).
- `getNodesWithNavigation(graph)`: subset of nodes that have navigation metadata.
- `formatNavigationTarget(target)`: pretty-print a target for the UI.
- `hasNavigationMetadata(node)`, `isValidNavigationTarget(target)`: predicates.

### `edit.ts`

- `addNodeToGraph(graph, node)`, `addEdgeToGraph(graph, edge)`, `deleteNodeFromGraph(graph, nodeId)`: pure operations that return a new graph. The workbench dispatches these into the Zustand store.

`★ Insight ─────────────────────────────────────`
The edit operations are pure functions. The store reducer is the only place that mutates state, but the operations themselves don't know about the store. Easy to test, easy to reuse in a different runtime (e.g., the versioning diff).
`─────────────────────────────────────────────────`

## The store

`useBlueprintStore` is re-exported from `codeflow-store/store`. The interface:

```typescript
interface BlueprintStore {
  graph: BlueprintGraph | null;
  repoPath: string | null;
  openFiles: string[];
  activeFile: string | null;
  dirtyFiles: Set<string>;
  mode: 'graph' | 'ide';
  floatingGraph: { open: boolean; position: { x: number; y: number } };
  selectedNodeId: string | null;
  // setters for all of the above
}
```

Apps mount the store once at the root. Components select slices with `useBlueprintStore((s) => s.graph)` to avoid re-renders.

## Mounting in a Next.js app

```tsx
// app/layout.tsx
'use client';
import { prepareMonaco, IdeLayout } from '@abhinav2203/codeflow-canvas';

prepareMonaco();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <IdeLayout>{children}</IdeLayout>;
}
```

```tsx
// app/page.tsx
'use client';
import { BlueprintWorkbench, useBlueprintStore } from '@abhinav2203/codeflow-canvas';

export default function Page() {
  const graph = useBlueprintStore((s) => s.graph);
  if (!graph) return <div>Loading...</div>;
  return <BlueprintWorkbench graph={graph} />;
}
```

`codeflow-master` adds Next.js routing, the project picker, and the agent chat panel on top of this.

## File layout

```
codeflow-canvas/
├── package.json
├── tsconfig.json, tsconfig.build.json
├── vitest.config.ts
├── scripts/wrap-cli.mjs
└── src/
    ├── index.ts                       barrel
    ├── components/
    │   ├── IdeLayout.tsx
    │   ├── IdeWorkbench.tsx
    │   ├── BlueprintWorkbench.tsx
    │   ├── PolicyWorkbench.tsx
    │   ├── FileTree.tsx
    │   ├── FileTabs.tsx
    │   ├── GraphCanvas.tsx
    │   ├── CodeEditor.tsx
    │   ├── CodeDiffEditor.tsx
    │   ├── OpencodeSettings.tsx
    │   └── monaco-setup.ts
    │   └── ts-language-service.ts
    ├── lib/
    │   ├── heatmap.ts
    │   ├── traces.ts
    │   ├── node-navigation.ts
    │   ├── edit.ts
    │   └── flow-view.ts
    ├── store/
    │   └── blueprint-store.ts
    ├── bin/cli.ts
    └── test-fixtures/
```

## Build quirk

Like `codeflow-execution`, the build script uses `tsc --build` with an explicit file list and `scripts/wrap-cli.mjs` adds the shebang for the CLI. The published output mirrors `src/` exactly so subpath exports resolve to the right files.
