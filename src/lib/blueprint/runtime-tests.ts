import crypto from "node:crypto";

import type {
  BlueprintNode,
  ExecutionStep,
  ExecutionStepStatus,
  RuntimeTestCase,
  RuntimeTestResult
} from "@/lib/blueprint/schema";
import { previewRuntimeValue, resolveExecutableContract, validateNodeInvocationInput, validateNodeOutput } from "@/lib/blueprint/runtime-contracts";
import type { PreparedRuntimeWorkspace } from "@/lib/blueprint/runtime-workspace";

const parseSeedInput = (seedInput?: string): unknown => {
  if (!seedInput?.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(seedInput);
  } catch {
    return seedInput;
  }
};

const synthesizeValue = (type: string, variant: "happy-path" | "edge-case" | "invalid-input"): unknown => {
  const normalized = type.trim();

  if (!normalized || normalized === "void") {
    return variant === "invalid-input" ? "unexpected" : undefined;
  }

  if (normalized.startsWith("Array<") || normalized.endsWith("[]")) {
    if (variant === "invalid-input") {
      return "not-an-array";
    }

    const nestedType = normalized.startsWith("Array<")
      ? normalized.slice(6, -1).trim()
      : normalized.slice(0, -2).trim();
    const nestedValue = synthesizeValue(nestedType, variant === "edge-case" ? "edge-case" : "happy-path");
    return variant === "edge-case" ? [] : [nestedValue];
  }

  if (normalized === "string") {
    if (variant === "invalid-input") {
      return 42;
    }

    return variant === "edge-case" ? "" : "codeflow";
  }

  if (normalized === "number" || normalized === "bigint") {
    if (variant === "invalid-input") {
      return "NaN";
    }

    return variant === "edge-case" ? 0 : 7;
  }

  if (normalized === "boolean") {
    if (variant === "invalid-input") {
      return "true";
    }

    return variant === "edge-case" ? false : true;
  }

  if (normalized === "object" || normalized.startsWith("Record<")) {
    if (variant === "invalid-input") {
      return "not-an-object";
    }

    return variant === "edge-case" ? {} : { ok: true };
  }

  if (normalized === "null") {
    return variant === "invalid-input" ? "null" : null;
  }

  if (normalized === "undefined") {
    return variant === "invalid-input" ? "defined" : undefined;
  }

  if (normalized === "unknown" || normalized === "any") {
    return variant === "invalid-input" ? { arbitrary: true } : { sample: true };
  }

  if (variant === "invalid-input") {
    return null;
  }

  return variant === "edge-case"
    ? {}
    : {
        kind: normalized,
        sample: true
      };
};

const buildInputPayload = (node: BlueprintNode, variant: RuntimeTestCase["kind"], seedInput?: string): unknown => {
  const parsedSeed = parseSeedInput(seedInput);
  const executableContract = resolveExecutableContract(node);

  if (variant === "happy-path" && typeof parsedSeed !== "undefined") {
    const seedValidation = validateNodeInvocationInput(node, parsedSeed);
    if (seedValidation.status !== "failed") {
      return parsedSeed;
    }
  }

  if (executableContract.inputs.length === 0) {
    return variant === "invalid-input" ? { unexpected: true } : undefined;
  }

  if (executableContract.inputs.length === 1) {
    return synthesizeValue(executableContract.inputs[0]?.type ?? "unknown", variant);
  }

  return Object.fromEntries(
    executableContract.inputs.map((field) => [field.name, synthesizeValue(field.type, variant)])
  );
};

const serializeCaseInput = (input: unknown): string => {
  try {
    return JSON.stringify(input);
  } catch {
    return JSON.stringify(null);
  }
};

const resolveTestStatus = (
  expectation: RuntimeTestCase["expectation"],
  stepStatus: ExecutionStepStatus
): ExecutionStepStatus => {
  if (expectation === "pass") {
    return stepStatus;
  }

  if (expectation === "fail") {
    return stepStatus === "failed" || stepStatus === "blocked" || stepStatus === "passed" ? "passed" : stepStatus;
  }

  return stepStatus === "warning" ? "passed" : stepStatus;
};

