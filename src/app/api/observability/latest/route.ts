import { NextResponse } from "next/server";

import { loadLatestSession, loadObservabilitySnapshot } from "@/lib/blueprint/store";
import { summarizeObservability } from "@/lib/blueprint/observability";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectName = searchParams.get("projectName");

    if (!projectName) {
      throw new Error("projectName is required.");
    }

    const snapshot = await loadObservabilitySnapshot(projectName);
    const session = await loadLatestSession(projectName);
    if (!snapshot) {
      return NextResponse.json({ snapshot: null, graph: session?.graph ?? null, latestSpans: [], latestLogs: [] });
    }

    const summary =
      session?.graph ? summarizeObservability(session.graph, snapshot) : { graph: session?.graph ?? null, latestSpans: snapshot.spans, latestLogs: snapshot.logs };

    return NextResponse.json({
      snapshot,
      graph: summary.graph,
      latestSpans: summary.latestSpans.slice(0, 10),
      latestLogs: summary.latestLogs.slice(0, 10)
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load observability snapshot."
      },
      { status: 400 }
    );
  }
}
