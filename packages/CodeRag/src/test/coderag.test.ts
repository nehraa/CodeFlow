import fs from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { NotFoundError } from "../errors/index.js";
import { createCodeRag } from "../index.js";
import { cleanupPaths, createRuntimeConfig, createTempDir, createTempRepo } from "./helpers.js";

const createdPaths: string[] = [];

afterEach(async () => {
  await cleanupPaths(createdPaths);
});

describe("CodeRag", () => {
  it("indexes a repo and answers retrieval queries without an llm", async () => {
    const repoPath = await createTempRepo();
    createdPaths.push(repoPath);
    const coderag = createCodeRag(createRuntimeConfig(repoPath));

    const summary = await coderag.index();
    expect(summary.indexedNodeCount).toBeGreaterThan(0);

    const lookup = await coderag.lookup("requireAuth");
    expect(lookup.node.name).toBe("requireAuth");
    expect(lookup.doc?.filePath).toBe("src/lib/auth.ts");

    const impact = await coderag.impact("requireAuth");
    expect(impact.impactedNodes.map((node) => node.name)).toContain("getSession");

    const result = await coderag.query("where is auth handled?");
    expect(result.answerMode).toBe("context-only");
    expect(result.context.primaryNode?.filePath).toBe("src/lib/auth.ts");
    expect(result.answer.toLowerCase()).toContain("primary node");

    await coderag.close();
  });

  it("reindexes changed files and updates the retrieved graph state", async () => {
    const repoPath = await createTempRepo();
    createdPaths.push(repoPath);
    const coderag = createCodeRag(createRuntimeConfig(repoPath));

    await coderag.index();
    await fs.writeFile(
      path.join(repoPath, "src", "lib", "api.ts"),
      `import { requireAuth } from "./auth";

export function getSession(rawToken: string): { userId: string } {
  requireAuth(rawToken);
  return { userId: "user-2" };
}

export function getAdminSession(rawToken: string): { adminId: string } {
  requireAuth(rawToken);
  return { adminId: "admin-1" };
}
`,
      "utf8"
    );

    await coderag.reindex();
    const impact = await coderag.impact("requireAuth", 1);
    expect(impact.impactedNodes.map((node) => node.name)).toContain("getAdminSession");

    await coderag.close();
  });

  it("loads an existing index when querying a fresh instance", async () => {
    const repoPath = await createTempRepo();
    createdPaths.push(repoPath);
    const config = createRuntimeConfig(repoPath);
    const firstInstance = createCodeRag(config);
    await firstInstance.index();
    await firstInstance.close();

    const secondInstance = createCodeRag(createRuntimeConfig(repoPath));
    const result = await secondInstance.query("requireAuth");

    expect(result.context.primaryNode?.name).toBe("requireAuth");
    expect((await secondInstance.status()).indexed).toBe(true);

    await secondInstance.close();
  });

  it("uses the configured llm transport when answer generation is enabled", async () => {
    const repoPath = await createTempRepo();
    createdPaths.push(repoPath);
    const config = createRuntimeConfig(repoPath, {
      llm: {
        enabled: true,
        transport: "custom-http",
        baseUrl: "http://127.0.0.1:9999",
        model: "local-model",
        timeoutMs: 1000,
        customHttpFormat: "json",
        headers: {}
      }
    });
    const generate = vi.fn().mockResolvedValue({ answer: "llm answer" });
    config.llmTransport = { kind: "custom-http", generate };
    const coderag = createCodeRag(config);

    await coderag.index();
    const result = await coderag.query("requireAuth", { includeAnswer: true });

    expect(result.answerMode).toBe("llm");
    expect(result.answer).toBe("llm answer");
    expect(generate).toHaveBeenCalled();

    await coderag.close();
  });

  it("throws structured not-found errors for unknown identifiers", async () => {
    const repoPath = await createTempRepo();
    createdPaths.push(repoPath);
    const coderag = createCodeRag(createRuntimeConfig(repoPath));

    await coderag.index();
    await expect(coderag.lookup("missing-node")).rejects.toThrow(NotFoundError);

    await coderag.close();
  });

  it("explains nodes and reports empty impact sets", async () => {
    const repoPath = await createTempRepo();
    createdPaths.push(repoPath);
    const coderag = createCodeRag(createRuntimeConfig(repoPath));

    await coderag.index();
    const explanation = await coderag.explain("requireAuth");
    const impact = await coderag.impact("getSession");

    expect(explanation.summary).toContain("Dependencies:");
    expect(impact.graphSummary).toContain("has no upstream dependents");

    await coderag.close();
  });

  it("fails when query execution is missing required runtime dependencies", async () => {
    const repoPath = await createTempRepo();
    createdPaths.push(repoPath);
    const config = createRuntimeConfig(repoPath);
    const coderag = createCodeRag(config);

    await coderag.index();
    config.embeddingProvider = undefined;
    await expect(coderag.query("requireAuth")).rejects.toThrow(NotFoundError);

    await coderag.close();
  });

  it("automatically indexes on the first query when no persisted state exists", async () => {
    const repoPath = await createTempRepo();
    createdPaths.push(repoPath);
    const coderag = createCodeRag(createRuntimeConfig(repoPath));

    const result = await coderag.query("requireAuth");

    expect(result.context.primaryNode?.name).toBe("requireAuth");
    expect((await coderag.status()).indexed).toBe(true);

    await coderag.close();
  });

  it("hydrates state after waiting for another index process to finish", async () => {
    const repoPath = await createTempRepo();
    createdPaths.push(repoPath);
    const indexedInstance = createCodeRag(createRuntimeConfig(repoPath));
    await indexedInstance.index();

    const snapshot = (indexedInstance as any).loadedState.snapshot;
    const documents = (indexedInstance as any).loadedState.documents;

    const waitingInstance = createCodeRag(createRuntimeConfig(repoPath)) as any;
    waitingInstance.indexer = {
      loadState: vi.fn().mockResolvedValue({ snapshot: null, documents: {} }),
      waitForUnlockedState: vi.fn().mockResolvedValue({ snapshot, documents }),
      index: vi.fn()
    };

    const result = await waitingInstance.lookup("require");

    expect(result.node.name).toBe("requireAuth");
    expect(waitingInstance.indexer.index).not.toHaveBeenCalled();

    await indexedInstance.close();
    await waitingInstance.close();
  });

  it("deduplicates concurrent index requests", async () => {
    const repoPath = await createTempRepo();
    createdPaths.push(repoPath);
    const coderag = createCodeRag(createRuntimeConfig(repoPath)) as any;
    const summaryPromise = Promise.resolve({
      indexedNodeCount: 1,
      fullReindex: true,
      changedNodeIds: ["auth"],
      removedNodeIds: [],
      snapshot: {
        provider: "test",
        repoPath,
        generatedAt: "2026-04-01T00:00:00.000Z",
        graph: {
          projectName: "repo",
          mode: "essential",
          generatedAt: "2026-04-01T00:00:00.000Z",
          phase: "spec",
          workflows: [],
          warnings: [],
          nodes: [],
          edges: []
        },
        sourceSpans: {},
        callSites: {}
      }
    });
    coderag.indexer = {
      index: vi.fn().mockReturnValue(summaryPromise),
      loadState: vi.fn(),
      waitForUnlockedState: vi.fn()
    };
    coderag.manifestStore = {
      loadDocuments: vi.fn().mockResolvedValue({})
    };

    const [first, second] = await Promise.all([coderag.index(), coderag.index()]);

    expect(first).toBe(second);
    expect(coderag.indexer.index).toHaveBeenCalledTimes(1);
    await coderag.close();
  });

  it("returns a no-match answer when retrieval does not resolve a primary node", async () => {
    const repoPath = await createTempDir("coderag-empty-");
    createdPaths.push(repoPath);
    const coderag = createCodeRag(createRuntimeConfig(repoPath)) as any;
    coderag.loadedState = {
      snapshot: {
        provider: "test",
        repoPath,
        generatedAt: "2026-04-01T00:00:00.000Z",
        graph: {
          projectName: "repo",
          mode: "essential",
          generatedAt: "2026-04-01T00:00:00.000Z",
          phase: "spec",
          workflows: [],
          warnings: [],
          nodes: [],
          edges: []
        },
        sourceSpans: {},
        callSites: {}
      },
      documents: {}
    };

    const result = await coderag.query("anything");

    expect(result.answerMode).toBe("context-only");
    expect(result.context.primaryNode).toBeNull();
    expect(result.answer).toBe("No matching code node was found in the current index.");

    await coderag.close();
  });

  it("omits related-node text when the primary node has no dependencies or dependents", async () => {
    const repoPath = await createTempDir("coderag-single-");
    createdPaths.push(repoPath);
    const config = createRuntimeConfig(repoPath);
    const vector = await config.embeddingProvider!.embed("singleNode");
    const coderag = createCodeRag(config) as any;
    coderag.loadedState = {
      snapshot: {
        provider: "test",
        repoPath,
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
              id: "single",
              name: "singleNode",
              kind: "function",
              path: "src/single.ts",
              summary: "single",
              signature: "singleNode(): void",
              contract: { responsibilities: [], inputs: [], outputs: [], dependencies: [] },
              sourceRefs: [{ kind: "repo", symbol: "singleNode" }]
            }
          ],
          edges: []
        },
        sourceSpans: {
          single: {
            nodeId: "single",
            filePath: "src/single.ts",
            startLine: 1,
            endLine: 1,
            symbol: "singleNode"
          }
        },
        callSites: {}
      },
      documents: {
        single: {
          nodeId: "single",
          name: "singleNode",
          kind: "function",
          filePath: "src/single.ts",
          summary: "single",
          signature: "singleNode(): void",
          doc: "singleNode",
          vector,
          startLine: 1,
          endLine: 1
        }
      }
    };
    await fs.mkdir(path.join(repoPath, "src"), { recursive: true });
    await fs.writeFile(path.join(repoPath, "src", "single.ts"), "export function singleNode() {}", "utf8");

    const result = await coderag.query("singleNode");

    expect(result.answer).toBe("Primary node: singleNode.");
    await coderag.close();
  });

  it("reports status using config fallbacks before any index exists", async () => {
    const repoPath = await createTempRepo();
    createdPaths.push(repoPath);
    const coderag = createCodeRag(createRuntimeConfig(repoPath));
    const status = await coderag.status();

    expect(status.indexed).toBe(false);
    expect(status.provider).toBe("codeflow-core");
    expect(status.embeddingProvider).toBe("local-hash");
    expect(status.embeddingModel).toBe("local-hash");
    expect(status.embeddingDimensions).toBe(256);

    await coderag.close();
  });

  it("reports a null provider when no graph provider is configured and no index exists", async () => {
    const repoPath = await createTempRepo();
    createdPaths.push(repoPath);
    const config = createRuntimeConfig(repoPath);
    config.graphProvider = undefined;
    config.embeddingProvider = undefined;
    const coderag = createCodeRag(config);
    const status = await coderag.status();

    expect(status.provider).toBeNull();
    expect(status.embeddingProvider).toBe("unknown");
    expect(status.embeddingModel).toBe("unknown");
    expect(status.embeddingDimensions).toBe(0);
    await coderag.close();
  });

  it("explains leaf nodes with explicit none summaries", async () => {
    const repoPath = await createTempRepo();
    createdPaths.push(repoPath);
    const coderag = createCodeRag(createRuntimeConfig(repoPath));

    await coderag.index();
    const explanation = await coderag.explain("verifyToken");

    expect(explanation.summary).toContain("Dependencies: none.");
    await coderag.close();
  });

  it("explains isolated nodes with no dependencies and no dependents", async () => {
    const repoPath = await createTempDir("coderag-isolated-");
    createdPaths.push(repoPath);
    const config = createRuntimeConfig(repoPath);
    const coderag = createCodeRag(config) as any;
    coderag.loadedState = {
      snapshot: {
        provider: "test",
        repoPath,
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
              id: "isolated",
              name: "isolatedNode",
              kind: "function",
              path: "src/isolated.ts",
              summary: "isolated",
              signature: "isolatedNode(): void",
              contract: { responsibilities: [], inputs: [], outputs: [], dependencies: [] },
              sourceRefs: [{ kind: "repo", symbol: "isolatedNode" }]
            }
          ],
          edges: []
        },
        sourceSpans: {
          isolated: {
            nodeId: "isolated",
            filePath: "src/isolated.ts",
            startLine: 1,
            endLine: 1,
            symbol: "isolatedNode"
          }
        },
        callSites: {}
      },
      documents: {}
    };

    const explanation = await coderag.explain("isolatedNode");

    expect(explanation.summary).toContain("Dependencies: none. Dependents: none.");
    await coderag.close();
  });
});
