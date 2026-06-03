# CodeRag

Standalone retrieval engine for coding agents. Parse a multi-language repo into blueprint nodes with tree-sitter (via `codeflow-core`), embed one document per node, store everything in LanceDB, and serve hybrid vector + lexical search with graph-traversal context expansion. Optional LLM-synthesized answers on top. Ships a CLI, an MCP server, and an HTTP service.

## What it owns

- **Indexing.** `RepoIndexer` walks a repo, builds a `GraphSnapshot` (graph + source spans + call sites), synthesizes a markdown document per node, embeds it, and writes to LanceDB. Incremental by default.
- **Embedding.** Three providers: `LocalHashEmbeddingProvider` (zero-setup token-hash, 256-dim), `OnnxEmbeddingProvider` (`Xenova/gte-small`, 384-dim), `GeminiEmbeddingProvider` (REST, 768-dim).
- **Vector store.** `LanceVectorStore` — single `node_documents` table backed by LanceDB on disk.
- **Retrieval.** Hybrid search (`searchDocuments`): vector candidates + lexical candidates, weighted score, then `rerankResults` for exact-symbol boost.
- **Graph traversal.** `traverseDependencies` BFS over `graph.edges` for both `dependencies` and `dependents`.
- **Multi-hop.** Optional question decomposition → parallel sub-question retrieval → merge → synthesis.
- **LLM synthesis.** `OpenAiCompatibleTransport` and `CustomHttpTransport` with retry on 408/425/429/5xx and a system-role fallback.
- **MCP server.** Stdio-only `McpServer` with `query`, `lookup`, `explain`, `impact`, `status` tools.
- **HTTP service.** Bearer-token auth, zod-validated bodies, security headers, in-memory metrics.
- **Git hook.** `installPostCommitHook` writes a `npx coderag reindex` hook on first index, idempotent.
- **CLI.** `coderag` with `setup`, `init`, `index`, `reindex`, `query`, `serve-mcp`, `serve-http`, `doctor`.
- **Config.** `coderag.config.json` with `CODERAG_*` env var overrides for every field.

## Subpath exports

| Subpath | Module |
| --- | --- |
| `.` | Barrel: `CodeRag` class, `createCodeRag`, providers, store, config, errors, types. |
| `./cli` | `runCli(argv)`. |
| `./mcp` | `createMcpServer`, `serveStdioMcpServer`. |

The CLI binary `coderag` ships under `bin/`.

## Public API

```typescript
import { CodeRag, createCodeRag, loadCodeRagConfig } from '@abhinav2203/coderag';

const coderag = await createCodeRag(loadCodeRagConfig());

await coderag.index();
const result = await coderag.query("how does the user login?");
const lookup = await coderag.lookup("authenticateUser");
const explain = await coderag.explain("authenticateUser", { depth: 2 });
const impact = await coderag.impact("authenticateUser", { depth: 2 });
const status = await coderag.status();

await coderag.close();
```

## Key types

```typescript
interface CodeRagConfig extends SerializableCodeRagConfig {
  logger?: Logger;
  embeddingProvider?: EmbeddingProvider;
  vectorStore?: VectorStore;
  graphProvider?: GraphProvider;
  llmTransport?: LlmTransport;
  configPath?: string;
}

interface SerializableCodeRagConfig {
  repoPath: string;
  storageRoot: string;             // default ".coderag"
  embedding: EmbeddingConfig;      // default provider="local-hash", dimensions=256
  retrieval: RetrievalConfig;      // topK=6, rerankK=3, maxContextChars=50000
  multiHop: MultiHopConfig;        // enabled=false, maxSubQuestions=5, expansionDepth=1
  traversal: TraversalConfig;      // defaultDepth=1, maxDepth=3
  locking: LockingConfig;          // timeoutMs=30000, pollMs=150, staleMs=300000
  service: ServiceConfig;          // host="127.0.0.1", port=4119
  llm: SerializableLlmConfig;      // enabled=false, transport="openai-compatible"
  docsPath?: string;               // external markdown dir
}

interface IndexedNodeDocument {
  nodeId: string;
  name: string;
  kind: BlueprintNodeKind;
  filePath: string;
  summary: string;
  signature?: string;
  doc: string;                     // generated markdown
  sourceText?: string;             // raw file slice
  vector: number[];                // 256 / 384 / 768 dim
  startLine: number;
  endLine: number;
}

interface GraphSnapshot {
  provider: string;
  repoPath: string;
  generatedAt: string;
  graph: BlueprintGraph;
  sourceSpans: Record<string, SourceSpan>;
  callSites: Record<string, CallSite>;
}

interface RetrievedNodeContext {
  nodeId: string;
  name: string;
  kind: BlueprintNodeKind;
  filePath: string;
  fullFileContent: string;
  startLine: number;
  endLine: number;
  callSiteLines: number[];
  doc: string;
  relationship: "primary" | "calls" | "called-by" | "multi-hop";
  subQuestionIndex?: number;
}

interface QueryResult {
  question: string;
  answerMode: "llm" | "context-only";
  retrievalMode: "single" | "multi-hop";
  answer: string;
  context: ContextPackage;
}
```

