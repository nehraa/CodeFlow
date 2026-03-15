import { z } from "zod";

export const executionModeSchema = z.enum(["essential", "yolo"]);
export type ExecutionMode = z.infer<typeof executionModeSchema>;

export const blueprintPhaseSchema = z.enum(["spec", "implementation", "integration"]);
export type BlueprintPhase = z.infer<typeof blueprintPhaseSchema>;

export const nodeStatusSchema = z.enum(["spec_only", "implemented", "verified", "connected"]);
export type NodeStatus = z.infer<typeof nodeStatusSchema>;

export const nodeKindSchema = z.enum([
  "module",
  "api",
  "class",
  "function",
  "ui-screen"
]);
export type BlueprintNodeKind = z.infer<typeof nodeKindSchema>;

export const edgeKindSchema = z.enum([
  "imports",
  "calls",
  "inherits",
  "renders",
  "emits",
  "consumes",
  "reads-state",
  "writes-state"
]);
export type BlueprintEdgeKind = z.infer<typeof edgeKindSchema>;

export const traceStatusSchema = z.enum(["idle", "success", "warning", "error"]);
export type TraceStatus = z.infer<typeof traceStatusSchema>;

export const contractFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string().optional()
});
export type ContractField = z.infer<typeof contractFieldSchema>;

export const designCallSchema = z.object({
  target: z.string(),
  kind: z.enum(["calls", "imports", "inherits", "renders", "emits", "consumes", "reads-state", "writes-state"]).optional(),
  description: z.string().optional()
});
export type DesignCall = z.infer<typeof designCallSchema>;

export const methodSpecSchema = z.object({
  name: z.string(),
  signature: z.string().optional(),
  summary: z.string(),
  inputs: z.array(contractFieldSchema),
  outputs: z.array(contractFieldSchema),
  sideEffects: z.array(z.string()),
  calls: z.array(designCallSchema)
});
export type MethodSpec = z.infer<typeof methodSpecSchema>;

export const codeContractSchema = z.object({
  summary: z.string(),
  responsibilities: z.array(z.string()),
  inputs: z.array(contractFieldSchema),
  outputs: z.array(contractFieldSchema),
  attributes: z.array(contractFieldSchema),
  methods: z.array(methodSpecSchema),
  sideEffects: z.array(z.string()),
  errors: z.array(z.string()),
  dependencies: z.array(z.string()),
  calls: z.array(designCallSchema),
  uiAccess: z.array(z.string()),
  backendAccess: z.array(z.string()),
  notes: z.array(z.string())
});
export type CodeContract = z.infer<typeof codeContractSchema>;

export const sourceRefSchema = z.object({
  kind: z.enum(["prd", "repo", "generated", "trace"]),
  path: z.string().optional(),
  symbol: z.string().optional(),
  section: z.string().optional(),
  detail: z.string().optional()
});
export type SourceRef = z.infer<typeof sourceRefSchema>;

export const traceStateSchema = z.object({
  status: traceStatusSchema,
  count: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  totalDurationMs: z.number().nonnegative(),
  lastSpanIds: z.array(z.string())
});
export type TraceState = z.infer<typeof traceStateSchema>;

export const nodeVerificationSchema = z.object({
  verifiedAt: z.string(),
  status: z.enum(["success", "failure"]),
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number().optional()
});
export type NodeVerification = z.infer<typeof nodeVerificationSchema>;

export const mcpToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.record(z.string(), z.unknown()).optional()
});
export type McpTool = z.infer<typeof mcpToolSchema>;

export const mcpServerConfigSchema = z.object({
  serverUrl: z.string().min(1),
  label: z.string().optional(),
  // Reference or label for headers/credentials configuration.
  // Actual secret header values must be managed outside persisted blueprints.
  headersRef: z.string().optional(),
  enabledTools: z.array(z.string()).optional()
});
export type McpServerConfig = z.infer<typeof mcpServerConfigSchema>;

export const mcpToolResultContentSchema = z.object({
  type: z.string(),
  text: z.string().optional()
});
export type McpToolResultContent = z.infer<typeof mcpToolResultContentSchema>;

