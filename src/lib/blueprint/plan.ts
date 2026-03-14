import type { BlueprintGraph, BlueprintNode, ExecutionBatch, ExecutionTask, RunPlan } from "@/lib/blueprint/schema";
import { slugify } from "@/lib/blueprint/utils";

const taskOwnerPath = (node: BlueprintNode): string => {
  const extension = node.kind === "ui-screen" ? "tsx" : "ts";
  return `stubs/${slugify(node.kind)}-${slugify(node.name)}.${extension}`;
};

export const createRunPlan = (graph: BlueprintGraph): RunPlan => {
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const remaining = new Set(graph.nodes.map((node) => node.id));
  const dependencyMap = new Map<string, Set<string>>();
  const warnings: string[] = [];

  for (const node of graph.nodes) {
    const dependencyIds = graph.edges
      .filter((edge) => edge.from === node.id && nodeMap.has(edge.to))
      .map((edge) => edge.to);

    dependencyMap.set(node.id, new Set(dependencyIds));
  }

  const batches: ExecutionBatch[] = [];
  const batchIndexByNodeId = new Map<string, number>();

  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter((nodeId) => [...(dependencyMap.get(nodeId) ?? new Set<string>())].every((depId) => !remaining.has(depId)))
      .sort((left, right) => {
        const leftNode = nodeMap.get(left);
        const rightNode = nodeMap.get(right);
        return `${leftNode?.kind}:${leftNode?.name}`.localeCompare(`${rightNode?.kind}:${rightNode?.name}`);
      });

    const batchNodeIds =
      ready.length > 0
        ? ready
        : [...remaining]
            .sort((left, right) => {
              const leftNode = nodeMap.get(left);
              const rightNode = nodeMap.get(right);
              return `${leftNode?.kind}:${leftNode?.name}`.localeCompare(`${rightNode?.kind}:${rightNode?.name}`);
            })
            .slice(0, 1);

    if (ready.length === 0) {
      const node = nodeMap.get(batchNodeIds[0]);
      warnings.push(`Cycle detected around ${node?.name ?? batchNodeIds[0]}; forced a serial execution break.`);
    }

    const batchIndex = batches.length;
    for (const nodeId of batchNodeIds) {
      batchIndexByNodeId.set(nodeId, batchIndex);
      remaining.delete(nodeId);
    }

    batches.push({
      index: batchIndex,
      taskIds: batchNodeIds.map((nodeId) => `task:${nodeId}`)
    });
  }

  const tasks: ExecutionTask[] = graph.nodes
    .map((node) => ({
      id: `task:${node.id}`,
      nodeId: node.id,
      title: `${node.kind}: ${node.name}`,
      kind: node.kind,
      dependsOn: [...(dependencyMap.get(node.id) ?? new Set<string>())].map((dependencyId) => `task:${dependencyId}`),
      ownerPath: node.path ?? taskOwnerPath(node),
      batchIndex: batchIndexByNodeId.get(node.id) ?? 0
    }))
    .sort((left, right) => left.batchIndex - right.batchIndex || left.title.localeCompare(right.title));

  return {
    generatedAt: new Date().toISOString(),
    tasks,
    batches,
    warnings
  };
};
