import type { BlueprintGraph, ExecutionReport, ExportResult } from "../schema/index.js";
export declare const exportBlueprintArtifacts: (graph: BlueprintGraph, outputDir?: string, executionReport?: ExecutionReport, codeDrafts?: Record<string, string>) => Promise<ExportResult>;
