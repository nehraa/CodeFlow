# CodeFlow IDE Integration Plan

## Overview
Integrate Monaco Editor as primary IDE surface alongside the graph. Graph and code coexist - graph becomes a navigation layer rather than the sole interface.

## Already Implemented (in PRs #21, #22)
- File tree component (`src/components/file-tree.tsx`)
- File tabs component (`src/components/file-tabs.tsx`)
- File tree API (`src/app/api/files/list/route.ts`)
- File read/write APIs (`src/app/api/files/get/route.ts`, `post/route.ts`)
- Path security validation (`src/lib/file-security.ts`)

## Dependencies to Add
```json
{
  "react-rnd": "^10.4.13",
  "lucide-react": "^0.x"
}
```

---

## Task Prompts (Sequential Execution)

---

### P1.1: Add Monaco Fork as Submodule
**Agent:** `backend-developer`  
**MCP:** Bash  
**Skill:** None  

**Prompt:**
```
Add the Monaco fork as a git submodule at /tmp/codeflow_ide to the CodeFlow project.

1. Check if /tmp/codeflow_ide exists and is a valid git repo
2. Create vendor/ directory if not exists
3. Run: git submodule add git@github.com:nehraa/Codeflow_IDE.git vendor/monaco-source
4. Commit the .gitmodules changes

Working directory: /Users/abhinavnehra/git/CodeFlow
```

---

### P1.2: Build Monaco
**Agent:** `backend-developer`  
**MCP:** Bash  
**Skill:** None  

**Prompt:**
```
Build Monaco from the vendor/monaco-source and output to vendor/monaco/.

1. cd to vendor/monaco-source
2. Run npm install (if needed)
3. Run npm run build
4. Copy the built files: cp -r build/vs/ ../vendor/monaco/
5. Verify vendor/monaco/ contains the Monaco worker files

Working directory: /Users/abhinavnehra/git/CodeFlow
```

---

### P1.3: Update Imports to Local Monaco
**Agent:** `refactoring-specialist`  
**MCP:** Grep, Edit  
**Skill:** None  

**Prompt:**
```
Update CodeFlow imports to use local Monaco build instead of @monaco-editor/react.

1. Grep for "@monaco-editor/react" in src/ to find all imports
2. Modify src/components/code-editor.tsx to use the local Monaco:
   - Change import to use dynamic import from vendor/monaco/
   - Or configure Monaco to load workers from vendor/monaco/
3. Update any webpack/next.config.js if needed for Monaco workers

Files to modify:
- src/components/code-editor.tsx
- next.config.js (if needed)

Working directory: /Users/abhinavnehra/git/CodeFlow
```

---

### P1.4: Create ide-store.ts
**Agent:** `frontend-developer`  
**MCP:** Write  
**Skill:** None  

**Prompt:**
```
Create src/store/ide-store.ts for IDE state management.

Based on existing patterns in src/store/blueprint-store.ts, create:
1. Zustand store with:
   - IDE mode: 'graph' | 'ide'
   - Open files array: { path, content, modified }
   - Active file index
   - Floating panel: { visible, position: {x,y}, size: {width,height} }
2. Actions:
   - setMode(mode)
   - openFile(path, content)
   - closeFile(index)
   - setActiveFile(index)
   - updateFloatingPanel(config)
3. Export typed hooks: useIdeStore

Reference: src/store/blueprint-store.ts for Zustand patterns

Working directory: /Users/abhinavnehra/git/CodeFlow
```

---

### P1.5: Create ide-layout.tsx
**Agent:** `frontend-developer`  
**MCP:** Write  
**Skill:** `frontend-design`  

**Prompt:**
```
Create src/components/ide-layout.tsx - Three-panel IDE layout.

Use Skill: frontend-design to create:
1. Three-panel layout: File Explorer (left) | Monaco Editor (center) | Inspector (right)
2. File Explorer: Use existing src/components/file-tree.tsx
3. Monaco Editor: Use existing code-editor.tsx
4. Inspector: Placeholder panel for node details, execution status
5. Floating graph panel in bottom-right corner (30% x 35%)
6. Resizable panels using CSS/flex

Reference the layout diagram in PLAN.md:
┌─────────────┬─────────────────────────┬───────────────┐
│ File Explorer │ Monaco Editor          │ Inspector     │
│ (left)        │ (main)                 │ (right)       │
│               │ ┌─────────────────┐   │               │
│               │ │ Floating Graph  │   │               │
│               │ │ (30% x 35%)     │   │               │
│               │ └─────────────────┘   │               │
└───────────────┴───────────────────────┴───────────────┘

Working directory: /Users/abhinavnehra/git/CodeFlow
```

