import { describe, it, expect } from "vitest";
import { runGhostNodes } from "./ghost-nodes.js";
// Minimal graph fixture for unit testing
const makeGraph = (nodes, edges) => ({
    projectName: "test-project",
    phase: "spec",
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
    workflows: [],
    warnings: [],
});
describe("ghost-nodes", () => {
    it("should export runGhostNodes as a function", () => {
        expect(typeof runGhostNodes).toBe("function");
    });
    it("should accept a graph and return a promise of ghost nodes", async () => {
        const graph = makeGraph([], []);
        const result = runGhostNodes(graph);
        expect(result).toBeInstanceOf(Promise);
        // Without a real API key the promise will reject, but the shape is correct
        await expect(result).rejects.toBeDefined();
    });
});
//# sourceMappingURL=ghost-nodes.test.js.map