import { NextResponse } from "next/server";

import { buildBlueprintGraph } from "@/lib/blueprint/build";
import { loadObservabilitySnapshot } from "@/lib/blueprint/store";
import { summarizeObservability } from "@/lib/blueprint/observability";
import { createRunPlan } from "@/lib/blueprint/plan";
import { buildBlueprintRequestSchema } from "@/lib/blueprint/schema";
import { createRunId, saveRunRecord, upsertSession } from "@/lib/blueprint/store";

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
