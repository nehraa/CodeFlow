import { NextResponse } from "next/server";
import { z } from "zod";

import { listMcpTools } from "@/lib/blueprint/mcp";

const requestSchema = z.object({
  serverUrl: z.string().min(1),
  headers: z.record(z.string(), z.string()).optional()
});

function isPrivateIp(hostname: string): boolean {
  // Only handle IPv4 literals here; hostnames will return false.
  const ipv4Match = hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/);
  if (!ipv4Match) {
    return false;
  }

  const octets = hostname.split(".").map(Number);
  if (octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) {
    return false;
  }

  const [o1, o2] = octets;

  // 10.0.0.0/8
  if (o1 === 10) return true;
  // 127.0.0.0/8 (loopback)
  if (o1 === 127) return true;
  // 172.16.0.0/12
  if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
  // 192.168.0.0/16
  if (o1 === 192 && o2 === 168) return true;
  // Link-local 169.254.0.0/16
  if (o1 === 169 && o2 === 254) return true;

  return false;
}

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

  const hostname = url.hostname.toLowerCase();

  // Block localhost and common loopback hostnames.
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  ) {
    throw new Error("Invalid serverUrl: localhost addresses are not allowed.");
  }

  // Block private/loopback IP ranges.
  if (isPrivateIp(hostname)) {
    throw new Error("Invalid serverUrl: private network addresses are not allowed.");
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
