import fs from "node:fs/promises";
import path from "node:path";
import { blueprintGraphSchema, observabilityLogSchema, observabilitySnapshotSchema, traceSpanSchema } from "@abhinav2203/codeflow-core/schema";
import { observabilityPath } from "../shared/utils.js";
import { loadObservabilityConfig } from "./config.js";
import { RingBuffer } from "./ring-buffer.js";
const ensureDir = async (dirPath) => {
    await fs.mkdir(dirPath, { recursive: true });
};
const writeSnapshotFile = async (projectName, snapshot) => {
    const filePath = observabilityPath(projectName);
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
};
export const loadObservabilitySnapshot = async (projectName) => {
    if (typeof projectName !== "string" || projectName.trim().length === 0) {
        throw new Error(`projectName must be a non-empty string; received: ${JSON.stringify(projectName)}`);
    }
    try {
        const content = await fs.readFile(observabilityPath(projectName), "utf8");
        return observabilitySnapshotSchema.parse(JSON.parse(content));
    }
    catch {
        return null;
    }
};
export const mergeObservabilitySnapshot = async (options) => {
    // GUARD: Check null BEFORE destructuring - this was the original bug
    if (options == null) {
        throw new Error(`mergeObservabilitySnapshot: options is required (received null). ` +
            `Expected { projectName: string, spans?: Span[], logs?: Log[], graph?: BlueprintGraph }`);
    }
    // Now we know options is not null, safe to destructure
    const { projectName, spans, logs, graph } = options;
    if (typeof projectName !== "string" || projectName.trim().length === 0) {
        throw new Error(`projectName must be a non-empty string; received: ${JSON.stringify(projectName)}`);
    }
    const validatedSpans = traceSpanSchema.array().parse(spans ?? []);
    const validatedLogs = observabilityLogSchema.array().parse(logs ?? []);
    const { maxSpans, maxLogs } = await loadObservabilityConfig(projectName);
    const existing = await loadObservabilitySnapshot(projectName);
    const spansBuffer = new RingBuffer(maxSpans);
    const logsBuffer = new RingBuffer(maxLogs);
    if (existing?.spans)
        spansBuffer.push(...existing.spans);
    if (existing?.logs)
        logsBuffer.push(...existing.logs);
    spansBuffer.push(...validatedSpans);
    logsBuffer.push(...validatedLogs);
    const snapshot = {
        projectName,
        updatedAt: new Date().toISOString(),
        spans: spansBuffer.toArray(),
        logs: logsBuffer.toArray(),
        graph: graph ? blueprintGraphSchema.parse(graph) : existing?.graph
    };
    await writeSnapshotFile(projectName, snapshot);
    return snapshot;
};
//# sourceMappingURL=index.js.map