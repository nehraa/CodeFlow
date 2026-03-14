import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { POST as buildPOST } from "@/app/api/blueprint/route";
import { POST as ingestPOST } from "@/app/api/observability/ingest/route";
import { GET } from "@/app/api/observability/latest/route";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.map((directory) => fs.rm(directory, { recursive: true, force: true })));
  createdDirs.length = 0;
  delete process.env.CODEFLOW_STORE_ROOT;
});

describe("GET /api/observability/latest", () => {
  it("returns the latest stored spans and logs", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-observe-latest-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;

    await buildPOST(
      new Request("http://localhost/api/blueprint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectName: "Observed Latest",
          prdText: "# Functions\n- Function: saveTask()",
          mode: "essential"
        })
      })
    );

    await ingestPOST(
      new Request("http://localhost/api/observability/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectName: "Observed Latest",
          spans: [
            {
              spanId: "span-2",
              traceId: "trace-2",
              name: "saveTask()",
              status: "success",
              durationMs: 3,
              runtime: "browser"
            }
          ],
          logs: [
            {
              id: "log-2",
              level: "info",
              message: "saved",
              runtime: "browser",
              timestamp: "2026-03-14T00:00:00.000Z"
            }
          ]
        })
      })
    );

    const response = await GET(
      new Request("http://localhost/api/observability/latest?projectName=Observed%20Latest")
    );
    const body = (await response.json()) as {
      latestSpans: Array<{ spanId: string }>;
      latestLogs: Array<{ id: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.latestSpans[0].spanId).toBe("span-2");
    expect(body.latestLogs[0].id).toBe("log-2");
  });
});
