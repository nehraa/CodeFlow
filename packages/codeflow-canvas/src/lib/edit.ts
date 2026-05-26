import type {
  BlueprintEdge,
  BlueprintGraph,
  BlueprintNode,
  BlueprintNodeKind
} from "@abhinav2203/codeflow-core/schema";
import { emptyContract } from "@abhinav2203/codeflow-core/schema";

// Utility functions inlined from @abhinav2203/codeflow-core
const createNodeId = (kind: BlueprintNodeKind, name: string): string => {
  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return `${kind}:${slug}`;
};

const dedupeEdges = (edges: BlueprintEdge[]): BlueprintEdge[] => {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    const key = `${edge.from}:${edge.to}:${edge.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Draft management - inlined from phases
const withSpecDrafts = (graph: BlueprintGraph): BlueprintGraph => graph;

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