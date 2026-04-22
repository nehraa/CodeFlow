import fs from "node:fs/promises";
import path from "node:path";
import { blueprintGraphSchema } from "@abhinav2203/codeflow-core/schema";
import { observabilityPath } from "../shared/utils.js";
const ensureDir = async (dirPath) => {
    await fs.mkdir(dirPath, { recursive: true });
};
const writeSnapshotFile = async (projectName, snapshot) => {
    const filePath = observabilityPath(projectName);
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
};
export const loadObservabilitySnapshot = async (projectName) => {
    try {
        const content = await fs.readFile(observabilityPath(projectName), "utf8");
        return JSON.parse(content);
    }
    catch {
        return null;
    }
};
export const mergeObservabilitySnapshot = async ({ projectName, spans, logs, graph }) => {
    const existing = await loadObservabilitySnapshot(projectName);
    const snapshot = {
        projectName,
        updatedAt: new Date().toISOString(),
        spans: [...(existing?.spans ?? []), ...spans].slice(-500),
        logs: [...(existing?.logs ?? []), ...logs].slice(-500),
        graph: graph ? blueprintGraphSchema.parse(graph) : existing?.graph
    };
    await writeSnapshotFile(projectName, snapshot);
    return snapshot;
};
//# sourceMappingURL=index.js.map