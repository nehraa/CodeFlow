export class OllamaGhostProvider {
    async suggestGhostNodes(graph) {
        const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
        const nodeSummaries = graph.nodes
            .map((n) => `  - ${n.kind}: ${n.name} — ${n.summary}`)
            .join("\n");
        const edgeDescriptions = graph.edges
            .map((e) => `  - ${e.from} --[${e.kind}]--> ${e.to}`)
            .join("\n");
        const prompt = `You are an architecture ghost node suggester. Given this blueprint graph for project "${graph.projectName}":\n\nNodes:\n${nodeSummaries}\n\nEdges:\n${edgeDescriptions}\n\nSuggest 1-3 ghost nodes (components that do not yet exist but would improve the architecture). For each ghost node provide:\n- id: a unique snake_case identifier\n- kind: one of module|api|class|function|ui-screen\n- name: a short human-readable name\n- summary: what this component does\n- reason: why this component would improve the architecture\n- suggestedEdge: { from, to, kind } if it connects to existing nodes\n\nReturn a JSON array.`;
        const response = await fetch(`${baseUrl}/api/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "llama3.2",
                messages: [{ role: "user", content: prompt }],
                stream: false,
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Ollama API error: ${response.status} ${error}`);
        }
        const data = await response.json();
        const content = data.message?.content ?? "[]";
        const jsonMatch = content.match(/```(?:json)?\n?([\s\S]*?)\n?```/)?.[1] ?? content;
        return JSON.parse(jsonMatch);
    }
}
//# sourceMappingURL=ollama.js.map