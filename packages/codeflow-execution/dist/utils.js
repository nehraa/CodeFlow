export const slugify = (value) => value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "node";
export const isCodeBearingNode = (node) => node.kind !== "module";
export const getNodeStubPath = (node) => {
    if (!isCodeBearingNode(node)) {
        return null;
    }
    const extension = node.kind === "ui-screen" ? "tsx" : "ts";
    return `stubs/${node.kind.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}-${node.name
        .replace(/[^A-Za-z0-9]+/g, "-")
        .toLowerCase()}.${extension}`;
};
export const getNodeDocPath = (node) => `docs/${node.id}.md`;
const sanitizeIdentifier = (value) => {
    const cleaned = value
        .replace(/[^A-Za-z0-9_$]+/g, " ")
        .trim()
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (chunk, index) => index === 0 ? chunk.toLowerCase() : chunk.toUpperCase())
        .replace(/\s+/g, "");
    return cleaned || "generatedNode";
};
export const getNodeRuntimeExport = (node) => {
    if (node.kind === "function" || node.kind === "api") {
        return sanitizeIdentifier(node.name.split(".").pop() ?? node.name);
    }
    if (node.kind === "class") {
        const camel = sanitizeIdentifier(node.name);
        return camel.charAt(0).toUpperCase() + camel.slice(1);
    }
    return null;
};
