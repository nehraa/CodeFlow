import type { BlueprintGraph, GhostNode } from "../schema.js";
import type { GhostProvider } from "./index.js";
export declare class NvidiaGhostProvider implements GhostProvider {
    suggestGhostNodes(graph: BlueprintGraph): Promise<GhostNode[]>;
}
//# sourceMappingURL=nvidia.d.ts.map