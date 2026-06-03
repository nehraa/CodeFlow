import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createRetrievedNodeContext } from "../retrieval/page-index.js";
import { FileCache } from "../store/file-cache.js";
import type { GraphSnapshot, IndexedNodeDocument } from "../types.js";
import { cleanupPaths, createTempDir } from "./helpers.js";

describe("page index retrieval", () => {
  it("reads cached files and resolves call site lines for both relationships", async () => {
    const repoPath = await createTempDir("coderag-page-");
    await fs.mkdir(path.join(repoPath, "src"), { recursive: true });
    const filePath = path.join(repoPath, "src", "auth.ts");
    await fs.writeFile(filePath, "export function requireAuth() {}", "utf8");

    const snapshot: GraphSnapshot = {
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
      callSites: {
        "calls:primary:target": {
          edgeKey: "calls:primary:target",
          fromNodeId: "primary",
          toNodeId: "target",
          filePath: "src/auth.ts",
          lineNumbers: [4, 2, 4],
          expressions: ["target()"]
        }
      }
    };
    const document: IndexedNodeDocument = {
      nodeId: "target",
      name: "target",
      kind: "function",
      filePath: "src/auth.ts",
      summary: "target",
      signature: "target(): void",
      doc: "target",
      vector: [1, 0],
      startLine: 1,
      endLine: 1
    };
    const fileCache = new FileCache();

    const callsContext = await createRetrievedNodeContext(repoPath, fileCache, snapshot, document, "calls", "primary");
    await fs.writeFile(filePath, "updated", "utf8");
    const cachedContent = await fileCache.read(filePath);
    fileCache.invalidate(filePath);
    const refreshedContent = await fileCache.read(filePath);
    const calledByContext = await createRetrievedNodeContext(repoPath, fileCache, snapshot, {
      ...document,
      nodeId: "primary"
    }, "called-by", "target");
    fileCache.clear();

    expect(callsContext.callSiteLines).toEqual([2, 4]);
    expect(cachedContent).toContain("updated");
    expect(refreshedContent).toContain("updated");
    expect(calledByContext.callSiteLines).toEqual([2, 4]);

    await cleanupPaths([repoPath]);
  });

  it("returns empty call-site lines when no source node is provided", async () => {
    const repoPath = await createTempDir("coderag-page-");
    await fs.mkdir(path.join(repoPath, "src"), { recursive: true });
    await fs.writeFile(path.join(repoPath, "src", "auth.ts"), "export const value = 1;", "utf8");

    const snapshot: GraphSnapshot = {
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
    };
    const document: IndexedNodeDocument = {
      nodeId: "primary",
      name: "primary",
      kind: "function",
      filePath: "src/auth.ts",
      summary: "primary",
      signature: "primary(): void",
      doc: "primary",
      vector: [1, 0],
      startLine: 1,
      endLine: 1
    };

    const context = await createRetrievedNodeContext(repoPath, new FileCache(), snapshot, document, "primary");
    const callsContext = await createRetrievedNodeContext(repoPath, new FileCache(), snapshot, document, "calls");
    const calledByContext = await createRetrievedNodeContext(repoPath, new FileCache(), snapshot, document, "called-by");
    const missingCallSiteContext = await createRetrievedNodeContext(
      repoPath,
      new FileCache(),
      snapshot,
      document,
      "calls",
      "missing"
    );
    const missingCalledByContext = await createRetrievedNodeContext(
      repoPath,
      new FileCache(),
      snapshot,
      document,
      "called-by",
      "missing"
    );

    expect(context.callSiteLines).toEqual([]);
    expect(callsContext.callSiteLines).toEqual([]);
    expect(calledByContext.callSiteLines).toEqual([]);
    expect(missingCallSiteContext.callSiteLines).toEqual([]);
    expect(missingCalledByContext.callSiteLines).toEqual([]);
    await cleanupPaths([repoPath]);
  });
});
