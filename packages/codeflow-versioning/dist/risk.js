import { assessExportRisk } from "@abhinav2203/codeflow-store/risk";
/**
 * Compute and attach a risk report at branch creation time.
 * Call with the graph and runPlan that the branch was created from.
 */
export const attachRiskReport = async (branch, runPlan, outputDir) => {
    const { riskReport } = await assessExportRisk(branch.graph, runPlan, outputDir);
    return {
        ...branch,
        metadata: {
            ...(branch.metadata ?? {}),
            risk: riskReport
        }
    };
};
/**
 * Re-attach a provided RiskReport (e.g., from a previous run) to a branch.
 */
export const attachExistingRiskReport = (branch, riskReport) => {
    return {
        ...branch,
        metadata: {
            ...(branch.metadata ?? {}),
            risk: riskReport
        }
    };
};
