import { NextResponse } from "next/server";
import { z } from "zod";

import { invokeMcpTool } from "@/lib/blueprint/mcp";

function isPrivateOrLocalHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  if (
    lower === "localhost" ||
    lower === "127.0.0.1" ||
    lower === "::1" ||
    lower === "0.0.0.0"
  ) {
    return true;
  }

  // Basic checks for common private IPv4 ranges when provided as literals.
  const ipv4Match = /^(\d{1,3}\.){3}\d{1,3}$/.test(lower);
  if (ipv4Match) {
    const [a, b] = lower.split(".").map((part) => parseInt(part, 10));
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }

  // Basic checks for common private/loopback IPv6 when provided as literals.
  if (lower === "::1") {
    return true;
  }
  if (lower.startsWith("fc") || lower.startsWith("fd")) {
    // Unique local addresses (fc00::/7)
    return true;
  }
  if (lower.startsWith("fe80")) {
    // Link-local unicast (fe80::/10)
    return true;
  }

  return false;
}

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

  if (isPrivateOrLocalHostname(url.hostname)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid serverUrl: connections to localhost or private networks are not allowed."
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
