import { NextResponse } from "next/server";
import { z } from "zod";

import { getCodeRag } from "@/lib/coderag";

const queryRequestSchema = z.object({
  query: z.string().trim().min(1, "Query string is required"),
  depth: z.number().int().min(1).max(6).optional()
});

export async function POST(request: Request) {
  try {
    const { query, depth = 2 } = queryRequestSchema.parse(await request.json());

    const codeRag = getCodeRag();

    if (!codeRag) {
      return NextResponse.json(
        { error: "CodeRag not initialized. Build or export a blueprint first." },
        { status: 400 }
      );
    }

    console.log("[CodeRag] Query:", query);
    const results = await codeRag.query(query, { depth });
    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid CodeRAG query request." },
        { status: 400 }
      );
    }

    console.error("[CodeRag] Query error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Query failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const codeRag = getCodeRag();

    if (!codeRag) {
      return NextResponse.json(
        { status: "not_initialized", message: "CodeRag not initialized. Build or export a blueprint first." },
        { status: 200 }
      );
    }

    const details = await codeRag.status();
    return NextResponse.json({
      status: "ready",
      message: "CodeRag is initialized and ready for queries",
      details
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Status check failed" },
      { status: 500 }
    );
  }
}
