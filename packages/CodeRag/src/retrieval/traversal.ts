import type { BlueprintNode } from "@abhinav2203/codeflow-core/schema";

import type { GraphSnapshot } from "../types.js";

export const traverseDependencies = (
  snapshot: GraphSnapshot,
  nodeId: string,
  depth: number
): {
  dependencies: BlueprintNode[];
  dependents: BlueprintNode[];
} => {
  const dependencies = new Map<string, BlueprintNode>();
  const dependents = new Map<string, BlueprintNode>();

  const walk = (
    rootNodeId: string,
    currentNodeId: string,
    remainingDepth: number,
    direction: "incoming" | "outgoing",
    collector: Map<string, BlueprintNode>
  ) => {
    if (remainingDepth <= 0) {
      return;
    }

    const candidateEdges = snapshot.graph.edges.filter((edge) =>
      direction === "outgoing" ? edge.from === currentNodeId : edge.to === currentNodeId
    );

    for (const edge of candidateEdges) {
      const nextNodeId = direction === "outgoing" ? edge.to : edge.from;
      if (nextNodeId === rootNodeId) {
        continue;
      }

      const node = snapshot.graph.nodes.find((candidate) => candidate.id === nextNodeId);
      if (!node || collector.has(node.id)) {
        continue;
      }

      collector.set(node.id, node);
      walk(rootNodeId, node.id, remainingDepth - 1, direction, collector);
    }
  };

  walk(nodeId, nodeId, depth, "outgoing", dependencies);
  walk(nodeId, nodeId, depth, "incoming", dependents);

  return {
    dependencies: [...dependencies.values()],
    dependents: [...dependents.values()]
  };
};