## Indexing pipeline

### What gets indexed

One document per `BlueprintNode` produced by `analyzeRepo(repoPath)` from `@abhinav2203/codeflow-core`. The graph provider walks the source tree and emits nodes, edges, `sourceSpans` (nodeId → `{filePath, startLine, endLine, symbol}`), and `callSites` (keyed `calls:fromId:toId`, with `lineNumbers` and `expressions`).

Supported languages (declared in the adapter and `package.json` keywords): TypeScript, JavaScript, Go, Python, C, C++, Rust. Excluded directories: `node_modules`, `.git`, `.next`, `dist`, `build`, `target`, `__pycache__`, `vendor`, `.venv`, `artifacts`, `coverage`.

### Per-node document synthesis

`buildNodeDocument(node, span, snapshot)` produces a markdown block of:

```
# <name>
Kind: <kind>
Path: <path>
File Name: <basename>
Lines: <start>-<end>
Signature: <signature>

Summary: <node.summary>
Responsibilities: <list>
Inputs: <list>
Outputs: <list>
Declared Dependencies: <list>
Source References: <list>
Calls: <list>
Called By: <list>
```

The actual embedding text per node is `[doc, sourceText].join("\n\n")`, optionally replaced by `await fs.readFile(${docsPath}/${nodeId}.md)` when `docsPath` is supplied. The text gets truncated to `embeddingProvider.maxInputTokens * 4` chars.

### Embedding

| Provider | Model | Dim | Notes |
| --- | --- | --- | --- |
| `local-hash` (default) | FNV-1a token bucket | 256 | Deterministic, zero setup. |
| `onnx` | `Xenova/gte-small` | 384 | Local via `@xenova/transformers`, mean-pooled, batch size 1. Model under `<onnxModelDir>/Xenova/gte-small/`. |
| `gemini` | `models/gemini-embedding-2` | 768 | REST to `generativelanguage.googleapis.com`. 60 RPM / 3 concurrency default. |

### LanceDB storage

- **Path:** `<storageRoot>/lancedb/`
- **Table:** `node_documents` (single table)
- **Schema:** `nodeId, name, kind, filePath, summary, signature, doc, vector, startLine, endLine`
- **Sidecar:** `<storageRoot>/lancedb/store-metadata.json` — embedding fingerprint
- **Other persisted files:** `index-manifest.json`, `graph-snapshot.json`, `documents.json`, `index.lock.json`

### Index flow

1. `checkEmbeddingModelMismatch()` — compares `{provider, model, dimensions}` and `schemaVersion` against the persisted manifest. Mismatch without `forceFull` throws an `IndexingError` directing the user to `coderag reindex`.
2. `IndexLock.withLock("index", ...)` — file lock with `mtime`-based stale detection.
3. `buildGraphSnapshot(repoPath, graphProvider)` — single tree-sitter pass.
4. `buildIndexedDocuments(snapshot, embeddingProvider, docsPath, logger)` — walk nodes, prepare, embed in chunks.
5. `buildIndexManifest(...)` — SHA-256 of each doc and each source file for incremental diff.
6. `diffNodeIds(previous, next)`:
   - `forceFull || !previousManifest` → `vectorStore.reset(records)` (`table.add({mode: "overwrite"})`).
   - Otherwise → `deleteByNodeIds(removedNodeIds)` + `upsert(changedNodeIds)`.
