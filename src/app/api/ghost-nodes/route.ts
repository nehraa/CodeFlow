import { NextResponse } from "next/server";
import { z } from "zod";

import { blueprintGraphSchema, nodeKindSchema, edgeKindSchema } from "@/lib/blueprint/schema";
import { getNvidiaKeySource, requestNvidiaChatCompletion, resolveNvidiaApiKey } from "@/lib/blueprint/nvidia";
import type { BlueprintGraph, GhostNode } from "@/lib/blueprint/schema";

const requestSchema = z.object({
  graph: blueprintGraphSchema,
  nvidiaApiKey: z.string().optional()
});

const aiGhostNodeSchema = z.object({
  id: z.string(),
  kind: nodeKindSchema,
  name: z.string(),
  summary: z.string(),
  reason: z.string(),
  suggestedEdge: z
    .object({
      from: z.string(),
      to: z.string(),
      kind: edgeKindSchema
    })
    .optional()
});

const aiGhostResponseSchema = z.object({
  suggestions: z.array(aiGhostNodeSchema).default([])
});

const GHOST_SYSTEM_PROMPT = `You are a software architecture assistant. Given an existing architecture blueprint, suggest 2-4 probable next architectural components that would complement the existing design.

Return ONLY valid JSON matching this exact schema:

{
  "suggestions": [
    {
      "id": "ghost:unique-id",
      "kind": "ui-screen" | "api" | "class" | "function" | "module",
      "name": "ComponentName",
      "summary": "Brief description of what this component does",
      "reason": "Short explanation of why this component is recommended here",
      "suggestedEdge": {
        "from": "existing-node-id",
        "to": "ghost:unique-id",
        "kind": "calls" | "imports" | "inherits" | "renders" | "emits" | "consumes" | "reads-state" | "writes-state"
      }
    }
  ]
}

Guidelines:
- Suggest components that logically fit the architectural gaps
- Always prefix ghost node IDs with "ghost:"
- Provide a suggestedEdge linking from the most relevant existing node to the new ghost node
- Use the existing node IDs from the graph for the suggestedEdge.from field
- Keep suggestions focused and actionable
- Avoid duplicating components already in the graph`;

/**
 * Heuristic fallback when no NVIDIA key is available.
 * Suggests common architectural components based on patterns in the current graph.
 */
