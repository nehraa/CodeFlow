# Phase 2 — Future Feature Roadmap

> These items are deferred from Phase 1 (Reasoning Journal). They are not yet implemented.

---

## P2-1: Observability Span Linking

Link trace spans to specific tasks by adding `taskId` to `TraceSpan`.

**Schema change:**
```ts
export const traceSpanSchema = z.object({
  name: z.string(),
  spanId: z.string(),
  traceId: z.string(),
  taskId: z.string().optional(),   // NEW: links span → task → node
  blueprintNodeId: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  status: z.enum(["ok", "error", "timeout"]),
  attributes: z.record(z.unknown()).default({})
});
```

**What this enables:**
- Full trace waterfall: span → task → node → run record
- Per-task latency breakdown
- Filtering spans by taskType or file

**Status:** Not started.

---

## P2-2: Ring-Buffer + Configurable Observability Caps

Currently the observability module has a hard `slice(-500)` cap on all items. Phase 2 introduces configurable, per-project, ring-buffer-based eviction.

**Problems with current approach:**
- 500-item cap is too small for busy agents (50 spans/task × 20 tasks = 1000 spans in one session)
- Spans (~100-500 bytes) and logs (~1-10KB) have different storage profiles — same cap treats them identically
- No per-project override

**Proposed design:**
```ts
// Config file: storeRoot/observability/config.json
interface ObservabilityConfig {
  spansCap: number;      // default 500
  logsCap: number;       // default 2000
  mode: "ring-buffer";   // only ring-buffer for now
}

// Per-project override: storeRoot/observability/<projectName>-config.json
// Merged on top of global config, only overrides values present in override file
```

**Implementation notes:**
- Separate `mergeSpans` and `mergeLogs` from combined `mergeObservabilitySnapshot`
- Ring-buffer: when cap is reached, oldest item is evicted to make room for newest
- Keep last N items per project, not global

**Status:** Not started.

---

## P2-3: Token Usage Tracking

Add structured metadata to the reasoning field for cost and performance analysis.

**Proposed reasoning extension (optional sub-fields):**
```ts
export const reasoningMetadataSchema = z.object({
  tokensUsed: z.number().optional(),
  model: z.string().optional(),
  attempts: z.number().int().min(1).default(1),
  latencyMs: z.number().optional()
});

// In taskExecutionResult:
interface TaskExecutionResult {
  taskId: string;
  nodeId: string;
  status: ExecutionTaskStatus;
  reasoning: string;           // free-text (primary)
  reasoningMetadata: reasoningMetadataSchema.optional();  // structured (optional)
  changes: FileChange[];
  // ...
}
```

**What this enables:**
- Cost per task, per project, per run
- Performance profiling (latencyMs per taskType)
- Retry analysis (attempts > 1 = had to retry)

**Status:** Not started.

---

## P2-4: Crash Recovery / Write-Ahead Reasoning

Currently reasoning lives in the agent's memory until `saveRunRecord` is called. If the process dies before, reasoning is lost.

**Proposed:**
- Agent writes reasoning to a lightweight checkpoint file (`runs/<runId>/<taskId>-reasoning.json`) before executing the task
- On crash recovery, the agent reads these files and repopulates reasoning
- This is an agent-side concern, but codeflow-store should provide the checkpoint API

**API sketch:**
```ts
// Agent calls this before starting task work
saveTaskReasoningCheckpoint(runId: string, taskId: string, reasoning: string, changes: FileChange[]): Promise<void>

// Agent calls this after successful saveRunRecord
clearTaskReasoningCheckpoint(runId: string, taskId: string): Promise<void>
```

**Status:** Not started. Requires agent-side integration.

---

## P2-5: CodeRAG Eviction Policy

When run records are deleted or projects are archived, CodeRAG must be notified to remove reasoning from its index.

**Questions to resolve:**
- Who triggers the eviction — codeflow-store or CodeRAG?
- Is it event-based (store emits deletion event) or polling-based (CodeRAG syncs periodically)?
- What happens to reasoning for deleted runs — soft-delete with TTL, or hard-delete?

**Status:** Not started. Requires CodeRAG integration contract.

---

## P2-6: Full LLM Response Storage (Optional)

Store the raw LLM output per task, with optional compression.

**Use cases:**
- Compliance: must retain full audit trail of agent output
- Debugging: replay exact agent context for failure investigation
- Fine-tuning: use data to improve agent prompts

**Storage approach (if needed):**
```ts
interface TaskLLMOutput {
  taskId: string;
  runId: string;
  compressed: boolean;
  content: string;  // raw LLM response or compressed blob
  compression: "gzip" | "none";
  sizeBytes: number;
}
```

**Note:** This is the lowest-priority Phase 2 item. Only pursue if there is a specific compliance or debugging requirement. The free-text reasoning field (Phase 1) is sufficient for most reasoning documentation needs.

**Status:** Not started. Deferred indefinitely unless specific need arises.

---

## Phase 1 Recap (for reference)

Phase 1 delivers the Reasoning Journal with:

```ts
// taskExecutionResult — Phase 1 fields
interface TaskExecutionResult {
  taskId: string;
  nodeId: string;
  status: ExecutionTaskStatus;
  taskType: "code_generation" | "refactor" | "bugfix" | "test_generation" | "documentation" | "unknown";
  reasoning: string;          // free-text, min 10 chars, max 2000 chars
  changes: FileChange[];      // { file, action, summary }[]
}
```

- `schemaVersion: "1.0"` added to RunRecord
- `renamed` added to `fileChange.action` enum
- `summary` on `FileChange` capped at 200 chars
