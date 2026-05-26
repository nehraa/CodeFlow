import type { BlueprintGraph, GhostNode } from "../schema.js";
import type { GhostProvider } from "./index.js";
export declare class AnthropicGhostProvider implements GhostProvider {
    suggestGhostNodes(graph: BlueprintGraph): Promise<GhostNode[]>;
}
//# sourceMappingURL=anthropic.d.ts.map