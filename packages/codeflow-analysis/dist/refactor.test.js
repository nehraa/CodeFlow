import { describe, expect, it } from "vitest";
import { detectDrift, healGraph } from "./refactor";
import { emptyContract } from "@abhinav2203/codeflow-core/schema";
// ── Fixtures ───────────────────────────────────────────────────────────────
const makeNode = (id, overrides = {}) => {
    const calls = overrides.contractCalls?.map((c) => ({
        target: c.target,
        kind: c.kind,
        description: undefined,
    })) ?? [];
    const methods = overrides.firstMethodSignature
        ? [
            {
                name: id,
                signature: overrides.firstMethodSignature,
                summary: "Method.",
                inputs: [],
                outputs: [],
                sideEffects: [],
                calls: [],
            },
        ]
        : [];
    return {
        id,
        kind: "function",
        name: id,
        summary: `${id} summary.`,
        signature: overrides.signature,
        contract: {
            ...emptyContract(),
            ...(calls.length > 0 ? { calls } : {}),
            ...(methods.length > 0 ? { methods } : {}),
        },
        sourceRefs: [],
        generatedRefs: [],
        traceRefs: [],
    };
};
const edge = (from, to, kind = "calls") => ({
    from,
    to,
    kind,
    required: false,
    confidence: 1,
});
const makeGraph = (overrides = {}) => ({
    projectName: "TestApp",
    mode: "essential",
    phase: "spec",
    generatedAt: "2026-03-14T00:00:00.000Z",
    warnings: [],
    workflows: [],
    edges: [],
    nodes: [
        makeNode("function:auth", {
            contractCalls: [],
        }),
        makeNode("api:users", { contractCalls: [] }),
        makeNode("function:checkout", { contractCalls: [] }),
    ],
    ...overrides,
});
// ── detectDrift ─────────────────────────────────────────────────────────────
describe("detectDrift", () => {
    it("reports a healthy graph with no issues", () => {
        const report = detectDrift(makeGraph());
        expect(report.isHealthy).toBe(true);
        expect(report.issues).toHaveLength(0);
        expect(report.totalIssues).toBe(0);
        expect(report.driftedNodeIds).toHaveLength(0);
        expect(report.provenance).toBe("deterministic");
        expect(report.maturity).toBe("preview");
        expect(report.scope).toBe("graph");
    });
    it("detects a broken edge whose source node does not exist", () => {
        const graph = makeGraph({
            edges: [edge("node:ghost", "function:auth")],
        });
        const report = detectDrift(graph);
        expect(report.isHealthy).toBe(false);
        const brokenIssues = report.issues.filter((i) => i.kind === "broken-edge");
        expect(brokenIssues.length).toBeGreaterThanOrEqual(1);
        // Anchored on the existing endpoint.
        expect(brokenIssues[0].nodeId).toBe("function:auth");
        expect(brokenIssues[0].missingNodeId).toBe("node:ghost");
        // driftedNodeIds only contains real node IDs.
        expect(report.driftedNodeIds).toContain("function:auth");
        expect(report.driftedNodeIds).not.toContain("node:ghost");
    });
    it("detects a broken edge whose target node does not exist", () => {
        const graph = makeGraph({
            edges: [edge("function:auth", "node:deleted")],
        });
        const report = detectDrift(graph);
        const brokenIssues = report.issues.filter((i) => i.kind === "broken-edge");
        expect(brokenIssues.length).toBeGreaterThanOrEqual(1);
        expect(brokenIssues[0].nodeId).toBe("function:auth");
        expect(brokenIssues[0].missingNodeId).toBe("node:deleted");
        expect(report.driftedNodeIds).toContain("function:auth");
        expect(report.driftedNodeIds).not.toContain("node:deleted");
    });
    it("detects a missing edge when a contract call has no graph edge", () => {
        const graph = makeGraph({
            nodes: makeGraph().nodes.map((n) => n.id === "function:auth"
                ? makeNode("function:auth", { contractCalls: [{ target: "api:users", kind: "calls" }] })
                : n),
        });
        const report = detectDrift(graph);
        const missingIssues = report.issues.filter((i) => i.kind === "missing-edge");
        expect(missingIssues.length).toBeGreaterThanOrEqual(1);
        expect(missingIssues[0].edgeFrom).toBe("function:auth");
        expect(missingIssues[0].edgeTo).toBe("api:users");
    });
    it("does NOT report a missing-edge when the edge already exists", () => {
        const graph = makeGraph({
            nodes: makeGraph().nodes.map((n) => n.id === "function:auth"
                ? makeNode("function:auth", { contractCalls: [{ target: "api:users", kind: "calls" }] })
                : n),
            edges: [edge("function:auth", "api:users", "calls")],
        });
        const report = detectDrift(graph);
        expect(report.issues.filter((i) => i.kind === "missing-edge")).toHaveLength(0);
    });
    it("detects signature drift when node signature does not match first method", () => {
        const graph = makeGraph({
            nodes: makeGraph().nodes.map((n) => n.id === "function:auth"
                ? makeNode("function:auth", {
                    signature: "authenticate(token: string): void",
                    firstMethodSignature: "authenticate(token: string, opts?: Options): string",
                })
                : n),
        });
        const report = detectDrift(graph);
        const driftIssues = report.issues.filter((i) => i.kind === "signature-drift");
        expect(driftIssues.length).toBeGreaterThanOrEqual(1);
        expect(driftIssues[0].nodeId).toBe("function:auth");
    });
    it("does NOT report signature drift when signatures match", () => {
        const sig = "authenticate(token: string): string";
        const graph = makeGraph({
            nodes: makeGraph().nodes.map((n) => n.id === "function:auth"
                ? makeNode("function:auth", {
                    signature: sig,
                    firstMethodSignature: sig,
                })
                : n),
        });
        const report = detectDrift(graph);
        expect(report.issues.filter((i) => i.kind === "signature-drift")).toHaveLength(0);
    });
    it("populates driftedNodeIds with unique node IDs", () => {
        const graph = makeGraph({
            edges: [edge("node:ghost", "function:auth")],
        });
        const report = detectDrift(graph);
        expect(report.driftedNodeIds).toContain("function:auth");
        expect(report.driftedNodeIds).not.toContain("node:ghost");
        expect(report.driftedNodeIds.filter((id) => id === "function:auth")).toHaveLength(1);
    });
    it("includes projectName and detectedAt in the report", () => {
        const report = detectDrift(makeGraph());
        expect(report.projectName).toBe("TestApp");
        expect(report.detectedAt).toBeTruthy();
    });
});
// ── healGraph ────────────────────────────────────────────────────────────────
describe("healGraph", () => {
    it("returns unchanged graph when the report is healthy", () => {
        const graph = makeGraph();
        const report = detectDrift(graph);
        const result = healGraph(graph, report);
        expect(result.issuesFixed).toBe(0);
        expect(result.graph.edges).toHaveLength(0);
        expect(result.graph.nodes).toHaveLength(graph.nodes.length);
    });
    it("removes broken edges", () => {
        const graph = makeGraph({
            edges: [edge("node:ghost", "function:auth"), edge("function:auth", "api:users")],
        });
        const report = detectDrift(graph);
        const result = healGraph(graph, report);
        expect(result.graph.edges.some((e) => e.from === "node:ghost")).toBe(false);
        expect(result.graph.edges.some((e) => e.from === "function:auth" && e.to === "api:users")).toBe(true);
        expect(result.issuesFixed).toBeGreaterThanOrEqual(1);
        expect(result.summary.some((s) => s.includes("Removed broken edge"))).toBe(true);
    });
    it("adds missing edges from contract calls", () => {
        const graph = makeGraph({
            nodes: makeGraph().nodes.map((n) => n.id === "function:auth"
                ? makeNode("function:auth", { contractCalls: [{ target: "api:users", kind: "calls" }] })
                : n),
        });
        const report = detectDrift(graph);
        const result = healGraph(graph, report);
        expect(result.graph.edges.some((e) => e.from === "function:auth" && e.to === "api:users" && e.kind === "calls")).toBe(true);
        expect(result.issuesFixed).toBeGreaterThanOrEqual(1);
        expect(result.summary.some((s) => s.includes("Added missing edge"))).toBe(true);
    });
    it("does not duplicate edges when healing the same missing edge twice", () => {
        const graph = makeGraph({
            nodes: makeGraph().nodes.map((n) => n.id === "function:auth"
                ? makeNode("function:auth", { contractCalls: [{ target: "api:users", kind: "calls" }] })
                : n),
        });
        const report = detectDrift(graph);
        const result = healGraph(graph, report);
        const edgesFromAuth = result.graph.edges.filter((e) => e.from === "function:auth" && e.to === "api:users");
        expect(edgesFromAuth).toHaveLength(1);
    });
    it("syncs signature drift to the first contract method signature", () => {
        const correctedSig = "authenticate(token: string, opts?: Options): string";
        const graph = makeGraph({
            nodes: makeGraph().nodes.map((n) => n.id === "function:auth"
                ? makeNode("function:auth", {
                    signature: "authenticate(token: string): void",
                    firstMethodSignature: correctedSig,
                })
                : n),
        });
        const report = detectDrift(graph);
        const result = healGraph(graph, report);
        const authNode = result.graph.nodes.find((n) => n.id === "function:auth");
        expect(authNode?.signature).toBe(correctedSig);
        expect(result.issuesFixed).toBeGreaterThanOrEqual(1);
        expect(result.summary.some((s) => s.includes("Synced signature"))).toBe(true);
    });
    it("does not mutate the original graph", () => {
        const graph = makeGraph({
            edges: [edge("node:ghost", "function:auth")],
        });
        const originalEdgeCount = graph.edges.length;
        const report = detectDrift(graph);
        healGraph(graph, report);
        expect(graph.edges).toHaveLength(originalEdgeCount);
    });
    it("includes provenance and maturity in the result", () => {
        const graph = makeGraph();
        const report = detectDrift(graph);
        const result = healGraph(graph, report);
        expect(result.projectName).toBe("TestApp");
        expect(result.healedAt).toBeTruthy();
        expect(result.provenance).toBe("deterministic");
        expect(result.maturity).toBe("preview");
        expect(result.scope).toBe("graph");
    });
    it("synthesises one edge per distinct (from, to, kind) when multiple calls have different kinds", () => {
        const graph = makeGraph({
            nodes: makeGraph().nodes.map((n) => n.id === "function:auth"
                ? makeNode("function:auth", {
                    contractCalls: [
                        { target: "api:users", kind: "calls" },
                        { target: "api:users", kind: "reads-state" },
                    ],
                })
                : n),
        });
        const report = detectDrift(graph);
        const missingIssues = report.issues.filter((i) => i.kind === "missing-edge");
        // Two distinct kinds → two distinct missing-edge issues.
        expect(missingIssues).toHaveLength(2);
        const result = healGraph(graph, report);
        const callsEdges = result.graph.edges.filter((e) => e.from === "function:auth" && e.to === "api:users" && e.kind === "calls");
        const readsEdges = result.graph.edges.filter((e) => e.from === "function:auth" && e.to === "api:users" && e.kind === "reads-state");
        expect(callsEdges).toHaveLength(1);
        expect(readsEdges).toHaveLength(1);
        expect(result.issuesFixed).toBe(2);
    });
});
