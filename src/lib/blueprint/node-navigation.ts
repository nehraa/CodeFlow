import type { BlueprintNode, SourceLocation } from "./schema";

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
export function getNavigationTarget(node: BlueprintNode): NavigationTarget | null {
  const location = node.sourceLocation;

  if (!location) {
    return null;
  }

  return {
    filePath: location.filePath,
    lineNumber: location.startLine,
    endLineNumber: location.endLine,
    columnStart: location.startColumn,
    columnEnd: location.endColumn,
    symbolName: location.symbolName
  };
}

/**
 * Check if a node has navigation metadata available.
 */
export function hasNavigationMetadata(node: BlueprintNode): boolean {
  return node.sourceLocation !== undefined;
}

/**
 * Get all nodes that have navigation metadata from a node list.
 */
export function getNodesWithNavigation(nodes: BlueprintNode[]): BlueprintNode[] {
  return nodes.filter(hasNavigationMetadata);
}

/**
 * Format a navigation target for display/logging.
 */
export function formatNavigationTarget(target: NavigationTarget): string {
  const { filePath, lineNumber, symbolName } = target;
  const symbol = symbolName ? ` (${symbolName})` : "";
  return `${filePath}:${lineNumber}${symbol}`;
}

/**
 * Validate that a navigation target points to a valid location.
 * Returns false if the target has invalid or missing data.
 */
export function isValidNavigationTarget(target: NavigationTarget | null): target is NavigationTarget {
  if (!target) return false;
  if (!target.filePath) return false;
  if (!target.lineNumber || target.lineNumber < 1) return false;
  return true;
}