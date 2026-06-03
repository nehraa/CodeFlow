import type { BlueprintEdge, BlueprintGraph, BlueprintNode, BlueprintNodeKind } from "@abhinav2203/codeflow-core/schema";
import { z } from "zod";

export const customHttpFormatSchema = z.enum(["json", "ndjson", "sse"]);
export type CustomHttpFormat = z.infer<typeof customHttpFormatSchema>;

export const llmTransportKindSchema = z.enum(["openai-compatible", "custom-http"]);
export type LlmTransportKind = z.infer<typeof llmTransportKindSchema>;

export const embeddingProviderKindSchema = z.enum(["local-hash", "gemini", "onnx"]);
export type EmbeddingProviderKind = z.infer<typeof embeddingProviderKindSchema>;

export const multiHopConfigSchema = z.object({
  enabled: z.boolean().default(false),
  minQuestionLength: z.number().int().positive().default(25),
  maxSubQuestions: z.number().int().min(2).max(10).default(5),
  expansionDepth: z.number().int().min(0).max(3).default(1)
});
export type MultiHopConfig = z.infer<typeof multiHopConfigSchema>;

export const retrievalConfigSchema = z.object({
  topK: z.number().int().positive().default(6),
  rerankK: z.number().int().positive().default(3),
  maxContextChars: z.number().int().positive().default(16000),
  /** Per-section char limits. All optional — defaults scale with maxContextChars. */
  primaryDocLimit: z.number().int().positive().optional(),
  primaryFileLimit: z.number().int().positive().optional(),
  relatedDocLimit: z.number().int().positive().optional(),
  relatedFileLimit: z.number().int().positive().optional()
});
export type RetrievalConfig = z.infer<typeof retrievalConfigSchema>;

export const traversalConfigSchema = z.object({
  defaultDepth: z.number().int().min(0).default(1),
  maxDepth: z.number().int().positive().default(3)
});
export type TraversalConfig = z.infer<typeof traversalConfigSchema>;

export const lockingConfigSchema = z.object({
  timeoutMs: z.number().int().positive().default(30000),
  pollMs: z.number().int().positive().default(150),
  staleMs: z.number().int().positive().default(300000)
});
export type LockingConfig = z.infer<typeof lockingConfigSchema>;

export const serviceConfigSchema = z.object({
  host: z.string().min(1).default("127.0.0.1"),
  port: z.number().int().positive().max(65535).default(4119),
  apiKey: z.string().min(1).optional()
});
export type ServiceConfig = z.infer<typeof serviceConfigSchema>;

export const llmConfigSchema = z.object({
  enabled: z.boolean().default(false),
  transport: llmTransportKindSchema.default("openai-compatible"),
  baseUrl: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  timeoutMs: z.number().int().positive().default(45000),
  customHttpFormat: customHttpFormatSchema.default("json"),
  headers: z.record(z.string(), z.string()).default({})
});
export type SerializableLlmConfig = z.infer<typeof llmConfigSchema>;
export type LlmConfig = SerializableLlmConfig;

export const embeddingConfigSchema = z.object({
  provider: embeddingProviderKindSchema.default("local-hash"),
  dimensions: z.number().int().positive().default(256),
  geminiModel: z.string().min(1).default("models/gemini-embedding-2"),
  timeoutMs: z.number().int().positive().default(30000),
  onnxModelDir: z.string().min(1).default(".coderag-models/models")
});
export type EmbeddingConfig = z.infer<typeof embeddingConfigSchema>;

export const serializableConfigSchema = z.object({
  repoPath: z.string().min(1),
  storageRoot: z.string().min(1).default(".coderag"),
  embedding: embeddingConfigSchema.default({
    provider: "local-hash",
    dimensions: 256,
    geminiModel: "models/gemini-embedding-2",
    timeoutMs: 30000,
    onnxModelDir: ".coderag-models/models"
  }),
  retrieval: retrievalConfigSchema.default({
    topK: 6,
    rerankK: 3,
    maxContextChars: 16000
  }),
  multiHop: multiHopConfigSchema.default({
    enabled: false,
    minQuestionLength: 25,
    maxSubQuestions: 5,
    expansionDepth: 1
  }),
  traversal: traversalConfigSchema.default({
    defaultDepth: 1,
    maxDepth: 3
  }),
  locking: lockingConfigSchema.default({
    timeoutMs: 30000,
    pollMs: 150,
    staleMs: 300000
  }),
  service: serviceConfigSchema.default({
    host: "127.0.0.1",
    port: 4119
  }),
  llm: llmConfigSchema.default({
    enabled: false,
    transport: "openai-compatible",
    timeoutMs: 45000,
    customHttpFormat: "json",
    headers: {}
  }),
  docsPath: z.string().optional()
});
export type SerializableCodeRagConfig = z.infer<typeof serializableConfigSchema>;