export const generateRuntimeTestCases = ({
  node,
  seedInput
}: {
  node: BlueprintNode;
  seedInput?: string;
}): RuntimeTestCase[] => {
  const scenarios: Array<{
    kind: RuntimeTestCase["kind"];
    expectation: RuntimeTestCase["expectation"];
    title: string;
    notes: string[];
  }> = [
    {
      kind: "happy-path",
      expectation: "pass",
      title: `${node.name} accepts a representative input`,
      notes: ["Generated from the declared node contract."]
    },
    {
      kind: "edge-case",
      expectation: "pass",
      title: `${node.name} handles an edge-case input`,
      notes: ["Uses empty or low-value inputs derived from contract field types."]
    },
    {
      kind: "invalid-input",
      expectation: "fail",
      title: `${node.name} rejects invalid input`,
      notes: ["The invalid-input case should fail at contract validation or at runtime."]
    }
  ];

  return scenarios.map((scenario) => {
    const input = buildInputPayload(node, scenario.kind, seedInput);

    return {
      id: crypto.randomUUID(),
      nodeId: node.id,
      title: scenario.title,
      kind: scenario.kind,
      input: serializeCaseInput(input),
      expectation: scenario.expectation,
      notes: scenario.notes
    };
  });
};

export const runGeneratedRuntimeTests = async ({
  workspace,
  node,
  runId,
  testCases
}: {
  workspace: PreparedRuntimeWorkspace;
  node: BlueprintNode;
  runId: string;
  testCases: RuntimeTestCase[];
}): Promise<{ steps: ExecutionStep[]; results: RuntimeTestResult[] }> => {
  const steps: ExecutionStep[] = [];
  const results: RuntimeTestResult[] = [];

  for (const testCase of testCases) {
    const startedAt = new Date();
    let parsedInput: unknown;

    try {
      parsedInput = JSON.parse(testCase.input);
    } catch {
      parsedInput = testCase.input;
    }

    const inputValidation = validateNodeInvocationInput(node, parsedInput);

    if (testCase.expectation === "fail" && inputValidation.status === "failed") {
      const completedAt = new Date();
      const step: ExecutionStep = {
        id: crypto.randomUUID(),
        runId,
        kind: "test",
        nodeId: node.id,
        status: "passed",
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
        stdout: "",
        stderr: "",
        message: `${testCase.title} passed because contract validation rejected the invalid input.`,
        inputPreview: previewRuntimeValue(parsedInput),
        outputPreview: undefined,
        artifactIds: [],
        contractChecks: inputValidation.checks
      };

      steps.push(step);
      results.push({
        caseId: testCase.id,
        title: testCase.title,
        kind: testCase.kind,
        status: "passed",
        message: step.message,
        stepIds: [step.id]
      });
      continue;
    }

    const invocation = await workspace.invokeNode(node, parsedInput, inputValidation.args);
    const outputValidation =
      invocation.success && typeof invocation.output !== "undefined"
        ? validateNodeOutput(node, invocation.output)
        : { status: "failed" as ExecutionStepStatus, checks: [] };

    const rawStatus: ExecutionStepStatus =
      inputValidation.status === "failed" || !invocation.success
        ? "failed"
        : outputValidation.status === "failed"
          ? "failed"
          : inputValidation.status === "warning" || outputValidation.status === "warning"
            ? "warning"
            : "passed";

    const resolvedStatus =
      testCase.expectation === "fail"
        ? rawStatus === "failed" || rawStatus === "warning"
          ? "passed"
          : "failed"
        : resolveTestStatus(testCase.expectation, rawStatus);

    const completedAt = new Date();
    const message =
      testCase.expectation === "fail"
        ? resolvedStatus === "passed"
          ? `${testCase.title} passed because invalid input was rejected.`
          : `${testCase.title} failed because invalid input was accepted as a clean pass.`
        : rawStatus === "passed"
          ? `${testCase.title} passed.`
          : rawStatus === "warning"
            ? `${testCase.title} surfaced a runtime warning.`
            : `${testCase.title} failed.`;

    const step: ExecutionStep = {
      id: crypto.randomUUID(),
      runId,
      kind: "test",
      nodeId: node.id,
      status: resolvedStatus,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      stdout: invocation.stdout,
      stderr: invocation.stderr,
      message,
      inputPreview: previewRuntimeValue(parsedInput),
      outputPreview: previewRuntimeValue(invocation.output),
      artifactIds: [],
      contractChecks: [...inputValidation.checks, ...outputValidation.checks]
    };

    steps.push(step);
    results.push({
      caseId: testCase.id,
      title: testCase.title,
      kind: testCase.kind,
      status: resolvedStatus,
      message,
      stepIds: [step.id]
    });
  }

  return { steps, results };
};
