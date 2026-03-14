import { NextResponse } from "next/server";

import { blueprintGraphSchema } from "@/lib/blueprint/schema";
import { detectDrift, healGraph } from "@/lib/blueprint/refactor";

/**
 * POST /api/refactor/heal
 *
 * Body: {@link BlueprintGraph}
 *
 * Detects all drift issues in the supplied graph, then auto-heals them:
 * - Removes broken edges.
 * - Synthesises missing edges from contract call definitions.
 * - Syncs node top-level signatures to match their first contract method.
 *
 * Returns `{ report, result }` where `result.graph` is the healed graph.
 */
export async function POST(request: Request) {
  try {
    const graph = blueprintGraphSchema.parse(await request.json());
    const report = detectDrift(graph);
    const result = healGraph(graph, report);

    return NextResponse.json({ report, result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to heal architectural drift."
      },
      { status: 400 }
    );
  }
}
