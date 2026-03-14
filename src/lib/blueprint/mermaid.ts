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

const nodeShape = (kind: BlueprintNodeKind, label: string): string => {
  switch (kind) {
    case "module":
      return `[${label}]`;
    case "api":
      return `{{${label}}}`;
    case "class":
      return `[/${label}/]`;
    case "function":
      return `([${label}])`;
    case "ui-screen":
      return `>${label}]`;
  }
};

const edgeArrow = (edge: BlueprintEdge): string => {
  const arrow = edge.required ? "-->" : "-.->";
  const label = edge.label ?? edge.kind;
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
    lines.push(`  class ${id}["${node.name}"]`);

    const methods = node.contract.methods;
    for (const method of methods) {
      lines.push(`  ${id} : ${method.name}()`);
    }
  }

  for (const edge of graph.edges) {
    if (!nodeMap.has(edge.from) || !nodeMap.has(edge.to)) continue;

    const arrow = classRelArrow(edge.kind);
    if (arrow === null) continue;

    const label = edge.label ?? edge.kind;
    lines.push(`  ${sanitizeId(edge.from)} ${arrow} ${sanitizeId(edge.to)} : ${label}`);
  }

  return lines.join("\n") + "\n";
};
