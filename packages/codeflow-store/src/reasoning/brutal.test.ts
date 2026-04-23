import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import {
  loadReasoningForRun,
  loadReasoningForProject,
  deleteReasoningForRun
} from "./index.js";
import { saveTaskReasoningCheckpoint } from "../checkpoint/index.js";

describe("reasoning module — BRUTAL edge case tests", () => {
  const tmpDir = path.join(os.tmpdir(), `codeflow-test-reasoning-brutal-${Date.now()}`);

  beforeEach(async () => {
    process.env.CODEFLOW_STORE_ROOT = tmpDir;
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    delete process.env.CODEFLOW_STORE_ROOT;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // ── loadReasoningForRun ────────────────────────────────────────────────────

  describe("loadReasoningForRun", () => {
    it("1-arg with valid runId returns [] when run does not exist", async () => {
      const result = await loadReasoningForRun("nonexistent-run-id");
      expect(result).toEqual([]);
    });

    it("1-arg with valid runId that has checkpoints returns all checkpoints", async () => {
      await saveTaskReasoningCheckpoint("run-1", "ProjA", "task-1", "content a");
      await saveTaskReasoningCheckpoint("run-1", "ProjB", "task-2", "content b");
      const result = await loadReasoningForRun("run-1");
      expect(result).toHaveLength(2);
    });

    it("2-arg with null runId throws exact error", async () => {
      let thrown: any;
      try {
        await loadReasoningForRun(null as any, "some-project");
      } catch (e: any) {
        thrown = e;
      }
      expect(thrown).toBeDefined();
      expect(thrown.message).toMatch(/runId must be a non-empty string/);
    });

    it("2-arg with undefined runId throws exact error", async () => {
      let thrown: any;
      try {
        await loadReasoningForRun(undefined as any, "some-project");
      } catch (e: any) {
        thrown = e;
      }
      expect(thrown).toBeDefined();
      expect(thrown.message).toMatch(/runId must be a non-empty string/);
    });

    it("2-arg with null projectName — falls through to all-projects scan (no throw)", async () => {
      // null is falsy → goes to all-projects path
      await saveTaskReasoningCheckpoint("run-all", "ProjX", "task-x", "data");
      const result = await loadReasoningForRun("run-all", null as any);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it("2-arg with undefined projectName — falls through to all-projects scan (no throw)", async () => {
      await saveTaskReasoningCheckpoint("run-undef", "ProjY", "task-y", "data");
      const result = await loadReasoningForRun("run-undef", undefined as any);
      expect(Array.isArray(result)).toBe(true);
    });

    it("2-arg with non-string projectName (number) throws clear error", async () => {
      let thrown: any;
      try {
        await loadReasoningForRun("run-test", 42 as any);
      } catch (e: any) {
        thrown = e;
      }
      expect(thrown).toBeDefined();
      expect(thrown.message).toMatch(/projectName must be a non-empty string/);
    });

    it("2-arg with wrong type (object) throws clear error", async () => {
      let thrown: any;
      try {
        await loadReasoningForRun("run-test", { p: "proj" } as any);
      } catch (e: any) {
        thrown = e;
      }
      expect(thrown).toBeDefined();
      expect(thrown.message).toMatch(/projectName must be a non-empty string/);
    });
  });

  // ── loadReasoningForProject ────────────────────────────────────────────────

  describe("loadReasoningForProject", () => {
    it("valid projectName returns [] when no runs exist", async () => {
      const result = await loadReasoningForProject("CompletelyEmptyProject");
      expect(result).toEqual([]);
    });

    it("null projectName throws exact error (not toLowerCase crash)", async () => {
      let thrown: any;
      try {
        await loadReasoningForProject(null as any);
      } catch (e: any) {
        thrown = e;
      }
      expect(thrown).toBeDefined();
      expect(thrown.message).toMatch(/projectName must be a non-empty string/);
      expect(thrown.message).toMatch(/null/);
    });

    it("undefined projectName throws exact error", async () => {
      let thrown: any;
      try {
        await loadReasoningForProject(undefined as any);
      } catch (e: any) {
        thrown = e;
      }
      expect(thrown).toBeDefined();
      expect(thrown.message).toMatch(/projectName must be a non-empty string/);
    });

    it("empty string throws exact error", async () => {
      let thrown: any;
      try {
        await loadReasoningForProject("");
      } catch (e: any) {
        thrown = e;
      }
      expect(thrown).toBeDefined();
      expect(thrown.message).toMatch(/projectName must be a non-empty string/);
      expect(thrown.message).toMatch(/"[^"]*"/); // should show the actual value
    });

    it("whitespace-only string throws exact error", async () => {
      let thrown: any;
      try {
        await loadReasoningForProject("   ");
      } catch (e: any) {
        thrown = e;
      }
      expect(thrown).toBeDefined();
      expect(thrown.message).toMatch(/projectName must be a non-empty string/);
    });

    it("number throws exact error", async () => {
      let thrown: any;
      try {
        await loadReasoningForProject(123 as any);
      } catch (e: any) {
        thrown = e;
      }
      expect(thrown).toBeDefined();
      expect(thrown.message).toMatch(/projectName must be a non-empty string/);
    });
  });

  // ── deleteReasoningForRun ─────────────────────────────────────────────────

  describe("deleteReasoningForRun", () => {
    it("nonexistent run+project returns 0", async () => {
      const result = await deleteReasoningForRun("ghost-run", "ghost-project");
      expect(result).toBe(0);
    });

    it("null runId throws exact error", async () => {
      let thrown: any;
      try {
        await deleteReasoningForRun(null as any, "some-project");
      } catch (e: any) {
        thrown = e;
      }
      expect(thrown).toBeDefined();
      expect(thrown.message).toMatch(/runId must be a non-empty string/);
    });

    it("null projectName returns 0 (safely does nothing)", async () => {
      // clearTaskReasoningCheckpoint returns 0 when projectName is falsy
      const result = await deleteReasoningForRun("run-x", null as any);
      expect(result).toBe(0);
    });

    it("undefined projectName returns 0", async () => {
      const result = await deleteReasoningForRun("run-y", undefined as any);
      expect(result).toBe(0);
    });

    it("null runId + null projectName throws on runId (first validation)", async () => {
      let thrown: any;
      try {
        await deleteReasoningForRun(null as any, null as any);
      } catch (e: any) {
        thrown = e;
      }
      expect(thrown).toBeDefined();
      expect(thrown.message).toMatch(/runId must be a non-empty string/);
    });
  });

  // ── FULL ROUND-TRIP ────────────────────────────────────────────────────────

  describe("FULL ROUND-TRIP: save → load → delete → verify gone", () => {
    it("saveTaskReasoningCheckpoint → loadReasoningForRun → deleteReasoningForRun → verify", async () => {
      const runId = "round-trip-run";
      const project = "RoundTripProject";
      const taskId = "task-rt-1";
      const content = "round-trip reasoning content";

      // STEP 1: save
      const saved = await saveTaskReasoningCheckpoint(runId, project, taskId, content);
      expect(saved.runId).toBe(runId);
      expect(saved.projectName).toBe(project);
      expect(saved.taskId).toBe(taskId);
      expect(saved.content).toBe(content);

      // STEP 2: load — verify saved data comes back
      const loaded = await loadReasoningForRun(runId, project);
      expect(loaded).toHaveLength(1);
      expect(loaded[0].content).toBe(content);
      expect(loaded[0].taskId).toBe(taskId);

      // STEP 3: delete
      const deleted = await deleteReasoningForRun(runId, project);
      expect(deleted).toBeGreaterThan(0);

      // STEP 4: verify gone
      const afterDelete = await loadReasoningForRun(runId, project);
      expect(afterDelete).toHaveLength(0);
    });

    it("saveTaskReasoningCheckpoint → loadReasoningForRun(1-arg) → delete → verify gone via 1-arg", async () => {
      const runId = "round-trip-1arg";
      const projectA = "RTProjectA";
      const projectB = "RTProjectB";

      await saveTaskReasoningCheckpoint(runId, projectA, "task-a", "from A");
      await saveTaskReasoningCheckpoint(runId, projectB, "task-b", "from B");

      // 1-arg load sees both
      const before = await loadReasoningForRun(runId);
      expect(before).toHaveLength(2);

      // delete A's checkpoints
      await deleteReasoningForRun(runId, projectA);

      // 1-arg load should only see B's
      const after = await loadReasoningForRun(runId);
      expect(after).toHaveLength(1);
      expect(after[0].projectName).toBe(projectB);
    });
  });
});
