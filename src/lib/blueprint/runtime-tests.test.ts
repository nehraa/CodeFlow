import { describe, expect, it, vi } from "vitest";

import {
  generateRuntimeTestCases,
  runGeneratedRuntimeTests
} from "@/lib/blueprint/runtime-tests";
import type { BlueprintNode } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

const node: BlueprintNode = {
  id: "function:format",
  kind: "function",
  name: "format",
  summary: "Format a value.",
  contract: {
    ...emptyContract(),
    summary: "Format a value.",
    inputs: [{ name: "input", type: "string" }],
    outputs: [{ name: "result", type: "string" }]
  },
  status: "implemented",
  sourceRefs: [],
  generatedRefs: [],
  traceRefs: []
};

describe("runtime test generation", () => {
  it("generates representative happy-path, edge-case, and invalid-input cases from the node contract", () => {
    const cases = generateRuntimeTestCases({ node, seedInput: '"seed-value"' });

    expect(cases).toHaveLength(3);
    expect(cases.map((testCase) => testCase.kind)).toEqual([
      "happy-path",
      "edge-case",
      "invalid-input"
    ]);
    expect(cases[0]?.input).toBe('"seed-value"');
    expect(cases[1]?.input).toBe('""');
    expect(cases[2]?.input).toBe("42");
    expect(cases[2]?.expectation).toBe("fail");
    expect(cases[0]?.notes[0]).toContain("declared node contract");
  });

  it("runs generated tests without invoking invalid-input cases that contract validation already rejects", async () => {
    const invokeNode = vi.fn(async (_node, input: unknown) => ({
      success: true,
      stdout: "",
      stderr: "",
      exitCode: 0,
      durationMs: 5,
      executedPath: "/tmp/runtime",
      output: { result: String(input).toUpperCase() },
      error: undefined
    }));

    const workspace = {
      workspaceDir: "/tmp/runtime-workspace",
      compileResult: {
        success: true,
        diagnostics: "",
        issues: []
      },
      invokeNode,
      cleanup: vi.fn(async () => undefined)
    };

    const testCases = generateRuntimeTestCases({ node, seedInput: '"seed-value"' });
    const { results, steps } = await runGeneratedRuntimeTests({
      workspace,
      node,
      runId: "run-1",
      testCases
    });

    expect(invokeNode).toHaveBeenCalledTimes(2);
    expect(results.map((result) => result.status)).toEqual(["passed", "passed", "passed"]);
    expect(steps).toHaveLength(3);
    expect(steps[2]?.message).toContain("invalid input");
    expect(steps[2]?.status).toBe("passed");
    expect(results[2]?.stepIds).toEqual([steps[2]!.id]);
  });
});
