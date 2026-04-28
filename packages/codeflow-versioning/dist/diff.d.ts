import { type BlueprintGraph, type BranchDiff } from "@abhinav2203/codeflow-core/schema";
export declare const computeDiff: (payload: {
    baseGraph: BlueprintGraph;
    compareGraph: BlueprintGraph;
    baseId?: string;
    compareId?: string;
}) => Promise<BranchDiff>;
//# sourceMappingURL=diff.d.ts.map