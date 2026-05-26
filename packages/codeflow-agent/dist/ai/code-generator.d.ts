/**
 * OpenCode code generation using the HTTP API.
 */
export interface GenerateCodeOptions {
    systemPrompt: string;
    userPrompt: string;
    timeout?: number;
}
export interface CodeGenerationResult {
    success: boolean;
    code?: string;
    summary?: string;
    notes?: string[];
    error?: string;
}
/**
 * Generate code for a blueprint node using OpenCode.
 */
export declare function generateNodeCode(options: GenerateCodeOptions): Promise<string>;
/**
 * Generate code with full result object (for more detailed responses).
 */
export declare function generateNodeCodeDetailed(options: GenerateCodeOptions): Promise<CodeGenerationResult>;
//# sourceMappingURL=code-generator.d.ts.map