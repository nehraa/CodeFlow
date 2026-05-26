import type { BlueprintNode } from "@abhinav2203/codeflow-core/schema";
/**
 * Navigate from a graph node to its source location in the editor.
 * This is the critical link between the graph view and Monaco editor.
 */
export interface NavigationTarget {
    filePath: string;
    lineNumber: number;
    endLineNumber?: number;
    columnStart?: number;
    columnEnd?: number;
    symbolName?: string;
}
/**
 * Extract navigation target from a blueprint node.
 * Returns null if no source location is available.
 */
export declare function getNavigationTarget(node: BlueprintNode): NavigationTarget | null;
/**
 * Check if a node has navigation metadata available.
 */
export declare function hasNavigationMetadata(node: BlueprintNode): boolean;
/**
 * Get all nodes that have navigation metadata from a node list.
 */
export declare function getNodesWithNavigation(nodes: BlueprintNode[]): BlueprintNode[];
/**
 * Format a navigation target for display/logging.
 */
export declare function formatNavigationTarget(target: NavigationTarget): string;
/**
 * Validate that a navigation target points to a valid location.
 * Returns false if the target has invalid or missing data.
 */
export declare function isValidNavigationTarget(target: NavigationTarget | null): target is NavigationTarget;
//# sourceMappingURL=node-navigation.d.ts.map