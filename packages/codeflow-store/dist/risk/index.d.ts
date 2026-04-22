import type { BlueprintGraph, RiskReport, RunPlan } from "@abhinav2203/codeflow-core/schema";
export type ExportRiskAssessment = {
    fingerprint: string;
    outputDir: string;
    riskReport: RiskReport;
    hasExistingOutput: boolean;
};
export declare const assessExportRisk: (graphOrOptions: BlueprintGraph | {
    graph: BlueprintGraph;
    runPlan: RunPlan;
    outputDir?: string;
}, runPlanOrUndefined?: RunPlan, outputDir?: string) => Promise<ExportRiskAssessment>;
//# sourceMappingURL=index.d.ts.map