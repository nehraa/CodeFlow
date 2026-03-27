import { describe, expect, it } from "vitest";

import {
  buildSimulationSpans,
  buildUserFlows,
  computeDigitalTwinSnapshot,
  overlayActiveNodes
} from "@/lib/blueprint/digital-twin";
import type { BlueprintGraph, TraceSpan } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

// ── Fixtures ───────────────────────────────────────────────────────────────

const makeGraph = (): BlueprintGraph => ({
  projectName: "TestApp",
  mode: "essential",
  generatedAt: "2026-03-14T00:00:00.000Z",
  warnings: [],
  workflows: [],
  edges: [],
  nodes: [
    {
      id: "function:auth",
      kind: "function",
      name: "authenticate",
      summary: "Authenticate user.",
      contract: { ...emptyContract(), summary: "Authenticate user." },
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    },
    {
      id: "api:products",
      kind: "api",
      name: "GET /products",
      summary: "List products.",
      contract: { ...emptyContract(), summary: "List products." },
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    },
    {
      id: "function:checkout",
      kind: "function",
      name: "checkout",
      summary: "Checkout cart.",
      contract: { ...emptyContract(), summary: "Checkout cart." },
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    }
  ]
});

const makeSpan = (overrides: Partial<TraceSpan> & Pick<TraceSpan, "spanId" | "traceId" | "name">): TraceSpan => ({
  status: "success",
  durationMs: 5,
  runtime: "node",
  provenance: "observed",
  ...overrides
});

// ── buildUserFlows ─────────────────────────────────────────────────────────

describe("buildUserFlows", () => {
  it("groups spans by traceId into flows", () => {
    const graph = makeGraph();

    const spans: TraceSpan[] = [
      makeSpan({ spanId: "s1", traceId: "t1", name: "authenticate", blueprintNodeId: "function:auth", timestamp: "2026-03-14T00:00:01.000Z" }),
      makeSpan({ spanId: "s2", traceId: "t1", name: "GET /products", blueprintNodeId: "api:products", timestamp: "2026-03-14T00:00:02.000Z" }),
      makeSpan({ spanId: "s3", traceId: "t2", name: "checkout", blueprintNodeId: "function:checkout", timestamp: "2026-03-14T00:00:03.000Z" })
    ];

    const flows = buildUserFlows(graph, spans);

    expect(flows).toHaveLength(2);

    // Most recent flow is first (t2 started later)
    expect(flows[0].traceId).toBe("t2");
    expect(flows[0].nodeIds).toEqual(["function:checkout"]);
    expect(flows[0].status).toBe("success");
    expect(flows[0].provenance).toBe("observed");

    expect(flows[1].traceId).toBe("t1");
    expect(flows[1].nodeIds).toEqual(["function:auth", "api:products"]);
    expect(flows[1].spanCount).toBe(2);
  });

  it("reports worst-case status across spans in a flow", () => {
    const graph = makeGraph();

    const spans: TraceSpan[] = [
      makeSpan({ spanId: "s1", traceId: "t1", name: "authenticate", blueprintNodeId: "function:auth", status: "success" }),
      makeSpan({ spanId: "s2", traceId: "t1", name: "checkout", blueprintNodeId: "function:checkout", status: "error" })
    ];

    const flows = buildUserFlows(graph, spans);
    expect(flows[0].status).toBe("error");
  });

  it("deduplicates repeated node visits within a single flow", () => {
    const graph = makeGraph();

    const spans: TraceSpan[] = [
      makeSpan({ spanId: "s1", traceId: "t1", name: "authenticate", blueprintNodeId: "function:auth", timestamp: "2026-03-14T00:00:01.000Z" }),
      makeSpan({ spanId: "s2", traceId: "t1", name: "authenticate", blueprintNodeId: "function:auth", timestamp: "2026-03-14T00:00:02.000Z" })
    ];

    const flows = buildUserFlows(graph, spans);
    expect(flows[0].nodeIds).toHaveLength(1);
    expect(flows[0].spanCount).toBe(2);
  });

  it("returns an empty array when there are no spans", () => {
    expect(buildUserFlows(makeGraph(), [])).toEqual([]);
  });
});

// ── computeDigitalTwinSnapshot ─────────────────────────────────────────────

