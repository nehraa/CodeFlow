import type { BlueprintNode } from "@abhinav2203/codeflow-core/schema";

import { NotFoundError } from "../errors/index.js";
import { buildContextPackage } from "../llm/context-builder.js";
import { buildMessages, buildMultiHopMessages } from "../llm/prompt.js";
import { buildMultiHopContextPackage } from "../llm/multi-hop-context-builder.js";
import { RepoIndexer } from "../indexer/indexer.js";
import { decomposeQuestionWithFallback } from "../retrieval/decompose.js";
import { multiHopRetrieve } from "../retrieval/multi-hop.js";
import { rerankResults, searchDocuments } from "../retrieval/search.js";
import { traverseDependencies } from "../retrieval/traversal.js";
import { FileCache } from "../store/file-cache.js";
import { ManifestStore } from "../store/manifest-store.js";
import type {
  CodeRagConfig,
  ContextPackage,
  ExplainResult,
  GraphSnapshot,
  ImpactResult,
  IndexSummary,
  IndexedNodeDocument,
  LookupResult,
  QueryOptions,
  QueryResult
} from "../types.js";

type LoadedState = {
  snapshot: GraphSnapshot;
  documents: Record<string, IndexedNodeDocument>;
};

const fallbackAnswerFromContext = (context: ContextPackage): string => {
  if (!context.primaryNode) {
    return "No matching code node was found in the current index.";
  }

  const relatedNames = context.relatedNodes.map((node) => node.name);
  const relationshipSummary = relatedNames.length > 0 ? ` Related nodes: ${relatedNames.join(", ")}.` : "";
  return `${context.graphSummary}${relationshipSummary}`;
};

const isStateLoaded = (
  snapshot: GraphSnapshot | null,
  documents: Record<string, IndexedNodeDocument>
): snapshot is GraphSnapshot => Boolean(snapshot) && Object.keys(documents).length > 0;

/**
 * High-level service API for indexing and querying a code repository.
 */
export class CodeRag {
  private readonly indexer: RepoIndexer;
  private readonly manifestStore: ManifestStore;
  private readonly fileCache = new FileCache();
  private activeIndexPromise?: Promise<IndexSummary>;
  private loadedState?: LoadedState;

  constructor(private readonly config: CodeRagConfig) {
    this.indexer = new RepoIndexer(config, config.configPath);
    this.manifestStore = new ManifestStore(config.storageRoot);
  }

  private hydrateState(snapshot: GraphSnapshot, documents: Record<string, IndexedNodeDocument>): LoadedState {
    const state = { snapshot, documents };
    this.loadedState = state;
    return state;
  }

  private async runIndexJob(indexOperation: () => Promise<IndexSummary>): Promise<IndexSummary> {
    if (!this.activeIndexPromise) {
      this.activeIndexPromise = indexOperation()
        .then(async (summary) => {
          const documents = await this.manifestStore.loadDocuments();
          this.hydrateState(summary.snapshot, documents);
          return summary;
        })
        .finally(() => {
          this.activeIndexPromise = undefined;
        });
    }

    return this.activeIndexPromise;
  }

  private async ensureLoadedState(): Promise<LoadedState> {
    if (this.loadedState) {
      return this.loadedState;
    }

    const state = await this.indexer.loadState();
    if (isStateLoaded(state.snapshot, state.documents)) {
      return this.hydrateState(state.snapshot, state.documents);
    }

    const waitedState = await this.indexer.waitForUnlockedState();
    if (isStateLoaded(waitedState.snapshot, waitedState.documents)) {
      return this.hydrateState(waitedState.snapshot, waitedState.documents);
    }

    await this.runIndexJob(() => this.indexer.index(false));
    return this.loadedState!;
  }

  private findNodeOrThrow(identifier: string, snapshot: GraphSnapshot): BlueprintNode {
    const normalizedIdentifier = identifier.toLowerCase();
    const exactMatch =
      snapshot.graph.nodes.find((node) => node.id === identifier) ??
      snapshot.graph.nodes.find((node) => node.name.toLowerCase() === normalizedIdentifier) ??
      snapshot.graph.nodes.find((node) => node.path?.toLowerCase() === normalizedIdentifier);

    if (exactMatch) {
      return exactMatch;
    }

    const fuzzyMatch = snapshot.graph.nodes.find(
      (node) =>
        node.name.toLowerCase().includes(normalizedIdentifier) ||
        node.path?.toLowerCase().includes(normalizedIdentifier)
    );
    if (!fuzzyMatch) {
      throw new NotFoundError(`Unable to resolve a graph node for "${identifier}".`);
    }

    return fuzzyMatch;
  }

