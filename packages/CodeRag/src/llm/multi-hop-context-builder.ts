import type { BlueprintNode } from "@abhinav2203/codeflow-core/schema";

import type {
  ContextPackage,
  GraphSnapshot,
  IndexedNodeDocument,
  MultiHopRetrievalResult,
  RetrievedNodeContext,
  RetrievalConfig
} from "../types.js";
import type { SectionLimits } from "./prompt.js";
import { deriveSectionLimits } from "./context-builder.js";
import { FileCache } from "../store/file-cache.js";
import { createRetrievedNodeContext } from "../retrieval/page-index.js";

const buildMultiHopGraphSummary = (
  subQuestions: string[],
  retrievalResult: MultiHopRetrievalResult,
  snapshot: GraphSnapshot
): string => {
  const filesSpanned = new Set<string>();
  for (const node of retrievalResult.deduplicatedNodes) {
    if (node.path) {
      filesSpanned.add(node.path);
    }
  }

  const parts: string[] = [
    `Multi-hop retrieval: ${subQuestions.length} sub-questions, ${retrievalResult.deduplicatedNodes.length} unique code nodes across ${filesSpanned.size} files.`
  ];

  for (let i = 0; i < subQuestions.length; i += 1) {
    const meta = retrievalResult.retrievalMetadata[i];
    if (meta) {
      const primaryName = meta.primaryNode?.name ?? "none";
      parts.push(
        `Sub-question ${i + 1}: "${meta.subQuestion}" → primary: ${primaryName}, ${meta.relatedNodes.length} related, files: ${meta.filesReferenced.join(", ") || "none"}`
      );
    }
  }

  return parts.join(" ");
};

const buildRelatedNodeContexts = async (
  nodes: BlueprintNode[],
  repoPath: string,
  fileCache: FileCache,
  snapshot: GraphSnapshot,
  documents: Record<string, IndexedNodeDocument>,
  subQuestionIndex?: number
): Promise<RetrievedNodeContext[]> => {
  const contexts: RetrievedNodeContext[] = [];

  for (const node of nodes) {
    const doc = documents[node.id];
    if (!doc) {
      continue;
    }

    const ctx = await createRetrievedNodeContext(
      repoPath,
      fileCache,
      snapshot,
      doc,
      "multi-hop"
    );
    if (subQuestionIndex !== undefined) {
      ctx.subQuestionIndex = subQuestionIndex;
    }
    contexts.push(ctx);
  }

  return contexts;
};

/**
 * Builds a ContextPackage from multi-hop retrieval results.
 * Unlike the single-node path, there is no single primary node.
 * The first retrieved node is promoted to "primary" for display purposes,
 * and all remaining nodes are listed as related.
 *
 * Returns both the context and the derived section limits for prompt building.
 */
export const buildMultiHopContextPackage = async (
  question: string,
  subQuestions: string[],
  retrievalResult: MultiHopRetrievalResult,
  repoPath: string,
  snapshot: GraphSnapshot,
  documents: Record<string, IndexedNodeDocument>,
  retrieval: RetrievalConfig,
  fileCache: FileCache
): Promise<{ context: ContextPackage; limits: SectionLimits }> => {
  const allNodes = retrievalResult.deduplicatedNodes;

  const allContexts = await buildRelatedNodeContexts(
    allNodes,
    repoPath,
    fileCache,
    snapshot,
    documents
  );

  const firstCtx = allContexts[0];
  const primaryContext: RetrievedNodeContext | null = firstCtx
    ? Object.assign({}, firstCtx, { relationship: "primary" as const, subQuestionIndex: undefined })
    : null;
  const relatedContexts: RetrievedNodeContext[] = allContexts.length > 1 ? allContexts.slice(1) : [];

  const warnings: string[] = [];
  let remainingBudget = retrieval.maxContextChars;

  let fittedPrimary: RetrievedNodeContext | null = primaryContext;
  if (fittedPrimary && fittedPrimary.fullFileContent.length > remainingBudget / 2) {
    warnings.push(`Truncated primary node ${fittedPrimary.filePath} to stay within context budget.`);
    fittedPrimary = {
      ...fittedPrimary,
      fullFileContent: fittedPrimary.fullFileContent.slice(0, Math.max(0, remainingBudget / 2))
    };
    remainingBudget = Math.max(0, remainingBudget - fittedPrimary.fullFileContent.length);
  } else if (fittedPrimary) {
    remainingBudget = Math.max(0, remainingBudget - fittedPrimary.fullFileContent.length);
  }

  const fittedRelated: RetrievedNodeContext[] = [];
  for (const ctx of relatedContexts) {
    if (remainingBudget <= 0) {
      warnings.push(`Dropped file content for ${ctx.filePath} because the context budget was exhausted.`);
      fittedRelated.push({ ...ctx, fullFileContent: "" });
      continue;
    }

    if (ctx.fullFileContent.length > remainingBudget) {
      warnings.push(`Truncated ${ctx.filePath} to stay within context budget.`);
      fittedRelated.push({
        ...ctx,
        fullFileContent: ctx.fullFileContent.slice(0, Math.max(0, remainingBudget))
      });
      remainingBudget = 0;
    } else {
      remainingBudget -= ctx.fullFileContent.length;
      fittedRelated.push(ctx);
    }
  }

  const subQuestionResults = retrievalResult.retrievalMetadata.map((meta) => ({
    question: meta.subQuestion,
    primaryNodeId: meta.primaryNode?.id ?? null,
    relatedNodeCount: meta.relatedNodes.length,
    filesReferenced: meta.filesReferenced
  }));

  const limits = deriveSectionLimits(retrieval);

  return {
    context: {
      question,
      answerMode: "llm" as const,
      retrievalMode: "multi-hop" as const,
      primaryNode: fittedPrimary,
      relatedNodes: fittedRelated,
      graphSummary: buildMultiHopGraphSummary(subQuestions, retrievalResult, snapshot),
      warnings,
      subQuestions,
      subQuestionResults
    },
    limits
  };
};