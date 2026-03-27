import type { McpTool, McpToolResult } from "@/lib/blueprint/schema";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

interface ToolsListResult {
  tools: McpTool[];
}

const sendJsonRpc = async <T>(
  serverUrl: string,
  method: string,
  params: Record<string, unknown>,
  id: number,
  headers?: Record<string, string>,
  timeoutMs: number = 10_000
): Promise<T> => {
  const request: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(serverUrl, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(request),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`MCP server responded with ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as JsonRpcResponse<T>;

    if (json.error) {
      throw new Error(`MCP error ${json.error.code}: ${json.error.message}`);
    }

    if (json.result === undefined) {
      throw new Error("MCP server returned an empty result");
    }

    return json.result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`MCP request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Discover the tools exposed by an MCP server via the `tools/list` JSON-RPC method.
 */
export const listMcpTools = async (
  serverUrl: string,
  headers?: Record<string, string>
): Promise<McpTool[]> => {
  const result = await sendJsonRpc<ToolsListResult>(serverUrl, "tools/list", {}, 1, headers);
  return result.tools ?? [];
};

/**
 * Invoke a named tool on an MCP server via the `tools/call` JSON-RPC method.
 */
export const invokeMcpTool = async (
  serverUrl: string,
  toolName: string,
  args: Record<string, unknown>,
  headers?: Record<string, string>
): Promise<McpToolResult> => {
  const result = await sendJsonRpc<McpToolResult>(
    serverUrl,
    "tools/call",
    { name: toolName, arguments: args },
    2,
    headers
  );
  return result;
};

/**
 * Extract a plain-text summary from an MCP tool result's content array.
 */
export const extractTextFromMcpResult = (result: McpToolResult): string =>
  result.content
    .filter((item) => item.type === "text" && item.text)
    .map((item) => item.text as string)
    .join("\n");
