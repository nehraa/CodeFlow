import type { EmbeddingProvider, IndexedNodeDocument, RetrievalConfig, VectorStore } from "../types.js";
import { cosineSimilarity, lexicalOverlapScore, tokenizeMeaningfully, weightedTokenScore } from "../utils/text.js";

const SEMANTIC_MULTIPLIER = 3;
const LEXICAL_MULTIPLIER = 4;
const QUERY_SYNONYMS = new Map<string, string[]>([
  ["concurrent", ["lock", "shared", "process"]],
  ["corruption", ["lock", "stale", "safe"]],
  ["retry", ["backoff", "wait"]],
  ["retri", ["backoff", "wait"]],
  ["request", ["http", "post", "json"]],
  ["server", ["http", "transport"]],
  ["model", ["llm", "transport"]],
  ["index", ["manifest", "snapshot", "lock"]]
]);
const LARGE_NODE_LINE_THRESHOLD = 500;
const MAX_LARGE_NODE_PENALTY = 0.12;

const buildSearchText = (document: IndexedNodeDocument): string =>
  [document.name, document.filePath, document.summary, document.signature, document.doc, document.sourceText]
    .filter(Boolean)
    .join("\n");

const isSymbolLikeQuery = (question: string): boolean =>
  !question.includes(" ") || question.includes("/") || question.includes(".") || question.includes("_");

const normalizeQuestion = (question: string): string => question.trim().toLowerCase();

const expandQuestion = (question: string): string => {
  const expandedTokens = tokenizeMeaningfully(question).flatMap((token) => [token, ...(QUERY_SYNONYMS.get(token) ?? [])]);
  return [question, ...expandedTokens].join(" ").trim();
};

const calculateLargeNodePenalty = (document: IndexedNodeDocument): number => {
  const lineSpan = document.endLine - document.startLine + 1;
  if (lineSpan <= LARGE_NODE_LINE_THRESHOLD) {
    return 0;
  }

  return Math.min(MAX_LARGE_NODE_PENALTY, Math.log2(lineSpan / LARGE_NODE_LINE_THRESHOLD + 1) * 0.04);
};

const calculateDocumentFrequency = (documents: IndexedNodeDocument[]): Map<string, number> => {
  const frequencyByToken = new Map<string, number>();

  for (const document of documents) {
    const tokens = new Set(tokenizeMeaningfully(buildSearchText(document)));
    for (const token of tokens) {
      frequencyByToken.set(token, (frequencyByToken.get(token) ?? 0) + 1);
    }
  }

  return frequencyByToken;
};

export const calculateIdfScore = (
  queryTokens: string[],
  candidateTokens: string[],
  documentFrequency: Map<string, number>,
  documentCount: number
): number => {
  if (queryTokens.length === 0 || candidateTokens.length === 0) {
    return 0;
  }

  const uniqueQueryTokens = [...new Set(queryTokens)];
  const matchedWeight = uniqueQueryTokens.reduce((score, token) => {
    const hasMatch = candidateTokens.some((candidateToken) => candidateToken === token);
    if (!hasMatch) {
      return score;
    }

    const frequency = documentFrequency.get(token) ?? documentCount;
    return score + Math.log((documentCount + 1) / (frequency + 1)) + 1;
  }, 0);

  const maxWeight = uniqueQueryTokens.reduce((score, token) => {
    const frequency = documentFrequency.get(token) ?? documentCount;
    return score + Math.log((documentCount + 1) / (frequency + 1)) + 1;
  }, 0);

  return matchedWeight / maxWeight;
};

export const calculateFieldScore = (question: string, document: IndexedNodeDocument): number => {
  const nameScore = lexicalOverlapScore(question, document.name);
  const pathScore = lexicalOverlapScore(question, document.filePath);
  const summaryScore = lexicalOverlapScore(question, document.summary);
  const signatureScore = lexicalOverlapScore(question, document.signature ?? "");
  return nameScore * 0.35 + summaryScore * 0.3 + pathScore * 0.2 + signatureScore * 0.15;
};

const calculateInitialLexicalScore = (question: string, document: IndexedNodeDocument): number =>
  calculateFieldScore(question, document) + lexicalOverlapScore(question, document.doc) * 0.2;

const selectLexicalCandidates = (
  question: string,
  documents: IndexedNodeDocument[],
  retrieval: RetrievalConfig
): IndexedNodeDocument[] =>
  [...documents]
    .sort((left, right) => calculateInitialLexicalScore(question, right) - calculateInitialLexicalScore(question, left))
    .slice(0, Math.max(retrieval.topK * LEXICAL_MULTIPLIER, retrieval.rerankK));

const collectSemanticCandidates = async (
  queryVector: number[],
  retrieval: RetrievalConfig,
  vectorStore?: VectorStore
): Promise<IndexedNodeDocument[]> => {
  if (!vectorStore) {
    return [];
  }

  try {
    return await vectorStore.search(queryVector, Math.max(retrieval.topK * SEMANTIC_MULTIPLIER, retrieval.rerankK));
  } catch {
    return [];
  }
};

