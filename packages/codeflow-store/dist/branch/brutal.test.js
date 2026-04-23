import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { saveBranch, loadBranch, loadBranches, deleteBranch } from "./index.js";
describe("branch module — BRUTAL edge case tests", () => {
    const tmpDir = path.join(os.tmpdir(), `codeflow-test-branch-brutal-${Date.now()}`);
    beforeEach(async () => {
        process.env.CODEFLOW_STORE_ROOT = tmpDir;
        await fs.mkdir(tmpDir, { recursive: true });
    });
    afterEach(async () => {
        delete process.env.CODEFLOW_STORE_ROOT;
        await fs.rm(tmpDir, { recursive: true, force: true });
    });
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
    // ── saveBranch ────────────────────────────────────────────────────────────
    describe("saveBranch", () => {
        it("minimal valid branch — works", async () => {
            const branch = makeBranch({ id: "valid-minimal", name: "valid-minimal", projectName: "proj-x" });
            const result = await saveBranch(branch);
            expect(result.id).toBe("valid-minimal");
            expect(result.name).toBe("valid-minimal");
            expect(result.projectName).toBe("proj-x");
        });
        it("null — exact error message", async () => {
            let thrown;
            try {
                await saveBranch(null);
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/saveBranch: branch is required/);
            expect(thrown.message).toMatch(/received null/);
        });
        it("undefined — exact error message", async () => {
            let thrown;
            try {
                await saveBranch(undefined);
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/saveBranch: branch is required/);
        });
        it("empty object {} — exact error mentions all missing fields", async () => {
            let thrown;
            try {
                await saveBranch({});
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/branch.id is required/);
        });
        it("wrong type string — exact error", async () => {
            let thrown;
            try {
                await saveBranch("not-an-object");
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/branch is required/);
        });
        it("wrong type number — exact error", async () => {
            let thrown;
            try {
                await saveBranch(42);
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/branch is required/);
        });
        it("only projectId+branchName (no id/name/projectName) — error mentions id requirement", async () => {
            let thrown;
            try {
                await saveBranch({ projectId: "p", branchName: "b" });
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/branch.id is required/);
        });
        it("{ projectId, branchName } — works via normalization, name=branchName, projectName=projectId", async () => {
            const result = await saveBranch({ id: "bid", projectId: "my-proj", branchName: "my-branch" });
            expect(result.name).toBe("my-branch");
            expect(result.projectName).toBe("my-proj");
        });
        it("{ id, projectId } — throws; name missing and no branchName fallback", async () => {
            let thrown;
            try {
                await saveBranch({ id: "bid", projectId: "proj-x" });
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/branch.name is required/);
        });
        it("{ id, branchName } — throws; projectName missing and no projectId fallback", async () => {
            let thrown;
            try {
                await saveBranch({ id: "bid", branchName: "branch-x" });
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/branch.projectName is required/);
        });
        it("id missing entirely — error mentions branch.id clearly", async () => {
            let thrown;
            try {
                await saveBranch({ name: "b", projectName: "p" });
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/branch.id is required/);
            expect(thrown.message).toMatch(/non-empty string/);
        });
        it("id = empty string — error", async () => {
            let thrown;
            try {
                await saveBranch({ id: "", name: "b", projectName: "p" });
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/branch.id is required/);
        });
        it("id = whitespace string — error", async () => {
            let thrown;
            try {
                await saveBranch({ id: "   ", name: "b", projectName: "p" });
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/branch.id is required/);
        });
        it("name missing entirely — error mentions name requirement", async () => {
            let thrown;
            try {
                await saveBranch({ id: "bid", projectName: "p" });
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/branch.name is required/);
        });
        it("name = empty string — error", async () => {
            let thrown;
            try {
                await saveBranch({ id: "bid", name: "", projectName: "p" });
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/branch.name is required/);
        });
        it("projectName missing entirely — error mentions projectName", async () => {
            let thrown;
            try {
                await saveBranch({ id: "bid", name: "b" });
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/branch.projectName is required/);
        });
        it("projectName = empty string — error", async () => {
            let thrown;
            try {
                await saveBranch({ id: "bid", name: "b", projectName: "" });
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/branch.projectName is required/);
        });
        it("projectId + branchName but wrong id type — error on id", async () => {
            let thrown;
            try {
                await saveBranch({ id: 123, projectId: "p", branchName: "b" });
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/branch.id is required/);
        });
        it("all fields valid — writes file to correct path", async () => {
            await saveBranch(makeBranch({ id: "path-test", name: "path-test", projectName: "path-project" }));
            const filePath = path.join(tmpDir, "branches", "path-project", "path-test.json");
            const stat = await fs.stat(filePath);
            expect(stat.isFile()).toBe(true);
        });
    });
    // ── loadBranch ───────────────────────────────────────────────────────────
    describe("loadBranch", () => {
        it("valid args, nonexistent branch — returns null", async () => {
            const result = await loadBranch("some-project", "ghost-branch");
            expect(result).toBeNull();
        });
        it("valid project+branch that exists — returns branch", async () => {
            await saveBranch(makeBranch({ id: "exists", name: "exists", projectName: "proj-y" }));
            const result = await loadBranch("proj-y", "exists");
            expect(result).not.toBeNull();
            expect(result.id).toBe("exists");
        });
        it("null projectName — exact error", async () => {
            let thrown;
            try {
                await loadBranch(null, "some-branch");
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/projectName must be a non-empty string/);
            expect(thrown.message).toMatch(/null/);
        });
        it("null branchId — exact error", async () => {
            let thrown;
            try {
                await loadBranch("some-project", null);
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/branchId must be a non-empty string/);
            expect(thrown.message).toMatch(/null/);
        });
        it("undefined projectName — exact error", async () => {
            let thrown;
            try {
                await loadBranch(undefined, "some-branch");
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/projectName must be a non-empty string/);
        });
        it("undefined branchId — exact error", async () => {
            let thrown;
            try {
                await loadBranch("some-project", undefined);
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/branchId must be a non-empty string/);
        });
        it("empty string projectName — exact error", async () => {
            let thrown;
            try {
                await loadBranch("", "some-branch");
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/projectName must be a non-empty string/);
        });
        it("empty string branchId — exact error", async () => {
            let thrown;
            try {
                await loadBranch("some-project", "");
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/branchId must be a non-empty string/);
        });
        it("whitespace-only projectName — error", async () => {
            let thrown;
            try {
                await loadBranch("   ", "branch");
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/projectName must be a non-empty string/);
        });
        it("number projectName — error", async () => {
            let thrown;
            try {
                await loadBranch(42, "branch");
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/projectName must be a non-empty string/);
        });
        it("number branchId — error", async () => {
            let thrown;
            try {
                await loadBranch("proj", 99);
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/branchId must be a non-empty string/);
        });
    });
    // ── loadBranches ─────────────────────────────────────────────────────────
    describe("loadBranches", () => {
        it("valid projectName, no branches — returns []", async () => {
            const result = await loadBranches("empty-project");
            expect(result).toEqual([]);
        });
        it("valid projectName with 2 saved branches — returns both", async () => {
            await saveBranch(makeBranch({ id: "br-a", name: "br-a", projectName: "proj-list" }));
            await saveBranch(makeBranch({ id: "br-b", name: "br-b", projectName: "proj-list" }));
            const result = await loadBranches("proj-list");
            expect(result).toHaveLength(2);
        });
        it("null projectName — exact error (not toLowerCase crash)", async () => {
            let thrown;
            try {
                await loadBranches(null);
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/projectName must be a non-empty string/);
            expect(thrown.message).toMatch(/null/);
        });
        it("undefined projectName — exact error", async () => {
            let thrown;
            try {
                await loadBranches(undefined);
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/projectName must be a non-empty string/);
        });
        it("empty string projectName — error", async () => {
            let thrown;
            try {
                await loadBranches("");
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/projectName must be a non-empty string/);
        });
        it("whitespace-only string — error", async () => {
            let thrown;
            try {
                await loadBranches("   ");
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/projectName must be a non-empty string/);
        });
        it("number projectName — error", async () => {
            let thrown;
            try {
                await loadBranches(99);
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/projectName must be a non-empty string/);
        });
        it("branches sorted by createdAt ascending", async () => {
            await saveBranch(makeBranch({ id: "older", name: "older", projectName: "sort-test", createdAt: "2026-01-01T00:00:00.000Z" }));
            await saveBranch(makeBranch({ id: "middle", name: "middle", projectName: "sort-test", createdAt: "2026-01-03T00:00:00.000Z" }));
            await saveBranch(makeBranch({ id: "newest", name: "newest", projectName: "sort-test", createdAt: "2026-01-05T00:00:00.000Z" }));
            const result = await loadBranches("sort-test");
            expect(result[0].id).toBe("older");
            expect(result[1].id).toBe("middle");
            expect(result[2].id).toBe("newest");
        });
    });
    // ── deleteBranch ──────────────────────────────────────────────────────────
    describe("deleteBranch", () => {
        it("nonexistent branch — does NOT throw, returns undefined silently", async () => {
            let thrown;
            try {
                const result = await deleteBranch("ghost-project", "ghost-branch");
                // Result is undefined (void function that swallows errors)
                expect(result).toBeUndefined();
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeUndefined();
        });
        it("null projectName — throws exact error", async () => {
            let thrown;
            try {
                await deleteBranch(null, "branch-x");
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/projectName must be a non-empty string/);
        });
        it("null branchId — throws exact error", async () => {
            let thrown;
            try {
                await deleteBranch("proj-x", null);
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/branchId must be a non-empty string/);
        });
        it("undefined projectName — throws exact error", async () => {
            let thrown;
            try {
                await deleteBranch(undefined, "branch-x");
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/projectName must be a non-empty string/);
        });
        it("undefined branchId — throws exact error", async () => {
            let thrown;
            try {
                await deleteBranch("proj-x", undefined);
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/branchId must be a non-empty string/);
        });
        it("empty string projectName — throws error", async () => {
            let thrown;
            try {
                await deleteBranch("", "branch-x");
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/projectName must be a non-empty string/);
        });
        it("empty string branchId — throws error", async () => {
            let thrown;
            try {
                await deleteBranch("proj-x", "");
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/branchId must be a non-empty string/);
        });
        it("null projectName + null branchId — throws on projectName first", async () => {
            let thrown;
            try {
                await deleteBranch(null, null);
            }
            catch (e) {
                thrown = e;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/projectName must be a non-empty string/);
        });
        it("valid delete — branch file is removed", async () => {
            await saveBranch(makeBranch({ id: "to-delete", name: "to-delete", projectName: "del-test" }));
            await deleteBranch("del-test", "to-delete");
            const filePath = path.join(tmpDir, "branches", "del-test", "to-delete.json");
            await expect(fs.access(filePath)).rejects.toThrow();
        });
        it("valid save then load then delete then load — verifies gone", async () => {
            await saveBranch(makeBranch({ id: "rt-branch", name: "rt-branch", projectName: "rt-proj" }));
            const loaded = await loadBranch("rt-proj", "rt-branch");
            expect(loaded).not.toBeNull();
            await deleteBranch("rt-proj", "rt-branch");
            const after = await loadBranch("rt-proj", "rt-branch");
            expect(after).toBeNull();
        });
    });
    // ── SAVE → LOAD → DELETE → VERIFY GONE (full round-trip) ─────────────────
    describe("loadBranches after save+delete — round-trip", () => {
        it("save 2 branches → loadBranches sees 2 → delete 1 → loadBranches sees 1", async () => {
            await saveBranch(makeBranch({ id: "rt-a", name: "rt-a", projectName: "rt-full" }));
            await saveBranch(makeBranch({ id: "rt-b", name: "rt-b", projectName: "rt-full" }));
            const before = await loadBranches("rt-full");
            expect(before).toHaveLength(2);
            await deleteBranch("rt-full", "rt-a");
            const after = await loadBranches("rt-full");
            expect(after).toHaveLength(1);
            expect(after[0].id).toBe("rt-b");
        });
    });
});
//# sourceMappingURL=brutal.test.js.map