export const mcpToolResultSchema = z.object({
  content: z.array(mcpToolResultContentSchema),
  isError: z.boolean().optional()
});
export type McpToolResult = z.infer<typeof mcpToolResultSchema>;

export const blueprintNodeSchema = z.object({
  id: z.string(),
  kind: nodeKindSchema,
  name: z.string(),
  summary: z.string(),
  path: z.string().optional(),
  ownerId: z.string().optional(),
  signature: z.string().optional(),
  contract: codeContractSchema,
  sourceRefs: z.array(sourceRefSchema),
  generatedRefs: z.array(z.string()),
  traceRefs: z.array(z.string()),
  traceState: traceStateSchema.optional(),
  status: nodeStatusSchema.default("spec_only"),
  specDraft: z.string().optional(),
  implementationDraft: z.string().optional(),
  lastVerification: nodeVerificationSchema.optional(),
  mcpServers: z.array(mcpServerConfigSchema).optional()
});
export type BlueprintNode = z.input<typeof blueprintNodeSchema>;

export const blueprintEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  kind: edgeKindSchema,
  label: z.string().optional(),
  required: z.boolean(),
  confidence: z.number().min(0).max(1)
});
export type BlueprintEdge = z.infer<typeof blueprintEdgeSchema>;

export const workflowPathSchema = z.object({
  name: z.string(),
  steps: z.array(z.string())
});
export type WorkflowPath = z.infer<typeof workflowPathSchema>;

export const blueprintGraphSchema = z.object({
  projectName: z.string(),
  mode: executionModeSchema,
  phase: blueprintPhaseSchema.default("spec"),
  generatedAt: z.string(),
  nodes: z.array(blueprintNodeSchema),
  edges: z.array(blueprintEdgeSchema),
  workflows: z.array(workflowPathSchema),
  warnings: z.array(z.string())
});
export type BlueprintGraph = z.input<typeof blueprintGraphSchema>;

export const executionTaskSchema = z.object({
  id: z.string(),
  nodeId: z.string(),
  title: z.string(),
  kind: nodeKindSchema,
  dependsOn: z.array(z.string()),
  ownerPath: z.string().optional(),
  batchIndex: z.number().int().nonnegative()
});
export type ExecutionTask = z.infer<typeof executionTaskSchema>;

export const executionBatchSchema = z.object({
  index: z.number().int().nonnegative(),
  taskIds: z.array(z.string())
});
export type ExecutionBatch = z.infer<typeof executionBatchSchema>;

export const executionTaskStatusSchema = z.enum(["pending", "completed", "skipped", "blocked"]);
export type ExecutionTaskStatus = z.infer<typeof executionTaskStatusSchema>;

export const runPlanSchema = z.object({
  generatedAt: z.string(),
  tasks: z.array(executionTaskSchema),
  batches: z.array(executionBatchSchema),
  warnings: z.array(z.string())
});
export type RunPlan = z.infer<typeof runPlanSchema>;

export const taskExecutionResultSchema = z.object({
  taskId: z.string(),
  nodeId: z.string(),
  status: executionTaskStatusSchema,
  batchIndex: z.number().int().nonnegative(),
  outputPaths: z.array(z.string()),
  managedRegionIds: z.array(z.string()),
  message: z.string()
});
export type TaskExecutionResult = z.infer<typeof taskExecutionResultSchema>;

export const ownershipRecordSchema = z.object({
  path: z.string(),
  nodeId: z.string(),
  managedRegionIds: z.array(z.string()),
  generatedAt: z.string()
});
export type OwnershipRecord = z.infer<typeof ownershipRecordSchema>;

export const executionReportSchema = z.object({
  startedAt: z.string(),
  completedAt: z.string(),
  results: z.array(taskExecutionResultSchema),
  ownership: z.array(ownershipRecordSchema)
});
export type ExecutionReport = z.infer<typeof executionReportSchema>;

export const riskFactorSchema = z.object({
  code: z.string(),
  message: z.string(),
  score: z.number().int().nonnegative()
});
export type RiskFactor = z.infer<typeof riskFactorSchema>;

