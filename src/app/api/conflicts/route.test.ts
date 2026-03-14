import path from "node:path";

import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/conflicts/route";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

const fixturePath = path.resolve(process.cwd(), "src/lib/blueprint/test-fixtures/sample-repo");

describe("POST /api/conflicts", () => {
  it("returns drift conflicts against the repo", async () => {
    const graph: BlueprintGraph = {
      projectName: "Conflict Route",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      edges: [],
      nodes: [
        {
          id: "function:normalize",
          kind: "function",
          name: "normalizeTask",
          path: "src/services/task-service.ts",
          summary: "Wrong summary.",
          signature: "normalizeTask(input: string): string",
          contract: { ...emptyContract(), summary: "Wrong summary." },
          sourceRefs: [{ kind: "repo", path: "src/services/task-service.ts", symbol: "normalizeTask" }],
          generatedRefs: [],
          traceRefs: []
        }
      ]
    };

    const response = await POST(
      new Request("http://localhost/api/conflicts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          graph,
          repoPath: fixturePath
        })
      })
    );
    const body = (await response.json()) as { report: { conflicts: Array<{ kind: string }> } };

    expect(response.status).toBe(200);
    expect(body.report.conflicts.some((conflict) => conflict.kind === "signature-mismatch")).toBe(true);
  });
});
