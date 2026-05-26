import type { BlueprintNode, ExecutionStep, RuntimeTestCase, RuntimeTestResult } from "@abhinav2203/codeflow-core";
import type { PreparedRuntimeWorkspace } from "./runtime-workspace-local.js";
export declare const generateRuntimeTestCases: ({ node, seedInput }: {
    node: BlueprintNode;
    seedInput?: string;
}) => RuntimeTestCase[];
export declare const runGeneratedRuntimeTests: ({ workspace, node, runId, testCases }: {
    workspace: PreparedRuntimeWorkspace;
    node: BlueprintNode;
    runId: string;
    testCases: RuntimeTestCase[];
}) => Promise<{
    steps: ExecutionStep[];
    results: RuntimeTestResult[];
}>;
//# sourceMappingURL=runtime-tests.d.ts.map