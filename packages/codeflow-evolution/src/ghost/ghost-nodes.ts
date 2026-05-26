import { suggestGhostNodes } from "./index.js";
import type { BlueprintGraph, GhostNode } from "../schema.js";

/**
 * Entry-point for the ghost node suggestion engine.
 * Accepts a parsed BlueprintGraph and returns suggested ghost nodes.
 */
export async function runGhostNodes(graph: BlueprintGraph): Promise<GhostNode[]> {
  return suggestGhostNodes(graph);
}