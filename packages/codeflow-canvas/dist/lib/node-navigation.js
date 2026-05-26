/**
 * Extract navigation target from a blueprint node.
 * Returns null if no source location is available.
 */
export function getNavigationTarget(node) {
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
export function hasNavigationMetadata(node) {
    return node.sourceLocation !== undefined;
}
/**
 * Get all nodes that have navigation metadata from a node list.
 */
export function getNodesWithNavigation(nodes) {
    return nodes.filter(hasNavigationMetadata);
}
/**
 * Format a navigation target for display/logging.
 */
export function formatNavigationTarget(target) {
    const { filePath, lineNumber, symbolName } = target;
    const symbol = symbolName ? ` (${symbolName})` : "";
    return `${filePath}:${lineNumber}${symbol}`;
}
/**
 * Validate that a navigation target points to a valid location.
 * Returns false if the target has invalid or missing data.
 */
export function isValidNavigationTarget(target) {
    if (!target)
        return false;
    if (!target.filePath)
        return false;
    if (!target.lineNumber || target.lineNumber < 1)
        return false;
    return true;
}
//# sourceMappingURL=node-navigation.js.map