import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { approveRecord, createApprovalRecord, createCheckpointIfNeeded, loadLatestSession, upsertSession } from "@/lib/blueprint/store";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

const createdDirs: string[] = [];

const graph: BlueprintGraph = {
  projectName: "Stored Product",
  mode: "essential",
  generatedAt: "2026-03-14T00:00:00.000Z",
  warnings: [],
  workflows: [],
  edges: [],
  nodes: [
    {
      id: "function:save",
      kind: "function",
      name: "save",
      summary: "Save a record.",
      contract: { ...emptyContract(), summary: "Save a record." },
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    }
  ]
};

afterEach(async () => {
  await Promise.all(createdDirs.map((directory) => fs.rm(directory, { recursive: true, force: true })));
  createdDirs.length = 0;
  delete process.env.CODEFLOW_STORE_ROOT;
});

describe("store", () => {
  it("persists and reloads the latest session", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-store-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;

    const session = await upsertSession({
      graph,
      runPlan: {
        generatedAt: "2026-03-14T00:00:00.000Z",
        tasks: [],
        batches: [],
        warnings: []
      }
    });
    const loaded = await loadLatestSession(graph.projectName);

    expect(loaded?.sessionId).toBe(session.sessionId);
    expect(loaded?.projectName).toBe(graph.projectName);
  });

  it("creates approvals and checkpoints", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-store-approval-"));
    const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-store-target-"));
    createdDirs.push(storeRoot, targetDir);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;
    await fs.writeFile(path.join(targetDir, "existing.txt"), "present", "utf8");

    const approval = await createApprovalRecord({
      projectName: graph.projectName,
      fingerprint: "fingerprint",
      outputDir: targetDir,
      runPlan: {
        generatedAt: "2026-03-14T00:00:00.000Z",
        tasks: [],
        batches: [],
        warnings: []
      },
      riskReport: {
        score: 5,
        level: "medium",
        requiresApproval: true,
        factors: []
      }
    });
    const approved = await approveRecord(approval.id);
    const checkpointDir = await createCheckpointIfNeeded(targetDir, "checkpoint-1");
    const checkpointFile = await fs.readFile(path.join(checkpointDir ?? "", "existing.txt"), "utf8");

    expect(approved.status).toBe("approved");
    expect(checkpointFile).toBe("present");
  });
});
