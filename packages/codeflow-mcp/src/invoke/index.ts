#!/usr/bin/env node

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string };
}

const PORT = parseInt(process.env["CF_MCP_PORT"] ?? "3100", 10);
const HOST = process.env["CF_MCP_HOST"] ?? "localhost";

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "test_tool",
    description: "Prints a paw and 'CF' in ASCII art. Use to verify the MCP server is working.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
] as const;

// ─── Tool handlers ─────────────────────────────────────────────────────────────

async function handleToolCall(toolName: string, _args: Record<string, unknown>) {
  if (toolName === "test_tool") {
    return {
      content: [
        {
          type: "text" as const,
          text: [
            "    ∧＿∧",
            "   (｡･ω･｡)",
            "   ／>  <＼",
            "  ／<  >  ＼",
            "  |  ∨  |  |",
            "",
            "   ┌──┐",
            "   │CF│",
            "   └──┘",
            "",
            "🐾 CodeFlow MCP server is alive!",
          ].join("\n"),
        },
      ],
    };
  }
  throw new Error(`Unknown tool: ${toolName}`);
}

// ─── JSON-RPC over HTTP+SSE ───────────────────────────────────────────────────

function jsonRpcError(id: unknown, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id as string | number | null, error: { code, message } };
}

function jsonRpcResult(id: unknown, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id as string | number | null, result };
}

async function handleRequest(req: JsonRpcRequest): Promise<JsonRpcResponse> {
  const { method, params, id } = req;

  if (method === "tools/list") {
    return jsonRpcResult(id, { tools: TOOLS });
  }

  if (method === "tools/call") {
    const name = (params as Record<string, unknown>)?.["name"] as string | undefined;
    const args = ((params as Record<string, unknown>)?.["arguments"] as Record<string, unknown>) ?? {};
    if (!name) {
      return jsonRpcError(id, -32602, "Missing tool name");
    }
    try {
      const result = await handleToolCall(name, args);
      return jsonRpcResult(id, result);
    } catch (err) {
      return jsonRpcError(
        id,
        -32603,
        err instanceof Error ? err.message : "Tool execution failed"
      );
    }
  }

  return jsonRpcError(id, -32601, `Method not found: ${method}`);
}

// ─── HTTP server ──────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, authorization, x-api-key",
    });
    res.end();
    return;
  }

  // Only accept POST
  if (req.method !== "POST") {
    res.writeHead(405);
    res.end();
    return;
  }

  let body = "";
  for await (const chunk of req) {
    body += chunk;
  }

  let request: JsonRpcRequest;
  try {
    request = JSON.parse(body);
  } catch {
    const err: JsonRpcResponse = { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } };
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(err));
    return;
  }

  const response = await handleRequest(request);
  res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(response));
});

server.listen(PORT, HOST, () => {
  console.log(`[codeflow-mcp] MCP server running at http://${HOST}:${PORT}`);
  console.log(`[codeflow-mcp] SSE endpoint: POST /`);
  console.log(`[codeflow-mcp] Tools: test_tool`);
});

export async function startServer(port = PORT, host = HOST) {
  return new Promise<void>((resolve) => {
    server.listen(port, host, resolve);
  });
}

export async function stopServer() {
  return new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}
