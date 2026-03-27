# AI Coding Risk Playbook

This document turns common "vibe coding" failure modes into explicit CodeFlow guardrails. These are not optional style notes. They are the minimum controls for using AI to write, modify, review, or execute code in this repo.

## What "Vibe Coding" Gets Wrong

The failure mode is not simply "AI wrote bad code." The real problem is unverified momentum:

- code that looks plausible but is not contract-true,
- tests that look green but prove very little,
- warnings that get normalized instead of resolved,
- dependencies and APIs accepted without verification,
- simulated or heuristic results presented as observed truth,
- architecture drift introduced by broad, unreviewed generation.

CodeFlow should treat AI as an accelerant, not an authority.

No fake-pass tests, no papering over warnings, and no handwaving about quality. The system should either show evidence or admit the gap.

## Failure Modes And Required Countermeasures

| Risk | What it looks like in practice | Required countermeasure in CodeFlow |
| --- | --- | --- |
| Overreliance on model output | The model sounds certain, so developers skip verification | Require schema validation, compile gates, tests, and human review before accepting output |
| Hallucinated packages or APIs | AI invents a package name, config option, endpoint, or method | Verify existence, ownership, maintenance status, version compatibility, and repo fit before adoption |
| Passing tests but bad production code | The code passes functional tests but still has code smells, insecure defaults, or weak error handling | Run static analysis, review warnings, inspect contracts and edge cases, and do not equate green tests with release quality |
| Fake-pass tests | Tests only assert mocks, snapshots, or incidental implementation details | Require behavior assertions, failure-path tests, and boundary-condition coverage |
| Prompt injection or tool poisoning | Tool descriptions, retrieved docs, or pasted content manipulate the model into unsafe output | Treat retrieved content as untrusted, validate tool metadata, keep least privilege, and keep authorization logic outside the model |
| Improper output handling | Model output is piped into shell, SQL, file paths, HTML, or tools without validation | Treat model output like user input; validate, sanitize, encode, and constrain before downstream use |
| Excessive agency | The model can trigger writes, network calls, or execution with too much autonomy | Keep explicit allowlists, minimal privileges, approval gates, and narrow tool scopes |
| Security regression through convenience | AI introduces insecure defaults, weak validation, or leaky secret handling | Use secure defaults, threat-check sensitive routes, and block raw secret persistence or prompt leakage |
| Architecture drift | AI duplicates logic, invents new abstractions, or expands file size without need | Search existing patterns first, reuse local abstractions, and reject novelty without justification |
| Benchmark gaming | The system optimizes for "passes tests" instead of real behavior | Track warnings, failure locality, compile status, contract validation, and runtime evidence alongside tests |
| Scope explosion | A small task turns into a sweeping refactor | Keep prompts issue-shaped, scope the write set, and prefer incremental verified changes |
| Unverifiable claims in reviews | A change says "fixed" without evidence | Require command results, file references, and explicit test coverage for behavioral claims |

## Required Workflow For AI-Assisted Changes

### 1. Start from the real contract

Before asking AI to implement anything, provide:

- the target file or boundary,
- the expected inputs and outputs,
- existing neighboring patterns,
- the tests that must pass,
- the failure mode to avoid.

If the task is vague, the output will usually be vague or wrong.

### 2. Reuse before generation

Ask the model to find the existing pattern first. In this repo, acceptable prompts should resemble:

- "Implement this the same way as the adjacent route."
- "Extract shared logic instead of duplicating it."
- "Use the existing schema and store helpers."

Do not ask for a fresh abstraction until you know the repo lacks one.

### 3. Validate in layers

For code written or modified with AI, validate in this order:

1. Schema validity
2. Compile or typecheck
3. Unit and integration tests
4. Static analysis and warnings review
5. Human review of contracts, security, and duplication

Skipping layers is how plausible garbage ships.

### 4. Treat warnings as work

Warnings are not "good enough for now" unless they are explicitly accepted as a temporary risk with:

- exact warning text,
- scope,
- owner,
- follow-up plan.

If a warning matters enough to mention, it matters enough to track or fix.

### 5. Demand failure evidence, not just success evidence

AI-generated changes should include proof that:

- failure paths were tested,
- invalid inputs were rejected,
- edge cases were exercised,
- downstream consumers handle bad or absent data correctly.

### 6. Keep the model away from unnecessary authority

Do not let AI output:

- choose arbitrary shell commands for production operations,
- invent filesystem paths outside approved roots,
- auto-approve risky writes,
- smuggle secrets into prompts, logs, or exports,
- decide security policy based on free-form reasoning alone.

## Repo-Specific Rules For CodeFlow

### 7. Graph truthfulness

Never let heuristic, simulated, scaffold, or draft outputs present themselves as observed production truth. Provenance and maturity labels are mandatory.

### 8. Execution truthfulness

Do not mark a node green because code was generated. Mark it green only after observed compile, run, and contract validation evidence.

### 9. Test truthfulness

Every code-bearing function or method should have direct behavioral coverage unless stronger integration coverage makes that redundant. Module and route behavior should have real integration tests. Whole-flow behavior should have scenario coverage.

### 10. Review truthfulness

Do not merge or describe work as complete when any of these remain unverified:

- compile behavior,
- runtime behavior,
- warning state,
- failure-path behavior,
- dependency validity,
- security boundaries,
- drift against local patterns.

## Research Notes And References

These rules are grounded in a mix of AI security guidance, software-engineering usage guidance, and empirical studies:

- OWASP GenAI LLM01 Prompt Injection: https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- OWASP GenAI LLM05 Improper Output Handling: https://genai.owasp.org/llmrisk/llm052025-improper-output-handling/
- OWASP GenAI LLM06 Excessive Agency: https://genai.owasp.org/llmrisk/llm062025-excessive-agency/
- OWASP GenAI LLM09 Misinformation / Overreliance: https://genai.owasp.org/llmrisk/llm09-overreliance/
- OpenAI, "How OpenAI uses Codex": https://openai.com/business/guides-and-resources/how-openai-uses-codex/
- OpenAI for developers: https://developers.openai.com/
- Sabra, Schmitt, Tyler, "Assessing the Quality and Security of AI-Generated Code: A Quantitative Analysis" (arXiv:2508.14727): https://arxiv.org/abs/2508.14727
- Snyk, "Building Safer AI Agents with Structured Outputs": https://snyk.io/articles/building-safer-ai-agents-structured-outputs/
