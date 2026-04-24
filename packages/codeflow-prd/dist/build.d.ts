import type { BuildBlueprintRequest, BlueprintGraph } from "@abhinav2203/codeflow-core/schema";
/**
 * Build a BlueprintGraph from a BuildBlueprintRequest.
 *
 * v0.1.0: Only PRD text parsing is implemented.
 * Repo analysis (analyzeTypeScriptRepo) and CodeRag (initCodeRag) will be
 * added once those dependencies are properly packaged.
 */
export declare const buildBlueprintGraph: (request: BuildBlueprintRequest) => Promise<BlueprintGraph>;
//# sourceMappingURL=build.d.ts.map