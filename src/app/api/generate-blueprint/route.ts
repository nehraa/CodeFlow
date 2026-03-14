import { NextResponse } from "next/server";
import { z } from "zod";

import {
  blueprintGraphSchema,
  emptyContract,
  edgeKindSchema,
  nodeKindSchema,
  sourceRefSchema
} from "@/lib/blueprint/schema";
import { getNvidiaKeySource, requestNvidiaChatCompletion, resolveNvidiaApiKey } from "@/lib/blueprint/nvidia";
import { withSpecDrafts } from "@/lib/blueprint/phases";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { createRunPlan } from "@/lib/blueprint/plan";
import { upsertSession, saveRunRecord, createRunId } from "@/lib/blueprint/store";
import { createNode, createNodeId } from "@/lib/blueprint/utils";

const requestSchema = z.object({
  projectName: z.string(),
  prompt: z.string(),
  mode: z.enum(["essential", "yolo"]),
  nvidiaApiKey: z.string().optional()
});

const aiContractSchema = z
  .object({
    summary: z.string().optional(),
    responsibilities: z.array(z.string()).optional(),
    inputs: z
      .array(z.object({ name: z.string(), type: z.string(), description: z.string().optional() }))
      .optional(),
    outputs: z
      .array(z.object({ name: z.string(), type: z.string(), description: z.string().optional() }))
      .optional(),
    attributes: z
      .array(z.object({ name: z.string(), type: z.string(), description: z.string().optional() }))
      .optional(),
    methods: z
      .array(
        z.object({
          name: z.string(),
          signature: z.string().optional(),
          summary: z.string(),
          inputs: z
            .array(z.object({ name: z.string(), type: z.string(), description: z.string().optional() }))
            .optional(),
          outputs: z
            .array(z.object({ name: z.string(), type: z.string(), description: z.string().optional() }))
            .optional(),
          sideEffects: z.array(z.string()).optional(),
          calls: z
            .array(
              z.object({
                target: z.string(),
                kind: edgeKindSchema.optional(),
                description: z.string().optional()
              })
            )
            .optional()
        })
      )
      .optional(),
    sideEffects: z.array(z.string()).optional(),
    errors: z.array(z.string()).optional(),
    dependencies: z.array(z.string()).optional(),
    calls: z
      .array(
        z.object({
          target: z.string(),
          kind: edgeKindSchema.optional(),
          description: z.string().optional()
        })
      )
      .optional(),
    uiAccess: z.array(z.string()).optional(),
    backendAccess: z.array(z.string()).optional(),
    notes: z.array(z.string()).optional()
  })
  .optional();

const aiNodeSchema = z.object({
  id: z.string().optional(),
  kind: nodeKindSchema,
  name: z.string(),
  summary: z.string().optional(),
  path: z.string().optional(),
  signature: z.string().optional(),
  ownerId: z.string().optional(),
  contract: aiContractSchema,
  sourceRefs: z.array(sourceRefSchema).optional(),
  generatedRefs: z.array(z.string()).optional(),
  traceRefs: z.array(z.string()).optional()
});

const aiEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  kind: edgeKindSchema.optional(),
  label: z.string().optional(),
  required: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional()
});

const aiBlueprintResponseSchema = z.object({
  nodes: z.array(aiNodeSchema).default([]),
  edges: z.array(aiEdgeSchema).default([]),
  workflows: z
    .array(
      z.object({
        name: z.string(),
        steps: z.array(z.string())
      })
    )
    .default([]),
  warnings: z.array(z.string()).default([])
});

