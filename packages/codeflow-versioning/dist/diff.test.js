import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeDiff } from "./diff.js";
import { diffBranches } from "./branch/index";
const mockGraph = {
    projectName: "test-project",
    mode: "essential",
    phase: "spec",
    generatedAt: new Date().toISOString(),
    nodes: [],
    edges: [],
    workflows: [],
    warnings: []
};
const mockDiff = {
    baseId: "base",
    compareId: "compare",
    addedNodes: 0,
    removedNodes: 0,
    modifiedNodes: 0,
    addedEdges: 0,
    removedEdges: 0,
    impactedNodeIds: [],
    nodeDiffs: [],
    edgeDiffs: []
};
vi.mock("./branch/index", () => ({
    diffBranches: vi.fn()
}));
describe("diff.ts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(diffBranches).mockReturnValue(mockDiff);
    });
    describe("computeDiff", () => {
        it("should call diffBranches with parsed payload", async () => {
            const result = await computeDiff({
                baseGraph: mockGraph,
                compareGraph: mockGraph,
                baseId: "branch-a",
                compareId: "branch-b"
            });
            expect(diffBranches).toHaveBeenCalledWith(mockGraph, mockGraph, "branch-a", "branch-b");
            expect(result).toEqual(mockDiff);
        });
        it("should use default ids when not provided", async () => {
            await computeDiff({
                baseGraph: mockGraph,
                compareGraph: mockGraph
            });
            expect(diffBranches).toHaveBeenCalledWith(mockGraph, mockGraph, "base", "compare");
        });
        it("should throw if baseGraph is invalid", async () => {
            await expect(computeDiff({ baseGraph: { projectName: 123 }, compareGraph: mockGraph })).rejects.toThrow();
        });
    });
});
