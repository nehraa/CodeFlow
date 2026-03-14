import { NextResponse } from "next/server";
import { z } from "zod";

import { getNodeAssistanceContext } from "@/lib/blueprint/code-assist";
import { blueprintGraphSchema } from "@/lib/blueprint/schema";
import { getNvidiaKeySource, requestNvidiaChatCompletion, resolveNvidiaApiKey } from "@/lib/blueprint/nvidia";

const requestSchema = z.object({
  graph: blueprintGraphSchema,
  nodeId: z.string().min(1),
  currentCode: z.string(),
  instruction: z.string().trim().optional(),
  nvidiaApiKey: z.string().optional()
});

const responseSchema = z.object({
  summary: z.string(),
  code: z.string(),
  notes: z.array(z.string()).default([])
});

const SYSTEM_PROMPT = `You are a senior software engineer helping turn a blueprint node contract into implementation code.

Return ONLY valid JSON matching this schema:
{
  "summary": "short description of what changed",
  "code": "full replacement code for the current node",
  "notes": ["short implementation notes or follow-ups"]
}

Rules:
- Return a full replacement file in the "code" field, not a diff
- Use the supplied node contract as the source of truth
- Keep code aligned to the current file's likely language and role
- Include clear inline documentation comments when useful
- Preserve existing exported symbol names unless the blueprint contract requires otherwise
- If the current code is already strong, refine it instead of rewriting randomly
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

    const { node, relatedNodes, relatedEdges } = context;

    console.info("[CodeFlow] Code suggestion request received", {
      nodeId: body.nodeId,
      kind: node.kind,
      promptLength: body.instruction?.length ?? 0,
      keySource
    });

    if (!apiKey) {
      return NextResponse.json(
        { error: "NVIDIA API key is required. Provide it in the UI or set NVIDIA_API_KEY environment variable." },
        { status: 400 }
      );
    }

    const userPrompt = `Suggest implementation code for this blueprint node.

Project: ${body.graph.projectName}
Node id: ${node.id}
Node name: ${node.name}
Node kind: ${node.kind}
Node summary: ${node.summary}
Node signature: ${node.signature ?? "N/A"}

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

Current code:
\`\`\`
${body.currentCode}
\`\`\`

Extra instruction:
${body.instruction?.trim() || "Improve the implementation using the blueprint as the source of truth."}

Return the JSON suggestion now.`;

    const content = await requestNvidiaChatCompletion({
      apiKey,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2,
      topP: 0.7,
      maxTokens: 4096
    });

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : content;
    const parsed = responseSchema.parse(JSON.parse(jsonString));

    console.info("[CodeFlow] Code suggestion generated", {
      nodeId: body.nodeId,
      durationMs: Date.now() - startedAt
    });

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[CodeFlow] Failed to generate code suggestion", {
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error"
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate code suggestion." },
      { status: 400 }
    );
  }
}