7. `Promise.all` writes manifest, snapshot, documents, vector-store metadata.
8. `ensurePostCommitHook()` — installs the hook if missing.

## Search / retrieval

### `CodeRag.query(question, options)` (single-hop)

1. `ensureLoadedState()` returns the cached `{snapshot, documents}` or rebuilds via `loadState()` / `waitForUnlockedState()` / `runIndexJob()`.
2. `embeddingProvider.embed(expandQuestion(question))`. `expandQuestion` adds synonyms from `QUERY_SYNONYMS` (e.g. `concurrent → [lock, shared, process]`).
3. **Candidate generation:**
   - Vector: up to `max(topK*3, rerankK)` via `vectorStore.vectorSearch(Float32Array.from(queryVector))`.
   - Lexical: top `max(topK*4, rerankK)` sorted by `nameScore*0.35 + summaryScore*0.3 + pathScore*0.2 + signatureScore*0.15 + docLexical*0.2`.
4. **Scoring** — for each candidate, weighted sum of:
   - `vectorScore = cosineSimilarity(...)` (0.28)
   - `lexicalScore = lexicalOverlapScore(...)` (0.18)
   - `fieldScore` — name + summary + path + signature overlap (0.24)
   - `coverageScore = weightedTokenScore(...)` (0.15)
   - `idfScore = calculateIdfScore(...)` (0.05)
   - `exactNameBoost` (0.18 if symbol-like, else 0.04) and `exactPathBoost` (0.14 if symbol-like)
   - `symbolBoost` (0.10 when both exact boosts fire on a symbol-like query)
   - `largeNodePenalty` — `min(0.12, log2(lineSpan/500 + 1) * 0.04)` for nodes > 500 lines
5. **Re-rank** — `rerankResults` adds `+0.2` on exact-name, `+0.18` on exact-path, `+0.08` when the query contains the node name, then slices to `rerankK`.
6. **Graph expansion** — `traverseDependencies(snapshot, primaryNodeId, depth)` for both directions, respecting `traversal.maxDepth`.
7. **Context assembly** — `buildContextPackage()` uses `FileCache` (mtime-keyed) to read full files, then fits `retrieval.maxContextChars` — primary first, then related — recording warnings for truncated or dropped files.
8. **LLM synthesis** (when `llm.enabled`) — `buildMessages()` produces `{system, user}`; `OpenAiCompatibleTransport` POSTs `/chat/completions`, streams via SSE if `onToken` is set. If the upstream returns 400 "system role not supported", the system prompt folds into the first user message and retries.
9. **Return** — `{question, answerMode, retrievalMode, answer, context}`. With `llm.enabled === false`, `answerMode = "context-only"` and `answer` is a fallback string.

### Multi-hop

Triggered when `options.multiHop === true` AND `multiHop.enabled === true` AND an LLM is configured.

1. `decomposeQuestionWithFallback(question, llmTransport, multiHopConfig, model)`:
   - `shouldDecompose()` heuristic gate (score ≥ 2 on `and|vs|versus`, multiple `?`, >25 words, multi-topic keyword).
   - `decomposeQuestion()` asks the LLM for a JSON array of sub-questions, strips code fences, validates, caps at `maxSubQuestions`.
   - Returns `null` on any failure → single retrieval.
2. `multiHopRetrieve(subQuestions, ...)` runs `Promise.all(retrieveForSubQuestion(sq, ...))` for each sub-question with `expansionDepth` traversal.
3. `deduplicateAndMerge()` walks per-sub-question results in order, first occurrence of each `nodeId` wins.
4. `buildMultiHopContextPackage()` regroups nodes by `subQuestionIndex`, builds a unified `graphSummary`.
5. `buildMultiHopMessages()` produces per-sub-question sections, then a system prompt asking the model to address each sub-question and synthesize.