---

### P3.1: Enhance code-editor.tsx with Tabs
**Agent:** `frontend-developer`  
**MCP:** Read, Edit  
**Skill:** None  

**Prompt:**
```
Enhance src/components/code-editor.tsx with tab support.

1. Read current code-editor.tsx implementation
2. Modify to support multiple open files:
   - Add tab bar at top showing open files
   - Click tab to switch files
   - Show modified indicator (*) on unsaved files
   - Close button (x) on each tab
3. Integrate with ide-store.ts for file state
4. Preserve existing Monaco features (completion, theme, etc.)

Dependencies: P1.4 (ide-store.ts must exist first)

Working directory: /Users/abhinavnehra/git/CodeFlow
```

---

### P3.2: Create code-diff-editor.tsx
**Agent:** `frontend-developer`  
**MCP:** Write  
**Skill:** None  

**Prompt:**
```
Create src/components/code-diff-editor.tsx for diff viewing.

1. Use Monaco's diff editor: import type * as Monaco from 'monaco-editor'
2. Create component with props:
   - original: string
   - modified: string
   - language: string
   - theme: 'light' | 'dark'
3. Render Monaco diff editor in readOnly mode
4. Handle theme switching
5. Add proper TypeScript types

Reference: Monaco editor diff examples

Working directory: /Users/abhinavnehra/git/CodeFlow
```

---

### P3.3: TypeScript Worker Config
**Agent:** `frontend-developer`  
**MCP:** Write  
**Skill:** None  

**Prompt:**
```
Configure TypeScript worker for local Monaco build.

1. Create src/lib/monaco-workers.ts
2. Configure TypeScript/JavaScript language workers
3. Set up worker paths pointing to vendor/monaco/
4. Register workers with Monaco environment

Reference: Monaco worker configuration patterns

Working directory: /Users/abhinavnehra/git/CodeFlow
```

---

### P4.3: Large File Streaming
**Agent:** `backend-developer`  
**MCP:** Read, Edit  
**Skill:** None  

**Prompt:**
```
Implement large file streaming in src/app/api/files/get/route.ts.

1. Read current implementation at src/app/api/files/get/route.ts
2. Add streaming for files > 500KB:
   - Use ReadableStream for incremental response
   - Stream in chunks of ~50KB
   - Add Content-Length and Content-Range headers
3. Handle range requests for partial file access
4. Keep security validation from src/lib/file-security.ts

Working directory: /Users/abhinavnehra/git/CodeFlow
```

---

### P5.1: Create floating-graph-panel.tsx
**Agent:** `frontend-developer`  
**MCP:** Write  
**Skill:** `frontend-design`  

**Prompt:**
```
Create src/components/floating-graph-panel.tsx - Draggable/resizable graph panel.

Use Skill: frontend-design and:
1. Use react-rnd for drag and resize
2. Default: 30% width, 35% height, bottom-right position
3. Show the graph canvas inside
4. Connect to ide-store for state (floating panel config)
5. Add toggle button to show/hide
6. Add resize handle and drag handle (header bar)

Dependencies: P1.4 (ide-store.ts), react-rnd package installed

Working directory: /Users/abhinavnehra/git/CodeFlow
```

---

### P5.2: React-rnd Integration
**Agent:** `frontend-developer`  
**MCP:** Grep, Edit  
**Skill:** None  

**Prompt:**
```
Integrate react-rnd in floating-graph-panel.tsx.

1. Install react-rnd: npm install react-rnd
2. Modify floating-graph-panel.tsx:
   - Wrap content in <Rnd> component
   - Enable resize: default, minWidth, maxWidth, minHeight, maxHeight
   - Enable drag: default, handle the drag handle
3. Add visual feedback during drag/resize

Working directory: /Users/abhinavnehra/git/CodeFlow
```

---

### P5.3: Default Position/Size
**Agent:** `frontend-developer`  
**MCP:** Edit  
**Skill:** None  

