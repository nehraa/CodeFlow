import { describe, expect, it } from "vitest";

import {
  benchmarkVariant,
  evolveArchitectures,
  generateInitialPopulation
} from "@/lib/blueprint/genetic";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeGraph = (overrides: Partial<BlueprintGraph> = {}): BlueprintGraph => ({
  projectName: "TestApp",
  mode: "essential",
  generatedAt: "2026-03-14T00:00:00.000Z",
  warnings: [],
  workflows: [],
  nodes: [
    {
      id: "mod:auth",
      kind: "module",
      name: "AuthModule",
      summary: "Handles authentication.",
      contract: { ...emptyContract(), summary: "Auth module." },
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    },
    {
      id: "api:users",
      kind: "api",
      name: "GET /users",
      summary: "List users.",
      contract: { ...emptyContract(), summary: "List users." },
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    },
    {
      id: "fn:checkout",
      kind: "function",
      name: "checkout",
      summary: "Process checkout.",
      contract: { ...emptyContract(), summary: "Checkout." },
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    },
    {
      id: "ui:dashboard",
      kind: "ui-screen",
      name: "Dashboard",
      summary: "Main dashboard.",
      contract: { ...emptyContract(), summary: "Dashboard." },
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    }
  ],
  edges: [
    { from: "mod:auth", to: "api:users", kind: "calls", required: true, confidence: 0.9 },
    { from: "api:users", to: "fn:checkout", kind: "calls", required: true, confidence: 0.8 },
    { from: "ui:dashboard", to: "api:users", kind: "calls", required: true, confidence: 0.95 }
  ],
  ...overrides
});

// ── benchmarkVariant ──────────────────────────────────────────────────────────

describe("benchmarkVariant", () => {
  it("returns scores in [0, 100]", () => {
    const graph = makeGraph();
    for (const style of ["monolith", "microservices", "serverless"] as const) {
      const b = benchmarkVariant(graph, style);
      expect(b.scalability).toBeGreaterThanOrEqual(0);
      expect(b.scalability).toBeLessThanOrEqual(100);
      expect(b.estimatedCostScore).toBeGreaterThanOrEqual(0);
      expect(b.estimatedCostScore).toBeLessThanOrEqual(100);
      expect(b.performance).toBeGreaterThanOrEqual(0);
      expect(b.performance).toBeLessThanOrEqual(100);
      expect(b.maintainability).toBeGreaterThanOrEqual(0);
      expect(b.maintainability).toBeLessThanOrEqual(100);
      expect(b.fitness).toBeGreaterThanOrEqual(0);
      expect(b.fitness).toBeLessThanOrEqual(100);
    }
  });

  it("monolith scores higher cost-efficiency than serverless", () => {
    const graph = makeGraph();
    const monolithBenchmark = benchmarkVariant(graph, "monolith");
    const serverlessBenchmark = benchmarkVariant(graph, "serverless");
    expect(monolithBenchmark.estimatedCostScore).toBeGreaterThan(serverlessBenchmark.estimatedCostScore);
  });

  it("serverless scores higher scalability than monolith", () => {
    const graph = makeGraph();
    const monolithBenchmark = benchmarkVariant(graph, "monolith");
    const serverlessBenchmark = benchmarkVariant(graph, "serverless");
    expect(serverlessBenchmark.scalability).toBeGreaterThan(monolithBenchmark.scalability);
  });

  it("handles an empty graph without throwing", () => {
    const emptyGraph = makeGraph({ nodes: [], edges: [] });
    expect(() => benchmarkVariant(emptyGraph, "monolith")).not.toThrow();
  });
});

// ── generateInitialPopulation ─────────────────────────────────────────────────

describe("generateInitialPopulation", () => {
  it("produces exactly the requested population size", () => {
    const graph = makeGraph();
    const pop = generateInitialPopulation(graph, 6);
    expect(pop).toHaveLength(6);
  });

  it("includes all three architectural styles", () => {
    const graph = makeGraph();
    const pop = generateInitialPopulation(graph, 3);
    const styles = pop.map((v) => v.style);
    expect(styles).toContain("monolith");
    expect(styles).toContain("microservices");
    expect(styles).toContain("serverless");
  });

  it("assigns rank 1 to the highest-fitness variant", () => {
    const graph = makeGraph();
    const pop = generateInitialPopulation(graph, 4);
    const topFitness = Math.max(...pop.map((v) => v.benchmark.fitness));
    const rank1 = pop.find((v) => v.rank === 1);
    expect(rank1?.benchmark.fitness).toBe(topFitness);
  });

  it("respects minimum population size of 3", () => {
    const graph = makeGraph();
    const pop = generateInitialPopulation(graph, 3);
    expect(pop.length).toBeGreaterThanOrEqual(3);
  });

  it("each variant graph has at least one node for non-empty base", () => {
    const graph = makeGraph();
    const pop = generateInitialPopulation(graph, 3);
    for (const variant of pop) {
      expect(variant.graph.nodes.length).toBeGreaterThan(0);
    }
  });
});

// ── evolveArchitectures ───────────────────────────────────────────────────────

describe("evolveArchitectures", () => {
  it("returns a TournamentResult with the correct shape", () => {
    const graph = makeGraph();
    const result = evolveArchitectures(graph, { generations: 2, populationSize: 3 });

    expect(result.projectName).toBe("TestApp");
    expect(result.generationCount).toBe(2);
    expect(result.variants.length).toBeGreaterThanOrEqual(3);
    expect(result.winnerId).toBeTruthy();
    expect(result.summary).toBeTruthy();
    expect(typeof result.evolvedAt).toBe("string");
    expect(result.provenance).toBe("heuristic");
    expect(result.maturity).toBe("experimental");
  });

  it("winner has rank 1", () => {
    const graph = makeGraph();
    const result = evolveArchitectures(graph, { generations: 1, populationSize: 3 });
    const winner = result.variants.find((v) => v.id === result.winnerId);
    expect(winner?.rank).toBe(1);
    expect(winner?.provenance).toBe("heuristic");
    expect(winner?.maturity).toBe("experimental");
  });

  it("variants are sorted by rank ascending", () => {
    const graph = makeGraph();
    const result = evolveArchitectures(graph, { generations: 2, populationSize: 4 });
    for (let i = 1; i < result.variants.length; i++) {
      expect(result.variants[i].rank).toBeGreaterThanOrEqual(result.variants[i - 1].rank);
    }
  });

  it("summary mentions the winning style", () => {
    const graph = makeGraph();
    const result = evolveArchitectures(graph, { generations: 1, populationSize: 3 });
    const winner = result.variants.find((v) => v.id === result.winnerId);
    const styleLabels: Record<string, string> = { monolith: "monolithic", microservices: "microservices-based", serverless: "serverless" };
    expect(result.summary).toContain(styleLabels[winner!.style]);
  });

  it("works with a single-node graph", () => {
    const tinyGraph = makeGraph({
      nodes: [makeGraph().nodes[0]],
      edges: []
    });
    expect(() => evolveArchitectures(tinyGraph, { generations: 2, populationSize: 3 })).not.toThrow();
  });

  it("accepts the maximum allowed configuration", () => {
    const graph = makeGraph();
    expect(() =>
      evolveArchitectures(graph, { generations: 10, populationSize: 12 })
    ).not.toThrow();
  });
});
