import type { BlueprintGraph, BlueprintNode } from "@abhinav2203/codeflow-core";
import { type WorkspaceCompileResult } from "./internal/typescript-workspace.js";
export type RuntimeNodeInvocationResult = {
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number | null;
    durationMs: number;
    executedPath: string;
    output?: unknown;
    error?: string;
    methodName?: string;
};
export type PreparedRuntimeWorkspace = {
    workspaceDir: string;
    compileResult: WorkspaceCompileResult;
    invokeNode: (node: BlueprintNode, input: unknown, args: unknown[]) => Promise<RuntimeNodeInvocationResult>;
    cleanup: () => Promise<void>;
};
export declare const prepareRuntimeWorkspace: ({ graph, codeDrafts }: {
    graph: BlueprintGraph;
    codeDrafts?: Record<string, string>;
}) => Promise<PreparedRuntimeWorkspace>;
//# sourceMappingURL=runtime-workspace-local.d.ts.map