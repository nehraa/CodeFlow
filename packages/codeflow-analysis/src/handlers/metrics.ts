import { NextResponse } from "next/server";

import { computeGraphMetrics } from "../metrics";
import { blueprintGraphSchema } from "@abhinav2203/codeflow-core/schema";

/**
 * POST /api/analysis/metrics
 *
 * Body: {@link BlueprintGraph}
 *
 * Returns structural graph metrics: node/edge counts, degree statistics,
 * density, connected components, and contract-level averages.
 */
export async function POST(request: Request) {
  try {
    const payload = blueprintGraphSchema.parse(await request.json());
    const metrics = computeGraphMetrics(payload);

    return NextResponse.json({ metrics });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to compute graph metrics.",
      },
      { status: 400 }
    );
  }
}
