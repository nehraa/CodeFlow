import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const cliPath = resolve(__dirname, "../dist/bin/cli.js");
const content = readFileSync(cliPath, "utf-8");

const shebang = "#!/usr/bin/env node\n";
const lines = content.split("\n");

// TypeScript compiler may add its own shebang, resulting in two.
// Strip both if present so we end up with exactly one.
let withoutShebangs = content;
if (lines[0] === "#!/usr/bin/env node") {
  withoutShebangs = lines.slice(1).join("\n");
  if (withoutShebangs.startsWith("#!/usr/bin/env node")) {
    withoutShebangs = withoutShebangs.slice(shebang.length);
  }
}

const wrapped = shebang + withoutShebangs.trimStart();
const outPath = resolve(__dirname, "../dist/bin/cli.js");
writeFileSync(outPath, wrapped, "utf-8");

console.log("CLI wrapper written to dist/bin/cli.js");