const persistedNodeKindSchema = z.custom<BlueprintNodeKind>(
  (value) => typeof value === "string" && value.length > 0,
  "Expected a non-empty blueprint node kind."
);

const persistedContractFieldSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  description: z.string().optional()
});

const persistedSourceRefSchema = z
  .object({
    kind: z.string().min(1),
    path: z.string().optional(),
    symbol: z.string().optional(),
    section: z.string().optional(),
    detail: z.string().optional()
  })
  .passthrough();

const persistedContractSchema = z
  .object({
    responsibilities: z.array(z.string()).default([]),
    inputs: z.array(persistedContractFieldSchema).default([]),
    outputs: z.array(persistedContractFieldSchema).default([]),
    dependencies: z.array(z.string()).default([])
  })
  .passthrough();

export const sourceSpanSchema = z.object({
  nodeId: z.string().min(1),
  filePath: z.string().min(1),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  symbol: z.string().optional()
});

export const callSiteSchema = z.object({
  edgeKey: z.string().min(1),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  filePath: z.string().min(1),
  lineNumbers: z.array(z.number().int().positive()),
  expressions: z.array(z.string())
});

export const indexedNodeDocumentSchema = z.object({
  nodeId: z.string().min(1),
  name: z.string().min(1),
  kind: persistedNodeKindSchema,
  filePath: z.string().min(1),
  summary: z.string(),
  signature: z.string().optional(),
  doc: z.string(),
  sourceText: z.string().optional(),
  vector: z.array(z.number()),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive()
});

const persistedBlueprintNodeSchema = z
  .object({
    id: z.string().min(1),
    kind: persistedNodeKindSchema,
    name: z.string().min(1),
    summary: z.string(),
    path: z.string().optional(),
    signature: z.string().optional(),
    contract: persistedContractSchema,
    sourceRefs: z.array(persistedSourceRefSchema).default([])
  })
  .passthrough();

const persistedBlueprintEdgeSchema = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
    kind: z.string().min(1)
  })
  .passthrough();

const persistedBlueprintGraphSchema = z
  .object({
    projectName: z.string().min(1),
    mode: z.enum(["essential", "yolo"]),
    phase: z.enum(["spec", "implementation", "integration"]),
    generatedAt: z.string().min(1),
    nodes: z.array(persistedBlueprintNodeSchema),
    edges: z.array(persistedBlueprintEdgeSchema),
    workflows: z.array(z.unknown()).default([]),
    warnings: z.array(z.string()).default([])
  })
  .passthrough();

export const graphSnapshotSchema = z.object({
  provider: z.string().min(1),
  repoPath: z.string().min(1),
  generatedAt: z.string().min(1),
  graph: persistedBlueprintGraphSchema,
  sourceSpans: z.record(z.string(), sourceSpanSchema),
  callSites: z.record(z.string(), callSiteSchema)
});

export const indexManifestNodeEntrySchema = z.object({
  nodeId: z.string().min(1),
  filePath: z.string().min(1),
  docHash: z.string().min(1),
  fileHash: z.string().min(1)
});

export const indexManifestSchema = z.object({
  schemaVersion: z.number().int().positive(),
  generatedAt: z.string().min(1),
  repoPath: z.string().min(1),
  provider: z.string().min(1),
  embeddingProvider: embeddingProviderKindSchema,
  embeddingModel: z.string().min(1),
  embeddingDimensions: z.number().int().positive(),
  nodes: z.record(z.string(), indexManifestNodeEntrySchema),
  fileHashes: z.record(z.string(), z.string().min(1))
});

export const vectorStoreMetadataSchema = z.object({
  schemaVersion: z.number().int().positive(),
  embeddingProvider: embeddingProviderKindSchema,
  embeddingModel: z.string().min(1),
  embeddingDimensions: z.number().int().positive(),
  generatedAt: z.string().min(1).optional()
});

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface SourceSpan {
  nodeId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  symbol?: string;
}

export interface CallSite {
  edgeKey: string;
  fromNodeId: string;
  toNodeId: string;
  filePath: string;
  lineNumbers: number[];
  expressions: string[];
}

export interface IndexedNodeDocument {
  nodeId: string;
  name: string;
  kind: BlueprintNodeKind;
  filePath: string;
  summary: string;
  signature?: string;
  doc: string;
  sourceText?: string;
  vector: number[];
  startLine: number;
  endLine: number;
}

export interface GraphSnapshot {
  provider: string;
  repoPath: string;
  generatedAt: string;
  graph: BlueprintGraph;
  sourceSpans: Record<string, SourceSpan>;
  callSites: Record<string, CallSite>;
}

export interface IndexManifestNodeEntry {
  nodeId: string;
  filePath: string;
  docHash: string;
  fileHash: string;
}

