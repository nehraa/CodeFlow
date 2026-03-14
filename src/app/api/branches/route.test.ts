import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { GET, POST } from "@/app/api/branches/route";
import type { BlueprintGraph, GraphBranch } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

const createdDirs: string[] = [];

const graph: BlueprintGraph = {
  projectName: "Branch Test Project",
  mode: "essential",
  generatedAt: "2026-03-14T00:00:00.000Z",
  warnings: [],
  workflows: [],
  nodes: [
    {
      id: "A",
      kind: "module",
      name: "A",
      summary: "Module A",
      contract: emptyContract(),
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    }
  ],
  edges: []
};

afterEach(async () => {
  await Promise.all(createdDirs.map((d) => fs.rm(d, { recursive: true, force: true })));
  createdDirs.length = 0;
  delete process.env.CODEFLOW_STORE_ROOT;
});

describe("POST /api/branches", () => {
  it("creates a branch and returns it", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-branches-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;

    const response = await POST(
      new Request("http://localhost/api/branches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ graph, name: "what-if-mongo" })
      })
    );
    const body = (await response.json()) as { branch: GraphBranch };

    expect(response.status).toBe(200);
    expect(body.branch.name).toBe("what-if-mongo");
    expect(body.branch.projectName).toBe("Branch Test Project");
    expect(body.branch.id).toBeTruthy();
  });

  it("returns 400 for a missing name", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-branches-err-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;

    const response = await POST(
      new Request("http://localhost/api/branches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ graph })
      })
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 for an invalid graph payload", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-branches-inv-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;

    const response = await POST(
      new Request("http://localhost/api/branches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "bad-branch" })
      })
    );

    expect(response.status).toBe(400);
  });
});

describe("GET /api/branches", () => {
  it("returns empty list when no branches exist", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-branches-list-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;

    const response = await GET(
      new Request("http://localhost/api/branches?projectName=Branch+Test+Project")
    );
    const body = (await response.json()) as { branches: GraphBranch[] };

    expect(response.status).toBe(200);
    expect(body.branches).toHaveLength(0);
  });

  it("returns created branches after POST", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-branches-list2-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;

    await POST(
      new Request("http://localhost/api/branches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ graph, name: "branch-one" })
      })
    );

    const response = await GET(
      new Request("http://localhost/api/branches?projectName=Branch+Test+Project")
    );
    const body = (await response.json()) as { branches: GraphBranch[] };

    expect(response.status).toBe(200);
    expect(body.branches).toHaveLength(1);
    expect(body.branches[0].name).toBe("branch-one");
  });

  it("returns 400 when projectName is missing", async () => {
    const response = await GET(new Request("http://localhost/api/branches"));
    expect(response.status).toBe(400);
  });
});
