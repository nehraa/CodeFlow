# codeflow-master

The unified Codeflow IDE. A single Next.js 15 + React 19 application that integrates every other `@abhinav2203/codeflow-*` package into one canvas-centric development environment. The IDE exposes blueprint generation, agent orchestration, digital-twin simulation, evolution, code search, analysis, versioning, and execution flows behind a single dark-themed shell with a React Flow canvas at the center.

## What it owns

- **A single Next.js page.** `app/page.tsx` mounts the IDE: header, left sidebar, canvas, VCR controls, terminal, right panel. No additional routes.
- **The canvas shell.** `CodeflowCanvas` is a React Flow host with five custom node types (`BlueprintNode`, `AgentNode`, `GhostNode`, `TwinNode`, `ExecutionNode`).
- **Integration wrappers.** `lib/codeflow/*.ts` re-implements every sibling package's API in-process. Most use local stubs and timeouts; one (the MCP server bootstrap) actually calls the upstream npm package.
- **Two Zustand stores.** `useCanvasStore` (nodes, edges, undo/redo) and `useSessionStore` (checkpoints, approvals, persisted to `localStorage`).
- **A mock MCP server.** `lib/codeflow/mcp.ts` registers four built-in tools (`codeflow_analyze`, `codeflow_blueprint`, `codeflow_checkpoint`, `codeflow_export`) that the host can invoke.

## Public API

There is no public package API. `codeflow-master` is an application, not a library — install it, run `npm run dev`, and open the IDE in a browser.

## App structure

```
codeflow-master/
├── next.config.mjs                 transpilePackages for all 12 codeflow packages
├── tailwind.config.ts              cf-* color tokens + custom animations
├── postcss.config.mjs              @tailwindcss/postcss
├── tsconfig.json                   path aliases: @/* and @codeflow/*
├── jest.config.ts
├── eslint.config.mjs, .eslintrc.json
├── prd/                            dev-time planning notes
├── claude-code/                    dev-time reasoning logs
└── src/
    ├── app/
    │   ├── globals.css             Tailwind v4 + dark theme tokens + VCR/node animations
    │   ├── layout.tsx              <html><body>{children}</body></html>
    │   └── page.tsx                The single IDE page
    ├── components/
    │   ├── agent/AgentOrchestrator.tsx       subagent list UI
    │   ├── canvas/
    │   │   ├── CodeflowCanvas.tsx            main React Flow host
    │   │   ├── BlueprintNode.tsx
    │   │   ├── AgentNode.tsx
    │   │   ├── GhostNode.tsx
    │   │   ├── TwinNode.tsx
    │   │   ├── ExecutionNode.tsx
    │   │   └── VCRControls.tsx
    │   ├── panels/
    │   │   ├── LeftSidebar.tsx               files / store / version / PRD tabs
    │   │   ├── RightPanel.tsx                execution / analysis / twin / evolution
    │   │   └── TerminalPanel.tsx             dual-mode terminal + prompt
    │   └── ui/Header.tsx
    ├── lib/
    │   ├── codeflow/                        integration wrappers (one per upstream package)
    │   │   ├── agent.ts
    │   │   ├── analysis.ts
    │   │   ├── canvas.ts                     useCanvasStore lives here
    │   │   ├── coderag.ts
    │   │   ├── core.ts
    │   │   ├── dtwin.ts
    │   │   ├── evolution.ts
    │   │   ├── execution.ts
    │   │   ├── index.ts                      unified re-export surface
    │   │   ├── mcp.ts                        in-process MCP server + 4 built-in tools
    │   │   ├── prd.ts
    │   │   ├── store.ts                      useSessionStore, createProjectStore
    │   │   └── versioning.ts
    │   ├── hooks/                            (empty)
    │   ├── stores/                           (empty)
    │   └── utils.ts                          cn() clsx helper
    └── types/                                TypeScript mirrors of every upstream package
        ├── codeflow-agent.ts
        ├── codeflow-analysis.ts
        ├── codeflow-canvas.ts
        ├── codeflow-core.ts
        ├── codeflow-dtwin.ts
        ├── codeflow-evolution.ts
        ├── codeflow-execution.ts
        ├── codeflow-mcp.ts
        ├── codeflow-prd.ts
        ├── codeflow-store.ts
        ├── codeflow-versioning.ts
        ├── coderag.ts
        └── index.ts
```

## The page

