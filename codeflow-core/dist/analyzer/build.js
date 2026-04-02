import path from "node:path";
import { emptyContract } from "../schema/index.js";
import { parsePrd } from "../internal/prd.js";
import { withSpecDrafts } from "../internal/phases.js";
import { analyzeTypeScriptRepo } from "./repo.js";
import { createNode, dedupeEdges, mergeContracts, mergeSourceRefs } from "../internal/utils.js";
const mergeNodes = (nodes) => {
    const map = new Map();
    for (const node of nodes) {
        const dedupeKey = `${node.kind}:${node.path ?? ""}:${node.name}`;
        const existing = map.get(dedupeKey);
        if (!existing) {
            map.set(dedupeKey, node);
            continue;
        }
        map.set(dedupeKey, {
            ...existing,
            summary: existing.summary || node.summary,
            path: existing.path ?? node.path,
            signature: existing.signature ?? node.signature,
            ownerId: existing.ownerId ?? node.ownerId,
            contract: mergeContracts(existing.contract, node.contract),
            sourceRefs: mergeSourceRefs(existing.sourceRefs, node.sourceRefs),
            generatedRefs: [...new Set([...existing.generatedRefs, ...node.generatedRefs])],
            traceRefs: [...new Set([...existing.traceRefs, ...node.traceRefs])]
        });
    }
    return [...map.values()];
};
const createImplicitWorkflowEdges = (nodes, workflows) => {
    const edges = workflows.flatMap((workflow) => workflow.steps.flatMap((step, index) => {
        const current = nodes.find((node) => node.name === step);
        const next = nodes.find((node) => node.name === workflow.steps[index + 1]);
        if (!current || !next) {
            return [];
        }
        return [
            {
                from: current.id,
                to: next.id,
                kind: "calls",
                label: workflow.name,
                required: true,
                confidence: 0.6
            }
        ];
    }));
    return dedupeEdges(edges);
};
const emptyGraphPart = () => ({
    nodes: [],
    edges: [],
    workflows: [],
    warnings: []
});
export const buildBlueprintGraph = async (request) => {
    const graphParts = [];
    if (request.prdText?.trim()) {
        graphParts.push(parsePrd(request.prdText));
    }
    if (request.repoPath?.trim()) {
        graphParts.push(await analyzeTypeScriptRepo(path.resolve(request.repoPath)));
    }
    const combined = graphParts.reduce((accumulator, part) => ({
        nodes: [...accumulator.nodes, ...part.nodes],
        edges: [...accumulator.edges, ...part.edges],
        workflows: [...accumulator.workflows, ...part.workflows],
        warnings: [...accumulator.warnings, ...part.warnings]
    }), emptyGraphPart());
    const nodes = mergeNodes(combined.nodes.map((node) => createNode({
        ...node,
        contract: mergeContracts(emptyContract(), node.contract)
    })));
    const workflowEdges = createImplicitWorkflowEdges(nodes, combined.workflows);
    const graph = {
        projectName: request.projectName,
        mode: request.mode,
        phase: "spec",
        generatedAt: new Date().toISOString(),
        nodes,
        edges: dedupeEdges([...combined.edges, ...workflowEdges]).filter((edge) => nodes.some((node) => node.id === edge.from) &&
            nodes.some((node) => node.id === edge.to)),
        workflows: combined.workflows,
        warnings: combined.warnings
    };
    if (graph.nodes.length === 0) {
        graph.warnings.push("No blueprint nodes were produced. Provide PRD content and/or a TypeScript repo.");
    }
    return withSpecDrafts(graph);
};
