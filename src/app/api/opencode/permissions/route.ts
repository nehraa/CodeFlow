import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpencodeServerInfo } from "@/lib/opencode/server";

/**
 * GET /api/opencode/permissions - List pending permission requests
 */
export async function GET() {
  try {
    const serverInfo = getOpencodeServerInfo();
    
    if (serverInfo.status !== "running" || !serverInfo.url) {
      return NextResponse.json({
        permissions: [],
        error: "OpenCode server is not running"
      });
    }
    
    const response = await fetch(`${serverInfo.url}/permission`, {
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        permissions: [],
        error: `Failed to fetch permissions: ${errorText}`
      });
    }
    
    const permissions = await response.json();
    
    return NextResponse.json({ permissions });
  } catch (error) {
    return NextResponse.json(
      { permissions: [], error: error instanceof Error ? error.message : "Failed to list permissions" },
      { status: 500 }
    );
  }
}

const replySchema = z.object({
  requestId: z.string().min(1),
  reply: z.enum(["yes", "no", "always", "never"]),
  message: z.string().optional(),
});

/**
 * POST /api/opencode/permissions - Reply to a permission request
 */
export async function POST(request: Request) {
  try {
    const body = replySchema.parse(await request.json());
    
    const serverInfo = getOpencodeServerInfo();
    
    if (serverInfo.status !== "running" || !serverInfo.url) {
      return NextResponse.json(
        { success: false, error: "OpenCode server is not running" },
        { status: 503 }
      );
    }
    
    const response = await fetch(`${serverInfo.url}/permission/${body.requestId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reply: body.reply,
        message: body.message,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { success: false, error: `Failed to reply to permission: ${errorText}` },
        { status: response.status }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid request body", details: error.issues },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to reply to permission" },
      { status: 500 }
    );
  }
}
