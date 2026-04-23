import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { loadReasoningForRun, loadReasoningForProject, deleteReasoningForRun } from "./index.js";
import { saveTaskReasoningCheckpoint } from "../checkpoint/index.js";
describe("reasoning module", () => {
    const tmpDir = path.join(os.tmpdir(), `codeflow-test-reasoning-module-${Date.now()}`);
    beforeEach(async () => {
        process.env.CODEFLOW_STORE_ROOT = tmpDir;
        await fs.mkdir(tmpDir, { recursive: true });
    });
    afterEach(async () => {
        delete process.env.CODEFLOW_STORE_ROOT;
        await fs.rm(tmpDir, { recursive: true, force: true });
    });
    describe("loadReasoningForRun", () => {
        it("should load checkpoints for a run", async () => {
            await saveTaskReasoningCheckpoint("run-module-1", "ModuleTestProject", "task-a", "reasoning a");
            await saveTaskReasoningCheckpoint("run-module-1", "ModuleTestProject", "task-b", "reasoning b");
            const checkpoints = await loadReasoningForRun("run-module-1", "ModuleTestProject");
            expect(checkpoints).toHaveLength(2);
        });
        it("should return empty for unknown run", async () => {
            const checkpoints = await loadReasoningForRun("unknown-run", "UnknownProject");
            expect(checkpoints).toHaveLength(0);
        });
        it("should collect from all projects when projectName is omitted", async () => {
            await saveTaskReasoningCheckpoint("run-all-projects", "ProjectA", "task-1", "from a");
            await saveTaskReasoningCheckpoint("run-all-projects", "ProjectB", "task-2", "from b");
            const checkpoints = await loadReasoningForRun("run-all-projects");
            expect(checkpoints).toHaveLength(2);
        });
        it("should throw clear error when runId is null", async () => {
            await expect(loadReasoningForRun(null, "SomeProject")).rejects.toThrow(/runId must be a non-empty string.*null/i);
        });
        it("should throw clear error when runId is undefined", async () => {
            await expect(loadReasoningForRun(undefined, "SomeProject")).rejects.toThrow(/runId must be a non-empty string/i);
        });
        it("should throw clear error when projectName is a number", async () => {
            await expect(loadReasoningForRun("run-1", 42)).rejects.toThrow(/projectName must be a (?:non-empty string|string)/i);
        });
    });
    describe("loadReasoningForProject", () => {
        it("should return summaries across all run ids for a project", async () => {
            await saveTaskReasoningCheckpoint("run-p1", "MultiRunProject", "task-1", "content");
            await saveTaskReasoningCheckpoint("run-p2", "MultiRunProject", "task-2", "content");
            const summaries = await loadReasoningForProject("MultiRunProject");
            const runIds = summaries.map(s => s.runId).sort();
            expect(runIds).toContain("run-p1");
            expect(runIds).toContain("run-p2");
        });
        it("should return empty array when no runs exist", async () => {
            const summaries = await loadReasoningForProject("CompletelyEmptyProject");
            expect(summaries).toHaveLength(0);
        });
    });
    describe("deleteReasoningForRun", () => {
        it("should delete all checkpoints for a run", async () => {
            await saveTaskReasoningCheckpoint("run-delete", "DeleteTestProject", "task-1", "c1");
            await saveTaskReasoningCheckpoint("run-delete", "DeleteTestProject", "task-2", "c2");
            const deleted = await deleteReasoningForRun("run-delete", "DeleteTestProject");
            expect(deleted).toBe(2);
            const remaining = await loadReasoningForRun("run-delete", "DeleteTestProject");
            expect(remaining).toHaveLength(0);
        });
    });
});
//# sourceMappingURL=reasoning.test.js.map