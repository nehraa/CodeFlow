import type { QueryResult, RetrievedNodeContext } from "@abhinav2203/coderag";

import type { BlueprintNode } from "@/lib/blueprint/schema";
import { getCodeRag } from "@/lib/coderag";

const DEFAULT_RETRIEVAL_DEPTH = 2;
const MAX_RELATED_CONTEXT_NODES = 4;
const MAX_EXCERPT_LINES = 18;

export type AgentRetrievalContext = {
  attempted: boolean;
  explicit: boolean;
  used: boolean;
  query: string | null;
  depth: number;
  result: QueryResult | null;
  warning: string | null;
};

type ResolveAgentRetrievalArgs = {
  node: BlueprintNode;
  relatedNodes: BlueprintNode[];
  instruction?: string;
  retrievalQuery?: string;
  retrievalDepth?: number;
  allowAutoQuery?: boolean;
};

const clampDepth = (value?: number) => {
  if (!Number.isFinite(value)) {
    return DEFAULT_RETRIEVAL_DEPTH;
  }

  return Math.max(1, Math.min(6, Math.floor(value as number)));
};

const compactList = (items: string[], limit: number) =>
  items
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);

const lineRangeLabel = (node: RetrievedNodeContext) =>
  `${node.filePath}:${node.startLine}-${node.endLine}`;

const createExcerpt = (node: RetrievedNodeContext) => {
  const lines = node.fullFileContent.split(/\r?\n/);
  if (!lines.length) {
    return "No source excerpt available.";
  }

  const spanLineCount = Math.max(1, node.endLine - node.startLine + 1);
  const extraPadding = Math.max(2, Math.floor((MAX_EXCERPT_LINES - spanLineCount) / 2));
  const startLine = Math.max(1, node.startLine - extraPadding);
  const endLine = Math.min(lines.length, Math.max(node.endLine + extraPadding, startLine + 3));

  return lines
    .slice(startLine - 1, endLine)
    .map((line, index) => `${String(startLine + index).padStart(4, " ")} | ${line}`)
    .join("\n");
};

const formatRetrievedNode = (node: RetrievedNodeContext, label: string) => {
  const parts = [
    `${label}: ${node.name}`,
    `Kind: ${node.kind}`,
    `Relationship: ${node.relationship}`,
    `Location: ${lineRangeLabel(node)}`,
    `Summary: ${node.doc}`
  ];

  if (node.callSiteLines.length) {
    parts.push(`Call sites: ${node.callSiteLines.slice(0, 6).join(", ")}`);
  }

  parts.push("Excerpt:");
  parts.push("```ts");
  parts.push(createExcerpt(node));
  parts.push("```");

  return parts.join("\n");
};

export const buildAgentRetrievalQuery = ({
  node,
  relatedNodes,
  instruction
}: Pick<ResolveAgentRetrievalArgs, "node" | "relatedNodes" | "instruction">) => {
  const responsibilities = compactList(node.contract?.responsibilities ?? [], 2);
  const errors = compactList(node.contract?.errors ?? [], 2);
  const neighbors = compactList(
    relatedNodes
      .filter((candidate) => candidate.id !== node.id)
      .map((candidate) => candidate.name),
    4
  );

  const parts = [
    `Explain the code context needed to work on ${node.name}.`,
    node.summary ? `Node summary: ${node.summary}.` : "",
    node.signature ? `Signature: ${node.signature}.` : "",
    responsibilities.length ? `Responsibilities: ${responsibilities.join("; ")}.` : "",
    errors.length ? `Known errors: ${errors.join("; ")}.` : "",
    neighbors.length ? `Related nodes: ${neighbors.join(", ")}.` : "",
    instruction?.trim() ? `Focus: ${instruction.trim()}.` : "",
    "Include the most relevant files, dependencies, and callers."
  ].filter(Boolean);

  return parts.join(" ");
};

export const formatAgentRetrievalPrompt = (result: QueryResult) => {
  const sections = [
    "CodeRAG retrieval context",
    `Question: ${result.question}`,
    `Answer mode: ${result.answerMode}`,
    result.answer ? `Answer: ${result.answer}` : "",
    result.context.graphSummary ? `Graph summary: ${result.context.graphSummary}` : ""
  ].filter(Boolean);

  if (result.context.warnings.length) {
    sections.push(`Warnings: ${result.context.warnings.join(" | ")}`);
  }

  if (result.context.primaryNode) {
    sections.push(formatRetrievedNode(result.context.primaryNode, "Primary node"));
  }

  result.context.relatedNodes
    .slice(0, MAX_RELATED_CONTEXT_NODES)
    .forEach((node, index) => {
      sections.push(formatRetrievedNode(node, `Related node ${index + 1}`));
    });

  return sections.join("\n\n");
};

export const formatAgentRetrievalNote = (context: AgentRetrievalContext) => {
  if (context.used && context.result) {
    const primaryNode = context.result.context.primaryNode?.name ?? "no primary node";
    return `CodeRAG context attached from "${context.query}" (${primaryNode}, ${context.result.context.relatedNodes.length} related node${context.result.context.relatedNodes.length === 1 ? "" : "s"}).`;
  }

  if (context.explicit && context.warning) {
    return `CodeRAG context unavailable: ${context.warning}`;
  }

  return null;
};

export async function resolveAgentRetrievalContext({
  node,
  relatedNodes,
  instruction,
  retrievalQuery,
  retrievalDepth,
  allowAutoQuery = true
}: ResolveAgentRetrievalArgs): Promise<AgentRetrievalContext> {
  const depth = clampDepth(retrievalDepth);
  const explicitQuery = retrievalQuery?.trim() ?? "";
  const query =
    explicitQuery ||
    (allowAutoQuery ? buildAgentRetrievalQuery({ node, relatedNodes, instruction }) : "");

  if (!query) {
    return {
      attempted: false,
      explicit: false,
      used: false,
      query: null,
      depth,
      result: null,
      warning: null
    };
  }

  const codeRag = getCodeRag();
  if (!codeRag) {
    return {
      attempted: true,
      explicit: Boolean(explicitQuery),
      used: false,
      query,
      depth,
      result: null,
      warning: "CodeRAG is not initialized for this workspace yet."
    };
  }

  try {
    const result = await codeRag.query(query, { depth });

    return {
      attempted: true,
      explicit: Boolean(explicitQuery),
      used: true,
      query,
      depth,
      result,
      warning: result.context.warnings.length ? result.context.warnings.join(" | ") : null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "CodeRAG query failed.";
    console.warn("[CodeFlow] CodeRAG agent retrieval failed", {
      nodeId: node.id,
      query,
      depth,
      error: message
    });

    return {
      attempted: true,
      explicit: Boolean(explicitQuery),
      used: false,
      query,
      depth,
      result: null,
      warning: message
    };
  }
}
