import type { BlueprintGraph, ObservabilitySnapshot } from "@abhinav2203/codeflow-core/schema";
export declare const loadObservabilitySnapshot: (projectName: string) => Promise<ObservabilitySnapshot | null>;
export declare const mergeObservabilitySnapshot: (options: {
    projectName: string;
    spans?: ObservabilitySnapshot["spans"];
    logs?: ObservabilitySnapshot["logs"];
    graph?: BlueprintGraph;
} | null) => Promise<ObservabilitySnapshot>;
//# sourceMappingURL=index.d.ts.map