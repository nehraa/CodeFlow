import { NextResponse } from "next/server";

import { detectSmells } from "@/lib/blueprint/smells";
import { blueprintGraphSchema } from "@/lib/blueprint/schema";

export async function POST(request: Request) {
  try {
    const payload = blueprintGraphSchema.parse(await request.json());
    const report = detectSmells(payload);

    return NextResponse.json({ report });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to detect architecture smells."
      },
      { status: 400 }
    );
  }
}