`app/page.tsx` is the only route. It hosts `Header`, `LeftSidebar`, `CodeflowCanvas`, `VCRControls`, `TerminalPanel`, and `RightPanel` in a flex layout. State held by the page: `terminalOpen` (boolean) and `playbackState` (`'stopped' | 'playing' | 'paused' | 'recording'`).

`layout.tsx` is a near-empty shell that imports `globals.css` and renders `{children}`.

## The canvas

`CodeflowCanvas` is the visual centerpiece. A React Flow host with five custom node types registered in a `nodeTypes` map. Renders 5 hard-coded `initialNodes` and 4 hard-coded `initialEdges` (`e1-2`, `e2-3`, `e3-4`, `e2-5`) for a demo graph. Owns its own node/edge state via `useNodesState` / `useEdgesState` from `@xyflow/react` — *not* the Zustand store.

Adds `<Controls>`, `<MiniMap>` (color-coded per node type), `<Background variant={Dots}>`, and a `Panel position="top-left"` showing the current playback mode. The selected node id is local `useState<string | null>`.

The five custom nodes are `memo`-wrapped, accept `{ data, selected }`, and render colored cards with top/bottom `<Handle>`s:

| Component | Type key | Color | Extra data |
| --- | --- | --- | --- |
| `BlueprintNode` | `blueprint` | indigo | `label, description` |
| `AgentNode` | `agent` | emerald | `+ status: 'ready' \| 'running' \| 'idle'` |
| `GhostNode` | `ghost` | cyan (dashed) | `+ fitness: number` |
| `TwinNode` | `twin` | amber | `+ syncStatus: 'synced' \| 'syncing' \| 'error'` |
| `ExecutionNode` | `execution` | red | `+ output: string, status: 'idle' \| 'running' \| 'success' \| 'error'` |

`★ Insight ─────────────────────────────────────`
The canvas is disconnected from the Zustand store. The demo state lives in React Flow's local state. The store is only written by `TerminalPanel.processPrompt` and never read by the canvas. The most impactful next refactor is to wire `CodeflowCanvas` to `useCanvasStore` so the canvas reflects store-driven changes from any panel.
`─────────────────────────────────────────────────`

## VCR controls

`VCRControls` is six buttons (rewind, play, pause, stop, record, fast-forward) styled with `.vcr-button` CSS, plus a state label. Pure presentation; all callbacks are passed in as props. State shape:

```typescript
type PlaybackState = 'stopped' | 'playing' | 'paused' | 'recording';
interface VCRControlsProps {
  state: PlaybackState;
  onStateChange: (state: PlaybackState) => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRecord: () => void;
  onFastForward: () => void;
  onRewind: () => void;
}
```

## Sidebar and panels

`LeftSidebar` is a tabbed left rail with four tabs: Files (`FolderOpen`), Store (`Database`), Version (`GitBranch`), PRD (`FileText`). Each tab toggles a `motion.div`-animated `layoutId="activeTab"` underline. `FileTree` is a hand-rolled recursive component showing a hard-coded tree (no actual file system access). The store, version, and PRD panels render hard-coded stat rows.

`RightPanel` is four collapsible sections — Execution, Analysis, Digital Twin, Evolution — each with mocked content (e.g. progress bars for complexity / coverage / performance at 72 / 85 / 64 %). Toggle state is local `useState<PanelSection[]>`.

`TerminalPanel` is a dual-mode console with Prompt and Terminal tabs. In prompt mode, calling `processPrompt` runs an 11-step hard-coded sequence (`'📋 Processing PRD...'`, `'🔧 Generating Blueprint...'`, etc., 400ms each) and finally calls `setNodes` from `useCanvasStore` to replace the canvas with four new nodes. This is the only place in the app that actually mutates the canvas store.

## Agent orchestrator

`AgentOrchestrator` is a self-contained subagent panel. Holds three seeded subagents in `useState<SubAgent[]>` (`Coder Agent` running at 65%, `Reviewer` and `Tester` idle). `addAgent` creates `Agent ${n}` entries; `removeAgent` filters them out. Renders a card per agent with a status dot, progress bar (when running), and an `X` to remove. The UI does not consume `useAgentOrchestrator()` from `lib/codeflow/agent.ts` — the integration is purely cosmetic in the UI today.

The wrapper in `lib/codeflow/agent.ts` exports:
- `getAgentOrchestrator()` — singleton `AgentOrchestratorImpl` with `registerAgent`, `spawnAgent`, `executeTask`, `terminateAgent`, `onEvent`, plus an event callback system.
- `useAgentOrchestrator()` — a React hook returning `{ agents, spawnAgent, executeTask, getAgentStatus, terminateAgent, terminateAll, onEvent }`.
- `TaskQueue` — a priority-sorted `enqueue` / `dequeue` / `peek` queue.

