# codeflow-mcp Package Decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract `src/lib/blueprint/mcp.ts`, its test, and the two MCP API routes into a standalone npm package `@abhinav2203/codeflow-mcp` that works in isolation — no monorepo, no Next.js app required.

**Architecture:** The package exposes an MCP client library (`listMcpTools`, `invokeMcpTool`) and an MCP server that wraps CodeFlow blueprint operations. API routes in the Next.js app are replaced with thin re-exports from the package. During development, packages use `workspace:*` ranges; once published to npm, these resolve to published semver.

**Tech Stack:** TypeScript, Node.js, `zod`, `vitest`, MCP JSON-RPC protocol

---

## Step 0 — Scaffold Package Skeleton

- [ ] **Step 0.1: Create directory structure**

```bash
mkdir -p packages/codeflow-mcp/src/{bin,invoke,tools}
mkdir -p packages/codeflow-mcp/test-fixtures
```

- [ ] **Step 0.2: Create `packages/codeflow-mcp/package.json`**

```json
{
  "name": "@abhinav2203/codeflow-mcp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".":        { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./invoke": { "types": "./dist/invoke.d.ts",  "default": "./dist/invoke.js"  },
    "./tools":  { "types": "./dist/tools.d.ts",   "default": "./dist/tools.js"   }
  },
  "bin": {
    "codeflow-mcp": "./dist/bin/cli.js"
  },
  "scripts": {
    "check": "tsc --noEmit",
    "test": "vitest run",
    "build": "tsc && node scripts/wrap-cli.mjs",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@abhinav2203/codeflow-core": "workspace:*",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

- [ ] **Step 0.3: Create `packages/codeflow-mcp/tsconfig.json`**

```json
{
  "extends": '../../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 0.4: Create `packages/codeflow-mcp/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
```

- [ ] **Step 0.5: Create `scripts/wrap-cli.mjs`** (wraps the TS compile step for the CLI bin — the bin entry must be a .js file)

```javascript
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, "../dist");
const distBin = join(srcDir, "bin");

// The CLI is a thin wrapper that loads the compiled module
writeFileSync(join(distBin, "cli.js"), `#!/usr/bin/env node
import { main } from "../invoke/index.js";
main();
`);
```

- [ ] **Step 0.6: Run `npm install` in the package**

Run: `cd packages/codeflow-mcp && npm install`
Expected: Dependencies resolved without errors

---

## Step 1 — Move core `mcp.ts` logic

- [ ] **Step 1.1: Create `packages/codeflow-mcp/src/index.ts`** — copy `src/lib/blueprint/mcp.ts` content, but:
  - Remove `@/lib/blueprint/schema` import — import `McpTool`, `McpToolResult` types from `@abhinav2203/codeflow-core`
  - Keep all functions: `sendJsonRpc`, `listMcpTools`, `invokeMcpTool`, `extractTextFromMcpResult`

- [ ] **Step 1.2: Run check**

Run: `cd packages/codeflow-mcp && npm run check`
Expected: No TypeScript errors (types resolve via workspace `codeflow-core`)

- [ ] **Step 1.3: Run tests**

Run: `cd packages/codeflow-mcp && npm run test`
Expected: All tests pass

- [ ] **Step 1.4: Commit**

```bash
cd packages/codeflow-mcp
git add src/index.ts package.json tsconfig.json vitest.config.ts scripts/
git commit -m "feat(mcp): move core MCP client library to package"
```

---

## Step 2 — Move API routes as package exports

- [ ] **Step 2.1: Create `packages/codeflow-mcp/src/invoke.ts`** — copy `src/app/api/mcp/invoke/route.ts`
  - Change import `from "@/lib/blueprint/mcp"` → `from "@abhinav2203/codeflow-mcp"`
  - Change import `from "next/server"` → `from "next"; import type { NextResponse } from "next"`
  - Keep all SSRF validation, header filtering, error handling

- [ ] **Step 2.2: Create `packages/codeflow-mcp/src/invoke.test.ts`** — copy `src/app/api/mcp/invoke/route.test.ts`
  - Change import `from "@/app/api/mcp/invoke/route"` → `from "./invoke"`

- [ ] **Step 2.3: Create `packages/codeflow-mcp/src/tools.ts`** — copy `src/app/api/mcp/tools/route.ts`
  - Change import `from "@/lib/blueprint/mcp"` → `from "@abhinav2203/codeflow-mcp"`
  - Change import `from "next/server"` → `from "next"; import type { NextResponse } from "next"`

- [ ] **Step 2.4: Create `packages/codeflow-mcp/src/tools.test.ts`** — copy `src/app/api/mcp/tools/route.test.ts`
  - Change import `from "@/app/api/mcp/tools/route"` → `from "./tools"`

- [ ] **Step 2.5: Create `packages/codeflow-mcp/src/index.test.ts`** — copy `src/lib/blueprint/mcp.test.ts`
  - Change import `from "@/lib/blueprint/mcp"` → `from "./index"`
  - Change import `from "@/lib/blueprint/schema"` → `from "@abhinav2203/codeflow-core"`

- [ ] **Step 2.6: Run check and tests**

Run: `cd packages/codeflow-mcp && npm run check && npm run test`
Expected: Both pass

- [ ] **Step 2.7: Commit**

```bash
cd packages/codeflow-mcp
git add src/invoke.ts src/invoke.test.ts src/tools.ts src/tools.test.ts src/index.test.ts
git commit -m "feat(mcp): move API routes as package sub-exports"
```

---

## Step 3 — Wire Next.js app to import from package

- [ ] **Step 3.1: Replace `src/app/api/mcp/invoke/route.ts`** with:

```typescript
// Re-export from package — implementation lives in the package now
export { POST as invokeRoute } from "@abhinav2203/codeflow-mcp/invoke";
```

- [ ] **Step 3.2: Replace `src/app/api/mcp/tools/route.ts`** with:

```typescript
export { POST as toolsRoute } from "@abhinav2203/codeflow-mcp/tools";
```

- [ ] **Step 3.3: Update test files** — update the test imports in both route.test.ts files so they still work with the Next.js app.

For `src/app/api/mcp/invoke/route.test.ts`, the test imports `POST` from the route. Since we've replaced the route with a re-export, we need to make sure the route still exports `POST`:

```typescript
// In src/app/api/mcp/invoke/route.ts — replace with:
import { POST } from "@abhinav2203/codeflow-mcp/invoke";
export { POST };
```

```typescript
// In src/app/api/mcp/tools/route.ts — replace with:
import { POST } from "@abhinav2203/codeflow-mcp/tools";
export { POST };
```

- [ ] **Step 3.4: Run full app type check**

Run: `cd /Users/abhinavnehra/git/CodeFlow && npm run check`
Expected: No TypeScript errors

- [ ] **Step 3.5: Commit**

```bash
cd /Users/abhinavnehra/git/CodeFlow
git add src/app/api/mcp/invoke/route.ts src/app/api/mcp/tools/route.ts
git commit -m "feat(mcp): wire API routes to import from @abhinav2203/codeflow-mcp"
```

---

## Step 4 — Add CLI bin and test-fixtures for isolation testing

- [ ] **Step 4.1: Create `packages/codeflow-mcp/src/bin/cli.ts`**

```typescript
#!/usr/bin/env node
import { listMcpTools, invokeMcpTool } from "../index.js";

