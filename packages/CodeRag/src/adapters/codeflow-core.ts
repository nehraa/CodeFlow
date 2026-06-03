import path from "node:path";

import { analyzeRepo } from "@abhinav2203/codeflow-core/analyzer";
import type { BlueprintGraph } from "@abhinav2203/codeflow-core/schema";

import type { CallSite, GraphProvider, GraphSnapshot, SourceSpan } from "../types.js";

/**
 * Multi-language graph provider using tree-sitter via codeflow-core.
 * Supports: TypeScript, JavaScript, Go, Python, C, C++, Rust.
 */
export class CodeflowCoreGraphProvider implements GraphProvider {
  readonly name = "codeflow-core";

  async analyze(repoPath: string): Promise<BlueprintGraph> {
    const repoResult = await analyzeRepo(path.resolve(repoPath));

    return {
      projectName: path.basename(repoPath),
      mode: "essential",
      generatedAt: new Date().toISOString(),
      nodes: repoResult.nodes,
      edges: repoResult.edges,
      workflows: repoResult.workflows,
      warnings: repoResult.warnings,
      phase: "spec"
    };
  }
}

export const buildGraphSnapshot = async (
  repoPath: string,
  provider: GraphProvider
): Promise<GraphSnapshot> => {
  const resolvedRepoPath = path.resolve(repoPath);

  // For the codeflow-core provider, call analyzeRepo directly to get
  // sourceSpans and callSites in a single pass (avoids double parsing).
  if (provider instanceof CodeflowCoreGraphProvider) {
    const repoResult = await analyzeRepo(resolvedRepoPath);

    const graph: BlueprintGraph = {
      projectName: path.basename(resolvedRepoPath),
      mode: "essential",
      generatedAt: new Date().toISOString(),
      nodes: repoResult.nodes,
      edges: repoResult.edges,
      workflows: repoResult.workflows,
      warnings: repoResult.warnings,
      phase: "spec"
    };

    const sourceSpans: Record<string, SourceSpan> = {};
    for (const [nodeId, span] of Object.entries(repoResult.sourceSpans)) {
      sourceSpans[nodeId] = {
        nodeId: span.nodeId,
        filePath: span.filePath,
        startLine: span.startLine,
        endLine: span.endLine,
        symbol: span.symbol
      };
    }

    const callSites: Record<string, CallSite> = {};
    for (const [edgeKey, entry] of Object.entries(repoResult.callSites)) {
      callSites[edgeKey] = {
        edgeKey: entry.edgeKey,
        fromNodeId: entry.fromNodeId,
        toNodeId: entry.toNodeId,
        filePath: entry.filePath,
        lineNumbers: entry.lineNumbers,
        expressions: entry.expressions
      };
    }

    return {
      provider: provider.name,
      repoPath: resolvedRepoPath,
      generatedAt: new Date().toISOString(),
      graph,
      sourceSpans,
      callSites
    };
  }

  // Fallback for other providers: no span/call-site data.
  const graph = await provider.analyze(resolvedRepoPath);
  return {
    provider: provider.name,
    repoPath: resolvedRepoPath,
    generatedAt: new Date().toISOString(),
    graph,
    sourceSpans: {},
    callSites: {}
  };
};
