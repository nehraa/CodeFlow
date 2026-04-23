import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { saveBranch, loadBranch, loadBranches, deleteBranch } from "./index.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_ROOT = path.join(__dirname, "../../.test-store-branch");
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
        it("should throw clear error when called with null", async () => {
            await withEnv(async () => {
                await expect(saveBranch(null)).rejects.toThrow(/branch is required.*received null/i);
            });
        });
        it("should throw clear error when called with undefined", async () => {
            await withEnv(async () => {
                await expect(saveBranch(undefined)).rejects.toThrow(/branch is required/i);
            });
        });
        it("should throw clear error when id is missing", async () => {
            await withEnv(async () => {
                const branch = {
                    name: "branch-name",
                    projectName: "test-project",
                    createdAt: new Date().toISOString(),
                    graph: { projectName: "test-project", mode: "essential", phase: "spec", generatedAt: "", nodes: [], edges: [], workflows: [], warnings: [] }
                };
                await expect(saveBranch(branch)).rejects.toThrow(/branch.id is required/);
            });
        });
        it("should throw clear error when id is empty string", async () => {
            await withEnv(async () => {
                const branch = {
                    id: "",
                    name: "branch-name",
                    projectName: "test-project",
                    createdAt: new Date().toISOString(),
                    graph: { projectName: "test-project", mode: "essential", phase: "spec", generatedAt: "", nodes: [], edges: [], workflows: [], warnings: [] }
                };
                await expect(saveBranch(branch)).rejects.toThrow(/branch.id is required.*non-empty string/i);
            });
        });
        it("should succeed when name is provided via branchName (normalized to name)", async () => {
            await withEnv(async () => {
                const branch = {
                    id: "branch-id",
                    // name intentionally missing - but branchName is provided
                    branchName: "normalized-from-branchName",
                    projectName: "test-project",
                    createdAt: new Date().toISOString(),
                    graph: { projectName: "test-project", mode: "essential", phase: "spec", generatedAt: "", nodes: [], edges: [], workflows: [], warnings: [] }
                };
                const result = await saveBranch(branch);
                expect(result.name).toBe("normalized-from-branchName");
            });
        });
        it("should succeed when projectName is provided via projectId (normalized to projectName)", async () => {
            await withEnv(async () => {
                const branch = {
                    id: "branch-id",
                    name: "branch-name",
                    // projectName intentionally missing - but projectId is provided
                    projectId: "normalized-from-projectId",
                    createdAt: new Date().toISOString(),
                    graph: { projectName: "test-project", mode: "essential", phase: "spec", generatedAt: "", nodes: [], edges: [], workflows: [], warnings: [] }
                };
                const result = await saveBranch(branch);
                expect(result.projectName).toBe("normalized-from-projectId");
            });
        });
        it("should throw clear error when both projectId and branchName are used (common mistake)", async () => {
            await withEnv(async () => {
                const branch = {
                    projectId: "my-project",
                    branchName: "my-branch"
                    // missing id, name, projectName
                };
                await expect(saveBranch(branch)).rejects.toThrow(/branch.id is required/);
            });
        });
        it("should accept branch with minimal required fields", async () => {
            await withEnv(async () => {
                const branch = {
                    id: "minimal-branch",
                    name: "minimal-branch",
                    projectName: "minimal-test",
                    createdAt: new Date().toISOString(),
                    graph: { projectName: "minimal-test", mode: "essential", phase: "spec", generatedAt: "", nodes: [], edges: [], workflows: [], warnings: [] }
                };
                const result = await saveBranch(branch);
                expect(result.id).toBe("minimal-branch");
                expect(result.name).toBe("minimal-branch");
                expect(result.projectName).toBe("minimal-test");
            });
        });
        it("should preserve optional description field", async () => {
            await withEnv(async () => {
                const branch = makeBranch({
                    id: "with-description",
                    name: "with-description",
                    description: "This is a test branch with a description"
                });
                await saveBranch(branch);
                const result = await loadBranch("test-project", "with-description");
                expect(result.description).toBe("This is a test branch with a description");
            });
        });
        it("should handle common mistake: saveBranch({ projectId, branchName }) — previously crashed with cryptic path error", async () => {
            // This is the bug from the issue - intuitive field names caused cryptic errors
            await withEnv(async () => {
                const branch = {
                    id: "feature-branch",
                    projectId: "my-test-project",
                    branchName: "my-feature"
                    // Note: name and projectName are missing, but projectId and branchName are provided
                };
                // Should NOT throw "path argument must be of type string" anymore
                const result = await saveBranch(branch);
                expect(result.name).toBe("my-feature");
                expect(result.projectName).toBe("my-test-project");
            });
        });
        it("should throw clear error when id is missing entirely (even with all intuitive fields)", async () => {
            await withEnv(async () => {
                const branch = {
                    // id intentionally missing
                    name: "some-branch",
                    projectName: "some-project",
                    createdAt: new Date().toISOString(),
                    graph: { projectName: "some-project", mode: "essential", phase: "spec", generatedAt: "", nodes: [], edges: [], workflows: [], warnings: [] }
                };
                await expect(saveBranch(branch)).rejects.toThrow(/branch.id is required/);
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
        it("should throw clear error when projectName is null", async () => {
            await withEnv(async () => {
                await expect(deleteBranch(null, "branch-id")).rejects.toThrow(/projectName must be a non-empty string.*null/i);
            });
        });
        it("should throw clear error when projectName is undefined", async () => {
            await withEnv(async () => {
                await expect(deleteBranch(undefined, "branch-id")).rejects.toThrow(/projectName must be a non-empty string/i);
            });
        });
        it("should throw clear error when branchId is null", async () => {
            await withEnv(async () => {
                await expect(deleteBranch("test-project", null)).rejects.toThrow(/branchId must be a non-empty string.*null/i);
            });
        });
        it("should throw clear error when branchId is undefined", async () => {
            await withEnv(async () => {
                await expect(deleteBranch("test-project", undefined)).rejects.toThrow(/branchId must be a non-empty string/i);
            });
        });
        it("should throw clear error when projectName is empty string", async () => {
            await withEnv(async () => {
                await expect(deleteBranch("", "branch-id")).rejects.toThrow(/projectName must be a non-empty string/i);
            });
        });
        it("should throw clear error when branchId is empty string", async () => {
            await withEnv(async () => {
                await expect(deleteBranch("test-project", "")).rejects.toThrow(/branchId must be a non-empty string/i);
            });
        });
        it("should throw clear error when both projectName and branchId are null", async () => {
            await withEnv(async () => {
                await expect(deleteBranch(null, null)).rejects.toThrow(/projectName must be a non-empty string.*null/i);
            });
        });
    });
});
//# sourceMappingURL=branch.test.js.map