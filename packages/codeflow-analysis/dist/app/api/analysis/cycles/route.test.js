import { describe, expect, it } from "vitest";
import { POST } from "../../../../handlers/cycles";
import { emptyContract } from "@abhinav2203/codeflow-core/schema";
const minimalNode = (id) => ({
    id,
    kind: "function",
    name: id,
    summary: "A node.",
    contract: emptyContract(),
    sourceRefs: [],
    generatedRefs: [],
    traceRefs: [],
});
const minimalEdge = (from, to) => ({
    from,
    to,
    kind: "calls",
    required: true,
    confidence: 1,
});
const baseGraph = {
    projectName: "Cycles Route Test",
    mode: "essential",
    generatedAt: "2026-03-14T00:00:00.000Z",
    warnings: [],
    workflows: [],
    nodes: [],
    edges: [],
};
describe("POST /api/analysis/cycles", () => {
    it("returns a cycle report with no cycles for a clean DAG", async () => {
        const graph = {
            ...baseGraph,
            nodes: [minimalNode("function:a"), minimalNode("function:b"), minimalNode("function:c")],
            edges: [minimalEdge("function:a", "function:b"), minimalEdge("function:b", "function:c")],
        };
        const response = await POST(new Request("http://localhost/api/analysis/cycles", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(graph),
        }));
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.report.totalCycles).toBe(0);
        expect(body.report.hasCycles).toBe(false);
    });
    it("detects a cycle between two mutually dependent nodes", async () => {
        const graph = {
            ...baseGraph,
            nodes: [minimalNode("function:a"), minimalNode("function:b")],
            edges: [minimalEdge("function:a", "function:b"), minimalEdge("function:b", "function:a")],
        };
        const response = await POST(new Request("http://localhost/api/analysis/cycles", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(graph),
        }));
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.report.totalCycles).toBe(1);
        expect(body.report.affectedNodeIds).toContain("function:a");
        expect(body.report.affectedNodeIds).toContain("function:b");
        expect(body.report.hasCycles).toBe(true);
        expect(body.report.analyzedAt).toBeTruthy();
    });
    it("detects a self-loop as a cycle", async () => {
        const graph = {
            ...baseGraph,
            nodes: [minimalNode("function:a")],
            edges: [{ from: "function:a", to: "function:a", kind: "calls", required: true, confidence: 1 }],
        };
        const response = await POST(new Request("http://localhost/api/analysis/cycles", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(graph),
        }));
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.report.totalCycles).toBe(1);
        expect(body.report.hasCycles).toBe(true);
    });
    it("returns 400 for an invalid request body", async () => {
        const response = await POST(new Request("http://localhost/api/analysis/cycles", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ invalid: true }),
        }));
        const body = await response.json();
        expect(response.status).toBe(400);
        expect(body.error).toBeTruthy();
    });
});
