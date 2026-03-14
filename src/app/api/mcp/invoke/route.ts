import { NextResponse } from "next/server";
import { z } from "zod";

import { invokeMcpTool } from "@/lib/blueprint/mcp";

const requestSchema = z.object({
  serverUrl: z.string().min(1),
  toolName: z.string().min(1),
  args: z.record(z.string(), z.unknown()).default({}),
  headers: z.record(z.string(), z.string()).optional()
});

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = requestSchema.parse(await request.json());

    console.info("[CodeFlow] MCP invoke tool request", {
      serverUrl: body.serverUrl,
      toolName: body.toolName
    });

    const result = await invokeMcpTool(body.serverUrl, body.toolName, body.args, body.headers);

    return NextResponse.json({ result });
  } catch (error) {
    console.error("[CodeFlow] Failed to invoke MCP tool", {
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error"
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to invoke MCP tool." },
      { status: 400 }
    );
  }
}
