import { NextResponse } from "next/server";

import { computeGraphMetrics } from "@/lib/blueprint/metrics";
import { blueprintGraphSchema } from "@/lib/blueprint/schema";

export async function POST(request: Request) {
  try {
    const payload = blueprintGraphSchema.parse(await request.json());
    const metrics = computeGraphMetrics(payload);

    return NextResponse.json({ metrics });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to compute graph metrics."
      },
      { status: 400 }
    );
  }
}