const mergeCandidates = (
  documents: Record<string, IndexedNodeDocument>,
  semanticCandidates: IndexedNodeDocument[],
  lexicalCandidates: IndexedNodeDocument[]
): IndexedNodeDocument[] => {
  const mergedByNodeId = new Map<string, IndexedNodeDocument>();

  for (const candidate of [...semanticCandidates, ...lexicalCandidates]) {
    mergedByNodeId.set(candidate.nodeId, documents[candidate.nodeId] ?? candidate);
  }

  return [...mergedByNodeId.values()];
};

const scoreDocument = (
  question: string,
  queryVector: number[],
  queryTokens: string[],
  document: IndexedNodeDocument,
  documentFrequency: Map<string, number>,
  documentCount: number
): SearchResult => {
  const normalizedQuestion = normalizeQuestion(question);
  const searchText = buildSearchText(document);
  const candidateTokens = tokenizeMeaningfully(searchText);
  const vectorScore = cosineSimilarity(queryVector, document.vector);
  const lexicalScore = lexicalOverlapScore(question, searchText);
  const fieldScore = calculateFieldScore(question, document);
  const coverageScore = weightedTokenScore(queryTokens, candidateTokens);
  const idfScore = calculateIdfScore(queryTokens, candidateTokens, documentFrequency, documentCount);
  const symbolLikeQuery = isSymbolLikeQuery(question);
  const exactNameBoost =
    Number(normalizedQuestion.includes(document.name.toLowerCase())) * (symbolLikeQuery ? 0.18 : 0.04);
  const exactPathBoost =
    normalizedQuestion.includes(document.filePath.toLowerCase()) && symbolLikeQuery ? 0.14 : 0;
  const symbolBoost = symbolLikeQuery && (exactNameBoost > 0 || exactPathBoost > 0) ? 0.1 : 0;
  const largeNodePenalty = calculateLargeNodePenalty(document);
  const finalScore =
    vectorScore * 0.28 +
    lexicalScore * 0.18 +
    fieldScore * 0.24 +
    coverageScore * 0.15 +
    idfScore * 0.05 +
    exactNameBoost +
    exactPathBoost +
    symbolBoost -
    largeNodePenalty;

  return {
    document,
    vectorScore,
    lexicalScore,
    fieldScore,
    coverageScore,
    idfScore,
    finalScore
  };
};

export interface SearchResult {
  document: IndexedNodeDocument;
  vectorScore: number;
  lexicalScore: number;
  fieldScore: number;
  coverageScore: number;
  idfScore: number;
  finalScore: number;
}

/**
 * Builds a hybrid candidate set from the vector store and lexical ranking, then scores it.
 */
export const searchDocuments = async (
  question: string,
  documents: Record<string, IndexedNodeDocument>,
  embeddingProvider: EmbeddingProvider,
  retrieval: RetrievalConfig,
  vectorStore?: VectorStore
): Promise<SearchResult[]> => {
  const documentList = Object.values(documents);
  const expandedQuestion = expandQuestion(question);
  const queryVector = await embeddingProvider.embed(expandedQuestion);
  const queryTokens = tokenizeMeaningfully(expandedQuestion);
  const semanticCandidates = await collectSemanticCandidates(queryVector, retrieval, vectorStore);
  const lexicalCandidates = selectLexicalCandidates(expandedQuestion, documentList, retrieval);
  const candidates = mergeCandidates(documents, semanticCandidates, lexicalCandidates);
  const candidatePool = candidates.length > 0 ? candidates : documentList;
  const documentFrequency = calculateDocumentFrequency(documentList);

  return candidatePool
    .map((document) =>
      scoreDocument(expandedQuestion, queryVector, queryTokens, document, documentFrequency, documentList.length)
    )
    .sort((left, right) => right.finalScore - left.finalScore)
    .slice(0, Math.max(retrieval.topK, retrieval.rerankK));
};

/**
 * Applies a smaller rerank pass that strongly favors exact symbol and path resolution.
 */
export const rerankResults = (question: string, results: SearchResult[], retrieval: RetrievalConfig): SearchResult[] => {
  const normalizedQuestion = normalizeQuestion(question);
  const symbolLikeQuery = isSymbolLikeQuery(question);

  return results
    .map((result) => {
      const exactNameMatch = normalizedQuestion === result.document.name.toLowerCase() ? 0.2 : 0;
      const exactPathMatch = normalizedQuestion === result.document.filePath.toLowerCase() ? 0.18 : 0;
      const directMentionBoost = normalizedQuestion.includes(result.document.name.toLowerCase())
        ? symbolLikeQuery
          ? 0.08
          : 0.02
        : 0;

      return {
        ...result,
        finalScore: result.finalScore + exactNameMatch + exactPathMatch + directMentionBoost
      };
    })
    .sort((left, right) => right.finalScore - left.finalScore)
    .slice(0, retrieval.rerankK);
};
