import type { Edge, Node } from "@xyflow/react";

import type { HeatmapData } from "@/lib/blueprint/heatmap";
import { heatColor, heatGlow } from "@/lib/blueprint/heatmap";
import type {
  BlueprintGraph,
  BlueprintNode,
  ContractField,
  GhostNode,
  MethodSpec,
  TraceStatus
} from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

export type FlowNodeData = {
  label: string;
  summary: string;
  kind: string;
  traceStatus: TraceStatus;
  selected: boolean;
  drilldownNodeId?: string;
  ghost?: boolean;
  ghostReason?: string;
};

export type InspectorSection = {
  title: string;
  items: string[];
};

export type DetailFlowItem = {
  id: string;
  label: string;
  summary: string;
  kind: string;
  signature?: string;
  path?: string;
  drilldownNodeId?: string;
  sections: InspectorSection[];
};

export type DetailFlowGraph = {
  items: DetailFlowItem[];
  nodes: Array<Node<FlowNodeData>>;
  edges: Edge[];
};

const kindOrder: Record<BlueprintNode["kind"], number> = {
  "ui-screen": 0,
  api: 1,
  module: 2,
  class: 3,
  function: 4
};

const traceColor: Record<TraceStatus, string> = {
  idle: "#f5f7ff",
  success: "#ecfdf5",
  warning: "#fffbeb",
  error: "#fef2f2"
};

const kindTheme = (
  kind: BlueprintNode["kind"],
  selected: boolean,
  traceStatus: TraceStatus
): Node<FlowNodeData>["style"] => {
  const palette: Record<BlueprintNode["kind"], { border: string; glow: string; accent: string }> = {
    "ui-screen": { border: "#7c3aed", glow: "rgba(124, 58, 237, 0.18)", accent: "#f3e8ff" },
    api: { border: "#0891b2", glow: "rgba(8, 145, 178, 0.16)", accent: "#ecfeff" },
    module: { border: "#475569", glow: "rgba(71, 85, 105, 0.12)", accent: "#f8fafc" },
    class: { border: "#2563eb", glow: "rgba(37, 99, 235, 0.15)", accent: "#eff6ff" },
    function: { border: "#0f766e", glow: "rgba(15, 118, 110, 0.16)", accent: "#ecfdf5" }
  };
  const theme = palette[kind];
  const traceRing =
    traceStatus === "error"
      ? "rgba(239, 68, 68, 0.28)"
      : traceStatus === "warning"
        ? "rgba(245, 158, 11, 0.24)"
        : traceStatus === "success"
          ? "rgba(34, 197, 94, 0.22)"
          : theme.glow;

  return {
    width: 252,
    borderRadius: 24,
    border: selected ? `2px solid ${theme.border}` : "1px solid rgba(148, 163, 184, 0.35)",
    background: `linear-gradient(180deg, rgba(255,255,255,0.96) 0%, ${theme.accent} 100%)`,
    padding: 18,
    boxShadow: selected
      ? `0 22px 44px ${traceRing}, inset 0 1px 0 rgba(255,255,255,0.95)`
      : `0 14px 34px ${theme.glow}, inset 0 1px 0 rgba(255,255,255,0.85)`,
    backdropFilter: "blur(14px)"
  };
};

const detailKindColor = (kind: string): string => {
  switch (kind) {
    case "root":
      return "#cbd5e1";
    case "blueprint-node":
      return "#bfdbfe";
    case "attribute":
      return "#fde68a";
    case "method":
      return "#bbf7d0";
    case "input":
      return "#ddd6fe";
    case "output":
      return "#fecdd3";
    case "dependency":
      return "#fed7aa";
    case "call":
      return "#bae6fd";
    case "error":
      return "#fecaca";
    case "side-effect":
      return "#fef3c7";
    case "note":
      return "#e5e7eb";
    default:
      return "#e2e8f0";
  }
};

const formatField = (field: ContractField): string =>
  `${field.name}: ${field.type}${field.description ? ` - ${field.description}` : ""}`;

const normalizeContract = (contract: Partial<BlueprintNode["contract"]>) => ({
  ...emptyContract(),
  ...contract
});

