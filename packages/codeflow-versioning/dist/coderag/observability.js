import { getCodeRagInstance } from "./index.js";
import { formatAgentRetrievalPrompt } from "./agent.js";
/**
 * Format an observability snapshot as a searchable text document for CodeRAG.
 * Indexed by branch so CodeRAG can find execution traces.
 */
export const formatObservabilityForIndex = (branch, snapshot) => {
    const lines = [
        `Observability for branch "${branch.name}" (${branch.id}):`,
        `Project: ${branch.projectName}`,
        `Created: ${branch.createdAt}`,
        `Span count: ${snapshot.spans.length}`,
        `Log count: ${snapshot.logs.length}`,
        ""
    ];
    if (snapshot.spans.length > 0) {
        lines.push("Execution spans:");
        for (const span of snapshot.spans) {
            lines.push(`  - ${span.name}: ${span.status} (${span.durationMs ?? "?"}ms)`);
        }
    }
    if (snapshot.logs.length > 0) {
        lines.push("\nLogs:");
        for (const log of snapshot.logs.slice(0, 20)) {
            lines.push(`  [${log.level}] ${log.message}`);
        }
    }
    return lines.join("\n");
};
/**
 * Search observability data across branches.
 * Uses CodeRAG if available, otherwise returns empty array.
 */
export const searchObservability = async ({ projectName, query, limit = 5 }) => {
    const codeRag = getCodeRagInstance();
    if (!codeRag) {
        return [];
    }
    try {
        const result = await codeRag.query(`Observability search for "${query}" in project ${projectName}`, { depth: 2 });
        return result.answer
            ? [{
                    branchId: "",
                    branchName: result.context.primaryNode?.name ?? "unknown",
                    matchedSpans: [],
                    matchedLogs: [],
                    explanation: result.answer
                }]
            : [];
    }
    catch {
        return [];
    }
};
/**
 * Explain observability data for a specific branch in natural language.
 */
export const explainBranchObservability = async (branch, focusOn = "spans") => {
    const codeRag = getCodeRagInstance();
    const snapshot = branch.metadata?.observability;
    if (!snapshot) {
        return `Branch "${branch.name}" has no observability snapshot attached.`;
    }
    const context = formatObservabilityForIndex(branch, snapshot);
    if (!codeRag) {
        return context;
    }
    try {
        const result = await codeRag.query(`Explain the observability for branch "${branch.name}":\n${context}`, { depth: 2 });
        return formatAgentRetrievalPrompt(result);
    }
    catch {
        return context;
    }
};
