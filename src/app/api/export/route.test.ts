import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { POST as approvePOST } from "@/app/api/approvals/approve/route";
import { POST } from "@/app/api/export/route";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

const createdDirs: string[] = [];

const graph: BlueprintGraph = {
  projectName: "Route Exporter",
  mode: "essential",
  generatedAt: "2026-03-13T00:00:00.000Z",
  warnings: [],
  workflows: [],
  edges: [],
  nodes: [
    {
      id: "function:ping",
      kind: "function",
      name: "ping(input: string): string",
      summary: "Return a response string.",
      signature: "ping(input: string): string",
      contract: {
        ...emptyContract(),
        summary: "Return a response string.",
        inputs: [{ name: "input", type: "string" }],
        outputs: [{ name: "result", type: "string" }]
      },
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    }
  ]
};

afterEach(async () => {
  await Promise.all(
    createdDirs.map(async (directory) => {
      await fs.rm(directory, { recursive: true, force: true });
    })
  );
  createdDirs.length = 0;
  delete process.env.CODEFLOW_STORE_ROOT;
  delete process.env.CODEFLOW_WORKSPACE_ROOT;
});

describe("POST /api/export", () => {
  it("exports blueprint artifacts to disk when no approval is required", async () => {
    const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-route-export-"));
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-route-store-"));
    createdDirs.push(targetDir, storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;
    process.env.CODEFLOW_WORKSPACE_ROOT = path.dirname(targetDir);

    const response = await POST(
      new Request("http://localhost/api/export", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          graph,
          outputDir: targetDir
        })
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      result: { blueprintPath: string; phaseManifestPath?: string };
      riskReport: { requiresApproval: boolean };
      runPlan: { tasks: Array<{ title: string }> };
      executionReport: { results: Array<{ status: string }> };
    };
    const output = await fs.readFile(body.result.blueprintPath, "utf8");
    const manifest = await fs.readFile(body.result.phaseManifestPath ?? "", "utf8");

    expect(output).toContain("\"projectName\": \"Route Exporter\"");
    expect(manifest).toContain('"phase": "spec"');
    expect(body.riskReport.requiresApproval).toBe(false);
    expect(body.runPlan.tasks.length).toBeGreaterThan(0);
    expect(body.executionReport.results[0].status).toBe("completed");
  });

  it("requires approval before overwriting an existing directory in essential mode", async () => {
    const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-route-export-approval-"));
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-route-store-approval-"));
    createdDirs.push(targetDir, storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;
    process.env.CODEFLOW_WORKSPACE_ROOT = path.dirname(targetDir);
    await fs.writeFile(path.join(targetDir, "existing.txt"), "present", "utf8");

    const approvalResponse = await POST(
      new Request("http://localhost/api/export", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          graph,
          outputDir: targetDir
        })
      })
    );
    const approvalBody = (await approvalResponse.json()) as {
      requiresApproval: boolean;
      approval: { id: string };
    };

    expect(approvalBody.requiresApproval).toBe(true);

    const approvedResponse = await approvePOST(
      new Request("http://localhost/api/approvals/approve", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          approvalId: approvalBody.approval.id
        })
      })
    );
    expect(approvedResponse.status).toBe(200);

    const exportResponse = await POST(
      new Request("http://localhost/api/export", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          graph,
          outputDir: targetDir,
          approvalId: approvalBody.approval.id
        })
      })
    );
    const exportBody = (await exportResponse.json()) as {
      result: { blueprintPath: string; checkpointDir?: string };
      riskReport: { requiresApproval: boolean };
    };
    const checkpointCopy = await fs.readFile(path.join(exportBody.result.checkpointDir ?? "", "existing.txt"), "utf8");

    expect(exportResponse.status).toBe(200);
    expect(checkpointCopy).toBe("present");
    expect(exportBody.riskReport.requiresApproval).toBe(true);
  });

  it("runs yolo exports through a sandbox and returns a diff manifest", async () => {
    const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-route-export-yolo-"));
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-route-store-yolo-"));
    createdDirs.push(targetDir, storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;
    process.env.CODEFLOW_WORKSPACE_ROOT = path.dirname(targetDir);

    const yoloGraph: BlueprintGraph = {
      ...graph,
      mode: "yolo",
      projectName: "Yolo Exporter"
    };

    const response = await POST(
      new Request("http://localhost/api/export", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          graph: yoloGraph,
          outputDir: targetDir
        })
      })
    );
    const body = (await response.json()) as {
      result: { diffPath?: string; sandboxDir?: string; blueprintPath: string; integrationEntrypointPath?: string };
      riskReport: { requiresApproval: boolean };
    };
    const diff = await fs.readFile(body.result.diffPath ?? "", "utf8");

    expect(response.status).toBe(200);
    expect(body.result.sandboxDir).toBeTruthy();
    expect(diff).toContain("\"status\": \"added\"");
    expect(body.riskReport.requiresApproval).toBe(false);
  });

  it("writes an integration entrypoint when exporting an integration-phase graph", async () => {
    const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-route-export-integration-"));
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-route-store-integration-"));
    createdDirs.push(targetDir, storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;
    process.env.CODEFLOW_WORKSPACE_ROOT = path.dirname(targetDir);

    const integrationGraph: BlueprintGraph = {
      ...graph,
      phase: "integration",
      workflows: [{ name: "Main", steps: ["ping(input: string): string"] }],
      nodes: graph.nodes.map((node) => ({
        ...node,
        status: "connected",
        implementationDraft: "export function ping(input: string) { return `pong:${input}`; }"
      }))
    };

    const response = await POST(
      new Request("http://localhost/api/export", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          graph: integrationGraph,
          outputDir: targetDir
        })
      })
    );
    const body = (await response.json()) as {
      result: { integrationEntrypointPath?: string };
    };
    const entrypoint = await fs.readFile(body.result.integrationEntrypointPath ?? "", "utf8");

    expect(response.status).toBe(200);
    expect(entrypoint).toContain("runIntegration");
    expect(entrypoint).toContain("integrationRoot");
  });
});