describe("computeDigitalTwinSnapshot", () => {
  it("marks nodes with recent spans as active", () => {
    const graph = makeGraph();

    const recentTimestamp = new Date(Date.now() - 5000).toISOString();
    const spans: TraceSpan[] = [
      makeSpan({ spanId: "s1", traceId: "t1", name: "authenticate", blueprintNodeId: "function:auth", timestamp: recentTimestamp })
    ];

    const snapshot = computeDigitalTwinSnapshot(graph, spans, 60);

    expect(snapshot.activeNodeIds).toContain("function:auth");
    expect(snapshot.activeNodeIds).not.toContain("api:products");
    expect(snapshot.flows).toHaveLength(1);
    expect(snapshot.activeWindowSecs).toBe(60);
    expect(snapshot.maturity).toBe("preview");
    expect(snapshot.observedSpanCount).toBe(1);
    expect(snapshot.simulatedSpanCount).toBe(0);
  });

  it("excludes nodes whose spans are outside the active window", () => {
    const graph = makeGraph();

    const oldTimestamp = new Date(Date.now() - 120_000).toISOString();
    const spans: TraceSpan[] = [
      makeSpan({ spanId: "s1", traceId: "t1", name: "authenticate", blueprintNodeId: "function:auth", timestamp: oldTimestamp })
    ];

    const snapshot = computeDigitalTwinSnapshot(graph, spans, 60);
    expect(snapshot.activeNodeIds).toHaveLength(0);
  });

  it("treats spans without timestamps as always active", () => {
    const graph = makeGraph();

    const spans: TraceSpan[] = [
      makeSpan({ spanId: "s1", traceId: "t1", name: "authenticate", blueprintNodeId: "function:auth" })
    ];

    const snapshot = computeDigitalTwinSnapshot(graph, spans, 60);
    expect(snapshot.activeNodeIds).toContain("function:auth");
  });
});

// ── buildSimulationSpans ──────────────────────────────────────────────────

describe("buildSimulationSpans", () => {
  it("creates one span per node in order", () => {
    const graph = makeGraph();
    const spans = buildSimulationSpans(graph, ["function:auth", "api:products", "function:checkout"]);

    expect(spans).toHaveLength(3);
    expect(spans[0].blueprintNodeId).toBe("function:auth");
    expect(spans[1].blueprintNodeId).toBe("api:products");
    expect(spans[2].blueprintNodeId).toBe("function:checkout");
  });

  it("all spans share the same traceId", () => {
    const graph = makeGraph();
    const spans = buildSimulationSpans(graph, ["function:auth", "api:products"]);

    const traceIds = new Set(spans.map((s) => s.traceId));
    expect(traceIds.size).toBe(1);
  });

  it("uses the provided runtime label", () => {
    const graph = makeGraph();
    const spans = buildSimulationSpans(graph, ["function:auth"], "My test", "test-runner");
    expect(spans[0].runtime).toBe("test-runner");
    expect(spans[0].provenance).toBe("simulated");
  });

  it("skips unknown node IDs", () => {
    const graph = makeGraph();
    const spans = buildSimulationSpans(graph, ["function:auth", "node:unknown"]);
    expect(spans).toHaveLength(1);
  });

  it("returns empty array for empty nodeIds list", () => {
    expect(buildSimulationSpans(makeGraph(), [])).toEqual([]);
  });
});

// ── overlayActiveNodes ────────────────────────────────────────────────────

describe("overlayActiveNodes", () => {
  it("bumps idle nodes to success when they are active", () => {
    const graph = makeGraph();
    const result = overlayActiveNodes(graph, ["function:auth"]);

    const auth = result.nodes.find((n) => n.id === "function:auth");
    expect(auth?.traceState?.status).toBe("success");
  });

  it("leaves non-active nodes unchanged", () => {
    const graph = makeGraph();
    const result = overlayActiveNodes(graph, ["function:auth"]);

    const products = result.nodes.find((n) => n.id === "api:products");
    expect(products?.traceState).toBeUndefined();
  });

  it("does not downgrade an already-errored active node", () => {
    const graph: BlueprintGraph = {
      ...makeGraph(),
      nodes: makeGraph().nodes.map((n) =>
        n.id === "function:auth"
          ? { ...n, traceState: { status: "error", count: 1, errors: 1, totalDurationMs: 5, lastSpanIds: ["s1"] } }
          : n
      )
    };

    const result = overlayActiveNodes(graph, ["function:auth"]);
    const auth = result.nodes.find((n) => n.id === "function:auth");
    expect(auth?.traceState?.status).toBe("error");
  });
});
