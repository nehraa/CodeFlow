import { z } from "zod";
// ── Primitive enums (required by genetic.ts) ────────────────────────────────────
export const architectureStyleSchema = z.enum(["monolith", "microservices", "serverless"]);
export const nodeKindSchema = z.enum(["module", "api", "class", "function", "ui-screen"]);
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
export const nodeStatusSchema = z.enum(["spec_only", "implemented", "verified", "connected"]);
export const outputProvenanceSchema = z.enum([
    "deterministic",
    "ai",
    "heuristic",
    "simulated",
    "observed",
]);
export const featureMaturitySchema = z.enum([
    "production",
    "preview",
    "experimental",
    "scaffold",
]);
// ── Contract & References ───────────────────────────────────────────────────────
export const contractFieldSchema = z.object({
    name: z.string(),
    type: z.string(),
    description: z.string().optional(),
});
export const methodSpecSchema = z.object({
    name: z.string(),
    signature: z.string().optional(),
    summary: z.string(),
    inputs: z.array(contractFieldSchema).default([]),
    outputs: z.array(contractFieldSchema).default([]),
    sideEffects: z.array(z.string()).default([]),
    calls: z.array(z.object({ target: z.string() })).default([]),
});
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
export const sourceRefSchema = z.object({
    kind: z.enum(["prd", "repo", "generated", "trace"]),
    path: z.string().optional(),
    symbol: z.string().optional(),
    section: z.string().optional(),
    detail: z.string().optional(),
});
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
export const blueprintEdgeSchema = z.object({
    from: z.string(),
    to: z.string(),
    kind: edgeKindSchema,
    label: z.string().optional(),
    required: z.boolean(),
    confidence: z.number().min(0).max(1),
});
// ── Graph ───────────────────────────────────────────────────────────────────────
export const blueprintPhaseSchema = z.enum(["spec", "implementation", "integration"]);
export const blueprintGraphSchema = z.object({
    projectName: z.string(),
    phase: blueprintPhaseSchema.default("spec"),
    generatedAt: z.string().optional(),
    nodes: z.array(blueprintNodeSchema),
    edges: z.array(blueprintEdgeSchema),
    workflows: z.array(z.object({ name: z.string(), steps: z.array(z.string()) })).default([]),
    warnings: z.array(z.string()).default([]),
});
// ── Genetic Algorithm Types ───────────────────────────────────────────────────
export const variantBenchmarkSchema = z.object({
    scalability: z.number().min(0).max(100),
    estimatedCostScore: z.number().min(0).max(100),
    performance: z.number().min(0).max(100),
    maintainability: z.number().min(0).max(100),
    fitness: z.number().min(0).max(100),
});
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
// ── Helpers ────────────────────────────────────────────────────────────────────────
export const emptyContract = () => ({
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
//# sourceMappingURL=schema.js.map