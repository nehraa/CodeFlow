import { NextResponse } from "next/server";
import { z } from "zod";

import { invokeMcpTool } from "@/lib/blueprint/mcp";

const serverUrlSchema = z.string().min(1).transform((value, ctx) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid serverUrl: must be a valid URL."
    });
    return z.NEVER;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid serverUrl: only http and https schemes are allowed."
    });
    return z.NEVER;
  }

  // Return a normalized URL string.
  return url.toString();
});

const requestSchema = z.object({
  serverUrl: serverUrlSchema,
  toolName: z.string().min(1),
  args: z.record(z.string(), z.unknown()).default({}),
  headers: z.record(z.string(), z.string()).optional()
});

const ALLOWED_FORWARD_HEADERS = new Set<string>([
  "authorization",
  "content-type",
  "accept",
  "x-mcp-auth",
  "x-api-key",
  "x-request-id",
  "user-agent"
]);

function filterForwardableHeaders(headers: Record<string, string>): Record<string, string> {
  const filtered: Record<string, string> = {};

  for (const [name, value] of Object.entries(headers)) {
    if (ALLOWED_FORWARD_HEADERS.has(name.toLowerCase())) {
      filtered[name] = value;
    }
  }

  return filtered;
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = requestSchema.parse(await request.json());

    console.info("[CodeFlow] MCP invoke tool request", {
      serverUrl: body.serverUrl,
      toolName: body.toolName
    });

    const safeHeaders =
      body.headers == null ? undefined : filterForwardableHeaders(body.headers);

    const result = await invokeMcpTool(body.serverUrl, body.toolName, body.args, safeHeaders);

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
