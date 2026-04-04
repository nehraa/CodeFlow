# CodeFlow IDE Integration Plan

This file only tracks remaining work. Existing repo pieces such as the current Monaco wrapper, file APIs, file tree, file tabs shell, and graph-side feature panels are intentionally omitted as completed foundations.

The remaining goal is not "add Monaco somewhere". The goal is to make IDE mode a full CodeFlow surface with Monaco as the primary editing window while keeping the graph live and fully connected.

## Required IDE Layout

When IDE mode is active, the layout must be:
- Left sidebar: file explorer, VS Code-like in behavior, opening files into Monaco tabs.
- Main area with no file open: full graph view, same as today's main CodeFlow experience.
- Main area with a file open: Monaco becomes the primary surface.
- Floating graph panel in the bottom-right when Monaco is open:
  - default size about `30%` width and `35%` height
  - draggable
  - resizable
  - large enough to read node names and see edges/status
- Right sidebar: reserved panel slot for the future agent window. Do not build the agent itself yet, but the slot must exist in the layout.

## Non-Negotiable Behavior

- The graph-first workbench remains the default mode.
- IDE mode is not a reduced shell. It must carry the same live CodeFlow state.
- The minimized graph must stay live with heatmap, VCR, trace overlays, execution highlights, and node status updates.
- Clicking a node in the minimized graph must open the matching file in Monaco and scroll to the exact source location for that node.
- Graph state in graph mode and IDE mode must be the same shared Zustand state, not separate copies.
- Existing CodeFlow capabilities must be integrated into IDE mode, not merely left available in graph mode.

## Remaining Work

### P1. IDE State, Mode, And Layout
- Extend `src/store/blueprint-store.ts` instead of creating a parallel IDE store.
- Finish migrating graph ownership needed for IDE mode so graph mode and IDE mode read/write the same shared state instead of separate local copies.
- Move `repoPath` into shared app state so Monaco, graph navigation, and file APIs all point at the same repository root.
- Add `mode: "graph" | "ide"` plus floating graph panel state.
- Keep graph-first as the default mode.
- Use the app's existing file tree for the VS Code-like explorer surface; `@monaco-editor/react` does not provide a built-in explorer UI.
- In IDE mode:
  - left sidebar stays the file explorer
  - main area shows full graph when no file is open
  - main area switches to Monaco when a file is open
  - graph becomes a live floating panel at roughly `30% x 35%`
  - right sidebar is an empty reserved slot for the future agent window
- Create `src/components/ide-layout.tsx` to own this layout.
- Add a draggable/resizable floating graph panel with `react-rnd`.
- Persist layout state through the existing browser storage helpers in `src/lib/browser/storage.ts`.

### P2. Repo-Scoped File APIs And Explorer Flow
- Update `src/app/api/files/list/route.ts`, `src/app/api/files/get/route.ts`, and `src/app/api/files/post/route.ts` to resolve paths from the active project/session `repoPath`, not `process.cwd()` or a global env default.
- Keep the file API security boundary strict: reads and writes must stay inside the active repo root.
- Start from `src/components/file-tabs.tsx`; do not rebuild tabs or the file tree from scratch.
- Fix file loading to match the current `/api/files/get` route contract.
- Add dirty indicators for modified files.
- Add save wiring through the existing `/api/files/post` route.
- Keep open/close/switch behavior in `src/store/blueprint-store.ts`.

### P3. Monaco Setup And Editor Behavior
- Keep Monaco lazy-loaded via `next/dynamic(..., { ssr: false })`.
- Add `beforeMount` Monaco initialization so worker configuration happens before editor startup.
- Configure Monaco TypeScript/JavaScript workers so they do not conflict with the app runtime.
- Make dark theme the default editor theme and align it with the existing CodeFlow UI theme.
- Keep `src/components/code-editor.tsx` focused on the Monaco wrapper rather than tab management.
- Add `src/components/code-diff-editor.tsx` for refactor and drift review flows.

### P4. Graph To Editor Navigation
- Add exact source location metadata to blueprint nodes in `src/lib/blueprint/schema.ts`.
- Populate that metadata during repo analysis in `src/lib/blueprint/repo.ts` using ts-morph source positions.
- Create `src/lib/blueprint/node-navigation.ts`.
- Wire graph selection to:
  - open the correct file
  - activate the correct tab
  - scroll Monaco to the exact function/class start line
  - highlight the relevant line or range
- Surface missing navigation metadata explicitly instead of failing silently.

### P5. Editor Intelligence
- Keep the existing Monaco integration, but upgrade editor intelligence so repo-aware TypeScript data comes from the analyzed codebase rather than only the current AI completion path.
- Use the existing ts-morph workspace/context to improve symbol-aware completions and navigation fidelity.
- Preserve the current completion feature where useful, but do not treat the current AI-only completion path as sufficient for the prompt requirement.