const buildHeuristicSuggestions = (graph: BlueprintGraph): GhostNode[] => {
  const kinds = new Set(graph.nodes.map((n) => n.kind));
  const suggestions: GhostNode[] = [];

  // If there are UI screens but no API layer, suggest an API gateway
  if (kinds.has("ui-screen") && !kinds.has("api")) {
    const uiNode = graph.nodes.find((n) => n.kind === "ui-screen");
    suggestions.push({
      id: "ghost:api-gateway",
      kind: "api",
      name: "API Gateway",
      summary: "Central API gateway routing requests from the UI to backend services.",
      reason: "UI screens typically communicate through an API layer.",
      suggestedEdge: uiNode
        ? { from: uiNode.id, to: "ghost:api-gateway", kind: "calls" }
        : undefined
    });
  }

  // If there are APIs but no auth middleware, suggest it
  if (kinds.has("api")) {
    const apiNode = graph.nodes.find((n) => n.kind === "api");
    const hasAuth = graph.nodes.some(
      (n) => n.name.toLowerCase().includes("auth") || n.name.toLowerCase().includes("middleware")
    );
    if (!hasAuth) {
      suggestions.push({
        id: "ghost:auth-middleware",
        kind: "module",
        name: "Auth Middleware",
        summary: "Authentication and authorization middleware protecting API endpoints.",
        reason: "API endpoints usually require authentication before processing requests.",
        suggestedEdge: apiNode
          ? { from: apiNode.id, to: "ghost:auth-middleware", kind: "calls" }
          : undefined
      });
    }
  }

  // If there are classes or functions but no error handler, suggest one
  if ((kinds.has("class") || kinds.has("function")) && !kinds.has("module")) {
    const targetNode = graph.nodes.find((n) => n.kind === "class" || n.kind === "function");
    suggestions.push({
      id: "ghost:error-handler",
      kind: "module",
      name: "Error Handler",
      summary: "Centralised error handling and logging module.",
      reason: "Business logic components benefit from a dedicated error-handling strategy.",
      suggestedEdge: targetNode
        ? { from: targetNode.id, to: "ghost:error-handler", kind: "calls" }
        : undefined
    });
  }

  // If no logging/monitoring node exists, suggest observability
  const hasObservability = graph.nodes.some(
    (n) =>
      n.name.toLowerCase().includes("log") ||
      n.name.toLowerCase().includes("monitor") ||
      n.name.toLowerCase().includes("observ") ||
      n.name.toLowerCase().includes("trace")
  );
  if (!hasObservability && graph.nodes.length >= 3) {
    const anchorNode = graph.nodes[0];
    suggestions.push({
      id: "ghost:observability",
      kind: "module",
      name: "Observability Module",
      summary: "Structured logging, metrics, and distributed tracing for the system.",
      reason: "Production systems require observability for debugging and performance monitoring.",
      suggestedEdge: anchorNode
        ? { from: anchorNode.id, to: "ghost:observability", kind: "emits" }
        : undefined
    });
  }

  return suggestions.slice(0, 4);
};

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const apiKey = resolveNvidiaApiKey(body.nvidiaApiKey);
    const keySource = getNvidiaKeySource(body.nvidiaApiKey);

    console.info("[CodeFlow] Ghost node suggestion request received", {
      projectName: body.graph.projectName,
      nodeCount: body.graph.nodes.length,
      keySource
    });

    // Use heuristic suggestions when no API key is available
    if (!apiKey) {
      const suggestions = buildHeuristicSuggestions(body.graph);
      return NextResponse.json({ suggestions });
    }

    const nodeList = body.graph.nodes
      .map((n) => `- ${n.id} (${n.kind}): ${n.name} — ${n.summary}`)
      .join("\n");

    const edgeList = body.graph.edges
      .map((e) => `- ${e.from} → ${e.to} [${e.kind}]`)
      .join("\n");

    const userPrompt = `Here is the current architecture blueprint for "${body.graph.projectName}":

Nodes:
${nodeList || "(none)"}

Edges:
${edgeList || "(none)"}

Based on common architectural patterns, suggest 2-4 ghost nodes (probable next components) that would complement this architecture. Return the JSON suggestions now.`;

    const content = await requestNvidiaChatCompletion({
      apiKey,
      messages: [
        { role: "system", content: GHOST_SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.4,
      topP: 0.8,
      maxTokens: 1024
    });

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : content;

    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      // Fall back to heuristic suggestions if AI response can't be parsed
      const suggestions = buildHeuristicSuggestions(body.graph);
      return NextResponse.json({ suggestions });
    }

    const aiResponse = aiGhostResponseSchema.parse(parsed);

    // Ensure all ghost IDs are prefixed and validate suggested edge node IDs
    const existingIds = new Set(body.graph.nodes.map((n) => n.id));
    const seenIds = new Set<string>();
    const suggestions: GhostNode[] = [];

    for (const s of aiResponse.suggestions) {
      const prefixedId = s.id.startsWith("ghost:") ? s.id : `ghost:${s.id}`;

      // De-duplicate by final ghost node ID, keeping the first occurrence
      if (seenIds.has(prefixedId)) {
        continue;
      }
      seenIds.add(prefixedId);

      const suggestion: GhostNode = {
        ...s,
        id: prefixedId,
        suggestedEdge:
          s.suggestedEdge && existingIds.has(s.suggestedEdge.from)
            ? { ...s.suggestedEdge, to: prefixedId }
            : undefined
      };

      suggestions.push(suggestion);

      if (suggestions.length >= 4) {
        break;
      }
    }

    console.info("[CodeFlow] Ghost node suggestions generated", {
      projectName: body.graph.projectName,
      count: suggestions.length
    });

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("[CodeFlow] Failed to generate ghost node suggestions", {
      error: error instanceof Error ? error.message : "Unknown error"
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate ghost node suggestions" },
      { status: 400 }
    );
  }
}