export const riskReportSchema = z.object({
  score: z.number().int().nonnegative(),
  level: z.enum(["low", "medium", "high"]),
  requiresApproval: z.boolean(),
  factors: z.array(riskFactorSchema)
});
export type RiskReport = z.infer<typeof riskReportSchema>;

export const approvalRecordSchema = z.object({
  id: z.string(),
  action: z.enum(["export"]),
  projectName: z.string(),
  status: z.enum(["pending", "approved"]),
  fingerprint: z.string(),
  requestedAt: z.string(),
  approvedAt: z.string().optional(),
  outputDir: z.string(),
  runPlan: runPlanSchema,
  riskReport: riskReportSchema
});
export type ApprovalRecord = z.infer<typeof approvalRecordSchema>;

export const exportResultSchema = z.object({
  rootDir: z.string(),
  blueprintPath: z.string(),
  canvasPath: z.string(),
  docsDir: z.string(),
  stubsDir: z.string(),
  phaseManifestPath: z.string().optional(),
  integrationEntrypointPath: z.string().optional(),
  ownershipPath: z.string().optional(),
  obsidianIndexPath: z.string().optional(),
  diffPath: z.string().optional(),
  sandboxDir: z.string().optional(),
  checkpointDir: z.string().optional()
});
export type ExportResult = z.infer<typeof exportResultSchema>;

export const persistedSessionSchema = z.object({
  sessionId: z.string(),
  projectName: z.string(),
  updatedAt: z.string(),
  graph: blueprintGraphSchema,
  runPlan: runPlanSchema,
  lastRiskReport: riskReportSchema.optional(),
  lastExportResult: exportResultSchema.optional(),
  lastExecutionReport: executionReportSchema.optional(),
  approvalIds: z.array(z.string())
});
export type PersistedSession = z.infer<typeof persistedSessionSchema>;

export const runRecordSchema = z.object({
  id: z.string(),
  projectName: z.string(),
  action: z.enum(["build", "export"]),
  createdAt: z.string(),
  runPlan: runPlanSchema,
  riskReport: riskReportSchema.optional(),
  approvalId: z.string().optional(),
  executionReport: executionReportSchema.optional(),
  exportResult: exportResultSchema.optional()
});
export type RunRecord = z.infer<typeof runRecordSchema>;

export const traceSpanSchema = z.object({
  spanId: z.string(),
  traceId: z.string(),
  name: z.string(),
  blueprintNodeId: z.string().optional(),
  path: z.string().optional(),
  status: z.enum(["success", "warning", "error"]),
  durationMs: z.number().nonnegative(),
  runtime: z.string().default("unknown"),
  timestamp: z.string().optional()
});
export type TraceSpan = z.infer<typeof traceSpanSchema>;

export const observabilityLogSchema = z.object({
  id: z.string(),
  level: z.enum(["debug", "info", "warn", "error"]),
  message: z.string(),
  blueprintNodeId: z.string().optional(),
  path: z.string().optional(),
  runtime: z.string().default("unknown"),
  timestamp: z.string()
});
export type ObservabilityLog = z.infer<typeof observabilityLogSchema>;

export const observabilityIngestRequestSchema = z.object({
  projectName: z.string().min(1),
  spans: z.array(traceSpanSchema).default([]),
  logs: z.array(observabilityLogSchema).default([])
});
export type ObservabilityIngestRequest = z.infer<typeof observabilityIngestRequestSchema>;

export const observabilitySnapshotSchema = z.object({
  projectName: z.string(),
  updatedAt: z.string(),
  spans: z.array(traceSpanSchema),
  logs: z.array(observabilityLogSchema),
  graph: blueprintGraphSchema.optional()
});
export type ObservabilitySnapshot = z.infer<typeof observabilitySnapshotSchema>;

export const conflictKindSchema = z.enum([
  "missing-in-repo",
  "missing-in-blueprint",
  "signature-mismatch",
  "summary-mismatch"
]);
export type ConflictKind = z.infer<typeof conflictKindSchema>;

export const conflictRecordSchema = z.object({
  kind: conflictKindSchema,
  nodeId: z.string().optional(),
  path: z.string().optional(),
  blueprintValue: z.string().optional(),
  repoValue: z.string().optional(),
  message: z.string(),
  suggestedAction: z.string()
});
export type ConflictRecord = z.infer<typeof conflictRecordSchema>;

