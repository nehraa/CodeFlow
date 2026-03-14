import { NextResponse } from "next/server";

import { z } from "zod";

import { diffBranches } from "@/lib/blueprint/branches";
import { blueprintGraphSchema } from "@/lib/blueprint/schema";

const diffRequestSchema = z.object({
  baseGraph: blueprintGraphSchema,
  compareGraph: blueprintGraphSchema,
  baseId: z.string().optional(),
  compareId: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const payload = diffRequestSchema.parse(await request.json());
    const diff = diffBranches(
      payload.baseGraph,
      payload.compareGraph,
      payload.baseId ?? "base",
      payload.compareId ?? "compare"
    );

    return NextResponse.json({ diff });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute branch diff." },
      { status: 400 }
    );
  }
}
