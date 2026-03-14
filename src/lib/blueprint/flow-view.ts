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

export type NodeHealthState = "neutral" | "aligned" | "drift" | "heal" | "ghost";

export type FlowNodeData = {
  label: string;
  summary: string;
  kind: string;
  traceStatus: TraceStatus;
  healthState: NodeHealthState;
  selected: boolean;
  isActiveBatch: boolean;
  isGhost: boolean;
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

const kindTheme = (
  kind: BlueprintNode["kind"],
  selected: boolean,
  traceStatus: TraceStatus
): Node<FlowNodeData>["style"] => {
  const palette: Record<BlueprintNode["kind"], { border: string; glow: string; accent: string }> = {
    "ui-screen": {
      border: "var(--node-ui-border)",
      glow: "var(--node-ui-glow)",
      accent: "var(--node-ui-bg)"
    },
    api: {
      border: "var(--node-api-border)",
      glow: "var(--node-api-glow)",
      accent: "var(--node-api-bg)"
    },
    module: {
      border: "var(--node-module-border)",
      glow: "var(--node-module-glow)",
      accent: "var(--node-module-bg)"
    },
    class: {
      border: "var(--node-class-border)",
      glow: "var(--node-class-glow)",
      accent: "var(--node-class-bg)"
    },
    function: {
      border: "var(--node-function-border)",
      glow: "var(--node-function-glow)",
      accent: "var(--node-function-bg)"
    }
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
    borderRadius: 26,
    border: selected ? `1.5px solid ${theme.border}` : "1px solid var(--node-border-default)",
    background: `linear-gradient(180deg, var(--surface-raised) 0%, ${theme.accent} 100%)`,
    padding: 14,
    boxShadow: selected
      ? `0 24px 56px ${traceRing}, inset 0 1px 0 var(--node-inner-shine)`
      : `0 16px 38px ${theme.glow}, inset 0 1px 0 var(--node-inner-shine)`,
    backdropFilter: "blur(14px)"
  };
};

const detailKindColor = (kind: string): string => {
  switch (kind) {
    case "root":
      return "var(--node-module-bg)";
    case "blueprint-node":
      return "var(--node-class-bg)";
    case "attribute":
      return "rgba(250, 204, 21, 0.18)";
    case "method":
      return "rgba(52, 211, 153, 0.16)";
    case "input":
      return "rgba(129, 140, 248, 0.18)";
    case "output":
      return "rgba(251, 113, 133, 0.16)";
    case "dependency":
      return "rgba(251, 146, 60, 0.16)";
    case "call":
      return "rgba(56, 189, 248, 0.16)";
    case "error":
      return "rgba(248, 113, 113, 0.16)";
    case "side-effect":
      return "rgba(250, 204, 21, 0.12)";
    case "note":
      return "rgba(148, 163, 184, 0.16)";
    default:
      return "rgba(148, 163, 184, 0.16)";
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

const mergeBoxShadow = (nextShadow: string, existingShadow?: string) =>
  existingShadow && existingShadow !== "none" ? `${nextShadow}, ${existingShadow}` : nextShadow;

const resolveNodeHealthState = (node: BlueprintNode, traceStatus: TraceStatus): NodeHealthState => {
  const isGhost =
    (node.status ?? "spec_only") === "spec_only" &&
    !node.sourceRefs.length &&
    !node.generatedRefs.length &&
    !node.traceRefs.length &&
    !node.implementationDraft;

  if (traceStatus === "error" || node.lastVerification?.status === "failure") {
    return "heal";
  }

  if (node.status === "verified" || node.status === "connected") {
    return "aligned";
  }

  if (node.status === "implemented" || Boolean(node.implementationDraft)) {
    return "drift";
  }

  if (isGhost && traceStatus === "idle") {
    return "ghost";
  }

  return "neutral";
};

const applyNodeStateStyles = (
  baseStyle: Node<FlowNodeData>["style"],
  options: {
    healthState: NodeHealthState;
    isActiveBatch: boolean;
    isGhost: boolean;
  }
): Node<FlowNodeData>["style"] => {
  const style = { ...baseStyle };

  if (options.healthState === "aligned") {
    style.boxShadow = mergeBoxShadow("0 0 0 1px rgba(34, 197, 94, 0.32), 0 0 30px rgba(34, 197, 94, 0.22)", style.boxShadow);
  }

  if (options.healthState === "drift") {
    style.boxShadow = mergeBoxShadow("0 0 0 1px rgba(245, 158, 11, 0.34), 0 0 28px rgba(245, 158, 11, 0.18)", style.boxShadow);
  }

  if (options.healthState === "heal") {
    style.boxShadow = mergeBoxShadow("0 0 0 1px rgba(239, 68, 68, 0.38), 0 0 32px rgba(239, 68, 68, 0.24)", style.boxShadow);
  }

  if (options.isActiveBatch) {
    style.boxShadow = mergeBoxShadow("0 0 0 2px rgba(103, 226, 219, 0.42), 0 0 38px rgba(103, 226, 219, 0.24)", style.boxShadow);
  }

  if (options.isGhost) {
    style.borderStyle = "dashed";
    style.opacity = 0.72;
  }

  return style;
};

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
  heatmapData?: HeatmapData,
  activeNodeIds?: string[],
  driftedNodeIds?: string[]
): Array<Node<FlowNodeData>> => {
  const rowCounts = new Map<number, number>();
  const heatMetricByNodeId =
    heatmapData?.nodes != null
      ? new Map(heatmapData.nodes.map((m) => [m.nodeId, m] as const))
      : undefined;
  const activeNodeIdSet = new Set(activeNodeIds ?? []);
  const driftedNodeIdSet = new Set(driftedNodeIds ?? []);

  return graph.nodes.map((node) => {
    const column = kindOrder[node.kind];
    const row = rowCounts.get(column) ?? 0;
    rowCounts.set(column, row + 1);

    const traceStatus = node.traceState?.status ?? "idle";
    const heatMetric = heatMetricByNodeId?.get(node.id);
    const intensity = heatMetric?.heatIntensity ?? 0;
    const isActiveBatch = activeNodeIdSet.has(node.id);
    const isDrifted = driftedNodeIdSet.has(node.id);
    // Drifted nodes are forced to the "heal" health state so they render with
    // the red highlight that signals the architecture needs attention.
    const healthState = isDrifted ? "heal" : resolveNodeHealthState(node, traceStatus);
    const isGhost = healthState === "ghost";

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
    const stateStyle = applyNodeStateStyles(heatStyle, {
      healthState,
      isActiveBatch,
      isGhost
    });

    return {
      id: node.id,
      type: "policyNode",
      position: {
        x: 80 + column * 280,
        y: 80 + row * 180
      },
      data: {
        label: node.name,
        summary: node.summary,
        kind: node.kind,
        traceStatus,
        healthState,
        selected: selectedNodeId === node.id,
        isActiveBatch,
        isGhost
      },
      style: stateStyle,
      className: [
        intensity > 0.66
          ? "node-pulse-hot"
          : intensity > 0.33
            ? "node-pulse-warm"
            : traceStatus !== "idle"
              ? "node-pulse-active"
              : undefined,
        healthState === "aligned" ? "node-health-aligned" : undefined,
        healthState === "drift" ? "node-health-drift" : undefined,
        healthState === "heal" ? "node-health-heal" : undefined,
        isGhost ? "node-ghost" : undefined,
        isActiveBatch ? "node-batch-focus" : undefined,
        isDrifted ? "node-drift-shake" : undefined
      ]
        .filter(Boolean)
        .join(" ")
    };
  });
};

export const buildFlowEdges = (graph: BlueprintGraph, activeNodeIds?: string[]): Edge[] => {
  const activeNodeIdSet = new Set(activeNodeIds ?? []);

  return graph.edges.map((edge) => {
    const isActive = activeNodeIdSet.has(edge.from) || activeNodeIdSet.has(edge.to);
    const shouldAnimate = isActive;

    return {
      id: `${edge.kind}:${edge.from}:${edge.to}`,
      source: edge.from,
      target: edge.to,
      label: edge.label ?? edge.kind,
      animated: shouldAnimate,
      className: isActive ? "edge-flow-active" : undefined,
      style: {
        strokeWidth: isActive ? 2.7 : edge.required ? 2.4 : 1.4,
        stroke: isActive ? "var(--flow-edge-strong)" : edge.kind === "calls" ? "var(--flow-edge-strong)" : "var(--flow-edge)"
      },
      labelStyle: {
        fill: "var(--muted)",
        fontSize: 12,
        fontWeight: 600
      }
    };
  });
};

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
  type: "policyNode",
  position,
  data: {
    label: item.label,
    summary: item.summary,
    kind: item.kind,
    traceStatus: "idle",
    healthState: "neutral",
    selected: selectedId === item.id,
    isActiveBatch: false,
    isGhost: false,
    drilldownNodeId: item.drilldownNodeId
  },
  style: {
    width: 240,
    borderRadius: 22,
    border: selectedId === item.id ? "1.5px solid var(--accent-2)" : "1px solid var(--node-border-default)",
    background: `linear-gradient(180deg, var(--surface-raised) 0%, ${detailKindColor(item.kind)} 100%)`,
    padding: 14,
    boxShadow: "0 18px 36px rgba(15, 23, 42, 0.12)"
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