const formatMethodSummary = (method: MethodSpec): string =>
  method.signature ?? `${method.name}(${method.inputs.map((input) => input.name).join(", ")})`;

const buildNodeSections = (node: BlueprintNode): InspectorSection[] => [
  { title: "Responsibilities", items: normalizeContract(node.contract).responsibilities },
  { title: "Inputs", items: normalizeContract(node.contract).inputs.map(formatField) },
  { title: "Outputs", items: normalizeContract(node.contract).outputs.map(formatField) },
  { title: "Attributes / State", items: normalizeContract(node.contract).attributes.map(formatField) },
  {
    title: "Methods",
    items: normalizeContract(node.contract).methods.map(
      (method) => `${formatMethodSummary(method)} - ${method.summary}`
    )
  },
  { title: "Dependencies", items: normalizeContract(node.contract).dependencies },
  {
    title: "Calls",
    items: normalizeContract(node.contract).calls.map(
      (call) => `${call.target}${call.kind ? ` [${call.kind}]` : ""}${call.description ? ` - ${call.description}` : ""}`
    )
  },
  { title: "Side effects", items: normalizeContract(node.contract).sideEffects },
  { title: "Errors", items: normalizeContract(node.contract).errors },
  { title: "Notes", items: normalizeContract(node.contract).notes }
].filter((section) => section.items.length > 0);

export const buildFlowNodes = (
  graph: BlueprintGraph,
  selectedNodeId?: string,
  heatmapData?: HeatmapData
): Array<Node<FlowNodeData>> => {
  const rowCounts = new Map<number, number>();
  const heatMetricByNodeId =
    heatmapData?.nodes != null
      ? new Map(heatmapData.nodes.map((m) => [m.nodeId, m] as const))
      : undefined;

  return graph.nodes.map((node) => {
    const column = kindOrder[node.kind];
    const row = rowCounts.get(column) ?? 0;
    rowCounts.set(column, row + 1);

    const traceStatus = node.traceState?.status ?? "idle";
    const heatMetric = heatMetricByNodeId?.get(node.id);
    const intensity = heatMetric?.heatIntensity ?? 0;

    const baseStyle = kindTheme(node.kind, selectedNodeId === node.id, traceStatus);
    const baseBoxShadow = baseStyle?.boxShadow;
    const combinedBoxShadow =
      baseBoxShadow && baseBoxShadow !== "none"
        ? `${heatGlow(intensity)}, ${String(baseBoxShadow)}`
        : heatGlow(intensity);
    const baseBackground = baseStyle?.background;
    const heatBackground = `linear-gradient(180deg, ${heatColor(intensity)} 0%, transparent 100%)`;

    const heatStyle: Node<FlowNodeData>["style"] =
      intensity > 0
        ? {
            ...baseStyle,
            // Layer the heat gradient over the existing background to avoid nested gradients.
            background: baseBackground
              ? `${heatBackground}, ${String(baseBackground)}`
              : heatBackground,
            boxShadow: combinedBoxShadow,
            outline:
              intensity > 0.66
                ? `2px solid rgba(239,68,68,${(0.3 + intensity * 0.5).toFixed(2)})`
                : intensity > 0.33
                  ? `2px solid rgba(245,158,11,${(0.2 + intensity * 0.4).toFixed(2)})`
                  : undefined
          }
        : baseStyle;

    return {
      id: node.id,
      position: {
        x: 80 + column * 280,
        y: 80 + row * 180
      },
      data: {
        label: node.name,
        summary: node.summary,
        kind: node.kind,
        traceStatus,
        selected: selectedNodeId === node.id
      },
      style: heatStyle,
      className:
        intensity > 0.66
          ? "node-pulse-hot"
          : intensity > 0.33
            ? "node-pulse-warm"
            : traceStatus !== "idle"
              ? "node-pulse-active"
              : undefined
    };
  });
};

export const buildFlowEdges = (graph: BlueprintGraph): Edge[] =>
  graph.edges.map((edge) => ({
    id: `${edge.kind}:${edge.from}:${edge.to}`,
    source: edge.from,
    target: edge.to,
    label: edge.label ?? edge.kind,
    animated: edge.kind === "calls",
    style: {
      strokeWidth: edge.required ? 2.4 : 1.4,
      stroke: edge.kind === "calls" ? "#0f766e" : "#64748b"
    }
  }));

