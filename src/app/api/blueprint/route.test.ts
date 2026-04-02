import path from "node:path";

import fs from "node:fs/promises";
import os from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/blueprint/route";
import { slugify } from "@/lib/blueprint/utils";
import { getCodeRag } from "@/lib/coderag";

const fixturePath = path.resolve(process.cwd(), "src/lib/blueprint/test-fixtures/sample-repo");
const createdDirs: string[] = [];

afterEach(async () => {
  const codeRag = getCodeRag();
  if (codeRag) {
    await codeRag.close().catch(() => undefined);
  }
  await Promise.all(createdDirs.map((directory) => fs.rm(directory, { recursive: true, force: true })));
  createdDirs.length = 0;
  delete process.env.CODEFLOW_STORE_ROOT;
});

describe("POST /api/blueprint", () => {
  it("returns a built blueprint graph from request input", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-build-store-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;

    const response = await POST(
      new Request("http://localhost/api/blueprint", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          projectName: "Route Test",
          prdText: "# UI\n- Screen: Workspace",
          mode: "essential"
        })
      })
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      graph: { nodes: Array<{ name: string }> };
      runPlan: { tasks: Array<{ title: string }> };
      session: { sessionId: string };
    };
    expect(body.graph.nodes.some((node) => node.name === "Workspace")).toBe(true);
    expect(body.runPlan.tasks.length).toBeGreaterThan(0);
    expect(body.session.sessionId).toBeTruthy();
  });

  it("initializes CodeRag and returns query context after a repo build", async () => {
    const projectName = "Route Test Index";
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-build-store-index-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;

    const response = await POST(
      new Request("http://localhost/api/blueprint", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          projectName,
          repoPath: fixturePath,
          mode: "essential"
        })
      })
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      graph: { nodes: Array<{ id: string; name: string }> };
      session: { repoPath?: string };
    };
    const indexedNode = body.graph.nodes.find((node) => node.name.includes("verifyToken"));
    const codeRag = getCodeRag();

    expect(body.session.repoPath).toBe(fixturePath);
    expect(indexedNode).toBeTruthy();
    expect(codeRag).not.toBeNull();

    const status = await codeRag!.status();
    const result = await codeRag!.query(indexedNode!.name, { depth: 1 });

    expect(status.storageRoot).toBe(path.join(storeRoot, "coderag", slugify(projectName)));
    expect(result.context.primaryNode?.nodeId).toBe(indexedNode?.id);
    expect(result.context.primaryNode?.name).toBe(indexedNode?.name);
  }, 45_000);
});
