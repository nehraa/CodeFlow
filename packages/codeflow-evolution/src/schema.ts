import { z } from "zod";

// ── Primitive enums (required by genetic.ts) ────────────────────────────────────

export const architectureStyleSchema = z.enum(["monolith", "microservices", "serverless"]);
export type ArchitectureStyle = z.infer<typeof architectureStyleSchema>;

export const nodeKindSchema = z.enum(["module", "api", "class", "function", "ui-screen"]);
export type BlueprintNodeKind = z.infer<typeof nodeKindSchema>;

export const edgeKindSchema = z.enum([
  "imports",
  "calls",
  "inherits",
  "renders",
  "emits",
  "consumes",
  "reads-state",
  "writes-state",
]);
export type BlueprintEdgeKind = z.infer<typeof edgeKindSchema>;

export const nodeStatusSchema = z.enum(["spec_only", "implemented", "verified", "connected"]);
export type NodeStatus = z.infer<typeof nodeStatusSchema>;

export const outputProvenanceSchema = z.enum([
  "deterministic",
  "ai",
  "heuristic",
  "simulated",
  "observed",
]);
export type OutputProvenance = z.infer<typeof outputProvenanceSchema>;

export const featureMaturitySchema = z.enum([
  "production",
  "preview",
  "experimental",
  "scaffold",
]);
export type FeatureMaturity = z.infer<typeof featureMaturitySchema>;

// ── Contract & References ───────────────────────────────────────────────────────

export const contractFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
});
export type ContractField = z.infer<typeof contractFieldSchema>;

export const methodSpecSchema = z.object({
  name: z.string(),
  signature: z.string().optional(),
  summary: z.string(),
  inputs: z.array(contractFieldSchema).default([]),
  outputs: z.array(contractFieldSchema).default([]),
  sideEffects: z.array(z.string()).default([]),
  calls: z.array(z.object({ target: z.string() })).default([]),
});
export type MethodSpec = z.infer<typeof methodSpecSchema>;

export const codeContractSchema = z.object({
  summary: z.string(),
  responsibilities: z.array(z.string()),
  inputs: z.array(contractFieldSchema).default([]),
  outputs: z.array(contractFieldSchema).default([]),
  attributes: z.array(contractFieldSchema).default([]),
  methods: z.array(methodSpecSchema).default([]),
  sideEffects: z.array(z.string()).default([]),
  errors: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  calls: z.array(z.object({ target: z.string() })).default([]),
  uiAccess: z.array(z.string()).default([]),
  backendAccess: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
});
export type CodeContract = z.infer<typeof codeContractSchema>;

export const sourceRefSchema = z.object({
  kind: z.enum(["prd", "repo", "generated", "trace"]),
  path: z.string().optional(),
  symbol: z.string().optional(),
  section: z.string().optional(),
  detail: z.string().optional(),
});
export type SourceRef = z.infer<typeof sourceRefSchema>;

// ── Blueprint Node & Edge ───────────────────────────────────────────────────────

export const blueprintNodeSchema = z.object({
  id: z.string(),
  kind: nodeKindSchema,
  name: z.string(),
  summary: z.string(),
  path: z.string().optional(),
  ownerId: z.string().optional(),
  signature: z.string().optional(),
  contract: codeContractSchema,
  sourceRefs: z.array(sourceRefSchema).default([]),
  generatedRefs: z.array(z.string()).default([]),
  traceRefs: z.array(z.string()).default([]),
  status: nodeStatusSchema.default("spec_only"),
  specDraft: z.string().optional(),
  implementationDraft: z.string().optional(),
});
export type BlueprintNode = z.input<typeof blueprintNodeSchema>;
export type MaterializedBlueprintNode = z.infer<typeof blueprintNodeSchema>;

export const blueprintEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  kind: edgeKindSchema,
  label: z.string().optional(),
  required: z.boolean(),
  confidence: z.number().min(0).max(1),
});
export type BlueprintEdge = z.infer<typeof blueprintEdgeSchema>;

// ── Graph ───────────────────────────────────────────────────────────────────────

