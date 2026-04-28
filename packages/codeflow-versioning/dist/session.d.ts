import type { GraphBranch } from "@abhinav2203/codeflow-core/schema";
/**
 * Attach the latest session snapshot to a branch.
 * This preserves the full run state (graph, plan, last risk/export/execution reports)
 * so the branch can be fully reconstructed from the session.
 */
export declare const attachSessionSnapshot: (branch: GraphBranch, projectName?: string) => Promise<GraphBranch>;
//# sourceMappingURL=session.d.ts.map