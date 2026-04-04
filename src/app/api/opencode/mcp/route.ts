import { NextResponse } from "next/server";
import { getOpencodeServerInfo } from "@/lib/opencode/server";

/**
 * GET /api/opencode/mcp - List MCP servers configured in OpenCode
 */
export async function GET() {
  try {
    const serverInfo = getOpencodeServerInfo();
    
    if (serverInfo.status !== "running" || !serverInfo.url) {
      return NextResponse.json({
        servers: [],
        error: "OpenCode server is not running"
      });
    }
    
    // Get MCP server list from OpenCode
    const response = await fetch(`${serverInfo.url}/mcp/servers`, {
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        servers: [],
        error: `Failed to fetch MCP servers: ${errorText}`
      });
    }
    
    const servers = await response.json();
    
    return NextResponse.json({ servers });
  } catch (error) {
    return NextResponse.json(
      { servers: [], error: error instanceof Error ? error.message : "Failed to list MCP servers" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/opencode/mcp - Configure an MCP server in OpenCode
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const serverInfo = getOpencodeServerInfo();
    
    if (serverInfo.status !== "running" || !serverInfo.url) {
      return NextResponse.json(
        { success: false, error: "OpenCode server is not running" },
        { status: 503 }
      );
    }
    
    // Forward MCP server configuration to OpenCode
    const response = await fetch(`${serverInfo.url}/mcp/server`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { success: false, error: `Failed to configure MCP server: ${errorText}` },
        { status: response.status }
      );
    }
    
    const result = await response.json();
    
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to configure MCP server" },
      { status: 500 }
    );
  }
}