`executeTask` in the wrapper is simulated with a 200 ms-interval progress loop. No real CLI spawn happens.

## MCP bootstrap

`lib/codeflow/mcp.ts` implements an in-process `MCPServerImpl` and registers four built-in tools on first call to `getMCPServer()` (singleton):

| Tool | Description | Handler |
| --- | --- | --- |
| `codeflow_analyze` | Analyze repo structure | dynamically `import('./core')` then `analyzeRepository(path)` |
| `codeflow_blueprint` | Generate blueprint from spec | dynamically `import('./core')` then `generateBlueprint(spec)` |
| `codeflow_checkpoint` | Create session checkpoint | dynamically `import('./store')` then `useSessionStore.getState().addCheckpoint(...)` |
| `codeflow_export` | Export blueprint as json/yaml/markdown | dynamically `import('./core')` then `exportBlueprint(nodes, format)` |

`createMCPClient` is a stub — its returned `MCPClient` always reports `isConnected() => false`. There is no external MCP server bootstrap, no stdio or websocket transport, and no startup hook in `layout.tsx` or `page.tsx` to call `getMCPServer()`. Tools are only usable by callers that explicitly invoke `getMCPServer().executeTool(name, args)`.

## State management

Two Zustand stores, both in `src/lib/codeflow/`:

### `useCanvasStore` (canvas.ts)

`zustand/create` with an undo/redo history (max 50 entries). Fields: `nodes, edges, selectedNode, zoom, history, historyIndex`. Actions: `setNodes`, `setEdges`, `selectNode`, `setZoom`, `addToHistory`, `undo`, `redo`, `canUndo`, `canRedo`. Helper hook `useCanvasActions()` wraps it for add/remove/update of nodes and edges.

The only consumer in the app is `TerminalPanel` (which calls `setNodes([...])` after a prompt animation finishes). `CodeflowCanvas` does not use the store.

### `useSessionStore` (store.ts)

`zustand/create(persist(...))` persisted to `localStorage` under `codeflow-session`. Holds `checkpoints, pendingApprovals, approvedItems` with `addCheckpoint`, `approveItem`, `rejectItem`, `getCheckpoint`, `getCheckpointsByTag`, `clearCheckpoints`, `clearAll`. A factory `createProjectStore(projectId)` returns a fresh persisted store keyed `codeflow-session-${projectId}`. No page currently calls into this store — it's a stable seam ready for the eventual project picker.

`page.tsx` does not mount either store; they're created lazily on first access by their module-level `create()` calls.

## Styling

- **Tailwind CSS v4** with `@tailwindcss/postcss`. `globals.css` starts with `@import 'tailwindcss';`.
- **Custom theme** in `tailwind.config.ts`: `cf-bg`, `cf-surface`, `cf-surface-elevated`, `cf-border`, `cf-primary`, `cf-primary-glow`, `cf-accent`, `cf-success`, `cf-warning`, `cf-error`, plus animations `pulse-glow`, `ghost-pulse`, `flow-gradient`, `node-select`.
- **Inline component CSS** in `globals.css` for things Tailwind doesn't cover cleanly: `.vcr-button` / `.vcr-button.playing` / `.vcr-button.paused` / `.vcr-button.recording`, `.node-glow`, `.node-selected`, `.ghost-node`, `.heatmap-overlay`, `.execution-edge`, `.panel`, `.panel-header`, plus scrollbar and React Flow overrides.
- **No external component library.** `lucide-react` for icons, `framer-motion` for the AnimatePresence and tab/layout animations, `clsx` + `cn()` helper for class composition.

## Scripts

| Script | Command | Effect |
| --- | --- | --- |
| `npm run dev` | `next dev` | Next.js dev server with HMR, watching `src/`. |
| `npm run build` | `next build` | Production build into `.next/`. The 12 `transpilePackages` are transpiled as part of the build. |
| `npm run start` | `next start` | Run the production build. |
| `npm run lint` | `next lint` | ESLint via `eslint-config-next` (`extends: "next/core-web-vitals"`). |
| `npm run test` | `jest` | Jest with `next/jest`, jsdom env, `ts-jest` for `.ts/.tsx`. |

## Configuration highlights

`next.config.mjs`:

