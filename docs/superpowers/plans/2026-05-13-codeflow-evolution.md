# codeflow-evolution Package Extraction Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract `@abhinav2203/codeflow-evolution` as a standalone npm package. Provides ghost node suggestions (AI + heuristic) and genetic architecture evolution. Works in isolation — no monorepo required.

**Architecture:**
- Core logic is a **programmatic API** — pure functions exported from `src/genetic/` and `src/ghost/` sub-modules
- CLI is a **thin wrapper** — human-readable output by default, `--json` for machine output
- **Pluggable LLM provider** — `LLMProvider` interface, NVIDIA provider as default
- All internal deps resolved via npm (`@abhinav2203/codeflow-core`, `@abhinav2203/codeflow-agent`)

**Tech Stack:** TypeScript, Node.js, `zod`, `vitest`

---

## Step 0 — Scaffold Package Skeleton

- [ ] **Step 0.1: Create directory structure**

```bash
mkdir -p packages/codeflow-evolution/src/{genetic,ghost,bin}
mkdir -p packages/codeflow-evolution/test-fixtures
```

- [ ] **Step 0.2: Create `packages/codeflow-evolution/package.json`**

```json
{
  "name": "@abhinav2203/codeflow-evolution",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./genetic": { "types": "./dist/genetic/index.d.ts", "default": "./dist/genetic/index.js" },
    "./ghost": { "types": "./dist/ghost/index.d.ts", "default": "./dist/ghost/index.js" },
    "./ghost/provider": { "types": "./dist/ghost/provider.d.ts", "default": "./dist/ghost/provider.js" }
  },
  "bin": {
    "codeflow-evolution": "./dist/bin/cli.js"
  },
  "scripts": {
    "check": "tsc --noEmit",
    "test": "vitest run",
    "build": "tsc --outDir dist --declaration --declarationMap"
  },
  "dependencies": {
    "@abhinav2203/codeflow-core": "workspace:*",
    "@abhinav2203/codeflow-agent": "workspace:*",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 0.3: Create `packages/codeflow-evolution/tsconfig.json`**

```json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 0.4: Create `packages/codeflow-evolution/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
```

- [ ] **Step 0.5: Run `npm install`**

Run: `cd packages/codeflow-evolution && npm install`
Expected: Dependencies resolved without errors

---

## Step 1 — Move genetic algorithm to package

- [ ] **Step 1.1: Create `packages/codeflow-evolution/src/genetic/index.ts`**

Copy `src/lib/blueprint/genetic.ts` content, but:
- Change `import { computeGraphMetrics } from "@/lib/blueprint/metrics"` → `import { computeGraphMetrics } from "@abhinav2203/codeflow-core/metrics"`
- Change `import type { ..., TournamentResult, ArchitectureVariant, ... } from "@/lib/blueprint/schema"` → `import type { ..., TournamentResult, ArchitectureVariant, ... } from "@abhinav2203/codeflow-core"`
- Keep ALL exports: `benchmarkVariant`, `generateInitialPopulation`, `evolveArchitectures`, `generateMonolithVariant`, `generateMicroservicesVariant`, `generateServerlessVariant`

- [ ] **Step 1.2: Create `packages/codeflow-evolution/src/genetic/index.test.ts`**

Copy `src/lib/blueprint/genetic.test.ts`:
- Change `import { ..., evolveArchitectures } from "@/lib/blueprint/genetic"` → `import { ..., evolveArchitectures } from "./index"`
- Change `import type { BlueprintGraph } from "@/lib/blueprint/schema"` → `import type { BlueprintGraph } from "@abhinav2203/codeflow-core"`

- [ ] **Step 1.3: Run check**

Run: `cd packages/codeflow-evolution && npm run check`
Expected: No TypeScript errors

- [ ] **Step 1.4: Run tests**

Run: `cd packages/codeflow-evolution && npm run test`
Expected: All genetic tests pass

- [ ] **Step 1.5: Commit**

```bash
cd packages/codeflow-evolution
git add src/genetic/ package.json tsconfig.json vitest.config.ts
git commit -m "feat(evolution): move genetic algorithm to package"
```

