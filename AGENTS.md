# CodeFlow Agent Contract

This file is the default engineering contract for CodeFlow. Agents and humans should treat these rules as the baseline for every change.

## Core Rules

1. Reuse before adding.
Search for existing hooks, helpers, schemas, route utilities, and UI primitives before creating new abstractions.

2. Do not duplicate business logic.
Shared behavior must live in extracted utilities, hooks, or services. Do not copy logic between `blueprint-workbench`, `policy-workbench`, routes, or store helpers.

3. Do not reinvent the wheel.
Prefer stable platform APIs or maintained libraries when the problem is not product-specific.

4. No silent failures.
Every catch path must either:
- return a structured error,
- set a visible UI error or stale state, or
- log diagnostic context intentionally.

5. Be truthful about feature maturity.
Heuristic, simulated, AI-generated, or scaffold output must be labeled as such in APIs and UI. Do not present them as observed truth or production-ready implementation unless validated.

6. Validate external I/O.
All request bodies, persisted payloads, AI responses, MCP responses, and export manifests must be schema-validated before use.

7. Validate generated code.
AI-generated implementation is not production truth by default. Prefer local validation before marking code as implemented or runnable.

8. Do not persist raw secrets in browser storage.
Use server environment variables, session-only memory, or explicit secure local handling. Never store raw secrets in exported artifacts, sessions, or long-lived browser storage.

9. Tests are part of the change.
New route, runtime, export, or advanced feature work should include direct coverage for the changed path.

10. Do not keep growing giant files.
When touching oversized files, prefer extracting helpers or section-specific components instead of adding more inline logic.

## Execution And Validation Contract

11. Make every code-bearing node independently verifiable.
Function, API, and class nodes must compile and run directly or explicitly declare why they are not directly runnable. Module nodes must aggregate child results instead of hiding failures.

12. Green means observed pass, not optimism.
Graph edges or nodes may turn green only from real compile, execution, and assertion evidence. Simulated, heuristic, scaffold, skipped, or manually assumed states must never use the same success semantics.

13. A pass must be contract-true.
A node run only passes when all of these hold:
- the artifact compiles,
- the input shape is validated,
- the callable returns the expected output shape or side effect,
- downstream handoff data is validated before it is consumed.

14. Whole-graph runs must preserve failure locality.
When a full flow runs, the system must record which exact node, method, or function failed, what input it received, what output or error it produced, and which downstream edge was blocked.

15. Composite nodes must support drill-down.
If a module or class is shown as failed, the UI and persisted execution data must allow a user to drill into the exact child method or function that failed. A parent node may not be shown as healthy when a child execution failed.

16. Warnings are not cosmetic.
Do not paper over compiler warnings, type errors, build warnings, test flake, or security findings. Fix them, gate on them, or document an explicit accepted-risk decision with scope and owner.

## Test And Review Discipline

17. Every code-bearing function needs direct tests.
Each function or class method added or materially changed should have success-path, failure-path, and edge-case coverage unless the repo already has stronger integration coverage that makes the direct test redundant.

18. Modules and flows need integration coverage.
Module-level behavior, API routes, and graph execution flows must have integration tests that exercise real boundaries and real data handoffs.

19. No fake-pass tests.
The following are not acceptable as sufficient proof on their own:
- tests that only assert mocks were called,
- snapshot-only tests for business logic,
- tests with no meaningful assertions,
- widening expectations just to make CI pass,
- disabling warnings or validations without a documented reason.

20. Prefer fail-to-pass before pass-to-pass.
When fixing a bug or regression, add or tighten a test that fails first, then make it pass, then keep surrounding pass-to-pass coverage green.

21. Review behavior, not just output.
Passing tests are necessary but not sufficient. Check contracts, warnings, error handling, security boundaries, dependency choices, and code duplication before calling work done.

22. No handwaving.
Claims such as "fixed", "safe", "production-ready", or "green" must be backed by specific evidence: compile output, test coverage, runtime validation, warning status, and file-level changes.

## AI-Assisted Engineering Risks

23. Treat model output as untrusted input.
AI output must be schema-validated, compiled, tested, and reviewed before it is treated as implementation, command input, configuration, or persisted state.

24. Guard against hallucinated dependencies and APIs.
Before adding a package, method, endpoint, or config flag suggested by AI, verify that it exists, is maintained, fits the repo, and is already available or intentionally approved.

25. Guard against prompt injection and tool poisoning.
Do not let prompts, MCP tool descriptions, retrieved documents, or generated code silently change system authority. Keep least privilege, validate tool metadata, and keep security-critical policy in code.

26. Do not confuse benchmark pass rates with production quality.
A model can pass tests and still introduce bugs, vulnerabilities, code smells, or architecture drift. Static analysis, contract checks, and human review remain mandatory.

27. Reuse proven patterns before asking AI to invent new ones.
When solving a problem, first point the model at the existing house style, neighboring modules, and established abstractions. Do not accept novelty when the repo already has a correct pattern.

## CodeFlow Defaults

- Deployment model: single-user, local-first workstation.
- Localhost MCP servers are allowed, but must still use explicit validation and timeout handling.
- Generated code is only production-grade when validated; scaffold output must be marked clearly.
- Digital Twin simulation must never be presented as live observed traffic.
- Refactor/heal currently means graph drift repair unless a change explicitly modifies real source code.
- Release gates are `npm run lint`, `npm run check`, `npm test`, and `npm run build`.
- Required target runtime semantics are documented in `docs/execution-validation-contract.md`.
- AI-assisted coding failure modes and required countermeasures are documented in `docs/ai-coding-risk-playbook.md`.