```js
const nextConfig = {
  transpilePackages: [
    '@abhinav2203/codeflow-core',
    '@abhinav2203/coderag',
    '@abhinav2203/codeflow-mcp',
    '@abhinav2203/codeflow-store',
    '@abhinav2203/codeflow-versioning',
    '@abhinav2203/codeflow-prd',
    '@abhinav2203/codeflow-analysis',
    '@abhinav2203/codeflow-agent',
    '@abhinav2203/codeflow-execution',
    '@abhinav2203/codeflow-canvas',
    '@abhinav2203/codeflow-dtwin',
    '@abhinav2203/codeflow-evolution',
  ],
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
};
```

`tsconfig.json`:
- `target: ES2022`, `lib: dom, dom.iterable, esnext`
- `module: esnext`, `moduleResolution: bundler`, `strict: true`
- Path aliases: `@/*` → `./src/*`, `@codeflow/*` → `./src/lib/codeflow/*`

No `.env` or `.env.local` files exist. The app runs without environment variables.

## Key dependencies

| Dep | Version | Notes |
| --- | --- | --- |
| `next` | `15.1.0` | App Router, React 19 compatible. |
| `react` / `react-dom` | `^19.0.0` | React 19. |
| `@abhinav2203/codeflow-core` | `^1.1.6` | The only wrapper that actually `await import()`s the npm package at runtime. |
| `@abhinav2203/coderag` + 11 other `@abhinav2203/codeflow-*` | latest | Installed; wrappers are local-only. |
| `@xyflow/react` | `^12.3.0` | React Flow for the canvas. |
| `@monaco-editor/react` | `^4.6.0` | Installed but **not imported** in any `src/**/*.{ts,tsx}`. Leftover from spec. |
| `zustand` | `^5.0.0` | State for the two stores. |
| `framer-motion` | `^11.15.0` | Animations. |
| `tailwindcss` | `^4.0.0` | Styling. |
| `lucide-react` | `^0.468.0` | Icons. |
| `clsx` | `^2.1.1` | Used by `cn()`. |

## Cross-cutting observations

- **The wrappers in `src/lib/codeflow/` are a self-contained, in-process implementation** of the 12 upstream packages. Most do not `import()` the real npm package — they simulate work with `setTimeout` for progress, random numbers for fitness, hardcoded diff results, and a fake code execution that looks for `console.log` calls. Only `core.ts` actually calls `@abhinav2203/codeflow-core`'s `analyzeRepo` and `buildBlueprintGraph`, and even there it falls back to a local stub on failure.
- **No API routes.** No `route.ts` files, no `/api/*` paths. The only "API surface" lives in the in-process `lib/codeflow/*` modules.
- **No project picker.** The Header, LeftSidebar, and RightPanel are all hard-coded UIs. `useSessionStore` is the only project-persistence mechanism, persisting to `localStorage` under `codeflow-session` (or `codeflow-session-${projectId}` via `createProjectStore(projectId)`).
- **No chat panel.** The closest feature is `TerminalPanel`'s prompt mode, which is a fake agent-pipeline visualizer. It does not call `codeflow-agent`, does not send messages, does not stream responses.
- **The empty `stores/` and `hooks/` directories** suggest planned future work — likely the eventual project-scoped hooks and a "main" store aggregating the two existing ones.

## File layout

```
codeflow-master/
├── package.json
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── jest.config.ts, jest.setup.ts
├── eslint.config.mjs, .eslintrc.json
├── prd/
├── claude-code/
├── codeflow-ide-homepage.png
└── src/
    ├── app/                          Next.js App Router (single page)
    ├── components/                   canvas + panels + agent + ui
    ├── lib/
    │   ├── codeflow/                 integration wrappers
    │   ├── hooks/                    (empty)
    │   ├── stores/                   (empty)
    │   └── utils.ts                  cn() helper
    └── types/                        mirrors of every upstream package
```

## Limits and known gaps

- The wrappers simulate most package behavior. Real CLI calls and real LLM synthesis don't happen in the IDE today; only `core.ts` (via `codeflow-core`) does real work.
- The MCP server is in-process and isolated. No external MCP transports, no startup bootstrap in `layout.tsx`.
- `@monaco-editor/react` is installed but not used. Code editing today happens only through the prompt-mode pipeline, which mutates the canvas rather than the file system.
- `jest.setup.ts` mistakenly imports `from 'vitest'`, but the rest of the config uses Jest — the setup file would fail under vitest and is unused by the configured Jest runner.
- No `.env` files, no environment configuration, no API keys needed to run locally.
