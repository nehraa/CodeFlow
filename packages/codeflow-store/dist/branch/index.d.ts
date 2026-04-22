import type { GraphBranch } from "@abhinav2203/codeflow-core/schema";
export declare const saveBranch: (branch: GraphBranch) => Promise<GraphBranch>;
export declare const loadBranch: (projectName: string, branchId: string) => Promise<GraphBranch | null>;
export declare const loadBranches: (projectName: string) => Promise<GraphBranch[]>;
export declare const deleteBranch: (projectName: string, branchId: string) => Promise<void>;
//# sourceMappingURL=index.d.ts.map