export const buildGhostFlowNodes = (
  ghostNodes: GhostNode[],
  existingNodes: Array<Node<FlowNodeData>>
): Array<Node<FlowNodeData>> => {
  // Place ghost nodes offset from the rightmost existing node column so they
  // are visually distinct and don't overlap regular nodes.
  const maxX = existingNodes.reduce((acc, n) => Math.max(acc, (n.position?.x ?? 0) + 280), 80);
  const column = maxX;

  return ghostNodes.map((ghost, index) => ({
    id: ghost.id,
    position: {
      x: column,
      y: 80 + index * 180
    },
    data: {
      label: ghost.name,
      summary: ghost.summary,
      kind: ghost.kind,
      traceStatus: "idle" as TraceStatus,
      selected: false,
      ghost: true,
      ghostReason: ghost.reason
    },
    style: {
      width: 252,
      borderRadius: 24,
      border: "1.5px dashed rgba(139, 92, 246, 0.55)",
      background: "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(237,233,254,0.45) 100%)",
      padding: 18,
      boxShadow: "0 8px 24px rgba(139, 92, 246, 0.12)",
      backdropFilter: "blur(10px)",
      opacity: 0.72,
      cursor: "pointer"
    }
  }));
};

const createDetailNode = (
  item: DetailFlowItem,
  position: { x: number; y: number },
  selectedId?: string
): Node<FlowNodeData> => ({
  id: item.id,
  position,
  data: {
    label: item.label,
    summary: item.summary,
    kind: item.kind,
    traceStatus: "idle",
    selected: selectedId === item.id,
    drilldownNodeId: item.drilldownNodeId
  },
  style: {
    width: 240,
    borderRadius: 22,
    border: selectedId === item.id ? "2px solid #0f172a" : "1px solid rgba(148, 163, 184, 0.35)",
    background: `linear-gradient(180deg, rgba(255,255,255,0.97) 0%, ${detailKindColor(item.kind)} 100%)`,
    padding: 16,
    boxShadow: "0 16px 32px rgba(15, 23, 42, 0.10)"
  }
});

