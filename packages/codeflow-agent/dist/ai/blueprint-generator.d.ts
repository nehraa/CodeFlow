/**
 * NVIDIA Llama blueprint generation for codeflow-agent.
 *
 * Uses the NVIDIA API to generate BlueprintGraph from natural language prompts.
 */
import type { BlueprintGraph } from '@abhinav2203/codeflow-core/schema';
export type { BlueprintGraph, BlueprintNode, BlueprintEdge } from '@abhinav2203/codeflow-core/schema';
export interface GenerateBlueprintOptions {
    prompt: string;
    projectName: string;
    mode?: 'essential' | 'yolo';
    nvidiaApiKey?: string;
}
export interface BlueprintGenerationResult {
    success: boolean;
    blueprint?: BlueprintGraph;
    error?: string;
}
/**
 * Generate a BlueprintGraph from a natural language prompt using NVIDIA Llama.
 */
export declare function generateBlueprint(options: GenerateBlueprintOptions): Promise<BlueprintGraph>;
//# sourceMappingURL=blueprint-generator.d.ts.map