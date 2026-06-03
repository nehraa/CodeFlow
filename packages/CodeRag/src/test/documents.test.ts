import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

import { buildIndexManifest, buildIndexedDocuments, buildNodeDocument } from "../indexer/documents.js";
import type { EmbeddingProvider, GraphSnapshot, SourceSpan } from "../types.js";
import { cleanupPaths, createTempDir, createTempRepo } from "./helpers.js";

class TestEmbeddingProvider implements EmbeddingProvider {
  readonly name = "test";
  readonly model = "test-model";
  readonly dimensions = 4;

  async embed(text: string): Promise<number[]> {
    return [text.length, 0, 0, 0];
  }
}

class BatchTestEmbeddingProvider implements EmbeddingProvider {
  readonly name = "batch-test";
  readonly model = "batch-test-model";
  readonly dimensions = 4;
  readonly maxBatchSize = 2;
  readonly batches: string[][] = [];

  async embed(_text: string): Promise<number[]> {
    throw new Error("buildIndexedDocuments should use embedBatch when available");
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    this.batches.push(texts);
    return texts.map((text) => [text.length, texts.length, 0, 0]);
  }
}

const snapshot: GraphSnapshot = {
  provider: "test",
  repoPath: "/repo",
  generatedAt: "2026-04-01T00:00:00.000Z",
  graph: {
    projectName: "repo",
    mode: "essential",
    generatedAt: "2026-04-01T00:00:00.000Z",
    phase: "spec",
    workflows: [],
    warnings: [],
    nodes: [
      {
        id: "auth",
        name: "requireAuth",
        kind: "function",
        path: "src/lib/auth.ts",
        summary: "Handles user authentication.",
        signature: "requireAuth(rawToken: string): string",
        contract: {
          responsibilities: ["Authenticate requests"],
          inputs: [{ name: "rawToken", type: "string" }],
          outputs: [{ name: "token", type: "string" }],
          dependencies: ["verifyToken"]
        },
        sourceRefs: [{ kind: "repo", symbol: "requireAuth", path: "src/lib/auth.ts" }]
      },
      {
        id: "verify",
        name: "verifyToken",
        kind: "function",
        path: "src/lib/auth.ts",
        summary: "Parses and normalizes tokens.",
        signature: "verifyToken(rawToken: string): string",
        contract: {
          responsibilities: ["Normalize tokens"],
          inputs: [{ name: "rawToken", type: "string" }],
          outputs: [{ name: "token", type: "string" }],
          dependencies: []
        },
        sourceRefs: [{ kind: "repo", symbol: "verifyToken", path: "src/lib/auth.ts" }]
      },
      {
        id: "session",
        name: "getSession",
        kind: "function",
        path: "src/lib/api.ts",
        summary: "Fetches the current session.",
        signature: "getSession(rawToken: string): Session",
        contract: {
          responsibilities: ["Resolve the current session"],
          inputs: [{ name: "rawToken", type: "string" }],
          outputs: [{ name: "session", type: "Session" }],
          dependencies: ["requireAuth"]
        },
        sourceRefs: [{ kind: "repo", symbol: "getSession", path: "src/lib/api.ts" }]
      }
    ],
    edges: [
      { kind: "calls", from: "auth", to: "verify" },
      { kind: "calls", from: "session", to: "auth" }
    ]
  },
  sourceSpans: {
    auth: { nodeId: "auth", filePath: "src/lib/auth.ts", startLine: 4, endLine: 10, symbol: "requireAuth" },
    verify: { nodeId: "verify", filePath: "src/lib/auth.ts", startLine: 1, endLine: 3, symbol: "verifyToken" },
    session: { nodeId: "session", filePath: "src/lib/api.ts", startLine: 3, endLine: 6, symbol: "getSession" }
  },
  callSites: {}
};