### P6. Workbench IDE Mode Integration
- Add IDE mode rendering to `src/components/blueprint-workbench.tsx`.
- Add a Graph / IDE mode toggle in the toolbar.
- Add `Cmd/Ctrl+Shift+E` as the mode-switch shortcut.
- Preserve graph and IDE panel state across mode switches.
- Ensure the minimized graph is the same live graph state, not a duplicate copy.

### P7. Full CodeFlow Feature Parity Inside IDE Mode
- IDE mode must expose the same CodeFlow capabilities that currently exist in the graph-first workbench.
- Reuse existing workbench logic; do not reimplement feature backends.
- Integrate these existing features into IDE mode UI and flows:
  - VCR / replay
  - heatmap / observability
  - digital twin
  - refactor / drift
  - branches / diff
  - MCP
  - ghost nodes
  - execution status and run feedback
  - export / approval
  - settings and editor-related controls
  - cat mascot / brand elements where already present
- Ensure those signals still update in the minimized graph while Monaco is open.
- Ensure node activity in those flows still lights up the minimized graph in IDE mode.
- Ensure refactor / drift and branch comparison use Monaco diff view where appropriate.
- The right sidebar and IDE toolbar/status areas should become the integration surfaces for these features instead of leaving them graph-mode-only.
- Acceptance bar: a developer should not have to leave IDE mode to use core CodeFlow capabilities.

### P8. Optional Large-File Follow-Up
- `/api/files/get` already streams large files.
- Only add range or partial-read support if IDE profiling shows the current route is insufficient.

## Acceptance Criteria

- Graph mode remains the default unchanged workbench.
- IDE mode matches the required layout above.
- Opening a file moves Monaco into the main area and keeps a live floating graph visible.
- Clicking any graph node opens the correct file and jumps to the correct line or range.
- Core CodeFlow features remain usable in IDE mode without switching back to graph mode.
- Drift and diff flows use Monaco diff editor instead of plain text diff output where applicable.

## Dependencies To Add
```json
{
  "react-rnd": "^10.4.13"
}
```

## Critical Files
- `src/components/code-editor.tsx`
- `src/components/file-tabs.tsx`
- `src/components/file-tree.tsx`
- `src/components/graph-canvas.tsx`
- `src/components/blueprint-workbench.tsx`
- `src/store/blueprint-store.ts`
- `src/lib/browser/storage.ts`
- `src/lib/blueprint/schema.ts`
- `src/app/api/files/get/route.ts`
- `src/app/api/files/post/route.ts`
- `package.json`

## Execution Order
1. `P1` IDE state, shared repo state, and layout shell
2. `P2` repo-scoped file APIs and existing explorer/tab flow fixes
3. `P3` Monaco worker/theme/diff behavior
4. `P4` graph-to-editor source navigation
5. `P5` repo-aware editor intelligence
6. `P6` workbench IDE mode toggle and state preservation
7. `P7` feature parity integration across IDE mode
8. `P8` only if large-file profiling proves current streaming is insufficient

## Task Prompts

### P1. IDE State, Mode, And Layout
**Agent:** `frontend-developer`  
**MCP / Tools:** `exec_command`, `apply_patch`  
**Skills:** `build-web-apps:frontend-skill`, `build-web-apps:react-best-practices`  

**Prompt**
```text
Integrate IDE mode into CodeFlow without creating a second source of truth.

Requirements:
1. Extend src/store/blueprint-store.ts so graph mode and IDE mode share the same live state.
2. Move repoPath into shared app state.
3. Add mode: "graph" | "ide".
4. Add floating graph panel state: visible, x, y, width, height.
5. Create src/components/ide-layout.tsx.
6. IDE mode layout must be:
   - left sidebar: existing file explorer
   - main area: full graph when no file is open
   - main area: Monaco when a file is open
   - floating graph panel bottom-right, default about 30% x 35%
   - right sidebar: reserved empty slot for future OpenCode agent window
7. Use react-rnd for the floating graph panel.
8. Persist IDE layout state with existing browser storage helpers.

Do not duplicate graph state. Reuse existing components wherever possible.
```

### P2. Repo-Scoped File APIs And Explorer Flow
**Agent:** `full-stack-developer`  
**MCP / Tools:** `exec_command`, `apply_patch`  
**Skills:** `build-web-apps:react-best-practices`  

**Prompt**
```text
Finish the existing file explorer and editor flow so it works against the active repoPath.

Requirements:
1. Update src/app/api/files/list/route.ts, src/app/api/files/get/route.ts, and src/app/api/files/post/route.ts to resolve files from the active project/session repoPath.
2. Keep the security boundary strict: never allow reads or writes outside repoPath.
3. Reuse src/components/file-tabs.tsx and src/components/file-tree.tsx.
4. Fix the current file read flow to match the actual GET /api/files/get contract.
5. Add dirty file indicators in tabs.
6. Add save wiring through POST /api/files/post.
7. Keep existing multi-file open/close/switch behavior in the shared store.
8. Preserve or add direct tests for the file API routes.

Do not rebuild the explorer from scratch.
```

### P3. Monaco Setup And Editor Behavior
**Agent:** `frontend-developer`  
**MCP / Tools:** `exec_command`, `apply_patch`  
**Skills:** `build-web-apps:react-best-practices`  

