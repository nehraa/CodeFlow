/**
 * Build implementation prompts for each blueprint node.
 *
 * These prompts are used to generate code via OpenCode.
 */

import type { BlueprintGraph, BlueprintNode } from '@abhinav2203/codeflow-core/schema';

export interface NodePromptOptions {
  graph: BlueprintGraph;
  node: BlueprintNode;
  context?: {
    files?: string[];
    codeSnippets?: Array<{ path: string; content: string }>;
  };
}

export interface NodePromptResult {
  nodeId: string;
  prompt: string;
  estimatedRisk: 'low' | 'medium' | 'high';
  filePath: string | undefined;
}

/**
 * Build an implementation prompt for a single blueprint node.
 *
 * This prompt is sent to OpenCode to generate the actual code.
 */
export function buildNodePrompt(options: NodePromptOptions): string {
  const { graph, node, context } = options;

  let prompt = `Implement this blueprint node.

Project: ${graph.projectName}
Current mode: ${graph.mode}
Node id: ${node.id}
Node name: ${node.name}
Node kind: ${node.kind}
Node summary: ${node.summary}
Node signature: ${node.signature ?? "N/A"}
Target file: ${node.path ?? "N/A"}

Node contract:
${JSON.stringify(node.contract, null, 2)}

`;

  // Add context about existing files if provided
  if (context?.codeSnippets && context.codeSnippets.length > 0) {
    prompt += `\nRelevant existing code:\n`;
    for (const snippet of context.codeSnippets) {
      prompt += `\n// File: ${snippet.path}\n${snippet.content}\n`;
    }
    prompt += `\n`;
  }

  prompt += `Return ONLY valid JSON:
{
  "summary": "short description",
  "code": "full replacement code",
  "notes": ["implementation notes"]
}`;

  return prompt;
}

/**
 * Estimate the risk level of a node based on its characteristics.
 *
 * Higher risk nodes may require user approval before code generation.
 */
export function estimateNodeRisk(node: BlueprintNode): 'low' | 'medium' | 'high' {
  // High-risk indicators:
  // - API nodes (network calls, external integrations)
  // - Nodes that modify state (writes-state edges)
  // - Nodes with many dependencies

  const hasApiEdges = false; // Would need graph to determine
  const hasStateModification = node.contract.sideEffects.some(
    (se) => se.toLowerCase().includes('write') || se.toLowerCase().includes('delete')
  );
  const hasExternalDependencies = node.contract.backendAccess.length > 0;
  const isApiNode = node.kind === 'api';
  const hasManyDependencies = node.contract.dependencies.length > 3;

  if (isApiNode || hasStateModification || hasExternalDependencies) {
    return 'high';
  }
  if (hasManyDependencies || node.kind === 'class') {
    return 'medium';
  }
  return 'low';
}

/**
 * Build prompts for all nodes in a blueprint graph.
 */
export function buildAllNodePrompts(graph: BlueprintGraph): NodePromptResult[] {
  return graph.nodes.map((node) => ({
    nodeId: node.id,
    prompt: buildNodePrompt({ graph, node }),
    estimatedRisk: estimateNodeRisk(node),
    filePath: node.path,
  }));
}