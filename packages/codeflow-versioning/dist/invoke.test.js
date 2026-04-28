import { describe, it, expect, vi, beforeEach } from "vitest";
import { listBranches, createBranch, getBranch, removeBranch } from "./invoke.js";
import { loadBranches, saveBranch, loadBranch, deleteBranch } from "./store/index";
import { createBranch as createBranchGraph, createBranchId } from "./branch/index";
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
const mockBranch = {
    id: "branch-1",
    name: "test-branch",
    description: "A test branch",
    projectName: "test-project",
    parentBranchId: undefined,
    createdAt: new Date().toISOString(),
    graph: mockGraph,
    metadata: {}
};
vi.mock("./store/index", () => ({
    loadBranches: vi.fn(),
    saveBranch: vi.fn(),
    loadBranch: vi.fn(),
    deleteBranch: vi.fn()
}));
vi.mock("./branch/index", () => ({
    createBranch: vi.fn(),
    createBranchId: vi.fn(),
    diffBranches: vi.fn()
}));
// Mock the dynamic import in invoke.ts for snapshotBranchReasoningFromStore
vi.mock("@abhinav2203/codeflow-store/reasoning", () => ({
    loadReasoningForRun: vi.fn().mockResolvedValue([])
}));
describe("invoke.ts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    describe("listBranches", () => {
        it("should call loadBranches with projectName", async () => {
            vi.mocked(loadBranches).mockResolvedValue([mockBranch]);
            const result = await listBranches("test-project");
            expect(loadBranches).toHaveBeenCalledWith("test-project");
            expect(result).toEqual([mockBranch]);
        });
        it("should throw if projectName is empty", async () => {
            await expect(listBranches("")).rejects.toThrow(/projectName must be a non-empty string/);
            await expect(listBranches("   ")).rejects.toThrow(/projectName must be a non-empty string/);
        });
    });
    describe("createBranch", () => {
        it("should create and save a branch", async () => {
            vi.mocked(createBranchGraph).mockReturnValue(mockBranch);
            vi.mocked(saveBranch).mockResolvedValue(mockBranch);
            vi.mocked(createBranchId).mockReturnValue("branch-1");
            const result = await createBranch({
                graph: mockGraph,
                name: "test-branch",
                description: "A test branch"
            });
            expect(createBranchGraph).toHaveBeenCalledWith({
                graph: mockGraph,
                name: "test-branch",
                description: "A test branch",
                parentBranchId: undefined
            });
            expect(saveBranch).toHaveBeenCalledWith(mockBranch);
            expect(result).toEqual(mockBranch);
        });
        it("should throw if name is empty", async () => {
            let error;
            try {
                await createBranch({ graph: mockGraph, name: "" });
            }
            catch (e) {
                error = e;
            }
            expect(error).toBeDefined();
        });
    });
    describe("getBranch", () => {
        it("should call loadBranch with projectName and branchId", async () => {
            vi.mocked(loadBranch).mockResolvedValue(mockBranch);
            const result = await getBranch("test-project", "branch-1");
            expect(loadBranch).toHaveBeenCalledWith("test-project", "branch-1");
            expect(result).toEqual(mockBranch);
        });
        it("should throw if projectName is empty", async () => {
            await expect(getBranch("", "branch-1")).rejects.toThrow(/projectName must be a non-empty string/);
        });
        it("should throw if branchId is empty", async () => {
            await expect(getBranch("test-project", "")).rejects.toThrow(/branchId must be a non-empty string/);
        });
    });
    describe("removeBranch", () => {
        it("should call deleteBranch with projectName and branchId", async () => {
            vi.mocked(deleteBranch).mockResolvedValue();
            await removeBranch("test-project", "branch-1");
            expect(deleteBranch).toHaveBeenCalledWith("test-project", "branch-1");
        });
        it("should throw if projectName is empty", async () => {
            await expect(removeBranch("", "branch-1")).rejects.toThrow(/projectName must be a non-empty string/);
        });
        it("should throw if branchId is empty", async () => {
            await expect(removeBranch("test-project", "")).rejects.toThrow(/branchId must be a non-empty string/);
        });
    });
});