const SYSTEM_PROMPT = `You are a software architecture assistant. Generate a structured blueprint for a software project based on the user's prompt.

Return ONLY valid JSON matching this exact schema:

{
  "nodes": [
    {
      "id": "unique-id-string",
      "kind": "ui-screen" | "api" | "class" | "function" | "module",
      "name": "ComponentName",
      "summary": "Brief description",
      "contract": {
        "summary": "What this component does",
        "responsibilities": ["Primary responsibility"],
        "inputs": [{"name": "paramName", "type": "Type"}],
        "outputs": [{"name": "result", "type": "ReturnType"}],
        "attributes": [{"name": "status", "type": "TaskStatus", "description": "Important state or field"}],
        "methods": [
          {
            "name": "saveTask",
            "signature": "saveTask(input: TaskInput): Task",
            "summary": "Core behavior exposed by this node",
            "inputs": [{"name": "input", "type": "TaskInput"}],
            "outputs": [{"name": "result", "type": "Task"}],
            "sideEffects": ["Writes to task store"],
            "calls": [{"target": "TaskRepository", "kind": "calls", "description": "Persists the task"}]
          }
        ],
        "calls": [{"target": "TaskRepository", "kind": "calls", "description": "Persists data"}],
        "notes": ["additional notes"]
      },
      "sourceRefs": [{"kind": "generated", "detail": "AI generated from prompt"}]
    }
  ],
  "edges": [
    {
      "from": "node-id-1",
      "to": "node-id-2",
      "kind": "calls" | "imports" | "inherits",
      "required": true,
      "confidence": 0.8
    }
  ],
  "workflows": [
    {
      "name": "Workflow name",
      "steps": ["Step1", "Step2"]
    }
  ],
  "warnings": []
}

Guidelines:
- Create 5-15 nodes covering UI screens, APIs, classes/functions, and modules
- For every node, describe the design content that belongs inside it, not implementation code
- Classes should include important attributes and method specs
- Functions and APIs should include exact inputs, outputs, side effects, and downstream calls
- UI screens should include key state/props/events as attributes or methods
- Use kind "ui-screen" for UI components/pages
- Use kind "api" for API endpoints
- Use kind "class" for service classes
- Use kind "function" for standalone functions
- Use kind "module" for modules/domains
- Create meaningful edges showing relationships
- Include at least one workflow if applicable
- Generate unique IDs using format: kind-name-lowercase (e.g., "ui-screen-workspace", "api-tasks")
- Keep summaries concise and informative
- If you omit optional fields, leave them out instead of adding placeholder text`;

const normalizeAiBlueprint = (
  payload: z.infer<typeof aiBlueprintResponseSchema>,
  request: z.infer<typeof requestSchema>
): BlueprintGraph => {
  const generatedAt = new Date().toISOString();
  const normalizedNodes = payload.nodes.map((node) => {
    const name = node.name.trim();
    const contractSummary = node.contract?.summary?.trim();
    const summary = node.summary?.trim() || contractSummary || `Blueprint node for ${name}.`;

    return createNode({
      id: node.id?.trim() || createNodeId(node.kind, name, node.path ?? name),
      kind: node.kind,
      name,
      summary,
      path: node.path?.trim() || undefined,
      signature: node.signature?.trim() || undefined,
      ownerId: node.ownerId?.trim() || undefined,
      contract: {
        ...emptyContract(),
        summary,
        responsibilities: node.contract?.responsibilities ?? [],
        inputs: node.contract?.inputs ?? [],
        outputs: node.contract?.outputs ?? [],
        attributes: node.contract?.attributes ?? [],
        methods: (node.contract?.methods ?? []).map((method) => ({
          name: method.name,
          signature: method.signature?.trim() || undefined,
          summary: method.summary,
          inputs: method.inputs ?? [],
          outputs: method.outputs ?? [],
          sideEffects: method.sideEffects ?? [],
          calls: method.calls ?? []
        })),
        sideEffects: node.contract?.sideEffects ?? [],
        errors: node.contract?.errors ?? [],
        dependencies: node.contract?.dependencies ?? [],
        calls: node.contract?.calls ?? [],
        uiAccess: node.contract?.uiAccess ?? [],
        backendAccess: node.contract?.backendAccess ?? [],
        notes: node.contract?.notes ?? []
      },
      sourceRefs:
        node.sourceRefs && node.sourceRefs.length
          ? node.sourceRefs
          : [{ kind: "generated", detail: "AI generated from prompt" }],
      generatedRefs: node.generatedRefs ?? [],
      traceRefs: node.traceRefs ?? []
    });
  });

  const nodeIdMap = new Map<string, string>();
  for (const node of normalizedNodes) {
    nodeIdMap.set(node.id, node.id);
    nodeIdMap.set(node.name, node.id);
  }

  const normalizedEdges = payload.edges
    .map((edge) => {
      const from = nodeIdMap.get(edge.from) ?? edge.from;
      const to = nodeIdMap.get(edge.to) ?? edge.to;

      if (!nodeIdMap.has(from) || !nodeIdMap.has(to)) {
        return null;
      }

      return {
        from,
        to,
        kind: edge.kind ?? "calls",
        label: edge.label?.trim() || undefined,
        required: edge.required ?? true,
        confidence: edge.confidence ?? 0.65
      };
    })
    .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge));

  if (normalizedNodes.length === 0) {
    throw new Error("The AI response did not contain any blueprint nodes. Try a more specific project description.");
  }

  return withSpecDrafts(
    blueprintGraphSchema.parse({
      projectName: request.projectName,
      mode: request.mode,
      phase: "spec",
      generatedAt,
      nodes: normalizedNodes,
      edges: normalizedEdges,
      workflows: payload.workflows,
      warnings: payload.warnings
    })
  );
};

