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
        codeSnippets?: Array<{
            path: string;
            content: string;
        }>;
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
export declare function buildNodePrompt(options: NodePromptOptions): string;
/**
 * Estimate the risk level of a node based on its characteristics.
 *
 * Higher risk nodes may require user approval before code generation.
 */
export declare function estimateNodeRisk(node: BlueprintNode): 'low' | 'medium' | 'high';
/**
 * Build prompts for all nodes in a blueprint graph.
 */
export declare function buildAllNodePrompts(graph: BlueprintGraph): NodePromptResult[];
//# sourceMappingURL=node-prompts.d.ts.map