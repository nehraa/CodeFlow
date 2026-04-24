import type { BuildBlueprintRequest, BlueprintGraph } from "@abhinav2203/codeflow-core/schema";
import { parsePrd } from "./prd.js";
import { withSpecDrafts } from "./utils.js";

type PartialGraph = Omit<BlueprintGraph, "projectName" | "mode" | "generatedAt">;

const emptyGraphPart = (): PartialGraph => ({
  nodes: [],
  edges: [],
  workflows: [],
  warnings: []
});

/**
 * Build a BlueprintGraph from a BuildBlueprintRequest.
 *
 * v0.1.0: Only PRD text parsing is implemented.
 * Repo analysis (analyzeTypeScriptRepo) and CodeRag (initCodeRag) will be
 * added once those dependencies are properly packaged.
 */
export const buildBlueprintGraph = async (
  request: BuildBlueprintRequest
): Promise<BlueprintGraph> => {
  const graphParts: PartialGraph[] = [];

  if (request.prdText?.trim()) {
    graphParts.push(parsePrd(request.prdText));
  }

  const combined = graphParts.reduce<PartialGraph>(
    (accumulator, part) => ({
      nodes: [...accumulator.nodes, ...part.nodes],
      edges: [...accumulator.edges, ...part.edges],
      workflows: [...accumulator.workflows, ...part.workflows],
      warnings: [...accumulator.warnings, ...part.warnings]
    }),
    emptyGraphPart()
  );

  const graph: BlueprintGraph = {
    projectName: request.projectName,
    mode: request.mode,
    phase: "spec",
    generatedAt: new Date().toISOString(),
    nodes: combined.nodes,
    edges: combined.edges,
    workflows: combined.workflows,
    warnings: combined.warnings
  };

  if (graph.nodes.length === 0) {
    graph.warnings.push("No blueprint nodes were produced. Provide PRD content.");
  }

  return withSpecDrafts(graph);
};