  /**
   * Builds or rebuilds the on-disk index for the configured repository.
   * If docsPath is provided, reads .md files from that directory (named by node ID)
   * and uses their content as the embedding text instead of generating thin markdown.
   */
  async index(options?: { docsPath?: string }): Promise<IndexSummary> {
    return this.runIndexJob(() => this.indexer.index(true, options?.docsPath));
  }

  /**
   * Reindexes the repository, incrementally by default.
   * If docsPath is provided, reads .md files from that directory (named by node ID)
   * and uses their content as the embedding text instead of generating thin markdown.
   */
  async reindex(options?: { full?: boolean; docsPath?: string }): Promise<IndexSummary> {
    return this.runIndexJob(() =>
      this.indexer.reindex({
        full: options?.full ?? false,
        docsPath: options?.docsPath
      })
    );
  }

  /**
   * Returns the current repository and runtime status.
   */
  async status(): Promise<Record<string, unknown>> {
    const state = await this.indexer.loadState();
    const { mismatch, expected, actual } = await this.indexer.checkEmbeddingModelMismatch();
    const embeddingProvider = state.manifest?.embeddingProvider ?? this.config.embeddingProvider?.name ?? "unknown";
    const embeddingModel = state.manifest?.embeddingModel ?? this.config.embeddingProvider?.model ?? "unknown";
    const embeddingDimensions = state.manifest?.embeddingDimensions ?? this.config.embeddingProvider?.dimensions ?? 0;

    return {
      indexed: Boolean(state.snapshot),
      indexedNodeCount: Object.keys(state.documents).length,
      generatedAt: state.snapshot?.generatedAt ?? null,
      repoPath: this.config.repoPath,
      storageRoot: this.config.storageRoot,
      provider: state.snapshot?.provider ?? this.config.graphProvider?.name ?? null,
      llmEnabled: this.config.llm.enabled,
      embeddingProvider,
      embeddingModel,
      embeddingDimensions,
      indexSchemaVersion: state.manifest?.schemaVersion ?? 0,
      modelMismatch: mismatch,
      expectedEmbedding: expected,
      actualEmbedding: actual
    };
  }

  /**
   * Resolves a graph node by identifier and returns its local graph context.
   */
  async lookup(identifier: string): Promise<LookupResult> {
    const { snapshot, documents } = await this.ensureLoadedState();
    const node = this.findNodeOrThrow(identifier, snapshot);

    return {
      node,
      span: snapshot.sourceSpans[node.id],
      outgoingEdges: snapshot.graph.edges.filter((edge) => edge.from === node.id),
      incomingEdges: snapshot.graph.edges.filter((edge) => edge.to === node.id),
      doc: documents[node.id]
    };
  }

  /**
   * Summarizes a node and its surrounding dependencies.
   */
  async explain(identifier: string, depth = this.config.traversal.defaultDepth): Promise<ExplainResult> {
    const { snapshot } = await this.ensureLoadedState();
    const node = this.findNodeOrThrow(identifier, snapshot);
    const { dependencies, dependents } = traverseDependencies(snapshot, node.id, depth);

    return {
      node,
      summary: `${node.summary} Dependencies: ${dependencies.map((candidate) => candidate.name).join(", ") || "none"}. Dependents: ${dependents.map((candidate) => candidate.name).join(", ") || "none"}.`,
      dependencies,
      dependents,
      span: snapshot.sourceSpans[node.id]
    };
  }

  /**
   * Returns the upstream impact of changing a node.
   */
  async impact(identifier: string, depth = this.config.traversal.defaultDepth): Promise<ImpactResult> {
    const { snapshot } = await this.ensureLoadedState();
    const node = this.findNodeOrThrow(identifier, snapshot);
    const { dependents } = traverseDependencies(snapshot, node.id, depth);

    return {
      node,
      impactedNodes: dependents,
      graphSummary:
        dependents.length > 0
          ? `${node.name} is upstream of ${dependents.map((candidate) => candidate.name).join(", ")}.`
          : `${node.name} has no upstream dependents within depth ${depth}.`
    };
  }

