import type {
  BlueprintEdge,
  BlueprintGraph,
  BlueprintNode,
  BlueprintNodeKind
} from "@/lib/blueprint/schema";

const sanitizeId = (id: string): string => {
  const cleaned = id.replace(/[^a-zA-Z0-9_]/g, "_");
  return /^[a-zA-Z]/.test(cleaned) ? cleaned : `n_${cleaned}`;
};

/**
 * Escape characters that are meaningful in Mermaid flowchart syntax so they
 * cannot break out of a node label or inject unexpected directives.
 * Covers shape delimiters, edge-label pipe, angle brackets, backticks,
 * semicolons (Mermaid directive syntax), and control characters.
 *
 * Semicolons are escaped first so that the entity references added by the
 * subsequent replacements are not themselves re-escaped.
 */
const sanitizeFlowchartLabel = (label: string): string =>
  label
    .replace(/[\r\n]/g, " ")
    .replace(/;/g, "#59;")
    .replace(/`/g, "#96;")
    .replace(/</g, "#lt;")
    .replace(/>/g, "#gt;")
    .replace(/\|/g, "#124;")
    .replace(/\[/g, "#91;")
    .replace(/\]/g, "#93;")
    .replace(/\{/g, "#123;")
    .replace(/\}/g, "#125;")
    .replace(/\(/g, "#40;")
    .replace(/\)/g, "#41;");

/**
 * Escape characters that are meaningful inside a Mermaid quoted string
 * (`class id["..."]`).  Also covers angle brackets, backticks, and
 * semicolons to prevent injection via HTML-like tags or directives.
 *
 * Semicolons are escaped first so that subsequent entity references are
 * not themselves re-escaped.
 */
const sanitizeClassLabel = (label: string): string =>
  label
    .replace(/[\r\n]/g, " ")
    .replace(/;/g, "#59;")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "#quot;")
    .replace(/`/g, "#96;")
    .replace(/</g, "#lt;")
    .replace(/>/g, "#gt;");

const nodeShape = (kind: BlueprintNodeKind, label: string): string => {
  const l = sanitizeFlowchartLabel(label);
  switch (kind) {
    case "module":
      return `[${l}]`;
    case "api":
      return `{{${l}}}`;
    case "class":
      return `[/${l}/]`;
    case "function":
      return `([${l}])`;
    case "ui-screen":
      return `>${l}]`;
  }
};

const edgeArrow = (edge: BlueprintEdge): string => {
  const arrow = edge.required ? "-->" : "-.->";
  const rawLabel = edge.label ?? edge.kind;
  const label = sanitizeFlowchartLabel(rawLabel);
  return `${sanitizeId(edge.from)} ${arrow}|${label}| ${sanitizeId(edge.to)}`;
};

export const toMermaid = (graph: BlueprintGraph): string => {
  const lines: string[] = [
    `%% Blueprint: ${graph.projectName}`,
    "graph TD"
  ];

  for (const node of graph.nodes) {
    const id = sanitizeId(node.id);
    const shape = nodeShape(node.kind, node.name);
    lines.push(`  ${id}${shape}`);
  }

  for (const edge of graph.edges) {
    lines.push(`  ${edgeArrow(edge)}`);
  }

  return lines.join("\n") + "\n";
};

const classRelArrow = (kind: BlueprintEdge["kind"]): string | null => {
  switch (kind) {
    case "inherits":
      return "<|--";
    case "calls":
      return "-->";
    case "imports":
      return "..>";
    default:
      return null;
  }
};

export const toMermaidClassDiagram = (graph: BlueprintGraph): string => {
  const relevantKinds = new Set<BlueprintNodeKind>(["class", "function"]);
  const nodeMap = new Map<string, BlueprintNode>();

  for (const node of graph.nodes) {
    if (relevantKinds.has(node.kind)) {
      nodeMap.set(node.id, node);
    }
  }

  const lines: string[] = [
    `%% Blueprint: ${graph.projectName}`,
    "classDiagram"
  ];

  for (const node of nodeMap.values()) {
    const id = sanitizeId(node.id);
    lines.push(`  class ${id}["${sanitizeClassLabel(node.name)}"]`);

    const methods = node.contract.methods;
    for (const method of methods) {
      lines.push(`  ${id} : ${method.name}()`);
    }
  }

  for (const edge of graph.edges) {
    if (!nodeMap.has(edge.from) || !nodeMap.has(edge.to)) continue;

    const arrow = classRelArrow(edge.kind);
    if (arrow === null) continue;

    const rawLabel = edge.label ?? edge.kind;
    const label = sanitizeClassLabel(rawLabel);

    // For `inherits` edges the graph stores from=child, to=parent.
    // Mermaid class diagrams expect the direction: Parent <|-- Child.
    if (edge.kind === "inherits") {
      lines.push(`  ${sanitizeId(edge.to)} ${arrow} ${sanitizeId(edge.from)} : ${label}`);
    } else {
      lines.push(`  ${sanitizeId(edge.from)} ${arrow} ${sanitizeId(edge.to)} : ${label}`);
    }
  }

  return lines.join("\n") + "\n";
};