describe("document indexing", () => {
  it("builds node documents with correct edge summaries", () => {
    const sourceSpan: SourceSpan = snapshot.sourceSpans.auth;
    const document = buildNodeDocument(snapshot.graph.nodes[0]!, sourceSpan, snapshot);

    expect(document).toContain("Calls:\n- calls: verifyToken (src/lib/auth.ts)");
    expect(document).toContain("Called By:\n- calls: getSession (src/lib/api.ts)");
    expect(document).toContain("Source References:\n- repo:requireAuth @ src/lib/auth.ts");
  });

  it("falls back to edge ids when related nodes are missing and skips unspannable nodes", async () => {
    const partialSnapshot: GraphSnapshot = {
      ...snapshot,
      graph: {
        ...snapshot.graph,
        nodes: [
          ...snapshot.graph.nodes,
          {
            id: "dangling",
            name: "danglingNode",
            kind: "function",
            path: "src/lib/dangling.ts",
            summary: "dangling",
            signature: "",
            contract: { responsibilities: [], inputs: [], outputs: [], dependencies: [] },
            sourceRefs: []
          },
          {
            id: "missing-span",
            name: "missingSpan",
            kind: "function",
            path: "src/lib/missing.ts",
            summary: "missing span",
            signature: "",
            contract: { responsibilities: [], inputs: [], outputs: [], dependencies: [] },
            sourceRefs: []
          }
        ],
        edges: [...snapshot.graph.edges, { kind: "calls", from: "dangling", to: "unknown-target" }]
      }
    };

    const document = buildNodeDocument(
      partialSnapshot.graph.nodes.find((node) => node.id === "dangling")!,
      undefined,
      partialSnapshot
    );
    const indexedDocuments = await buildIndexedDocuments(partialSnapshot, new TestEmbeddingProvider());

    expect(document).toContain("Calls:\n- calls: unknown-target");
    expect(indexedDocuments).not.toHaveProperty("dangling");
    expect(indexedDocuments).not.toHaveProperty("missing-span");
    expect(indexedDocuments).toHaveProperty("auth");
  });

  it("formats optional field descriptions and unknown file metadata", () => {
    const document = buildNodeDocument(
      {
        id: "virtual",
        name: "virtualNode",
        kind: "function",
        summary: "virtual",
        signature: undefined,
        contract: {
          responsibilities: [],
          inputs: [{ name: "input", type: "string", description: "Input value" }],
          outputs: [{ name: "output", type: "string", description: "Output value" }],
          dependencies: []
        },
        sourceRefs: [{ kind: "repo" }]
      },
      undefined,
      {
        ...snapshot,
        graph: {
          ...snapshot.graph,
          nodes: [],
          edges: []
        }
      }
    );

    expect(document).toContain("Path: unknown");
    expect(document).toContain("File Name: unknown");
    expect(document).toContain("Signature: N/A");
    expect(document).toContain("- input: string - Input value");
    expect(document).toContain("- output: string - Output value");
    expect(document).toContain("Source References:\n- repo");
  });

  it("hashes indexed files into the manifest", async () => {
    const repoPath = await createTempRepo();
    const manifest = await buildIndexManifest(repoPath, snapshot, {
      auth: {
        nodeId: "auth",
        name: "requireAuth",
        kind: "function",
        filePath: "src/lib/auth.ts",
        summary: "Handles user authentication.",
        signature: "requireAuth(rawToken: string): string",
        doc: "doc",
        vector: [1, 0],
        startLine: 4,
        endLine: 10
      }
    }, {
      name: "gemini",
      model: "models/custom-embedder",
      dimensions: 768
    });

    expect(manifest.nodes.auth?.docHash).toHaveLength(64);
    expect(manifest.fileHashes["src/lib/auth.ts"]).toHaveLength(64);
    expect(manifest.embeddingProvider).toBe("gemini");
    expect(manifest.embeddingModel).toBe("models/custom-embedder");
    expect(manifest.embeddingDimensions).toBe(768);
    await cleanupPaths([repoPath]);
  });

  it("uses external docs when available and falls back to generated content when missing", async () => {
    const repoPath = await createTempRepo();
    const docsPath = await createTempDir("coderag-docs-");
    const runtimeSnapshot = {
      ...snapshot,
      repoPath
    };

    await fs.writeFile(path.join(docsPath, "auth.md"), "external auth doc", "utf8");

    const indexedDocuments = await buildIndexedDocuments(runtimeSnapshot, new TestEmbeddingProvider(), docsPath);

    expect(indexedDocuments.auth?.vector[0]).toBe("external auth doc".length);
    expect(indexedDocuments.session?.vector[0]).toBeGreaterThan("external auth doc".length);
    await cleanupPaths([repoPath, docsPath]);
  });

  it("uses batched embedding when the provider supports it", async () => {
    const repoPath = await createTempRepo();
    const runtimeSnapshot = {
      ...snapshot,
      repoPath
    };
    const provider = new BatchTestEmbeddingProvider();

    const indexedDocuments = await buildIndexedDocuments(runtimeSnapshot, provider);

    expect(provider.batches).toHaveLength(2);
    expect(provider.batches[0]).toHaveLength(2);
    expect(provider.batches[1]).toHaveLength(1);
    expect(indexedDocuments.auth?.vector[1]).toBe(2);
    expect(indexedDocuments.session?.vector[1]).toBe(1);
    await cleanupPaths([repoPath]);
  });

  it("uses local-hash defaults when no embedding metadata is supplied", async () => {
    const repoPath = await createTempRepo();
    const manifest = await buildIndexManifest(repoPath, snapshot, {});

    expect(manifest.embeddingProvider).toBe("local-hash");
    expect(manifest.embeddingModel).toBe("local-hash");
    expect(manifest.embeddingDimensions).toBe(256);
    await cleanupPaths([repoPath]);
  });
});
