import { NextResponse } from "next/server";

import { createRunPlan } from "@/lib/blueprint/plan";
import { markGraphConnected, markNodeVerified } from "@/lib/blueprint/phases";
import { runBlueprint } from "@/lib/blueprint/runner";
import { runtimeExecutionRequestSchema } from "@/lib/blueprint/schema";
import { upsertSession } from "@/lib/blueprint/store";

export async function POST(request: Request) {
  try {
    const payload = runtimeExecutionRequestSchema.parse(await request.json());
    const result = await runBlueprint(payload);
    const executedNodeId = result.executedNodeId;
    const verifiedGraph = executedNodeId
      ? markNodeVerified(payload.graph, executedNodeId, result)
      : payload.graph;
    const updatedGraph = !payload.targetNodeId && result.success ? markGraphConnected(verifiedGraph) : verifiedGraph;
    const runPlan = createRunPlan(updatedGraph);
    const session = await upsertSession({
      graph: updatedGraph,
      runPlan
    });

    return NextResponse.json({
      result: {
        success: result.success,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        executedPath: result.executedPath,
        error: result.error
      },
      executedNodeId,
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
