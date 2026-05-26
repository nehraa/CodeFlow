#!/usr/bin/env node
/**
 * codeflow-execution CLI
 *
 * Standalone CLI for running blueprint execution from a graph.
 *
 * Usage:
 *   codeflow-execution --graph ./graph.json
 *   codeflow-execution --graph ./graph.json --target function:save
 *   codeflow-execution --plan ./graph.json
 *   codeflow-execution --vcr ./spans.json --graph ./graph.json
 *   codeflow-execution --mermaid ./graph.json
 *
 * Input is a BlueprintGraph JSON file. The CLI reads it, runs the requested
 * operation, and outputs JSON to stdout.
 */
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
function showHelp() {
    console.log(`codeflow-execution v0.1.0

Run blueprint execution as a standalone CLI tool.

USAGE
  codeflow-execution <command> [options]

COMMANDS
  run          Execute a blueprint graph (default)
  plan         Generate execution plan from graph
  vcr          Build VCR recording from trace spans
  mermaid      Generate Mermaid diagram from graph

OPTIONS
  --graph <path>      Path to BlueprintGraph JSON file (required for run/plan/vcr/mermaid)
  --target <nodeId>    Optional node ID to execute (integration run if omitted)
  --input <path>      Path to input JSON (for run command)
  --output <path>     Output file path (writes JSON, default: stdout)
  --format <fmt>      Output format: json | mermaid (default: json)
  --class-diagram     Generate class diagram instead of flowchart (mermaid only)
  --spans <path>      Path to trace spans JSON (for vcr command)
  --help              Show this help message
  --version           Show version

EXAMPLES
  # Run a full integration test
  codeflow-execution run --graph ./blueprint.json

  # Run a specific node
  codeflow-execution run --graph ./blueprint.json --target function:save

  # Show execution plan
  codeflow-execution plan --graph ./blueprint.json

  # Build VCR replay recording
  codeflow-execution vcr --graph ./blueprint.json --spans ./traces.json

  # Generate Mermaid flowchart
  codeflow-execution mermaid --graph ./blueprint.json

  # Generate class diagram
  codeflow-execution mermaid --graph ./blueprint.json --class-diagram

ENVIRONMENT
  CODEFLOW_REPO_PATH   Root path for code generation output
`);
}
async function loadGraph(graphPath) {
    const content = readFileSync(graphPath, "utf8");
    return JSON.parse(content);
}
async function cmdRun(opts) {
    const { runBlueprint } = await import("../index.js");
    const { createRunPlan } = await import("../plan.js");
    const { applyExecutionResultToGraph } = await import("../phases.js");
    if (!opts.graph) {
        console.error("Error: --graph is required for run command");
        process.exit(1);
    }
    const graph = await loadGraph(opts.graph);
    let input = "{}";
    if (opts.input) {
        input = readFileSync(opts.input, "utf8");
    }
    const request = {
        graph,
        targetNodeId: opts.target,
        input,
        codeDrafts: {},
        includeGeneratedTests: false
    };
    const result = await runBlueprint(request);
    const updatedGraph = applyExecutionResultToGraph(graph, result, {
        integrationRun: !opts.target
    });
    const runPlan = createRunPlan(updatedGraph);
    const output = {
        success: result.success,
        exitCode: result.exitCode,
        steps: result.steps,
        artifacts: result.artifacts,
        summary: result.summary,
        executedNodeId: result.executedNodeId,
        runPlan,
        updatedGraph
    };
    if (opts.output) {
        const { writeFileSync } = await import("node:fs");
        writeFileSync(opts.output, JSON.stringify(output, null, 2));
        console.log(`Output written to ${opts.output}`);
    }
    else {
        console.log(JSON.stringify(output, null, 2));
    }
}
async function cmdPlan(opts) {
    const { createRunPlan } = await import("../plan.js");
    if (!opts.graph) {
        console.error("Error: --graph is required for plan command");
        process.exit(1);
    }
    const graph = await loadGraph(opts.graph);
    const plan = createRunPlan(graph);
    const output = { plan, nodeCount: graph.nodes.length, edgeCount: graph.edges.length };
    if (opts.output) {
        const { writeFileSync } = await import("node:fs");
        writeFileSync(opts.output, JSON.stringify(output, null, 2));
        console.log(`Output written to ${opts.output}`);
    }
    else {
        console.log(JSON.stringify(output, null, 2));
    }
}
async function cmdVcr(opts) {
    const { buildVcrRecording } = await import("../vcr.js");
    if (!opts.graph) {
        console.error("Error: --graph is required for vcr command");
        process.exit(1);
    }
    if (!opts.vcr && !opts.spans) {
        console.error("Error: --spans is required for vcr command");
        process.exit(1);
    }
    const spansPath = opts.vcr || opts.spans;
    const graph = await loadGraph(opts.graph);
    const spans = JSON.parse(readFileSync(spansPath, "utf8"));
    const recording = buildVcrRecording(graph, spans);
    const output = { recording, totalSpans: recording.totalSpans };
    if (opts.output) {
        const { writeFileSync } = await import("node:fs");
        writeFileSync(opts.output, JSON.stringify(output, null, 2));
        console.log(`Output written to ${opts.output}`);
    }
    else {
        console.log(JSON.stringify(output, null, 2));
    }
}
async function cmdMermaid(opts) {
    const { toMermaid, toMermaidClassDiagram } = await import("../mermaid.js");
    if (!opts.graph) {
        console.error("Error: --graph is required for mermaid command");
        process.exit(1);
    }
    const graph = await loadGraph(opts.graph);
    const diagram = opts.classDiagram ? toMermaidClassDiagram(graph) : toMermaid(graph);
    if (opts.output) {
        const { writeFileSync } = await import("node:fs");
        writeFileSync(opts.output, diagram);
        console.log(`Diagram written to ${opts.output}`);
    }
    else {
        console.log(diagram);
    }
}
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
        showHelp();
        return;
    }
    if (args.includes("--version") || args.includes("-v")) {
        console.log("codeflow-execution v0.1.0");
        return;
    }
    const opts = {};
    // Parse args
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--graph")
            opts.graph = args[++i];
        else if (arg === "--target")
            opts.target = args[++i];
        else if (arg === "--input")
            opts.input = args[++i];
        else if (arg === "--output")
            opts.output = args[++i];
        else if (arg === "--format")
            opts.format = args[++i];
        else if (arg === "--spans")
            opts.spans = args[++i];
        else if (arg === "--vcr")
            opts.vcr = args[++i];
        else if (arg === "--class-diagram")
            opts.classDiagram = true;
        else if (arg === "--mermaid")
            opts.mermaid = true;
        else if (arg === "run") { /* default command */ }
        else if (arg === "plan")
            opts.plan = true;
        else if (arg === "vcr")
            opts.vcr = args[++i] || opts.vcr;
        else if (arg === "mermaid")
            opts.mermaid = true;
    }
    // Determine command
    if (opts.mermaid || args.includes("mermaid")) {
        await cmdMermaid(opts);
    }
    else if (opts.vcr || opts.spans || args.includes("vcr")) {
        await cmdVcr(opts);
    }
    else if (opts.plan || args.includes("plan")) {
        await cmdPlan(opts);
    }
    else {
        // Default: run
        await cmdRun(opts);
    }
}
main().catch((err) => {
    console.error("Fatal error:", err.message);
    process.exit(1);
});
