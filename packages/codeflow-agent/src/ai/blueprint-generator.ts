/**
 * NVIDIA Llama blueprint generation for codeflow-agent.
 *
 * Uses the NVIDIA API to generate BlueprintGraph from natural language prompts.
 */

import type { BlueprintGraph, BlueprintNode, BlueprintEdge } from '@abhinav2203/codeflow-core/schema';

// Re-export for convenience
export type { BlueprintGraph, BlueprintNode, BlueprintEdge } from '@abhinav2203/codeflow-core/schema';

export interface GenerateBlueprintOptions {
  prompt: string;
  projectName: string;
  mode?: 'essential' | 'yolo';
  nvidiaApiKey?: string;
}

export interface BlueprintGenerationResult {
  success: boolean;
  blueprint?: BlueprintGraph;
  error?: string;
}

/**
 * Request chat completion from NVIDIA API.
 */
async function requestNvidiaChatCompletion({
  apiKey,
  messages,
  model,
  temperature,
  maxTokens,
}: {
  apiKey: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const response = await fetch('https://integrations.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: temperature ?? 0.3,
      max_tokens: maxTokens ?? 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`NVIDIA API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No content in NVIDIA API response');
  }
  return content;
}

/**
 * Extract JSON object from a string that may contain markdown or extra text.
 */
function extractJsonObjectString(text: string): string {
  // Try to find JSON object in the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  // If no JSON found, try parsing the whole text
  return text.trim();
}

/**
 * Normalize AI-generated blueprint to ensure it conforms to BlueprintGraph schema.
 */
function normalizeAiBlueprint(parsed: Record<string, unknown>, options: GenerateBlueprintOptions): BlueprintGraph {
  const nodes: BlueprintNode[] = [];
  const edges: BlueprintEdge[] = [];

  // Extract nodes from AI response
  const rawNodes = parsed.nodes as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(rawNodes)) {
    for (const rawNode of rawNodes) {
      const node: BlueprintNode = {
        id: String(rawNode.id || rawNode.name || `node-${nodes.length + 1}`),
        name: String(rawNode.name || 'Unnamed Node'),
        kind: (rawNode.kind as BlueprintNode['kind']) || 'module',
        summary: String(rawNode.summary || rawNode.description || ''),
        path: rawNode.path ? String(rawNode.path) : undefined,
        signature: rawNode.signature ? String(rawNode.signature) : undefined,
        contract: (rawNode.contract as BlueprintNode['contract']) || {
          summary: String(rawNode.summary || ''),
          responsibilities: [],
          inputs: [],
          outputs: [],
          attributes: [],
          methods: [],
          sideEffects: [],
          errors: [],
          dependencies: [],
          calls: [],
          uiAccess: [],
          backendAccess: [],
          notes: [],
          sourceRefs: [],
        },
        status: 'spec_only',
        sourceRefs: [],
        generatedRefs: [],
        traceRefs: [],
      };
      nodes.push(node);
    }
  }

  // Extract edges from AI response
  const rawEdges = parsed.edges as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(rawEdges)) {
    for (const rawEdge of rawEdges) {
      const edge: BlueprintEdge = {
        from: String(rawEdge.from || rawEdge.source || `node-${edges.length + 1}`),
        to: String(rawEdge.to || rawEdge.target || ''),
        kind: (rawEdge.kind as BlueprintEdge['kind']) || 'imports',
        label: rawEdge.label ? String(rawEdge.label) : undefined,
        required: rawEdge.required !== undefined ? Boolean(rawEdge.required) : true,
        confidence: rawEdge.confidence !== undefined ? Number(rawEdge.confidence) : 1.0,
      };
      edges.push(edge);
    }
  }

  return {
    projectName: options.projectName,
    mode: options.mode || 'essential',
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
    workflows: [],
    warnings: [],
  };
}

/**
 * Generate a BlueprintGraph from a natural language prompt using NVIDIA Llama.
 */
export async function generateBlueprint(options: GenerateBlueprintOptions): Promise<BlueprintGraph> {
  const apiKey = options.nvidiaApiKey || process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY not set. Please set the NVIDIA_API_KEY environment variable or pass nvidiaApiKey option.');
  }

  const systemPrompt = `You are a software architecture assistant. Generate a structured software architecture blueprint based on the user's request.

The blueprint should include:
1. Nodes: Each represent a module, class, function, API endpoint, or UI screen
2. Edges: Dependencies between nodes (imports, calls, etc.)

For each node provide:
- id: unique identifier (e.g., "auth-module", "login-api")
- name: human-readable name
- kind: one of "function", "module", "api", "class", "ui-screen"
- summary: brief description of what this node does
- path: suggested file path (optional)
- signature: function/class signature (optional)
- contract: structured specification including inputs, outputs, dependencies

Return ONLY a valid JSON object with this structure:
{
  "nodes": [
    {
      "id": "node-id",
      "name": "Node Name",
      "kind": "module|function|api|class|ui-screen",
      "summary": "Brief description",
      "path": "src/path/to/file.ts (optional)",
      "signature": "function signature (optional)",
      "contract": {
        "summary": "Contract summary",
        "responsibilities": ["responsibility1"],
        "inputs": [{"name": "param", "type": "string", "description": "desc"}],
        "outputs": [{"name": "result", "type": "string", "description": "desc"}],
        "attributes": [],
        "methods": [],
        "sideEffects": [],
        "errors": [],
        "dependencies": [],
        "calls": [],
        "uiAccess": [],
        "backendAccess": [],
        "notes": []
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "from": "node-a",
      "to": "node-b",
      "kind": "imports|calls|reads-state|writes-state"
    }
  ]
}`;

  const content = await requestNvidiaChatCompletion({
    apiKey,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Create a software architecture blueprint for: ${options.prompt}\n\nProject name: ${options.projectName}\nMode: ${options.mode || 'essential'}` }
    ],
    model: 'meta/llama-3.1-405b-instruct',
    temperature: 0.3,
    maxTokens: 4096
  });

  // Parse and normalize
  const jsonString = extractJsonObjectString(content);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonString) as Record<string, unknown>;
  } catch {
    throw new Error(`Failed to parse blueprint JSON: ${jsonString.substring(0, 200)}`);
  }

  return normalizeAiBlueprint(parsed, options);
}