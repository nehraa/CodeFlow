import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { POST as createBranch } from "@/app/api/branches/route";
import { DELETE, GET } from "@/app/api/branches/[id]/route";
import type { BlueprintGraph, GraphBranch } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

const createdDirs: string[] = [];

const graph: BlueprintGraph = {
  projectName: "Branch Item Test",
  mode: "essential",
  generatedAt: "2026-03-26T00:00:00.000Z",
  warnings: [],
  workflows: [],
  edges: [],
  nodes: [
    {
      id: "module:root",
      kind: "module",
      name: "RootModule",
      summary: "Root module.",
      contract: emptyContract(),
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    }
  ]
};

afterEach(async () => {
  await Promise.all(createdDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  createdDirs.length = 0;
  delete process.env.CODEFLOW_STORE_ROOT;
});

describe("GET /api/branches/[id]", () => {
  it("loads a stored branch by id", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-branch-item-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;

    const createResponse = await createBranch(
      new Request("http://localhost/api/branches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ graph, name: "saved-branch" })
      })
    );
    const createBody = (await createResponse.json()) as { branch: GraphBranch };

    const response = await GET(
      new Request(`http://localhost/api/branches/${createBody.branch.id}?projectName=Branch%20Item%20Test`),
      { params: Promise.resolve({ id: createBody.branch.id }) }
    );
    const body = (await response.json()) as { branch: GraphBranch };

    expect(response.status).toBe(200);
    expect(body.branch.id).toBe(createBody.branch.id);
    expect(body.branch.name).toBe("saved-branch");
  });

  it("returns 400 for invalid branch ids", async () => {
    const response = await GET(
      new Request("http://localhost/api/branches/not-valid?projectName=Branch%20Item%20Test"),
      { params: Promise.resolve({ id: "../bad" }) }
    );

    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/branches/[id]", () => {
  it("deletes a stored branch", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-branch-delete-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;

    const createResponse = await createBranch(
      new Request("http://localhost/api/branches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ graph, name: "delete-me" })
      })
    );
    const createBody = (await createResponse.json()) as { branch: GraphBranch };

    const deleteResponse = await DELETE(
      new Request(`http://localhost/api/branches/${createBody.branch.id}?projectName=Branch%20Item%20Test`),
      { params: Promise.resolve({ id: createBody.branch.id }) }
    );
    const deleteBody = (await deleteResponse.json()) as { deleted: boolean };

    expect(deleteResponse.status).toBe(200);
    expect(deleteBody.deleted).toBe(true);

    const followUp = await GET(
      new Request(`http://localhost/api/branches/${createBody.branch.id}?projectName=Branch%20Item%20Test`),
      { params: Promise.resolve({ id: createBody.branch.id }) }
    );

    expect(followUp.status).toBe(404);
  });
});
