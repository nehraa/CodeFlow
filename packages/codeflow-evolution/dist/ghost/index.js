import { getGhostProvider } from "../providers/index.js";
export { getGhostProvider };
/**
 * Suggest ghost nodes for a given blueprint graph using the configured
 * AI provider.
 */
export async function suggestGhostNodes(graph) {
    const provider = getGhostProvider();
    return provider.suggestGhostNodes(graph);
}
//# sourceMappingURL=index.js.map