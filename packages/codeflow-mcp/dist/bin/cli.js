#!/usr/bin/env node
/**
 * codeflow-mcp CLI
 *
 * Usage:
 *   codeflow-mcp stdio              # Start MCP server over stdio (Claude Code, Cursor)
 *   codeflow-mcp server start      # Start MCP server over HTTP+SSE
 *   codeflow-mcp tool list <url>    # Query tools from a remote MCP server
 *   codeflow-mcp tool invoke <name> <url> [args-json]
 */
import { startStdioServer, createHttpServer } from "../invoke/index.js";
function jsonRpcError(id, code, message) {
    return { jsonrpc: "2.0", id: id, error: { code, message } };
}
function jsonRpcResult(id, result) {
    return { jsonrpc: "2.0", id: id, result };
}
// ─── Tool query client ────────────────────────────────────────────────────────
async function queryRemote(serverUrl, request) {
    const res = await fetch(serverUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
    });
    return res.json();
}
// ─── CLI dispatch ─────────────────────────────────────────────────────────────
const [cmd, subcmd, ...args] = process.argv.slice(2);
if (cmd === "stdio") {
    // MCP over stdio — keeps process alive, reads/writes JSON-RPC lines
    startStdioServer().catch((err) => {
        console.error("[codeflow-mcp] stdio server error:", err);
        process.exit(1);
    });
}
else if (cmd === "server" && subcmd === "start") {
    // HTTP + SSE server
    let port = 3100;
    let host = "localhost";
    const remaining = args.slice(0);
    for (let i = 0; i < remaining.length; i++) {
        if (remaining[i] === "--port" && i + 1 < remaining.length) {
            port = parseInt(remaining[i + 1], 10);
        }
        else if (remaining[i] === "--host" && i + 1 < remaining.length) {
            host = remaining[i + 1];
        }
    }
    createHttpServer(port, host);
}
else if (cmd === "tool" && subcmd === "list") {
    const serverUrl = args[0] ?? "http://localhost:3100";
    const data = await queryRemote(serverUrl, {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
    });
    if (data.error) {
        console.error(`Error: ${data.error.message}`);
        process.exit(1);
    }
    console.log(JSON.stringify(data.result, null, 2));
}
else if (cmd === "tool" && subcmd === "invoke") {
    const [toolName, serverUrl = "http://localhost:3100", argsJson = "{}"] = args;
    const data = await queryRemote(serverUrl, {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: toolName, arguments: JSON.parse(argsJson) },
    });
    if (data.error) {
        console.error(`Error: ${data.error.message}`);
        process.exit(1);
    }
    console.log(JSON.stringify(data.result, null, 2));
}
else {
    console.log(`Usage:
  codeflow-mcp stdio                            # Start MCP server over stdio (Claude Code, Cursor)
  codeflow-mcp server start [--port 3100] [--host localhost]
  codeflow-mcp tool list <serverUrl>
  codeflow-mcp tool invoke <name> <serverUrl> [args-json]

Transports:
  stdio  — Claude Code CLI, Cursor, any stdio MCP client  (Recommended for local dev)
  HTTP   — Web clients, Claude Desktop, any HTTP MCP client
  SSE    — Claude Desktop streaming responses

Examples:
  # Start as MCP server for Claude Code CLI
  codeflow-mcp stdio

  # Start as HTTP server with SSE
  codeflow-mcp server start --port 3100

  # Query remote server
  codeflow-mcp tool list http://localhost:3100
  codeflow-mcp tool invoke test_tool http://localhost:3100 '{}'
`);
}
//# sourceMappingURL=cli.js.map