export const blueprintPhaseSchema = z.enum(["spec", "implementation", "integration"]);
export type BlueprintPhase = z.infer<typeof blueprintPhaseSchema>;

export const blueprintGraphSchema = z.object({
  projectName: z.string(),
  phase: blueprintPhaseSchema.default("spec"),
  generatedAt: z.string().optional(),
  nodes: z.array(blueprintNodeSchema),
  edges: z.array(blueprintEdgeSchema),
  workflows: z.array(z.object({ name: z.string(), steps: z.array(z.string()) })).default([]),
  warnings: z.array(z.string()).default([]),
});
export type BlueprintGraph = z.input<typeof blueprintGraphSchema>;
export type MaterializedBlueprintGraph = z.infer<typeof blueprintGraphSchema>;

// ── Genetic Algorithm Types ───────────────────────────────────────────────────

export const variantBenchmarkSchema = z.object({
  scalability: z.number().min(0).max(100),
  estimatedCostScore: z.number().min(0).max(100),
  performance: z.number().min(0).max(100),
  maintainability: z.number().min(0).max(100),
  fitness: z.number().min(0).max(100),
});
export type VariantBenchmark = z.infer<typeof variantBenchmarkSchema>;

export const architectureVariantSchema = z.object({
  id: z.string(),
  style: architectureStyleSchema,
  generation: z.number().int().nonnegative(),
  graph: blueprintGraphSchema,
  benchmark: variantBenchmarkSchema,
  provenance: outputProvenanceSchema,
  maturity: featureMaturitySchema,
  rank: z.number().int().positive(),
});
export type ArchitectureVariant = z.infer<typeof architectureVariantSchema>;

export const tournamentResultSchema = z.object({
  projectName: z.string(),
  evolvedAt: z.string(),
  provenance: outputProvenanceSchema,
  maturity: featureMaturitySchema,
  generationCount: z.number().int().positive(),
  populationSize: z.number().int().positive(),
  variants: z.array(architectureVariantSchema),
  winnerId: z.string(),
  summary: z.string(),
});
export type TournamentResult = z.infer<typeof tournamentResultSchema>;

// ── Ghost Node ───────────────────────────────────────────────────────────────────

export const ghostNodeSchema = z.object({
  id: z.string(),
  kind: nodeKindSchema,
  name: z.string(),
  summary: z.string(),
  reason: z.string(),
  provenance: outputProvenanceSchema.default("heuristic"),
  maturity: featureMaturitySchema.default("preview"),
  suggestedEdge: z
    .object({
      from: z.string(),
      to: z.string(),
      kind: edgeKindSchema,
    })
    .optional(),
});
export type GhostNode = z.input<typeof ghostNodeSchema>;
export type MaterializedGhostNode = z.infer<typeof ghostNodeSchema>;

// ── Graph Metrics ───────────────────────────────────────────────────────────────

export const graphMetricsSchema = z.object({
  analyzedAt: z.string(),
  nodeCount: z.number(),
  edgeCount: z.number(),
  nodesByKind: z.record(z.string(), z.number()),
  edgesByKind: z.record(z.string(), z.number()),
  nodesByStatus: z.record(z.string(), z.number()),
  density: z.number(),
  avgDegree: z.number(),
  maxInDegree: z.number(),
  maxOutDegree: z.number(),
  maxInDegreeNodeId: z.string().optional(),
  maxOutDegreeNodeId: z.string().optional(),
  avgMethodsPerNode: z.number(),
  avgResponsibilitiesPerNode: z.number(),
  totalMethods: z.number(),
  totalResponsibilities: z.number(),
  connectedComponents: z.number(),
  isolatedNodes: z.number(),
  leafNodes: z.number(),
});
export type GraphMetrics = z.infer<typeof graphMetricsSchema>;

// ── Helpers ────────────────────────────────────────────────────────────────────────

export const emptyContract = (): CodeContract => ({
  summary: "",
  responsibilities: [],
  inputs: [],
  outputs: [],
  attributes: [],
  methods: [],
  sideEffects: [],
  errors: [],
  dependencies: [],
  calls: [],
  uiAccess: [],
  backendAccess: [],
  notes: [],
});