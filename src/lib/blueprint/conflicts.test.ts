import path from "node:path";

import { describe, expect, it } from "vitest";

import { detectGraphConflicts } from "@/lib/blueprint/conflicts";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

const fixturePath = path.resolve(process.cwd(), "src/lib/blueprint/test-fixtures/sample-repo");

describe("detectGraphConflicts", () => {
  it("finds signature mismatches and missing blueprint nodes", async () => {
    const graph: BlueprintGraph = {
      projectName: "Conflicts",
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

    const report = await detectGraphConflicts(graph, fixturePath);

    expect(report.conflicts.some((conflict) => conflict.kind === "signature-mismatch")).toBe(true);
    expect(report.conflicts.some((conflict) => conflict.kind === "missing-in-blueprint")).toBe(true);
  });
});
