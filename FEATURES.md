# CodeFlow Feature List

## Core Features

1. **AI Blueprint Generation** — Generate architecture blueprints from natural language using NVIDIA API (Llama 3.1 405B)

2. **PRD Ingestion** — Parse PRD markdown to extract screens, APIs, classes, functions, modules, and workflows with workflow detection (`->` syntax)

3. **Repository Analysis** — Analyze JavaScript/TypeScript repos using `ts-morph` for modules, imports, classes, methods, functions, API routes, page screens, inheritance, and call edges

4. **Reverse Mode** — PRD extraction works in reverse: feed existing code and generate the PRD/blueprint from it (the "legacy PRD/Repo mode")

5. **Visual Graph Workbench** — React Flow-based interactive canvas for visualizing and editing architecture

6. **Node Editing** — Click any node to inspect/edit its summary, notes, contract, and source references

7. **Trace Overlay** — Paste JSON spans to overlay runtime execution status (success/error/running) on the graph

---

## Analysis & Quality

8. **Cycle Detection** — Detect dependency cycles in the architecture graph

9. **Architecture Smells** — Detect problematic patterns (god modules, shotgun surgery, hub-and-spoke, etc.)

10. **Graph Metrics** — Compute complexity, coupling, fan-in/fan-out scores for the architecture

11. **Conflict/Drift Analysis** — Compare blueprint against live repo snapshot to detect drift

12. **Refactor/Heal** — Auto-detect and fix drift (broken edges, missing edges, signature drift) with synthesized corrections

13. **Heatmap Visualization** — Color-coded node heatmap based on call count, error rate, and latency intensity

---

## Execution & Planning

14. **Execution Planning** — Create task plans with dependency batches and per-node ownership paths

15. **Node Implementation** — AI-assisted code generation per-node with TypeScript validation before accepting

16. **Code Suggestions** — Get AI suggestions for improving existing node code with context awareness

17. **Mermaid Export** — Export architecture diagrams as Mermaid flowchart or class diagrams

---

## VCR & Playback

18. **VCR Recording** — Build replayable execution recordings from trace spans for replay/forking

19. **Trace Ingestion** — Ingest and store spans/logs for graph overlay

---

## Digital Twin

20. **Digital Twin Simulation** — Simulate user flows and active nodes based on observability data with inferred active window

21. **Active Node Overlay** — Highlight currently active nodes on the graph from trace data

---

## Branching & Versioning

22. **Blueprint Branching** — Create, list, and manage named branches of the architecture graph

23. **Branch Diff** — Compare two branches/versions of the blueprint to see what changed

---

## Ghost Nodes (AI Predictions)

24. **Ghost Nodes** — AI-suggested probable next components to add to the architecture (with heuristic fallback when no API key)

25. **Suggested Edges** — Ghost nodes come with suggested connections to existing nodes

---

## Genetic Evolution

26. **Architecture Evolution** — Run genetic-algorithm tournament on blueprint graph to evolve and rank architectural variants

---

## Export & Artifacts

27. **Risk-Aware Export** — Approval gating in `essential` mode; checkpoints before overwriting

28. **Sandboxed Yolo Export** — Local export with diff manifests before syncing to target directory

29. **Multi-Format Export** — Generates `blueprint.json`, markdown docs per node, `system.canvas`, TypeScript/TSX stubs, `ownership.json`, `obsidian-index.md`

---

## AI Backend Integration

30. **OpenCode Integration** — Alternative AI backend supporting Anthropic, OpenAI, Google, Azure, Groq, Mistral, Cohere, Perplexity, OpenRouter, AWS Bedrock, and local models

31. **MCP Servers** — Configure Model Context Protocol servers for enhanced agent capabilities

32. **Skills & Hooks** — Enable OpenCode skills and configure pre/post hooks for automated workflows

33. **CodeRag Integration** — Intelligent code retrieval with Gemini embeddings, indexes codebase on blueprint builds

---

## Persistence

34. **Local Session Storage** — Sessions, runs, approvals, checkpoints stored under `~/.codeflow-store/`

35. **Project-scoped State** — All data isolated per project with configurable store root

---

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/blueprint` | Build blueprint |
| POST | `/api/generate-blueprint` | AI generate blueprint |
| POST | `/api/executions/run` | Execute plan |
| POST | `/api/export` | Export artifacts |
| POST | `/api/approvals/approve` | Approve pending exports |
| POST | `/api/observability/ingest` | Ingest traces |
| GET | `/api/observability/latest` | Get latest spans |
| POST | `/api/conflicts` | Run conflict analysis |
| POST | `/api/vcr` | Build VCR recording |
| GET | `/api/digital-twin` | Get digital twin snapshot |
| POST | `/api/genetic/evolve` | Evolve architectures |
| POST | `/api/ghost-nodes` | Generate ghost node suggestions |
| POST | `/api/refactor/detect` | Detect drift |
| POST | `/api/refactor/heal` | Auto-heal drift |
| POST | `/api/analysis/cycles` | Detect cycles |
| POST | `/api/analysis/metrics` | Compute metrics |
| POST | `/api/analysis/smells` | Detect smells |
| GET/POST | `/api/branches` | List/create branches |
| POST | `/api/branches/diff` | Compare branches |
| POST | `/api/code-suggestions` | AI code suggestions |
| POST | `/api/implement-node` | Implement a node with validation |
| GET | `/api/opencode/status` | Get OpenCode server status |
| POST | `/api/opencode/start` | Start OpenCode server |
| POST | `/api/opencode/stop` | Stop OpenCode server |
| POST | `/api/opencode/restart` | Restart OpenCode server |
| POST | `/api/opencode/agent` | Send message to agent |
| GET | `/api/opencode/sessions` | List OpenCode sessions |
| POST | `/api/opencode/sessions` | Create new session |
| GET | `/api/opencode/sessions/:id` | Get session details |
| POST | `/api/opencode/sessions/:id` | Send message to session |
| DELETE | `/api/opencode/sessions/:id` | Delete session |
| GET | `/api/opencode/mcp` | List MCP servers |
| POST | `/api/opencode/mcp` | Configure MCP server |
| GET | `/api/opencode/permissions` | List permission requests |
| POST | `/api/opencode/permissions` | Reply to permission request |
