import { NextResponse } from "next/server";
import { getCodeRag } from "@/lib/coderag";

export async function POST(request: Request) {
  try {
    const { query, depth = 2 } = await request.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query string is required" },
        { status: 400 }
      );
    }

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

    return NextResponse.json({ status: "ready", message: "CodeRag is initialized and ready for queries" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Status check failed" },
      { status: 500 }
    );
  }
}
