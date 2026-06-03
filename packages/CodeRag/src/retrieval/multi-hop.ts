import type { BlueprintNode } from "@abhinav2203/codeflow-core/schema";

import type {
  EmbeddingProvider,
  GraphSnapshot,
  IndexedNodeDocument,
  MultiHopRetrievalResult,
  RetrievalConfig,
  VectorStore
} from "../types.js";
import { rerankResults, searchDocuments, SearchResult } from "./search.js";
import { traverseDependencies } from "./traversal.js";

export interface SubQuestionRetrievalResult {
  subQuestion: string;
  searchResults: SearchResult[];
  primaryNode: BlueprintNode | undefined;
  relatedNodes: BlueprintNode[];
  filesReferenced: string[];
}

/**
 * Run vector + lexical search for a single sub-question and expand via graph traversal.
 */
const retrieveForSubQuestion = async (
  subQuestion: string,
  documents: Record<string, IndexedNodeDocument>,
  embeddingProvider: EmbeddingProvider,
  retrieval: RetrievalConfig,
  snapshot: GraphSnapshot,
  vectorStore: VectorStore | undefined,
  expansionDepth: number
): Promise<SubQuestionRetrievalResult> => {
  const searchResults = rerankResults(
    subQuestion,
    await searchDocuments(subQuestion, documents, embeddingProvider, retrieval, vectorStore),
    retrieval
  );

  const primaryDocument = searchResults[0]?.document;
  const primaryNode = primaryDocument
    ? snapshot.graph.nodes.find((node) => node.id === primaryDocument.nodeId)
    : undefined;

  const { dependencies, dependents } = primaryNode
    ? traverseDependencies(snapshot, primaryNode.id, expansionDepth)
    : { dependencies: [], dependents: [] };

  const relatedNodes = [...dependencies, ...dependents];
  const allNodes = primaryNode ? [primaryNode, ...relatedNodes] : [];
  const filesReferenced = [...new Set(allNodes.map((n) => n.path).filter(Boolean) as string[])];

  return {
    subQuestion,
    searchResults,
    primaryNode,
    relatedNodes,
    filesReferenced
  };
};

/**
 * Run retrieval for all sub-questions in parallel via Promise.all.
 */
export const parallelRetrieve = async (
  subQuestions: string[],
  documents: Record<string, IndexedNodeDocument>,
  embeddingProvider: EmbeddingProvider,
  retrieval: RetrievalConfig,
  snapshot: GraphSnapshot,
  vectorStore: VectorStore | undefined,
  expansionDepth: number
): Promise<SubQuestionRetrievalResult[]> => {
  const results = await Promise.all(
    subQuestions.map((sq) =>
      retrieveForSubQuestion(sq, documents, embeddingProvider, retrieval, snapshot, vectorStore, expansionDepth)
    )
  );
  return results;
};

/**
 * Deduplicate nodes across all sub-question results by nodeId.
 * The first occurrence wins; preserves which sub-question retrieved each node.
 */
export const deduplicateAndMerge = (
  results: SubQuestionRetrievalResult[]
): {
  primaryNodes: Array<BlueprintNode | undefined>;
  deduplicatedNodes: BlueprintNode[];
  expandedNodes: BlueprintNode[];
  retrievalMetadata: MultiHopRetrievalResult["retrievalMetadata"];
} => {
  const seen = new Set<string>();
  const deduplicatedNodes: BlueprintNode[] = [];
  const expandedNodes: BlueprintNode[] = [];
  const primaryNodes: Array<BlueprintNode | undefined> = [];
  const retrievalMetadata: MultiHopRetrievalResult["retrievalMetadata"] = [];

  for (const result of results) {
    primaryNodes.push(result.primaryNode);

    if (result.primaryNode && !seen.has(result.primaryNode.id)) {
      seen.add(result.primaryNode.id);
      deduplicatedNodes.push(result.primaryNode);
      expandedNodes.push(result.primaryNode);
    }

    for (const node of result.relatedNodes) {
      if (!seen.has(node.id)) {
        seen.add(node.id);
        deduplicatedNodes.push(node);
        expandedNodes.push(node);
      }
    }

    retrievalMetadata.push({
      subQuestion: result.subQuestion,
      primaryNode: result.primaryNode,
      relatedNodes: result.relatedNodes,
      filesReferenced: result.filesReferenced
    });
  }

  return { primaryNodes, deduplicatedNodes, expandedNodes, retrievalMetadata };
};

/**
 * Full multi-hop retrieval pipeline: parallel retrieve + deduplicate.
 */
export const multiHopRetrieve = async (
  subQuestions: string[],
  documents: Record<string, IndexedNodeDocument>,
  embeddingProvider: EmbeddingProvider,
  retrieval: RetrievalConfig,
  snapshot: GraphSnapshot,
  vectorStore: VectorStore | undefined,
  expansionDepth: number
): Promise<MultiHopRetrievalResult> => {
  const results = await parallelRetrieve(
    subQuestions,
    documents,
    embeddingProvider,
    retrieval,
    snapshot,
    vectorStore,
    expansionDepth
  );

  const { primaryNodes, deduplicatedNodes, expandedNodes, retrievalMetadata } = deduplicateAndMerge(results);

  return {
    subQuestions,
    primaryNodes,
    expandedNodes,
    deduplicatedNodes,
    retrievalMetadata
  };
};
