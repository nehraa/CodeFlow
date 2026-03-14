import { NextResponse } from "next/server";

import { detectCycles } from "@/lib/blueprint/cycles";
import { blueprintGraphSchema } from "@/lib/blueprint/schema";

export async function POST(request: Request) {
  try {
    const payload = blueprintGraphSchema.parse(await request.json());
    const report = detectCycles(payload);

    return NextResponse.json({ report });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to detect dependency cycles."
      },
      { status: 400 }
    );
  }
}
