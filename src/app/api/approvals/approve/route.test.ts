import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/approvals/approve/route";
import { createApprovalRecord } from "@/lib/blueprint/store";
import type { RiskReport, RunPlan } from "@/lib/blueprint/schema";

const createdDirs: string[] = [];

const runPlan: RunPlan = {
  generatedAt: "2026-03-26T00:00:00.000Z",
  tasks: [],
  batches: [],
  warnings: []
};

const riskReport: RiskReport = {
  score: 10,
  level: "low",
  requiresApproval: false,
  factors: []
};

afterEach(async () => {
  await Promise.all(createdDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  createdDirs.length = 0;
  delete process.env.CODEFLOW_STORE_ROOT;
});

describe("POST /api/approvals/approve", () => {
  it("marks an approval as approved", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-approvals-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;

    const approval = await createApprovalRecord({
      projectName: "Approval Test",
      fingerprint: "fp-123",
      outputDir: "/tmp/codeflow-export",
      runPlan,
      riskReport
    });

    const response = await POST(
      new Request("http://localhost/api/approvals/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approvalId: approval.id })
      })
    );
    const body = (await response.json()) as { approval: { status: string; approvedAt?: string } };

    expect(response.status).toBe(200);
    expect(body.approval.status).toBe("approved");
    expect(body.approval.approvedAt).toBeTruthy();
  });

  it("returns 400 when the approval does not exist", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-approvals-missing-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;

    const response = await POST(
      new Request("http://localhost/api/approvals/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approvalId: "missing-approval" })
      })
    );

    expect(response.status).toBe(400);
  });
});
