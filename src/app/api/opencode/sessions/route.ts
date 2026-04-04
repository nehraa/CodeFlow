import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpencodeServerInfo } from "@/lib/opencode/server";

/**
 * GET /api/opencode/sessions - List OpenCode sessions
 */
export async function GET(request: Request) {
  try {
    const serverInfo = getOpencodeServerInfo();
    
    if (serverInfo.status !== "running" || !serverInfo.url) {
      return NextResponse.json({
        sessions: [],
        error: "OpenCode server is not running"
      });
    }
    
    const url = new URL(request.url);
    const limit = url.searchParams.get("limit") ?? "10";
    
    const response = await fetch(`${serverInfo.url}/session?limit=${limit}`, {
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        sessions: [],
        error: `Failed to fetch sessions: ${errorText}`
      });
    }
    
    const sessions = await response.json();
    
    return NextResponse.json({ sessions });
  } catch (error) {
    return NextResponse.json(
      { sessions: [], error: error instanceof Error ? error.message : "Failed to list sessions" },
      { status: 500 }
    );
  }
}

const createSessionSchema = z.object({
  title: z.string().optional(),
  agent: z.enum(["build", "plan"]).optional().default("build"),
  cwd: z.string().optional(),
});

/**
 * POST /api/opencode/sessions - Create a new OpenCode session
 */
export async function POST(request: Request) {
  try {
    const body = createSessionSchema.parse(await request.json());
    
    const serverInfo = getOpencodeServerInfo();
    
    if (serverInfo.status !== "running" || !serverInfo.url) {
      return NextResponse.json(
        { error: "OpenCode server is not running" },
        { status: 503 }
      );
    }
    
    const response = await fetch(`${serverInfo.url}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Failed to create session: ${errorText}` },
        { status: response.status }
      );
    }
    
    const session = await response.json();
    
    return NextResponse.json({ session });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.issues },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create session" },
      { status: 500 }
    );
  }
}
