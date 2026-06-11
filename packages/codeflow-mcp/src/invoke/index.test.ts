import { request as httpRequest, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHttpServer, handleJsonRpc, jsonRpcError, jsonRpcResult, TOOLS } from "./index.js";

afterEach(() => vi.restoreAllMocks());

describe("handleJsonRpc", () => {
  describe("tools/list", () => {
    it("returns the TOOLS registry as JSON-RPC result", async () => {
      const response = await handleJsonRpc({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      });

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(1);
      expect(response.result).toEqual({ tools: TOOLS });
    });

    it("returns all fields for each tool (name, description, inputSchema)", async () => {
      const response = await handleJsonRpc({
        jsonrpc: "2.0",
        id: null,
        method: "tools/list",
        params: {},
      });

      const tools = (response.result as { tools: typeof TOOLS }).tools;
      expect(tools.length).toBeGreaterThan(0);
      for (const tool of tools) {
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("inputSchema");
      }
    });
  });

  describe("initialize", () => {
    it("returns protocol version, capabilities, and server info", async () => {
      const response = await handleJsonRpc({
        jsonrpc: "2.0",
        id: 2,
        method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0" } },
      });

      expect(response.result).toMatchObject({
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "codeflow-mcp", version: "0.1.0" },
      });
    });

    it("echoes the id as-is (numeric, string, null)", async () => {
      for (const id of [1, "abc", null]) {
        const response = await handleJsonRpc({
          jsonrpc: "2.0",
          id,
          method: "initialize",
          params: {},
        });
        expect(response.id).toBe(id);
      }
    });
  });

  describe("tools/call", () => {
    it("calls test_tool handler and returns ASCII art content", async () => {
      const response = await handleJsonRpc({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "test_tool", arguments: {} },
      });

      expect(response.result).toHaveProperty("content");
      const content = (response.result as { content: Array<{ type: string; text: string }> }).content;
      expect(content[0]?.type).toBe("text");
      expect(content[0]?.text).toContain("CF");
    });

    it("returns error when name param is missing", async () => {
      const response = await handleJsonRpc({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { arguments: {} },
      });

      expect(response.error).toEqual({ code: -32602, message: "Missing tool name" });
    });

    it("returns error when name param is empty string", async () => {
      const response = await handleJsonRpc({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "", arguments: {} },
      });

      expect(response.error).toEqual({ code: -32602, message: "Missing tool name" });
    });

    it("returns error for unknown tool name", async () => {
      const response = await handleJsonRpc({
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: { name: "nonexistent_tool", arguments: {} },
      });

      expect(response.error).toEqual({ code: -32602, message: "Unknown tool: nonexistent_tool" });
    });

    it("passes arguments to the tool handler", async () => {
      const response = await handleJsonRpc({
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: { name: "test_tool", arguments: { mockArg: "value" } },
      });

      // test_tool ignores args but we verify the handler was called
      expect(response.result).toHaveProperty("content");
    });

    it("returns -32602 for unknown tool name (not -32603)", async () => {
      // Handler exists but name is unknown — verify the correct error code
      const response = await handleJsonRpc({
        jsonrpc: "2.0",
        id: 8,
        method: "tools/call",
        params: { name: "nonexistent_tool", arguments: {} },
      });
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe("method not found", () => {
    it("returns -32601 for unknown methods", async () => {
      const response = await handleJsonRpc({
        jsonrpc: "2.0",
        id: 9,
        method: "tools/delete",
        params: {},
      });

      expect(response.error).toEqual({ code: -32601, message: "Method not found: tools/delete" });
    });

    it("returns -32601 for empty method string", async () => {
      const response = await handleJsonRpc({
        jsonrpc: "2.0",
        id: 10,
        method: "",
        params: {},
      });

      expect(response.error).toEqual({ code: -32601, message: "Method not found: " });
    });
  });
});

describe("jsonRpcError", () => {
  it("formats error response with jsonrpc, id, and error object", () => {
    const err = jsonRpcError(42, -32602, "Invalid params");
    expect(err).toEqual({
      jsonrpc: "2.0",
      id: 42,
      error: { code: -32602, message: "Invalid params" },
    });
  });

  it("works with string id", () => {
    const err = jsonRpcError("req-1", -32700, "Parse error");
    expect(err.error!.code).toBe(-32700);
    expect(err.id).toBe("req-1");
  });

  it("works with null id", () => {
    const err = jsonRpcError(null, -32601, "Method not found");
    expect(err.id).toBe(null);
  });
});

describe("jsonRpcResult", () => {
  it("formats success response with jsonrpc, id, and result", () => {
    const result = jsonRpcResult(1, { tools: [] });
    expect(result).toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: { tools: [] },
    });
  });
});

describe("TOOLS registry", () => {
  it("contains test_tool with valid MCP tool shape", () => {
    const testTool = TOOLS.find((t) => t.name === "test_tool");
    expect(testTool).toBeDefined();
    expect(testTool?.description).toBeTruthy();
    expect(testTool?.inputSchema).toEqual({ type: "object", properties: {}, required: [] });
  });

  it("each tool has name, description, and inputSchema", () => {
    for (const tool of TOOLS) {
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe("string");
      expect(typeof tool.inputSchema).toBe("object");
    }
  });
});

