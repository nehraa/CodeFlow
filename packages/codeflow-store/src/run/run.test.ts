import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createRunId, saveRunRecord } from "./index.js";
import type { RunRecord } from "@abhinav2203/codeflow-core/schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_ROOT = path.join(__dirname, "../../.test-store");

const cleanStore = () => {
  try {
    fsSync.rmSync(STORE_ROOT, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors — best effort
  }
};

const withEnv = async <T>(fn: () => Promise<T>): Promise<T> => {
  const original = process.env.CODEFLOW_STORE_ROOT;
  process.env.CODEFLOW_STORE_ROOT = STORE_ROOT;
  try {
    return await fn();
  } finally {
    process.env.CODEFLOW_STORE_ROOT = original ?? "";
    cleanStore();
  }
};

const makeRunRecord = (id: string): RunRecord => ({
  schemaVersion: "1.0",
  id,
  projectName: "test-project",
  action: "build",
  createdAt: new Date().toISOString(),
  runPlan: {
    generatedAt: new Date().toISOString(),
    tasks: [
      {
        id: "task-1",
        nodeId: "n1",
        title: "Implement auth",
        kind: "module",
        dependsOn: [],
        batchIndex: 0
      }
    ],
    batches: [{ index: 0, taskIds: ["task-1"] }],
    warnings: []
  },
  riskReport: undefined,
  approvalId: undefined,
  executionReport: {
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    results: [
      {
        taskId: "task-1",
        nodeId: "n1",
        status: "completed",
        batchIndex: 0,
        outputPaths: ["dist/auth.js"],
        managedRegionIds: [],
        message: "Task completed successfully",
        errors: [],
        taskType: "code_generation",
        reasoning:
          "I created auth.ts to handle JWT validation because the blueprint specified validateToken as a module dependency.",
        changes: [
          { file: "src/auth.ts", action: "created", summary: "JWT validation module" }
        ]
      }
    ],
    ownership: [],
    steps: [],
    artifacts: []
  },
  exportResult: undefined
});

describe("run", () => {
  beforeEach(() => {
    cleanStore();
  });

  describe("createRunId", () => {
    it("returns a valid UUID v4", () => {
      const id = createRunId();
      expect(typeof id).toBe("string");
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("returns unique IDs each call", () => {
      const id1 = createRunId();
      const id2 = createRunId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("saveRunRecord", () => {
    it("writes the run record to the correct path", async () => {
      await withEnv(async () => {
        const record = makeRunRecord("run-123");
        await saveRunRecord(record);

        const filePath = path.join(STORE_ROOT, "runs", "run-123.json");
        const content = await fs.readFile(filePath, "utf8");
        const parsed = JSON.parse(content);
        expect(parsed.id).toBe("run-123");
        expect(parsed.projectName).toBe("test-project");
      });
    });

    it("creates parent directories if they do not exist", async () => {
      await withEnv(async () => {
        const record = makeRunRecord("new-run-456");
        await saveRunRecord(record);

        const filePath = path.join(STORE_ROOT, "runs", "new-run-456.json");
        const stat = await fs.stat(filePath);
        expect(stat.isFile()).toBe(true);
      });
    });

    it("stores the complete run record including tasks and batches", async () => {
      await withEnv(async () => {
        const record = makeRunRecord("run-full");
        await saveRunRecord(record);

        const filePath = path.join(STORE_ROOT, "runs", "run-full.json");
        const content = await fs.readFile(filePath, "utf8");
        const parsed = JSON.parse(content);
        expect(parsed.runPlan.tasks).toHaveLength(1);
        expect(parsed.runPlan.batches).toHaveLength(1);
        expect(parsed.runPlan.tasks[0].id).toBe("task-1");
      });
    });

    it("stores task execution result with reasoning and changes", async () => {
      await withEnv(async () => {
        const record = makeRunRecord("run-reasoning");
        await saveRunRecord(record);

        const filePath = path.join(STORE_ROOT, "runs", "run-reasoning.json");
        const content = await fs.readFile(filePath, "utf8");
        const parsed = JSON.parse(content);

        expect(parsed.executionReport.results).toHaveLength(1);
        expect(parsed.executionReport.results[0].reasoning).toBe(
          "I created auth.ts to handle JWT validation because the blueprint specified validateToken as a module dependency."
        );
        expect(parsed.executionReport.results[0].changes).toHaveLength(1);
        expect(parsed.executionReport.results[0].changes[0].file).toBe("src/auth.ts");
        expect(parsed.executionReport.results[0].changes[0].action).toBe("created");
        expect(parsed.executionReport.results[0].taskType).toBe("code_generation");
      });
    });

    it("accepts empty changes array for no-op tasks", async () => {
      await withEnv(async () => {
        const record: RunRecord = {
          ...makeRunRecord("run-noop"),
          executionReport: {
            ...makeRunRecord("run-noop").executionReport!,
            results: [
              {
                taskId: "task-1",
                nodeId: "n1",
                status: "completed",
                batchIndex: 0,
                outputPaths: [],
                managedRegionIds: [],
                message: "No files changed",
                errors: [],
                taskType: "bugfix",
                reasoning: "No changes needed — existing implementation already handles edge case correctly.",
                changes: []
              }
            ]
          }
        };
        await saveRunRecord(record);

        const filePath = path.join(STORE_ROOT, "runs", "run-noop.json");
        const content = await fs.readFile(filePath, "utf8");
        const parsed = JSON.parse(content);

        expect(parsed.executionReport.results[0].changes).toHaveLength(0);
        expect(parsed.executionReport.results[0].taskType).toBe("bugfix");
      });
    });
  });
});
