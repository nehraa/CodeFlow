import { getCodeRagInstance } from "./index.js";
import { formatAgentRetrievalPrompt } from "./agent.js";
import { loadBranches } from "../store/index.js";
/**
 * Format a risk report as searchable text for CodeRAG.
 */
export const formatRiskReportForIndex = (branch) => {
    const risk = branch.metadata?.risk;
    if (!risk) {
        return `Branch "${branch.name}" has no risk report.`;
    }
    const lines = [
        `Risk report for branch "${branch.name}" (${branch.id}):`,
        `Score: ${risk.score} (${risk.level})`,
        `Requires approval: ${risk.requiresApproval}`,
        `Factors (${risk.factors.length}):`
    ];
    for (const factor of risk.factors) {
        lines.push(`  - [${factor.code}] score=${factor.score}: ${factor.message}`);
    }
    return lines.join("\n");
};
/**
 * Search branches by risk profile using CodeRAG.
 */
export const searchBranchesByRisk = async ({ projectName, query, minScore, limit = 5 }) => {
    const allBranches = await loadBranches(projectName);
    const codeRag = getCodeRagInstance();
    const scored = await Promise.all(allBranches.map(async (branch) => {
        const risk = branch.metadata?.risk;
        if (!risk)
            return null;
        if (minScore !== undefined && risk.score < minScore)
            return null;
        if (!codeRag) {
            return { branch, riskReport: risk, score: risk.score, explanation: formatRiskReportForIndex(branch) };
        }
        try {
            const result = await codeRag.query(`Risk profile for branch "${branch.name}": ${formatRiskReportForIndex(branch)}. Query: ${query}`, { depth: 1 });
            return {
                branch,
                riskReport: risk,
                score: risk.score,
                explanation: result.answer ?? formatRiskReportForIndex(branch)
            };
        }
        catch {
            return null;
        }
    }));
    return scored
        .filter((s) => s !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((s) => ({
        branch: s.branch,
        riskReport: s.riskReport,
        relevanceScore: s.score,
        explanation: s.explanation
    }));
};
/**
 * Explain the risk profile of a branch in natural language.
 */
export const explainBranchRisk = async (branch) => {
    const codeRag = getCodeRagInstance();
    const risk = branch.metadata?.risk;
    if (!risk) {
        return `Branch "${branch.name}" has no risk report attached.`;
    }
    const base = formatRiskReportForIndex(branch);
    if (!codeRag) {
        return base;
    }
    try {
        const result = await codeRag.query(`Explain the risk profile of branch "${branch.name}":\n${base}`, { depth: 2 });
        return formatAgentRetrievalPrompt(result);
    }
    catch {
        return base;
    }
};
