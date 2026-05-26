/**
 * Documentation and OpenAPI spec generation from blueprint contracts.
 *
 * Produces:
 * - Markdown API reference / READMEs for each node
 * - OpenAPI 3.0 YAML spec block for `api` kind nodes
 */
import type { BlueprintNode } from '@abhinav2203/codeflow-core';
/**
 * Generate a Markdown document for a single blueprint node.
 */
export declare const generateNodeMarkdown: (node: BlueprintNode) => string | null;
/**
 * Generate an OpenAPI 3.0 YAML fragment for a single `api` kind node.
 * Returns null for non-api nodes.
 */
export declare const generateOpenApiSpec: (node: BlueprintNode) => string | null;
/** Alias for generateNodeMarkdown */
export declare const generateNodeDocumentation: (node: BlueprintNode) => string | null;
/** Alias for generateNodeMarkdown */
export declare const generateMarkdownDocs: (node: BlueprintNode) => string | null;
//# sourceMappingURL=doc-generator.d.ts.map