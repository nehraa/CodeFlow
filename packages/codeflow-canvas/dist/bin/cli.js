#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
function renderJson(graph, options) {
    if (options.nodeId) {
        const node = graph.nodes.find((n) => n.id === options.nodeId);
        if (!node) {
            return JSON.stringify({ error: `Node ${options.nodeId} not found` }, null, 2);
        }
        return JSON.stringify(node, null, 2);
    }
    return JSON.stringify(graph, null, 2);
}
function renderText(graph) {
    const lines = [];
    lines.push(`# ${graph.projectName}`);
    lines.push(`Phase: ${graph.phase}`);
    lines.push("");
    lines.push("## Nodes");
    for (const node of graph.nodes) {
        lines.push(`- [${node.kind}] ${node.name}: ${node.summary}`);
    }
    lines.push("");
    lines.push("## Edges");
    for (const edge of graph.edges) {
        lines.push(`- ${edge.from} --[${edge.kind}]--> ${edge.to}`);
    }
    return lines.join("\n");
}
async function main() {
    const args = process.argv.slice(2);
    let filePath;
    let command = "render";
    const options = { format: "json" };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "render" && i + 1 < args.length) {
            command = "render";
            filePath = args[++i];
        }
        else if (args[i] === "--format" && i + 1 < args.length) {
            options.format = args[++i];
        }
        else if (args[i] === "--node" && i + 1 < args.length) {
            options.nodeId = args[++i];
        }
        else if (!args[i].startsWith("--")) {
            filePath = args[i];
        }
    }
    if (!filePath) {
        console.error("Usage: codeflow-canvas render <file> [--format json|text] [--node <id>]");
        process.exit(1);
    }
    const resolvedPath = resolve(filePath);
    let graph;
    try {
        const content = readFileSync(resolvedPath, "utf-8");
        graph = JSON.parse(content);
    }
    catch {
        console.error(`Failed to read or parse blueprint file: ${resolvedPath}`);
        process.exit(1);
    }
    switch (command) {
        case "render":
            if (options.format === "text") {
                console.log(renderText(graph));
            }
            else {
                console.log(renderJson(graph, options));
            }
            break;
        default:
            console.error(`Unknown command: ${command}`);
            process.exit(1);
    }
}
main().catch((err) => {
    console.error("CLI error:", err);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map