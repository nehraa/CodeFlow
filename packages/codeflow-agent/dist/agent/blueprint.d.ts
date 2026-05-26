import type { AgentTask } from './types.js';
import type { BlueprintGraph } from '@abhinav2203/codeflow-core/schema';
export interface BlueprintOptions {
    graph: BlueprintGraph;
    workingDirectory?: string;
}
/**
 * Converts a BlueprintGraph into AgentTask[] for orchestration.
 * Each node in the blueprint becomes a task with dependencies derived from edges.
 */
export declare function blueprintToTasks(graph: BlueprintGraph): AgentTask[];
/**
 * Creates an execution context from a blueprint file.
 */
export declare function loadBlueprintFromFile(filePath: string): Promise<BlueprintGraph>;
//# sourceMappingURL=blueprint.d.ts.map