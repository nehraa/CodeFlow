import type { AgentTask } from './types.js';
import type { BlueprintGraph } from '@abhinav2203/codeflow-core/schema';

export interface BlueprintOptions {
  graph: BlueprintGraph;
  workingDirectory?: string;
}

/**
 * Infers the agent type based on the blueprint node type.
 */
function inferAgentType(nodeType: string): AgentTask['agentType'] {
  // nodeType in BlueprintGraph refers to 'kind' which is a nodeKindSchema value
  // The schema has: "module", "api", "class", "function", "ui-screen"
  // We map these to agent types
  switch (nodeType) {
    case 'function':
    case 'class':
    case 'module':
      return 'coder';
    case 'api':
      return 'planner';
    case 'ui-screen':
      return 'coder';
    default:
      return 'coder';
  }
}

/**
 * Infers the skills based on the blueprint node type.
 */
function inferSkills(nodeType: string): string[] {
  switch (nodeType) {
    case 'function':
    case 'class':
    case 'module':
      return ['superpowers:subagent-driven-development'];
    case 'api':
      return ['superpowers:executing-plans'];
    case 'ui-screen':
      return ['superpowers:subagent-driven-development'];
    default:
      return [];
  }
}

/**
 * Converts a BlueprintGraph into AgentTask[] for orchestration.
 * Each node in the blueprint becomes a task with dependencies derived from edges.
 */
export function blueprintToTasks(graph: BlueprintGraph): AgentTask[] {
  return graph.nodes.map((node) => {
    // Derive dependsOn from edges that point TO this node
    const dependsOn = graph.edges
      .filter((e) => e.to === node.id)
      .map((e) => e.from);

    return {
      id: node.id,
      name: node.name || node.id,
      description: node.summary || `Execute ${node.kind} node: ${node.id}`,
      files: node.path ? [node.path] : [],
      verify: 'echo "no verify command"',
      done: `Node ${node.id} completed`,
      dependsOn,
      agentType: inferAgentType(node.kind),
      skills: inferSkills(node.kind),
    };
  });
}

/**
 * Creates an execution context from a blueprint file.
 */
export async function loadBlueprintFromFile(filePath: string): Promise<BlueprintGraph> {
  const { readFile } = await import('node:fs/promises');
  const content = await readFile(filePath, 'utf-8');
  const parsed = JSON.parse(content);

  // Validate it's a proper BlueprintGraph
  if (!parsed.projectName || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error(`Invalid BlueprintGraph: missing projectName, nodes, or edges`);
  }

  return parsed as BlueprintGraph;
}