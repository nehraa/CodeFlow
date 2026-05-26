import { getGhostProvider } from "../providers/index.js";
import type { GhostNode, BlueprintGraph } from "../schema.js";

export { getGhostProvider };
export type { GhostNode, BlueprintGraph };

/**
 * Suggest ghost nodes for a given blueprint graph using the configured
 * AI provider.
 */
export async function suggestGhostNodes(
  graph: BlueprintGraph,
): Promise<GhostNode[]> {
  const provider = getGhostProvider();
  return provider.suggestGhostNodes(graph);
}