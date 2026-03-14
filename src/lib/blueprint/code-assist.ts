import type { BlueprintGraph } from "@/lib/blueprint/schema";

export const getNodeAssistanceContext = (graph: BlueprintGraph, nodeId: string) => {
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);

  if (!node) {
    return null;
  }

  const relatedNodes = graph.nodes.filter(
    (candidate) => candidate.id === node.id || candidate.ownerId === node.id || node.ownerId === candidate.id
  );
  const relatedEdges = graph.edges.filter(
    (edge) =>
      edge.from === node.id ||
      edge.to === node.id ||
      relatedNodes.some((candidate) => candidate.id === edge.from || candidate.id === edge.to)
  );

  return {
    node,
    relatedNodes,
    relatedEdges
  };
};