const [cmd, ...args] = process.argv.slice(2);

if (cmd === "tool" && args[0] === "list") {
  const serverUrl = args[1] ?? "http://localhost:3001/mcp";
  const tools = await listMcpTools(serverUrl);
  console.json({ tools });
} else if (cmd === "tool" && args[0] === "invoke") {
  const toolName = args[1];
  const serverUrl = args[2] ?? "http://localhost:3001/mcp";
  const rawArgs = args[3] ?? "{}";
  const result = await invokeMcpTool(serverUrl, toolName, JSON.parse(rawArgs));
  console.json({ result });
} else {
  console.log("Usage: codeflow-mcp tool list <serverUrl>\n       codeflow-mcp tool invoke <name> <serverUrl> <args-json>");
}
```

- [ ] **Step 4.2: Create `test-fixtures/minimal-blueprint.json`**

A minimal BlueprintGraph JSON for CLI testing.

- [ ] **Step 4.3: Run isolation test**

Run: `cd packages/codeflow-mcp && npm run build && node dist/bin/cli.js tool list http://localhost:9999/mcp`
Expected: Returns 400 with connection error (server not running — this proves the CLI runs and makes the HTTP call)

- [ ] **Step 4.4: Commit**

```bash
cd packages/codeflow-mcp
git add src/bin/cli.ts test-fixtures/
git commit -m "feat(mcp): add CLI bin for isolation testing"
```

---

## Step 5 — Final verification

- [ ] **Step 5.1: Run all package checks**

Run: `cd packages/codeflow-mcp && npm run check && npm run test && npm run build`
Expected: `tsc --noEmit` passes, `vitest run` passes, build produces `dist/` with all entry points

- [ ] **Step 5.2: Verify app still works**

Run: `cd /Users/abhinavnehra/git/CodeFlow && npm run check`
Expected: App type-checks with the rewired routes

---

## Summary of all changes

| File | Action |
|------|--------|
| `packages/codeflow-mcp/` | Created — all package source lives here |
| `src/lib/blueprint/mcp.ts` | Stays (used by workspace dependency) |
| `src/app/api/mcp/invoke/route.ts` | Replaced with re-export from package |
| `src/app/api/mcp/tools/route.ts` | Replaced with re-export from package |
