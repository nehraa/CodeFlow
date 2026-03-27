import { NextResponse } from "next/server";

import { simulateActionRequestSchema, traceSpanSchema } from "@/lib/blueprint/schema";
import { buildSimulationSpans } from "@/lib/blueprint/digital-twin";
import { summarizeObservability } from "@/lib/blueprint/observability";
import { mergeObservabilitySnapshot } from "@/lib/blueprint/observability-store";
import { loadLatestSession, upsertSession } from "@/lib/blueprint/session-store";

/**
 * POST /api/digital-twin/simulate
 *
 * Simulates a user action by generating synthetic trace spans for each
 * requested node and ingesting them into the project's observability snapshot.
 * The response contains the updated snapshot and graph so the UI can
 * immediately reflect the simulated traffic.
 *
 * Request body: {@link SimulateActionRequest}
 */
export async function POST(request: Request) {
  try {
    const payload = simulateActionRequestSchema.parse(await request.json());
    const session = await loadLatestSession(payload.projectName);

    if (!session) {
      return NextResponse.json(
        { error: "No session found for the given project. Build a blueprint first." },
        { status: 404 }
      );
    }

    const spans = buildSimulationSpans(
      session.graph,
      payload.nodeIds,
      payload.label,
      payload.runtime
    ).map((span) => traceSpanSchema.parse(span));

    const snapshot = await mergeObservabilitySnapshot({
      projectName: payload.projectName,
      spans,
      logs: [],
      graph: session.graph
    });

    const summary = summarizeObservability(session.graph, snapshot);

    const updatedSession = await upsertSession({
      graph: summary.graph,
      runPlan: session.runPlan,
      lastRiskReport: session.lastRiskReport,
      lastExportResult: session.lastExportResult,
      lastExecutionReport: session.lastExecutionReport,
      sessionId: session.sessionId
    });

    return NextResponse.json({
      spans,
      snapshot,
      session: updatedSession,
      latestSpans: summary.latestSpans,
      latestLogs: summary.latestLogs
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to simulate user action."
      },
      { status: 400 }
    );
  }
}