`★ Insight ─────────────────────────────────────`
The decomposition step is the most fragile part of multi-hop. The heuristic gate is conservative, the JSON parser is strict, and any failure falls back to single retrieval. The reasoning: a partial decomposition that returns a bad sub-question list will produce a worse answer than just answering the original question.
`─────────────────────────────────────────────────`

## MCP server

Transport: stdio (`StdioServerTransport`). Server identity: `McpServer({ name: "coderag", version: "0.2.1" })`.

| Tool | Input | Behavior |
| --- | --- | --- |
| `query` | `{question, depth?, multiHop?}` | Calls `coderag.query()`; returns the full `QueryResult` JSON. |
| `lookup` | `{identifier}` | Resolves by exact `id` / case-insensitive `name` / case-insensitive `path` / substring match → `LookupResult`. |
| `explain` | `{identifier, depth?}` | `ExplainResult` with `dependencies` + `dependents` from BFS. |
| `impact` | `{identifier, depth?}` | `ImpactResult` with upstream `dependents` (the things that would be impacted). |
| `status` | `{}` | Returns the `status()` object. |

`serveStdioMcpServer()` calls `ensureIndexIsCurrent()` first:
- If `status.indexed === false` → runs `coderag.index()`.
- If `status.modelMismatch === true` → runs `coderag.reindex({ full: true })`.

There is no HTTP-mode MCP. For HTTP exposure, the `serve-http` CLI command exposes the same five operations plus `/v1/index`, `/v1/reindex`, `/health`, `/ready`, `/metrics` with optional bearer-token auth.

## HTTP service

`createHttpServer()` exposes:

- `POST /v1/query`, `/v1/lookup`, `/v1/explain`, `/v1/impact`, `/v1/index`, `/v1/reindex`
- `GET /v1/status`, `/health`, `/ready`, `/metrics`

Bearer-token auth for `/v1/*` when `service.apiKey` is set. Security headers: `content-security-policy: default-src 'none'`, `x-frame-options: DENY`, `referrer-policy: no-referrer`, `cache-control: no-store`. 1MB body cap. zod validation on every request body. Timing-safe bearer comparison.

## CLI

```
coderag setup
coderag init [--config path] [--json]
coderag index [--config path] [--json]
coderag reindex [--config path] [--full] [--json]
coderag query "question" [--config path] [--depth 2] [--multi-hop] [--json]
coderag serve-mcp [--config path]
coderag serve-http [--config path]
coderag doctor [--config path] [--json]
```

- `setup` — interactive `runSetupWizard` (embedding provider, LLM provider, paths) → writes `coderag.config.json` and `.env`, installs git hook.
- `init` — `coderag.index()` + `installPostCommitHook`. Prints indexed count or JSON.
- `index` — `coderag.index()`. Idempotent on matching fingerprint.
- `reindex --full` — forces a `vectorStore.reset`.
- `query "question"` — `coderag.query()`. Streams tokens unless `--json`.
- `serve-mcp` / `serve-http` — start the corresponding server.
- `doctor` — `indexed, indexedNodeCount, generatedAt, repoPath, storageRoot, provider, llmEnabled` (or JSON).

After every command, `coderag.close()` releases the vector store and file cache.

## Configuration

`coderag.config.json` (see `/Users/abhinavnehra/git/CodeFlow/coderag.config.json` for a working example):

```jsonc
{
  "repoPath": "<absolute or relative path>",
  "storageRoot": ".coderag",
  "embedding": {
    "provider": "onnx" | "local-hash" | "gemini",
    "dimensions": 384,
    "geminiModel": "models/gemini-embedding-2",
    "timeoutMs": 30000,
    "onnxModelDir": ".coderag-models/models"
  },
  "retrieval": {
    "topK": 6, "rerankK": 3, "maxContextChars": 16000,
    "primaryDocLimit": 1200, "primaryFileLimit": 4000,
    "relatedDocLimit": 320,  "relatedFileLimit": 1200
  },
  "multiHop": { "enabled": false, "minQuestionLength": 25, "maxSubQuestions": 5, "expansionDepth": 1 },
  "traversal": { "defaultDepth": 1, "maxDepth": 3 },
  "locking":   { "timeoutMs": 30000, "pollMs": 150, "staleMs": 300000 },
  "service":   { "host": "127.0.0.1", "port": 4119, "apiKey": "optional" },
  "llm": {
    "enabled": true,
    "transport": "openai-compatible" | "custom-http",
    "baseUrl": "https://api.openai.com/v1",
    "model": "gpt-4o",
    "apiKey": "sk-...",
    "timeoutMs": 45000,
    "customHttpFormat": "json" | "ndjson" | "sse",
    "headers": {}
  },
  "docsPath": "<optional dir of ${nodeId}.md files>"
}
```

