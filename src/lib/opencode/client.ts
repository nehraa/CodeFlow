/**
 * OpenCode client wrapper for browser/server communication
 * Since OpenCode server runs as a separate process, we need API routes to proxy requests
 */

import type { AgentRequest, AgentResponse, OpencodeServerInfo } from "./types";

const API_BASE = "/api/opencode";

/**
 * Check if OpenCode server is running
 */
export async function checkServerStatus(): Promise<OpencodeServerInfo> {
  const response = await fetch(`${API_BASE}/status`);
  
  if (!response.ok) {
    throw new Error(`Failed to check server status: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Start OpenCode server (via API route)
 */
export async function startServer(config: {
  provider: string;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}): Promise<OpencodeServerInfo> {
  const response = await fetch(`${API_BASE}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Failed to start server");
  }
  
  return response.json();
}

/**
 * Stop OpenCode server (via API route)
 */
export async function stopServer(): Promise<void> {
  const response = await fetch(`${API_BASE}/stop`, {
    method: "POST",
  });
  
  if (!response.ok) {
    throw new Error(`Failed to stop server: ${response.statusText}`);
  }
}

/**
 * Restart OpenCode server with new config
 */
export async function restartServer(config: {
  provider: string;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}): Promise<OpencodeServerInfo> {
  const response = await fetch(`${API_BASE}/restart`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Failed to restart server");
  }
  
  return response.json();
}

/**
 * Send message to OpenCode agent
 */
export async function sendAgentMessage(request: AgentRequest): Promise<AgentResponse> {
  const response = await fetch(`${API_BASE}/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    return {
      success: false,
      error: error.error || "Failed to send message to agent",
    };
  }
  
  return response.json();
}

/**
 * Generate code using OpenCode agent
 */
export async function generateCode(params: {
  prompt: string;
  context?: {
    files?: string[];
    codeSnippets?: Array<{ path: string; content: string }>;
  };
}): Promise<{ code: string; explanation: string } | { error: string }> {
  const response = await sendAgentMessage({
    type: "build",
    message: `Generate code: ${params.prompt}`,
    context: params.context,
  });
  
  if (!response.success || !response.response) {
    return { error: response.error || "Failed to generate code" };
  }
  
  // Parse the response to extract code and explanation
  // This is a simplified parser - OpenCode responses may need more sophisticated handling
  const codeMatch = response.response.match(/```[\w]*\n([\s\S]*?)\n```/);
  const code = codeMatch ? codeMatch[1]!.trim() : response.response;
  
  return {
    code,
    explanation: response.response,
  };
}

/**
 * Analyze code using OpenCode agent
 */
export async function analyzeCode(params: {
  code: string;
  filePath?: string;
  analysisType?: "quality" | "security" | "performance" | "general";
}): Promise<{ analysis: string; suggestions: string[] } | { error: string }> {
  const analysisPrompt = `Analyze this code for ${params.analysisType || "general"} concerns:\n\n${params.code}`;
  
  const response = await sendAgentMessage({
    type: "plan", // Use plan agent for read-only analysis
    message: analysisPrompt,
    context: params.filePath
      ? { codeSnippets: [{ path: params.filePath, content: params.code }] }
      : undefined,
  });
  
  if (!response.success || !response.response) {
    return { error: response.error || "Failed to analyze code" };
  }
  
  return {
    analysis: response.response,
    suggestions: [], // Could be extracted from response if formatted appropriately
  };
}

/**
 * Get code suggestions from OpenCode agent
 */
export async function getCodeSuggestions(params: {
  partial: string;
  context?: string;
  filePath?: string;
}): Promise<string[]> {
  const prompt = `Complete this code:\n\n${params.partial}\n\nContext: ${params.context || ""}`;
  
  const response = await sendAgentMessage({
    type: "build",
    message: prompt,
    context: params.filePath
      ? { codeSnippets: [{ path: params.filePath, content: params.partial }] }
      : undefined,
  });
  
  if (!response.success || !response.response) {
    return [];
  }
  
  // Extract suggestions from response
  // This is simplified - may need more sophisticated parsing
  return [response.response];
}

/**
 * Implement a node using OpenCode agent
 */
export async function implementNode(params: {
  nodeName: string;
  nodeType: string;
  description: string;
  dependencies?: string[];
  codebaseContext?: string;
}): Promise<{ code: string; summary: string; notes: string[] } | { error: string }> {
  const prompt = `
Implement ${params.nodeType} "${params.nodeName}":

Description: ${params.description}

${params.dependencies && params.dependencies.length > 0 ? `Dependencies: ${params.dependencies.join(", ")}` : ""}

${params.codebaseContext ? `Codebase Context:\n${params.codebaseContext}` : ""}

Provide production-ready implementation with proper error handling, typing, and documentation.
`;

  const response = await sendAgentMessage({
    type: "build",
    message: prompt,
  });
  
  if (!response.success || !response.response) {
    return { error: response.error || "Failed to implement node" };
  }
  
  // Parse response to extract code
  const codeMatch = response.response.match(/```[\w]*\n([\s\S]*?)\n```/);
  const code = codeMatch ? codeMatch[1]!.trim() : "";
  
  return {
    code,
    summary: `Implemented ${params.nodeName}`,
    notes: ["Generated by OpenCode agent"],
  };
}
