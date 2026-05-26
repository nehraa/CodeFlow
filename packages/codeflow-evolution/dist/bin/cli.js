#!/usr/bin/env node
import { readFileSync } from "fs";
import { resolve } from "path";
import { suggestGhostNodes } from "../ghost/index.js";
import { evolveArchitectures } from "../genetic.js";
const USAGE = `
Usage:
  codeflow-evolution ghost <path-to-blueprint-json> [--provider openai|anthropic|nvidia|ollama]
  codeflow-evolution evolve <path-to-blueprint-json> --generations <N> --population <M>
`.trim();
async function readJsonFile(path) {
    return JSON.parse(readFileSync(resolve(path), "utf-8"));
}
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error(USAGE);
        process.exit(1);
    }
    const command = args[0];
    if (command === "ghost") {
        const filePath = args[1];
        if (!filePath) {
            console.error("Error: missing blueprint file path");
            console.error(USAGE);
            process.exit(1);
        }
        const graph = await readJsonFile(filePath);
        const provider = args[2] === "--provider" ? args[3] : undefined;
        if (provider)
            process.env.GHOST_PROVIDER = provider;
        console.error(`[ghost] Loading blueprint from ${filePath}...`);
        const ghosts = await suggestGhostNodes(graph);
        console.log(JSON.stringify(ghosts, null, 2));
        process.exit(0);
    }
    if (command === "evolve") {
        const filePath = args[1];
        if (!filePath) {
            console.error("Error: missing blueprint file path");
            console.error(USAGE);
            process.exit(1);
        }
        let generations = 3;
        let populationSize = 6;
        for (let i = 2; i < args.length; i++) {
            if (args[i] === "--generations" && args[i + 1]) {
                generations = parseInt(args[i + 1], 10);
                i++;
            }
            else if (args[i] === "--population" && args[i + 1]) {
                populationSize = parseInt(args[i + 1], 10);
                i++;
            }
        }
        const graph = await readJsonFile(filePath);
        console.error(`[evolve] Running ${generations} generations with population ${populationSize}...`);
        const result = evolveArchitectures(graph, { generations, populationSize });
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
    }
    console.error(`Unknown command: ${command}`);
    console.error(USAGE);
    process.exit(1);
}
main().catch((err) => {
    console.error(String(err));
    process.exit(1);
});
//# sourceMappingURL=cli.js.map