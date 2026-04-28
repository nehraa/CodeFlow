import { type BlueprintGraph, type GraphBranch, type RunPlan } from "@abhinav2203/codeflow-core/schema";
export declare const listBranches: (projectName: string) => Promise<GraphBranch[]>;
export declare const createBranch: (payload: {
    graph: BlueprintGraph;
    name: string;
    description?: string;
    parentBranchId?: string;
    runId?: string;
    attachObservability?: boolean;
    attachRisk?: boolean;
    attachSession?: boolean;
    runPlan?: RunPlan;
    outputDir?: string;
}) => Promise<GraphBranch>;
export declare const getBranch: (projectName: string, branchId: string) => Promise<GraphBranch | null>;
export declare const removeBranch: (projectName: string, branchId: string) => Promise<void>;
//# sourceMappingURL=invoke.d.ts.map