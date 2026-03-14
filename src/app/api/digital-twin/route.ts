import { NextResponse } from "next/server";

import { loadLatestSession, loadObservabilitySnapshot } from "@/lib/blueprint/store";
import { computeDigitalTwinSnapshot, overlayActiveNodes } from "@/lib/blueprint/digital-twin";

/**
 * GET /api/digital-twin?projectName=<name>&activeWindowSecs=<n>
 *
 * Returns the current Digital Twin snapshot for the given project:
 * - `snapshot`       – {@link DigitalTwinSnapshot} with active node IDs and inferred user flows.
 * - `graph`          – The blueprint graph with active nodes overlaid (so the canvas can light them up).
 * - `activeWindowSecs` – The time window used to determine "active" nodes.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectName = searchParams.get("projectName");
    const activeWindowParam = searchParams.get("activeWindowSecs");

    let activeWindowSecs = 60;
    if (activeWindowParam !== null) {
      const parsed = Number(activeWindowParam);
      if (Number.isFinite(parsed)) {
        activeWindowSecs = parsed >= 1 ? Math.floor(parsed) : 1;
      }
    }

    if (!projectName) {
      throw new Error("projectName is required.");
    }

    const [observabilitySnapshot, session] = await Promise.all([
      loadObservabilitySnapshot(projectName),
      loadLatestSession(projectName)
    ]);

    const spans = observabilitySnapshot?.spans ?? [];
    const graph = session?.graph ?? null;

    if (!graph) {
      return NextResponse.json({
        snapshot: null,
        graph: null,
        activeWindowSecs
      });
    }

    const snapshot = computeDigitalTwinSnapshot(graph, spans, activeWindowSecs);
    const overlaidGraph = overlayActiveNodes(graph, snapshot.activeNodeIds);

    return NextResponse.json({ snapshot, graph: overlaidGraph, activeWindowSecs });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load digital twin snapshot."
      },
      { status: 400 }
    );
  }
}
