import { v4 as uuidv4 } from "uuid";
import crypto from "node:crypto";
import { blueprintGraphSchema } from "@abhinav2203/codeflow-core/schema";
export const createBranchId = () => uuidv4();
/**
 * Snapshot the current graph into a named branch.
 * The graph is normalized through the schema so that all default values are applied.
 */
export const createBranch = ({ graph, name, description, parentBranchId }) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
        throw new Error("Branch name must not be empty.");
    }
    return {
        id: createBranchId(),
        name: trimmedName,
        description: description?.trim(),
        projectName: graph.projectName,
        parentBranchId,
        createdAt: new Date().toISOString(),
        graph: blueprintGraphSchema.parse(structuredClone(graph))
    };
};
// ── Diff helpers ────────────────────────────────────────────────────────────
const nodeKey = (node) => {
    const baseKey = `${node.kind}:${node.name}:${node.summary}:${node.path ?? ""}:${node.status ?? "spec_only"}`;
    // Include additional persisted fields so that changes to them are reflected in the diff.
    // We deliberately exclude obviously volatile data (if any is added in the future),
    // and compute a stable hash over the snapshot of relevant fields.
    const snapshot = {
        signature: node.signature ?? "",
        ownerId: node.ownerId ?? "",
        contract: node.contract ?? null
    };
    const hash = crypto
        .createHash("sha256")
        .update(JSON.stringify(snapshot))
        .digest("hex");
    return `${baseKey}:${hash}`;
};
const edgeKey = (edge) => `${edge.from}→${edge.to}:${edge.kind}`;
// Cache, per edge array, the number of incident edges for each node.
const edgeIncidenceCache = new WeakMap();
const getEdgeIncidenceMap = (edges) => {
    let incidenceMap = edgeIncidenceCache.get(edges);
    if (!incidenceMap) {
        incidenceMap = new Map();
        for (const edge of edges) {
            const fromCount = incidenceMap.get(edge.from) ?? 0;
            incidenceMap.set(edge.from, fromCount + 1);
            const toCount = incidenceMap.get(edge.to) ?? 0;
            incidenceMap.set(edge.to, toCount + 1);
        }
        edgeIncidenceCache.set(edges, incidenceMap);
    }
    return incidenceMap;
};
/**
 * Count how many edges in `edges` involve `nodeId`.
 */
const countImpactedEdges = (nodeId, edges) => {
    const incidenceMap = getEdgeIncidenceMap(edges);
    return incidenceMap.get(nodeId) ?? 0;
};
/**
 * Compare two blueprint graphs and produce a structured diff.
 *
 * `base` is treated as the "before" snapshot (origin branch).
 * `compare` is treated as the "after" snapshot (the 'what if' branch).
 */
export const diffBranches = (base, compare, baseId = "base", compareId = "compare") => {
    // Normalize both graphs so all default fields (phase, status, etc.) are populated.
    const normalizedBase = blueprintGraphSchema.parse(base);
    const normalizedCompare = blueprintGraphSchema.parse(compare);
    const baseById = new Map(normalizedBase.nodes.map((n) => [n.id, n]));
    const compareById = new Map(normalizedCompare.nodes.map((n) => [n.id, n]));
    const baseEdgeKeys = new Set(normalizedBase.edges.map(edgeKey));
    const compareEdgeKeys = new Set(normalizedCompare.edges.map(edgeKey));
    const nodeDiffs = [];
    const edgeDiffs = [];
    const impactedNodeIds = new Set();
    // Nodes present in base
    for (const [id, baseNode] of baseById) {
        const compareNode = compareById.get(id);
        if (!compareNode) {
            // Removed in compare branch
            nodeDiffs.push({
                nodeId: id,
                name: baseNode.name,
                kind: "removed",
                before: baseNode,
                impactedEdgeCount: countImpactedEdges(id, normalizedBase.edges)
            });
            impactedNodeIds.add(id);
        }
        else if (nodeKey(baseNode) !== nodeKey(compareNode)) {
            // Modified
            nodeDiffs.push({
                nodeId: id,
                name: compareNode.name,
                kind: "modified",
                before: baseNode,
                after: compareNode,
                impactedEdgeCount: countImpactedEdges(id, normalizedCompare.edges)
            });
            impactedNodeIds.add(id);
        }
        else {
            nodeDiffs.push({
                nodeId: id,
                name: baseNode.name,
                kind: "unchanged",
                before: baseNode,
                after: compareNode,
                impactedEdgeCount: 0
            });
        }
    }
    // Nodes only in compare (added)
    for (const [id, compareNode] of compareById) {
        if (!baseById.has(id)) {
            nodeDiffs.push({
                nodeId: id,
                name: compareNode.name,
                kind: "added",
                after: compareNode,
                impactedEdgeCount: countImpactedEdges(id, normalizedCompare.edges)
            });
            impactedNodeIds.add(id);
        }
    }
    // Edges
    let addedEdges = 0;
    let removedEdges = 0;
    for (const edge of normalizedBase.edges) {
        const key = edgeKey(edge);
        if (!compareEdgeKeys.has(key)) {
            edgeDiffs.push({ from: edge.from, to: edge.to, edgeKind: edge.kind, diffKind: "removed" });
            impactedNodeIds.add(edge.from);
            impactedNodeIds.add(edge.to);
            removedEdges++;
        }
        else {
            edgeDiffs.push({ from: edge.from, to: edge.to, edgeKind: edge.kind, diffKind: "unchanged" });
        }
    }
    for (const edge of normalizedCompare.edges) {
        const key = edgeKey(edge);
        if (!baseEdgeKeys.has(key)) {
            edgeDiffs.push({ from: edge.from, to: edge.to, edgeKind: edge.kind, diffKind: "added" });
            impactedNodeIds.add(edge.from);
            impactedNodeIds.add(edge.to);
            addedEdges++;
        }
    }
    const addedNodes = nodeDiffs.filter((d) => d.kind === "added").length;
    const removedNodes = nodeDiffs.filter((d) => d.kind === "removed").length;
    const modifiedNodes = nodeDiffs.filter((d) => d.kind === "modified").length;
    return {
        baseId,
        compareId,
        addedNodes,
        removedNodes,
        modifiedNodes,
        addedEdges,
        removedEdges,
        impactedNodeIds: [...impactedNodeIds],
        nodeDiffs,
        edgeDiffs
    };
};
