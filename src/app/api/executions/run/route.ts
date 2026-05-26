import { NextResponse } from "next/server";

import { runBlueprint } from "@abhinav2203/codeflow-execution";
import { createRunPlan } from "@abhinav2203/codeflow-execution/plan";
import { applyExecutionResultToGraph } from "@abhinav2203/codeflow-execution/phases";
import { runtimeExecutionRequestSchema } from "@abhinav2203/codeflow-core/schema";
import { upsertSession } from "@abhinav2203/codeflow-store/session";

export async function POST(request: Request) {
  try {
    const payload = runtimeExecutionRequestSchema.parse(await request.json());
    const result = await runBlueprint(payload);
    const updatedGraph = applyExecutionResultToGraph(payload.graph, result, {
      integrationRun: !payload.targetNodeId
    });
    const runPlan = createRunPlan(updatedGraph);
    const session = await upsertSession({
      graph: updatedGraph,
      runPlan
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