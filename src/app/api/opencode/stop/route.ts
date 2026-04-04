import { NextResponse } from "next/server";
import { stopOpencodeServer } from "@/lib/opencode/server";

export async function POST() {
  try {
    await stopOpencodeServer();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to stop server" },
      { status: 500 }
    );
  }
}
