import { suggestGhostNodes } from "./index.js";
/**
 * Entry-point for the ghost node suggestion engine.
 * Accepts a parsed BlueprintGraph and returns suggested ghost nodes.
 */
export async function runGhostNodes(graph) {
    return suggestGhostNodes(graph);
}
//# sourceMappingURL=ghost-nodes.js.map