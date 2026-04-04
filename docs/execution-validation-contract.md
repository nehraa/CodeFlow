# CodeFlow Execution And Validation Contract

This document defines the required production target for how CodeFlow should execute nodes, validate outcomes, and surface failures. It is intentionally stricter than the current implementation. Until the product reaches this bar, UI and API copy must not imply that the full contract already exists.

## Why This Exists

CodeFlow should not behave like a vague code generator. It should behave like a graph-aware execution and verification system where:

- each runnable leaf node can be executed independently,
- composite nodes reflect the truth of their children,
- whole-program runs show which exact path passed or failed,
- return values and side effects are validated before they unlock downstream nodes,
- a user can drill from a failed module into the exact failing function or method.

## Required Runtime Model

### 1. Execution levels

CodeFlow should distinguish three levels of execution:

- Leaf execution: a directly runnable function, API handler, class method, or UI interaction harness.
- Composite execution: a module, service, or screen made up of multiple child execution units.
- Graph execution: an end-to-end run across multiple nodes and edges in dependency order.

Every code-bearing node must be mapped to one of these:

- `directly-runnable`
- `runnable-through-child-nodes`
- `not-runnable-yet`

If a node is not runnable yet, the reason must be explicit in the UI and persisted execution record.

### 2. Pass and fail semantics

A node run is a real pass only if all of the following succeed:

1. The artifact compiles or typechecks at the required boundary.
2. The runtime harness executes without an unhandled failure.
3. Input contracts are validated before invocation.
4. Output contracts are validated after invocation.
5. Required side effects are observed or asserted.
6. Any value passed to a downstream edge is validated before consumption.

If any of those fail, the node is red, not green.

### 3. Status meanings

These meanings should be enforced consistently across the graph, inspector, logs, and persisted run records:

- Green: observed pass from real execution and validation.
- Red: observed failure from real execution or validation.
- Yellow: warning, flaky, partial, or degraded outcome that did not meet the clean pass bar.
- Gray: not run.
- Blue or striped badge: simulated, heuristic, or preview evidence that is not a real pass.

Green must never mean "the model thinks this should work."

## Whole-Graph Run Behavior

### 4. Graph execution flow

When a user clicks run for the whole program, CodeFlow should:

1. Build an execution plan from the graph.
2. Execute runnable leaf nodes in dependency order.
3. Emit a per-step execution event for each node and edge.
4. Validate returned values before releasing downstream nodes.
5. Mark downstream nodes as blocked if an upstream node fails or returns invalid output.
6. Persist exact evidence for each step.

### 5. Execution evidence

Each execution step should persist a structured record with at least:

- `runId`
- `nodeId`
- `parentNodeId` when applicable
- `methodName` or `entrypointName` when applicable
- `input`
- `outputSummary`
- `validationStatus`
- `stderr`
- `stdout`
- `startedAt`
- `finishedAt`
- `durationMs`
- `downstreamEdgeIds`
- `blockedByNodeId` when blocked

### 6. Edge handoff validation

Edges are not just lines on a diagram. They are contracts.

Before a value is passed from node A to node B, CodeFlow should validate:

- the producing node actually emitted a value,
- the value matches the declared output contract of node A,
- the value matches the declared input contract of node B,
- any required transformation step is explicit and testable.

If the handoff fails validation, the failure belongs to the edge handoff and the downstream node must not be marked green.

## Composite Nodes And Drill-Down

### 7. Module and class truthfulness

Composite nodes must derive their state from children:

- A module is green only when all required child executions are green.
- A module is red if any required child execution fails.
- A module is yellow if children are mixed, partial, skipped, or degraded.

The same rule applies to class nodes with multiple methods.

### 8. Drill-down behavior

Double-clicking a failed module or class should open the exact failing child execution, including:

- method or function name,
- failing assertion,
- input payload,
- returned value or thrown error,
- stack trace or stderr,
- test case or scenario name,
- upstream dependency context.

If the graph has only coarse nodes today, the runtime must still materialize child execution records instead of collapsing everything into one module-level pass or fail.

## Test Contract

### 9. Minimum required test layers

For production-grade execution visibility, CodeFlow should require:

- Function or method tests for leaf logic.
- Route or service integration tests for module boundaries.
- Scenario or end-to-end tests for critical graph workflows.

### 10. No fake-pass coverage

The following do not count as enough evidence:

- a test that only checks whether a mock was called,
- a test that snapshots output without validating behavior,
- a graph run that only checks exit code,
- a module marked green because one child passed while others were skipped,
- simulated traces shown as if they were observed execution.

### 11. Recommended test strategy

For each code-bearing node, prefer:

- one happy-path test,
- one failure-path test,
- one edge-case test,
- one contract-shape test when inputs or outputs are structured,
- one integration test where the node hands real data to its most important downstream dependency.

For bugs, prefer fail-to-pass first, then keep pass-to-pass coverage green.

## Implementation Guidance For CodeFlow

### 12. Interpreter or compiler expectations

CodeFlow does not need a custom language interpreter. The practical model is:

- compile TypeScript or TSX artifacts in an isolated workspace,
- run per-node harnesses for functions, APIs, class methods, and UI interactions,
- capture structured outputs and validation results,
- project those results back onto graph nodes and edges.

For composite nodes, the system should execute the underlying callable children rather than pretending the module itself is a callable unit.

### 13. Reuse and leverage existing tools

Do not reinvent core infrastructure when proven tools already solve the problem:

- Use TypeScript compilation for compile gates.
- Use Zod or equivalent schema validation for input and output contracts.
- Use Vitest or Jest for unit and integration tests.
- Use Playwright for browser or workflow verification.
- Use structured execution events rather than ad hoc console parsing.

### 14. Release bar for this feature area

This runtime model should not be called production-ready until:

- leaf-node execution is real for supported node kinds,
- composite-node drill-down exists,
- edge handoff validation exists,
- graph colors map to observed evidence,
- fake-pass states are eliminated,
- tests cover the execution pipeline itself.
