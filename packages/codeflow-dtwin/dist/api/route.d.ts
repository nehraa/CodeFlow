import "dotenv/config";
import { overlayActiveNodes } from "../digital-twin.js";
import type { DigitalTwinSnapshot } from "../types.js";
export interface DigitalTwinResponse {
    snapshot: DigitalTwinSnapshot | null;
    graph: ReturnType<typeof overlayActiveNodes> | null;
    activeWindowSecs: number;
}
/**
 * Load and compute the current Digital Twin snapshot for a project.
 *
 * @param projectName - The project name to load
 * @param activeWindowSecs - Time window in seconds for determining active nodes (default 60)
 * @returns Digital twin response with snapshot and overlaid graph
 */
export declare function getDigitalTwin(projectName: string, activeWindowSecs?: number): Promise<DigitalTwinResponse>;
//# sourceMappingURL=route.d.ts.map