import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createApprovalId,
  createApprovalRecord,
  getApprovalRecord,
  approveRecord
} from "./index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_ROOT = path.join(__dirname, "../../.test-store");
const STORE_ROOT_ENV = { CODEFLOW_STORE_ROOT: STORE_ROOT };

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

describe("approval", () => {
  beforeEach(() => {
    cleanStore();
  });

  describe("createApprovalId", () => {
    it("returns a valid UUID v4", () => {
      const id = createApprovalId();
      expect(typeof id).toBe("string");
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("returns unique IDs each call", () => {
      const id1 = createApprovalId();
      const id2 = createApprovalId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("createApprovalRecord", () => {
    it("creates a record with status pending", async () => {
      await withEnv(async () => {
        const record = await createApprovalRecord({
          projectName: "test-project",
          fingerprint: "fingerprint-abc",
          outputDir: "/tmp/output",
          runPlan: { generatedAt: new Date().toISOString(), tasks: [], batches: [], warnings: [] },
          riskReport: { score: 0, level: "low", requiresApproval: false, factors: [] }
        });

        expect(record.status).toBe("pending");
        expect(record.action).toBe("export");
        expect(record.projectName).toBe("test-project");
        expect(record.fingerprint).toBe("fingerprint-abc");
        expect(record.outputDir).toBe("/tmp/output");
        expect(record.requestedAt).toBeDefined();
        expect(record.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
      });
    });

    it("writes the record to disk at the correct path", async () => {
      await withEnv(async () => {
        const record = await createApprovalRecord({
          projectName: "test-project",
          fingerprint: "fingerprint-abc",
          outputDir: "/tmp/output",
          runPlan: { generatedAt: new Date().toISOString(), tasks: [], batches: [], warnings: [] },
          riskReport: { score: 0, level: "low", requiresApproval: false, factors: [] }
        });

        const filePath = path.join(
          STORE_ROOT,
          "approvals",
          `${record.id}.json`
        );
        const content = await fs.readFile(filePath, "utf8");
        const parsed = JSON.parse(content);
        expect(parsed.id).toBe(record.id);
        expect(parsed.status).toBe("pending");
      });
    });
  });

  describe("getApprovalRecord", () => {
    it("returns null for a record that does not exist", async () => {
      await withEnv(async () => {
        const result = await getApprovalRecord("does-not-exist");
        expect(result).toBeNull();
      });
    });

    it("returns the record when it exists", async () => {
      await withEnv(async () => {
        const created = await createApprovalRecord({
          projectName: "test-project",
          fingerprint: "fingerprint-abc",
          outputDir: "/tmp/output",
          runPlan: { generatedAt: new Date().toISOString(), tasks: [], batches: [], warnings: [] },
          riskReport: { score: 0, level: "low", requiresApproval: false, factors: [] }
        });

        const result = await getApprovalRecord(created.id);
        expect(result).not.toBeNull();
        expect(result!.id).toBe(created.id);
        expect(result!.status).toBe("pending");
      });
    });
  });

  describe("approveRecord", () => {
    it("throws when the record does not exist", async () => {
      await withEnv(async () => {
        await expect(approveRecord("does-not-exist", "test-approver")).rejects.toThrow(
          "Approval does-not-exist was not found."
        );
      });
    });

    it("changes status to approved and sets approvedAt", async () => {
      await withEnv(async () => {
        const created = await createApprovalRecord({
          projectName: "test-project",
          fingerprint: "fingerprint-abc",
          outputDir: "/tmp/output",
          runPlan: { generatedAt: new Date().toISOString(), tasks: [], batches: [], warnings: [] },
          riskReport: { score: 0, level: "low", requiresApproval: false, factors: [] }
        });

        const approved = await approveRecord(created.id, "test-approver");
        expect(approved.status).toBe("approved");
        expect(approved.approvedAt).toBeDefined();
        expect(approved.approvedAt).not.toBeNull();
        expect(approved.approver).toBe("test-approver");
      });
    });

    it("preserves all other fields when approving", async () => {
      await withEnv(async () => {
        const created = await createApprovalRecord({
          projectName: "test-project",
          fingerprint: "fingerprint-abc",
          outputDir: "/tmp/output",
          runPlan: { generatedAt: new Date().toISOString(), tasks: [], batches: [], warnings: [] },
          riskReport: { score: 0, level: "low", requiresApproval: false, factors: [] }
        });

        const approved = await approveRecord(created.id, "test-approver");
        expect(approved.id).toBe(created.id);
        expect(approved.projectName).toBe("test-project");
        expect(approved.fingerprint).toBe("fingerprint-abc");
        expect(approved.outputDir).toBe("/tmp/output");
        expect(approved.action).toBe("export");
        expect(approved.approver).toBe("test-approver");
      });
    });

    it("updates the record on disk after approval", async () => {
      await withEnv(async () => {
        const created = await createApprovalRecord({
          projectName: "test-project",
          fingerprint: "fingerprint-abc",
          outputDir: "/tmp/output",
          runPlan: { generatedAt: new Date().toISOString(), tasks: [], batches: [], warnings: [] },
          riskReport: { score: 0, level: "low", requiresApproval: false, factors: [] }
        });

        await approveRecord(created.id, "test-approver");

        const filePath = path.join(STORE_ROOT, "approvals", `${created.id}.json`);
        const content = await fs.readFile(filePath, "utf8");
        const parsed = JSON.parse(content);
        expect(parsed.status).toBe("approved");
        expect(parsed.approvedAt).toBeDefined();
        expect(parsed.approver).toBe("test-approver");
      });
    });
  });
});
