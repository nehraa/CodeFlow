import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliSrc = resolve(__dirname, "../bin/cli.js");
const cliDest = resolve(__dirname, "../dist/bin/cli.js");

try {
  const content = readFileSync(cliSrc, "utf-8");
  writeFileSync(cliDest, content, "utf-8");
  console.log("CLI wrapper created at dist/bin/cli.js");
} catch {
  // If the compiled CLI doesn't exist yet, that's fine for the build step
}