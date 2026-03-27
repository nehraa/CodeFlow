import { NextResponse } from "next/server";
import { z } from "zod";

import { listMcpTools } from "@/lib/blueprint/mcp";

const requestSchema = z.object({
  serverUrl: z.string().min(1),
  headers: z.record(z.string(), z.string()).optional()
});

function validateServerUrl(serverUrl: string): void {
  let url: URL;
  try {
    url = new URL(serverUrl);
  } catch {
    throw new Error("Invalid serverUrl: not a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Invalid serverUrl: only http and https protocols are allowed.");
  }
}

const ALLOWED_FORWARD_HEADERS = new Set<string>([
  "authorization",
  "x-api-key",
  "x-request-id",
  "user-agent",
  "accept",
  "content-type"
]);

function filterForwardableHeaders(
  headers: Record<string, string>
): Record<string, string> {
  const filtered: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (ALLOWED_FORWARD_HEADERS.has(lowerKey)) {
      filtered[key] = value;
    }
  }

  return filtered;
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = requestSchema.parse(await request.json());

    validateServerUrl(body.serverUrl);
    const headers = body.headers ? filterForwardableHeaders(body.headers) : undefined;

    console.info("[CodeFlow] MCP list tools request", { serverUrl: body.serverUrl });

    const tools = await listMcpTools(body.serverUrl, headers);

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