---

## Step 2 — Move ghost nodes to package

- [ ] **Step 2.1: Create `packages/codeflow-evolution/src/types.ts`**

```typescript
export interface LLMProvider {
  complete(
    prompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string>;
}

export const DEFAULT_LLM_PROVIDER = "nvidia";
```

- [ ] **Step 2.2: Create `packages/codeflow-evolution/src/ghost/heuristic.ts`**

Copy the `buildHeuristicSuggestions` function from `src/app/api/ghost-nodes/route.ts`:
- Change `import type { BlueprintGraph, GhostNode } from "@/lib/blueprint/schema"` → `import type { BlueprintGraph, GhostNode } from "@abhinav2203/codeflow-core"`
- Export as `buildHeuristicSuggestions(graph: BlueprintGraph): GhostNode[]`

- [ ] **Step 2.3: Create `packages/codeflow-evolution/src/ghost/provider.ts`**

```typescript
import type { LLMProvider } from "../types.js";

export const nvidiaProvider: LLMProvider = {
  async complete(prompt, options) {
    // Lazy import to avoid circular deps
    const { requestNvidiaChatCompletion } = await import("@abhinav2203/codeflow-agent/ai");
    return requestNvidiaChatCompletion({
      apiKey: process.env.NVIDIA_API_KEY!,
      messages: [{ role: "user", content: prompt }],
      temperature: options?.temperature ?? 0.4,
      topP: 0.8,
      maxTokens: options?.maxTokens ?? 1024
    });
  }
};

export const providers = {
  nvidia: nvidiaProvider
  // anthropic: ...
  // openai: ...
};
```

- [ ] **Step 2.4: Create `packages/codeflow-evolution/src/ghost/ai.ts`**

Copy the AI path from `src/app/api/ghost-nodes/route.ts`:
- `GHOST_SYSTEM_PROMPT` constant
- `getGhostSuggestionsAI(provider: LLMProvider, graph: BlueprintGraph, apiKey?: string)` → `Promise<GhostNode[]>`
- Change imports: `import { withCodeflowGovernance } from "@/lib/blueprint/prompt-governance"` → import from `@abhinav2203/codeflow-agent`
- Change schema imports → `@abhinav2203/codeflow-core`

- [ ] **Step 2.5: Create `packages/codeflow-evolution/src/ghost/index.ts`**

```typescript
import type { GhostNode } from "@abhinav2203/codeflow-core";
import type { LLMProvider } from "../types.js";
import { buildHeuristicSuggestions } from "./heuristic.js";
import { getGhostSuggestionsAI } from "./ai.js";
import { providers } from "./provider.js";

export interface GhostOptions {
  nvidiaApiKey?: string;
  provider?: LLMProvider;
  maxSuggestions?: number;
}

export interface GhostResult {
  suggestions: GhostNode[];
  provenance: "ai" | "heuristic";
  provider: string;
}

export async function getGhostSuggestions(
  graph: BlueprintGraph,
  options?: GhostOptions
): Promise<GhostResult> {
  const maxSuggestions = options?.maxSuggestions ?? 4;

  if (options?.nvidiaApiKey || process.env.NVIDIA_API_KEY) {
    const provider = options?.provider ?? providers.nvidia;
    const apiKey = options?.nvidiaApiKey ?? process.env.NVIDIA_API_KEY!;
    const suggestions = await getGhostSuggestionsAI(provider, graph, apiKey);
    return {
      suggestions: suggestions.slice(0, maxSuggestions),
      provenance: "ai",
      provider: "nvidia"
    };
  }

  // Heuristic fallback
  const suggestions = buildHeuristicSuggestions(graph);
  return {
    suggestions: suggestions.slice(0, maxSuggestions),
    provenance: "heuristic",
    provider: "built-in"
  };
}
```

- [ ] **Step 2.6: Create `packages/codeflow-evolution/src/ghost/ai.test.ts`**

- Mock LLM provider, test AI path returns ghost nodes with `provenance: "ai"`
- Test invalid JSON fallback to heuristic
- Test max 4 suggestions enforced

