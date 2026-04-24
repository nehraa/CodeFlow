import type { BlueprintEdge, BlueprintGraph, BlueprintNode, BlueprintNodeKind, CodeContract, ContractField, DesignCall, MethodSpec, SourceRef } from "@abhinav2203/codeflow-core/schema";
import { emptyContract } from "@abhinav2203/codeflow-core/schema";

// ── Inline utilities (copied from @abhinav2203/codeflow-core/internal/utils) ──

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "node";

export const createNodeId = (kind: BlueprintNodeKind, name: string, _pathHint?: string): string =>
  `${kind}:${slugify(name)}`;

export const mergeStringLists = (...collections: string[][]): string[] =>
  [...new Set(collections.flat().filter(Boolean))];

export const mergeFields = (...collections: ContractField[][]): ContractField[] => {
  const map = new Map<string, ContractField>();
  for (const field of collections.flat()) {
    const key = `${field.name}:${field.type}:${field.description ?? ""}`;
    if (!map.has(key)) map.set(key, field);
  }
  return [...map.values()];
};

export const mergeSourceRefs = (...collections: SourceRef[][]): SourceRef[] => {
  const map = new Map<string, SourceRef>();
  for (const ref of collections.flat()) {
    const key = `${ref.kind}:${ref.path ?? ""}:${ref.symbol ?? ""}:${ref.section ?? ""}:${ref.detail ?? ""}`;
    if (!map.has(key)) map.set(key, ref);
  }
  return [...map.values()];
};

export const mergeDesignCalls = (...collections: DesignCall[][]): DesignCall[] => {
  const map = new Map<string, DesignCall>();
  for (const call of collections.flat()) {
    const key = `${call.target}:${call.kind ?? ""}:${call.description ?? ""}`;
    if (!map.has(key)) map.set(key, call);
  }
  return [...map.values()];
};

export const mergeMethodSpecs = (...collections: MethodSpec[][]): MethodSpec[] => {
  const map = new Map<string, MethodSpec>();
  for (const method of collections.flat()) {
    const key = `${method.name}:${method.signature ?? ""}`;
    const existing = map.get(key);
    if (!existing) { map.set(key, method); continue; }
    map.set(key, {
      ...existing,
      summary: existing.summary || method.summary,
      inputs: mergeFields(existing.inputs, method.inputs),
      outputs: mergeFields(existing.outputs, method.outputs),
      sideEffects: mergeStringLists(existing.sideEffects, method.sideEffects),
      calls: mergeDesignCalls(existing.calls, method.calls)
    });
  }
  return [...map.values()];
};

export const mergeContracts = (...contracts: CodeContract[]): CodeContract => ({
  summary: contracts.map((item) => item.summary).find(Boolean) ?? "",
  responsibilities: mergeStringLists(...contracts.map((item) => item.responsibilities)),
  inputs: mergeFields(...contracts.map((item) => item.inputs)),
  outputs: mergeFields(...contracts.map((item) => item.outputs)),
  attributes: mergeFields(...contracts.map((item) => item.attributes)),
  methods: mergeMethodSpecs(...contracts.map((item) => item.methods)),
  sideEffects: mergeStringLists(...contracts.map((item) => item.sideEffects)),
  errors: mergeStringLists(...contracts.map((item) => item.errors)),
  dependencies: mergeStringLists(...contracts.map((item) => item.dependencies)),
  calls: mergeDesignCalls(...contracts.map((item) => item.calls)),
  uiAccess: mergeStringLists(...contracts.map((item) => item.uiAccess)),
  backendAccess: mergeStringLists(...contracts.map((item) => item.backendAccess)),
  notes: mergeStringLists(...contracts.map((item) => item.notes))
});

export const createNode = (
  input: Omit<BlueprintNode, "generatedRefs" | "traceRefs" | "traceState" | "status" | "specDraft" | "implementationDraft" | "lastVerification"> &
    Partial<Pick<BlueprintNode, "generatedRefs" | "traceRefs" | "traceState" | "status" | "specDraft" | "implementationDraft" | "lastVerification">>
): BlueprintNode => ({
  ...input,
  generatedRefs: input.generatedRefs ?? [],
  traceRefs: input.traceRefs ?? [],
  traceState: input.traceState,
  status: input.status ?? "spec_only",
  specDraft: input.specDraft,
  implementationDraft: input.implementationDraft,
  lastVerification: input.lastVerification
});

export const dedupeEdges = (edges: BlueprintEdge[]): BlueprintEdge[] => {
  const map = new Map<string, BlueprintEdge>();
  for (const edge of edges) {
    const key = `${edge.kind}:${edge.from}:${edge.to}:${edge.label ?? ""}`;
    const existing = map.get(key);
    if (!existing) { map.set(key, edge); continue; }
    map.set(key, {
      ...existing,
      required: existing.required || edge.required,
      confidence: Math.max(existing.confidence, edge.confidence)
    });
  }
  return [...map.values()];
};

// ── Inline spec draft logic (copied from @abhinav2203/codeflow-core/internal/phases) ──

const isCodeBearingNode = (node: BlueprintNode): boolean => node.kind !== "module";

const generateNodeCode = (_node: BlueprintNode, _graph: BlueprintGraph): string | null => {
  // Scaffold generation is not yet implemented in v0.1.0
  return null;
};

export const withSpecDrafts = (graph: BlueprintGraph): BlueprintGraph => ({
  ...graph,
  nodes: graph.nodes.map((node) =>
    isCodeBearingNode(node)
      ? { ...node, status: node.status ?? "spec_only", specDraft: node.specDraft ?? generateNodeCode(node, graph) ?? undefined }
      : { ...node, status: node.status ?? "spec_only" }
  )
});