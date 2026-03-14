import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/mcp/invoke/route";

describe("POST /api/mcp/invoke", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the tool result from a successful MCP server response", async () => {
    const content = [{ type: "text", text: "Search returned 5 results." }];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ jsonrpc: "2.0", id: 2, result: { content } })
      })
    );

    const response = await POST(
      new Request("http://localhost/api/mcp/invoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serverUrl: "http://mcp.example.com/mcp",
          toolName: "search_github",
          args: { query: "codeflow" }
        })
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { result: { content: typeof content } };
    expect(body.result.content).toHaveLength(1);
    expect(body.result.content[0]?.text).toBe("Search returned 5 results.");
  });

  it("returns 400 when the MCP server returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: "2.0",
          id: 2,
          error: { code: -32602, message: "Invalid params" }
        })
      })
    );

    const response = await POST(
      new Request("http://localhost/api/mcp/invoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serverUrl: "http://mcp.example.com/mcp",
          toolName: "search_github",
          args: {}
        })
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toContain("Invalid params");
  });

  it("returns 400 when toolName is missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/mcp/invoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serverUrl: "http://mcp.example.com/mcp" })
      })
    );

    expect(response.status).toBe(400);
  });

  it("uses an empty args object by default when args is not supplied", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ jsonrpc: "2.0", id: 2, result: { content: [] } })
    });
    vi.stubGlobal("fetch", fetchMock);

    await POST(
      new Request("http://localhost/api/mcp/invoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serverUrl: "http://mcp.example.com/mcp",
          toolName: "ping"
        })
      })
    );

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as { params: { arguments: Record<string, unknown> } };
    expect(body.params.arguments).toEqual({});
  });

  it("passes custom headers to the MCP server", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ jsonrpc: "2.0", id: 2, result: { content: [] } })
    });
    vi.stubGlobal("fetch", fetchMock);

    await POST(
      new Request("http://localhost/api/mcp/invoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serverUrl: "http://mcp.example.com/mcp",
          toolName: "restricted",
          headers: { "X-Api-Key": "key123" }
        })
      })
    );

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)["X-Api-Key"]).toBe("key123");
  });
});
