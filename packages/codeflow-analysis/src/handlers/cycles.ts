import { NextResponse } from "next/server";

import { detectCycles, hasCycles } from "../cycles";
import { blueprintGraphSchema } from "@abhinav2203/codeflow-core/schema";

/**
 * POST /api/analysis/cycles
 *
 * Body: {@link BlueprintGraph}
 *
 * Returns a cycle detection report for the submitted blueprint graph.
 * Includes total cycle count, affected node IDs, per-cycle edge details,
 * and a convenience `hasCycles` boolean.
 */
export async function POST(request: Request) {
  try {
    const payload = blueprintGraphSchema.parse(await request.json());
    const report = detectCycles(payload);

    return NextResponse.json({ report: { ...report, hasCycles: hasCycles(payload) } });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to detect dependency cycles.",
      },
      { status: 400 }
    );
  }
}
