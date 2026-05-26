/**
 * Returns true if the node produces code artifacts (all kinds except "module").
 */
export const isCodeBearingNode = (node) => node.kind !== "module";
/**
 * Returns the relative path to the scaffold stub file for the given node,
 * or null if the node does not produce a code-bearing artifact.
 */
export const getNodeStubPath = (node) => {
    if (!isCodeBearingNode(node)) {
        return null;
    }
    const extension = node.kind === "ui-screen" ? "tsx" : "ts";
    return `stubs/${node.kind.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}-${node.name
        .replace(/[^A-Za-z0-9]+/g, "-")
        .toLowerCase()}.${extension}`;
};
/**
 * Returns the relative path to the documentation file for the given node.
 */
export const getNodeDocPath = (node) => `docs/${node.id}.md`;
/**
 * Returns the identifier that should be used when exporting this node's
 * runtime value (function name, class name, or null for other kinds).
 */
export const getNodeRuntimeExport = (node) => {
    const sanitizeIdentifier = (value) => {
        const cleaned = value
            .replace(/[^A-Za-z0-9_$]+/g, " ")
            .trim()
            .replace(/(?:^\w|[A-Z]|\b\w)/g, (chunk, index) => index === 0 ? chunk.toLowerCase() : chunk.toUpperCase())
            .replace(/\s+/g, "");
        return cleaned || "generatedNode";
    };
    if (node.kind === "function" || node.kind === "api") {
        return sanitizeIdentifier(node.name.split(".").pop() ?? node.name);
    }
    if (node.kind === "class") {
        const camel = sanitizeIdentifier(node.name);
        return camel.charAt(0).toUpperCase() + camel.slice(1);
    }
    return null;
};