export async function GET() {
  return NextResponse.json({
    serverApiKeyConfigured: Boolean(process.env.NVIDIA_API_KEY)
  });
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = requestSchema.parse(await request.json());
    const apiKey = resolveNvidiaApiKey(body.nvidiaApiKey);
    const keySource = getNvidiaKeySource(body.nvidiaApiKey);

    console.info("[CodeFlow] AI blueprint request received", {
      projectName: body.projectName,
      mode: body.mode,
      promptLength: body.prompt.trim().length,
      keySource
    });

    if (!apiKey) {
      console.warn("[CodeFlow] AI blueprint request rejected because NVIDIA API key is missing", {
        projectName: body.projectName
      });
      return NextResponse.json(
        { error: "NVIDIA API key is required. Provide it in the UI or set NVIDIA_API_KEY environment variable." },
        { status: 400 }
      );
    }

    const userPrompt = `Create a software architecture blueprint for: ${body.prompt}

Project name: ${body.projectName}
Mode: ${body.mode}

Return the JSON blueprint now.`;

    console.info("[CodeFlow] Dispatching prompt to NVIDIA", {
      projectName: body.projectName,
      model: "meta/llama-3.1-405b-instruct"
    });
    const content = await requestNvidiaChatCompletion({
      apiKey,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      topP: 0.7,
      maxTokens: 4096
    });

    // Extract JSON from the response (in case there's markdown formatting)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : content;

    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseError) {
      throw new Error(`Failed to parse AI response as JSON: ${parseError instanceof Error ? parseError.message : "Unknown error"}`);
    }

    const aiBlueprint = aiBlueprintResponseSchema.parse(parsed);
    const validatedGraph = normalizeAiBlueprint(aiBlueprint, body);

    console.info("[CodeFlow] NVIDIA blueprint normalized successfully", {
      projectName: validatedGraph.projectName,
      durationMs: Date.now() - startedAt,
      nodes: validatedGraph.nodes.length,
      edges: validatedGraph.edges.length,
      workflows: validatedGraph.workflows.length
    });

    const runPlan = createRunPlan(validatedGraph);
    const session = await upsertSession({
      graph: validatedGraph,
      runPlan
    });

    await saveRunRecord({
      id: createRunId(),
      projectName: validatedGraph.projectName,
      action: "build",
      createdAt: new Date().toISOString(),
      runPlan
    });

    return NextResponse.json({ graph: validatedGraph, runPlan, session });
  } catch (error) {
    console.error("[CodeFlow] Failed to generate AI blueprint", {
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate blueprint" },
      { status: 400 }
    );
  }
}
