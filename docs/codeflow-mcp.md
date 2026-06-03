# codeflow-mcp

Model Context Protocol server and client helpers for CodeFlow. Exposes blueprint operations as MCP tools, transport-agnostic, and ships both stdio and HTTP/SSE servers.

## What it owns

- **MCP server.** A transport-agnostic JSON-RPC handler that responds to `initialize`, `tools/list`, and `tools/call`. Wire format matches the `2024-11-05` protocol version.
- **Stdio transport.** Newline-delimited JSON-RPC over stdin/stdout. What Claude Code and Cursor mount.
- **HTTP transport.** Express-style server with `POST /` for JSON-RPC and `GET /sse` for SSE keep-alive. Default port 3100.
- **Client helpers.** `listMcpTools`, `invokeMcpTool`, `extractTextFromMcpResult`. For consumers that want to call a remote MCP server.
- **Tool registry.** Placeholder `test_tool` plus the versioning tool name constants.

## Subpath exports

| Subpath | Module |
| --- | --- |
| `.` | The client helpers (`listMcpTools`, `invokeMcpTool`, `extractTextFromMcpResult`). |
| `./invoke` | High-level invoke wrappers and the `VERSIONING_TOOL_DEFINITIONS` list. |
| `./tools` | The server-side handler. `TOOLS`, `TOOL_HANDLERS`, `startStdioServer`, `createHttpServer`. |

The CLI binary `codeflow-mcp` starts the server with the default transport.

## Server protocol

The server speaks JSON-RPC 2.0 over either transport. Three methods:

| Method | Response |
| --- | --- |
| `initialize` | `{ protocolVersion: "2024-11-05", serverInfo: { name, version }, capabilities }`. |
| `tools/list` | `{ tools: TOOLS }`. |
| `tools/call` | Dispatched through `TOOL_HANDLERS` map. |

`★ Insight ─────────────────────────────────────`
The transport-agnostic handler is the point. You can mount the same dispatcher in a CLI (stdio), a desktop app (HTTP/SSE), or a test harness (in-process) without changing the tool logic.
`─────────────────────────────────────────────────`

## Stdio transport

```typescript
import { startStdioServer } from '@abhinav2203/codeflow-mcp/tools';

startStdioServer();
// reads newline-delimited JSON-RPC from stdin
// writes responses to stdout
// exits cleanly on EOF
```

What Claude Code and Cursor see is a subprocess with a stdio pipe. Each line is a JSON-RPC message. The server handles one request at a time on the stream.

## HTTP/SSE transport

```typescript
import { createHttpServer } from '@abhinav2203/codeflow-mcp/tools';

const server = createHttpServer(3100, '127.0.0.1');
server.listen();
// POST /        JSON-RPC
// GET  /sse     SSE keep-alive
```

The HTTP transport exists for environments where stdio is awkward (remote agents, browser-based clients). SSE is the keep-alive that prevents idle proxies from killing the connection.

## Tool registry

The `TOOLS` array and `TOOL_HANDLERS` map are deliberately small right now. The current wiring:

```typescript
TOOLS = [
  { name: 'test_tool', description: 'CF test tool', inputSchema: { type: 'object', properties: {} } },
];

TOOL_HANDLERS = {
  test_tool: () => ({ content: [{ type: 'text', text: asciiCat() }] }),
};
```

`VERSIONING_TOOL_DEFINITIONS` (in `./invoke`) declares the names of the twelve versioning tools from `codeflow-versioning/tools` so MCP clients can list them. Wiring the handlers is a per-server decision; the IDE mounts the versioning tools directly.

## Client helpers

```typescript
import {
  listMcpTools,
  invokeMcpTool,
  extractTextFromMcpResult,
} from '@abhinav2203/codeflow-mcp';

const tools = await listMcpTools('http://127.0.0.1:3100');
const result = await invokeMcpTool('http://127.0.0.1:3100', 'test_tool', {}, { 'x-api-key': '...' });
const text = extractTextFromMcpResult(result);
```

`invokeMcpTool` ships with a 10-second default timeout via `AbortController`. Pass a custom signal if you need a different budget. The result envelope is the standard MCP `McpToolResult { content: Array<{ type, text? }> }`; `extractTextFromMcpResult` flattens `content[]` to plain text.

## Where the versioning tools actually run

`codeflow-versioning` exports the tool definitions; the actual `tools/call` dispatch lives in whichever server the IDE mounts. The pattern:

```typescript
// In the IDE's MCP bootstrap
import { VERSIONING_TOOLS } from '@abhinav2203/codeflow-versioning/tools';
import { createMcpServer } from '@abhinav2203/codeflow-mcp'; // hypothetical, builds on ./tools

const server = createMcpServer();
for (const tool of VERSIONING_TOOLS) {
  server.registerTool(tool, versioningHandlers[tool.name]);
}
server.startStdio();
```

This keeps the versioning logic out of the MCP package and out of the protocol layer. The MCP package stays small and focused on the wire format.

## File layout

```
codeflow-mcp/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── scripts/wrap-cli.mjs
└── src/
    ├── index.ts            client helpers
    ├── invoke/             invoke wrappers, VERSIONING_TOOL_DEFINITIONS
    ├── tools/              server: TOOLS, TOOL_HANDLERS, transports
    ├── bin/                CLI entry
    └── index.test.ts
```

## Limits and known gaps

- The default `test_tool` handler returns ASCII art of a cat with "CF". It exists so the server boots and a tool call works end-to-end. Real handlers are mounted by the consumer.
- The HTTP transport does not include authentication. Run it on `127.0.0.1` (default) and put it behind a reverse proxy if you expose it.
- There is no streaming tool call yet. Tool results are returned in a single response; for streaming, the consumer drives the SSE channel.
