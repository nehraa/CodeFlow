import { afterEach, describe, expect, it, vi } from "vitest";
import { extractTextFromMcpResult, invokeMcpTool, listMcpTools } from "./index.js";
const makeFetchMock = (responseBody, ok = true, status = 200) => vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? "OK" : "Bad Request",
    json: async () => responseBody
});
afterEach(() => vi.unstubAllGlobals());
describe("listMcpTools", () => {
    it("returns the tools array from a valid tools/list response", async () => {
        const tools = [
            { name: "search_github", description: "Search GitHub", inputSchema: { type: "object" } },
            { name: "send_slack", description: "Send a Slack message" }
        ];
        vi.stubGlobal("fetch", makeFetchMock({ jsonrpc: "2.0", id: 1, result: { tools } }));
        const result = await listMcpTools("http://localhost:3001/mcp");
        expect(result).toHaveLength(2);
        expect(result[0]?.name).toBe("search_github");
        expect(result[1]?.name).toBe("send_slack");
    });
    it("forwards custom headers to the MCP server", async () => {
        const fetchMock = makeFetchMock({ jsonrpc: "2.0", id: 1, result: { tools: [] } });
        vi.stubGlobal("fetch", fetchMock);
        await listMcpTools("http://mcp.example.com/mcp", { Authorization: "Bearer tok" });
        const [, options] = fetchMock.mock.calls[0];
        expect(options.headers["Authorization"]).toBe("Bearer tok");
    });
    it("throws when the server returns a non-ok HTTP status", async () => {
        vi.stubGlobal("fetch", makeFetchMock(null, false, 503));
        await expect(listMcpTools("http://mcp.example.com/mcp")).rejects.toThrow("503");
    });
    it("throws when the JSON-RPC response contains an error", async () => {
        vi.stubGlobal("fetch", makeFetchMock({ jsonrpc: "2.0", id: 1, error: { code: -32601, message: "Method not found" } }));
        await expect(listMcpTools("http://mcp.example.com/mcp")).rejects.toThrow("Method not found");
    });
    it("returns an empty array when the result contains no tools field", async () => {
        vi.stubGlobal("fetch", makeFetchMock({ jsonrpc: "2.0", id: 1, result: {} }));
        const result = await listMcpTools("http://mcp.example.com/mcp");
        expect(result).toEqual([]);
    });
});
describe("invokeMcpTool", () => {
    it("returns the content from a valid tools/call response", async () => {
        const content = [{ type: "text", text: "Found 3 results." }];
        vi.stubGlobal("fetch", makeFetchMock({ jsonrpc: "2.0", id: 2, result: { content } }));
        const result = await invokeMcpTool("http://localhost:3001/mcp", "search_github", {
            query: "typescript MCP"
        });
        expect(result.content).toHaveLength(1);
        expect(result.content[0]?.text).toBe("Found 3 results.");
    });
    it("sends the tool name and arguments in the JSON-RPC params", async () => {
        const fetchMock = makeFetchMock({
            jsonrpc: "2.0",
            id: 2,
            result: { content: [] }
        });
        vi.stubGlobal("fetch", fetchMock);
        await invokeMcpTool("http://mcp.example.com/mcp", "send_slack", { channel: "#dev", text: "hello" });
        const [, options] = fetchMock.mock.calls[0];
        const body = JSON.parse(options.body);
        expect(body.method).toBe("tools/call");
        expect(body.params.name).toBe("send_slack");
        expect(body.params.arguments).toEqual({ channel: "#dev", text: "hello" });
    });
    it("propagates isError flag from the MCP response", async () => {
        vi.stubGlobal("fetch", makeFetchMock({
            jsonrpc: "2.0",
            id: 2,
            result: { content: [{ type: "text", text: "Permission denied" }], isError: true }
        }));
        const result = await invokeMcpTool("http://mcp.example.com/mcp", "restricted_tool", {});
        expect(result.isError).toBe(true);
    });
    it("throws when the JSON-RPC response contains an error", async () => {
        vi.stubGlobal("fetch", makeFetchMock({ jsonrpc: "2.0", id: 2, error: { code: -32602, message: "Invalid params" } }));
        await expect(invokeMcpTool("http://mcp.example.com/mcp", "search_github", {})).rejects.toThrow("Invalid params");
    });
});
describe("extractTextFromMcpResult", () => {
    it("joins text-type content items", () => {
        const result = {
            content: [
                { type: "text", text: "Line one" },
                { type: "image" },
                { type: "text", text: "Line two" }
            ]
        };
        expect(extractTextFromMcpResult(result)).toBe("Line one\nLine two");
    });
    it("returns empty string when there is no text content", () => {
        const result = { content: [{ type: "image" }] };
        expect(extractTextFromMcpResult(result)).toBe("");
    });
});
//# sourceMappingURL=index.test.js.map