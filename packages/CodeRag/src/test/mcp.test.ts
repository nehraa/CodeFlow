import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMcpServer, serveStdioMcpServer } from "../mcp/server.js";

const coderag = {
  query: vi.fn().mockResolvedValue({ ok: true }),
  lookup: vi.fn().mockResolvedValue({ ok: true }),
  explain: vi.fn().mockResolvedValue({ ok: true }),
  impact: vi.fn().mockResolvedValue({ ok: true }),
  status: vi.fn().mockResolvedValue({ indexed: true })
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MCP server", () => {
  it("creates a server with the expected tool registrations", () => {
    const server = createMcpServer(coderag as never);
    expect(server).toBeInstanceOf(McpServer);
  });

  it("invokes all registered tool handlers", async () => {
    const server = createMcpServer(coderag as never) as McpServer & {
      _registeredTools: Record<string, { handler: (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }> }>;
    };

    await server._registeredTools.query.handler({ question: "q", depth: 1 });
    await server._registeredTools.lookup.handler({ identifier: "node" });
    await server._registeredTools.explain.handler({ identifier: "node", depth: 1 });
    await server._registeredTools.impact.handler({ identifier: "node", depth: 1 });
    await server._registeredTools.status.handler({});

    expect(coderag.query).toHaveBeenCalledWith("q", { depth: 1 });
    expect(coderag.lookup).toHaveBeenCalledWith("node");
    expect(coderag.explain).toHaveBeenCalledWith("node", 1);
    expect(coderag.impact).toHaveBeenCalledWith("node", 1);
    expect(coderag.status).toHaveBeenCalled();
  });

  it("connects the stdio transport", async () => {
    const connectSpy = vi.spyOn(McpServer.prototype, "connect").mockResolvedValue(undefined as never);

    await serveStdioMcpServer(coderag as never);
    expect(connectSpy).toHaveBeenCalledTimes(1);
  });
});
