import { describe, expect, it } from "vitest";

import type { EmbeddingProvider, IndexedNodeDocument, VectorStore } from "../types.js";
import {
  calculateFieldScore,
  calculateIdfScore,
  rerankResults,
  searchDocuments
} from "../retrieval/search.js";
import { embedTextDeterministically } from "../utils/text.js";

class TestEmbeddingProvider implements EmbeddingProvider {
  readonly name = "test";
  readonly model = "test-model";
  readonly dimensions = 32;

  async embed(text: string): Promise<number[]> {
    return embedTextDeterministically(text, this.dimensions);
  }
}

class TestVectorStore implements VectorStore {
  constructor(private readonly documents: IndexedNodeDocument[]) {}

  async reset(): Promise<void> {}
  async deleteByNodeIds(): Promise<void> {}
  async upsert(): Promise<void> {}
  async get(nodeId: string): Promise<IndexedNodeDocument | null> {
    return this.documents.find((document) => document.nodeId === nodeId) ?? null;
  }
  async getMany(nodeIds: string[]): Promise<IndexedNodeDocument[]> {
    return this.documents.filter((document) => nodeIds.includes(document.nodeId));
  }
  async search(): Promise<IndexedNodeDocument[]> {
    return [this.documents[1]!, this.documents[0]!];
  }
  async close(): Promise<void> {}
}

class FailingVectorStore extends TestVectorStore {
  override async search(): Promise<IndexedNodeDocument[]> {
    throw new Error("vector failure");
  }
}

class ExternalCandidateVectorStore extends TestVectorStore {
  override async search(): Promise<IndexedNodeDocument[]> {
    return [
      createDocument("external", "externalNode", "src/external.ts", "External candidate")
    ];
  }
}

const createDocument = (
  nodeId: string,
  name: string,
  filePath: string,
  summary: string
): IndexedNodeDocument => ({
  nodeId,
  name,
  kind: "function",
  filePath,
  summary,
  signature: `${name}(): void`,
  doc: `${name}\n${summary}`,
  vector: embedTextDeterministically(`${name} ${summary}`, 32),
  startLine: 1,
  endLine: 5
});

