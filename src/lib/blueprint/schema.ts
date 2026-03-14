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
  lastVerification: nodeVerificationSchema.optional()
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
  runtime: z.string().default("unknown")
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