export const conflictReportSchema = z.object({
  checkedAt: z.string(),
  repoPath: z.string(),
  conflicts: z.array(conflictRecordSchema)
});
export type ConflictReport = z.infer<typeof conflictReportSchema>;

export const conflictCheckRequestSchema = z.object({
  graph: blueprintGraphSchema,
  repoPath: z.string().min(1)
});
export type ConflictCheckRequest = z.infer<typeof conflictCheckRequestSchema>;

export const buildBlueprintRequestSchema = z.object({
  projectName: z.string().min(1),
  repoPath: z.string().trim().optional(),
  prdText: z.string().trim().optional(),
  mode: executionModeSchema
});
export type BuildBlueprintRequest = z.infer<typeof buildBlueprintRequestSchema>;

export const exportBlueprintRequestSchema = z.object({
  graph: blueprintGraphSchema,
  outputDir: z.string().trim().optional(),
  approvalId: z.string().trim().optional(),
  codeDrafts: z.record(z.string(), z.string()).optional()
});
export type ExportBlueprintRequest = z.infer<typeof exportBlueprintRequestSchema>;

export const approvalActionRequestSchema = z.object({
  approvalId: z.string().min(1)
});
export type ApprovalActionRequest = z.infer<typeof approvalActionRequestSchema>;

export const runtimeExecutionRequestSchema = z.object({
  graph: blueprintGraphSchema,
  targetNodeId: z.string().optional(), // If running a single node
  input: z.string(), // User prompt/input
  codeDrafts: z.record(z.string(), z.string()).optional() // For Phase 2, we might pass drafts
});
export type RuntimeExecutionRequest = z.infer<typeof runtimeExecutionRequestSchema>;

export const runtimeExecutionResultSchema = z.object({
  success: z.boolean(),
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number().nullable(),
  durationMs: z.number(),
  executedPath: z.string().optional(),
  error: z.string().optional()
});
export type RuntimeExecutionResult = z.infer<typeof runtimeExecutionResultSchema>;

export const ghostNodeSchema = z.object({
  id: z.string(),
  kind: nodeKindSchema,
  name: z.string(),
  summary: z.string(),
  reason: z.string(),
  suggestedEdge: z
    .object({
      from: z.string(),
      to: z.string(),
      kind: edgeKindSchema
    })
    .optional()
});
export type GhostNode = z.infer<typeof ghostNodeSchema>;

export const ghostSuggestionsResponseSchema = z.object({
  suggestions: z.array(ghostNodeSchema)
});
export type GhostSuggestionsResponse = z.infer<typeof ghostSuggestionsResponseSchema>;

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
  notes: []
});

export const idleTraceState = (): TraceState => ({
  status: "idle",
  count: 0,
  errors: 0,
  totalDurationMs: 0,
  lastSpanIds: []
});

// ── Time-Travel Branching ──────────────────────────────────────────────────

export const graphBranchSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  projectName: z.string(),
  parentBranchId: z.string().optional(),
  createdAt: z.string(),
  graph: blueprintGraphSchema
});
export type GraphBranch = z.infer<typeof graphBranchSchema>;

export const nodeDiffKindSchema = z.enum(["added", "removed", "modified", "unchanged"]);
export type NodeDiffKind = z.infer<typeof nodeDiffKindSchema>;

export const edgeDiffKindSchema = z.enum(["added", "removed", "unchanged"]);
export type EdgeDiffKind = z.infer<typeof edgeDiffKindSchema>;

export const nodeDiffSchema = z.object({
  nodeId: z.string(),
  name: z.string(),
  kind: nodeDiffKindSchema,
  before: blueprintNodeSchema.optional(),
  after: blueprintNodeSchema.optional(),
  impactedEdgeCount: z.number().int().nonnegative()
});
export type NodeDiff = z.infer<typeof nodeDiffSchema>;

export const edgeDiffSchema = z.object({
  from: z.string(),
  to: z.string(),
  edgeKind: edgeKindSchema,
  diffKind: edgeDiffKindSchema
});
export type EdgeDiff = z.infer<typeof edgeDiffSchema>;

