/**
 * codeflow-mcp MCP server
 *
 * Implements the MCP spec with three transports:
 * - stdio:  for Claude Code CLI, Cursor, local tools
 * - HTTP:   for web clients, Claude Desktop
 * - SSE:    for streaming responses (Claude Desktop, Cursor)
 *
 * The server is transport-agnostic — the same handler logic runs regardless
 * of how the client connects. Each transport implements the same JSON-RPC
 * protocol over its channel.
 */

import { createServer, type Server } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

// ─── Tool registry ────────────────────────────────────────────────────────────

interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface ToolResult {
  content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }>;
  isError?: boolean;
}

interface ToolHandler {
  (args: Record<string, unknown>): ToolResult | Promise<ToolResult>;
}

const TOOL_HANDLERS: Record<string, ToolHandler> = {
  async test_tool(_args) {
    return {
      content: [
        {
          type: "text",
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
  },
};

const TOOLS: Tool[] = [
  {
    name: "test_tool",
    description: "Prints a paw and 'CF' in ASCII art. Use to verify the MCP server is working.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

// ─── JSON-RPC types ───────────────────────────────────────────────────────────

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

function jsonRpcError(id: unknown, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id as string | number | null, error: { code, message } };
}

function jsonRpcResult(id: unknown, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id as string | number | null, result };
}

// ─── Request handler (transport-agnostic) ─────────────────────────────────────

async function handleJsonRpc(req: JsonRpcRequest): Promise<JsonRpcResponse> {
  const { method, params, id } = req;

  if (method === "tools/list") {
    return jsonRpcResult(id, { tools: TOOLS });
  }

  if (method === "initialize") {
    return jsonRpcResult(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "codeflow-mcp", version: "0.1.0" },
    });
  }

  if (method === "tools/call") {
    const name = (params as Record<string, unknown>)?.["name"] as string | undefined;
    const args = ((params as Record<string, unknown>)?.["arguments"] as Record<string, unknown>) ?? {};
    if (!name) return jsonRpcError(id, -32602, "Missing tool name");
    const handler = TOOL_HANDLERS[name];
    if (!handler) return jsonRpcError(id, -32602, `Unknown tool: ${name}`);
    try {
      const result = await handler(args);
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

// ─── stdio transport ─────────────────────────────────────────────────────────

/**
 * MCP over stdio — the standard MCP transport for local tools and AI IDEs.
 *
 * Protocol:
 *   - Client sends JSON-RPC messages (one per line, \n-delimited)
 *   - Server sends JSON-RPC responses (one per line, \n-delimited)
 *   - Connection stays open until client sends "terminate" or closes stdin
 *
 * This is how Claude Code CLI, Cursor, and Claude Desktop connect.
 */
export async function startStdioServer(): Promise<void> {
  let buffer = "";

  process.stdin.setEncoding("utf-8");

  process.stdin.on("data", async (chunk: string) => {
    buffer += chunk;

    // Process all complete JSON-RPC messages (newline-delimited)
    while (buffer.includes("\n")) {
      const newlineIndex = buffer.indexOf("\n");
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (!line) continue;

      try {
        const request = JSON.parse(line) as JsonRpcRequest;

        // Handle MCP spec messages
        if (request.method === "initialize") {
          const response = await handleJsonRpc(request);
          process.stdout.write(JSON.stringify(response) + "\n");
          // Send notification that we're ready
          process.stdout.write(JSON.stringify(jsonRpcResult(null, {})) + "\n");
          continue;
        }

        if (request.method === "notifications/initialized") {
          // Client is ready — no response needed
          continue;
        }

        if (request.method === "terminate" || (request as unknown as { method: string })?.method === "exit") {
          process.exit(0);
        }

        const response = await handleJsonRpc(request);
        process.stdout.write(JSON.stringify(response) + "\n");
      } catch {
        const err: JsonRpcResponse = {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        };
        process.stdout.write(JSON.stringify(err) + "\n");
      }
    }
  });

  process.stdin.on("end", () => {
    process.exit(0);
  });

  // Keep the process alive
  return new Promise(() => {});
}

// ─── HTTP transport ────────────────────────────────────────────────────────────

function buildCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, authorization, x-api-key, x-request-id",
  };
}

async function parseBody(req: IncomingMessage): Promise<string> {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
  }
  return body;
}

function sendJson(res: ServerResponse, data: JsonRpcResponse, cors = true) {
  res.writeHead(200, {
    "Content-Type": "application/json",
    ...(cors ? buildCorsHeaders() : {}),
  });
  res.end(JSON.stringify(data));
}

/**
 * Start HTTP server with both plain JSON-RPC and SSE streaming endpoints.
 *
 * Endpoints:
 *   POST / — JSON-RPC (request/response, compatible with all HTTP MCP clients)
 *   GET  /sse — SSE stream for streaming responses (Claude Desktop, Cursor)
 */
export function createHttpServer(port = 3100, host = "localhost"): Server {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, buildCorsHeaders());
      res.end();
      return;
    }

    // ── SSE endpoint ──────────────────────────────────────────────────────────
    if (url.pathname === "/sse" && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        ...buildCorsHeaders(),
      });

      // Send initial connection event
      res.write("event: connected\ndata: {}\n\n");

      // Keep-alive ping every 30s
      const pingInterval = setInterval(() => {
        res.write("event: ping\ndata: {}\n\n");
      }, 30_000);

      req.on("close", () => {
        clearInterval(pingInterval);
      });

      // For SSE, we don't process requests through this connection
      // The client reconnects to POST / for actual RPC calls
      return;
    }

    // ── JSON-RPC POST endpoint ───────────────────────────────────────────────
    if (req.method === "POST") {
      const body = await parseBody(req);

      let request: JsonRpcRequest;
      try {
        request = JSON.parse(body);
      } catch {
        sendJson(res, {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        });
        return;
      }

      const response = await handleJsonRpc(request);
      sendJson(res, response);
      return;
    }

    // ── GET / — MCP protocol handshake / tooling info ──────────────────────
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "application/json", ...buildCorsHeaders() });
      res.end(
        JSON.stringify({
          name: "codeflow-mcp",
          version: "0.1.0",
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          transports: ["stdio", "http", "sse"],
        })
      );
      return;
    }

    // 404
    res.writeHead(404);
    res.end();
  });

  server.listen(port, host, () => {
    console.log(`[codeflow-mcp] MCP server running`);
    console.log(`[codeflow-mcp]   HTTP:  http://${host}:${port}/`);
    console.log(`[codeflow-mcp]   SSE:   http://${host}:${port}/sse`);
    console.log(`[codeflow-mcp]   Tools: ${TOOLS.map((t) => t.name).join(", ")}`);
  });

  return server;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export { TOOLS, handleJsonRpc, jsonRpcError, jsonRpcResult };
export type { Tool, ToolResult, JsonRpcRequest, JsonRpcResponse };