- [ ] **Step 2.7: Run check and tests**

Run: `cd packages/codeflow-evolution && npm run check && npm run test`
Expected: Both pass

- [ ] **Step 2.8: Commit**

```bash
cd packages/codeflow-evolution
git add src/ghost/ src/types.ts
git commit -m "feat(evolution): add ghost nodes with pluggable LLM provider"
```

---

## Step 3 — Create CLI bin

- [ ] **Step 3.1: Create `packages/codeflow-evolution/src/bin/cli.ts`**

```typescript
#!/usr/bin/env node
import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getGhostSuggestions } from "../ghost/index.js";
import { evolveArchitectures } from "../genetic/index.js";

const COMMANDS = {
  ghost: async (args: string[]) => {
    const { values } = parseArgs({
      options: {
        json: { type: "boolean", default: false },
        key: { type: "string" },
        provider: { type: "string", default: "nvidia" }
      },
      argv: args
    });

    const graphPath = values._[0] ?? "blueprint.json";
    const graph = JSON.parse(readFileSync(resolve(graphPath), "utf-8"));
    const result = await getGhostSuggestions(graph, { nvidiaApiKey: values.key });

    if (values.json) {
      console.json(result);
    } else {
      console.log(`\nGhost Nodes (${result.suggestions.length} suggested)`);
      console.log(`Provenance: ${result.provenance} | Provider: ${result.provider}\n`);
      for (const s of result.suggestions) {
        console.log(`  → ${s.id} (${s.kind})`);
        console.log(`    ${s.summary}`);
        console.log(`    Reason: ${s.reason}`);
        if (s.suggestedEdge) {
          console.log(`    Edge: ${s.suggestedEdge.from} → ${s.suggestedEdge.to} [${s.suggestedEdge.kind}]`);
        }
        console.log();
      }
    }
  },

  evolve: async (args: string[]) => {
    const { values } = parseArgs({
      options: {
        json: { type: "boolean", default: false },
        generations: { type: "number", default: 10 },
        population: { type: "number", default: 12 }
      },
      argv: args
    });

    const graphPath = values._[0] ?? "blueprint.json";
    const graph = JSON.parse(readFileSync(resolve(graphPath), "utf-8"));

    if (!values.json) {
      console.log(`Running evolutionary tournament...`);
    }

    const result = evolveArchitectures(graph, {
      generations: values.generations,
      populationSize: values.population
    });

    const winner = result.variants[0];

    if (values.json) {
      console.json({ winner, variants: result.variants, summary: result.summary });
    } else {
      console.log(`\nWinner: ${winner.style} (fitness: ${winner.benchmark.fitness}/100)`);
      console.log(`  Scalability: ${winner.benchmark.scalability} | Performance: ${winner.benchmark.performance}`);
      console.log(`  Maintainability: ${winner.benchmark.maintainability} | Cost: ${winner.benchmark.estimatedCostScore}`);
      console.log(`\n${result.summary}\n`);
    }
  }
};

// main
const [cmd, ...args] = process.argv.slice(2);
if (cmd === "ghost") await COMMANDS.ghost(args);
else if (cmd === "evolve") await COMMANDS.evolve(args);
else {
  console.log(`Usage: codeflow-evolution <command>

Commands:
  ghost <blueprint.json>     Get ghost node suggestions
  evolve <blueprint.json>    Run genetic architecture evolution

Options:
  --json                      Output machine-readable JSON
  --key <nvidia-key>         NVIDIA API key for AI suggestions
  --generations <n>          Number of generations (default: 10)
  --population <n>            Population size (default: 12)
`);
}
```

- [ ] **Step 3.2: Run isolation test**

Run: `cd packages/codeflow-evolution && npm run build && node dist/bin/cli.js ghost ./test-fixtures/sample-blueprint.json`
Expected: Returns ghost node suggestions (heuristic, no API key needed)

- [ ] **Step 3.3: Commit**

```bash
cd packages/codeflow-evolution
git add src/bin/cli.ts
git commit -m "feat(evolution): add CLI bin with ghost and evolve commands"
```

