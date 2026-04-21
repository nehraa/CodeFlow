import { describe, it, expect } from "vitest";
import { createSessionId } from "./session/index.js";
import { assessExportRisk } from "./risk/index.js";
import type { BlueprintGraph, RunPlan } from "@abhinav2203/codeflow-core/schema";

describe("codeflow-store", () => {
  describe("session", () => {
    it("creates a valid session ID", () => {
      const id = createSessionId();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  describe("risk", () => {
    it("assesses export risk for a minimal blueprint", async () => {
      const graph: BlueprintGraph = {
        projectName: "test-project",
        mode: "essential",
        generatedAt: new Date().toISOString(),
        nodes: [],
        edges: [],
        workflows: [],
        warnings: []
      };
      const runPlan: RunPlan = {
        generatedAt: new Date().toISOString(),
        tasks: [],
        batches: [],
        warnings: []
      };

      const assessment = await assessExportRisk(graph, runPlan);

      expect(assessment).toHaveProperty("fingerprint");
      expect(assessment).toHaveProperty("outputDir");
      expect(assessment).toHaveProperty("riskReport");
      expect(assessment.riskReport).toHaveProperty("score");
      expect(assessment.riskReport).toHaveProperty("level");
      expect(assessment.riskReport.level).toBe("low");
    });

    it("flags yolo mode in risk assessment", async () => {
      const graph: BlueprintGraph = {
        projectName: "yolo-test",
        mode: "yolo",
        generatedAt: new Date().toISOString(),
        nodes: [],
        edges: [],
        workflows: [],
        warnings: []
      };
      const runPlan: RunPlan = {
        generatedAt: new Date().toISOString(),
        tasks: [],
        batches: [],
        warnings: []
      };

      const assessment = await assessExportRisk(graph, runPlan);

      const yoloFactor = assessment.riskReport.factors.find((f) => f.code === "yolo-mode");
      expect(yoloFactor).toBeDefined();
      expect(yoloFactor?.score).toBe(2);
    });
  });
});