export const buildDetailFlow = (
  graph: BlueprintGraph,
  rootNodeId: string,
  selectedItemId?: string
): DetailFlowGraph | null => {
  const rootNode = graph.nodes.find((node) => node.id === rootNodeId);
  if (!rootNode) {
    return null;
  }
  const rootContract = normalizeContract(rootNode.contract);

  const items: DetailFlowItem[] = [];
  const edges: Edge[] = [];
  const itemIdsByBlueprintNodeId = new Map<string, string>();
  const rootItemId = `detail:root:${rootNode.id}`;

  items.push({
    id: rootItemId,
    label: rootNode.name,
    summary: rootNode.summary,
    kind: "root",
    signature: rootNode.signature,
    path: rootNode.path,
    sections: buildNodeSections(rootNode)
  });
  itemIdsByBlueprintNodeId.set(rootNode.id, rootItemId);

  const ownedNodes = graph.nodes.filter((node) => node.ownerId === rootNode.id);

  for (const ownedNode of ownedNodes) {
    const itemId = `detail:blueprint:${ownedNode.id}`;
    items.push({
      id: itemId,
      label: ownedNode.name,
      summary: ownedNode.summary,
      kind: "blueprint-node",
      signature: ownedNode.signature,
      path: ownedNode.path,
      drilldownNodeId: ownedNode.id,
      sections: buildNodeSections(ownedNode)
    });
    itemIdsByBlueprintNodeId.set(ownedNode.id, itemId);
    edges.push({
      id: `${rootItemId}:contains:${itemId}`,
      source: rootItemId,
      target: itemId,
      label: "contains"
    });
  }

  for (const edge of graph.edges) {
    const source = itemIdsByBlueprintNodeId.get(edge.from);
    const target = itemIdsByBlueprintNodeId.get(edge.to);

    if (!source || !target || source === target) {
      continue;
    }

    edges.push({
      id: `detail:${edge.kind}:${source}:${target}`,
      source,
      target,
      label: edge.label ?? edge.kind,
      animated: edge.kind === "calls",
      style: {
        strokeWidth: edge.required ? 2 : 1
      }
    });
  }

  const addSatelliteItems = (
    kind: DetailFlowItem["kind"],
    values: string[],
    relation: string
  ) => {
    values.forEach((value, index) => {
      const itemId = `detail:${kind}:${rootNode.id}:${index}`;
      items.push({
        id: itemId,
        label: value.split(" - ")[0] ?? value,
        summary: value,
        kind,
        sections: [{ title: "Details", items: [value] }]
      });
      edges.push({
        id: `${rootItemId}:${relation}:${itemId}`,
        source: rootItemId,
        target: itemId,
        label: relation
      });
    });
  };

  if (rootContract.attributes.length) {
    addSatelliteItems("attribute", rootContract.attributes.map(formatField), "state");
  }

  if (ownedNodes.length === 0 && rootContract.methods.length) {
    rootContract.methods.forEach((method, index) => {
      const itemId = `detail:method:${rootNode.id}:${index}`;
      items.push({
        id: itemId,
        label: method.name,
        summary: method.summary,
        kind: "method",
        signature: method.signature,
        sections: [
          { title: "Inputs", items: method.inputs.map(formatField) },
          { title: "Outputs", items: method.outputs.map(formatField) },
          { title: "Side effects", items: method.sideEffects },
          {
            title: "Calls",
            items: method.calls.map(
              (call) => `${call.target}${call.kind ? ` [${call.kind}]` : ""}${call.description ? ` - ${call.description}` : ""}`
            )
          }
        ].filter((section) => section.items.length > 0)
      });
      edges.push({
        id: `${rootItemId}:method:${itemId}`,
        source: rootItemId,
        target: itemId,
        label: "method"
      });
    });
  }

  addSatelliteItems("input", rootContract.inputs.map(formatField), "accepts");
  addSatelliteItems("output", rootContract.outputs.map(formatField), "returns");
  addSatelliteItems("dependency", rootContract.dependencies, "depends on");
  addSatelliteItems(
    "call",
    rootContract.calls.map(
      (call) => `${call.target}${call.kind ? ` [${call.kind}]` : ""}${call.description ? ` - ${call.description}` : ""}`
    ),
    "calls"
  );
  addSatelliteItems("error", rootContract.errors, "may fail");
  addSatelliteItems("side-effect", rootContract.sideEffects, "changes");
  addSatelliteItems("note", rootContract.notes, "notes");

  const buckets: Record<string, DetailFlowItem[]> = {
    root: items.filter((item) => item.kind === "root"),
    "blueprint-node": items.filter((item) => item.kind === "blueprint-node"),
    method: items.filter((item) => item.kind === "method"),
    attribute: items.filter((item) => item.kind === "attribute"),
    input: items.filter((item) => item.kind === "input"),
    output: items.filter((item) => item.kind === "output"),
    dependency: items.filter((item) => item.kind === "dependency"),
    call: items.filter((item) => item.kind === "call"),
    error: items.filter((item) => item.kind === "error"),
    "side-effect": items.filter((item) => item.kind === "side-effect"),
    note: items.filter((item) => item.kind === "note")
  };

  const positions = new Map<string, { x: number; y: number }>();
  const layout = (
    kind: keyof typeof buckets,
    column: number,
    startY: number,
    gapY: number
  ) => {
    buckets[kind].forEach((item, index) => {
      positions.set(item.id, {
        x: 80 + column * 280,
        y: startY + index * gapY
      });
    });
  };

  layout("root", 1, 160, 160);
  layout("blueprint-node", 2, 80, 160);
  layout("method", 2, 80 + buckets["blueprint-node"].length * 170, 160);
  layout("attribute", 0, 80, 130);
  layout("input", 0, 320, 120);
  layout("output", 3, 80, 120);
  layout("dependency", 3, 260, 120);
  layout("call", 3, 440, 120);
  layout("error", 0, 520, 120);
  layout("side-effect", 2, 420, 120);
  layout("note", 1, 420, 120);

  return {
    items,
    edges,
    nodes: items.map((item) => createDetailNode(item, positions.get(item.id) ?? { x: 80, y: 80 }, selectedItemId))
  };
};
