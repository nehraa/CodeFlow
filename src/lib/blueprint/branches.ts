import crypto from "node:crypto";

import type {
  BlueprintEdge,
  BlueprintGraph,
  BlueprintNode,
  BranchDiff,
  EdgeDiff,
  GraphBranch,
  NodeDiff
} from "@/lib/blueprint/schema";
import { blueprintGraphSchema } from "@/lib/blueprint/schema";

export const createBranchId = (): string => crypto.randomUUID();

/**
 * Snapshot the current graph into a named branch.
 * The graph is normalized through the schema so that all default values are applied.
 */
export const createBranch = ({
  graph,
  name,
  description,
  parentBranchId
}: {
  graph: BlueprintGraph;
  name: string;
  description?: string;
  parentBranchId?: string;
}): GraphBranch => {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Branch name must not be empty.");
  }

  return {
    id: createBranchId(),
    name: trimmedName,
    description: description?.trim(),
    projectName: graph.projectName,
    parentBranchId,
    createdAt: new Date().toISOString(),
    graph: blueprintGraphSchema.parse(structuredClone(graph))
  };
};

// ── Diff helpers ────────────────────────────────────────────────────────────

const nodeKey = (node: BlueprintNode): string => {
  const baseKey = `${node.kind}:${node.name}:${node.summary}:${node.path ?? ""}:${
    node.status ?? "spec_only"
  }`;

  // Include additional persisted fields so that changes to them are reflected in the diff.
  // We deliberately exclude obviously volatile data (if any is added in the future),
  // and compute a stable hash over the snapshot of relevant fields.
  const snapshot = {
    signature: (node as any).signature ?? "",
    ownerId: (node as any).ownerId ?? "",
    contract: (node as any).contract ?? null
  };

  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(snapshot))
    .digest("hex");

  return `${baseKey}:${hash}`;
};

const edgeKey = (edge: BlueprintEdge): string => `${edge.from}→${edge.to}:${edge.kind}`;

/**
 * Count how many edges in `edges` involve `nodeId`.
 */
const countImpactedEdges = (nodeId: string, edges: BlueprintEdge[]): number =>
  edges.filter((e) => e.from === nodeId || e.to === nodeId).length;

/**
 * Compare two blueprint graphs and produce a structured diff.
 *
 * `base` is treated as the "before" snapshot (origin branch).
 * `compare` is treated as the "after" snapshot (the 'what if' branch).
 */
export const diffBranches = (
  base: BlueprintGraph,
  compare: BlueprintGraph,
  baseId = "base",
  compareId = "compare"
): BranchDiff => {
  // Normalize both graphs so all default fields (phase, status, etc.) are populated.
  const normalizedBase = blueprintGraphSchema.parse(base);
  const normalizedCompare = blueprintGraphSchema.parse(compare);

  const baseById = new Map(normalizedBase.nodes.map((n) => [n.id, n]));
  const compareById = new Map(normalizedCompare.nodes.map((n) => [n.id, n]));

  const baseEdgeKeys = new Set(normalizedBase.edges.map(edgeKey));
  const compareEdgeKeys = new Set(normalizedCompare.edges.map(edgeKey));

  const nodeDiffs: NodeDiff[] = [];
  const edgeDiffs: EdgeDiff[] = [];
  const impactedNodeIds = new Set<string>();

  // Nodes present in base
  for (const [id, baseNode] of baseById) {
    const compareNode = compareById.get(id);
    if (!compareNode) {
      // Removed in compare branch
      nodeDiffs.push({
        nodeId: id,
        name: baseNode.name,
        kind: "removed",
        before: baseNode,
        impactedEdgeCount: countImpactedEdges(id, normalizedBase.edges)
      });
      impactedNodeIds.add(id);
    } else if (nodeKey(baseNode) !== nodeKey(compareNode)) {
      // Modified
      nodeDiffs.push({
        nodeId: id,
        name: compareNode.name,
        kind: "modified",
        before: baseNode,
        after: compareNode,
        impactedEdgeCount: countImpactedEdges(id, normalizedCompare.edges)
      });
      impactedNodeIds.add(id);
    } else {
      nodeDiffs.push({
        nodeId: id,
        name: baseNode.name,
        kind: "unchanged",
        before: baseNode,
        after: compareNode,
        impactedEdgeCount: 0
      });
    }
  }

  // Nodes only in compare (added)
  for (const [id, compareNode] of compareById) {
    if (!baseById.has(id)) {
      nodeDiffs.push({
        nodeId: id,
        name: compareNode.name,
        kind: "added",
        after: compareNode,
        impactedEdgeCount: countImpactedEdges(id, normalizedCompare.edges)
      });
      impactedNodeIds.add(id);
    }
  }

  // Edges
  let addedEdges = 0;
  let removedEdges = 0;

  for (const edge of normalizedBase.edges) {
    const key = edgeKey(edge);
    if (!compareEdgeKeys.has(key)) {
      edgeDiffs.push({ from: edge.from, to: edge.to, edgeKind: edge.kind, diffKind: "removed" });
      impactedNodeIds.add(edge.from);
      impactedNodeIds.add(edge.to);
      removedEdges++;
    } else {
      edgeDiffs.push({ from: edge.from, to: edge.to, edgeKind: edge.kind, diffKind: "unchanged" });
    }
  }

  for (const edge of normalizedCompare.edges) {
    const key = edgeKey(edge);
    if (!baseEdgeKeys.has(key)) {
      edgeDiffs.push({ from: edge.from, to: edge.to, edgeKind: edge.kind, diffKind: "added" });
      impactedNodeIds.add(edge.from);
      impactedNodeIds.add(edge.to);
      addedEdges++;
    }
  }

  const addedNodes = nodeDiffs.filter((d) => d.kind === "added").length;
  const removedNodes = nodeDiffs.filter((d) => d.kind === "removed").length;
  const modifiedNodes = nodeDiffs.filter((d) => d.kind === "modified").length;

  return {
    baseId,
    compareId,
    addedNodes,
    removedNodes,
    modifiedNodes,
    addedEdges,
    removedEdges,
    impactedNodeIds: [...impactedNodeIds],
    nodeDiffs,
    edgeDiffs
  };
};
