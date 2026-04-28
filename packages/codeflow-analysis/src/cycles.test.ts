import { describe, expect, it } from "vitest";

import { detectCycles, hasCycles } from "./cycles";
import type { BlueprintGraph } from "@abhinav2203/codeflow-core/schema";
import { emptyContract } from "@abhinav2203/codeflow-core/schema";

const node = (id: string): BlueprintGraph["nodes"][number] => ({
  id,
  kind: "module",
  name: id,
  summary: id,
  contract: emptyContract(),
  sourceRefs: [],
  generatedRefs: [],
  traceRefs: [],
});

const edge = (from: string, to: string): BlueprintGraph["edges"][number] => ({
  from,
  to,
  kind: "calls",
  required: true,
  confidence: 1,
});

const graph = (
  projectName: string,
  nodes: BlueprintGraph["nodes"],
  edges: BlueprintGraph["edges"]
): BlueprintGraph => ({
  projectName,
  mode: "essential",
  generatedAt: "2026-03-14T00:00:00.000Z",
  warnings: [],
  workflows: [],
  nodes,
  edges,
});

describe("detectCycles", () => {
  it("returns no cycles for a DAG", () => {
    const report = detectCycles(
      graph(
        "DAG",
        [node("A"), node("B"), node("C")],
        [edge("A", "B"), edge("B", "C")]
      )
    );

    expect(report.totalCycles).toBe(0);
    expect(report.affectedNodeIds).toHaveLength(0);
  });

  it("detects a simple two-node cycle", () => {
    const report = detectCycles(
      graph("TwoNodeCycle", [node("A"), node("B")], [edge("A", "B"), edge("B", "A")])
    );

    expect(report.totalCycles).toBe(1);
    expect(report.affectedNodeIds).toContain("A");
    expect(report.affectedNodeIds).toContain("B");
  });

  it("detects multiple independent cycles", () => {
    const report = detectCycles(
      graph(
        "MultiCycle",
        [node("A"), node("B"), node("C"), node("D")],
        [edge("A", "B"), edge("B", "A"), edge("C", "D"), edge("D", "C")]
      )
    );

    expect(report.totalCycles).toBe(2);
  });

  it("handles empty graph", () => {
    const report = detectCycles(graph("Empty", [], []));

    expect(report.totalCycles).toBe(0);
  });

  it("detects a self-loop edge as a cycle", () => {
    const report = detectCycles(
      graph("SelfLoop", [node("A")], [{ from: "A", to: "A", kind: "calls", required: true, confidence: 1 }])
    );

    expect(report.totalCycles).toBe(1);
    expect(report.affectedNodeIds).toContain("A");
  });

  it("returns maxCycleLength correctly", () => {
    const report = detectCycles(
      graph(
        "ThreeCycle",
        [node("A"), node("B"), node("C")],
        [edge("A", "B"), edge("B", "C"), edge("C", "A")]
      )
    );

    expect(report.totalCycles).toBe(1);
    expect(report.maxCycleLength).toBe(3);
  });

  it("cycles array contains edges belonging to the SCC", () => {
    const report = detectCycles(
      graph("EdgeCycle", [node("X"), node("Y")], [edge("X", "Y"), edge("Y", "X")])
    );

    const cycle = report.cycles[0];
    expect(cycle.nodeIds).toContain("X");
    expect(cycle.nodeIds).toContain("Y");
    expect(cycle.edges).toHaveLength(2);
    expect(cycle.edges.map((e) => `${e.from}→${e.to}`)).toEqual(expect.arrayContaining(["X→Y", "Y→X"]));
  });
});

describe("hasCycles", () => {
  it("returns false for a DAG", () => {
    expect(
      hasCycles(
        graph("DAG", [node("A"), node("B")], [edge("A", "B")])
      )
    ).toBe(false);
  });

  it("returns true when a two-node cycle exists", () => {
    expect(
      hasCycles(
        graph("Cyclic", [node("A"), node("B")], [edge("A", "B"), edge("B", "A")])
      )
    ).toBe(true);
  });

  it("returns true for a self-loop", () => {
    expect(
      hasCycles(
        graph("SelfLoop", [node("A")], [{ from: "A", to: "A", kind: "calls", required: true, confidence: 1 }])
      )
    ).toBe(true);
  });

  it("returns false for empty graph", () => {
    expect(hasCycles(graph("Empty", [], []))).toBe(false);
  });
});
