/**
 * Tool definitions for the codeflow-versioning MCP tools.
 * These tools provide version control operations for blueprint graphs.
 */
export const VERSIONING_TOOLS = [
    {
        name: "versioning_branch_list",
        description: "List all branches for a project. Returns an array of branch objects with id, name, description, and createdAt.",
        inputSchema: {
            type: "object",
            properties: {
                projectName: {
                    type: "string",
                    description: "The name of the project whose branches to list."
                }
            },
            required: ["projectName"]
        }
    },
    {
        name: "versioning_branch_create",
        description: "Create a new named branch snapshot from a blueprint graph. The graph is normalized through validation.",
        inputSchema: {
            type: "object",
            properties: {
                graph: {
                    type: "object",
                    description: "The blueprint graph to snapshot."
                },
                name: {
                    type: "string",
                    description: "Name for the new branch."
                },
                description: {
                    type: "string",
                    description: "Optional description of the branch."
                },
                parentBranchId: {
                    type: "string",
                    description: "Optional parent branch ID to create a child branch."
                },
                runId: {
                    type: "string",
                    description: "Optional run ID to attach reasoning checkpoints."
                }
            },
            required: ["graph", "name"]
        }
    },
    {
        name: "versioning_branch_get",
        description: "Get a single branch by its ID.",
        inputSchema: {
            type: "object",
            properties: {
                projectName: {
                    type: "string",
                    description: "The project name."
                },
                branchId: {
                    type: "string",
                    description: "The branch ID to retrieve."
                }
            },
            required: ["projectName", "branchId"]
        }
    },
    {
        name: "versioning_branch_delete",
        description: "Delete a branch by its ID.",
        inputSchema: {
            type: "object",
            properties: {
                projectName: {
                    type: "string",
                    description: "The project name."
                },
                branchId: {
                    type: "string",
                    description: "The branch ID to delete."
                }
            },
            required: ["projectName", "branchId"]
        }
    },
    {
        name: "versioning_diff",
        description: "Compute the structural diff between two blueprint graphs. Returns added, removed, modified nodes and edges.",
        inputSchema: {
            type: "object",
            properties: {
                baseGraph: {
                    type: "object",
                    description: "The base (before) blueprint graph."
                },
                compareGraph: {
                    type: "object",
                    description: "The compare (after) blueprint graph."
                },
                baseId: {
                    type: "string",
                    description: "Optional identifier for the base graph in the diff output."
                },
                compareId: {
                    type: "string",
                    description: "Optional identifier for the compare graph in the diff output."
                }
            },
            required: ["baseGraph", "compareGraph"]
        }
    },
    {
        name: "versioning_reasoning_snapshot",
        description: "Snapshot reasoning checkpoints for a run. Returns branch reasoning snapshot with checkpoints.",
        inputSchema: {
            type: "object",
            properties: {
                runId: {
                    type: "string",
                    description: "The run ID to snapshot."
                },
                projectName: {
                    type: "string",
                    description: "The project name."
                }
            },
            required: ["runId", "projectName"]
        }
    },
    {
        name: "versioning_branch_search",
        description: "Search branches using natural language. Returns matching branches with relevance scores.",
        inputSchema: {
            type: "object",
            properties: {
                projectName: {
                    type: "string",
                    description: "The project name."
                },
                query: {
                    type: "string",
                    description: "Natural language search query."
                },
                limit: {
                    type: "number",
                    description: "Maximum number of results to return."
                }
            },
            required: ["projectName", "query"]
        }
    },
    {
        name: "versioning_explain_diff",
        description: "Explain a branch diff in natural language using CodeRAG. Returns human-readable explanation of changes.",
        inputSchema: {
            type: "object",
            properties: {
                projectName: {
                    type: "string",
                    description: "The project name."
                },
                diff: {
                    type: "object",
                    description: "The branch diff to explain."
                },
                context: {
                    type: "string",
                    description: "Optional additional context for the explanation."
                }
            },
            required: ["projectName", "diff"]
        }
    },
    {
        name: "versioning_observability_explain",
        description: "Explain the execution observability attached to a branch.",
        inputSchema: {
            type: "object",
            properties: {
                projectName: {
                    type: "string",
                    description: "The project name."
                },
                branchId: {
                    type: "string",
                    description: "The branch ID to retrieve observability for."
                },
                focusOn: {
                    type: "string",
                    enum: ["spans", "logs", "errors"],
                    description: "What aspect of observability to focus on."
                }
            },
            required: ["projectName", "branchId"]
        }
    },
    {
        name: "versioning_risk_search",
        description: "Search branches by risk profile using natural language.",
        inputSchema: {
            type: "object",
            properties: {
                projectName: {
                    type: "string",
                    description: "The project name."
                },
                query: {
                    type: "string",
                    description: "Natural language search query for risk profile."
                },
                minScore: {
                    type: "number",
                    description: "Minimum risk score filter."
                },
                limit: {
                    type: "number",
                    description: "Maximum number of results to return."
                }
            },
            required: ["projectName", "query"]
        }
    },
    {
        name: "versioning_risk_explain",
        description: "Explain the risk report for a specific branch.",
        inputSchema: {
            type: "object",
            properties: {
                projectName: {
                    type: "string",
                    description: "The project name."
                },
                branchId: {
                    type: "string",
                    description: "The branch ID to explain risk for."
                }
            },
            required: ["projectName", "branchId"]
        }
    },
    {
        name: "versioning_create_with_full_context",
        description: "Create a branch with all available context snapshots attached.",
        inputSchema: {
            type: "object",
            properties: {
                projectName: {
                    type: "string",
                    description: "The project name."
                },
                graph: {
                    type: "object",
                    description: "The blueprint graph to snapshot."
                },
                name: {
                    type: "string",
                    description: "Name for the new branch."
                },
                description: {
                    type: "string",
                    description: "Optional description of the branch."
                },
                parentBranchId: {
                    type: "string",
                    description: "Optional parent branch ID to create a child branch."
                },
                runId: {
                    type: "string",
                    description: "Optional run ID to attach reasoning checkpoints."
                },
                attachObservability: {
                    type: "boolean",
                    description: "Attach execution observability snapshot."
                },
                attachRisk: {
                    type: "boolean",
                    description: "Compute and attach risk report."
                },
                attachSession: {
                    type: "boolean",
                    description: "Attach latest session snapshot."
                },
                runPlan: {
                    type: "object",
                    description: "Run plan required for risk assessment."
                },
                outputDir: {
                    type: "string",
                    description: "Optional output directory for risk assessment."
                }
            },
            required: ["projectName", "graph", "name"]
        }
    }
];
