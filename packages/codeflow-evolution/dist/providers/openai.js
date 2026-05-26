export class OpenAIGhostProvider {
    async suggestGhostNodes(graph) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY environment variable is not set");
        }
        const nodeSummaries = graph.nodes
            .map((n) => `  - ${n.kind}: ${n.name} — ${n.summary}`)
            .join("\n");
        const edgeDescriptions = graph.edges
            .map((e) => `  - ${e.from} --[${e.kind}]--> ${e.to}`)
            .join("\n");
        const prompt = `You are an architecture ghost node suggester. Given this blueprint graph for project "${graph.projectName}":\n\nNodes:\n${nodeSummaries}\n\nEdges:\n${edgeDescriptions}\n\nSuggest 1-3 ghost nodes (components that do not yet exist but would improve the architecture). For each ghost node provide:\n- id: a unique snake_case identifier\n- kind: one of module|api|class|function|ui-screen\n- name: a short human-readable name\n- summary: what this component does\n- reason: why this component would improve the architecture\n- suggestedEdge: { from, to, kind } if it connects to existing nodes\n\nReturn a JSON array.`;
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error: ${response.status} ${error}`);
        }
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content ?? "[]";
        // Try to parse JSON from the response (may be wrapped in markdown)
        const jsonMatch = content.match(/```(?:json)?\n?([\s\S]*?)\n?```/)?.[1] ?? content;
        return JSON.parse(jsonMatch);
    }
}
//# sourceMappingURL=openai.js.map