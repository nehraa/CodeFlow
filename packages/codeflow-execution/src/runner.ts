import type {
  BlueprintGraph,
  ExecutionReport,
  OwnershipRecord,
  RunPlan,
  TaskExecutionResult
} from "@abhinav2203/codeflow-core";
import { getNodeStubPath, getNodeDocPath } from "./utils.js";

// Re-export runBlueprint from the main runtime module for backwards compatibility
export { runBlueprint } from "./runtime-workspace.js";

export const createExecutionReport = (graph: BlueprintGraph, runPlan: RunPlan): ExecutionReport => {
  const startedAt = new Date().toISOString();
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const ownership: OwnershipRecord[] = [];
  const results: TaskExecutionResult[] = runPlan.tasks.map((task) => {
    const node = nodeMap.get(task.nodeId);
    const outputPaths = node
      ? [getNodeDocPath(node), getNodeStubPath(node)].filter((value): value is string => Boolean(value))
      : [];
    const managedRegionIds = outputPaths.map((_, index) => `${task.id}:region:${index + 1}`);

    for (const outputPath of outputPaths) {
      ownership.push({
        path: outputPath,
        nodeId: task.nodeId,
        managedRegionIds,
        generatedAt: startedAt
      });
    }

    return {
      taskId: task.id,
      nodeId: task.nodeId,
      status: "completed" as const,
      batchIndex: task.batchIndex,
      outputPaths,
      managedRegionIds,
      message: outputPaths.length
        ? `Generated ${outputPaths.length} artifact(s) for ${task.title}.`
        : `Processed ${task.title}.`,
      errors: [],
      taskType: "code_generation" as const
    };
  });

  return {
    startedAt,
    completedAt: new Date().toISOString(),
    results,
    ownership,
    steps: [],
    artifacts: []
  };
};