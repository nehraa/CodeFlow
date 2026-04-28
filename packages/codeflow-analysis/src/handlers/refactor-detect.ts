import { NextResponse } from "next/server";

import { detectDrift } from "../refactor";
import { blueprintGraphSchema } from "@abhinav2203/codeflow-core/schema";

/**
 * POST /api/refactor/detect
 *
 * Body: {@link BlueprintGraph}
 *
 * Returns a {@link RefactorReport} describing all detected drift issues:
 * broken edges, missing edges, and signature drift.
 */
export async function POST(request: Request) {
  try {
    const graph = blueprintGraphSchema.parse(await request.json());
    const report = detectDrift(graph);

    return NextResponse.json({ report });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to detect architectural drift.",
      },
      { status: 400 }
    );
  }
}
