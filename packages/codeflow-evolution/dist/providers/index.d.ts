import "dotenv/config";
import type { GhostNode } from "../schema.js";
import type { BlueprintGraph } from "../schema.js";
export type GhostProvider = {
    suggestGhostNodes(graph: BlueprintGraph): Promise<GhostNode[]>;
};
export declare function getGhostProvider(): GhostProvider;
//# sourceMappingURL=index.d.ts.map