export const branchDiffSchema = z.object({
  baseId: z.string(),
  compareId: z.string(),
  addedNodes: z.number().int().nonnegative(),
  removedNodes: z.number().int().nonnegative(),
  modifiedNodes: z.number().int().nonnegative(),
  addedEdges: z.number().int().nonnegative(),
  removedEdges: z.number().int().nonnegative(),
  impactedNodeIds: z.array(z.string()),
  nodeDiffs: z.array(nodeDiffSchema),
  edgeDiffs: z.array(edgeDiffSchema)
});
export type BranchDiff = z.infer<typeof branchDiffSchema>;

// ── VCR Time-Travel Debugging ─────────────────────────────────────────────────

/**
 * A single frame in a VCR recording, representing the cumulative state of the
 * architecture graph immediately after a particular trace span was processed.
 */
export const vcrFrameSchema = z.object({
  /** Zero-based position in the recording timeline. */
  frameIndex: z.number().int().nonnegative(),
  /** The span that produced this frame. */
  spanId: z.string(),
  /** Display label derived from the span name. */
  label: z.string(),
  /** ISO-8601 timestamp when the span occurred (if available). */
  timestamp: z.string().optional(),
  /** The node this span was attributed to (if any). */
  nodeId: z.string().optional(),
  /** Human-readable node name for the UI. */
  nodeName: z.string().optional(),
  /** Status of the span that triggered this frame. */
  status: traceStatusSchema,
  /** Duration of the triggering span in milliseconds. */
  durationMs: z.number().nonnegative(),
  /**
   * Cumulative TraceState for every node at this point in time.
   * Keys are node IDs; absent nodes have idle state.
   */
  nodeStates: z.record(z.string(), traceStateSchema)
});
export type VcrFrame = z.infer<typeof vcrFrameSchema>;

/** A complete VCR recording derived from an observability snapshot. */
export const vcrRecordingSchema = z.object({
  projectName: z.string(),
  recordedAt: z.string(),
  /** Ordered frames — one per trace span, earliest first. */
  frames: z.array(vcrFrameSchema),
  /** Total number of spans that were processed. */
  totalSpans: z.number().int().nonnegative()
});
export type VcrRecording = z.infer<typeof vcrRecordingSchema>;

// ── Digital Twin: Real-Time Production Mirroring ──────────────────────────────

/**
 * A single named user journey inferred from a group of trace spans that share
 * the same traceId.  The steps are the node IDs visited in chronological order.
 */
export const userFlowSchema = z.object({
  /** The traceId that groups all spans belonging to this flow. */
  traceId: z.string(),
  /** Human-readable name derived from the first span in the flow. */
  name: z.string(),
  /** Ordered list of node IDs visited during this flow. */
  nodeIds: z.array(z.string()),
  /** ISO-8601 timestamp of the first span in the flow. */
  startedAt: z.string().optional(),
  /** ISO-8601 timestamp of the last span in the flow. */
  endedAt: z.string().optional(),
  /** Aggregate status of the flow (worst-case across all spans). */
  status: traceSpanSchema.shape.status,
  /** Total wall-clock duration across all spans in the flow, in milliseconds. */
  totalDurationMs: z.number().nonnegative(),
  /** Number of spans in this flow. */
  spanCount: z.number().int().nonnegative()
});
export type UserFlow = z.infer<typeof userFlowSchema>;

/**
 * A point-in-time snapshot of the Digital Twin state: which nodes are active
 * right now and what user flows have been observed.
 */
export const digitalTwinSnapshotSchema = z.object({
  projectName: z.string(),
  /** ISO-8601 timestamp when this snapshot was computed. */
  computedAt: z.string(),
  /**
   * Node IDs that had at least one span within the active time window.
   * The graph itself carries the full trace state; this is the "lit-up" set
   * for the live mirroring overlay.
   */
  activeNodeIds: z.array(z.string()),
  /** All user flows inferred from the current observability snapshot. */
  flows: z.array(userFlowSchema),
  /** The number of seconds used for the "active" time window. */
  activeWindowSecs: z.number().int().positive()
});
export type DigitalTwinSnapshot = z.infer<typeof digitalTwinSnapshotSchema>;

