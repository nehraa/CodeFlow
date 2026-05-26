import "dotenv/config";
import type { TraceSpan } from "@abhinav2203/codeflow-core/schema";
import type { SimulationResult } from "../../types.js";
export interface SimulateRequest {
    projectName: string;
    nodeIds: string[];
    label?: string;
    runtime?: string;
}
export interface SimulateResponse extends SimulationResult {
    latestSpans: TraceSpan[];
    latestLogs: unknown[];
}
/**
 * Simulate user action by generating synthetic trace spans.
 */
export declare function simulateAction(request: SimulateRequest): Promise<SimulateResponse>;
//# sourceMappingURL=route.d.ts.map