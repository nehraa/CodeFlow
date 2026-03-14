import { NextResponse } from "next/server";
import { z } from "zod";

import { listMcpTools } from "@/lib/blueprint/mcp";

const requestSchema = z.object({
  serverUrl: z.string().min(1),
  headers: z.record(z.string(), z.string()).optional()
});

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = requestSchema.parse(await request.json());

    console.info("[CodeFlow] MCP list tools request", { serverUrl: body.serverUrl });

    const tools = await listMcpTools(body.serverUrl, body.headers);

    return NextResponse.json({ tools });
  } catch (error) {
    console.error("[CodeFlow] Failed to list MCP tools", {
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error"
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list MCP tools." },
      { status: 400 }
    );
  }
}
