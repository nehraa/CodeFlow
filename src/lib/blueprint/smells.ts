import { z } from "zod";

import type { BlueprintGraph } from "@/lib/blueprint/schema";

export const smellSchema = z.object({
  code: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  nodeId: z.string().optional(),
  message: z.string(),
  suggestion: z.string(),
});
export type Smell = z.infer<typeof smellSchema>;

export const smellReportSchema = z.object({
  analyzedAt: z.string(),
  totalSmells: z.number(),
  smells: z.array(smellSchema),
  healthScore: z.number(),
});
export type SmellReport = z.infer<typeof smellReportSchema>;

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

const detectGodNodes = (graph: BlueprintGraph): Smell[] =>
  graph.nodes
    .filter((n) => n.contract.methods.length >= GOD_NODE_MIN_METHODS && n.contract.responsibilities.length >= GOD_NODE_MIN_RESPONSIBILITIES)
    .map((n) => ({
      code: "god-node",
      severity: "critical" as const,
      nodeId: n.id,
      message: `Node "${n.name}" has ${n.contract.methods.length} methods and ${n.contract.responsibilities.length} responsibilities.`,
      suggestion: "Split this node into smaller, focused modules with single responsibilities.",
    }));

const detectHubNodes = (graph: BlueprintGraph): Smell[] => {
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

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
        severity: "warning" as const,
        nodeId: n.id,
        message: `Node "${n.name}" has a total degree of ${total} (in: ${inDegree.get(n.id) ?? 0}, out: ${outDegree.get(n.id) ?? 0}).`,
        suggestion: "Introduce an intermediary or facade to reduce direct dependencies on this node.",
      };
    });
};

const detectOrphanNodes = (graph: BlueprintGraph): Smell[] => {
  const connected = new Set<string>();

  for (const edge of graph.edges) {
    connected.add(edge.from);
    connected.add(edge.to);
  }

  return graph.nodes
    .filter((n) => !connected.has(n.id))
    .map((n) => ({
      code: "orphan-node",
      severity: "info" as const,
      nodeId: n.id,
      message: `Node "${n.name}" has no incoming or outgoing edges.`,
      suggestion: "Verify this node is still needed; it may be dead code or missing connections.",
    }));
};

const detectTightCoupling = (graph: BlueprintGraph): Smell[] => {
  const pairCounts = new Map<string, number>();

  for (const edge of graph.edges) {
    const key = [edge.from, edge.to].sort().join("||");
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }

  const smells: Smell[] = [];
  for (const [key, count] of pairCounts) {
    if (count >= TIGHT_COUPLING_MIN_EDGES) {
      const [a, b] = key.split("||");
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

const detectUnstableDependencies = (graph: BlueprintGraph): Smell[] => {
  const inCount = new Map<string, number>();
  const outCount = new Map<string, number>();

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
      if (inc < UNSTABLE_DEP_MIN_INCOMING || out < UNSTABLE_DEP_MIN_OUTGOING) return false;
      return out / (inc + out) > UNSTABLE_DEP_THRESHOLD;
    })
    .map((n) => {
      const inc = inCount.get(n.id) ?? 0;
      const out = outCount.get(n.id) ?? 0;
      const instability = out / (inc + out);
      return {
        code: "unstable-dependency",
        severity: "warning" as const,
        nodeId: n.id,
        message: `Node "${n.name}" has instability ${instability.toFixed(2)} (in: ${inc}, out: ${out}) and is depended upon.`,
        suggestion: "Stabilize this node by reducing its outgoing dependencies or shielding dependents with an abstraction.",
      };
    });
};

const detectScatteredResponsibility = (graph: BlueprintGraph): Smell[] =>
  graph.nodes
    .filter((n) => n.contract.sideEffects.length >= SCATTERED_MIN_SIDE_EFFECTS)
    .map((n) => ({
      code: "scattered-responsibility",
      severity: "info" as const,
      nodeId: n.id,
      message: `Node "${n.name}" declares ${n.contract.sideEffects.length} side effects.`,
      suggestion: "Extract side effects into dedicated service nodes to improve testability and clarity.",
    }));

const computeHealthScore = (smells: Smell[]): number => {
  let score = 100;

  for (const smell of smells) {
    if (smell.severity === "critical") score -= CRITICAL_PENALTY;
    else if (smell.severity === "warning") score -= WARNING_PENALTY;
    else score -= INFO_PENALTY;
  }

  return Math.max(0, score);
};

export const detectSmells = (graph: BlueprintGraph): SmellReport => {
  const smells: Smell[] = [
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
