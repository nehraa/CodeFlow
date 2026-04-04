/**
 * Agent abstraction layer - allows switching between NVIDIA and OpenCode backends
 */

import type { AgentRequest, AgentResponse, OpencodeServerInfo } from "./types";
import { getOpencodeServerInfo } from "./server";

export type AgentBackend = "nvidia" | "opencode";

export type CodeGenerationRequest = {
  prompt: string;
  systemPrompt?: string;
  context?: {
    files?: string[];
    codeSnippets?: Array<{ path: string; content: string }>;
    previousMessages?: Array<{ role: "user" | "assistant"; content: string }>;
  };
  temperature?: number;
  maxTokens?: number;
};

export type CodeGenerationResponse = {
  success: boolean;
  content?: string;
  error?: string;
};

/**
 * Check which backend is available
 */
export function getAvailableBackend(): AgentBackend | null {
  const opencodeInfo = getOpencodeServerInfo();
  
  if (opencodeInfo.status === "running" && opencodeInfo.url) {
    return "opencode";
  }
  
  // Check for NVIDIA API key
  if (process.env.NVIDIA_API_KEY) {
    return "nvidia";
  }
  
  return null;
}

/**
 * Check if OpenCode is available
 */
export function isOpencodeAvailable(): boolean {
  const info = getOpencodeServerInfo();
  return info.status === "running" && !!info.url;
}

/**
 * Get OpenCode server URL if available
 */
export function getOpencodeUrl(): string | null {
  const info = getOpencodeServerInfo();
  return info.status === "running" ? info.url ?? null : null;
}

/**
 * Send a code generation request to OpenCode with retry support
 */
export async function sendToOpencode(
  request: CodeGenerationRequest,
  options: { timeout?: number; retries?: number } = {}
): Promise<CodeGenerationResponse> {
  const { timeout = 120000, retries = 2 } = options;
  const serverInfo = getOpencodeServerInfo();
  
  if (serverInfo.status !== "running" || !serverInfo.url) {
    return {
      success: false,
      error: "OpenCode server is not running",
    };
  }
  
  let lastError = "Unknown error";
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Get or create session
      const sessionId = await getOrCreateSession(serverInfo.url, "build");
      
      // Build full prompt with context
      let fullPrompt = "";
      
      if (request.systemPrompt) {
        fullPrompt += `System context:\n${request.systemPrompt}\n\n`;
      }
      
      fullPrompt += request.prompt;
      
      if (request.context?.codeSnippets && request.context.codeSnippets.length > 0) {
        fullPrompt += "\n\n--- Code Context ---\n";
        for (const snippet of request.context.codeSnippets) {
          fullPrompt += `\nFile: ${snippet.path}\n\`\`\`\n${snippet.content}\n\`\`\`\n`;
        }
      }
      
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        // Send to OpenCode
        const response = await fetch(`${serverInfo.url}/session/${sessionId}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parts: [{ type: "text", text: fullPrompt }],
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          lastError = `OpenCode request failed: ${errorText}`;
          if (attempt < retries) continue;
          return {
            success: false,
            error: lastError,
          };
        }
        
        const responseText = await response.text();
        
        // Try to parse as JSON and extract text content
        try {
          const parsed = JSON.parse(responseText);
          
          if (parsed.parts && Array.isArray(parsed.parts)) {
            const textParts = parsed.parts
              .filter((p: { type: string; text?: string }) => p.type === "text" && p.text)
              .map((p: { text: string }) => p.text);
            
            return {
              success: true,
              content: textParts.join("\n") || responseText,
            };
          }
          
          return {
            success: true,
            content: JSON.stringify(parsed),
          };
        } catch {
          return {
            success: true,
            content: responseText,
          };
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          lastError = `Request timed out after ${timeout}ms`;
        } else {
          lastError = fetchError instanceof Error ? fetchError.message : "Fetch failed";
        }
        
        if (attempt < retries) continue;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
      if (attempt < retries) continue;
    }
  }
  
  return {
    success: false,
    error: lastError,
  };
}

/**
 * Helper to get or create a session
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
 * Unified code generation that uses available backend
 */
export async function generateCodeWithAgent(
  request: CodeGenerationRequest,
  preferredBackend?: AgentBackend
): Promise<CodeGenerationResponse> {
  // Determine which backend to use
  let backend = preferredBackend;
  
  if (!backend) {
    backend = getAvailableBackend() ?? undefined;
  }
  
  if (!backend) {
    return {
      success: false,
      error: "No AI backend available. Configure OpenCode or provide NVIDIA API key.",
    };
  }
  
  if (backend === "opencode") {
    return sendToOpencode(request);
  }
  
  // For NVIDIA, we can't call it directly here since it needs the API key
  // Return indicator that NVIDIA should be used
  return {
    success: false,
    error: "NVIDIA_FALLBACK",
  };
}

/**
 * Extract code from agent response
 */
export function extractCodeFromResponse(content: string): string | null {
  // Try to find code blocks
  const codeBlockMatch = content.match(/```[\w]*\n([\s\S]*?)\n```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1]!.trim();
  }
  
  // Try to parse as JSON with code field
  try {
    const parsed = JSON.parse(content);
    if (parsed.code) {
      return parsed.code;
    }
  } catch {
    // Not JSON
  }
  
  return null;
}

/**
 * Extract JSON from agent response
 */
export function extractJsonFromResponse<T>(content: string): T | null {
  // Try direct parse
  try {
    return JSON.parse(content);
  } catch {
    // Try to find JSON in content
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // Not valid JSON
      }
    }
  }
  
  return null;
}
