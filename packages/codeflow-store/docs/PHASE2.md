# Phase 2 — What We're Adding and Why

## What Phase 2 Is

Phase 1 (done) gave every task execution a `reasoning` field (free-text) + `changes[]` (what files changed) + `taskType`. Phase 2 extends the store with four focused features.

---

## The Four Things We're Adding

### P2-1 — Link trace spans to tasks
**What:** Add `taskId` to `traceSpanSchema` (one line in codeflow-core schema).
**Why:** Right now you can see a span ran but not which task triggered it. With `taskId`, you can filter spans per-task and build trace waterfalls: span → task → node → run record.
**New files:** None.

---

### P2-2 — Configurable ring-buffer for spans and logs
**What:** Replace the hardcoded `.slice(-500)` with a proper `RingBuffer<T>` class. Separate caps for spans (default 500) and logs (default 2000). Per-project config override.
**Why:** The hardcoded cap silently drops data — a busy agent with 20 tasks × 50 spans = 1,000 spans, but only 500 survive. Spans (~100–500 bytes) and logs (~1–10 KB) have completely different sizes; same cap treats them identically.
**New files:** `ring-buffer.ts`, `config.ts`, two test files.
**Config file:** `{storeRoot}/observability-config/{projectSlug}.json`

---

### P2-4 — Crash recovery checkpoints
**What:** Write reasoning to disk *before* task execution. If the process crashes, recover it from the checkpoint file.
**Why:** Currently reasoning lives in memory until `saveRunRecord()` is called at end of run. Crash = reasoning gone forever.
**New files:** `src/checkpoint/reasoning.ts` (save/load/recover/clear API)
**Checkpoint path:** `{storeRoot}/checkpoints/reasoning/{runId}/{projectSlug}/{taskId}.json`
**Agent-side:** Agent calls `saveTaskReasoningCheckpoint` before task, `clearTaskReasoningCheckpoint` after `saveRunRecord`.

---

### P2-5 — Reasoning journal for CodeRAG
**What:** Pull API — `loadReasoningForProject(projectName)` and `loadReasoningForRun(runId, projectName)`. CodeRAG calls these on reindex.
**Why:** The reasoning stored in run records needs to be indexable by CodeRAG's vector search. Pull model means no coupling — CodeRAG reads when it needs to reindex, codeflow-store doesn't need to know about CodeRAG.
**New files:** `src/reasoning/index.ts`, test file.
**coderag side:** Its own adapter calls `loadReasoningForProject()` on reindex. No events, no webhooks.

---

## What We're NOT Adding (Deferred)

- **P2-3 Token tracking** — not needed yet; reasoning free-text is enough for now
- **P2-6 LLM output storage** — compliance/archive feature, premature until actually required

---

## How It Fits Together

```
Agent runs task
  → P2-4: saveTaskReasoningCheckpoint (write-ahead, before work)
  → does task work
  → P2-1: emits span with taskId (links span to task)
  → P2-2: observability stores span/log (ring-buffer caps applied)
  → P2-4: clearTaskReasoningCheckpoint (after saveRunRecord)
  → P2-5: CodeRAG reindexes → calls loadReasoningForProject()
```

---

*Last updated: 2026-04-22*
