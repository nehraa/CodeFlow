import { NextResponse } from "next/server";
import { z } from "zod";
import { computeDiff } from "@abhinav2203/codeflow-versioning/diff";
import { blueprintGraphSchema } from "@abhinav2203/codeflow-core/schema";

const diffRequestSchema = z.object({
  baseGraph: blueprintGraphSchema,
  compareGraph: blueprintGraphSchema,
  baseId: z.string().optional(),
  compareId: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const payload = diffRequestSchema.parse(await request.json());
    const diff = await computeDiff(
      {
        baseGraph: payload.baseGraph,
        compareGraph: payload.compareGraph,
        baseId: payload.baseId ?? "base",
        compareId: payload.compareId ?? "compare"
      }
    );

    return NextResponse.json({ diff });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute branch diff." },
      { status: 400 }
    );
  }
}
