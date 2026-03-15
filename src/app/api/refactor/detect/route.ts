import { NextResponse } from "next/server";

import { blueprintGraphSchema } from "@/lib/blueprint/schema";
import { detectDrift } from "@/lib/blueprint/refactor";

/**
 * POST /api/refactor/detect
 *
 * Body: {@link BlueprintGraph}
 *
 * Returns a {@link RefactorReport} that describes all detected drift issues:
 * - broken edges (referencing non-existent node IDs)
 * - missing edges (contract calls with no corresponding graph edge)
 * - signature drift (top-level node signature differs from first contract method)
 */
export async function POST(request: Request) {
  try {
    const graph = blueprintGraphSchema.parse(await request.json());
    const report = detectDrift(graph);

    return NextResponse.json({ report });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to detect architectural drift."
      },
      { status: 400 }
    );
  }
}
