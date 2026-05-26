import { NextRequest, NextResponse } from "next/server";

import { buildVcrRecording } from "@abhinav2203/codeflow-execution/vcr";
import { loadObservabilitySnapshot } from "@abhinav2203/codeflow-store/observability";
import { loadLatestSession } from "@abhinav2203/codeflow-store/session";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const projectName = request.nextUrl.searchParams.get("projectName");

  if (!projectName || !projectName.trim()) {
    return NextResponse.json({ error: "projectName query parameter is required." }, { status: 400 });
  }

  const [snapshot, session] = await Promise.all([
    loadObservabilitySnapshot(projectName.trim()),
    loadLatestSession(projectName.trim())
  ]);

  const graph = snapshot?.graph ?? session?.graph;

  if (!graph) {
    return NextResponse.json(
      { error: "No blueprint graph found for this project. Build a blueprint first." },
      { status: 404 }
    );
  }

  const spans = snapshot?.spans ?? [];

  if (spans.length === 0) {
    return NextResponse.json(
      { error: "No trace spans recorded yet. Ingest some observability data first." },
      { status: 404 }
    );
  }

  const recording = buildVcrRecording(graph, spans);
  return NextResponse.json({ recording });
};