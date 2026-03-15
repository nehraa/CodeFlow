import type { BlueprintEdge, BlueprintEdgeKind, BlueprintGraph, BlueprintNode } from "@/lib/blueprint/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

/** The category of architectural drift that was detected. */
export type DriftKind = "broken-edge" | "missing-edge" | "signature-drift";

/**
 * A single detected drift issue in the architecture graph.
 *
 * - `broken-edge`     – An edge references a node ID that no longer exists.
 * - `missing-edge`    – A node's contract `calls` entry has no corresponding
 *                       graph edge to the resolved target node.
 * - `signature-drift` – The node's top-level `signature` field doesn't match
 *                       the `signature` of its first contract method.
 */
export interface DriftIssue {
  kind: DriftKind;
  /** ID of the existing node most closely associated with this issue. */
  nodeId: string;
  nodeName: string;
  description: string;
  /** Source node ID of the affected edge (present for edge-related issues). */
  edgeFrom?: string;
  /** Target node ID of the affected edge (present for edge-related issues). */
  edgeTo?: string;
  /**
   * The node ID referenced by the edge that no longer exists in the graph
   * (only set for `broken-edge` issues where the missing ID differs from
   * `nodeId`).
   */
  missingNodeId?: string;
  /**
   * For `missing-edge` issues: the edge `kind` declared in the contract call.
   * Used during healing to distinguish multiple calls between the same pair of
   * nodes with different relationship kinds (e.g. `calls` vs `reads-state`).
   */
  edgeKind?: BlueprintEdgeKind;
}

/** Summary of all drift issues detected in a graph. */
export interface RefactorReport {
  projectName: string;
  detectedAt: string;
  issues: DriftIssue[];
  /** IDs of nodes that have at least one drift issue. */
  driftedNodeIds: string[];
  totalIssues: number;
  /** `true` when no drift was found. */
  isHealthy: boolean;
}

