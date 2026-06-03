# CodeRag

CodeRag is a standalone npm package that gives coding agents targeted retrieval over a codebase. It uses `@abhinav2203/codeflow-core` with tree-sitter for multi-language repo analysis, stores node documents in LanceDB, traverses graph edges for surrounding context, and can optionally ask a local LLM server to turn the retrieved context into an answer.

**Supported languages:** TypeScript, JavaScript, Go, Python, C, C++, Rust.

## What ships in this repo

- Library API for indexing and querying a repo
- CLI for local setup, indexing, querying, and git hook installation
- MCP server exposing `query`, `lookup`, `explain`, `impact`, and `status`
- Easy-to-swap interfaces for graph providers and LLM transports

## Install

```bash
npm install @abhinav2203/coderag
```

## Quick start

1. Create a config file in the target repo:

```json
{
  "repoPath": ".",
  "storageRoot": ".coderag",
  "retrieval": {
    "topK": 6,
    "rerankK": 3
  },
  "traversal": {
    "defaultDepth": 1,
    "maxDepth": 3
  },
  "llm": {
    "enabled": false,
    "transport": "openai-compatible",
    "baseUrl": "http://127.0.0.1:1234/v1",
    "model": "your-local-model"
  }
}
```

2. Initialize the index:

```bash
npx coderag init
```

3. Query the repo:

```bash
npx coderag query "where is auth handled?"
```

4. Run the MCP server:

```bash
npx coderag serve-mcp
```

## Configuration

CodeRag loads configuration in this order:

1. Explicit `--config` path
2. `coderag.config.json`
3. `.coderag.json`
4. `.env` values from the current working directory
5. Environment overrides

Supported environment overrides:

- `CODERAG_REPO_PATH`
- `CODERAG_STORAGE_ROOT`
- `CODERAG_EMBEDDING_PROVIDER`
- `CODERAG_EMBEDDING_DIMENSIONS`
- `CODERAG_ONNX_MODEL_DIR`
- `CODERAG_GEMINI_MODEL`
- `CODERAG_GEMINI_API_KEY`
- `CODERAG_GEMINI_AI_KEY`
- `CODERAG_EMBEDDING_TIMEOUT_MS`
- `CODERAG_TOP_K`
- `CODERAG_RERANK_K`
- `CODERAG_MAX_CONTEXT_CHARS`
- `CODERAG_DEFAULT_DEPTH`
- `CODERAG_MAX_DEPTH`
- `CODERAG_LOCK_TIMEOUT_MS`
- `CODERAG_LOCK_POLL_MS`
- `CODERAG_LOCK_STALE_MS`
- `CODERAG_SERVICE_HOST`
- `CODERAG_SERVICE_PORT`
- `CODERAG_SERVICE_API_KEY`
- `CODERAG_LLM_ENABLED`
- `CODERAG_LLM_TRANSPORT`
- `CODERAG_LLM_BASE_URL`
- `CODERAG_LLM_MODEL`
- `CODERAG_LLM_API_KEY`
- `CODERAG_LLM_TIMEOUT_MS`
- `CODERAG_CUSTOM_HTTP_FORMAT`
- `CODERAG_LLM_HEADERS`

When `embedding.provider` is `gemini`, CodeRag defaults to `models/gemini-embedding-2` and requests 768-dimensional vectors explicitly so the stored embedding fingerprint matches the vectors written to LanceDB. It accepts either `CODERAG_GEMINI_API_KEY` or the compatibility alias `CODERAG_GEMINI_AI_KEY`.

When `embedding.provider` is `onnx`, CodeRag uses `Xenova/gte-small` (384-dim, ~33MB) running locally via `@xenova/transformers`. No API key or external server needed. The model must be downloaded to `<onnxModelDir>/Xenova/gte-small/` (default `.coderag-models/models/Xenova/gte-small/`).

```bash
# Download the ONNX embedding model (~33MB)
python3 -c "
from huggingface_hub import snapshot_download
snapshot_download('Xenova/gte-small', local_dir='.coderag-models/models',
                  allow_patterns=['onnx/model_quantized.onnx', 'config.json',
                                  'tokenizer.json', 'tokenizer_config.json',
                                  'special_tokens_map.json'])
"

# Then set embedding.provider to "onnx" in your config and run coderag init
```

