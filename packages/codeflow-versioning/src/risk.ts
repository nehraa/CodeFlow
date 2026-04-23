import type { RiskReport } from "@abhinav2203/codeflow-core/schema";
import { assessExportRisk } from "@abhinav2203/codeflow-store/risk";
import type { BlueprintGraph, GraphBranch, RunPlan } from "@abhinav2203/codeflow-core/schema";

/**
 * Compute and attach a risk report at branch creation time.
 * Call with the graph and runPlan that the branch was created from.
 */
export const attachRiskReport = async (
  branch: GraphBranch,
  runPlan: RunPlan,
  outputDir?: string
): Promise<GraphBranch> => {
  const { riskReport } = await assessExportRisk(
    branch.graph,
    runPlan,
    outputDir
  );

  return {
    ...branch,
    metadata: {
      ...((branch as any).metadata ?? {}),
      risk: riskReport
    }
  } as GraphBranch;
};

/**
 * Re-attach a provided RiskReport (e.g., from a previous run) to a branch.
 */
export const attachExistingRiskReport = (
  branch: GraphBranch,
  riskReport: RiskReport
): GraphBranch => {
  return {
    ...branch,
    metadata: {
      ...((branch as any).metadata ?? {}),
      risk: riskReport
    }
  } as GraphBranch;
};