import type { BlueprintNode } from "@abhinav2203/codeflow-core";

/**
 * Converts a string to a URL-safe slug, trimmed to 80 characters.
 */
export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "node";

/**
 * Returns true if the node produces code artifacts (all kinds except "module").
 */
export const isCodeBearingNode = (node: BlueprintNode): boolean => node.kind !== "module";

/**
 * Returns the relative path to the scaffold stub file for the given node,
 * or null if the node does not produce a code-bearing artifact.
 */
export const getNodeStubPath = (node: BlueprintNode): string | null => {
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
export const getNodeDocPath = (node: BlueprintNode): string => `docs/${node.id}.md`;

const sanitizeIdentifier = (value: string): string => {
  const cleaned = value
    .replace(/[^A-Za-z0-9_$]+/g, " ")
    .trim()
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (chunk, index) =>
      index === 0 ? chunk.toLowerCase() : chunk.toUpperCase()
    )
    .replace(/\s+/g, "");

  return cleaned || "generatedNode";
};

const toPascalCase = (value: string): string => {
  const camel = sanitizeIdentifier(value);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
};

/**
 * Returns the identifier that should be used when exporting this node's
 * runtime value (function name, class name, or null for other kinds).
 */
export const getNodeRuntimeExport = (node: BlueprintNode): string | null => {
  if (node.kind === "function" || node.kind === "api") {
    return sanitizeIdentifier(node.name.split(".").pop() ?? node.name);
  }

  if (node.kind === "class") {
    return toPascalCase(node.name);
  }

  return null;
};
