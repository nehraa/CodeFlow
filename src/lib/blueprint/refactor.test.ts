import { describe, expect, it } from "vitest";

import { detectDrift, healGraph } from "@/lib/blueprint/refactor";
import type { BlueprintEdge, BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

// ── Fixtures ───────────────────────────────────────────────────────────────

const makeGraph = (overrides: Partial<BlueprintGraph> = {}): BlueprintGraph => ({
  projectName: "TestApp",
  mode: "essential",
  phase: "spec",
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
  ],
  ...overrides
});

const makeEdge = (overrides: Partial<BlueprintEdge> & Pick<BlueprintEdge, "from" | "to">): BlueprintEdge => ({
  kind: "calls",
  required: false,
  confidence: 1,
  ...overrides
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
      edges: [makeEdge({ from: "node:ghost", to: "function:auth" })]
    });

    const report = detectDrift(graph);
    expect(report.isHealthy).toBe(false);

    const brokenIssues = report.issues.filter((i) => i.kind === "broken-edge");
    expect(brokenIssues.length).toBeGreaterThanOrEqual(1);
    // nodeId anchors on the *existing* endpoint (the target); the missing ID
    // is stored separately in missingNodeId.
    const issue = brokenIssues[0];
    expect(issue.nodeId).toBe("function:auth");
    expect(issue.missingNodeId).toBe("node:ghost");
    // driftedNodeIds only contains real node IDs so the canvas can highlight them.
    expect(report.driftedNodeIds).toContain("function:auth");
    expect(report.driftedNodeIds).not.toContain("node:ghost");
  });

  it("detects a broken edge whose target node does not exist", () => {
    const graph = makeGraph({
      edges: [makeEdge({ from: "function:auth", to: "node:deleted" })]
    });

    const report = detectDrift(graph);
    const brokenIssues = report.issues.filter((i) => i.kind === "broken-edge");
    expect(brokenIssues.length).toBeGreaterThanOrEqual(1);
    // nodeId anchors on the existing source; missing ID is in missingNodeId.
    const issue = brokenIssues[0];
    expect(issue.nodeId).toBe("function:auth");
    expect(issue.missingNodeId).toBe("node:deleted");
    expect(report.driftedNodeIds).toContain("function:auth");
    expect(report.driftedNodeIds).not.toContain("node:deleted");
  });

  it("detects a missing edge when a contract call has no graph edge", () => {
    const graph = makeGraph({
      nodes: makeGraph().nodes.map((n) =>
        n.id === "function:auth"
          ? {
              ...n,
              contract: {
                ...emptyContract(),
                calls: [{ target: "GET /products", kind: "calls" as const }]
              }
            }
          : n
      )
    });

    const report = detectDrift(graph);
    const missingIssues = report.issues.filter((i) => i.kind === "missing-edge");
    expect(missingIssues.length).toBeGreaterThanOrEqual(1);
    expect(missingIssues[0].edgeFrom).toBe("function:auth");
    expect(missingIssues[0].edgeTo).toBe("api:products");
  });

  it("does NOT report a missing-edge when the edge already exists", () => {
    const graph = makeGraph({
      nodes: makeGraph().nodes.map((n) =>
        n.id === "function:auth"
          ? {
              ...n,
              contract: {
                ...emptyContract(),
                calls: [{ target: "GET /products", kind: "calls" as const }]
              }
            }
          : n
      ),
      edges: [makeEdge({ from: "function:auth", to: "api:products", kind: "calls" })],
    });

    const report = detectDrift(graph);
    const missingIssues = report.issues.filter((i) => i.kind === "missing-edge");
    expect(missingIssues).toHaveLength(0);
  });

  it("detects signature drift when node signature does not match first method", () => {
    const graph = makeGraph({
      nodes: makeGraph().nodes.map((n) =>
        n.id === "function:auth"
          ? {
              ...n,
              signature: "authenticate(token: string): void",
              contract: {
                ...emptyContract(),
                methods: [
                  {
                    name: "authenticate",
                    signature: "authenticate(token: string, opts?: Options): User",
                    summary: "Authenticate user.",
                    inputs: [],
                    outputs: [],
                    sideEffects: [],
                    calls: []
                  }
                ]
              }
            }
          : n
      )
    });

    const report = detectDrift(graph);
    const driftIssues = report.issues.filter((i) => i.kind === "signature-drift");
    expect(driftIssues.length).toBeGreaterThanOrEqual(1);
    expect(driftIssues[0].nodeId).toBe("function:auth");
  });

  it("does NOT report signature drift when signatures match", () => {
    const sig = "authenticate(token: string): User";
    const graph = makeGraph({
      nodes: makeGraph().nodes.map((n) =>
        n.id === "function:auth"
          ? {
              ...n,
              signature: sig,
              contract: {
                ...emptyContract(),
                methods: [
                  {
                    name: "authenticate",
                    signature: sig,
                    summary: "Auth.",
                    inputs: [],
                    outputs: [],
                    sideEffects: [],
                    calls: []
                  }
                ]
              }
            }
          : n
      )
    });

    const report = detectDrift(graph);
    expect(report.issues.filter((i) => i.kind === "signature-drift")).toHaveLength(0);
  });

  it("populates driftedNodeIds with unique node IDs that have issues", () => {
    const graph = makeGraph({
      edges: [makeEdge({ from: "node:ghost", to: "function:auth" })]
    });
    const report = detectDrift(graph);
    // Broken-edge anchors on the existing endpoint (function:auth).
    expect(report.driftedNodeIds).toContain("function:auth");
    // The missing ID is NOT in driftedNodeIds (it's in missingNodeId).
    expect(report.driftedNodeIds).not.toContain("node:ghost");
    // Each existing node ID appears at most once.
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
  it("returns the unchanged graph when the report is healthy", () => {
    const graph = makeGraph();
    const report = detectDrift(graph);
    const result = healGraph(graph, report);

    expect(result.issuesFixed).toBe(0);
    expect(result.graph.edges).toHaveLength(0);
    expect(result.graph.nodes).toHaveLength(graph.nodes.length);
  });

  it("removes broken edges", () => {
    const graph = makeGraph({
      edges: [
        makeEdge({ from: "node:ghost", to: "function:auth" }),
        makeEdge({ from: "function:auth", to: "api:products" }) // valid
      ]
    });

    const report = detectDrift(graph);
    const result = healGraph(graph, report);

    expect(result.graph.edges.some((e) => e.from === "node:ghost")).toBe(false);
    expect(result.graph.edges.some((e) => e.from === "function:auth" && e.to === "api:products")).toBe(true);
    expect(result.issuesFixed).toBeGreaterThanOrEqual(1);
    expect(result.summary.some((s) => s.includes("Removed broken edge"))).toBe(true);
  });

  it("adds missing edges from contract calls", () => {
    const graph = makeGraph({
      nodes: makeGraph().nodes.map((n) =>
        n.id === "function:auth"
          ? {
              ...n,
              contract: {
                ...emptyContract(),
                calls: [{ target: "GET /products", kind: "calls" as const }]
              }
            }
          : n
      )
    });

    const report = detectDrift(graph);
    const result = healGraph(graph, report);

    expect(result.graph.edges.some(
      (e) => e.from === "function:auth" && e.to === "api:products" && e.kind === "calls"
    )).toBe(true);
    expect(result.issuesFixed).toBeGreaterThanOrEqual(1);
    expect(result.summary.some((s) => s.includes("Added missing edge"))).toBe(true);
  });

  it("does not duplicate edges when healing the same missing edge twice", () => {
    const graph = makeGraph({
      nodes: makeGraph().nodes.map((n) =>
        n.id === "function:auth"
          ? {
              ...n,
              contract: {
                ...emptyContract(),
                calls: [{ target: "GET /products", kind: "calls" as const }]
              }
            }
          : n
      )
    });

    const report = detectDrift(graph);
    const result = healGraph(graph, report);

    const edgesFromAuth = result.graph.edges.filter(
      (e) => e.from === "function:auth" && e.to === "api:products"
    );
    expect(edgesFromAuth).toHaveLength(1);
  });

  it("syncs signature drift to the first contract method signature", () => {
    const correctedSig = "authenticate(token: string, opts?: Options): User";
    const graph = makeGraph({
      nodes: makeGraph().nodes.map((n) =>
        n.id === "function:auth"
          ? {
              ...n,
              signature: "authenticate(token: string): void",
              contract: {
                ...emptyContract(),
                methods: [
                  {
                    name: "authenticate",
                    signature: correctedSig,
                    summary: "Auth.",
                    inputs: [],
                    outputs: [],
                    sideEffects: [],
                    calls: []
                  }
                ]
              }
            }
          : n
      )
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
      edges: [makeEdge({ from: "node:ghost", to: "function:auth" })]
    });
    const originalEdgeCount = graph.edges.length;

    const report = detectDrift(graph);
    healGraph(graph, report);

    expect(graph.edges).toHaveLength(originalEdgeCount);
  });

  it("includes projectName and healedAt in the result", () => {
    const graph = makeGraph();
    const report = detectDrift(graph);
    const result = healGraph(graph, report);

    expect(result.projectName).toBe("TestApp");
    expect(result.healedAt).toBeTruthy();
    expect(result.provenance).toBe("deterministic");
    expect(result.maturity).toBe("preview");
    expect(result.scope).toBe("graph");
  });

  it("synthesises one edge per distinct (from, to, kind) when a node has multiple calls to the same target with different kinds", () => {
    // authenticate calls GET /products with both "calls" and "reads-state".
    const graph = makeGraph({
      nodes: makeGraph().nodes.map((n) =>
        n.id === "function:auth"
          ? {
              ...n,
              contract: {
                ...emptyContract(),
                calls: [
                  { target: "GET /products", kind: "calls" as const },
                  { target: "GET /products", kind: "reads-state" as const }
                ]
              }
            }
          : n
      )
    });

    const report = detectDrift(graph);
    const missingIssues = report.issues.filter((i) => i.kind === "missing-edge");
    // Both calls are missing → two distinct missing-edge issues.
    expect(missingIssues).toHaveLength(2);

    const result = healGraph(graph, report);

    // Each (from, to, kind) triplet must produce its own edge.
    const callsEdges = result.graph.edges.filter(
      (e) => e.from === "function:auth" && e.to === "api:products" && e.kind === "calls"
    );
    const readsEdges = result.graph.edges.filter(
      (e) => e.from === "function:auth" && e.to === "api:products" && e.kind === "reads-state"
    );
    expect(callsEdges).toHaveLength(1);
    expect(readsEdges).toHaveLength(1);
    // Neither edge should be silently dropped.
    expect(result.issuesFixed).toBe(2);
  });
});
