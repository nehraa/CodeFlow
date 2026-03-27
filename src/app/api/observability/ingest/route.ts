import { NextResponse } from "next/server";

import { observabilityIngestRequestSchema } from "@/lib/blueprint/schema";
import { summarizeObservability } from "@/lib/blueprint/observability";
import { mergeObservabilitySnapshot } from "@/lib/blueprint/observability-store";
import { loadLatestSession, upsertSession } from "@/lib/blueprint/session-store";

export async function POST(request: Request) {
  try {
    const payload = observabilityIngestRequestSchema.parse(await request.json());
    const session = await loadLatestSession(payload.projectName);
    const snapshot = await mergeObservabilitySnapshot({
      projectName: payload.projectName,
      spans: payload.spans,
      logs: payload.logs,
      graph: session?.graph
    });

    if (!session) {
      return NextResponse.json({ snapshot });
    }

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
      snapshot,
      session: updatedSession,
      latestSpans: summary.latestSpans,
      latestLogs: summary.latestLogs
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to ingest observability data."
      },
      { status: 400 }
    );
  }
}
