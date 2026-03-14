import { describe, expect, it } from "vitest";

import { buildBlueprintGraph } from "@/lib/blueprint/build";

describe("buildBlueprintGraph", () => {
  it("builds a graph from PRD input", async () => {
    const graph = await buildBlueprintGraph({
      projectName: "Sample Product",
      mode: "essential",
      prdText: `# UI
- Screen: Dashboard

# API
- POST /api/tasks

# Workflow
- Dashboard -> POST /api/tasks`,
      repoPath: undefined
    });

    expect(graph.projectName).toBe("Sample Product");
    expect(graph.nodes.some((node) => node.kind === "ui-screen" && node.name === "Dashboard")).toBe(true);
    expect(graph.nodes.some((node) => node.kind === "api" && node.name === "POST /api/tasks")).toBe(true);
    expect(graph.edges.some((edge) => edge.kind === "calls")).toBe(true);
  });
});
