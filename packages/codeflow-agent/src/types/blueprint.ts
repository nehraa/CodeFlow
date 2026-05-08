/**
 * Blueprint and related types for codeflow-agent.
 *
 * These types mirror the schema types from @abhinav2203/codeflow-core/schema
 * to avoid circular dependency issues and provide local type definitions.
 */

/**
 * Source reference kinds.
 */
export type SourceRefKind = 'prd' | 'repo' | 'generated' | 'trace';

/**
 * Source reference for a node.
 */
export interface SourceRef {
  kind: SourceRefKind;
  path?: string;
  symbol?: string;
  section?: string;
  detail?: string;
}

/**
 * Node kinds in a blueprint graph.
 */
export type BlueprintNodeKind = 'function' | 'module' | 'api' | 'class' | 'ui-screen';

/**
 * Edge kinds in a blueprint graph.
 */
export type BlueprintEdgeKind = 'imports' | 'calls' | 'inherits' | 'renders' | 'emits' | 'consumes' | 'reads-state' | 'writes-state';

/**
 * Blueprint phase.
 */
export type BlueprintPhase = 'spec' | 'implementation' | 'integration';

/**
 * Execution mode for blueprint generation.
 */
export type BlueprintExecutionMode = 'essential' | 'yolo';

/**
 * Node status.
 */
export type NodeStatus = 'spec_only' | 'implemented' | 'verified' | 'connected';

/**
 * Trace status for nodes.
 */
export type TraceStatus = 'error' | 'idle' | 'success' | 'warning';

/**
 * Contract field definition.
 */
export interface ContractField {
  name: string;
  type: string;
  description?: string;
}

/**
 * Design call specification.
 */
export interface DesignCall {
  target: string;
  kind?: BlueprintEdgeKind;
  description?: string;
}

/**
 * Method specification.
 */
export interface MethodSpec {
  name: string;
  signature?: string;
  summary: string;
  inputs: ContractField[];
  outputs: ContractField[];
  sideEffects: string[];
  calls: DesignCall[];
}

/**
 * Code contract specification.
 */
export interface CodeContract {
  summary: string;
  responsibilities: string[];
  inputs: ContractField[];
  outputs: ContractField[];
  attributes: ContractField[];
  methods: MethodSpec[];
  sideEffects: string[];
  errors: string[];
  dependencies: string[];
  calls: DesignCall[];
  uiAccess: string[];
  backendAccess: string[];
  notes: string[];
  sourceRefs: SourceRef[];
}

/**
 * Trace state for a node.
 */
export interface TraceState {
  status: TraceStatus;
  count: number;
  errors: number;
  totalDurationMs: number;
  lastSpanIds: string[];
}

/**
 * MCPServer configuration for a node.
 */
export interface MCPServerConfig {
  serverUrl: string;
  label?: string;
  headersRef?: string;
  enabledTools?: string[];
}

/**
 * Last verification result for a node.
 */
export interface LastVerification {
  verifiedAt: string;
  status: 'success' | 'failure';
  stdout: string;
  stderr: string;
  exitCode?: number;
}

/**
 * A node in the blueprint graph.
 */
export interface BlueprintNode {
  id: string;
  kind: BlueprintNodeKind;
  name: string;
  summary: string;
  path?: string;
  ownerId?: string;
  signature?: string;
  contract: CodeContract;
  sourceRefs: SourceRef[];
  generatedRefs: string[];
  traceRefs: string[];
  traceState?: TraceState;
  status?: NodeStatus;
  specDraft?: string;
  implementationDraft?: string;
  lastVerification?: LastVerification;
  mcpServers?: MCPServerConfig[];
  /**
   * Target language for code generation. Defaults to 'typescript'.
   * When set, codeflow-agent generates scaffold code in the specified language.
   */
  language?: 'typescript' | 'python' | 'go' | 'rust';
}

/**
 * An edge in the blueprint graph.
 */
export interface BlueprintEdge {
  from: string;
  to: string;
  kind: BlueprintEdgeKind;
  label?: string;
  required: boolean;
  confidence: number;
}

/**
 * Workflow definition.
 */
export interface BlueprintWorkflow {
  name: string;
  steps: string[];
}

/**
 * A complete blueprint graph with nodes and edges.
 */
export interface BlueprintGraph {
  projectName: string;
  mode: BlueprintExecutionMode;
  generatedAt: string;
  nodes: BlueprintNode[];
  edges: BlueprintEdge[];
  workflows: BlueprintWorkflow[];
  warnings: string[];
}

/**
 * Risk levels for node risk assessment.
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Risk report for a node.
 */
export interface RiskReport {
  level: RiskLevel;
  reasons: string[];
  mitigations: string[];
}