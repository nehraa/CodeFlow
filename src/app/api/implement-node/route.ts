import { NextResponse } from "next/server";
import { z } from "zod";

import { getNodeAssistanceContext } from "@/lib/blueprint/code-assist";
import { generateNodeCode, getNodeStubPath, isCodeBearingNode } from "@/lib/blueprint/codegen";
import { markNodeImplemented } from "@/lib/blueprint/phases";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { blueprintGraphSchema } from "@/lib/blueprint/schema";
import { getNvidiaKeySource, requestNvidiaChatCompletion, resolveNvidiaApiKey } from "@/lib/blueprint/nvidia";
import { createRunPlan } from "@/lib/blueprint/plan";
import { upsertSession } from "@/lib/blueprint/store";

const requestSchema = z.object({
  graph: blueprintGraphSchema,
  nodeId: z.string().min(1),
  currentCode: z.string().optional(),
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
- Preserve exported symbol names and file boundaries
- Implement just the selected node, not the whole project
- If other nodes are referenced, import them using the provided file map
- Do not wrap the JSON in markdown fences`;

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const rawBody = requestSchema.parse(await request.json());
    const graph: BlueprintGraph = rawBody.graph;
    const apiKey = resolveNvidiaApiKey(rawBody.nvidiaApiKey);
    const keySource = getNvidiaKeySource(rawBody.nvidiaApiKey);
    const context = getNodeAssistanceContext(graph, rawBody.nodeId);

    if (!context) {
      return NextResponse.json({ error: `Blueprint node ${rawBody.nodeId} was not found.` }, { status: 404 });
    }

    const { node, relatedNodes, relatedEdges } = context;
    if (!isCodeBearingNode(node)) {
      return NextResponse.json(
        { error: `Blueprint node ${node.name} is architectural only and cannot be implemented.` },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "NVIDIA API key is required. Provide it in the UI or set NVIDIA_API_KEY environment variable." },
        { status: 400 }
      );
    }

    const currentCode = rawBody.currentCode ?? node.implementationDraft ?? generateNodeCode(node, graph) ?? "";
    const fileMap = graph.nodes
      .map((candidate) => ({
        nodeId: candidate.id,
        name: candidate.name,
        kind: candidate.kind,
        path: getNodeStubPath(candidate)
      }))
      .filter((candidate) => candidate.path);

    console.info("[CodeFlow] Implement node request received", {
      nodeId: rawBody.nodeId,
      kind: node.kind,
      keySource
    });

    const content = await requestNvidiaChatCompletion({
      apiKey,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Implement this blueprint node.

Project: ${graph.projectName}
Current phase: ${graph.phase}
Node id: ${node.id}
Node name: ${node.name}
Node kind: ${node.kind}
Node summary: ${node.summary}
Node signature: ${node.signature ?? "N/A"}
Target file: ${getNodeStubPath(node) ?? "N/A"}

Node contract:
${JSON.stringify(node.contract, null, 2)}

File map:
${JSON.stringify(fileMap, null, 2)}

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
${currentCode}
\`\`\`

Implement only this node. Preserve compatibility with the blueprint contract and return the JSON payload now.`
        }
      ],
      temperature: 0.2,
      topP: 0.7,
      maxTokens: 4096
    });

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = responseSchema.parse(JSON.parse(jsonMatch ? jsonMatch[0] : content));
    const updatedGraph = markNodeImplemented(graph, rawBody.nodeId, parsed.code);
    const runPlan = createRunPlan(updatedGraph);
    const session = await upsertSession({
      graph: updatedGraph,
      runPlan
    });

    return NextResponse.json({
      nodeId: rawBody.nodeId,
      implementation: parsed,
      graph: updatedGraph,
      runPlan,
      session
    });
  } catch (error) {
    console.error("[CodeFlow] Failed to implement node", {
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error"
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to implement node." },
      { status: 400 }
    );
  }
}
