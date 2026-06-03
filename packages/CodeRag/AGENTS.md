# CodeRag Agent Contract

This repo builds the standalone CodeRag package. Every change should keep the package reusable outside CodeFlow and truthful about feature maturity.

## Core Rules

1. Keep CodeRag standalone.
Do not add direct runtime dependencies on CodeFlow UI code, browser state, or Next.js routes.

2. Prefer adapters over special cases.
Repo analysis, embeddings, LLM transport, and persistence should stay behind focused interfaces so other hosts can plug CodeRag in later.

3. No silent fallbacks.
If CodeRag degrades from answer generation to context-only retrieval, surface that explicitly in returned metadata and CLI output.

4. Validate all external input.
Config files, env vars, MCP tool input, HTTP responses, and persisted snapshots must be schema-validated before use.

5. Preserve retrieval truthfulness.
Do not invent call sites, source spans, or graph relationships when they cannot be resolved. Return low-confidence or missing metadata instead.

6. Keep caches replaceable.
Persistence and caching should improve performance only. They must never become the source of truth over the live repo snapshot.

7. Tests are required for behavior.
New indexing, retrieval, transport, or MCP behavior must include direct coverage.

8. Document operator setup.
Any required setup for local model servers, storage locations, or git hooks must be reflected in `README.md`.

9. Preserve future-ready features behind flags.
If a feature is correctly implemented but blocked by external platform constraints (not code errors), gate it behind an optional config flag rather than removing it. This keeps the codebase ready for when platform support arrives. Document the flag and its current support status in `README.md`.
