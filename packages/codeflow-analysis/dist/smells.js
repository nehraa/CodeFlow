import { z } from "zod";
export const smellSchema = z.object({
    code: z.string(),
    severity: z.enum(["info", "warning", "critical"]),
    nodeId: z.string().optional(),
    message: z.string(),
    suggestion: z.string(),
});
export const smellReportSchema = z.object({
    analyzedAt: z.string(),
    totalSmells: z.number(),
    smells: z.array(smellSchema),
    healthScore: z.number(),
});
const GOD_NODE_MIN_METHODS = 7;
const GOD_NODE_MIN_RESPONSIBILITIES = 5;
const HUB_NODE_MIN_DEGREE = 8;
const TIGHT_COUPLING_MIN_EDGES = 3;
const UNSTABLE_DEP_MIN_INCOMING = 1;
const UNSTABLE_DEP_MIN_OUTGOING = 4;
const UNSTABLE_DEP_THRESHOLD = 0.8;
const SCATTERED_MIN_SIDE_EFFECTS = 4;
const CRITICAL_PENALTY = 15;
const WARNING_PENALTY = 8;
const INFO_PENALTY = 3;
/** Nodes with too many methods AND responsibilities — violates single responsibility. */
const detectGodNodes = (graph) => graph.nodes
    .filter((n) => n.contract.methods.length >= GOD_NODE_MIN_METHODS &&
    n.contract.responsibilities.length >= GOD_NODE_MIN_RESPONSIBILITIES)
    .map((n) => ({
    code: "god-node",
    severity: "critical",
    nodeId: n.id,
    message: `Node "${n.name}" has ${n.contract.methods.length} methods and ${n.contract.responsibilities.length} responsibilities.`,
    suggestion: "Split this node into smaller, focused modules with single responsibilities.",
}));
/** Nodes with very high total degree — potential hub that other nodes depend on too heavily. */
const detectHubNodes = (graph) => {
    const inDegree = new Map();
    const outDegree = new Map();
    for (const node of graph.nodes) {
        inDegree.set(node.id, 0);
        outDegree.set(node.id, 0);
    }
    for (const edge of graph.edges) {
        inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
        outDegree.set(edge.from, (outDegree.get(edge.from) ?? 0) + 1);
    }
    return graph.nodes
        .filter((n) => (inDegree.get(n.id) ?? 0) + (outDegree.get(n.id) ?? 0) >= HUB_NODE_MIN_DEGREE)
        .map((n) => {
        const total = (inDegree.get(n.id) ?? 0) + (outDegree.get(n.id) ?? 0);
        return {
            code: "hub-node",
            severity: "warning",
            nodeId: n.id,
            message: `Node "${n.name}" has a total degree of ${total} (in: ${inDegree.get(n.id) ?? 0}, out: ${outDegree.get(n.id) ?? 0}).`,
            suggestion: "Introduce an intermediary or facade to reduce direct dependencies on this node.",
        };
    });
};
/** Nodes with no incoming or outgoing edges — may be dead code or missing connections. */
const detectOrphanNodes = (graph) => {
    const connected = new Set();
    for (const edge of graph.edges) {
        connected.add(edge.from);
        connected.add(edge.to);
    }
    return graph.nodes
        .filter((n) => !connected.has(n.id))
        .map((n) => ({
        code: "orphan-node",
        severity: "info",
        nodeId: n.id,
        message: `Node "${n.name}" has no incoming or outgoing edges.`,
        suggestion: "Verify this node is still needed; it may be dead code or missing connections.",
    }));
};
/** Node pairs connected by three or more distinct edges — excessive coupling. */
const detectTightCoupling = (graph) => {
    const pairCounts = new Map();
    for (const edge of graph.edges) {
        const [a, b] = [edge.from, edge.to].sort();
        const key = `${a}\0${b}`;
        const entry = pairCounts.get(key);
        if (entry) {
            entry.count++;
        }
        else {
            pairCounts.set(key, { a, b, count: 1 });
        }
    }
    const smells = [];
    for (const { a, b, count } of pairCounts.values()) {
        if (count >= TIGHT_COUPLING_MIN_EDGES) {
            smells.push({
                code: "tight-coupling",
                severity: "warning",
                nodeId: undefined,
                message: `Nodes "${a}" and "${b}" are connected by ${count} edges.`,
                suggestion: "Consider merging these nodes or extracting a shared interface to reduce coupling.",
            });
        }
    }
    return smells;
};
/**
 * Nodes that are depended upon (incoming edges) but have many outgoing edges —
 * unstable intermediates that are prone to breaking dependents when changed.
 */
const detectUnstableDependencies = (graph) => {
    const inCount = new Map();
    const outCount = new Map();
    for (const node of graph.nodes) {
        inCount.set(node.id, 0);
        outCount.set(node.id, 0);
    }
    for (const edge of graph.edges) {
        inCount.set(edge.to, (inCount.get(edge.to) ?? 0) + 1);
        outCount.set(edge.from, (outCount.get(edge.from) ?? 0) + 1);
    }
    return graph.nodes
        .filter((n) => {
        const inc = inCount.get(n.id) ?? 0;
        const out = outCount.get(n.id) ?? 0;
        if (inc < UNSTABLE_DEP_MIN_INCOMING || out < UNSTABLE_DEP_MIN_OUTGOING)
            return false;
        return out / (inc + out) > UNSTABLE_DEP_THRESHOLD;
    })
        .map((n) => {
        const inc = inCount.get(n.id) ?? 0;
        const out = outCount.get(n.id) ?? 0;
        const instability = out / (inc + out);
        return {
            code: "unstable-dependency",
            severity: "warning",
            nodeId: n.id,
            message: `Node "${n.name}" has instability ${instability.toFixed(2)} (in: ${inc}, out: ${out}) and is depended upon.`,
            suggestion: "Stabilize this node by reducing its outgoing dependencies or shielding dependents with an abstraction.",
        };
    });
};
/** Nodes that declare many side effects — scattered responsibilities across the system. */
const detectScatteredResponsibility = (graph) => graph.nodes
    .filter((n) => n.contract.sideEffects.length >= SCATTERED_MIN_SIDE_EFFECTS)
    .map((n) => ({
    code: "scattered-responsibility",
    severity: "info",
    nodeId: n.id,
    message: `Node "${n.name}" declares ${n.contract.sideEffects.length} side effects.`,
    suggestion: "Extract side effects into dedicated service nodes to improve testability and clarity.",
}));
const computeHealthScore = (smells) => {
    let score = 100;
    for (const smell of smells) {
        if (smell.severity === "critical")
            score -= CRITICAL_PENALTY;
        else if (smell.severity === "warning")
            score -= WARNING_PENALTY;
        else
            score -= INFO_PENALTY;
    }
    return Math.max(0, score);
};
/**
 * Detect all architecture smells in a blueprint graph.
 *
 * Smell categories: god-node, hub-node, orphan-node, tight-coupling,
 * unstable-dependency, scattered-responsibility.
 */
export const detectSmells = (graph) => {
    const smells = [
        ...detectGodNodes(graph),
        ...detectHubNodes(graph),
        ...detectOrphanNodes(graph),
        ...detectTightCoupling(graph),
        ...detectUnstableDependencies(graph),
        ...detectScatteredResponsibility(graph),
    ];
    return {
        analyzedAt: new Date().toISOString(),
        totalSmells: smells.length,
        smells,
        healthScore: computeHealthScore(smells),
    };
};
