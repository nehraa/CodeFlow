import { NextResponse } from "next/server";

import { detectGraphConflicts } from "@/lib/blueprint/conflicts";
import { conflictCheckRequestSchema } from "@/lib/blueprint/schema";

export async function POST(request: Request) {
  try {
    const payload = conflictCheckRequestSchema.parse(await request.json());
    const report = await detectGraphConflicts(payload.graph, payload.repoPath);

    return NextResponse.json({ report });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to analyze graph conflicts."
      },
      { status: 400 }
    );
  }
}
