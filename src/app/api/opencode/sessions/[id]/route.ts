import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpencodeServerInfo } from "@/lib/opencode/server";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/opencode/sessions/[id] - Get session details
 */
export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const params = await context.params;
    const sessionId = params.id;
    
    const serverInfo = getOpencodeServerInfo();
    
    if (serverInfo.status !== "running" || !serverInfo.url) {
      return NextResponse.json(
        { error: "OpenCode server is not running" },
        { status: 503 }
      );
    }
    
    const response = await fetch(`${serverInfo.url}/session/${sessionId}`, {
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Failed to fetch session: ${errorText}` },
        { status: response.status }
      );
    }
    
    const session = await response.json();
    
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch session" },
      { status: 500 }
    );
  }
}

const messageSchema = z.object({
  message: z.string().min(1),
});

/**
 * POST /api/opencode/sessions/[id] - Send message to session
 */
export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const params = await context.params;
    const sessionId = params.id;
    const body = messageSchema.parse(await request.json());
    
    const serverInfo = getOpencodeServerInfo();
    
    if (serverInfo.status !== "running" || !serverInfo.url) {
      return NextResponse.json(
        { error: "OpenCode server is not running" },
        { status: 503 }
      );
    }
    
    const response = await fetch(`${serverInfo.url}/session/${sessionId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parts: [{ type: "text", text: body.message }],
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Failed to send message: ${errorText}` },
        { status: response.status }
      );
    }
    
    const responseText = await response.text();
    
    try {
      const parsed = JSON.parse(responseText);
      return NextResponse.json({ response: parsed });
    } catch {
      return NextResponse.json({ response: responseText });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.issues },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send message" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/opencode/sessions/[id] - Delete session
 */
export async function DELETE(
  request: Request,
  context: RouteContext
) {
  try {
    const params = await context.params;
    const sessionId = params.id;
    
    const serverInfo = getOpencodeServerInfo();
    
    if (serverInfo.status !== "running" || !serverInfo.url) {
      return NextResponse.json(
        { error: "OpenCode server is not running" },
        { status: 503 }
      );
    }
    
    const response = await fetch(`${serverInfo.url}/session/${sessionId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Failed to delete session: ${errorText}` },
        { status: response.status }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete session" },
      { status: 500 }
    );
  }
}