/**
 * CORS tests — verify the server safely handles the `Origin` header to prevent
 * the wildcard-with-credentials exposure that arises when
 * `Access-Control-Allow-Origin: *` is combined with credential-bearing
 * `Access-Control-Allow-Headers` (authorization, x-api-key).
 *
 * When the request includes a non-empty `Origin`, the server must echo it.
 * When `Origin` is absent (non-browser clients, curl, server-to-server), the
 * server falls back to `*` to preserve backward compatibility.
 */
describe("createHttpServer CORS handling", () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    server = createHttpServer(0, "127.0.0.1");
    await new Promise<void>((resolve) => {
      server.once("listening", () => resolve());
    });
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Expected server to be listening on a TCP port");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function get(path: string, origin: string | undefined): Promise<{ allowOrigin: string | string[] | undefined; statusCode: number }> {
    return new Promise((resolve, reject) => {
      const req = httpRequest(
        `${baseUrl}${path}`,
        {
          method: "GET",
          headers: origin === undefined ? {} : { Origin: origin },
        },
        (res) => {
          res.resume();
          res.on("end", () => {
            resolve({ allowOrigin: res.headers["access-control-allow-origin"], statusCode: res.statusCode ?? 0 });
          });
        }
      );
      req.on("error", reject);
      req.end();
    });
  }

  it("echoes the request Origin back in Access-Control-Allow-Origin on GET /", async () => {
    const origin = "https://app.example.com";
    const res = await get("/", origin);
    expect(res.statusCode).toBe(200);
    expect(res.allowOrigin).toBe(origin);
  });

  it("falls back to wildcard when no Origin header is sent (non-browser client)", async () => {
    const res = await get("/", undefined);
    expect(res.statusCode).toBe(200);
    expect(res.allowOrigin).toBe("*");
  });

  it("echoes the request Origin on the OPTIONS preflight response", async () => {
    const origin = "https://app.example.com";
    const res = await new Promise<{ allowOrigin: string | string[] | undefined; statusCode: number }>((resolve, reject) => {
      const req = httpRequest(
        `${baseUrl}/`,
        {
          method: "OPTIONS",
          headers: { Origin: origin, "Access-Control-Request-Method": "POST" },
        },
        (r) => {
          r.resume();
          r.on("end", () => resolve({ allowOrigin: r.headers["access-control-allow-origin"], statusCode: r.statusCode ?? 0 }));
        }
      );
      req.on("error", reject);
      req.end();
    });
    expect(res.statusCode).toBe(204);
    expect(res.allowOrigin).toBe(origin);
  });

  it("echoes the request Origin on the GET /sse response", async () => {
    const origin = "https://app.example.com";
    const res = await new Promise<{ allowOrigin: string | string[] | undefined; statusCode: number }>((resolve, reject) => {
      const req = httpRequest(
        `${baseUrl}/sse`,
        {
          method: "GET",
          headers: { Origin: origin },
        },
        (r) => {
          // SSE keeps the connection open; we only need the response headers.
          // Resolve as soon as headers arrive, then destroy the request to
          // tear down the long-lived stream.
          const result = { allowOrigin: r.headers["access-control-allow-origin"], statusCode: r.statusCode ?? 0 };
          req.destroy();
          resolve(result);
        }
      );
      req.on("error", () => {
        // Destroying the request intentionally triggers ECONNRESET on some
        // platforms. Swallow it — the headers have already been captured.
      });
      req.end();
    });
    expect(res.statusCode).toBe(200);
    expect(res.allowOrigin).toBe(origin);
  });

  it("echoes the request Origin on POST / JSON-RPC responses", async () => {
    const origin = "https://app.example.com";
    const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
    const res = await new Promise<{ allowOrigin: string | string[] | undefined; statusCode: number }>((resolve, reject) => {
      const req = httpRequest(
        `${baseUrl}/`,
        {
          method: "POST",
          headers: { Origin: origin, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
        },
        (r) => {
          r.resume();
          r.on("end", () => resolve({ allowOrigin: r.headers["access-control-allow-origin"], statusCode: r.statusCode ?? 0 }));
        }
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    });
    expect(res.statusCode).toBe(200);
    expect(res.allowOrigin).toBe(origin);
  });

  it("still includes authorization in Access-Control-Allow-Headers (echoing Origin does not strip credentials headers)", async () => {
    const res = await new Promise<{ allowHeaders: string | string[] | undefined }>((resolve, reject) => {
      const req = httpRequest(
        `${baseUrl}/`,
        {
          method: "OPTIONS",
          headers: { Origin: "https://app.example.com", "Access-Control-Request-Method": "POST" },
        },
        (r) => {
          r.resume();
          r.on("end", () => resolve({ allowHeaders: r.headers["access-control-allow-headers"] }));
        }
      );
      req.on("error", reject);
      req.end();
    });
    const allowHeaders = Array.isArray(res.allowHeaders) ? res.allowHeaders.join(",") : res.allowHeaders ?? "";
    expect(allowHeaders).toContain("authorization");
    expect(allowHeaders).toContain("x-api-key");
  });
});
