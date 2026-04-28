import { describe, expect, it } from "vitest";

import { POST } from "../../../../handlers/refactor-detect";
import type { BlueprintGraph } from "@abhinav2203/codeflow-core/schema";
import { emptyContract } from "@abhinav2203/codeflow-core/schema";

const graph: BlueprintGraph = {
  projectName: "Refactor Detect Route",
  mode: "essential",
  generatedAt: "2026-03-26T00:00:00.000Z",
  warnings: [],
  workflows: [],
  nodes: [
    {
      id: "function:auth",
      kind: "function",
      name: "authenticate",
      summary: "Authenticate a user.",
      contract: {
        ...emptyContract(),
        calls: [{ target: "GET /users", kind: "calls", description: undefined }],
      },
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: [],
    },
    {
      id: "api:users",
      kind: "api",
      name: "GET /users",
      summary: "Users API.",
      contract: emptyContract(),
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: [],
    },
  ],
  edges: [],
};

describe("POST /api/refactor/detect", () => {
  it("returns graph-scoped drift metadata", async () => {
    const response = await POST(
      new Request("http://localhost/api/refactor/detect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(graph),
      })
    );
    const body = await response.json() as {
      report: { totalIssues: number; provenance: string; maturity: string; scope: string };
    };

    expect(response.status).toBe(200);
    expect(body.report.totalIssues).toBeGreaterThan(0);
    expect(body.report.provenance).toBe("deterministic");
    expect(body.report.maturity).toBe("preview");
    expect(body.report.scope).toBe("graph");
  });

  it("returns 400 for an invalid request body", async () => {
    const response = await POST(
      new Request("http://localhost/api/refactor/detect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invalid: true }),
      })
    );
    const body = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
  });
});
