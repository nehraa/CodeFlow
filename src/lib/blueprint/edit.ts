import type { BlueprintEdge, BlueprintGraph, BlueprintNode, BlueprintNodeKind } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";
import { withSpecDrafts } from "@/lib/blueprint/phases";
import { createNodeId, dedupeEdges } from "@/lib/blueprint/utils";

export const addNodeToGraph = (
  graph: BlueprintGraph,
  input: { kind: BlueprintNodeKind; name: string; summary?: string }
): BlueprintGraph => {
  const node: BlueprintNode = {
    id: createNodeId(input.kind, input.name),
    kind: input.kind,
    name: input.name,
    summary: input.summary ?? `${input.kind} ${input.name}`,
    contract: {
      ...emptyContract(),
      summary: input.summary ?? `${input.kind} ${input.name}`
    },
    sourceRefs: [{ kind: "generated", detail: "Added in workbench" }],
    generatedRefs: [],
    traceRefs: []
  };

  return withSpecDrafts({
    ...graph,
    nodes: [...graph.nodes.filter((existing) => existing.id !== node.id), node]
  });
};

export const addEdgeToGraph = (
  graph: BlueprintGraph,
  input: { from: string; to: string; kind: BlueprintEdge["kind"]; label?: string }
): BlueprintGraph => ({
  ...graph,
  edges: dedupeEdges([
    ...graph.edges,
    {
      from: input.from,
      to: input.to,
      kind: input.kind,
      label: input.label,
      required: true,
      confidence: 1
    }
  ])
});

export const deleteNodeFromGraph = (graph: BlueprintGraph, nodeId: string): BlueprintGraph => ({
  ...graph,
  nodes: graph.nodes.filter((node) => node.id !== nodeId),
  edges: graph.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId)
});
