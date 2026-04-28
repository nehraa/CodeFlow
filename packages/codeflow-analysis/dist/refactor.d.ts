import type { BlueprintEdgeKind, BlueprintGraph, FeatureMaturity, OutputProvenance } from "@abhinav2203/codeflow-core/schema";
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
     * (only set for `broken-edge` issues where the missing ID differs from `nodeId`).
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
    provenance: OutputProvenance;
    maturity: FeatureMaturity;
    scope: "graph";
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
    provenance: OutputProvenance;
    maturity: FeatureMaturity;
    scope: "graph";
    issuesFixed: number;
    graph: BlueprintGraph;
    summary: string[];
}
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
export declare const detectDrift: (graph: BlueprintGraph) => RefactorReport;
/**
 * Auto-heal a blueprint graph based on a previously computed {@link RefactorReport}.
 *
 * Healing actions:
 * - **Broken edges** are removed.
 * - **Missing edges** are synthesised from the contract call definitions.
 * - **Signature drift** is resolved by syncing the node's top-level
 *   `signature` to match its first contract method.
 *
 * The original graph is not mutated; a new graph object is returned.
 */
export declare const healGraph: (graph: BlueprintGraph, report: RefactorReport) => HealResult;
//# sourceMappingURL=refactor.d.ts.map