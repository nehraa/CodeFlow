import { describe, expect, it } from "vitest";
import { parsePrd } from "./prd.js";
describe("parsePrd", () => {
    it("extracts typed nodes and workflows from structured markdown", () => {
        const result = parsePrd(`
# Frontend
- Screen: Workspace

## Backend API
- POST /api/blueprint

## Workflows
- Workspace -> POST /api/blueprint
`);
        expect(result.nodes.some((node) => node.kind === "ui-screen" && node.name === "Workspace")).toBe(true);
        expect(result.nodes.some((node) => node.kind === "api" && node.name === "POST /api/blueprint")).toBe(true);
        expect(result.workflows).toHaveLength(1);
        expect(result.edges).toHaveLength(1);
    });
    it("warns on ambiguous items instead of inventing nodes", () => {
        const result = parsePrd(`
# Notes
- We should make this nice
`);
        expect(result.nodes).toHaveLength(0);
        expect(result.warnings[0]).toContain("Skipped ambiguous PRD item");
    });
    it("handles API paths with function signatures containing commas", () => {
        const result = parsePrd(`
# API
- POST /api/users/create(name: string, email: string)
`);
        const apiNode = result.nodes.find((node) => node.kind === "api");
        expect(apiNode?.name).toBe("POST /api/users/create");
    });
});
//# sourceMappingURL=prd.test.js.map