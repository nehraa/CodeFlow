import type { RiskReport } from "@abhinav2203/codeflow-core/schema";
import type { GraphBranch, RunPlan } from "@abhinav2203/codeflow-core/schema";
/**
 * Compute and attach a risk report at branch creation time.
 * Call with the graph and runPlan that the branch was created from.
 */
export declare const attachRiskReport: (branch: GraphBranch, runPlan: RunPlan, outputDir?: string) => Promise<GraphBranch>;
/**
 * Re-attach a provided RiskReport (e.g., from a previous run) to a branch.
 */
export declare const attachExistingRiskReport: (branch: GraphBranch, riskReport: RiskReport) => GraphBranch;
//# sourceMappingURL=risk.d.ts.map