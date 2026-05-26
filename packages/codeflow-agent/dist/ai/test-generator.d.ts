/**
 * Test content generation from blueprint contracts.
 *
 * Generates test scaffolding for multiple languages and frameworks:
 * - TypeScript/Jest, Python/pytest, Go/testing, Rust/cargo
 */
import type { BlueprintGraph, BlueprintNode } from '@abhinav2203/codeflow-core';
/**
 * Generate TypeScript/Jest test content.
 */
export declare const generateTypeScriptTest: (node: BlueprintNode, _testStyle: "unit" | "integration") => string;
/**
 * Generate Python/pytest test content.
 */
export declare const generatePythonPytest: (node: BlueprintNode, _testStyle: "unit" | "integration") => string;
/**
 * Generate Go test content.
 */
export declare const generateGoTest: (node: BlueprintNode, _testStyle: "unit" | "integration") => string;
/**
 * Generate Rust test content.
 */
export declare const generateRustTest: (node: BlueprintNode, _testStyle: "unit" | "integration") => string;
export interface TestGeneratorOptions {
    language: string;
    framework: string;
    testStyle: 'unit' | 'integration';
}
/**
 * Generates a complete test file content for a blueprint node.
 * Returns null for non-code-bearing nodes.
 */
export declare const generateTestContent: (node: BlueprintNode, _graph: BlueprintGraph, options?: TestGeneratorOptions) => string | null;
//# sourceMappingURL=test-generator.d.ts.map