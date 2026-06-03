import { describe, expect, it } from "vitest";

import { deduplicateAndMerge, parallelRetrieve } from "../retrieval/multi-hop.js";
import type { BlueprintNode, BlueprintGraph } from "@abhinav2203/codeflow-core/schema";
import type { GraphSnapshot, IndexedNodeDocument, RetrievalConfig, EmbeddingProvider, VectorStore } from "../types.js";

const makeNode = (id: string, name: string, path?: string): BlueprintNode =>
  ({
    id,
    kind: "function",
    name,
    summary: `Summary of ${name}`,
    path,
    contract: { responsibilities: [], inputs: [], outputs: [], dependencies: [] },
    sourceRefs: []
  }) as unknown as BlueprintNode;

const makeDocument = (nodeId: string, name: string, filePath: string): IndexedNodeDocument => ({
  nodeId,
  name,
  kind: "function",
  filePath,
  summary: `Summary of ${name}`,
  doc: `Document for ${name}`,
  vector: [0.1, 0.2, 0.3],
  startLine: 1,
  endLine: 10
});

const emptySnapshot: GraphSnapshot = {
  provider: "test",
  repoPath: "/test",
  generatedAt: "2024-01-01",
  graph: {
    projectName: "test",
    mode: "essential",
    phase: "implementation",
    generatedAt: "2024-01-01",
    nodes: [],
    edges: [],
    workflows: [],
    warnings: []
  } as BlueprintGraph,
  sourceSpans: {},
  callSites: {}
};

const emptyDocuments: Record<string, IndexedNodeDocument> = {};

const defaultRetrieval: RetrievalConfig = {
  topK: 6,
  rerankK: 3,
  maxContextChars: 16000
};

describe("deduplicateAndMerge", () => {
  it("deduplicates nodes appearing in multiple sub-question results", () => {
    const nodeA = makeNode("a", "functionA", "fileA.ts");
    const nodeB = makeNode("b", "functionB", "fileB.ts");
    const nodeC = makeNode("c", "functionC", "fileC.ts");

    // Simulate results where nodeA appears in both sub-questions
    const results = [
      {
        subQuestion: "What does functionA do?",
        searchResults: [],
        primaryNode: nodeA,
        relatedNodes: [nodeB],
        filesReferenced: ["fileA.ts", "fileB.ts"]
      },
      {
        subQuestion: "How does functionA call functionC?",
        searchResults: [],
        primaryNode: nodeA, // same node
        relatedNodes: [nodeC],
        filesReferenced: ["fileA.ts", "fileC.ts"]
      }
    ];

    const merged = deduplicateAndMerge(results);

    expect(merged.deduplicatedNodes).toHaveLength(3);
    expect(merged.deduplicatedNodes.map((n) => n.id)).toContain("a");
    expect(merged.deduplicatedNodes.map((n) => n.id)).toContain("b");
    expect(merged.deduplicatedNodes.map((n) => n.id)).toContain("c");
    expect(merged.primaryNodes).toHaveLength(2);
    expect(merged.primaryNodes[0]).toBe(nodeA);
    expect(merged.primaryNodes[1]).toBe(nodeA);
    expect(merged.retrievalMetadata).toHaveLength(2);
  });

  it("handles empty results gracefully", () => {
    const merged = deduplicateAndMerge([]);
    expect(merged.deduplicatedNodes).toHaveLength(0);
    expect(merged.primaryNodes).toHaveLength(0);
    expect(merged.retrievalMetadata).toHaveLength(0);
  });

  it("preserves which sub-question retrieved each node in metadata", () => {
    const nodeA = makeNode("a", "handlerA", "handler.ts");
    const nodeB = makeNode("b", "handlerB", "handler2.ts");

    const results = [
      {
        subQuestion: "What is handlerA?",
        searchResults: [],
        primaryNode: nodeA,
        relatedNodes: [],
        filesReferenced: ["handler.ts"]
      },
      {
        subQuestion: "What is handlerB?",
        searchResults: [],
        primaryNode: nodeB,
        relatedNodes: [],
        filesReferenced: ["handler2.ts"]
      }
    ];

    const merged = deduplicateAndMerge(results);

    expect(merged.retrievalMetadata[0].subQuestion).toBe("What is handlerA?");
    expect(merged.retrievalMetadata[0].primaryNode).toBe(nodeA);
    expect(merged.retrievalMetadata[1].subQuestion).toBe("What is handlerB?");
    expect(merged.retrievalMetadata[1].primaryNode).toBe(nodeB);
  });
});
