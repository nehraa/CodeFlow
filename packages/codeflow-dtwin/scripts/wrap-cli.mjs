import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distBin = join(__dirname, "..", "dist", "bin");
const cliPath = join(distBin, "cli.js");

mkdirSync(distBin, { recursive: true });
if (!existsSync(cliPath)) {
  console.error(`CLI not found at ${cliPath}`);
  process.exit(1);
}

const compiled = readFileSync(cliPath, "utf8");
const lines = compiled.split("\n");
const firstNonShebang = lines.findIndex(line => !line.startsWith("#!"));
const withoutShebang = lines.slice(Math.max(0, firstNonShebang)).join("\n");
const withShebang = `#!/usr/bin/env node\n${withoutShebang}`;
writeFileSync(cliPath, withShebang);
console.log("CLI ready → dist/bin/cli.js");