/** Result of a heal operation that auto-fixed drift issues. */
export interface HealResult {
  projectName: string;
  healedAt: string;
  issuesFixed: number;
  graph: BlueprintGraph;
  summary: string[];
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const buildNodeIndex = (graph: BlueprintGraph): Map<string, BlueprintNode> =>
  new Map(graph.nodes.map((n) => [n.id, n]));

/**
 * Resolve a contract call `target` (which may be a node ID or node name) to
 * the matching blueprint node.
 */
const resolveCallTarget = (
  graph: BlueprintGraph,
  target: string
): BlueprintNode | undefined => {
  const byId = graph.nodes.find((n) => n.id === target);
  if (byId) return byId;

  return graph.nodes.find((n) => n.name === target);
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Detect architectural drift in a blueprint graph.
 *
 * Three kinds of drift are checked:
 * 1. **Broken edges** – an edge's `from` or `to` points to a node ID that no
 *    longer exists in the graph.
 * 2. **Missing edges** – a node's contract `calls` entry references a target
 *    that exists in the graph but has no corresponding edge.
 * 3. **Signature drift** – the node's top-level `signature` field doesn't
 *    match the `signature` of its first contract method.
 */
export const detectDrift = (graph: BlueprintGraph): RefactorReport => {
  const issues: DriftIssue[] = [];
  const index = buildNodeIndex(graph);

  // ── 1. Broken edges ────────────────────────────────────────────────────────
  for (const edge of graph.edges) {
    if (!index.has(edge.from)) {
      // The source node is missing; anchor the issue on the existing target.
      const existingNode = index.get(edge.to);
      issues.push({
        kind: "broken-edge",
        nodeId: existingNode?.id ?? edge.to,
        nodeName: existingNode?.name ?? edge.to,
        description: `Edge "${edge.from}" → "${edge.to}" references a non-existent source node.`,
        edgeFrom: edge.from,
        edgeTo: edge.to,
        missingNodeId: edge.from
      });
    }

    if (!index.has(edge.to)) {
      // The target node is missing; anchor the issue on the existing source.
      const existingNode = index.get(edge.from);
      issues.push({
        kind: "broken-edge",
        nodeId: existingNode?.id ?? edge.from,
        nodeName: existingNode?.name ?? edge.from,
        description: `Edge "${edge.from}" → "${edge.to}" references a non-existent target node.`,
        edgeFrom: edge.from,
        edgeTo: edge.to,
        missingNodeId: edge.to
      });
    }
  }

  // ── 2. Missing edges + signature drift ────────────────────────────────────
  for (const node of graph.nodes) {
    // Signature drift: top-level signature doesn't match the first method's.
    const firstMethod = node.contract.methods?.[0];
    if (
      node.signature &&
      firstMethod?.signature &&
      node.signature !== firstMethod.signature
    ) {
      issues.push({
        kind: "signature-drift",
        nodeId: node.id,
        nodeName: node.name,
        description: `Node "${node.name}" signature "${node.signature}" does not match contract method "${firstMethod.signature}".`
      });
    }

    // Missing edges: contract calls with no corresponding graph edge.
    for (const call of node.contract.calls ?? []) {
      const targetNode = resolveCallTarget(graph, call.target);
      if (!targetNode) continue; // target not in graph – not our responsibility here

      const edgeKind = call.kind ?? "calls";
      const edgeExists = graph.edges.some(
        (e) => e.from === node.id && e.to === targetNode.id && e.kind === edgeKind
      );

      if (!edgeExists) {
        issues.push({
          kind: "missing-edge",
          nodeId: node.id,
          nodeName: node.name,
          description: `Node "${node.name}" declares a "${edgeKind}" call to "${call.target}" in its contract but no graph edge exists.`,
          edgeFrom: node.id,
          edgeTo: targetNode.id,
          edgeKind
        });
      }
    }
  }

  const driftedNodeIds = [...new Set(issues.map((i) => i.nodeId))];

  return {
    projectName: graph.projectName,
    detectedAt: new Date().toISOString(),
    issues,
    driftedNodeIds,
    totalIssues: issues.length,
    isHealthy: issues.length === 0
  };
};

/**
 * Auto-heal a blueprint graph based on a previously computed
 * {@link RefactorReport}.
 *
 * Healing actions:
 * - **Broken edges** are removed.
 * - **Missing edges** are synthesised from the contract call definitions.
 * - **Signature drift** is resolved by syncing the node's top-level
 *   `signature` to match its first contract method.
 *
 * The original graph is not mutated; a new graph object is returned.
 */
export const healGraph = (
  graph: BlueprintGraph,
  report: RefactorReport
): HealResult => {
  const index = buildNodeIndex(graph);
  const summary: string[] = [];
  let issuesFixed = 0;

  // ── Remove broken edges ───────────────────────────────────────────────────
  const healedEdges = graph.edges.filter((edge) => {
    if (!index.has(edge.from) || !index.has(edge.to)) {
      summary.push(`Removed broken edge: ${edge.from} → ${edge.to}`);
      issuesFixed++;
      return false;
    }
    return true;
  });

  // ── Synthesise missing edges ──────────────────────────────────────────────
  const newEdges: BlueprintEdge[] = [];

  const missingEdgeIssues = report.issues.filter((i) => i.kind === "missing-edge");

  for (const issue of missingEdgeIssues) {
    if (!issue.edgeFrom || !issue.edgeTo) continue;

    // Avoid duplicate new edges (two issues might point at the same triplet).
    const issueEdgeKind = issue.edgeKind ?? "calls";
    const alreadyAdded = newEdges.some(
      (e) => e.from === issue.edgeFrom && e.to === issue.edgeTo && e.kind === issueEdgeKind
    );
    if (alreadyAdded) continue;

    // Find the original contract call to preserve kind/label.  Match on both
    // target node ID and kind so that multiple calls between the same pair with
    // different kinds each resolve to their own contract entry.
    const fromNode = index.get(issue.edgeFrom);
    const call = fromNode?.contract.calls?.find((c) => {
      const target = resolveCallTarget(graph, c.target);
      return target?.id === issue.edgeTo && (c.kind ?? "calls") === issueEdgeKind;
    });

    newEdges.push({
      from: issue.edgeFrom,
      to: issue.edgeTo,
      kind: issueEdgeKind,
      required: false,
      confidence: 0.8,
      label: call?.description
    });

    const fromName = fromNode?.name ?? issue.edgeFrom;
    const toName = index.get(issue.edgeTo)?.name ?? issue.edgeTo;
    summary.push(`Added missing edge: ${fromName} → ${toName}`);
    issuesFixed++;
  }

  // ── Fix signature drift ────────────────────────────────────────────────────
  const healedNodes = graph.nodes.map((node) => {
    const hasDrift = report.issues.some(
      (i) => i.kind === "signature-drift" && i.nodeId === node.id
    );
    if (!hasDrift) return node;

    const firstMethod = node.contract.methods?.[0];
    if (!firstMethod?.signature) return node;

    summary.push(
      `Synced signature for "${node.name}": "${node.signature}" → "${firstMethod.signature}"`
    );
    issuesFixed++;

    return { ...node, signature: firstMethod.signature };
  });

  return {
    projectName: graph.projectName,
    healedAt: new Date().toISOString(),
    issuesFixed,
    graph: {
      ...graph,
      nodes: healedNodes,
      edges: [...healedEdges, ...newEdges]
    },
    summary
  };
};
