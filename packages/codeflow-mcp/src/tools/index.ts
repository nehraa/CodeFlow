import type { McpTool } from "@abhinav2203/codeflow-core/schema";

export const TOOLS: McpTool[] = [
  {
    name: "test_tool",
    description: "Prints a paw and 'CF' in ASCII art. Use to verify the MCP server is working.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];