Cross-field invariants enforced by `loadCodeRagConfig`:
- `retrieval.rerankK <= retrieval.topK`
- `traversal.defaultDepth <= traversal.maxDepth`
- `multiHop.expansionDepth <= traversal.maxDepth`

Every field can be overridden by a `CODERAG_*` environment variable.

## File layout

```
coderag/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── coderag.config.json
└── src/
    ├── index.ts                    public barrel
    ├── cli.ts                      runCli(argv)
    ├── types.ts                    zod schemas + TS interfaces
    ├── bin/coderag.ts              shebang entry, re-imports cli.js
    ├── adapters/
    │   └── codeflow-core.ts        CodeflowCoreGraphProvider, buildGraphSnapshot
    ├── cli/
    │   └── setup-wizard.ts         runSetupWizard
    ├── errors/index.ts             CodeRagError + ConfigurationError, IndexingError, TransportError, NotFoundError
    ├── indexer/
    │   ├── documents.ts            buildNodeDocument, buildIndexedDocuments
    │   ├── embedder.ts             LocalHashEmbeddingProvider
    │   ├── onnx-embedder.ts        OnnxEmbeddingProvider
    │   ├── gemini-embedder.ts      GeminiEmbeddingProvider + RateLimiter
    │   ├── indexer.ts              RepoIndexer
    │   └── git-hook.ts             installPostCommitHook
    ├── llm/
    │   ├── prompt.ts               buildMessages, buildMultiHopMessages
    │   ├── transports.ts           OpenAiCompatibleTransport, CustomHttpTransport
    │   ├── context-builder.ts      buildContextPackage
    │   └── multi-hop-context-builder.ts
    ├── mcp/
    │   └── server.ts               createMcpServer, serveStdioMcpServer
    ├── retrieval/
    │   ├── search.ts               searchDocuments, rerankResults
    │   ├── traversal.ts            traverseDependencies
    │   ├── multi-hop.ts            parallelRetrieve, deduplicateAndMerge, multiHopRetrieve
    │   ├── decompose.ts            shouldDecompose, decomposeQuestionWithFallback
    │   └── page-index.ts           createRetrievedNodeContext
    ├── service/
    │   ├── coderag.ts              CodeRag class (public high-level API)
    │   ├── config.ts               loadCodeRagConfig, loadSerializableConfig, resolveRuntimeConfig
    │   ├── http.ts                 createHttpServer, serveHttpServer
    │   └── http-metrics.ts         HttpMetricsCollector
    ├── store/
    │   ├── manifest-store.ts       ManifestStore
    │   ├── index-lock.ts           IndexLock.withLock
    │   ├── vector-store.ts         LanceVectorStore
    │   └── file-cache.ts           mtime-keyed FileCache
    ├── utils/
    │   ├── filesystem.ts           ensureDir, fileExists, readJson, writeJson, hashContent
    │   ├── text.ts                 tokenizeMeaningfully, tokensRoughlyMatch, cosineSimilarity
    │   └── logger.ts               createConsoleLogger
    └── test/                       34 vitest files
```

## Limits and known gaps

- Schema version 2 is enforced; any mismatch forces a full reindex.
- The ONNX model download is ~33 MB into `.coderag-models/models/Xenova/gte-small/`. First index is slow. Subsequent indexes are incremental.
- The git post-commit hook is idempotent and marked `# Added by CodeRag` so it survives upgrades. The previous hook backs up to `post-commit.coderag.previous`.
- The HTTP server defaults to `127.0.0.1:4119`. There is no HTTPS support; put it behind a reverse proxy if exposing it.
- `engines.node` requires Node 20+.
