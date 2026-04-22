import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import {
  saveTaskReasoningCheckpoint,
  loadTaskReasoningCheckpoint,
  recoverRun,
  clearTaskReasoningCheckpoint
} from "./index.js";

describe("reasoning checkpoint", () => {
  const tmpDir = path.join(os.tmpdir(), `codeflow-test-reasoning-${Date.now()}`);

  beforeEach(async () => {
    process.env.CODEFLOW_STORE_ROOT = tmpDir;
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    delete process.env.CODEFLOW_STORE_ROOT;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("saveTaskReasoningCheckpoint", () => {
    it("should save and return checkpoint", async () => {
      const cp = await saveTaskReasoningCheckpoint(
        "run-1",
        "TestProject",
        "task-1",
        "Thinking about the solution..."
      );
      expect(cp.runId).toBe("run-1");
      expect(cp.projectName).toBe("TestProject");
      expect(cp.taskId).toBe("task-1");
      expect(cp.content).toBe("Thinking about the solution...");
      expect(cp.savedAt).toBeDefined();
    });

    it("should persist checkpoint to disk", async () => {
      await saveTaskReasoningCheckpoint("run-1", "PersistProject", "task-1", "content");
      const loaded = await loadTaskReasoningCheckpoint("run-1", "PersistProject", "task-1");
      expect(loaded).not.toBeNull();
      expect(loaded!.content).toBe("content");
    });
  });

  describe("loadTaskReasoningCheckpoint", () => {
    it("should return null for nonexistent checkpoint", async () => {
      const result = await loadTaskReasoningCheckpoint("run-x", "FakeProject", "task-y");
      expect(result).toBeNull();
    });

    it("should load saved checkpoint", async () => {
      await saveTaskReasoningCheckpoint("run-2", "LoadProject", "task-1", "saved content");
      const loaded = await loadTaskReasoningCheckpoint("run-2", "LoadProject", "task-1");
      expect(loaded).not.toBeNull();
      expect(loaded!.content).toBe("saved content");
    });

    it("should slugify project names", async () => {
      await saveTaskReasoningCheckpoint("run-3", "My Test Project", "task-1", "content");
      const loaded = await loadTaskReasoningCheckpoint("run-3", "My Test Project", "task-1");
      expect(loaded).not.toBeNull();
    });
  });

  describe("recoverRun", () => {
    it("should return empty array for nonexistent run", async () => {
      const checkpoints = await recoverRun("nonexistent-run", "SomeProject");
      expect(checkpoints).toHaveLength(0);
    });

    it("should recover multiple checkpoints sorted by savedAt", async () => {
      await saveTaskReasoningCheckpoint("run-recover", "RecoverProject", "task-1", "first");
      await saveTaskReasoningCheckpoint("run-recover", "RecoverProject", "task-2", "second");
      await saveTaskReasoningCheckpoint("run-recover", "RecoverProject", "task-3", "third");

      const checkpoints = await recoverRun("run-recover", "RecoverProject");
      expect(checkpoints).toHaveLength(3);
      expect(checkpoints[0].taskId).toBe("task-1");
    });

    it("should skip malformed files", async () => {
      const dir = path.join(tmpDir, "checkpoints", "reasoning", "run-recover-malformed", "recovermalformed");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, "task-good.json"), JSON.stringify({
        runId: "run-recover-malformed",
        projectName: "RecoverMalformed",
        taskId: "task-good",
        content: "good",
        savedAt: new Date().toISOString()
      }));
      await fs.writeFile(path.join(dir, "task-bad.json"), "not valid json");

      const checkpoints = await recoverRun("run-recover-malformed", "RecoverMalformed");
      expect(checkpoints).toHaveLength(1);
      expect(checkpoints[0].taskId).toBe("task-good");
    });
  });

  describe("clearTaskReasoningCheckpoint", () => {
    it("should return 0 for nonexistent run", async () => {
      const deleted = await clearTaskReasoningCheckpoint("fake-run", "FakeProject");
      expect(deleted).toBe(0);
    });

    it("should delete specific task checkpoint", async () => {
      await saveTaskReasoningCheckpoint("run-clear", "ClearProject", "task-1", "content1");
      await saveTaskReasoningCheckpoint("run-clear", "ClearProject", "task-2", "content2");

      const deleted = await clearTaskReasoningCheckpoint("run-clear", "ClearProject", "task-1");
      expect(deleted).toBe(1);

      const remaining = await loadTaskReasoningCheckpoint("run-clear", "ClearProject", "task-1");
      expect(remaining).toBeNull();
      const kept = await loadTaskReasoningCheckpoint("run-clear", "ClearProject", "task-2");
      expect(kept).not.toBeNull();
    });

    it("should delete all checkpoints when taskId omitted", async () => {
      await saveTaskReasoningCheckpoint("run-clear-all", "ClearAllProject", "task-1", "c1");
      await saveTaskReasoningCheckpoint("run-clear-all", "ClearAllProject", "task-2", "c2");

      const deleted = await clearTaskReasoningCheckpoint("run-clear-all", "ClearAllProject");
      expect(deleted).toBe(2);

      const remaining = await recoverRun("run-clear-all", "ClearAllProject");
      expect(remaining).toHaveLength(0);
    });
  });
});