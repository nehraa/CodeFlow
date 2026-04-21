#!/usr/bin/env node

/**
 * codeflow-mcp CLI
 * Usage:
 *   codeflow-mcp server start [--port 3100] [--host localhost]
 *   codeflow-mcp tool list <serverUrl>
 *   codeflow-mcp tool invoke <name> <serverUrl> [args-json]
 */

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

const TOOLS = [
  {
    name: "test_tool",
    description: "Prints a paw and 'CF' in ASCII art. Use to verify the MCP server is working.",
    inputSchema: { type: "object", properties: {} },
  },
] as const;

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
    if (name === "test_tool") {
      return jsonRpcResult(id, {
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
      });
    }
    throw new Error(`Unknown tool: ${name}`);
  }

  return jsonRpcError(id, -32601, `Method not found: ${method}`);
}

function startHttpServer(port: number, host: string) {
  const server = createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, authorization, x-api-key",
      });
      res.end();
      return;
    }
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
      const err: JsonRpcResponse = {
        jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" },
      };
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(err));
      return;
    }

    const response = await handleRequest(request);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(response));
  });

  server.listen(port, host, () => {
    console.log(`[codeflow-mcp] MCP server running at http://${host}:${port}`);
    console.log(`[codeflow-mcp] SSE endpoint: POST /`);
    console.log(`[codeflow-mcp] Tools: test_tool`);
  });

  return server;
}

// ─── CLI dispatcher ───────────────────────────────────────────────────────────

const [cmd, subcmd, ...args] = process.argv.slice(2);

if (cmd === "server" && subcmd === "start") {
  let port = 3100;
  let host = "localhost";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port" && i + 1 < args.length) port = parseInt(args[i + 1], 10);
    else if (args[i] === "--host" && i + 1 < args.length) host = args[i + 1];
  }
  startHttpServer(port, host);
} else if (cmd === "tool" && subcmd === "list") {
  const serverUrl = args[0] ?? "http://localhost:3100";
  const res = await fetch(serverUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });
  const data = await res.json() as JsonRpcResponse;
  if (data.error) {
    console.error(`Error: ${data.error.message}`);
    process.exit(1);
  }
  console.log(JSON.stringify(data.result, null, 2));
} else if (cmd === "tool" && subcmd === "invoke") {
  const [toolName, serverUrl = "http://localhost:3100", argsJson = "{}"] = args;
  const res = await fetch(serverUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: toolName, arguments: JSON.parse(argsJson) },
    }),
  });
  const data = await res.json() as JsonRpcResponse;
  if (data.error) {
    console.error(`Error: ${data.error.message}`);
    process.exit(1);
  }
  console.log(JSON.stringify(data.result, null, 2));
} else {
  console.log(`Usage:
  codeflow-mcp server start [--port 3100] [--host localhost]
  codeflow-mcp tool list <serverUrl>
  codeflow-mcp tool invoke <name> <serverUrl> [args-json]

Examples:
  codeflow-mcp server start --port 3100
  codeflow-mcp tool list http://localhost:3100
  codeflow-mcp tool invoke test_tool http://localhost:3100 '{}'
`);
}
