import type { ObservabilitySnapshot } from "@abhinav2203/codeflow-core/schema";
import type { GraphBranch } from "@abhinav2203/codeflow-core/schema";
/**
 * Attach the current observability snapshot for a project to a branch.
 * Call this at branch creation time to preserve the execution trace.
 */
export declare const attachObservabilitySnapshot: (branch: GraphBranch, projectName?: string) => Promise<GraphBranch>;
/**
 * Merge a new observability snapshot into the branch's attached snapshot.
 * Used when an agent continues work on an existing branch.
 */
export declare const mergeBranchObservability: (branch: GraphBranch, spans?: ObservabilitySnapshot["spans"], logs?: ObservabilitySnapshot["logs"], projectName?: string) => Promise<ObservabilitySnapshot>;
//# sourceMappingURL=observability.d.ts.map