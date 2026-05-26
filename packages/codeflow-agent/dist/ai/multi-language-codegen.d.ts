/**
 * Multi-language code generation dispatcher.
 *
 * Routes scaffold generation to the correct language backend based on
 * `node.language` (defaults to "typescript"). Each language backend
 * produces a complete, compilable scaffold file content string.
 */
import type { BlueprintGraph, BlueprintNode } from "@abhinav2203/codeflow-core/schema";
/** Stub for Python nodes — produces a minimal Python module. */
export declare const generatePythonScaffold: (node: BlueprintNode) => string;
/** Stub for Go function nodes — produces a Go func with error return. */
export declare const generateGoScaffold: (node: BlueprintNode) => string;
/** Stub for Rust function nodes — produces a Rust fn with Result return. */
export declare const generateRustScaffold: (node: BlueprintNode) => string;
/**
 * Detect the target language from a node's `language` field or path extension.
 * Returns 'typescript' by default.
 */
export declare const detectTargetLanguage: (node: BlueprintNode & {
    language?: string;
}) => string;
/**
 * Generates a scaffold file for the given node in the language specified
 * by `node.language` (defaults to "typescript").
 *
 * For TypeScript nodes, delegates to `generateNodeCode` from scaffold-generator.
 * For Python / Go / Rust nodes, uses language-specific backends.
 * Returns null for non-code-bearing nodes.
 */
export declare const generateMultiLanguageCode: (node: BlueprintNode, graph: BlueprintGraph) => string | null;
//# sourceMappingURL=multi-language-codegen.d.ts.map