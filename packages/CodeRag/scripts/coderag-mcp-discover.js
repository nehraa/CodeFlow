#!/usr/bin/env node
// Auto-discovers or creates a default coderag.config.json in CWD,
// auto-indexes if needed, then launches the CodeRag MCP server.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Try global npm package first, fall back to git repo
function resolveCliPath() {
  // Try 1: globally installed npm package via require.resolve
  try {
    const pkgPath = require.resolve("@abhinav2203/coderag/package.json");
    const pkgDir = path.dirname(pkgPath);
    const cli = path.join(pkgDir, "dist/bin/coderag.js");
    if (fs.existsSync(cli)) return { cmd: "node", args: [cli] };
  } catch {}

  // Try 2: `which coderag`
  const which = spawnSync("which", ["coderag"], { stdio: ["pipe", "pipe", "pipe"] });
  if (which.status === 0) {
    const coderagPath = which.stdout.toString().trim();
    if (coderagPath && fs.existsSync(coderagPath)) return { cmd: coderagPath, args: [] };
  }

  // Try 3: git repo fallback
  const gitRepoCli = path.resolve(__dirname, "../dist/cli.js");
  if (fs.existsSync(gitRepoCli)) return { cmd: "node", args: [gitRepoCli] };

  console.error("[coderag-mcp] ERROR: Cannot find coderag CLI. Install with: npm i -g @abhinav2203/coderag");
  process.exit(1);
}

const cli = resolveCliPath();
const CONFIG_NAME = "coderag.config.json";
const CONFIG_NAMES = [CONFIG_NAME, ".coderag.json"];

const defaultConfig = (cwd) => ({
  repoPath: cwd,
  storageRoot: ".coderag",
  retrieval: { topK: 6, rerankK: 3 },
  traversal: { defaultDepth: 1, maxDepth: 3 },
  embedding: { provider: "onnx" }
});

const findConfig = () => {
  const cwd = process.cwd();
  // Check current directory first
  for (const name of CONFIG_NAMES) {
    const candidate = path.join(cwd, name);
    if (fs.existsSync(candidate)) {
      return { configPath: candidate, cwd };
    }
  }
  // Then walk up parent directories
  let dir = path.dirname(cwd);
  while (dir !== path.dirname(dir)) {
    for (const name of CONFIG_NAMES) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) {
        return { configPath: candidate, cwd: dir };
      }
    }
    dir = path.dirname(dir);
  }
  return null;
};

// 1. Find existing config or create one in CWD
let found = findConfig();
let configPath, configCwd;

if (found) {
  configPath = found.configPath;
  configCwd = found.cwd;
} else {
  configCwd = process.cwd();
  configPath = path.join(configCwd, CONFIG_NAME);
  fs.writeFileSync(configPath, JSON.stringify(defaultConfig(configCwd), null, 2) + "\n");
  console.error(`[coderag-mcp] Created default config at ${configPath}`);
}

// 2. Auto-index if the .coderag directory is missing
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const storageRoot = path.resolve(configCwd, config.storageRoot ?? ".coderag");
if (!fs.existsSync(storageRoot)) {
  console.error(`[coderag-mcp] No index found. Running coderag init...`);
  const result = spawnSync(cli.cmd, [...cli.args, "init", "--config", configPath], {
    cwd: configCwd,
    stdio: "inherit",
    env: process.env
  });
  if (result.status !== 0) {
    console.error(`[coderag-mcp] Indexing failed with exit code ${result.status}. MCP server will start but queries will be empty.`);
  }
}

// 3. Launch MCP server
const child = spawnSync(cli.cmd, [...cli.args, "serve-mcp", "--config", configPath], {
  stdio: "inherit",
  cwd: configCwd,
  env: process.env
});

process.exit(child.status ?? 0);
