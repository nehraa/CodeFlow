import { NextResponse } from "next/server";

import { createExecutionReport } from "@/lib/blueprint/execute";
import { createRunPlan } from "@/lib/blueprint/plan";
import { applyExecutionResultToGraph } from "@/lib/blueprint/phases";
import { runBlueprint } from "@/lib/blueprint/runner";
import { runtimeExecutionRequestSchema } from "@/lib/blueprint/schema";
import { upsertSession } from "@/lib/blueprint/session-store";

export async function POST(request: Request) {
  try {
    const payload = runtimeExecutionRequestSchema.parse(await request.json());
    const result = await runBlueprint(payload);
    const updatedGraph = applyExecutionResultToGraph(payload.graph, result, {
      integrationRun: !payload.targetNodeId
    });
    const runPlan = createRunPlan(updatedGraph);
    const executionReport = {
      ...createExecutionReport(updatedGraph, runPlan),
      steps: result.steps,
      artifacts: result.artifacts,
      summary: result.summary
    };
    const session = await upsertSession({
      graph: updatedGraph,
      runPlan,
      lastExecutionReport: executionReport
    });

    return NextResponse.json({
      result,
      executedNodeId: result.executedNodeId,
      graph: updatedGraph,
      runPlan,
      session
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to execute code."
      },
      { status: 400 }
    );
  }
}
