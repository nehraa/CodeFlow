import { getNodeStubPath, getNodeDocPath } from "./codegen.js";
// Re-export runBlueprint from the main runtime module for backwards compatibility
export { runBlueprint } from "./runtime-workspace.js";
export const createExecutionReport = (graph, runPlan) => {
    const startedAt = new Date().toISOString();
    const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
    const ownership = [];
    const results = runPlan.tasks.map((task) => {
        const node = nodeMap.get(task.nodeId);
        const outputPaths = node
            ? [getNodeDocPath(node), getNodeStubPath(node)].filter((value) => Boolean(value))
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
            status: "completed",
            batchIndex: task.batchIndex,
            outputPaths,
            managedRegionIds,
            message: outputPaths.length
                ? `Generated ${outputPaths.length} artifact(s) for ${task.title}.`
                : `Processed ${task.title}.`,
            errors: [],
            taskType: "code_generation"
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