**Prompt:**
```
Set default position and size for floating graph panel.

In floating-graph-panel.tsx:
- Default position: bottom: 20px, right: 20px
- Default size: width: 30%, height: 35%
- Initial position stored in ide-store

Working directory: /Users/abhinavnehra/git/CodeFlow
```

---

### P5.4: LocalStorage Persistence
**Agent:** `frontend-developer`  
**MCP:** Grep, Edit  
**Skill:** None  

**Prompt:**
```
Persist floating panel position/size to localStorage.

In floating-graph-panel.tsx:
1. On mount: load position/size from localStorage
2. On change: save to localStorage (debounced)
3. Key: 'codeflow-floating-panel-config'
4. JSON structure: { x, y, width, height }

Working directory: /Users/abhinavnehra/git/CodeFlow
```

---

### P6.1: Add Line Numbers to Schema
**Agent:** `refactoring-specialist`  
**MCP:** Grep, Edit  
**Skill:** None  

**Prompt:**
```
Add line numbers to BlueprintNode in src/lib/blueprint/schema.ts.

1. Find BlueprintNode type definition
2. Add optional properties:
   - lineNumber?: number (1-based)
   - startLine?: number
   - endLine?: number
   - filePath?: string
3. Ensure backward compatibility (all optional)

Working directory: /Users/abhinavnehra/git/CodeFlow
```

---

### P6.2: Create node-navigation.ts
**Agent:** `frontend-developer`  
**MCP:** Write  
**Skill:** None  

**Prompt:**
```
Create src/lib/blueprint/node-navigation.ts for graph-to-editor navigation.

Create functions:
1. getNodeFilePath(node: BlueprintNode): string | null
   - Extract file path from node metadata
   
2. getNodeLineNumber(node: BlueprintNode): number | null
   - Get line number from node (P6.1 added this)
   
3. navigateToNode(nodeId: string, editorRef: MonacoEditor)
   - Open file at correct line in Monaco
   - Use editor.revealLineInCenter() for scrolling

Reference: existing blueprint utilities in src/lib/blueprint/

Working directory: /Users/abhinavnehra/git/CodeFlow
```

---

### P6.3: Modify graph-canvas onNodeClick
**Agent:** `frontend-developer`  
**MCP:** Grep, Edit  
**Skill:** None  

**Prompt:**
```
Modify src/components/graph-canvas.tsx to enable navigation on node click.

1. Find existing handleNodeClick function
2. Modify to:
   - Get node's file path (from node-navigation.ts)
   - Get node's line number
   - Call openFile in ide-store with path
   - Trigger scroll to line in editor (P6.4)

Dependencies: P6.1 (line numbers in schema), P6.2 (node-navigation.ts)

Working directory: /Users/abhinavnehra/git/CodeFlow
```

---

### P6.4: Click Node → Scroll to Line
**Agent:** `frontend-developer`  
**MCP:** Grep, Edit  
**Skill:** None  

**Prompt:**
```
Implement scroll-to-line in Monaco when node is clicked.

In code-editor.tsx (or new useEffect):
1. Watch ide-store.activeFile
2. When active file changes, get line number from node
3. Call editorRef.current?.revealLineInCenter(lineNumber)
4. Add cursor position decorator

Dependencies: P6.3 (node click triggers this)

Working directory: /Users/abhinavnehra/git/CodeFlow
```

---

### P7.1: Modify blueprint-workbench.tsx
**Agent:** `frontend-developer`  
**MCP:** Read, Edit  
**Skill:** None  

**Prompt:**
```
Modify src/components/blueprint-workbench.tsx forIDE mode support.

1. Read current blueprint-workbench.tsx
2. Add condition: if ide-store.mode === 'ide', render ide-layout
3. If mode === 'graph', render existing graph view
4. Full replacement of main content area

Dependencies: P1.4 (ide-store.ts), P1.5 (ide-layout.tsx)

Working directory: /Users/abhinavnehra/git/CodeFlow
```

---

### P7.2: Mode Toggle UI
**Agent:** `frontend-developer`  
**MCP:** Grep, Edit  
**Skill:** None  

**Prompt:**
```
Add mode toggle button to switch between Graph View and IDE View.

In blueprint-workbench.tsx:
1. Add toggle button in header/toolbar
2. Icon: graph icon vs code icon
3. Click calls ide-store.setMode()
4. Visual indicator of current mode

Working directory: /Users/abhinavnehra/git/CodeFlow
```

---