/**
 * Request body for POST /api/digital-twin/simulate.
 * Describes a user action that should be simulated in the Digital Twin.
 */
export const simulateActionRequestSchema = z.object({
  projectName: z.string().min(1),
  /**
   * The node IDs to touch in order.  Synthetic trace spans are generated for
   * each node and ingested into the observability snapshot so that the live
   * overlay lights up.
   */
  nodeIds: z.array(z.string().min(1)).min(1),
  /** Optional label for the synthetic trace (shown in the VCR/span list). */
  label: z.string().optional(),
  /** Runtime tag applied to the synthetic spans.  Defaults to "simulation". */
  runtime: z.string().optional()
});
export type SimulateActionRequest = z.infer<typeof simulateActionRequestSchema>;

// ── Architectural Genetic Algorithms ─────────────────────────────────────────

/** The architectural style applied to a generated variant. */
export const architectureStyleSchema = z.enum(["monolith", "microservices", "serverless"]);
export type ArchitectureStyle = z.infer<typeof architectureStyleSchema>;

/** Benchmark scores (0–100, higher is better) for a single architecture variant. */
export const variantBenchmarkSchema = z.object({
  /** How well the architecture scales under increasing load. */
  scalability: z.number().min(0).max(100),
  /**
   * Cost-efficiency score: 100 = lowest infrastructure cost,
   * 0 = highest infrastructure cost.
   */
  estimatedCostScore: z.number().min(0).max(100),
  /** Predicted runtime performance (latency, throughput). */
  performance: z.number().min(0).max(100),
  /** How easy the codebase is to maintain and extend. */
  maintainability: z.number().min(0).max(100),
  /** Weighted aggregate fitness used for tournament ranking. */
  fitness: z.number().min(0).max(100)
});
export type VariantBenchmark = z.infer<typeof variantBenchmarkSchema>;

/** A single architecture variant produced during the evolutionary tournament. */
export const architectureVariantSchema = z.object({
  /** Unique identifier for this variant. */
  id: z.string(),
  /** The architectural style this variant represents. */
  style: architectureStyleSchema,
  /** Zero-based generation index in which this variant was created. */
  generation: z.number().int().nonnegative(),
  /**
   * The blueprint graph for this variant.
   * Stored as a passthrough so that graphs constructed in code (which use the
   * `z.input` type with optional `phase`) are accepted without re-validation.
   */
  graph: z.custom<BlueprintGraph>(),
  /** Computed benchmark scores. */
  benchmark: variantBenchmarkSchema,
  /** 1-based rank within the final ranked population (1 = best). */
  rank: z.number().int().positive()
});
export type ArchitectureVariant = z.infer<typeof architectureVariantSchema>;

/** Complete result of a genetic architecture tournament. */
export const tournamentResultSchema = z.object({
  projectName: z.string(),
  /** ISO-8601 timestamp when the tournament completed. */
  evolvedAt: z.string(),
  /** Total number of generations that were run. */
  generationCount: z.number().int().positive(),
  /** Number of variants that competed in the tournament. */
  populationSize: z.number().int().positive(),
  /** All variants in the final ranked population, sorted by rank (best first). */
  variants: z.array(architectureVariantSchema),
  /** ID of the winning variant. */
  winnerId: z.string(),
  /** Human-readable summary describing the winning architecture. */
  summary: z.string()
});
export type TournamentResult = z.infer<typeof tournamentResultSchema>;

/** Request body for POST /api/genetic/evolve. */
export const evolveArchitectureRequestSchema = z.object({
  /** The source blueprint graph to evolve from. */
  graph: blueprintGraphSchema,
  /** Number of evolutionary generations to simulate (default 3, max 10). */
  generations: z.number().int().min(1).max(10).default(3),
  /**
   * Number of variants in the population.
   * Must be at least 3 (one per architectural style) and at most 12.
   */
  populationSize: z.number().int().min(3).max(12).default(6)
});
export type EvolveArchitectureRequest = z.infer<typeof evolveArchitectureRequestSchema>;
