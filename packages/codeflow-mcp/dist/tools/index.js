// Versioning tools exported by codeflow-versioning for registration.
// These are defined in codeflow-versioning/src/tools.ts and built to dist/tools.js
export const VERSIONING_TOOL_DEFINITIONS = [
    { name: "versioning_branch_list", description: "List all branches for a project." },
    { name: "versioning_branch_create", description: "Create a new named branch snapshot." },
    { name: "versioning_branch_get", description: "Get a single branch by its ID." },
    { name: "versioning_branch_delete", description: "Delete a branch by its ID." },
    { name: "versioning_diff", description: "Compute the structural diff between two blueprint graphs." },
    { name: "versioning_reasoning_snapshot", description: "Snapshot reasoning checkpoints for a run." },
    { name: "versioning_branch_search", description: "Search branches using natural language." },
    { name: "versioning_explain_diff", description: "Explain a branch diff in natural language using CodeRAG." },
];
export const TOOLS = [
    {
        name: "test_tool",
        description: "Prints a paw and 'CF' in ASCII art. Use to verify the MCP server is working.",
        inputSchema: { type: "object", properties: {}, required: [] },
    },
];
//# sourceMappingURL=index.js.map