**Prompt**
```text
Upgrade the Monaco integration in CodeFlow while keeping the current lazy-loaded wrapper.

Requirements:
1. Keep @monaco-editor/react loaded via next/dynamic with ssr: false.
2. Add beforeMount configuration in src/components/code-editor.tsx.
3. Configure Monaco TS/JS workers so they do not conflict with Next.js runtime behavior.
4. Default Monaco to dark theme and align it with the current CodeFlow theme.
5. Keep code-editor.tsx focused on the editor wrapper, not tab state.
6. Create src/components/code-diff-editor.tsx using Monaco's diff editor.
7. Prepare the diff editor for branch/refactor/drift integration.

Do not replace Monaco with a local fork unless there is a proved blocker.
```

### P4. Graph To Editor Navigation
**Agent:** `refactoring-specialist`  
**MCP / Tools:** `exec_command`, `apply_patch`  
**Skills:** None  

**Prompt**
```text
Implement the critical graph-node -> Monaco location navigation path.

Requirements:
1. Extend src/lib/blueprint/schema.ts with exact source location metadata needed for editor navigation.
2. Populate that metadata during ts-morph repo analysis in src/lib/blueprint/repo.ts.
3. Create src/lib/blueprint/node-navigation.ts.
4. When a developer clicks a graph node in IDE mode:
   - open the correct file
   - activate the correct editor tab
   - scroll Monaco to the exact line where the function/class starts
   - highlight the relevant line or range
5. If navigation metadata is missing, surface that explicitly instead of failing silently.

This is the most important graph/IDE integration behavior.
```

### P5. Editor Intelligence
**Agent:** `full-stack-developer`  
**MCP / Tools:** `exec_command`, `apply_patch`  
**Skills:** `build-web-apps:react-best-practices`  

**Prompt**
```text
Upgrade CodeFlow editor intelligence so Monaco uses repo-aware TypeScript context instead of relying only on the current AI completion path.

Requirements:
1. Reuse the existing ts-morph analysis/workspace context already in the repo.
2. Improve symbol-aware completions and navigation fidelity inside Monaco.
3. Keep the existing completion path where useful, but do not rely on AI-only completions to satisfy the IDE requirement.
4. Preserve current editor behavior for users who do not enable advanced completions.
5. Add tests where the repo already has coverage patterns for this path.
```

### P6. Workbench IDE Mode Integration
**Agent:** `frontend-developer`  
**MCP / Tools:** `exec_command`, `apply_patch`  
**Skills:** `build-web-apps:frontend-skill`, `build-web-apps:react-best-practices`  

**Prompt**
```text
Integrate IDE mode into src/components/blueprint-workbench.tsx without removing the existing graph-first experience.

Requirements:
1. Keep graph mode as the default unchanged workbench.
2. Add IDE mode rendering using the new ide-layout.
3. Add a Graph / IDE mode toggle in the toolbar.
4. Add Cmd/Ctrl+Shift+E as the mode-switch shortcut.
5. Preserve graph and IDE panel state across mode switches.
6. Ensure the minimized graph in IDE mode is the same live graph state, not a duplicate.
```

### P7. Full CodeFlow Feature Parity Inside IDE Mode
**Agent:** `frontend-developer`  
**MCP / Tools:** `exec_command`, `apply_patch`  
**Skills:** `build-web-apps:frontend-skill`, `build-web-apps:react-best-practices`  

**Prompt**
```text
Integrate existing CodeFlow features into IDE mode so developers do not have to leave IDE mode to use core functionality.

Requirements:
1. Reuse existing workbench logic and state. Do not rebuild feature backends.
2. Integrate these existing CodeFlow features into IDE-mode UI surfaces:
   - VCR / replay
   - heatmap / observability
   - digital twin
   - refactor / drift
   - branches / diff
   - MCP
   - ghost nodes
   - execution status and run feedback
   - export / approval
   - settings / editor controls
   - cat mascot / brand elements where already present
3. Ensure those features still update the minimized floating graph in real time.
4. Ensure node activity still lights up in the minimized graph while Monaco is open.
5. Use Monaco diff editor for refactor/drift and branch comparison where appropriate.
6. Use the IDE toolbar, status areas, floating graph, and reserved right sidebar as the integration surfaces.

Acceptance bar:
A developer should not need to leave IDE mode to use core CodeFlow capabilities.
```

### P8. Optional Large-File Follow-Up
**Agent:** `backend-developer`  
**MCP / Tools:** `exec_command`, `apply_patch`  
**Skills:** None  

**Prompt**
```text
Profile large-file behavior in IDE mode and only extend the API if current streaming is not sufficient.

Requirements:
1. Start from the existing streaming implementation in src/app/api/files/get/route.ts.
2. Test IDE behavior on large files over ~500KB.
3. Only if needed, add partial-read/range support without weakening repoPath validation or security boundaries.
4. Add direct route tests for any new large-file behavior.
```

## Verification
- `npm run lint`
- `npm run check`
- `npm test`
- `npm run build`
