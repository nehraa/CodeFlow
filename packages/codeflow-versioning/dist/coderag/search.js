import { getCodeRagInstance } from "./index.js";
/**
 * Natural language search across branches using CodeRAG.
 */
export const searchBranches = async ({ projectName, query, limit = 5 }) => {
    const codeRag = getCodeRagInstance();
    if (!codeRag) {
        return [];
    }
    try {
        const result = await codeRag.query(`Search branches for project ${projectName}: ${query}`, { depth: 2 });
        if (!result.answer) {
            return [];
        }
        // Parse the answer to extract branch information
        // The format would depend on how CodeRAG returns results
        const lines = result.answer.split("\n").filter(Boolean);
        const results = [];
        for (const line of lines.slice(0, limit)) {
            // Try to extract branch name and score from the line
            const match = line.match(/^(?:[-*]?\s*)?([^:]+):?\s*([\d.]+)?/);
            if (match) {
                results.push({
                    branchId: match[1]?.trim() ?? "",
                    branchName: match[1]?.trim() ?? "",
                    score: parseFloat(match[2] ?? "0")
                });
            }
        }
        return results;
    }
    catch {
        return [];
    }
};
/**
 * Format a structural diff as human-readable text.
 */
export const formatStructuralDiff = (diff, focusOn = "all") => {
    const lines = [];
    lines.push(`## Branch Diff: ${diff.baseId} → ${diff.compareId}`);
    lines.push("");
    // Summary
    lines.push("### Summary");
    lines.push(`- Added: ${diff.addedNodes} node(s), ${diff.addedEdges} edge(s)`);
    lines.push(`- Removed: ${diff.removedNodes} node(s), ${diff.removedEdges} edge(s)`);
    lines.push(`- Modified: ${diff.modifiedNodes} node(s)`);
    lines.push("");
    // Nodes section
    if (focusOn === "nodes" || focusOn === "all") {
        lines.push("### Nodes");
        lines.push("");
        for (const nodeDiff of diff.nodeDiffs) {
            const kindLabel = nodeDiff.kind.toUpperCase();
            const impactLabel = nodeDiff.impactedEdgeCount > 0
                ? ` [${nodeDiff.impactedEdgeCount} impacted edge(s)]`
                : "";
            lines.push(`**${nodeDiff.name}** (${kindLabel})${impactLabel}`);
            if (nodeDiff.kind === "modified" && nodeDiff.before && nodeDiff.after) {
                lines.push("  Before: " + JSON.stringify(nodeDiff.before.summary ?? nodeDiff.name));
                lines.push("  After: " + JSON.stringify(nodeDiff.after.summary ?? nodeDiff.name));
            }
            lines.push("");
        }
    }
    // Edges section
    if (focusOn === "edges" || focusOn === "all") {
        lines.push("### Edges");
        lines.push("");
        const addedEdges = diff.edgeDiffs.filter((e) => e.diffKind === "added");
        const removedEdges = diff.edgeDiffs.filter((e) => e.diffKind === "removed");
        const unchangedEdges = diff.edgeDiffs.filter((e) => e.diffKind === "unchanged");
        if (removedEdges.length) {
            lines.push("Removed:");
            for (const edge of removedEdges) {
                lines.push(`  - ${edge.from} → ${edge.to} (${edge.edgeKind})`);
            }
            lines.push("");
        }
        if (addedEdges.length) {
            lines.push("Added:");
            for (const edge of addedEdges) {
                lines.push(`  + ${edge.from} → ${edge.to} (${edge.edgeKind})`);
            }
            lines.push("");
        }
        if (focusOn === "edges") {
            lines.push(`Unchanged: ${unchangedEdges.length} edge(s)`);
            lines.push("");
        }
    }
    // Impacted nodes
    if (diff.impactedNodeIds.length > 0) {
        lines.push("### Impacted Nodes");
        lines.push(`Total: ${diff.impactedNodeIds.length} node(s) affected by this diff`);
        lines.push("");
    }
    return lines.join("\n");
};
/**
 * Explain the differences between two branches using CodeRAG for natural language interpretation.
 */
export const explainBranchDiff = async ({ baseBranch, compareBranch, focusOn = "all" }) => {
    const codeRag = getCodeRagInstance();
    // Build a structured diff first
    const { diffBranches } = await import("../branch/index.js");
    const diff = diffBranches(baseBranch.graph, compareBranch.graph, baseBranch.id, compareBranch.id);
    // Format the diff as structured text
    const structuredDiff = formatStructuralDiff(diff, focusOn);
    // If CodeRAG is available, enhance with natural language
    if (codeRag) {
        try {
            const enhancementQuery = `Explain the following branch diff in natural language:
Base branch: ${baseBranch.name} (${baseBranch.id})
Compare branch: ${compareBranch.name} (${compareBranch.id})
Focus: ${focusOn}

${structuredDiff}`;
            const result = await codeRag.query(enhancementQuery, { depth: 2 });
            if (result.answer) {
                return result.answer;
            }
        }
        catch {
            // Fall back to structured diff if CodeRAG query fails
        }
    }
    return structuredDiff;
};
