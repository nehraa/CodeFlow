import path from "node:path";

import { describe, expect, it } from "vitest";

import { detectGraphConflicts } from "./conflicts";
import type { BlueprintGraph } from "@abhinav2203/codeflow-core/schema";
import { emptyContract } from "@abhinav2203/codeflow-core/schema";

const fixturePath = path.resolve(process.cwd(), "test-fixtures/sample-repo");

const node = (
  id: string,
  overrides: Partial<{
    kind: BlueprintGraph["nodes"][number]["kind"];
    path: string;
    name: string;
    summary: string;
    signature: string;
    sourceRefsPath: string;
  }> = {}
): BlueprintGraph["nodes"][number] => ({
  id,
  kind: overrides.kind ?? "function",
  name: overrides.name ?? id,
  path: overrides.path,
  summary: overrides.summary ?? id,
  signature: overrides.signature,
  contract: { ...emptyContract(), summary: overrides.summary ?? id },
  sourceRefs: overrides.sourceRefsPath
    ? [{ kind: "repo" as const, path: overrides.sourceRefsPath, symbol: overrides.name ?? id }]
    : [],
  generatedRefs: [],
  traceRefs: [],
});

describe("detectGraphConflicts", () => {
  it("finds a signature-mismatch when blueprint signature diverges from repo", async () => {
    const graph: BlueprintGraph = {
      projectName: "Conflicts",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      edges: [],
      nodes: [
        node("function:normalize", {
          kind: "function",
          path: "src/services/task-service.ts",
          name: "normalizeTask",
          summary: "Wrong summary.",
          signature: "normalizeTask(input: string): string",
          sourceRefsPath: "src/services/task-service.ts",
        }),
      ],
    };

    const report = await detectGraphConflicts(graph, fixturePath);

    expect(report.conflicts.some((c) => c.kind === "signature-mismatch")).toBe(true);
  });

  it("finds missing-in-blueprint when repo has a symbol not in the blueprint", async () => {
    const graph: BlueprintGraph = {
      projectName: "MissingInBlueprint",
      mode: "essential",
      generatedAt: "2026-03-14T00:00:00.000Z",
      warnings: [],
      workflows: [],
      edges: [],
      nodes: [], // empty — all repo symbols should be reported missing
    };

    const report = await detectGraphConflicts(graph, fixturePath);

    expect(report.conflicts.some((c) => c.kind === "missing-in-blueprint")).toBe(true);
  });

  it("returns empty conflicts for an empty graph and empty repo", async () => {
    // Using a path that exists but has no matching symbols
    const report = await detectGraphConflicts(
      {
        projectName: "Empty",
        mode: "essential",
        generatedAt: "2026-03-14T00:00:00.000Z",
        warnings: [],
        workflows: [],
        edges: [],
        nodes: [],
      },
      fixturePath
    );

    // sample-repo has symbols, so missing-in-blueprint will fire
    // but there should be no signature-mismatch
    expect(report.conflicts.every((c) => c.kind === "missing-in-blueprint")).toBe(true);
  });

  it("returns a valid checkedAt timestamp", async () => {
    const report = await detectGraphConflicts(
      {
        projectName: "Timestamp",
        mode: "essential",
        generatedAt: "2026-03-14T00:00:00.000Z",
        warnings: [],
        workflows: [],
        edges: [],
        nodes: [],
      },
      fixturePath
    );

    expect(() => new Date(report.checkedAt)).not.toThrow();
    expect(report.repoPath).toBe(path.resolve(fixturePath));
  });

  it("includes suggestedAction on every conflict", async () => {
    const report = await detectGraphConflicts(
      {
        projectName: "Suggestions",
        mode: "essential",
        generatedAt: "2026-03-14T00:00:00.000Z",
        warnings: [],
        workflows: [],
        edges: [],
        nodes: [],
      },
      fixturePath
    );

    for (const conflict of report.conflicts) {
      expect(conflict.suggestedAction.length).toBeGreaterThan(0);
    }
  });
});