---

## Step 4 — Create test fixtures

- [ ] **Step 4.1: Create `packages/codeflow-evolution/test-fixtures/minimal-blueprint.json`**

```json
{
  "projectName": "MinimalApp",
  "mode": "essential",
  "generatedAt": "2026-05-13T00:00:00.000Z",
  "warnings": [],
  "workflows": [],
  "nodes": [
    { "id": "mod:auth", "kind": "module", "name": "AuthModule", "summary": "Auth module", "contract": { "summary": "", "responsibilities": [], "inputs": [], "outputs": [], "attributes": [], "methods": [], "sideEffects": [], "errors": [], "dependencies": [], "calls": [], "uiAccess": [], "backendAccess": [], "notes": [] }, "sourceRefs": [], "generatedRefs": [], "traceRefs": [] },
    { "id": "api:login", "kind": "api", "name": "POST /login", "summary": "Login endpoint", "contract": { "summary": "", "responsibilities": [], "inputs": [], "outputs": [], "attributes": [], "methods": [], "sideEffects": [], "errors": [], "dependencies": [], "calls": [], "uiAccess": [], "backendAccess": [], "notes": [] }, "sourceRefs": [], "generatedRefs": [], "traceRefs": [] }
  ],
  "edges": [
    { "from": "api:login", "to": "mod:auth", "kind": "calls", "required": true, "confidence": 0.9 }
  ]
}
```

- [ ] **Step 4.2: Create `packages/codeflow-evolution/test-fixtures/sample-blueprint.json`**

A realistic 5-node graph: module, api, 2 functions, ui-screen with edges between them.

- [ ] **Step 4.3: Commit**

```bash
cd packages/codeflow-evolution
git add test-fixtures/
git commit -m "test(evolution): add test fixtures for isolation testing"
```

---

## Step 5 — Final verification

- [ ] **Step 5.1: Run all package checks**

Run: `cd packages/codeflow-evolution && npm run check && npm run test && npm run build`
Expected: `tsc --noEmit` passes, `vitest run` passes, build produces `dist/`

- [ ] **Step 5.2: Verify CLI**

```bash
cd packages/codeflow-evolution
node dist/bin/cli.js ghost test-fixtures/sample-blueprint.json           # human output
node dist/bin/cli.js ghost test-fixtures/sample-blueprint.json --json   # JSON output
node dist/bin/cli.js evolve test-fixtures/sample-blueprint.json         # evolve
node dist/bin/cli.js --version                                          # version
```

- [ ] **Step 5.3: Commit**

```bash
cd packages/codeflow-evolution
git add -A
git commit -m "feat(evolution): complete codeflow-evolution package v0.1.0"
```

---

## Summary of All Changes

| File | Action |
|------|--------|
| `packages/codeflow-evolution/` | Created — all package source |
| `src/lib/blueprint/genetic.ts` | Stays (used via workspace dep) |
| `src/app/api/ghost-nodes/route.ts` | Stays (uses package) |
| `src/app/api/genetic/evolve/route.ts` | Stays (uses package) |

---

## Verification Checklist (NPM Package Testing)

### Ghost Nodes
- [ ] `codeflow-evolution ghost <file>` — human-readable, 1-4 suggestions
- [ ] `codeflow-evolution ghost <file> --json` — valid JSON output
- [ ] Heuristic fires without API key
- [ ] All ghost IDs prefixed `ghost:`, have `kind/name/summary/reason/suggestedEdge`

### Genetic Algorithm
- [ ] `codeflow-evolution evolve <file>` — 10 generations, 12 population
- [ ] `codeflow-evolution evolve <file> --generations 3 --population 6` — custom params
- [ ] All 3 styles (monolith/microservices/serverless) in variants
- [ ] Winner fitness displayed

### Package Integrity
- [ ] `npm install @abhinav2203/codeflow-evolution` — installs standalone
- [ ] `npm run check/test/build` — all pass
- [ ] CLI bin executable

### Provider Interface
- [ ] `codeflow-evolution ghost --key <key>` — uses NVIDIA provider