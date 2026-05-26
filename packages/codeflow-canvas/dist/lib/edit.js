import { emptyContract } from "@abhinav2203/codeflow-core/schema";
// Utility functions inlined from @abhinav2203/codeflow-core
const createNodeId = (kind, name) => {
    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    return `${kind}:${slug}`;
};
const dedupeEdges = (edges) => {
    const seen = new Set();
    return edges.filter((edge) => {
        const key = `${edge.from}:${edge.to}:${edge.kind}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
};
// Draft management - inlined from phases
const withSpecDrafts = (graph) => graph;
export const addNodeToGraph = (graph, input) => {
    const node = {
        id: createNodeId(input.kind, input.name),
        kind: input.kind,
        name: input.name,
        summary: input.summary ?? `${input.kind} ${input.name}`,
        contract: {
            ...emptyContract(),
            summary: input.summary ?? `${input.kind} ${input.name}`
        },
        sourceRefs: [{ kind: "generated", detail: "Added in workbench" }],
        generatedRefs: [],
        traceRefs: []
    };
    return withSpecDrafts({
        ...graph,
        nodes: [...graph.nodes.filter((existing) => existing.id !== node.id), node]
    });
};
export const addEdgeToGraph = (graph, input) => ({
    ...graph,
    edges: dedupeEdges([
        ...graph.edges,
        {
            from: input.from,
            to: input.to,
            kind: input.kind,
            label: input.label,
            required: true,
            confidence: 1
        }
    ])
});
export const deleteNodeFromGraph = (graph, nodeId) => ({
    ...graph,
    nodes: graph.nodes.filter((node) => node.id !== nodeId),
    edges: graph.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId)
});
//# sourceMappingURL=edit.js.map