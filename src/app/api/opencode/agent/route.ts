import { NextResponse } from "next/server";
import { z } from "zod";
import type { AgentRequest, AgentResponse } from "@/lib/opencode/types";
import { getOpencodeServerInfo } from "@/lib/opencode/server";

const agentRequestSchema = z.object({
  type: z.enum(["build", "plan", "general"]),
  message: z.string(),
  context: z.object({
    files: z.array(z.string()).optional(),
    codeSnippets: z.array(z.object({
      path: z.string(),
      content: z.string(),
    })).optional(),
    previousMessages: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })).optional(),
  }).optional(),
});

/**
 * Create or get a session for the agent interaction
 */
async function getOrCreateSession(serverUrl: string, agentType: string): Promise<string> {
  // List existing sessions
  const listRes = await fetch(`${serverUrl}/session?limit=1`, {
    headers: { "Content-Type": "application/json" },
  });
  
  if (listRes.ok) {
    const sessions = await listRes.json();
    if (sessions.length > 0) {
      return sessions[0].id;
    }
  }
  
  // Create a new session
  const createRes = await fetch(`${serverUrl}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: `CodeFlow ${agentType} session`,
      agent: agentType,
    }),
  });
  
  if (!createRes.ok) {
    throw new Error(`Failed to create session: ${createRes.statusText}`);
  }
  
  const session = await createRes.json();
  return session.id;
}

/**
 * Send a prompt to the OpenCode server and wait for response
 */
async function sendPrompt(
  serverUrl: string,
  sessionId: string,
  message: string,
  context?: AgentRequest["context"]
): Promise<AgentResponse> {
  // Build the prompt with context
  let fullPrompt = message;
  
  if (context?.codeSnippets && context.codeSnippets.length > 0) {
    fullPrompt += "\n\n--- Context ---\n";
    for (const snippet of context.codeSnippets) {
      fullPrompt += `\nFile: ${snippet.path}\n\`\`\`\n${snippet.content}\n\`\`\`\n`;
    }
  }
  
  if (context?.files && context.files.length > 0) {
    fullPrompt += `\n\nRelevant files: ${context.files.join(", ")}`;
  }
  
  // Send message to session
  const promptRes = await fetch(`${serverUrl}/session/${sessionId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      parts: [{ type: "text", text: fullPrompt }],
    }),
  });
  
  if (!promptRes.ok) {
    const errorText = await promptRes.text();
    return {
      success: false,
      error: `Failed to send prompt: ${errorText}`,
    };
  }
  
  // Parse streamed response
  const responseText = await promptRes.text();
  
  try {
    const parsed = JSON.parse(responseText);
    
    // Extract text response from parts
    let responseContent = "";
    const actions: AgentResponse["actions"] = [];
    
    if (parsed.parts && Array.isArray(parsed.parts)) {
      for (const part of parsed.parts) {
        if (part.type === "text" && part.text) {
          responseContent += part.text;
        } else if (part.type === "tool-call" || part.type === "tool_call") {
          // Extract tool calls as actions
          const toolName = part.toolName || part.name;
          if (toolName === "write_file" || toolName === "create_file") {
            actions.push({
              type: "file_create",
              payload: part.args || part.input,
            });
          } else if (toolName === "edit_file" || toolName === "replace") {
            actions.push({
              type: "file_edit",
              payload: part.args || part.input,
            });
          } else if (toolName === "bash" || toolName === "shell") {
            actions.push({
              type: "bash_command",
              payload: part.args || part.input,
            });
          }
        }
      }
    }
    
    return {
      success: true,
      response: responseContent || JSON.stringify(parsed),
      actions: actions.length > 0 ? actions : undefined,
    };
  } catch {
    // If not valid JSON, return as plain text
    return {
      success: true,
      response: responseText,
    };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = agentRequestSchema.parse(body) as AgentRequest;
    
    // Check if OpenCode server is running
    const serverInfo = getOpencodeServerInfo();
    
    if (serverInfo.status !== "running" || !serverInfo.url) {
      return NextResponse.json({
        success: false,
        error: "OpenCode server is not running. Please start it from Settings > OpenCode Agent.",
      }, { status: 503 });
    }
    
    // Get or create a session
    const sessionId = await getOrCreateSession(serverInfo.url, validated.type);
    
    // Send the prompt and get response
    const response = await sendPrompt(
      serverInfo.url,
      sessionId,
      validated.message,
      validated.context
    );
    
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid request body", details: error.issues },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to process agent request" },
      { status: 500 }
    );
  }
}
