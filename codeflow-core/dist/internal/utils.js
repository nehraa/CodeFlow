import path from "node:path";
import { emptyContract } from "../schema/index.js";
export const slugify = (value) => value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "node";
export const toPosixPath = (value) => value.split(path.sep).join("/");
export const createNodeId = (kind, name, pathHint) => `${kind}:${slugify(pathHint ?? name)}`;
export const mergeStringLists = (...collections) => [...new Set(collections.flat().filter(Boolean))];
export const mergeFields = (...collections) => {
    const map = new Map();
    for (const field of collections.flat()) {
        const key = `${field.name}:${field.type}:${field.description ?? ""}`;
        if (!map.has(key)) {
            map.set(key, field);
        }
    }
    return [...map.values()];
};
export const mergeSourceRefs = (...collections) => {
    const map = new Map();
    for (const ref of collections.flat()) {
        const key = `${ref.kind}:${ref.path ?? ""}:${ref.symbol ?? ""}:${ref.section ?? ""}:${ref.detail ?? ""}`;
        if (!map.has(key)) {
            map.set(key, ref);
        }
    }
    return [...map.values()];
};
export const mergeDesignCalls = (...collections) => {
    const map = new Map();
    for (const call of collections.flat()) {
        const key = `${call.target}:${call.kind ?? ""}:${call.description ?? ""}`;
        if (!map.has(key)) {
            map.set(key, call);
        }
    }
    return [...map.values()];
};
export const mergeMethodSpecs = (...collections) => {
    const map = new Map();
    for (const method of collections.flat()) {
        const key = `${method.name}:${method.signature ?? ""}`;
        const existing = map.get(key);
        if (!existing) {
            map.set(key, method);
            continue;
        }
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
export const mergeContracts = (...contracts) => ({
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
export const createNode = (input) => ({
    ...input,
    generatedRefs: input.generatedRefs ?? [],
    traceRefs: input.traceRefs ?? [],
    traceState: input.traceState,
    status: input.status ?? "spec_only",
    specDraft: input.specDraft,
    implementationDraft: input.implementationDraft,
    lastVerification: input.lastVerification
});
export const createContract = (partial) => mergeContracts(emptyContract(), partial);
export const dedupeEdges = (edges) => {
    const map = new Map();
    for (const edge of edges) {
        const key = `${edge.kind}:${edge.from}:${edge.to}:${edge.label ?? ""}`;
        const existing = map.get(key);
        if (!existing) {
            map.set(key, edge);
            continue;
        }
        map.set(key, {
            ...existing,
            required: existing.required || edge.required,
            confidence: Math.max(existing.confidence, edge.confidence)
        });
    }
    return [...map.values()];
};
