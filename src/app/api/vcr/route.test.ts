import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { GET } from "@/app/api/vcr/route";
import { mergeObservabilitySnapshot, upsertSession } from "@/lib/blueprint/store";
import type { BlueprintGraph, RunPlan } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

const createdDirs: string[] = [];

const graph: BlueprintGraph = {
  projectName: "VCR Route Test",
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
      contract: emptyContract(),
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    }
  ],
  edges: []
};

const runPlan: RunPlan = {
  generatedAt: "2026-03-26T00:00:00.000Z",
  tasks: [],
  batches: [],
  warnings: []
};

afterEach(async () => {
  await Promise.all(createdDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  createdDirs.length = 0;
  delete process.env.CODEFLOW_STORE_ROOT;
});

describe("GET /api/vcr", () => {
  it("returns a recording when spans exist", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-vcr-route-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;

    await upsertSession({
      sessionId: "session-vcr",
      graph,
      runPlan
    });
    await mergeObservabilitySnapshot({
      projectName: graph.projectName,
      graph,
      spans: [
        {
          spanId: "span-1",
          traceId: "trace-1",
          name: "authenticate",
          blueprintNodeId: "function:auth",
          status: "success",
          durationMs: 12,
          runtime: "node",
          provenance: "observed",
          timestamp: "2026-03-26T00:00:01.000Z"
        }
      ],
      logs: []
    });

    const response = await GET(
      new NextRequest(`http://localhost/api/vcr?projectName=${encodeURIComponent(graph.projectName)}`)
    );
    const body = (await response.json()) as { recording: { totalSpans: number; frames: Array<{ nodeId?: string }> } };

    expect(response.status).toBe(200);
    expect(body.recording.totalSpans).toBe(1);
    expect(body.recording.frames[0]?.nodeId).toBe("function:auth");
  });

  it("returns 404 when no spans are stored", async () => {
    const storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-vcr-route-empty-"));
    createdDirs.push(storeRoot);
    process.env.CODEFLOW_STORE_ROOT = storeRoot;

    await upsertSession({
      sessionId: "session-vcr-empty",
      graph,
      runPlan
    });

    const response = await GET(
      new NextRequest(`http://localhost/api/vcr?projectName=${encodeURIComponent(graph.projectName)}`)
    );

    expect(response.status).toBe(404);
  });
});
