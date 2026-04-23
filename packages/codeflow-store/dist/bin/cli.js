#!/usr/bin/env node
import { loadLatestSession, upsertSession, createSessionId } from "../session/index.js";
import { getApprovalRecord, approveRecord } from "../approval/index.js";
import { createCheckpointIfNeeded } from "../checkpoint/index.js";
import { assessExportRisk } from "../risk/index.js";
import { loadBranches } from "../branch/index.js";
import { loadObservabilitySnapshot, mergeObservabilitySnapshot } from "../observability/index.js";
const USAGE = `CodeFlow Store CLI

Usage:
  codeflow-store session init <projectName>   Create a new session
  codeflow-store session last <projectName>   Load the latest session
  codeflow-store checkpoint create <checkpointId> <outputDir> <runId>
  codeflow-store approval approve <approvalId>  Approve a pending approval
  codeflow-store approval get <approvalId>     Get approval record
  codeflow-store risk assess <graphJson> [outputDir]  Assess export risk
  codeflow-store branch list <projectName>     List branches
  codeflow-store branch switch <projectName> <branchId> [graphJson]
  codeflow-store run list                      List run records
  codeflow-store observability get <projectName>  Get observability snapshot
  codeflow-store observability merge <projectName> <spansJson> <logsJson>
  codeflow-store --help                        Show this help`;
const fail = (msg) => {
    console.error(msg);
    process.exit(1);
};
const parseJsonFile = async (filePath) => {
    const { readFileSync } = await import("node:fs");
    return JSON.parse(readFileSync(filePath, "utf8"));
};
const main = async () => {
    const args = process.argv.slice(2);
    if (args[0] === "--help" || args[0] === "-h" || args.length === 0) {
        console.log(USAGE);
        process.exit(0);
    }
    const [command, subcommand, ...rest] = args;
    switch (`${command} ${subcommand}`) {
        case "session init": {
            const projectName = rest[0] ?? fail("projectName required");
            const sessionId = createSessionId();
            const graph = {
                projectName,
                mode: "essential",
                generatedAt: new Date().toISOString(),
                nodes: [],
                edges: [],
                workflows: [],
                warnings: []
            };
            const runPlan = {
                generatedAt: new Date().toISOString(),
                tasks: [],
                batches: [],
                warnings: []
            };
            const session = await upsertSession({ sessionId, graph, runPlan });
            console.log(JSON.stringify(session, null, 2));
            break;
        }
        case "session last": {
            const projectName = rest[0] ?? fail("projectName required");
            const session = await loadLatestSession(projectName);
            if (!session) {
                fail(`No session found for project: ${projectName}`);
            }
            console.log(JSON.stringify(session, null, 2));
            break;
        }
        case "checkpoint create": {
            const checkpointId = rest[0] ?? fail("checkpointId required");
            const outputDir = rest[1] ?? fail("outputDir required");
            const runId = rest[2] ?? fail("runId required");
            const dir = await createCheckpointIfNeeded(outputDir, runId);
            console.log(JSON.stringify({ checkpointDir: dir }, null, 2));
            break;
        }
        case "approval approve": {
            const approvalId = rest[0] ?? fail("approvalId required");
            const approver = rest[1] ?? fail("approver name required");
            const approval = await approveRecord(approvalId, approver);
            console.log(JSON.stringify(approval, null, 2));
            break;
        }
        case "approval get": {
            const approvalId = rest[0] ?? fail("approvalId required");
            const approval = await getApprovalRecord(approvalId);
            if (!approval) {
                fail(`Approval not found: ${approvalId}`);
            }
            console.log(JSON.stringify(approval, null, 2));
            break;
        }
        case "risk assess": {
            const graphJson = rest[0] ?? fail("graph JSON file required");
            const outputDir = rest[1];
            const graph = await parseJsonFile(graphJson);
            const runPlan = {
                generatedAt: new Date().toISOString(),
                tasks: [],
                batches: [],
                warnings: []
            };
            const assessment = await assessExportRisk(graph, runPlan, outputDir);
            console.log(JSON.stringify(assessment, null, 2));
            break;
        }
        case "branch list": {
            const projectName = rest[0] ?? fail("projectName required");
            const branches = await loadBranches(projectName);
            console.log(JSON.stringify(branches, null, 2));
            break;
        }
        case "branch switch": {
            // Note: branch switching is managed via the branches API routes.
            // This command is a placeholder for future branch-switch functionality.
            console.log(JSON.stringify({ message: "Branch switching is handled via the API. Use POST /api/branches to create/switch branches." }, null, 2));
            break;
        }
        case "run list": {
            const { readdir } = await import("node:fs/promises");
            const { getStoreRoot } = await import("../shared/utils.js");
            const runsDir = getStoreRoot() + "/runs";
            let files = [];
            try {
                files = await readdir(runsDir);
            }
            catch {
                files = [];
            }
            console.log(JSON.stringify(files, null, 2));
            break;
        }
        case "observability get": {
            const projectName = rest[0] ?? fail("projectName required");
            const snapshot = await loadObservabilitySnapshot(projectName);
            if (!snapshot) {
                fail(`No observability snapshot found for project: ${projectName}`);
            }
            console.log(JSON.stringify(snapshot, null, 2));
            break;
        }
        case "observability merge": {
            const projectName = rest[0] ?? fail("projectName required");
            const spansJson = rest[1] ?? fail("spans JSON file required");
            const logsJson = rest[2] ?? fail("logs JSON file required");
            const spans = await parseJsonFile(spansJson);
            const logs = await parseJsonFile(logsJson);
            const snapshot = await mergeObservabilitySnapshot({
                projectName,
                spans: spans,
                logs: logs
            });
            console.log(JSON.stringify(snapshot, null, 2));
            break;
        }
        default:
            fail(`Unknown command: ${command} ${subcommand}\n${USAGE}`);
    }
};
main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
//# sourceMappingURL=cli.js.map