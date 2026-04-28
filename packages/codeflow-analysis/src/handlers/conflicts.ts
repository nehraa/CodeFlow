import { NextResponse } from "next/server";

import { detectGraphConflicts } from "../conflicts";
import { conflictCheckRequestSchema } from "@abhinav2203/codeflow-core/schema";

/**
 * POST /api/conflicts
 *
 * Body: { graph: BlueprintGraph, repoPath: string }
 *
 * Compares a blueprint graph against a live TypeScript repository,
 * detecting signature mismatches, summary mismatches, missing-in-repo
 * nodes, and missing-in-blueprint symbols.
 */
export async function POST(request: Request) {
  try {
    const payload = conflictCheckRequestSchema.parse(await request.json());
    const report = await detectGraphConflicts(payload.graph, payload.repoPath);

    return NextResponse.json({ report });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to analyze graph conflicts.",
      },
      { status: 400 }
    );
  }
}
