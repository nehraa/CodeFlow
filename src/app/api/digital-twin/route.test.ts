import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { POST as buildPOST } from "@/app/api/blueprint/route";
import { GET } from "@/app/api/digital-twin/route";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.map((d) => fs.rm(d, { recursive: true, force: true })));
  createdDirs.length = 0;
  delete process.env.CODEFLOW_STORE_ROOT;
});

describe("GET /api/digital-twin", () => {
  it("returns null snapshot when no session exists", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-dt-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;

    const response = await GET(
      new Request("http://localhost/api/digital-twin?projectName=NoSuchProject")
    );
    const body = (await response.json()) as { snapshot: null; graph: null };

    expect(response.status).toBe(200);
    expect(body.snapshot).toBeNull();
    expect(body.graph).toBeNull();
  });

  it("returns a snapshot after a blueprint is built", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-dt-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;

    // Build a blueprint so a session is stored.
    await buildPOST(
      new Request("http://localhost/api/blueprint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectName: "TwinApp",
          prdText: "# Functions\n- Function: processOrder()",
          mode: "essential"
        })
      })
    );

    const response = await GET(
      new Request("http://localhost/api/digital-twin?projectName=TwinApp&activeWindowSecs=60")
    );
    const body = (await response.json()) as {
      snapshot: { projectName: string; activeNodeIds: string[]; flows: unknown[]; activeWindowSecs: number };
      graph: { projectName: string };
    };

    expect(response.status).toBe(200);
    expect(body.snapshot.projectName).toBe("TwinApp");
    expect(Array.isArray(body.snapshot.activeNodeIds)).toBe(true);
    expect(Array.isArray(body.snapshot.flows)).toBe(true);
    expect(body.snapshot.activeWindowSecs).toBe(60);
    expect(body.graph.projectName).toBe("TwinApp");
  });

  it("returns 400 when projectName is missing", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-dt-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;

    const response = await GET(new Request("http://localhost/api/digital-twin"));
    expect(response.status).toBe(400);
  });
});
