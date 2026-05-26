import "dotenv/config";
import { computeDigitalTwinSnapshot, overlayActiveNodes } from "../digital-twin.js";
import { loadObservabilitySnapshot } from "@abhinav2203/codeflow-store/observability";
import { loadLatestSession } from "@abhinav2203/codeflow-store/session";
/**
 * Load and compute the current Digital Twin snapshot for a project.
 *
 * @param projectName - The project name to load
 * @param activeWindowSecs - Time window in seconds for determining active nodes (default 60)
 * @returns Digital twin response with snapshot and overlaid graph
 */
export async function getDigitalTwin(projectName, activeWindowSecs = 60) {
    const [observabilitySnapshot, session] = await Promise.all([
        loadObservabilitySnapshot(projectName),
        loadLatestSession(projectName)
    ]);
    const spans = observabilitySnapshot?.spans ?? [];
    const graph = session?.graph ?? null;
    if (!graph) {
        return { snapshot: null, graph: null, activeWindowSecs };
    }
    const snapshot = computeDigitalTwinSnapshot(graph, spans, activeWindowSecs);
    const overlaidGraph = overlayActiveNodes(graph, snapshot.activeNodeIds);
    return { snapshot, graph: overlaidGraph, activeWindowSecs };
}
//# sourceMappingURL=route.js.map