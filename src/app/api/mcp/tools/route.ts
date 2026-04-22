import { NextResponse } from "next/server";
import { z } from "zod";

import { listMcpTools } from "@abhinav2203/codeflow-mcp";

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

  // Block SSRF by validating hostname
  const hostname = url.hostname.toLowerCase();

  // Allow localhost and loopback addresses
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return;
  }

  // Block private IP ranges (RFC1918)
  const ipv4Patterns = [
    /^10\./,           // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16.0.0/12
    /^192\.168\./      // 192.168.0.0/16
  ];

  // Block link-local addresses
  const linkLocalPatterns = [
    /^169\.254\./,     // IPv4 link-local (169.254.0.0/16)
    /^fe80:/i,         // IPv6 link-local
    /^fc00:/i,         // IPv6 Unique Local Addresses
    /^fd00:/i          // IPv6 Unique Local Addresses
  ];

  // Block cloud metadata endpoints
  const metadataPatterns = [
    /^169\.254\.169\.254$/,  // AWS/Azure/GCP metadata
    /^metadata\.google\.internal$/i,
    /^metadata$/i
  ];

  const allPatterns = [...ipv4Patterns, ...linkLocalPatterns, ...metadataPatterns];

  for (const pattern of allPatterns) {
    if (pattern.test(hostname)) {
      throw new Error("Invalid serverUrl: cannot connect to private, link-local, or metadata endpoints.");
    }
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
