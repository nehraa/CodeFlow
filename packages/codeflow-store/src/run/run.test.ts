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
  executionReport: undefined,
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

    it("can store a record with optional fields as null", async () => {
      await withEnv(async () => {
        const record: RunRecord = {
          ...makeRunRecord("run-minimal"),
          riskReport: undefined,
          approvalId: undefined,
          executionReport: undefined,
          exportResult: undefined
        };
        await saveRunRecord(record);

        const result = await fs.readFile(
          path.join(STORE_ROOT, "runs", "run-minimal.json"),
          "utf8"
        );
        const parsed = JSON.parse(result);
        expect(parsed.id).toBe("run-minimal");
      });
    });
  });
});