export interface IndexManifest {
  schemaVersion: number;
  generatedAt: string;
  repoPath: string;
  provider: string;
  embeddingProvider: EmbeddingProviderKind;
  embeddingModel: string;
  embeddingDimensions: number;
  nodes: Record<string, IndexManifestNodeEntry>;
  fileHashes: Record<string, string>;
}

export type RetrievalMode = "single" | "multi-hop";

export interface QueryOptions {
  depth?: number;
  includeAnswer?: boolean;
  onToken?: (token: string) => void;
  multiHop?: boolean;
}

export type AnswerMode = "llm" | "context-only";

export interface RetrievedNodeContext {
  nodeId: string;
  name: string;
  kind: BlueprintNodeKind;
  filePath: string;
  fullFileContent: string;
  startLine: number;
  endLine: number;
  callSiteLines: number[];
  doc: string;
  relationship: "primary" | "calls" | "called-by" | "multi-hop";
  /** Which sub-question (if any) led to this node being retrieved. */
  subQuestionIndex?: number;
}

export interface ContextPackage {
  question: string;
  answerMode: AnswerMode;
  retrievalMode: RetrievalMode;
  primaryNode: RetrievedNodeContext | null;
  relatedNodes: RetrievedNodeContext[];
  graphSummary: string;
  warnings: string[];
  /** Sub-questions used for multi-hop retrieval (only present in multi-hop mode). */
  subQuestions?: string[];
  /** Per-sub-question retrieval metadata (only present in multi-hop mode). */
  subQuestionResults?: Array<{
    question: string;
    primaryNodeId: string | null;
    relatedNodeCount: number;
    filesReferenced: string[];
  }>;
}

export interface QueryResult {
  question: string;
  answerMode: AnswerMode;
  retrievalMode: RetrievalMode;
  answer: string;
  context: ContextPackage;
}

export interface LookupResult {
  node: BlueprintNode;
  span?: SourceSpan;
  outgoingEdges: BlueprintEdge[];
  incomingEdges: BlueprintEdge[];
  doc?: IndexedNodeDocument;
}

export interface ExplainResult {
  node: BlueprintNode;
  summary: string;
  dependencies: BlueprintNode[];
  dependents: BlueprintNode[];
  span?: SourceSpan;
}

export interface ImpactResult {
  node: BlueprintNode;
  impactedNodes: BlueprintNode[];
  graphSummary: string;
}

export interface DecompositionResult {
  subQuestions: string[];
  reasoning: string;
}

export interface MultiHopRetrievalResult {
  subQuestions: string[];
  primaryNodes: Array<BlueprintNode | undefined>;
  expandedNodes: BlueprintNode[];
  deduplicatedNodes: BlueprintNode[];
  retrievalMetadata: Array<{
    subQuestion: string;
    primaryNode: BlueprintNode | undefined;
    relatedNodes: BlueprintNode[];
    filesReferenced: string[];
  }>;
}

export interface IndexSummary {
  graph: BlueprintGraph;
  manifest: IndexManifest;
  snapshot: GraphSnapshot;
  indexedNodeCount: number;
}

export interface EmbeddingProvider {
  readonly name: string;
  readonly model: string;
  readonly dimensions: number;
  readonly maxBatchSize?: number;
  /** Maximum input tokens the model accepts. Used to derive MAX_EMBEDDING_CHARS. */
  readonly maxInputTokens: number;
  embed(text: string): Promise<number[]>;
  embedBatch?(texts: string[]): Promise<number[][]>;
}

export interface VectorStore {
  reset(records: IndexedNodeDocument[]): Promise<void>;
  deleteByNodeIds(nodeIds: string[]): Promise<void>;
  upsert(records: IndexedNodeDocument[]): Promise<void>;
  search(queryVector: number[], limit: number): Promise<IndexedNodeDocument[]>;
  get(nodeId: string): Promise<IndexedNodeDocument | null>;
  getMany(nodeIds: string[]): Promise<IndexedNodeDocument[]>;
  close(): Promise<void>;
  getMetadata<T>(): Promise<T | null>;
  setMetadata<T>(metadata: T): Promise<void>;
  clear(): Promise<void>;
}

export interface LlmRequest {
  question: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  context: ContextPackage;
  model?: string;
  stream: boolean;
}

export interface LlmResponse {
  answer: string;
}

export interface LlmTransport {
  readonly kind: LlmTransportKind;
  generate(request: LlmRequest, onToken?: (token: string) => void): Promise<LlmResponse>;
}

export interface GraphProvider {
  readonly name: string;
  analyze(repoPath: string): Promise<BlueprintGraph>;
}

export interface CodeRagConfig extends SerializableCodeRagConfig {
  logger?: Logger;
  embeddingProvider?: EmbeddingProvider;
  vectorStore?: VectorStore;
  graphProvider?: GraphProvider;
  llmTransport?: LlmTransport;
  configPath?: string;
}
