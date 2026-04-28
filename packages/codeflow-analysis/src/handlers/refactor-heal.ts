import { NextResponse } from "next/server";

import { detectDrift, healGraph } from "../refactor";
import { blueprintGraphSchema } from "@abhinav2203/codeflow-core/schema";

/**
 * POST /api/refactor/heal
 *
 * Body: {@link BlueprintGraph}
 *
 * Detects all drift issues, then auto-heals the graph:
 * removes broken edges, synthesises missing edges from contract calls,
 * and syncs node signatures to match their first contract method.
 *
 * Returns both the detection report and the healed graph.
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
        error: error instanceof Error ? error.message : "Failed to heal architectural drift.",
      },
      { status: 400 }
    );
  }
}
