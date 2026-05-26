import "dotenv/config";
import { buildSimulationSpans } from "../../digital-twin.js";
import { mergeObservabilitySnapshot } from "@abhinav2203/codeflow-store/observability";
import { loadLatestSession } from "@abhinav2203/codeflow-store/session";
/**
 * Simulate user action by generating synthetic trace spans.
 */
export async function simulateAction(request) {
    const session = await loadLatestSession(request.projectName);
    if (!session) {
        throw new Error(`No session found for project: ${request.projectName}`);
    }
    const spans = buildSimulationSpans(session.graph, request.nodeIds, request.label ?? "Simulated flow", request.runtime ?? "simulation");
    // Cast through unknown to bypass strict type checking for span runtime optionality
    // The schema has runtime with a default, so it will be present at runtime
    const snapshot = await mergeObservabilitySnapshot({
        projectName: request.projectName,
        spans: spans,
        logs: [],
        graph: session.graph
    });
    const latestSpans = snapshot.spans.slice(-100);
    const latestLogs = [];
    const computedSnapshot = {
        projectName: session.graph.projectName,
        computedAt: new Date().toISOString(),
        maturity: "preview",
        activeNodeIds: request.nodeIds,
        flows: [],
        observedSpanCount: snapshot.spans.filter(s => s.provenance === "observed").length,
        simulatedSpanCount: snapshot.spans.filter(s => s.provenance === "simulated").length,
        observedFlowCount: 0,
        simulatedFlowCount: 1,
        activeWindowSecs: 60
    };
    return {
        snapshot: computedSnapshot,
        spans: spans,
        flows: [],
        latestSpans,
        latestLogs
    };
}
//# sourceMappingURL=route.js.map