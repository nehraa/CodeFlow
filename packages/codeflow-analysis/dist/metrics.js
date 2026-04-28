import { z } from "zod";
export const graphMetricsSchema = z.object({
    analyzedAt: z.string(),
    nodeCount: z.number(),
    edgeCount: z.number(),
    nodesByKind: z.record(z.string(), z.number()),
    edgesByKind: z.record(z.string(), z.number()),
    nodesByStatus: z.record(z.string(), z.number()),
    density: z.number(),
    avgDegree: z.number(),
    maxInDegree: z.number(),
    maxOutDegree: z.number(),
    maxInDegreeNodeId: z.string().optional(),
    maxOutDegreeNodeId: z.string().optional(),
    avgMethodsPerNode: z.number(),
    avgResponsibilitiesPerNode: z.number(),
    totalMethods: z.number(),
    totalResponsibilities: z.number(),
    connectedComponents: z.number(),
    isolatedNodes: z.number(),
    leafNodes: z.number(),
});
const countBy = (items, key) => {
    const counts = {};
    for (const item of items) {
        const k = key(item);
        counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
};
/** Union-Find (disjoint set) implementation for connected components. */
const computeConnectedComponents = (nodeIds, edges) => {
    const parent = new Map();
    const rank = new Map();
    for (const id of nodeIds) {
        parent.set(id, id);
        rank.set(id, 0);
    }
    const find = (x) => {
        let root = x;
        while (parent.get(root) !== root) {
            root = parent.get(root);
        }
        let current = x;
        while (current !== root) {
            const next = parent.get(current);
            parent.set(current, root);
            current = next;
        }
        return root;
    };
    const union = (a, b) => {
        const ra = find(a);
        const rb = find(b);
        if (ra === rb)
            return;
        const rankA = rank.get(ra);
        const rankB = rank.get(rb);
        if (rankA < rankB) {
            parent.set(ra, rb);
        }
        else if (rankA > rankB) {
            parent.set(rb, ra);
        }
        else {
            parent.set(rb, ra);
            rank.set(ra, rankA + 1);
        }
    };
    for (const edge of edges) {
        if (parent.has(edge.from) && parent.has(edge.to)) {
            union(edge.from, edge.to);
        }
    }
    const roots = new Set(nodeIds.map(find));
    return roots.size;
};
/**
 * Compute structural metrics for a blueprint graph.
 *
 * Metrics include: node/edge counts, degree statistics, graph density,
 * connected components, isolated/leaf node counts, and contract-level
 * averages (methods and responsibilities per node).
 */
export const computeGraphMetrics = (graph) => {
    const { nodes, edges } = graph;
    const nodeCount = nodes.length;
    const edgeCount = edges.length;
    const nodesByKind = countBy(nodes, (n) => n.kind);
    const edgesByKind = countBy(edges, (e) => e.kind);
    const nodesByStatus = countBy(nodes, (n) => n.status ?? "spec_only");
    // Use unique (from,to) directed pairs for density to avoid inflated values
    // from parallel edges between the same node pair.
    const uniquePairCount = new Set(edges.map((e) => `${e.from}::__::${e.to}`)).size;
    const density = nodeCount < 2 ? 0 : uniquePairCount / (nodeCount * (nodeCount - 1));
    const inDegree = new Map();
    const outDegree = new Map();
    for (const node of nodes) {
        inDegree.set(node.id, 0);
        outDegree.set(node.id, 0);
    }
    for (const edge of edges) {
        inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
        outDegree.set(edge.from, (outDegree.get(edge.from) ?? 0) + 1);
    }
    let maxInDegree = 0;
    let maxOutDegree = 0;
    let maxInDegreeNodeId;
    let maxOutDegreeNodeId;
    for (const node of nodes) {
        const inD = inDegree.get(node.id);
        const outD = outDegree.get(node.id);
        if (inD > maxInDegree) {
            maxInDegree = inD;
            maxInDegreeNodeId = node.id;
        }
        if (outD > maxOutDegree) {
            maxOutDegree = outD;
            maxOutDegreeNodeId = node.id;
        }
    }
    const avgDegree = nodeCount === 0 ? 0 : (2 * edgeCount) / nodeCount;
    const totalMethods = nodes.reduce((sum, n) => sum + n.contract.methods.length, 0);
    const totalResponsibilities = nodes.reduce((sum, n) => sum + n.contract.responsibilities.length, 0);
    const avgMethodsPerNode = nodeCount === 0 ? 0 : totalMethods / nodeCount;
    const avgResponsibilitiesPerNode = nodeCount === 0 ? 0 : totalResponsibilities / nodeCount;
    const nodeIds = nodes.map((n) => n.id);
    const connectedComponents = nodeCount === 0 ? 0 : computeConnectedComponents(nodeIds, edges);
    let isolatedNodes = 0;
    let leafNodes = 0;
    for (const node of nodes) {
        const totalDegree = inDegree.get(node.id) + outDegree.get(node.id);
        if (totalDegree === 0)
            isolatedNodes++;
        else if (totalDegree === 1)
            leafNodes++;
    }
    return {
        analyzedAt: new Date().toISOString(),
        nodeCount,
        edgeCount,
        nodesByKind,
        edgesByKind,
        nodesByStatus,
        density,
        avgDegree,
        maxInDegree,
        maxOutDegree,
        maxInDegreeNodeId,
        maxOutDegreeNodeId,
        avgMethodsPerNode,
        avgResponsibilitiesPerNode,
        totalMethods,
        totalResponsibilities,
        connectedComponents,
        isolatedNodes,
        leafNodes,
    };
};
