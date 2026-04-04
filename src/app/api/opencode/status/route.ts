import { NextResponse } from "next/server";
import { getOpencodeServerInfo } from "@/lib/opencode/server";

export async function GET() {
  try {
    const info = getOpencodeServerInfo();
    return NextResponse.json(info);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get server status" },
      { status: 500 }
    );
  }
}