describe("search", () => {
  it("combines vector and lexical candidates for natural language ranking", async () => {
    const documents = {
      auth: createDocument("auth", "requireAuth", "src/lib/auth.ts", "Handles user authentication and token validation."),
      repo: createDocument("repo", "analyzeTypeScriptRepo", "src/services/repo.ts", "Analyzes the repository entry point.")
    };

    const results = await searchDocuments(
      "where is repo analysis handled?",
      documents,
      new TestEmbeddingProvider(),
      { topK: 4, rerankK: 2, maxContextChars: 8000 },
      new TestVectorStore(Object.values(documents))
    );

    expect(results[0]?.document.nodeId).toBe("repo");
  });

  it("reranks direct symbol matches ahead of weaker matches", () => {
    const results = rerankResults(
      "analyzeTypeScriptRepo",
      [
        {
          document: createDocument("auth", "requireAuth", "src/lib/auth.ts", "Handles user authentication."),
          vectorScore: 0.1,
          lexicalScore: 0.1,
          fieldScore: 0.1,
          coverageScore: 0.1,
          idfScore: 0.1,
          finalScore: 0.2
        },
        {
          document: createDocument("repo", "analyzeTypeScriptRepo", "src/services/repo.ts", "Analyzes the repository."),
          vectorScore: 0.1,
          lexicalScore: 0.1,
          fieldScore: 0.1,
          coverageScore: 0.1,
          idfScore: 0.1,
          finalScore: 0.2
        }
      ],
      { topK: 4, rerankK: 1, maxContextChars: 8000 }
    );

    expect(results[0]?.document.nodeId).toBe("repo");
  });

  it("falls back to lexical-only candidates when no vector store is available", async () => {
    const documents = {
      auth: createDocument("auth", "requireAuth", "src/lib/auth.ts", "Handles user authentication.")
    };

    const results = await searchDocuments(
      "requireAuth",
      documents,
      new TestEmbeddingProvider(),
      { topK: 2, rerankK: 1, maxContextChars: 8000 }
    );

    expect(results[0]?.document.nodeId).toBe("auth");
  });

  it("falls back to lexical candidates when vector search fails", async () => {
    const documents = {
      auth: createDocument("auth", "requireAuth", "src/lib/auth.ts", "Handles user authentication.")
    };

    const results = await searchDocuments(
      "requireAuth",
      documents,
      new TestEmbeddingProvider(),
      { topK: 2, rerankK: 1, maxContextChars: 8000 },
      new FailingVectorStore(Object.values(documents))
    );

    expect(results[0]?.document.nodeId).toBe("auth");
  });

  it("returns no results for empty document sets", async () => {
    const results = await searchDocuments(
      "anything",
      {},
      new TestEmbeddingProvider(),
      { topK: 2, rerankK: 1, maxContextChars: 8000 }
    );

    expect(results).toEqual([]);
  });

  it("handles empty questions without scoring failures", async () => {
    const documents = {
      auth: createDocument("auth", "requireAuth", "src/lib/auth.ts", "Handles user authentication.")
    };

    const results = await searchDocuments(
      "",
      documents,
      new TestEmbeddingProvider(),
      { topK: 2, rerankK: 1, maxContextChars: 8000 }
    );

    expect(results[0]?.document.nodeId).toBe("auth");
  });

  it("keeps local document records when semantic candidates contain unknown node ids", async () => {
    const documents = {
      auth: createDocument("auth", "requireAuth", "src/lib/auth.ts", "Handles user authentication.")
    };

    const results = await searchDocuments(
      "requireAuth",
      documents,
      new TestEmbeddingProvider(),
      { topK: 2, rerankK: 1, maxContextChars: 8000 },
      new ExternalCandidateVectorStore(Object.values(documents))
    );

    expect(results.some((result) => result.document.nodeId === "external")).toBe(true);
    expect(results.some((result) => result.document.nodeId === "auth")).toBe(true);
  });

  it("boosts exact file-path matches during search and rerank", async () => {
    const documents = {
      auth: createDocument("auth", "requireAuth", "src/lib/auth.ts", "Handles user authentication."),
      repo: createDocument("repo", "analyzeTypeScriptRepo", "src/services/repo.ts", "Analyzes the repository.")
    };
    const retrieval = { topK: 4, rerankK: 2, maxContextChars: 8000 };

    const searchResults = await searchDocuments(
      "src/services/repo.ts",
      documents,
      new TestEmbeddingProvider(),
      retrieval,
      new TestVectorStore(Object.values(documents))
    );
    const reranked = rerankResults("src/services/repo.ts", searchResults, retrieval);

    expect(reranked[0]?.document.nodeId).toBe("repo");
  });

  it("does not let package-name mentions dominate natural-language retrieval", async () => {
    const documents = {
      service: createDocument("service", "CodeRag", "src/service/coderag.ts", "High-level service API for indexing and querying a repository."),
      lock: createDocument("lock", "IndexLock", "src/store/index-lock.ts", "Coordinates access to the shared on-disk index state across processes."),
      index: createDocument("index", "RepoIndexer.index", "src/indexer/indexer.ts", "Indexes the repository under an on-disk lock.")
    };
    const retrieval = { topK: 4, rerankK: 2, maxContextChars: 8000 };

    const results = rerankResults(
      "how does CodeRag avoid concurrent index corruption?",
      await searchDocuments(
        "how does CodeRag avoid concurrent index corruption?",
        documents,
        new TestEmbeddingProvider(),
        retrieval,
        new TestVectorStore(Object.values(documents))
      ),
      retrieval
    );

    expect(results[0]?.document.nodeId).toBe("lock");
  });

  it("penalizes oversized nodes when a focused candidate matches the same query", async () => {
    const documents = {
      giant: {
        ...createDocument(
          "giant",
          "BlueprintWorkbench",
          "src/components/blueprint-workbench.tsx",
          "Large blueprint workbench component for visualization."
        ),
        endLine: 4_500
      },
      focused: createDocument(
        "focused",
        "analyzeTypeScriptRepo",
        "src/lib/blueprint/repo.ts",
        "Handles repository analysis for the blueprint graph."
      )
    };
    const retrieval = { topK: 4, rerankK: 2, maxContextChars: 8000 };

    const results = rerankResults(
      "where is repo analysis handled?",
      await searchDocuments(
        "where is repo analysis handled?",
        documents,
        new TestEmbeddingProvider(),
        retrieval,
        new TestVectorStore(Object.values(documents))
      ),
      retrieval
    );

    expect(results[0]?.document.nodeId).toBe("focused");
  });

  it("calculates IDF and field scores for sparse metadata", () => {
    const document = {
      ...createDocument("auth", "requireAuth", "src/lib/auth.ts", "Handles user authentication."),
      signature: undefined as unknown as string
    };

    expect(calculateIdfScore(["auth"], ["auth"], new Map(), 1)).toBeGreaterThan(0);
    expect(calculateIdfScore([], ["auth"], new Map(), 1)).toBe(0);
    expect(calculateFieldScore("requireAuth", document)).toBeGreaterThan(0);
  });
});