### P7.3: Keyboard Shortcut
**Agent:** `frontend-developer`  
**MCP:** Grep, Edit  
**Skill:** None  

**Prompt:**
```
Add keyboard shortcut Cmd/Ctrl+Shift+E for mode toggle.

In blueprint-workbench.tsx:
1. Add useEffect with keydown listener
2. Check for Cmd+Shift+E (Mac) or Ctrl+Shift+E (Windows)
3. Toggle ide-store.mode on trigger
4. Handle focus properly (only when editor not focused)

Working directory: /Users/abhinavnehra/git/CodeFlow
```

---

### P7.4: Preserve Panel States
**Agent:** `frontend-developer`  
**MCP:** Grep, Edit  
**Skill:** None  

**Prompt:**
```
Preserve panel states across mode switches.

In ide-store.ts and blueprint-workbench.tsx:
1. Store panel states (open files, scroll position, panel sizes)
2. When switching from graph → ide: restore IDE state
3. When switching from ide → graph: restore graph state
4. Use localStorage for persistence across page reloads

Working directory: /Users/abhinavnehra/git/CodeFlow
```

---

### P8.1: VCR / Time-Travel
**Agent:** `frontend-developer`  
**MCP:** Grep, Edit  
**Skill:** `frontend-design`  

**Prompt:**
```
Integrate VCR/Time-Travel with IDE mode.

1. Find existing VCR component in src/components/
2. Make it work in both graph and IDE modes
3. Compact widget that fits in IDE toolbar/sidebar
4. Updates live as graph state changes

Working directory: /Users/abhinavnehra/git/CodeFlow
```

---

### P8.2: Observability / Heatmap
**Agent:** `frontend-developer`  
**MCP:** Grep, Edit  
**Skill:** None  

**Prompt:**
```
Integrate Heatmap with Monaco decorations.

1. Find existing Heatmap component
2. In IDE mode:
   - Show Monaco decorations (colored underlines) for hot paths
   - Add status bar indicator showing heatmap active
   - Live updates when traces come in

Working directory: /Users/abhinavnehra/git/CodeFlow
```

---

### P8.3-P8.12: Feature Integrations
**Agent:** `frontend-developer`  
**MCP:** Grep, Edit  
**Skill:** `frontend-design` (per task)  

**Prompt:**
```
Integrate [FEATURE_NAME] with IDE mode.

1. Find existing [FEATURE_NAME] component in src/
2. Make it work in both graph and IDE modes
3. Add appropriate UI in IDE layout (toolbar, sidebar, status bar)
4. Test in both modes

Features:
- P8.3: Digital Twin - status bar indicator, graph highlighting
- P8.4: Refactor/Drift - use diff-editor from P3.2
- P8.5: Genetic - sidebar panel, status bar progress
- P8.6: Branches - branch switcher in title bar
- P8.7: MCP - toolbar, output panel bottom
- P8.8: Ghost Nodes - click to solidify, create file
- P8.9: Execution - status bar progress, Monaco decorations
- P8.10: Export/Approval - toolbar buttons, modal dialogs
- P8.11: Settings - gear icon, Monaco keybindings
- P8.12: Cat Mascot - works in both modes (check existing)

Working directory: /Users/abhinavnehra/git/CodeFlow
```

---

## Execution Order
1. **P1** (Infrastructure) → enables everything else
2. **P3** (Monaco enhancements)
3. **P5** (Floating panel) → needs P1.4/P1.5
4. **P6** (Navigation) → needs P5
5. **P7** (Workbench) → integrates all
6. **P8** (Features) → final integration
7. **P4.3** (streaming) - can do anytime after P4.1-P4.2

---

## Critical Files
- `src/components/code-editor.tsx` - Monaco setup (existing)
- `src/components/graph-canvas.tsx` - node click handling
- `src/store/blueprint-store.ts` - existing state
- `src/lib/blueprint/schema.ts` - add line numbers
- `src/components/blueprint-workbench.tsx` - mode toggle
- `package.json` - add react-rnd, lucide-react

---

## Verification
- Build: `npm run build`
- Type check: `npm run type-check`
- Dev server: `npm run dev`

---

## Execution Strategy
- **All tasks sequential** - one agent at a time
- **Specialized agents** per task (frontend-developer, backend-developer, etc.)
- **Skills:** frontend-design, simplify, etc. as needed
- **MCP tools:** context-mode for file analysis, Context7 for docs