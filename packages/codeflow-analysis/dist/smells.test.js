import { describe, expect, it } from "vitest";
import { detectSmells } from "./smells";
import { emptyContract } from "@abhinav2203/codeflow-core/schema";
const node = (id, kind = "module", contractOverrides = {}) => ({
    id,
    kind,
    name: id,
    summary: id,
    contract: { ...emptyContract(), ...contractOverrides },
    sourceRefs: [],
    generatedRefs: [],
    traceRefs: [],
});
const edge = (from, to) => ({
    from,
    to,
    kind: "calls",
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
const makeMethod = (name) => ({
    name,
    summary: `Does ${name}.`,
    inputs: [],
    outputs: [],
    sideEffects: [],
    calls: [],
});
describe("detectSmells", () => {
    it("detects a god-node (critical)", () => {
        const report = detectSmells(graph("GodNode", [
            node("god", "class", {
                responsibilities: ["r1", "r2", "r3", "r4", "r5"],
                methods: Array.from({ length: 7 }, (_, i) => makeMethod(`method${i}`)),
            }),
        ], []));
        expect(report.smells.some((s) => s.code === "god-node" && s.severity === "critical")).toBe(true);
    });
    it("does not flag a node with only methods but few responsibilities", () => {
        const report = detectSmells(graph("MethodsOnly", [
            node("methodsOnly", "class", {
                responsibilities: ["r1"],
                methods: Array.from({ length: 8 }, (_, i) => makeMethod(`m${i}`)),
            }),
        ], []));
        expect(report.smells.some((s) => s.code === "god-node")).toBe(false);
    });
    it("does not flag a node with only responsibilities but few methods", () => {
        const report = detectSmells(graph("ResponsibilitiesOnly", [
            node("respOnly", "class", {
                responsibilities: Array.from({ length: 6 }, (_, i) => `r${i}`),
                methods: [makeMethod("single")],
            }),
        ], []));
        expect(report.smells.some((s) => s.code === "god-node")).toBe(false);
    });
    it("detects orphan nodes (info)", () => {
        const report = detectSmells(graph("Orphan", [node("lonely", "function")], []));
        expect(report.smells.some((s) => s.code === "orphan-node" && s.severity === "info")).toBe(true);
    });
    it("returns health score 100 for a clean small graph", () => {
        const report = detectSmells(graph("Clean", [node("A", "module"), node("B", "function")], [edge("A", "B")]));
        expect(report.healthScore).toBe(100); // A→B edge means no orphans in connected graph
    });
    it("detects tight coupling between two nodes with 3+ edges", () => {
        const report = detectSmells(graph("TightCoupling", [node("A", "module"), node("B", "module")], [
            edge("A", "B"),
            { from: "A", to: "B", kind: "imports", required: true, confidence: 1 },
            edge("B", "A"),
        ]));
        expect(report.smells.some((s) => s.code === "tight-coupling" && s.severity === "warning")).toBe(true);
    });
    it("does not flag two nodes with fewer than 3 edges as tight coupling", () => {
        const report = detectSmells(graph("NotTight", [node("A", "module"), node("B", "module")], [edge("A", "B"), edge("B", "A")]));
        expect(report.smells.some((s) => s.code === "tight-coupling")).toBe(false);
    });
    it("detects scattered responsibility (info)", () => {
        const report = detectSmells(graph("Scattered", [
            node("scattered", "module", {
                sideEffects: ["db-write", "email", "cache-invalidate", "log"],
            }),
        ], []));
        expect(report.smells.some((s) => s.code === "scattered-responsibility" && s.severity === "info")).toBe(true);
    });
    it("health score decreases by correct penalty amounts", () => {
        // god-node (critical = -15) + orphan-node (info = -3) = 82
        const report = detectSmells(graph("Mixed", [
            node("god", "class", {
                responsibilities: ["r1", "r2", "r3", "r4", "r5"],
                methods: Array.from({ length: 8 }, (_, i) => makeMethod(`m${i}`)),
            }),
            node("lonely", "function"),
        ], []));
        expect(report.healthScore).toBe(100 - 15 - 3 - 3); // god-node (critical -15) + god IS orphan (-3) + lonely orphan (-3) = 79
    });
    it("totalSmells equals the number of individual smell records", () => {
        const report = detectSmells(graph("Count", [node("A", "module"), node("B", "function")], []));
        expect(report.totalSmells).toBe(report.smells.length);
    });
    it("smell suggestion is always non-empty", () => {
        const report = detectSmells(graph("Suggestions", [
            node("god", "class", {
                responsibilities: ["r1", "r2", "r3", "r4", "r5"],
                methods: Array.from({ length: 8 }, (_, i) => makeMethod(`m${i}`)),
            }),
        ], []));
        for (const smell of report.smells) {
            expect(smell.suggestion.length).toBeGreaterThan(0);
        }
    });
});
