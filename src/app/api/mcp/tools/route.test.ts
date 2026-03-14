import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/mcp/tools/route";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/mcp/tools", () => {
  it("returns the tools list from a successful MCP server response", async () => {
    const tools = [
      { name: "search_github", description: "Search GitHub" },
      { name: "send_slack", description: "Send Slack message" }
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ jsonrpc: "2.0", id: 1, result: { tools } })
      })
    );

    const response = await POST(
      new Request("http://localhost/api/mcp/tools", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serverUrl: "http://mcp.example.com/mcp" })
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { tools: typeof tools };
    expect(body.tools).toHaveLength(2);
    expect(body.tools[0]?.name).toBe("search_github");
  });

  it("returns 400 when the MCP server is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))
    );

    const response = await POST(
      new Request("http://localhost/api/mcp/tools", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serverUrl: "http://localhost:9999/mcp" })
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toContain("ECONNREFUSED");
  });

  it("returns 400 when serverUrl is missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/mcp/tools", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({})
      })
    );

    expect(response.status).toBe(400);
  });

  it("passes custom headers to the MCP server", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ jsonrpc: "2.0", id: 1, result: { tools: [] } })
    });
    vi.stubGlobal("fetch", fetchMock);

    await POST(
      new Request("http://localhost/api/mcp/tools", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serverUrl: "http://mcp.example.com/mcp",
          headers: { Authorization: "Bearer secret" }
        })
      })
    );

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)["Authorization"]).toBe("Bearer secret");
  });
});
