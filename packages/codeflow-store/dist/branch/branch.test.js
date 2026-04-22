import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { saveBranch, loadBranch, loadBranches, deleteBranch } from "./index.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_ROOT = path.join(__dirname, "../../.test-store");
const cleanStore = () => {
    try {
        fsSync.rmSync(STORE_ROOT, { recursive: true, force: true });
    }
    catch {
        // Ignore cleanup errors — best effort
    }
};
const withEnv = async (fn) => {
    const original = process.env.CODEFLOW_STORE_ROOT;
    process.env.CODEFLOW_STORE_ROOT = STORE_ROOT;
    try {
        return await fn();
    }
    finally {
        process.env.CODEFLOW_STORE_ROOT = original ?? "";
        cleanStore();
    }
};
const makeBranch = (overrides = {}) => ({
    id: "branch-1",
    name: "branch-1",
    projectName: "test-project",
    createdAt: "2026-01-01T00:00:00.000Z",
    graph: {
        projectName: "test-project",
        mode: "essential",
        phase: "spec",
        generatedAt: "2026-01-01T00:00:00.000Z",
        nodes: [],
        edges: [],
        workflows: [],
        warnings: []
    },
    ...overrides
});
describe("branch", () => {
    beforeEach(() => {
        cleanStore();
    });
    describe("saveBranch", () => {
        it("writes a branch file to the correct path", async () => {
            await withEnv(async () => {
                const branch = makeBranch({ id: "feature-auth", name: "feature-auth" });
                await saveBranch(branch);
                const filePath = path.join(STORE_ROOT, "branches", "test-project", "feature-auth.json");
                const content = await fs.readFile(filePath, "utf8");
                const parsed = JSON.parse(content);
                expect(parsed.id).toBe("feature-auth");
                expect(parsed.name).toBe("feature-auth");
            });
        });
        it("creates parent directories if they do not exist", async () => {
            await withEnv(async () => {
                const branch = makeBranch({ id: "new-branch", projectName: "new-project" });
                await saveBranch(branch);
                const filePath = path.join(STORE_ROOT, "branches", "new-project", "new-branch.json");
                const stat = await fs.stat(filePath);
                expect(stat.isFile()).toBe(true);
            });
        });
    });
    describe("loadBranch", () => {
        it("returns null when the branch does not exist", async () => {
            await withEnv(async () => {
                const result = await loadBranch("test-project", "does-not-exist");
                expect(result).toBeNull();
            });
        });
        it("returns the branch when it exists", async () => {
            await withEnv(async () => {
                const branch = makeBranch({ id: "feature-auth", name: "feature-auth" });
                await saveBranch(branch);
                const result = await loadBranch("test-project", "feature-auth");
                expect(result).not.toBeNull();
                expect(result.id).toBe("feature-auth");
                expect(result.name).toBe("feature-auth");
            });
        });
        it("loads the graph correctly", async () => {
            await withEnv(async () => {
                const branch = makeBranch({
                    id: "feature-auth",
                    graph: {
                        projectName: "test-project",
                        mode: "essential",
                        phase: "spec",
                        generatedAt: "2026-01-01T00:00:00.000Z",
                        nodes: [{
                                id: "n1",
                                kind: "module",
                                name: "auth",
                                summary: "auth module",
                                path: "auth.ts",
                                contract: { summary: "", responsibilities: [], inputs: [], outputs: [], attributes: [], methods: [], sideEffects: [], errors: [], dependencies: [], calls: [], uiAccess: [], backendAccess: [], notes: [] },
                                sourceRefs: [{ kind: "repo", path: "src/auth.ts" }],
                                generatedRefs: [],
                                traceRefs: [],
                                status: "spec_only"
                            }],
                        edges: [],
                        workflows: [],
                        warnings: []
                    }
                });
                await saveBranch(branch);
                const result = await loadBranch("test-project", "feature-auth");
                expect(result.graph.nodes).toHaveLength(1);
                expect(result.graph.nodes[0].name).toBe("auth");
            });
        });
    });
    describe("loadBranches", () => {
        it("returns an empty array when no branches exist", async () => {
            await withEnv(async () => {
                const result = await loadBranches("test-project");
                expect(result).toEqual([]);
            });
        });
        it("returns all branches for a project", async () => {
            await withEnv(async () => {
                await saveBranch(makeBranch({ id: "branch-a", name: "branch-a", createdAt: "2026-01-01T00:00:00.000Z" }));
                await saveBranch(makeBranch({ id: "branch-b", name: "branch-b", createdAt: "2026-01-02T00:00:00.000Z" }));
                const result = await loadBranches("test-project");
                expect(result).toHaveLength(2);
            });
        });
        it("returns branches sorted by createdAt ascending", async () => {
            await withEnv(async () => {
                await saveBranch(makeBranch({ id: "older", name: "older", createdAt: "2026-01-01T00:00:00.000Z" }));
                await saveBranch(makeBranch({ id: "newer", name: "newer", createdAt: "2026-01-03T00:00:00.000Z" }));
                await saveBranch(makeBranch({ id: "middle", name: "middle", createdAt: "2026-01-02T00:00:00.000Z" }));
                const result = await loadBranches("test-project");
                expect(result[0].id).toBe("older");
                expect(result[1].id).toBe("middle");
                expect(result[2].id).toBe("newer");
            });
        });
        it("ignores non-json files in the branch directory", async () => {
            await withEnv(async () => {
                await saveBranch(makeBranch({ id: "valid-branch", name: "valid-branch" }));
                // Write a non-JSON file into the branch directory
                const branchDir = path.join(STORE_ROOT, "branches", "test-project");
                await fs.mkdir(branchDir, { recursive: true });
                await fs.writeFile(path.join(branchDir, "README.txt"), "not a branch");
                const result = await loadBranches("test-project");
                expect(result).toHaveLength(1);
                expect(result[0].id).toBe("valid-branch");
            });
        });
        it("skips malformed JSON files", async () => {
            await withEnv(async () => {
                await saveBranch(makeBranch({ id: "good-branch", name: "good-branch" }));
                // Write a malformed JSON file
                const branchDir = path.join(STORE_ROOT, "branches", "test-project");
                await fs.writeFile(path.join(branchDir, "malformed.json"), "{ not valid json");
                const result = await loadBranches("test-project");
                expect(result).toHaveLength(1);
                expect(result[0].id).toBe("good-branch");
            });
        });
    });
    describe("deleteBranch", () => {
        it("removes the branch file", async () => {
            await withEnv(async () => {
                await saveBranch(makeBranch({ id: "to-delete", name: "to-delete" }));
                await deleteBranch("test-project", "to-delete");
                const filePath = path.join(STORE_ROOT, "branches", "test-project", "to-delete.json");
                await expect(fs.access(filePath)).rejects.toThrow();
            });
        });
        it("does not throw when the branch does not exist", async () => {
            await withEnv(async () => {
                await expect(deleteBranch("test-project", "does-not-exist")).resolves.toBeUndefined();
            });
        });
    });
});
//# sourceMappingURL=branch.test.js.map