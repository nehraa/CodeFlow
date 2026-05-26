import type { BlueprintGraph } from "@abhinav2203/codeflow-core";
export type WorkspaceCompileResult = {
    success: boolean;
    diagnostics: string;
    issues: Array<{
        filePath: string;
        line: number;
        column: number;
        message: string;
    }>;
};
export declare const initializeTypeScriptWorkspace: (workspaceDir: string, _graph: BlueprintGraph) => Promise<void>;
export declare const writeWorkspaceFile: (workspaceDir: string, filePath: string, content: string) => Promise<void>;
export declare const writeBlueprintGraphToWorkspace: (workspaceDir: string, graph: BlueprintGraph, _codeDrafts?: Record<string, string>) => Promise<void>;
export declare const compileTypeScriptWorkspace: (workspaceDir: string) => Promise<WorkspaceCompileResult>;
//# sourceMappingURL=typescript-workspace.d.ts.map