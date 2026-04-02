import { emptyContract } from "../schema/index.js";
import { createNode, createNodeId, dedupeEdges, mergeContracts, mergeSourceRefs } from "./utils.js";
const HEADING_PATTERN = /^#{1,6}\s+(.+)$/;
const BULLET_PATTERN = /^[-*+]\s+(.*)$/;
const WORKFLOW_PATTERN = /(.+?)\s*->\s*(.+)/;
const API_PATTERN = /^(GET|POST|PUT|PATCH|DELETE)\s+([^\s]+)/i;
const SIGNATURE_PATTERN = /^(?<name>[A-Za-z_$][\w$]*)\s*\((?<params>[^)]*)\)\s*(?::\s*(?<returnType>.+))?$/;
const TAGGED_ITEM_PATTERN = /^(screen|page|ui|api|endpoint|module|service|class|function|method)\s*:\s*(.+)$/i;
const titleToKind = (title) => {
    const lower = title.toLowerCase();
    if (/(screen|page|ui|frontend)/.test(lower)) {
        return "ui-screen";
    }
    if (/(api|endpoint|route|backend)/.test(lower)) {
        return "api";
    }
    if (/(class|service|controller|manager)/.test(lower)) {
        return "class";
    }
    if (/(function|method)/.test(lower)) {
        return "function";
    }
    if (/(module|component|domain)/.test(lower)) {
        return "module";
    }
    return null;
};
const normalizeLine = (line) => line
    .trim()
    .replace(/^\d+\.\s+/, "")
    .replace(BULLET_PATTERN, "$1")
    .trim();
const parseSections = (prdText) => {
    const lines = prdText.split(/\r?\n/);
    const sections = [];
    let current = { title: "Overview", lines: [] };
    for (const rawLine of lines) {
        const headingMatch = rawLine.match(HEADING_PATTERN);
        if (headingMatch) {
            if (current.lines.length > 0 || sections.length === 0) {
                sections.push(current);
            }
            current = { title: headingMatch[1].trim(), lines: [] };
            continue;
        }
        const normalized = normalizeLine(rawLine);
        if (normalized) {
            current.lines.push(normalized);
        }
    }
    if (current.lines.length > 0 || sections.length === 0) {
        sections.push(current);
    }
    return sections;
};
const inferKindFromTaggedItem = (item) => {
    const match = item.match(TAGGED_ITEM_PATTERN);
    if (!match) {
        return null;
    }
    return titleToKind(match[1]);
};
const extractName = (item, fallbackKind) => {
    const tagMatch = item.match(TAGGED_ITEM_PATTERN);
    if (tagMatch) {
        return tagMatch[2].trim();
    }
    const apiMatch = item.match(API_PATTERN);
    if (apiMatch) {
        return `${apiMatch[1].toUpperCase()} ${apiMatch[2]}`;
    }
    if (fallbackKind === "ui-screen" && !/screen$/i.test(item)) {
        return item.endsWith("Screen") ? item : `${item} Screen`;
    }
    return item;
};
const parseContractFromItem = (item) => {
    const contract = emptyContract();
    const signatureMatch = item.match(SIGNATURE_PATTERN);
    contract.summary = item;
    contract.responsibilities = [item];
    if (signatureMatch?.groups) {
        const params = signatureMatch.groups.params
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
        contract.inputs = params.map((param) => {
            const [name, type] = param.split(":").map((value) => value.trim());
            return {
                name,
                type: type || "unknown"
            };
        });
        contract.outputs = [
            {
                name: "result",
                type: signatureMatch.groups.returnType?.trim() || "unknown"
            }
        ];
        contract.methods = [
            {
                name: signatureMatch.groups.name.trim(),
                signature: item,
                summary: item,
                inputs: contract.inputs,
                outputs: contract.outputs,
                sideEffects: [],
                calls: []
            }
        ];
    }
    else {
        const apiMatch = item.match(API_PATTERN);
        if (apiMatch) {
            contract.inputs = [
                {
                    name: "request",
                    type: "Request"
                }
            ];
            contract.outputs = [
                {
                    name: "response",
                    type: "Response"
                }
            ];
            contract.summary = `Handle ${apiMatch[1].toUpperCase()} ${apiMatch[2]}`;
            contract.responsibilities = [contract.summary];
        }
    }
    return contract;
};
export const parsePrd = (prdText) => {
    const sections = parseSections(prdText);
    const warnings = [];
    const nodesById = new Map();
    const edges = [];
    const workflows = [];
    const upsertNode = (kind, name, section, summary) => {
        const id = createNodeId(kind, name);
        const existing = nodesById.get(id);
        const node = createNode({
            id,
            kind,
            name,
            summary,
            contract: mergeContracts(parseContractFromItem(name), {
                ...emptyContract(),
                summary,
                responsibilities: [summary]
            }),
            sourceRefs: [
                {
                    kind: "prd",
                    section,
                    detail: summary
                }
            ]
        });
        if (existing) {
            nodesById.set(id, {
                ...existing,
                summary: existing.summary || summary,
                contract: mergeContracts(existing.contract, node.contract),
                sourceRefs: mergeSourceRefs(existing.sourceRefs, node.sourceRefs)
            });
            return id;
        }
        nodesById.set(id, node);
        return id;
    };
    for (const section of sections) {
        const sectionKind = titleToKind(section.title);
        for (const item of section.lines) {
            const workflowMatch = item.match(WORKFLOW_PATTERN);
            if (workflowMatch && item.includes("->")) {
                const steps = item
                    .split("->")
                    .map((value) => value.trim())
                    .filter(Boolean);
                if (steps.length >= 2) {
                    workflows.push({
                        name: `${section.title}: ${steps.join(" -> ")}`,
                        steps
                    });
                    for (let index = 0; index < steps.length - 1; index += 1) {
                        const fromName = steps[index];
                        const toName = steps[index + 1];
                        const fromId = [...nodesById.values()].find((node) => node.name === fromName)?.id ??
                            upsertNode("module", fromName, section.title, fromName);
                        const toId = [...nodesById.values()].find((node) => node.name === toName)?.id ??
                            upsertNode("module", toName, section.title, toName);
                        edges.push({
                            from: fromId,
                            to: toId,
                            kind: "calls",
                            label: section.title,
                            required: true,
                            confidence: 0.7
                        });
                    }
                }
                continue;
            }
            const inferredKind = inferKindFromTaggedItem(item) ?? sectionKind;
            if (!inferredKind) {
                warnings.push(`Skipped ambiguous PRD item "${item}" in section "${section.title}".`);
                continue;
            }
            const name = extractName(item, inferredKind);
            upsertNode(inferredKind, name, section.title, item);
        }
    }
    return {
        nodes: [...nodesById.values()],
        edges: dedupeEdges(edges),
        workflows,
        warnings
    };
};
