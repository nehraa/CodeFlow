import type {
  ArchitectureStyle,
  ArchitectureVariant,
  BlueprintEdge,
  BlueprintGraph,
  BlueprintNode,
  TournamentResult,
  VariantBenchmark
} from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";
import { computeGraphMetrics } from "@/lib/blueprint/metrics";

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * Benchmark weights used to compute the aggregate fitness score.
 * All weights must sum to 1.0 so that fitness remains in the [0, 100] range
 * — it is a weighted average of four 0–100 subscores.
 */
const BENCHMARK_WEIGHTS = {
  scalability: 0.30,
  estimatedCostScore: 0.20,
  performance: 0.25,
  maintainability: 0.25
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Clamp a number to [0, 100]. */
const clamp100 = (v: number): number => Math.max(0, Math.min(100, Math.round(v)));

/** Create a slim node copy with a new id. */
const cloneNode = (node: BlueprintNode, overrides: Partial<BlueprintNode> = {}): BlueprintNode => ({
  ...node,
  contract: { ...node.contract },
  sourceRefs: [...node.sourceRefs],
  generatedRefs: [...(node.generatedRefs ?? [])],
  traceRefs: [...(node.traceRefs ?? [])],
  ...overrides
});

/** Create a slim edge copy. */
const cloneEdge = (edge: BlueprintEdge, overrides: Partial<BlueprintEdge> = {}): BlueprintEdge => ({
  ...edge,
  ...overrides
});

/** Remove edges whose source or target is not in the node set. */
const pruneEdges = (nodes: BlueprintNode[], edges: BlueprintEdge[]): BlueprintEdge[] => {
  const ids = new Set(nodes.map((n) => n.id));
  return edges.filter((e) => ids.has(e.from) && ids.has(e.to));
};

// ── Variant Generation ─────────────────────────────────────────────────────────

/**
 * Generate a **monolith** variant.
 *
 * All nodes are preserved but re-grouped under a smaller number of aggregated
 * modules.  Intra-group edges become implicit (removed); cross-group edges are
 * kept.  The result is a denser, simpler graph with fewer, larger components.
 */
const generateMonolithVariant = (base: BlueprintGraph, generation: number): BlueprintGraph => {
  // Group nodes by kind.
  const groups = new Map<string, BlueprintNode[]>();
  for (const node of base.nodes) {
    const list = groups.get(node.kind) ?? [];
    list.push(node);
    groups.set(node.kind, list);
  }

  // Build one aggregate node per kind group (kept at the first real node's id
  // so that existing edges still resolve correctly).
  const aggregateNodes: BlueprintNode[] = [];
  const memberToAggregate = new Map<string, string>();

  for (const [kind, members] of groups) {
    if (members.length === 0) continue;
    const representative = members[0];
    const aggregateId = `monolith:${kind}`;
    const aggregate = cloneNode(representative, {
      id: aggregateId,
      name: `${kind.charAt(0).toUpperCase() + kind.slice(1)} Layer`,
      summary: `Aggregated ${kind} components (${members.length} nodes merged).`,
      kind: representative.kind,
      contract: {
        ...emptyContract(),
        summary: `Handles all ${kind} responsibilities.`,
        responsibilities: members.map((m) => m.name)
      }
    });
    aggregateNodes.push(aggregate);
    for (const member of members) {
      memberToAggregate.set(member.id, aggregateId);
    }
  }

  // Remap edges to aggregate nodes; drop self-loops introduced by merging.
  const remappedEdges: BlueprintEdge[] = [];
  const seenEdges = new Set<string>();
  for (const edge of base.edges) {
    const from = memberToAggregate.get(edge.from) ?? edge.from;
    const to = memberToAggregate.get(edge.to) ?? edge.to;
    if (from === to) continue;
    const key = `${from}|${to}|${edge.kind}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    remappedEdges.push(cloneEdge(edge, { from, to }));
  }

  return {
    ...base,
    phase: base.phase ?? "spec",
    projectName: `${base.projectName} (Monolith gen${generation})`,
    generatedAt: new Date().toISOString(),
    nodes: aggregateNodes,
    edges: remappedEdges,
    workflows: [],
    warnings: []
  };
};

/**
 * Generate a **microservices** variant.
 *
 * Each existing module/class node becomes its own service with a dedicated API
 * gateway node.  Services communicate exclusively through API calls.
 */
const generateMicroservicesVariant = (base: BlueprintGraph, generation: number): BlueprintGraph => {
  const serviceNodes: BlueprintNode[] = [];
  const apiNodes: BlueprintNode[] = [];
  const serviceEdges: BlueprintEdge[] = [];

  // Turn each non-API, non-UI node into a micro-service + API gateway pair.
  const coreNodes = base.nodes.filter((n) => n.kind !== "ui-screen");
  const uiNodes = base.nodes.filter((n) => n.kind === "ui-screen");

  const nodeToApi = new Map<string, string>();

  for (const node of coreNodes) {
    const svcId = `svc:${node.id}`;
    const apiId = `api:${node.id}`;
    nodeToApi.set(node.id, apiId);

    serviceNodes.push(
      cloneNode(node, {
        id: svcId,
        name: `${node.name} Service`,
        summary: `Microservice encapsulating ${node.name}.`,
        kind: "module"
      })
    );
    apiNodes.push(
      cloneNode(node, {
        id: apiId,
        name: `${node.name} API`,
        summary: `REST gateway for ${node.name} Service.`,
        kind: "api",
        contract: {
          ...emptyContract(),
          summary: `REST gateway for ${node.name}.`
        }
      })
    );

    // Wire: API → Service.
    serviceEdges.push({
      from: apiId,
      to: svcId,
      kind: "calls",
      required: true,
      confidence: 0.9
    });
  }

  // Re-wire original edges as API-to-API calls.
  const seenEdges = new Set<string>();
  for (const edge of base.edges) {
    const fromApi = nodeToApi.get(edge.from);
    const toApi = nodeToApi.get(edge.to);
    if (!fromApi || !toApi || fromApi === toApi) continue;
    const key = `${fromApi}|${toApi}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    serviceEdges.push({
      from: fromApi,
      to: toApi,
      kind: "calls",
      required: edge.required,
      confidence: edge.confidence
    });
  }

  // Keep UI nodes as-is and connect them to the appropriate API.
  const uiEdges: BlueprintEdge[] = [];
  for (const uiNode of uiNodes) {
    const relatedApi = base.edges
      .filter((e) => e.from === uiNode.id || e.to === uiNode.id)
      .map((e) => nodeToApi.get(e.from === uiNode.id ? e.to : e.from))
      .find((v) => v !== undefined);
    if (relatedApi) {
      uiEdges.push({
        from: uiNode.id,
        to: relatedApi,
        kind: "calls",
        required: true,
        confidence: 0.8
      });
    }
  }

  return {
    ...base,
    phase: base.phase ?? "spec",
    projectName: `${base.projectName} (Microservices gen${generation})`,
    generatedAt: new Date().toISOString(),
    nodes: [...serviceNodes, ...apiNodes, ...uiNodes],
    edges: [...serviceEdges, ...uiEdges],
    warnings: []
  };
};

/**
 * Generate a **serverless** variant.
 *
 * Functions and API handlers become independent serverless lambdas.  Calls are
 * converted to async event-driven edges (emits → consumes) where possible.
 */
const generateServerlessVariant = (base: BlueprintGraph, generation: number): BlueprintGraph => {
  // Convert each node to a serverless function.
  const lambdaNodes: BlueprintNode[] = base.nodes.map((node) =>
    cloneNode(node, {
      id: `fn:${node.id}`,
      name: `${node.name} λ`,
      summary: `Serverless function: ${node.summary}`,
      kind: "function"
    })
  );

  const oldToNew = new Map(base.nodes.map((n) => [n.id, `fn:${n.id}`]));

  // Re-wire edges: synchronous calls become event-driven (emits/consumes).
  const seenEdges = new Set<string>();
  const lambdaEdges: BlueprintEdge[] = [];

  for (const edge of base.edges) {
    const from = oldToNew.get(edge.from) ?? edge.from;
    const to = oldToNew.get(edge.to) ?? edge.to;
    if (from === to) continue;
    const key = `${from}|${to}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);

    const newKind: BlueprintEdge["kind"] =
      edge.kind === "calls" ? "emits" : edge.kind === "imports" ? "consumes" : edge.kind;

    lambdaEdges.push(cloneEdge(edge, { from, to, kind: newKind }));
  }

  return {
    ...base,
    phase: base.phase ?? "spec",
    projectName: `${base.projectName} (Serverless gen${generation})`,
    generatedAt: new Date().toISOString(),
    nodes: lambdaNodes,
    edges: lambdaEdges,
    warnings: []
  };
};

// ── Benchmarking ───────────────────────────────────────────────────────────────

/**
 * Compute benchmark scores for an architecture variant graph.
 *
 * Scores are derived from structural graph metrics so the benchmarks are
 * deterministic and require no external AI calls.
 */
export const benchmarkVariant = (graph: BlueprintGraph, style: ArchitectureStyle): VariantBenchmark => {
  const m = computeGraphMetrics(graph);
  const nodeCount = Math.max(1, m.nodeCount);
  const edgeCount = m.edgeCount;
  const density = m.density;
  const components = m.connectedComponents;

  // ── Scalability: isolation between components is key.
  // Higher component count relative to nodes = better isolation = more scalable.
  // Microservices and serverless score better here.
  // Note: components ≤ nodeCount always (each component has at least one node),
  // so isolationRatio is bounded to [0, 1].
  const isolationRatio = components / nodeCount;
  const scalabilityBase =
    style === "serverless" ? 80
    : style === "microservices" ? 70
    : 40;
  const scalability = clamp100(scalabilityBase + isolationRatio * 20 - density * 15);

  // ── Cost efficiency: simpler topologies are cheaper to run.
  // Monolith is cheapest (one deployment), serverless is most expensive at scale.
  const costBase =
    style === "monolith" ? 80
    : style === "microservices" ? 55
    : 45;
  const edgePenalty = Math.min(edgeCount / Math.max(nodeCount, 1), 5) * 3;
  const estimatedCostScore = clamp100(costBase - edgePenalty);

  // ── Performance: fewer network hops (lower edge count per node) = faster.
  // Also consider avg degree (high degree = fan-out latency).
  const avgDegree = m.avgDegree;
  const performanceBase =
    style === "monolith" ? 75
    : style === "microservices" ? 60
    : 65;
  const performancePenalty = Math.min(avgDegree * 2, 20);
  const performance = clamp100(performanceBase - performancePenalty + m.leafNodes * 0.5);

  // ── Maintainability: lower density and fewer isolated nodes = easier to work with.
  const maintainabilityBase =
    style === "microservices" ? 75
    : style === "serverless" ? 70
    : 55;
  const maintainability = clamp100(
    maintainabilityBase - density * 20 - m.isolatedNodes * 2 + m.avgMethodsPerNode * 0.5
  );

  const fitness = clamp100(
    scalability * BENCHMARK_WEIGHTS.scalability +
    estimatedCostScore * BENCHMARK_WEIGHTS.estimatedCostScore +
    performance * BENCHMARK_WEIGHTS.performance +
    maintainability * BENCHMARK_WEIGHTS.maintainability
  );

  return { scalability, estimatedCostScore, performance, maintainability, fitness };
};

// ── Crossover & Mutation ───────────────────────────────────────────────────────

/**
 * Cross two variants by taking nodes from `a` and edges from `b` (where both
 * endpoints exist in the node set of `a`), then cleaning up unreachable nodes.
 */
const crossover = (
  a: ArchitectureVariant,
  b: ArchitectureVariant,
  generation: number,
  idx: number
): ArchitectureVariant => {
  const nodesFromA = [...a.graph.nodes];
  const aNodeIds = new Set(nodesFromA.map((n) => n.id));

  // Take edges from b that connect nodes present in a (structural crossover).
  const crossEdges = pruneEdges(nodesFromA, b.graph.edges);
  // Also keep edges from a that are not already included.
  const crossEdgeKeys = new Set(crossEdges.map((e) => `${e.from}|${e.to}|${e.kind}`));
  for (const edge of a.graph.edges) {
    const key = `${edge.from}|${edge.to}|${edge.kind}`;
    if (!crossEdgeKeys.has(key) && aNodeIds.has(edge.from) && aNodeIds.has(edge.to)) {
      crossEdges.push(edge);
    }
  }

  // Decide style: inherit whichever parent has higher fitness.
  const style: ArchitectureStyle = a.benchmark.fitness >= b.benchmark.fitness ? a.style : b.style;

  const childGraph: BlueprintGraph = {
    ...a.graph,
    phase: a.graph.phase ?? "spec",
    projectName: `${a.graph.projectName.split(" (")[0]} (${style} gen${generation}c${idx})`,
    generatedAt: new Date().toISOString(),
    nodes: nodesFromA,
    edges: crossEdges,
    warnings: []
  };

  const benchmark = benchmarkVariant(childGraph, style);

  return {
    id: `variant-gen${generation}-cross-${idx}`,
    style,
    generation,
    graph: childGraph,
    benchmark,
    rank: 0
  };
};

/**
 * Apply a small structural mutation to a variant.
 *
 * Mutations are deterministic given the variant index to keep results stable
 * across test runs — no Math.random() dependency.
 */
const mutate = (
  variant: ArchitectureVariant,
  generation: number,
  idx: number
): ArchitectureVariant => {
  const nodes = [...variant.graph.nodes];
  const edges = [...variant.graph.edges];

  // Mutation type is determined by index parity (fully deterministic).
  if (nodes.length > 2 && idx % 3 === 0) {
    // Remove a leaf node (lowest connectivity).
    const degrees = new Map<string, number>();
    for (const node of nodes) degrees.set(node.id, 0);
    for (const edge of edges) {
      degrees.set(edge.from, (degrees.get(edge.from) ?? 0) + 1);
      degrees.set(edge.to, (degrees.get(edge.to) ?? 0) + 1);
    }
    const leafId = [...degrees.entries()]
      .filter(([, d]) => d <= 1)
      .sort((a, b) => a[1] - b[1])[0]?.[0];
    if (leafId) {
      const prunedNodes = nodes.filter((n) => n.id !== leafId);
      const prunedEdges = pruneEdges(prunedNodes, edges);
      const mutatedGraph: BlueprintGraph = {
        ...variant.graph,
        phase: variant.graph.phase ?? "spec",
        projectName: `${variant.graph.projectName.split(" (")[0]} (${variant.style} gen${generation}m${idx})`,
        generatedAt: new Date().toISOString(),
        nodes: prunedNodes,
        edges: prunedEdges
      };
      return {
        ...variant,
        id: `variant-gen${generation}-mut-${idx}`,
        generation,
        graph: mutatedGraph,
        benchmark: benchmarkVariant(mutatedGraph, variant.style)
      };
    }
  } else if (edges.length > 0 && idx % 3 === 1) {
    // Remove the edge with the lowest confidence.
    const sortedEdges = [...edges].sort((a, b) => a.confidence - b.confidence);
    const prunedEdges = sortedEdges.slice(1);
    const mutatedGraph: BlueprintGraph = {
      ...variant.graph,
      phase: variant.graph.phase ?? "spec",
      projectName: `${variant.graph.projectName.split(" (")[0]} (${variant.style} gen${generation}m${idx})`,
      generatedAt: new Date().toISOString(),
      nodes,
      edges: prunedEdges
    };
    return {
      ...variant,
      id: `variant-gen${generation}-mut-${idx}`,
      generation,
      graph: mutatedGraph,
      benchmark: benchmarkVariant(mutatedGraph, variant.style)
    };
  }

  // Default: no structural change, just re-benchmark with updated generation tag.
  const mutatedGraph: BlueprintGraph = {
    ...variant.graph,
    phase: variant.graph.phase ?? "spec",
    projectName: `${variant.graph.projectName.split(" (")[0]} (${variant.style} gen${generation}m${idx})`,
    generatedAt: new Date().toISOString(),
    nodes,
    edges
  };
  return {
    ...variant,
    id: `variant-gen${generation}-mut-${idx}`,
    generation,
    graph: mutatedGraph,
    benchmark: benchmarkVariant(mutatedGraph, variant.style)
  };
};

// ── Tournament Selection ───────────────────────────────────────────────────────

/** Sort variants by fitness descending and assign 1-based ranks. */
const rankVariants = (variants: ArchitectureVariant[]): ArchitectureVariant[] =>
  [...variants]
    .sort((a, b) => b.benchmark.fitness - a.benchmark.fitness)
    .map((v, i) => ({ ...v, rank: i + 1 }));

/** Select the top `k` variants by fitness for the next generation. */
const selectSurvivors = (variants: ArchitectureVariant[], k: number): ArchitectureVariant[] =>
  rankVariants(variants).slice(0, k);

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generate the initial population of architecture variants from a base graph.
 *
 * Returns one variant per architectural style.  Additional variants are
 * produced by mutating the base styles to reach the requested population size.
 */
export const generateInitialPopulation = (
  base: BlueprintGraph,
  populationSize: number
): ArchitectureVariant[] => {
  const styles: ArchitectureStyle[] = ["monolith", "microservices", "serverless"];
  const generators = [
    generateMonolithVariant,
    generateMicroservicesVariant,
    generateServerlessVariant
  ];

  const variants: ArchitectureVariant[] = styles.map((style, i) => {
    const graph = generators[i](base, 0);
    const benchmark = benchmarkVariant(graph, style);
    return {
      id: `variant-gen0-${style}`,
      style,
      generation: 0,
      graph,
      benchmark,
      rank: 0
    };
  });

  // Fill up to populationSize by mutating the base variants.
  let extraIdx = 0;
  while (variants.length < populationSize) {
    const source = variants[extraIdx % styles.length];
    variants.push(mutate(source, 0, extraIdx));
    extraIdx++;
  }

  return rankVariants(variants);
};

/**
 * Run a full evolutionary tournament.
 *
 * Starting from the base graph, the algorithm:
 * 1. Creates the initial population of architecture variants.
 * 2. For each generation: selects the top survivors, produces offspring via
 *    crossover and mutation, then re-ranks the combined pool.
 * 3. Returns the full {@link TournamentResult} including all final variants and
 *    the winning architecture.
 */
export const evolveArchitectures = (
  base: BlueprintGraph,
  options: { generations: number; populationSize: number }
): TournamentResult => {
  const { generations, populationSize } = options;

  let population = generateInitialPopulation(base, populationSize);

  for (let gen = 1; gen <= generations; gen++) {
    // Keep the best half as survivors.
    const survivors = selectSurvivors(population, Math.max(2, Math.floor(populationSize / 2)));

    const offspring: ArchitectureVariant[] = [];

    // Crossover pairs.
    for (let i = 0; i < survivors.length - 1 && offspring.length < Math.floor(populationSize / 2); i++) {
      offspring.push(crossover(survivors[i], survivors[i + 1], gen, i));
    }

    // Mutation of survivors to fill the rest.
    let mutIdx = 0;
    while (survivors.length + offspring.length < populationSize) {
      const source = survivors[mutIdx % survivors.length];
      offspring.push(mutate(source, gen, mutIdx));
      mutIdx++;
    }

    population = rankVariants([...survivors, ...offspring]);
  }

  const finalPopulation = rankVariants(population);
  const winner = finalPopulation[0];

  const summary = buildTournamentSummary(winner, finalPopulation);

  return {
    projectName: base.projectName,
    evolvedAt: new Date().toISOString(),
    generationCount: generations,
    populationSize: finalPopulation.length,
    variants: finalPopulation,
    winnerId: winner.id,
    summary
  };
};

/** Build a human-readable summary for the winning architecture. */
const buildTournamentSummary = (
  winner: ArchitectureVariant,
  all: ArchitectureVariant[]
): string => {
  const { style, benchmark, graph } = winner;
  const nodeCount = graph.nodes.length;
  const edgeCount = graph.edges.length;

  const styleLabel =
    style === "monolith"
      ? "monolithic"
      : style === "microservices"
      ? "microservices-based"
      : "serverless";

  const runnerUp = all[1];
  const runnerUpLabel = runnerUp
    ? ` Runner-up: ${runnerUp.style} (fitness ${runnerUp.benchmark.fitness}).`
    : "";

  return (
    `The winning architecture is a ${styleLabel} design with ${nodeCount} nodes and ` +
    `${edgeCount} edges (fitness: ${benchmark.fitness}/100). ` +
    `Strengths: scalability ${benchmark.scalability}, performance ${benchmark.performance}, ` +
    `maintainability ${benchmark.maintainability}, cost efficiency ${benchmark.estimatedCostScore}.` +
    runnerUpLabel
  );
};
