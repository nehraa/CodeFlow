import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { POST as buildPOST } from "@/app/api/blueprint/route";
import { POST } from "@/app/api/observability/ingest/route";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.map((directory) => fs.rm(directory, { recursive: true, force: true })));
  createdDirs.length = 0;
  delete process.env.CODEFLOW_STORE_ROOT;
});

describe("POST /api/observability/ingest", () => {
  it("stores spans/logs and updates the latest session graph", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-observe-store-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;

    await buildPOST(
      new Request("http://localhost/api/blueprint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectName: "Observed App",
          prdText: "# Functions\n- Function: saveTask()",
          mode: "essential"
        })
      })
    );

    const response = await POST(
      new Request("http://localhost/api/observability/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectName: "Observed App",
          spans: [
            {
              spanId: "span-1",
              traceId: "trace-1",
              name: "saveTask()",
              status: "error",
              durationMs: 6,
              runtime: "node"
            }
          ],
          logs: [
            {
              id: "log-1",
              level: "error",
              message: "save failed",
              runtime: "node",
              timestamp: "2026-03-14T00:00:00.000Z"
            }
          ]
        })
      })
    );
    const body = (await response.json()) as { snapshot: { spans: Array<{ spanId: string }> } };

    expect(response.status).toBe(200);
    expect(body.snapshot.spans[0].spanId).toBe("span-1");
  });
});
