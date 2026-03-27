import { NextResponse } from "next/server";
import { z } from "zod";

import { getNodeAssistanceContext } from "@/lib/blueprint/code-assist";
import { withCodeflowGovernance } from "@/lib/blueprint/prompt-governance";
import { blueprintGraphSchema } from "@/lib/blueprint/schema";
import { getNvidiaKeySource, requestNvidiaChatCompletion, resolveNvidiaApiKey } from "@/lib/blueprint/nvidia";

const requestSchema = z.object({
  graph: blueprintGraphSchema,
  nodeId: z.string().min(1),
  currentCode: z.string(),
  cursorOffset: z.number().int().nonnegative(),
  linePrefix: z.string(),
  lineSuffix: z.string(),
  triggerCharacter: z.string().optional(),
  nvidiaApiKey: z.string().optional()
});

const completionItemSchema = z.object({
  label: z.string(),
  insertText: z.string(),
  detail: z.string().optional(),
  documentation: z.string().optional(),
  kind: z
    .enum([
      "text",
      "method",
      "function",
      "constructor",
      "field",
      "variable",
      "class",
      "interface",
      "module",
      "property",
      "unit",
      "value",
      "enum",
      "keyword",
      "snippet",
      "color",
      "file",
      "reference"
    ])
    .optional()
});

const responseSchema = z.object({
  suggestions: z.array(completionItemSchema).max(6)
});

const SYSTEM_PROMPT = `You are generating short Monaco editor completions for a code buffer.

Return ONLY valid JSON matching this schema:
{
  "suggestions": [
    {
      "label": "display text",
      "insertText": "the code snippet to insert at the cursor",
      "detail": "short hint",
      "documentation": "one short explanation",
      "kind": "function" | "method" | "property" | "class" | "interface" | "variable" | "snippet" | "keyword" | "text"
    }
  ]
}

Rules:
- Return 1 to 4 suggestions
- Keep insertText short and local to the cursor context
- Do not return a whole file
- Preserve the current coding style and exported names
- Use the blueprint node contract as the source of truth
- Prefer snippets that are valid continuations for the trigger context
- Do not wrap the JSON in markdown fences`;

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = requestSchema.parse(await request.json());
    const apiKey = resolveNvidiaApiKey(body.nvidiaApiKey);
    const keySource = getNvidiaKeySource(body.nvidiaApiKey);
    const context = getNodeAssistanceContext(body.graph, body.nodeId);

    if (!context) {
      return NextResponse.json({ error: `Blueprint node ${body.nodeId} was not found.` }, { status: 404 });
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "NVIDIA API key is required. Provide it in the UI or set NVIDIA_API_KEY environment variable." },
        { status: 400 }
      );
    }

    const { node, relatedNodes, relatedEdges } = context;

    console.info("[CodeFlow] Code completion request received", {
      nodeId: body.nodeId,
      kind: node.kind,
      cursorOffset: body.cursorOffset,
      triggerCharacter: body.triggerCharacter ?? "manual",
      keySource
    });

    const beforeCursor = body.currentCode.slice(Math.max(0, body.cursorOffset - 1200), body.cursorOffset);
    const afterCursor = body.currentCode.slice(body.cursorOffset, Math.min(body.currentCode.length, body.cursorOffset + 400));

    const userPrompt = `Generate short code completions for this blueprint node.

Project: ${body.graph.projectName}
Node id: ${node.id}
Node name: ${node.name}
Node kind: ${node.kind}
Node summary: ${node.summary}
Node signature: ${node.signature ?? "N/A"}
Trigger character: ${body.triggerCharacter ?? "manual"}

Node contract:
${JSON.stringify(node.contract, null, 2)}

Related nodes:
${JSON.stringify(
  relatedNodes.map((candidate) => ({
    id: candidate.id,
    ownerId: candidate.ownerId,
    kind: candidate.kind,
    name: candidate.name,
    summary: candidate.summary,
    signature: candidate.signature,
    contract: candidate.contract
  })),
  null,
  2
)}

Relevant edges:
${JSON.stringify(relatedEdges, null, 2)}

Cursor line prefix:
${body.linePrefix}

Cursor line suffix:
${body.lineSuffix}

Code before cursor:
\`\`\`
${beforeCursor}
\`\`\`

Code after cursor:
\`\`\`
${afterCursor}
\`\`\`

Return JSON completions now.`;
    const governedSystemPrompt = await withCodeflowGovernance(
      SYSTEM_PROMPT,
      "completion"
    );

    const content = await requestNvidiaChatCompletion({
      apiKey,
      messages: [
        { role: "system", content: governedSystemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.15,
      topP: 0.7,
      maxTokens: 1200
    });

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : content;
    const parsed = responseSchema.parse(JSON.parse(jsonString));

    console.info("[CodeFlow] Code completions generated", {
      nodeId: body.nodeId,
      suggestions: parsed.suggestions.length,
      durationMs: Date.now() - startedAt
    });

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[CodeFlow] Failed to generate code completions", {
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error"
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate code completions." },
      { status: 400 }
    );
  }
}
