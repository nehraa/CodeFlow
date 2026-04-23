import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assessExportRisk } from "./index.js";
import type { BlueprintGraph, RunPlan } from "@abhinav2203/codeflow-core/schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_ROOT = path.join(__dirname, "../../.test-store");
// WORKSPACE_ROOT must be .test-store (NOT .test-store/artifacts) so that
// resolveDefaultOutputDir(graph) → <WORKSPACE_ROOT>/artifacts/<projectName>
// which matches where the test creates files.
const WORKSPACE_ROOT = path.join(__dirname, "../../.test-store");

const cleanStore = () => {
  try {
    fsSync.rmSync(STORE_ROOT, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors — best effort
  }
};

const withEnv = async <T>(fn: () => Promise<T>): Promise<T> => {
  const original = { store: process.env.CODEFLOW_STORE_ROOT, workspace: process.env.CODEFLOW_WORKSPACE_ROOT };
  process.env.CODEFLOW_STORE_ROOT = STORE_ROOT;
  process.env.CODEFLOW_WORKSPACE_ROOT = WORKSPACE_ROOT;
  try {
    return await fn();
  } finally {
    process.env.CODEFLOW_STORE_ROOT = original.store ?? "";
    process.env.CODEFLOW_WORKSPACE_ROOT = original.workspace ?? "";
    cleanStore();
  }
};

const makeGraph = (overrides: Partial<BlueprintGraph> = {}): BlueprintGraph => ({
  projectName: "test-project",
  mode: "essential",
  phase: "spec",
  generatedAt: new Date().toISOString(),
  nodes: [],
  edges: [],
  workflows: [],
  warnings: [],
  ...overrides
});

const makeRunPlan = (overrides: Partial<RunPlan> = {}): RunPlan => ({
  generatedAt: new Date().toISOString(),
  tasks: [],
  batches: [],
  warnings: [],
  ...overrides
});

describe("risk", () => {
  beforeEach(() => {
    cleanStore();
  });

  describe("assessExportRisk positional form (3 arguments)", () => {
    it("should work with positional arguments: assessExportRisk(graph, runPlan, outputDir)", async () => {
      await withEnv(async () => {
        const graph = makeGraph({ projectName: "positional-test" });
        const plan = makeRunPlan();
        const assessment = await assessExportRisk(graph, plan, "/tmp/positional-output");

        expect(assessment.riskReport).toBeDefined();
        expect(assessment.fingerprint).toBeDefined();
        expect(assessment.outputDir).toBe("/tmp/positional-output");
      });
    });

    it("should work with positional arguments and no outputDir", async () => {
      await withEnv(async () => {
        const graph = makeGraph({ projectName: "positional-no-outdir" });
        const plan = makeRunPlan();
        const assessment = await assessExportRisk(graph, plan);

        expect(assessment.riskReport).toBeDefined();
        expect(assessment.riskReport.level).toBe("low");
      });
    });
  });

  describe("assessExportRisk object form", () => {
    it("should work with object form: assessExportRisk({ graph, runPlan, outputDir })", async () => {
      await withEnv(async () => {
        const graph = makeGraph({ projectName: "object-form-test" });
        const plan = makeRunPlan();
        const assessment = await assessExportRisk({ graph, runPlan: plan, outputDir: "/tmp/object-output" });

        expect(assessment.riskReport).toBeDefined();
        expect(assessment.outputDir).toBe("/tmp/object-output");
      });
    });
  });

  describe("assessExportRisk error handling", () => {
    it("should throw clear error when called with null", async () => {
      await withEnv(async () => {
        await expect(
          assessExportRisk(null as any, makeRunPlan())
        ).rejects.toThrow(/graph must be a BlueprintGraph.*received null/i);
      });
    });

    it("should throw clear error when called with undefined", async () => {
      await withEnv(async () => {
        await expect(
          assessExportRisk(undefined as any, makeRunPlan())
        ).rejects.toThrow(/graph must be a BlueprintGraph/i);
      });
    });

    it("should throw clear error when object form uses 'plan' instead of 'runPlan'", async () => {
      await withEnv(async () => {
        const graph = makeGraph({ projectName: "wrong-key-test" });
        await expect(
          // @ts-expect-error — deliberately using wrong key 'plan' instead of 'runPlan'
          assessExportRisk({ graph, plan: makeRunPlan() })
        ).rejects.toThrow(/found key 'plan' but expected 'runPlan'/i);
      });
    });

    it("should throw clear error when graph lacks projectName", async () => {
      await withEnv(async () => {
        const badGraph = { projectName: undefined, mode: "essential", nodes: [], edges: [], workflows: [], warnings: [], generatedAt: "" } as any;
        await expect(
          assessExportRisk(badGraph, makeRunPlan())
        ).rejects.toThrow(/graph.projectName is required.*undefined/i);
      });
    });

    it("should throw clear error when runPlan is invalid", async () => {
      await withEnv(async () => {
        const graph = makeGraph({ projectName: "bad-runplan-test" });
        await expect(
          assessExportRisk(graph, { invalid: "runPlan" } as any)
        ).rejects.toThrow(/runPlan is required.*must be a RunPlan/i);
      });
    });

    it("should throw clear error when graph is a primitive string", async () => {
      await withEnv(async () => {
        await expect(
          assessExportRisk("graph" as any, makeRunPlan())
        ).rejects.toThrow(/graph must be a BlueprintGraph/i);
      });
    });

    it("should throw clear error when graph is a number", async () => {
      await withEnv(async () => {
        await expect(
          assessExportRisk(123 as any, makeRunPlan())
        ).rejects.toThrow(/graph must be a BlueprintGraph/i);
      });
    });
  });

  describe("assessExportRisk", () => {
    it("returns low risk for an empty blueprint with no output dir", async () => {
      await withEnv(async () => {
        const assessment = await assessExportRisk(makeGraph(), makeRunPlan());
        expect(assessment.riskReport.level).toBe("low");
        expect(assessment.riskReport.score).toBe(0);
        expect(assessment.riskReport.factors).toHaveLength(0);
      });
    });

    it("adds factor overwrite-existing-output (+4) when output dir has files", async () => {
      await withEnv(async () => {
        // Create existing output at <WORKSPACE_ROOT>/artifacts/<projectName>
        // (where resolveDefaultOutputDir resolves to when CODEFLOW_WORKSPACE_ROOT is set)
        await fs.mkdir(path.join(WORKSPACE_ROOT, "artifacts", "test-project"), { recursive: true });
        await fs.writeFile(
          path.join(WORKSPACE_ROOT, "artifacts", "test-project", "existing.ts"),
          "console.log('old')"
        );

        const assessment = await assessExportRisk(makeGraph(), makeRunPlan());
        const factor = assessment.riskReport.factors.find(
          (f) => f.code === "overwrite-existing-output"
        );

        expect(factor).toBeDefined();
        expect(factor!.score).toBe(4);
        expect(assessment.riskReport.score).toBeGreaterThanOrEqual(4);
      });
    });

    it("adds factor custom-output-dir (+1) when output dir is explicitly set", async () => {
      await withEnv(async () => {
        const assessment = await assessExportRisk(
          makeGraph(),
          makeRunPlan(),
          "/tmp/custom-output"
        );

        const factor = assessment.riskReport.factors.find(
          (f) => f.code === "custom-output-dir"
        );
        expect(factor).toBeDefined();
        expect(factor!.score).toBe(1);
      });
    });

    it("adds factor outside-workspace (+2) when output is outside workspace root", async () => {
      await withEnv(async () => {
        const assessment = await assessExportRisk(
          makeGraph(),
          makeRunPlan(),
          "/tmp/totally-unrelated-dir"
        );

        const factor = assessment.riskReport.factors.find(
          (f) => f.code === "outside-workspace"
        );
        expect(factor).toBeDefined();
        expect(factor!.score).toBe(2);
      });
    });

    it("adds factor repo-backed-context (+1) when nodes have repo sourceRefs", async () => {
      await withEnv(async () => {
        const graph = makeGraph({
          nodes: [
            {
              id: "n1",
              kind: "module",
              name: "auth",
              summary: "auth module",
              path: "src/auth.ts",
              contract: { summary: "", responsibilities: [], inputs: [], outputs: [], attributes: [], methods: [], sideEffects: [], errors: [], dependencies: [], calls: [], uiAccess: [], backendAccess: [], notes: [] },
              sourceRefs: [{ kind: "repo", path: "src/auth.ts" }],
              generatedRefs: [],
              traceRefs: [],
              status: "spec_only"
            }
          ]
        });

        const assessment = await assessExportRisk(graph, makeRunPlan());
        const factor = assessment.riskReport.factors.find(
          (f) => f.code === "repo-backed-context"
        );
        expect(factor).toBeDefined();
        expect(factor!.score).toBe(1);
      });
    });

    it("adds factor large-task-set (+2) when tasks >= 20", async () => {
      await withEnv(async () => {
        const tasks = Array.from({ length: 20 }, (_, i) => ({
          id: `task-${i}`,
          nodeId: `n${i}`,
          title: `Task ${i}`,
          kind: "module" as const,
          dependsOn: [],
          batchIndex: 0
        }));

        const runPlan = makeRunPlan({ tasks });
        const assessment = await assessExportRisk(makeGraph(), runPlan);

        const factor = assessment.riskReport.factors.find(
          (f) => f.code === "large-task-set"
        );
        expect(factor).toBeDefined();
        expect(factor!.score).toBe(2);
      });
    });

    it("adds factor deep-execution-plan (+1) when batches >= 6", async () => {
      await withEnv(async () => {
        const batches = Array.from({ length: 6 }, (_, i) => ({
          index: i,
          taskIds: [`task-${i}`]
        }));
        const tasks = batches.map((b, i) => ({
          id: `task-${i}`,
          nodeId: `n${i}`,
          title: `Task ${i}`,
          kind: "module" as const,
          dependsOn: [],
          batchIndex: b.index
        }));

        const runPlan = makeRunPlan({ tasks, batches });
        const assessment = await assessExportRisk(makeGraph(), runPlan);

        const factor = assessment.riskReport.factors.find(
          (f) => f.code === "deep-execution-plan"
        );
        expect(factor).toBeDefined();
        expect(factor!.score).toBe(1);
      });
    });

    it("adds factor yolo-mode (+2) when mode is yolo", async () => {
      await withEnv(async () => {
        const graph = makeGraph({ mode: "yolo" });
        const assessment = await assessExportRisk(graph, makeRunPlan());

        const factor = assessment.riskReport.factors.find(
          (f) => f.code === "yolo-mode"
        );
        expect(factor).toBeDefined();
        expect(factor!.score).toBe(2);
      });
    });

    it("returns correct risk level thresholds", async () => {
      await withEnv(async () => {
        // Score 0-2 → low
        let assessment = await assessExportRisk(makeGraph(), makeRunPlan());
        expect(assessment.riskReport.level).toBe("low");

        // Score 3-5 → medium (score 4: overwrite-existing-output)
        await fs.mkdir(path.join(WORKSPACE_ROOT, "artifacts", "test-project"), { recursive: true });
        await fs.writeFile(
          path.join(WORKSPACE_ROOT, "artifacts", "test-project", "file.ts"),
          "content"
        );
        assessment = await assessExportRisk(makeGraph(), makeRunPlan());
        expect(assessment.riskReport.level).toBe("medium");

        // Score 6+ → high (score 6: overwrite-existing-output + yolo-mode)
        const graph = makeGraph({ mode: "yolo" });
        await fs.writeFile(
          path.join(WORKSPACE_ROOT, "artifacts", "test-project", "another.ts"),
          "more content"
        );
        assessment = await assessExportRisk(graph, makeRunPlan());
        expect(assessment.riskReport.level).toBe("high");
      });
    });

    it("sets requiresApproval to true when essential mode + existing output", async () => {
      await withEnv(async () => {
        await fs.mkdir(path.join(WORKSPACE_ROOT, "artifacts", "test-project"), { recursive: true });
        await fs.writeFile(
          path.join(WORKSPACE_ROOT, "artifacts", "test-project", "file.ts"),
          "existing"
        );

        const assessment = await assessExportRisk(makeGraph({ mode: "essential" }), makeRunPlan());
        expect(assessment.riskReport.requiresApproval).toBe(true);
      });
    });

    it("sets requiresApproval to false when yolo mode", async () => {
      await withEnv(async () => {
        await fs.mkdir(path.join(WORKSPACE_ROOT, "artifacts", "test-project"), { recursive: true });
        await fs.writeFile(
          path.join(WORKSPACE_ROOT, "artifacts", "test-project", "file.ts"),
          "existing"
        );

        const assessment = await assessExportRisk(makeGraph({ mode: "yolo" }), makeRunPlan());
        expect(assessment.riskReport.requiresApproval).toBe(false);
      });
    });

    it("produces a consistent fingerprint for the same graph + plan + output", async () => {
      await withEnv(async () => {
        const graph = makeGraph();
        const plan = makeRunPlan();

        const a = await assessExportRisk(graph, plan, "/tmp/output");
        const b = await assessExportRisk(graph, plan, "/tmp/output");

        expect(a.fingerprint).toBe(b.fingerprint);
      });
    });

    it("produces a different fingerprint when graph changes", async () => {
      await withEnv(async () => {
        const graph1 = makeGraph();
        const graph2 = makeGraph({ projectName: "different-project" });
        const plan = makeRunPlan();

        const a = await assessExportRisk(graph1, plan);
        const b = await assessExportRisk(graph2, plan);

        expect(a.fingerprint).not.toBe(b.fingerprint);
      });
    });

    it("hasExistingOutput is true when output dir has files", async () => {
      await withEnv(async () => {
        await fs.mkdir(path.join(WORKSPACE_ROOT, "artifacts", "test-project"), { recursive: true });
        await fs.writeFile(
          path.join(WORKSPACE_ROOT, "artifacts", "test-project", "file.ts"),
          "content"
        );

        const assessment = await assessExportRisk(makeGraph(), makeRunPlan());
        expect(assessment.hasExistingOutput).toBe(true);
      });
    });

    it("hasExistingOutput is false when output dir does not exist", async () => {
      await withEnv(async () => {
        const assessment = await assessExportRisk(makeGraph(), makeRunPlan());
        expect(assessment.hasExistingOutput).toBe(false);
      });
    });
  });
});
