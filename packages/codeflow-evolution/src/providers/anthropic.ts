import type { BlueprintGraph, GhostNode } from "../schema.js";
import type { GhostProvider } from "./index.js";

export class AnthropicGhostProvider implements GhostProvider {
  async suggestGhostNodes(graph: BlueprintGraph): Promise<GhostNode[]> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }

    const nodeSummaries = graph.nodes
      .map((n) => `  - ${n.kind}: ${n.name} — ${n.summary}`)
      .join("\n");

    const edgeDescriptions = graph.edges
      .map((e) => `  - ${e.from} --[${e.kind}]--> ${e.to}`)
      .join("\n");

    const prompt = `You are an architecture ghost node suggester. Given this blueprint graph for project "${graph.projectName}":\n\nNodes:\n${nodeSummaries}\n\nEdges:\n${edgeDescriptions}\n\nSuggest 1-3 ghost nodes (components that do not yet exist but would improve the architecture). For each ghost node provide:\n- id: a unique snake_case identifier\n- kind: one of module|api|class|function|ui-screen\n- name: a short human-readable name\n- summary: what this component does\n- reason: why this component would improve the architecture\n- suggestedEdge: { from, to, kind } if it connects to existing nodes\n\nReturn a JSON array.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${error}`);
    }

    const data = await response.json() as { content?: { text?: string }[] };
    const content = data.content?.[0]?.text ?? "[]";

    const jsonMatch = content.match(/```(?:json)?\n?([\s\S]*?)\n?```/)?.[1] ?? content;
    return JSON.parse(jsonMatch) as GhostNode[];
  }
}