import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildContextPackage } from "../llm/context-builder.js";
import { FileCache } from "../store/file-cache.js";
import type { GraphSnapshot, IndexedNodeDocument } from "../types.js";
import { cleanupPaths, createTempDir } from "./helpers.js";

const createDocument = (
  nodeId: string,
  name: string,
  filePath: string,
  content: string
): IndexedNodeDocument => ({
  nodeId,
  name,
  kind: "function",
  filePath,
  summary: `${name} summary`,
  signature: `${name}(): void`,
  doc: content,
  vector: [1, 0],
  startLine: 1,
  endLine: 4
});

describe("context builder", () => {
  it("preserves primary file content before trimming related files", async () => {
    const repoPath = await createTempDir("coderag-context-");
    await fs.mkdir(path.join(repoPath, "src"), { recursive: true });
    await fs.writeFile(path.join(repoPath, "src", "primary.ts"), "PRIMARY-CONTENT", "utf8");
    await fs.writeFile(path.join(repoPath, "src", "related.ts"), "RELATED-CONTENT", "utf8");

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
        nodes: [
          {
            id: "primary",
            name: "primary",
            kind: "function",
            path: "src/primary.ts",
            summary: "Primary node",
            signature: "primary(): void",
            contract: { responsibilities: [], inputs: [], outputs: [], dependencies: [] },
            sourceRefs: []
          },
          {
            id: "related",
            name: "related",
            kind: "function",
            path: "src/related.ts",
            summary: "Related node",
            signature: "related(): void",
            contract: { responsibilities: [], inputs: [], outputs: [], dependencies: [] },
            sourceRefs: []
          }
        ],
        edges: [{ kind: "calls", from: "primary", to: "related" }]
      },
      sourceSpans: {
        primary: { nodeId: "primary", filePath: "src/primary.ts", startLine: 1, endLine: 1 },
        related: { nodeId: "related", filePath: "src/related.ts", startLine: 1, endLine: 1 }
      },
      callSites: {
        "calls:primary:related": {
          edgeKey: "calls:primary:related",
          fromNodeId: "primary",
          toNodeId: "related",
          filePath: "src/primary.ts",
          lineNumbers: [3, 3],
          expressions: ["related()"]
        }
      }
    };

    const documents: Record<string, IndexedNodeDocument> = {
      primary: createDocument("primary", "primary", "src/primary.ts", "primary doc"),
      related: createDocument("related", "related", "src/related.ts", "related doc")
    };

    const { context, limits } = await buildContextPackage(
      "what calls related",
      repoPath,
      snapshot,
      documents,
      { topK: 4, rerankK: 2, maxContextChars: 18 },
      new FileCache(),
      snapshot.graph.nodes[0],
      [snapshot.graph.nodes[1]],
      [],
      "context-only"
    );

    expect(context.primaryNode?.fullFileContent).toBe("PRIMARY-CONTENT");
    expect(context.relatedNodes[0]?.callSiteLines).toEqual([3]);
    expect(context.warnings).toContain("Truncated src/related.ts to stay within the context budget.");
    expect(limits).toEqual({
      primaryDoc: 1,
      primaryFile: 5,
      relatedDoc: 1,
      relatedFile: 1
    });

    await cleanupPaths([repoPath]);
  });

  it("returns a missing-primary summary and drops exhausted related content", async () => {
    const repoPath = await createTempDir("coderag-context-");
    await fs.mkdir(path.join(repoPath, "src"), { recursive: true });
    await fs.writeFile(path.join(repoPath, "src", "related.ts"), "RELATED", "utf8");

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
        nodes: [
          {
            id: "related",
            name: "related",
            kind: "function",
            path: "src/related.ts",
            summary: "Related node",
            signature: "related(): void",
            contract: { responsibilities: [], inputs: [], outputs: [], dependencies: [] },
            sourceRefs: []
          }
        ],
        edges: []
      },
      sourceSpans: {
        related: { nodeId: "related", filePath: "src/related.ts", startLine: 1, endLine: 1 }
      },
      callSites: {}
    };
    const documents: Record<string, IndexedNodeDocument> = {
      related: createDocument("related", "related", "src/related.ts", "related doc")
    };

    const { context, limits } = await buildContextPackage(
      "missing",
      repoPath,
      snapshot,
      documents,
      { topK: 4, rerankK: 2, maxContextChars: 0 },
      new FileCache(),
      undefined,
      [snapshot.graph.nodes[0]],
      [],
      "context-only"
    );

    expect(context.primaryNode).toBeNull();
    expect(context.graphSummary).toContain("No matching node");
    expect(context.relatedNodes[0]?.fullFileContent).toBe("");
    expect(context.warnings).toContain("Dropped file content for src/related.ts because the context budget was exhausted.");
    expect(limits).toEqual({
      primaryDoc: 1,
      primaryFile: 1,
      relatedDoc: 1,
      relatedFile: 1
    });

    await cleanupPaths([repoPath]);
  });

  it("builds a primary-only graph summary when there are no related nodes", async () => {
    const repoPath = await createTempDir("coderag-context-");
    await fs.mkdir(path.join(repoPath, "src"), { recursive: true });
    await fs.writeFile(path.join(repoPath, "src", "primary.ts"), "PRIMARY", "utf8");

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
        nodes: [
          {
            id: "primary",
            name: "primary",
            kind: "function",
            path: "src/primary.ts",
            summary: "Primary node",
            signature: "primary(): void",
            contract: { responsibilities: [], inputs: [], outputs: [], dependencies: [] },
            sourceRefs: []
          }
        ],
        edges: []
      },
      sourceSpans: {
        primary: { nodeId: "primary", filePath: "src/primary.ts", startLine: 1, endLine: 1 }
      },
      callSites: {}
    };
    const documents: Record<string, IndexedNodeDocument> = {
      primary: createDocument("primary", "primary", "src/primary.ts", "primary doc")
    };

    const { context, limits } = await buildContextPackage(
      "primary",
      repoPath,
      snapshot,
      documents,
      { topK: 4, rerankK: 2, maxContextChars: 64 },
      new FileCache(),
      snapshot.graph.nodes[0],
      [],
      [],
      "context-only"
    );

    expect(context.graphSummary).toBe("Primary node: primary.");
    expect(limits).toEqual({
      primaryDoc: 5,
      primaryFile: 16,
      relatedDoc: 1,
      relatedFile: 5
    });
    await cleanupPaths([repoPath]);
  });
});
