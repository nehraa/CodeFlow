import { NextResponse } from "next/server";

import { buildBlueprintGraph } from "@/lib/blueprint/build";
import { summarizeObservability } from "@/lib/blueprint/observability";
import { loadObservabilitySnapshot } from "@/lib/blueprint/observability-store";
import { createRunPlan } from "@/lib/blueprint/plan";
import { buildBlueprintRequestSchema } from "@/lib/blueprint/schema";
import { createRunId, saveRunRecord } from "@/lib/blueprint/run-store";
import { upsertSession } from "@/lib/blueprint/session-store";

export async function POST(request: Request) {
  try {
    const payload = buildBlueprintRequestSchema.parse(await request.json());
    const baseGraph = await buildBlueprintGraph(payload);
    const snapshot = await loadObservabilitySnapshot(baseGraph.projectName);
    const graph = snapshot ? summarizeObservability(baseGraph, snapshot).graph : baseGraph;
    const runPlan = createRunPlan(graph);
    const session = await upsertSession({
      graph,
      runPlan
    });

    await saveRunRecord({
      id: createRunId(),
      projectName: graph.projectName,
      action: "build",
      createdAt: new Date().toISOString(),
      runPlan
    });

    return NextResponse.json({ graph, runPlan, session });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to build blueprint."
      },
      { status: 400 }
    );
  }
}
