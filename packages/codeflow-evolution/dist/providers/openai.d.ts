import type { BlueprintGraph, GhostNode } from "../schema.js";
import type { GhostProvider } from "./index.js";
export declare class OpenAIGhostProvider implements GhostProvider {
    suggestGhostNodes(graph: BlueprintGraph): Promise<GhostNode[]>;
}
//# sourceMappingURL=openai.d.ts.map