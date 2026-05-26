#!/usr/bin/env node
import "dotenv/config";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { buildUserFlows, computeDigitalTwinSnapshot, buildSimulationSpans, overlayActiveNodes } from "../index.js";
const { values, positionals } = parseArgs({
    options: {
        help: { type: "boolean", default: false },
        "trace-latest": { type: "boolean", default: false },
        iterations: { type: "string", default: "10" },
        json: { type: "boolean", default: false }
    },
    allowPositionals: true
});
if (values.help || positionals.length === 0) {
    console.log(`
Digital Twin Simulation Engine

Usage:
  codeflow-dtwin <command> [options]

Commands:
  simulate <blueprint.json> [trace-data.json]
    Run digital twin simulation on a blueprint

  snapshot <blueprint.json> [--trace-latest]
    Compute digital twin snapshot from latest trace data

  active-nodes <blueprint.json> [trace-data.json]
    Identify which nodes are active based on trace spans

  build-flows <blueprint.json> <trace-data.json>
    Build user flows from trace spans

Options:
  --trace-latest         Use latest trace data from store
  --iterations <n>      Number of simulation iterations (default: 10)
  --json                 Output as JSON

Examples:
  codeflow-dtwin simulate ./blueprint.json
  codeflow-dtwin snapshot ./blueprint.json --trace-latest
  codeflow-dtwin active-nodes ./blueprint.json ./trace-spans.json
`);
    process.exit(0);
}
const [command, ...args] = positionals;
async function run() {
    switch (command) {
        case "simulate": {
            const [blueprintPath, tracePath] = args;
            if (!blueprintPath) {
                console.error("Error: blueprint.json path required");
                process.exit(1);
            }
            const graph = JSON.parse(readFileSync(blueprintPath, "utf8"));
            const nodeIds = graph.nodes.slice(0, 5).map(n => n.id);
            const spans = buildSimulationSpans(graph, nodeIds, "CLI simulation", "simulation");
            const snapshot = computeDigitalTwinSnapshot(graph, spans, 60);
            if (values.json) {
                console.log(JSON.stringify({ snapshot, spans }, null, 2));
            }
            else {
                console.log("Simulation complete:");
                console.log(`  Active nodes: ${snapshot.activeNodeIds.length}`);
                console.log(`  Observed spans: ${snapshot.observedSpanCount}`);
                console.log(`  Simulated spans: ${snapshot.simulatedSpanCount}`);
                console.log(`  Flows: ${snapshot.flows.length}`);
            }
            break;
        }
        case "snapshot": {
            const [blueprintPath] = args;
            if (!blueprintPath) {
                console.error("Error: blueprint.json path required");
                process.exit(1);
            }
            const graph = JSON.parse(readFileSync(blueprintPath, "utf8"));
            // For CLI, use empty spans (would come from trace store in real usage)
            const snapshot = computeDigitalTwinSnapshot(graph, [], 60);
            const overlaid = overlayActiveNodes(graph, snapshot.activeNodeIds);
            if (values.json) {
                console.log(JSON.stringify({ snapshot, overlaid }, null, 2));
            }
            else {
                console.log("Snapshot computed:");
                console.log(`  Project: ${snapshot.projectName}`);
                console.log(`  Active nodes: ${snapshot.activeNodeIds.length}`);
                console.log(`  Flows: ${snapshot.flows.length}`);
                console.log(`  Computed at: ${snapshot.computedAt}`);
            }
            break;
        }
        case "active-nodes": {
            const [blueprintPath, tracePath] = args;
            if (!blueprintPath) {
                console.error("Error: blueprint.json path required");
                process.exit(1);
            }
            const graph = JSON.parse(readFileSync(blueprintPath, "utf8"));
            // Load trace spans if provided, otherwise use empty
            let spans = [];
            if (tracePath) {
                const traceData = JSON.parse(readFileSync(tracePath, "utf8"));
                spans = traceData.spans ?? traceData;
            }
            const flows = buildUserFlows(graph, spans);
            const snapshot = computeDigitalTwinSnapshot(graph, spans, 60);
            const overlaidGraph = overlayActiveNodes(graph, snapshot.activeNodeIds);
            if (values.json) {
                console.log(JSON.stringify({ activeNodeIds: snapshot.activeNodeIds, flows, overlaidGraph }, null, 2));
            }
            else {
                console.log("Active nodes identified:");
                console.log(`  Count: ${snapshot.activeNodeIds.length}`);
                console.log(`  Nodes: ${snapshot.activeNodeIds.join(", ") || "(none)"}`);
                console.log(`  Flows: ${flows.length}`);
            }
            break;
        }
        case "build-flows": {
            const [blueprintPath, tracePath] = args;
            if (!blueprintPath || !tracePath) {
                console.error("Error: blueprint.json and trace-data.json paths required");
                process.exit(1);
            }
            const graph = JSON.parse(readFileSync(blueprintPath, "utf8"));
            const traceData = JSON.parse(readFileSync(tracePath, "utf8"));
            const spans = traceData.spans ?? traceData;
            const flows = buildUserFlows(graph, spans);
            if (values.json) {
                console.log(JSON.stringify({ flows }, null, 2));
            }
            else {
                console.log("User flows built:");
                for (const flow of flows) {
                    console.log(`  - ${flow.name} (${flow.spanCount} spans, status: ${flow.status})`);
                }
            }
            break;
        }
        default:
            console.error(`Unknown command: ${command}`);
            process.exit(1);
    }
}
run().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map