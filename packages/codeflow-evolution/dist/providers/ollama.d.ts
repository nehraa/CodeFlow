import type { BlueprintGraph, GhostNode } from "../schema.js";
import type { GhostProvider } from "./index.js";
export declare class OllamaGhostProvider implements GhostProvider {
    suggestGhostNodes(graph: BlueprintGraph): Promise<GhostNode[]>;
}
//# sourceMappingURL=ollama.d.ts.map