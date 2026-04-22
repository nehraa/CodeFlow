import { describe, expect, it } from "vitest";
import { TOOLS } from "./index.js";
describe("TOOLS registry", () => {
    it("TOOLS array has exactly 1 tool", () => {
        expect(TOOLS).toHaveLength(1);
    });
    it("the tool is named test_tool", () => {
        expect(TOOLS[0]?.name).toBe("test_tool");
    });
    it("test_tool has correct description", () => {
        expect(TOOLS[0]?.description).toBe("Prints a paw and 'CF' in ASCII art. Use to verify the MCP server is working.");
    });
    it("test_tool has correct inputSchema", () => {
        expect(TOOLS[0]?.inputSchema).toEqual({ type: "object", properties: {}, required: [] });
    });
    it("each tool entry is a valid McpTool shape (name is string)", () => {
        for (const tool of TOOLS) {
            expect(typeof tool.name).toBe("string");
        }
    });
    it("each tool entry has description as string", () => {
        for (const tool of TOOLS) {
            expect(typeof tool.description).toBe("string");
        }
    });
    it("each tool entry has inputSchema as object", () => {
        for (const tool of TOOLS) {
            expect(tool.inputSchema).toBeInstanceOf(Object);
        }
    });
    it("each tool entry is a valid McpTool with all required fields", () => {
        const isValidMcpTool = (t) => typeof t === "object" &&
            t !== null &&
            typeof t.name === "string" &&
            typeof t.description === "string" &&
            typeof t.inputSchema === "object";
        for (const tool of TOOLS) {
            expect(isValidMcpTool(tool)).toBe(true);
        }
    });
});
//# sourceMappingURL=index.test.js.map