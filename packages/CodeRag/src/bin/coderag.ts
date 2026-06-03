#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cliPath = path.join(__dirname, "..", "cli.js");

// Build a fake argv so runCli can destructure [node, script, command, ...args].
const rawArgs = process.argv.slice(2);
const fakeArgv = [
  process.argv[0], // node binary
  __filename,      // this script
  ...rawArgs
];

const { runCli } = await import(cliPath);

if (rawArgs.length === 0) {
  console.error("coderag: missing required command.");
  console.log(`Usage:
  coderag setup
  coderag init [--config path] [--json]
  coderag index [--config path] [--json]
  coderag reindex [--config path] [--full] [--json]
  coderag query "question" [--config path] [--depth 2] [--json]
  coderag serve-mcp [--config path]
  coderag serve-http [--config path]
  coderag doctor [--config path] [--json]`);
  process.exit(1);
}

runCli(fakeArgv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
