import { describe, expect, it } from "vitest";
import { computeGraphMetrics } from "./metrics";
import { emptyContract } from "@abhinav2203/codeflow-core/schema";
const node = (id, kind = "function") => ({
    id,
    kind,
    name: id,
    summary: "A node.",
    contract: emptyContract(),
    sourceRefs: [],
    generatedRefs: [],
    traceRefs: [],
});
const edge = (from, to, kind = "calls") => ({
    from,
    to,
    kind,
    required: true,
    confidence: 1,
});
const graph = (projectName, nodes, edges) => ({
    projectName,
    mode: "essential",
    generatedAt: "2026-03-14T00:00:00.000Z",
    warnings: [],
    workflows: [],
    nodes,
    edges,
});
describe("computeGraphMetrics", () => {
    it("computes correct basic metrics for a simple graph", () => {
        const metrics = computeGraphMetrics(graph("Simple", [node("A", "module"), node("B", "api"), node("C", "function")], [edge("A", "B"), edge("B", "C")]));
        expect(metrics.nodeCount).toBe(3);
        expect(metrics.edgeCount).toBe(2);
        expect(metrics.nodesByKind["module"]).toBe(1);
        expect(metrics.nodesByKind["api"]).toBe(1);
        expect(metrics.nodesByKind["function"]).toBe(1);
        expect(metrics.connectedComponents).toBe(1);
    });
    it("returns all zeros for an empty graph", () => {
        const metrics = computeGraphMetrics(graph("Empty", [], []));
        expect(metrics.nodeCount).toBe(0);
        expect(metrics.edgeCount).toBe(0);
        expect(metrics.density).toBe(0);
        expect(metrics.connectedComponents).toBe(0);
        expect(metrics.avgDegree).toBe(0);
        expect(metrics.isolatedNodes).toBe(0);
        expect(metrics.leafNodes).toBe(0);
    });
    it("counts isolated and leaf nodes correctly", () => {
        // A → B (A: out=1, B: in=1) — C is isolated
        const metrics = computeGraphMetrics(graph("IsolatedLeaf", [node("A", "module"), node("B", "module"), node("C", "module")], [edge("A", "B")]));
        expect(metrics.isolatedNodes).toBe(1); // C has degree 0
        expect(metrics.leafNodes).toBe(2); // A has out=1, B has in=1
    });
    it("density stays <= 1 when parallel edges exist between the same pair", () => {
        const metrics = computeGraphMetrics(graph("ParallelEdges", [node("A", "module"), node("B", "module")], [edge("A", "B"), { from: "A", to: "B", kind: "imports", required: false, confidence: 0.9 }]));
        expect(metrics.density).toBeLessThanOrEqual(1);
        // One unique directed pair (A→B) out of 2 possible (A→B, B→A) = 0.5
        expect(metrics.density).toBeCloseTo(0.5);
    });
    it("identifies max in-degree and max out-degree nodes", () => {
        // A → B, A → C, D → B  → in(B)=2, out(A)=2
        const metrics = computeGraphMetrics(graph("DegreeStats", [node("A", "module"), node("B", "module"), node("C", "module"), node("D", "module")], [edge("A", "B"), edge("A", "C"), edge("D", "B")]));
        expect(metrics.maxInDegree).toBe(2);
        expect(metrics.maxOutDegree).toBe(2);
        expect(metrics.maxInDegreeNodeId).toBe("B");
        expect(metrics.maxOutDegreeNodeId).toBe("A");
    });
    it("counts edges by kind correctly", () => {
        const metrics = computeGraphMetrics(graph("EdgesByKind", [node("A", "module"), node("B", "module")], [edge("A", "B"), { from: "A", to: "B", kind: "imports", required: true, confidence: 1 }]));
        expect(metrics.edgesByKind["calls"]).toBe(1);
        expect(metrics.edgesByKind["imports"]).toBe(1);
    });
    it("avgMethodsPerNode is computed correctly", () => {
        const metrics = computeGraphMetrics(graph("Methods", [
            {
                ...node("A", "class"),
                contract: { ...emptyContract(), methods: [{}, {}] },
            },
            {
                ...node("B", "class"),
                contract: { ...emptyContract(), methods: [{}] },
            },
        ], []));
        expect(metrics.totalMethods).toBe(3);
        expect(metrics.avgMethodsPerNode).toBeCloseTo(1.5);
    });
    it("connectedComponents uses Union-Find correctly for a disconnected graph", () => {
        // Two disconnected components: {A, B} and {C, D}
        const metrics = computeGraphMetrics(graph("Disconnected", [node("A"), node("B"), node("C"), node("D")], [edge("A", "B"), edge("C", "D")]));
        expect(metrics.connectedComponents).toBe(2);
    });
    it("computed at timestamp is a valid ISO string", () => {
        const metrics = computeGraphMetrics(graph("Timestamp", [node("A")], []));
        expect(() => new Date(metrics.analyzedAt)).not.toThrow();
    });
});