  /**
   * Answers a natural-language question with retrieved context and an optional LLM answer.
   */
  async query(question: string, options: QueryOptions = {}): Promise<QueryResult> {
    const { snapshot, documents } = await this.ensureLoadedState();
    const embeddingProvider = this.config.embeddingProvider;
    if (!embeddingProvider) {
      throw new NotFoundError("No embedding provider is configured.");
    }

    const depth = Math.min(options.depth ?? this.config.traversal.defaultDepth, this.config.traversal.maxDepth);
    const answerMode: QueryResult["answerMode"] =
      options.includeAnswer === false || !this.config.llm.enabled || !this.config.llmTransport ? "context-only" : "llm";

    // Decide whether to use multi-hop retrieval
    const useMultiHop =
      options.multiHop === true &&
      this.config.multiHop.enabled &&
      answerMode === "llm";

    if (useMultiHop) {
      return this.queryMultiHop(question, answerMode, options, snapshot, documents, embeddingProvider, depth);
    }

    // Single-retrieval path
    const searchResults = rerankResults(
      question,
      await searchDocuments(
        question,
        documents,
        embeddingProvider,
        this.config.retrieval,
        this.config.vectorStore
      ),
      this.config.retrieval
    );
    const primaryDocument = searchResults[0]?.document;
    const primaryNode = primaryDocument
      ? snapshot.graph.nodes.find((node) => node.id === primaryDocument.nodeId)
      : undefined;
    const { dependencies, dependents } = primaryNode
      ? traverseDependencies(snapshot, primaryNode.id, depth)
      : { dependencies: [], dependents: [] };
    const { context, limits } = await buildContextPackage(
      question,
      this.config.repoPath,
      snapshot,
      documents,
      this.config.retrieval,
      this.fileCache,
      primaryNode,
      dependencies,
      dependents,
      answerMode
    );

    if (answerMode === "context-only") {
      return {
        question,
        answerMode,
        retrievalMode: "single",
        answer: fallbackAnswerFromContext(context),
        context
      };
    }

    const llmResponse = await this.config.llmTransport!.generate(
      {
        question,
        model: this.config.llm.model,
        stream: Boolean(options.onToken),
        context,
        messages: buildMessages(question, context, limits)
      },
      options.onToken
    );

    return {
      question,
      answerMode,
      retrievalMode: "single",
      answer: llmResponse.answer,
      context
    };
  }

  /**
   * Multi-hop retrieval: decompose question, parallel retrieve, synthesize.
   */
  private async queryMultiHop(
    question: string,
    answerMode: QueryResult["answerMode"],
    options: QueryOptions,
    snapshot: NonNullable<typeof this.loadedState>["snapshot"],
    documents: NonNullable<typeof this.loadedState>["documents"],
    embeddingProvider: NonNullable<typeof this.config.embeddingProvider>,
    depth: number
  ): Promise<QueryResult> {
    // Stage 1: Decompose
    const subQuestions = await decomposeQuestionWithFallback(
      question,
      this.config.llmTransport ?? undefined,
      this.config.multiHop,
      this.config.llm.model
    );

    if (!subQuestions || subQuestions.length < 2) {
      // Fall back to single retrieval if decomposition fails
      return this.query(question, { ...options, multiHop: false });
    }

    // Stage 2: Parallel retrieve
    const retrievalResult = await multiHopRetrieve(
      subQuestions,
      documents,
      embeddingProvider,
      this.config.retrieval,
      snapshot,
      this.config.vectorStore,
      this.config.multiHop.expansionDepth
    );

    // Stage 3: Context assembly + synthesis
    const { context, limits } = await buildMultiHopContextPackage(
      question,
      subQuestions,
      retrievalResult,
      this.config.repoPath,
      snapshot,
      documents,
      this.config.retrieval,
      this.fileCache
    );

    const llmResponse = await this.config.llmTransport!.generate(
      {
        question,
        model: this.config.llm.model,
        stream: Boolean(options.onToken),
        context,
        messages: buildMultiHopMessages(question, context, limits)
      },
      options.onToken
    );

    return {
      question,
      answerMode,
      retrievalMode: "multi-hop",
      answer: llmResponse.answer,
      context
    };
  }

  /**
   * Releases resources held by the service.
   */
  async close(): Promise<void> {
    this.fileCache.clear();
    await this.config.vectorStore?.close();
  }
}