## Local LLM integration

CodeRag does not require a hosted model. The default documented path is any local or self-hosted model server that exposes an OpenAI-compatible HTTP API on a port.

### OpenAI-compatible server

Point CodeRag at a server that exposes `/v1/chat/completions` and streams tokens over SSE.

```json
{
  "llm": {
    "enabled": true,
    "transport": "openai-compatible",
    "baseUrl": "http://127.0.0.1:1234/v1",
    "model": "qwen2.5-coder-14b-instruct"
  }
}
```

CodeRag sends:

- the user question
- the assembled CodeRag context package
- a system prompt that tells the model to answer only from retrieved code context

Compatibility notes:

- `baseUrl` may already include `/v1`; CodeRag preserves that path when calling `/chat/completions`.
- If a provider rejects `system` role messages, CodeRag retries by folding the system prompt into the first user message.
- Prompt assembly is compact and file-aware so small-context local models can still answer from retrieved code without receiving duplicated file bodies.

### Custom HTTP server

If your local model server is not OpenAI-compatible, use `transport: "custom-http"`.

Request body:

```json
{
  "question": "where is auth handled?",
  "model": "local-model",
  "stream": true,
  "context": {
    "graphSummary": "..."
  },
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ]
}
```

Supported response formats:

- `json`: `{ "answer": "..." }`
- `ndjson`: one JSON object per line with `token` chunks and an optional final `answer`
- `sse`: `data:` frames with `token` chunks and an optional final `answer`

Example:

```json
{
  "llm": {
    "enabled": true,
    "transport": "custom-http",
    "baseUrl": "http://127.0.0.1:8080",
    "model": "local-model",
    "customHttpFormat": "ndjson"
  }
}
```

## Retrieval behavior

- Indexing stores one generated markdown document per blueprint node.
- Search uses deterministic local embeddings, source-span-aware lexical reranking, query expansion for operational terms, and a penalty for oversized catch-all nodes.
- Page index retrieval reads full files from disk and caches them by `mtimeMs`.
- Graph traversal expands both upstream and downstream neighbors up to the requested depth.
- If no LLM is configured, `query` returns `answerMode: "context-only"` with the same context package.

## CLI

```bash
coderag init [--config path]
coderag index [--config path]
coderag reindex [--config path] [--full]
coderag query "question" [--config path] [--depth 2] [--json]
coderag serve-mcp [--config path]
coderag serve-http [--config path]
coderag doctor [--config path]
```

## Git hook

`coderag init` installs a `post-commit` hook that triggers `coderag reindex` and preserves any pre-existing hook logic.

## Production notes

- TypeScript, JavaScript, Go, Python, C, C++, and Rust repos are supported.
- Excluded directories: `node_modules`, `.git`, `.next`, `dist`, `build`, `target`, `__pycache__`, `vendor`, `.venv`, `artifacts`, `coverage`.
- Call-site extraction is best effort for dynamic dispatch, reflection, or generated code. Missing call sites are returned as unresolved metadata, not guessed values.
- The built-in `local-hash` embedding strategy is deterministic and zero-setup. The `onnx` provider runs `Xenova/gte-small` locally (384-dim, ~33MB) for semantic-quality embeddings without any API key. If you need cloud-quality embeddings, use the `gemini` provider.
- `serve-http` exposes `/health`, `/ready`, `/metrics`, and `/v1/*` endpoints. `/ready` only reports ready once the index exists, contains documents, and matches the configured embedding fingerprint.
- If you use Gemini embeddings, set `CODERAG_GEMINI_API_KEY` or `CODERAG_GEMINI_AI_KEY` before indexing. Changing `CODERAG_GEMINI_MODEL` requires a full reindex because the persisted embedding fingerprint includes the model name and dimensions.
- Live E2E runs in this repo were verified against an OpenAI-compatible NVIDIA endpoint and against both the CodeRag and CodeFlow repositories.

## Development

```bash
npm install
npm run lint
npm run check
npm test
npm run build
```
